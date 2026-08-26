import { Dependencies, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// §35: `_otherParty`/`initialsOf` below only ever read `.id`/`.name` off
// `owner`/`requester` — narrowed from `include: true` (the full User row,
// every column) since this include is used by all 4 list-tab queries *and*
// the detail query, on every poll tick.
const OTHER_PARTY_SELECT = { id: true, name: true };
const REQUEST_INCLUDE = {
  listing: { include: { book: true, owner: { select: OTHER_PARTY_SELECT }, photos: { orderBy: { sortOrder: 'asc' } } } },
  requester: { select: OTHER_PARTY_SELECT },
  exchange: { include: { handoverOtp: true, ratings: true } },
  pickup: { include: { pickupPoint: true } },
};

/**
 * §14: one normalized detail endpoint instead of the frontend assembling a
 * request + exchange + pickup + handover-otp picture from four separate
 * calls. The BookRequest id is the stable "exchange id" the frontend
 * navigates with for its whole lifetime — the review-only Exchange row (and
 * its handover OTP) only start existing once the request is accepted, but
 * both hang off the same request via a 1:1 relation, so this always resolves
 * from whichever id the frontend already has.
 */
@Dependencies(PrismaService)
@Injectable()
export class ExchangesService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * §44: the frontend's initial-load hydration (and its periodic safety-net
   * poll, since Task 35's socket push became the primary path) always wants
   * all 4 tabs at once — it used to be 4 separate HTTP round trips (+4 CORS
   * preflights) for that, now it's 1. Same 4 underlying queries, just fanned
   * out in parallel server-side instead of client-side.
   */
  async listAllForUser(userId) {
    const [forme, mine, done, cancelled] = await Promise.all([
      this.listForUser(userId, 'forme'),
      this.listForUser(userId, 'mine'),
      this.listForUser(userId, 'done'),
      this.listForUser(userId, 'cancelled'),
    ]);
    return { forme, mine, done, cancelled };
  }

  async listForUser(userId, tab) {
    if (tab === 'forme') {
      // Matches 'mine' below: a request stays visible to the giver through
      // acceptance and pickup scheduling, not just while still pending —
      // otherwise it vanishes from both tabs the moment it's accepted (it's
      // no longer REQUESTED, and the giver isn't the requester either).
      const rows = await this.prisma.bookRequest.findMany({
        where: { listing: { ownerId: userId }, status: { in: ['REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'] } },
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => this._toCard(r, userId));
    }
    if (tab === 'mine') {
      const rows = await this.prisma.bookRequest.findMany({
        where: { requesterId: userId, status: { in: ['REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'] } },
        include: REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((r) => this._toCard(r, userId));
    }
    if (tab === 'cancelled') {
      const rows = await this.prisma.bookRequest.findMany({
        where: {
          status: { in: ['DECLINED', 'CANCELLED', 'EXPIRED', 'DISPUTED'] },
          OR: [{ listing: { ownerId: userId } }, { requesterId: userId }],
        },
        include: REQUEST_INCLUDE,
        orderBy: { updatedAt: 'desc' },
      });
      return rows.map((r) => this._toCard(r, userId));
    }
    // 'done'
    const exchanges = await this.prisma.exchange.findMany({
      where: { status: 'COMPLETED', OR: [{ ownerId: userId }, { receiverId: userId }] },
      include: {
        listing: { include: { book: true } },
        owner: true,
        receiver: true,
        request: { include: REQUEST_INCLUDE },
        ratings: true,
      },
      orderBy: { completedAt: 'desc' },
    });
    return exchanges.map((e) => this._toCard(e.request, userId, e));
  }

  async getDetail(idOrRequestId, viewerId) {
    let request = await this.prisma.bookRequest.findUnique({ where: { id: idOrRequestId }, include: REQUEST_INCLUDE });
    if (!request) {
      const exchange = await this.prisma.exchange.findUnique({ where: { id: idOrRequestId } });
      if (exchange) {
        request = await this.prisma.bookRequest.findUnique({ where: { id: exchange.requestId }, include: REQUEST_INCLUDE });
      }
    }
    if (!request) throw new NotFoundException('Exchange not found');
    if (request.requesterId !== viewerId && request.listing.ownerId !== viewerId) {
      throw new ForbiddenException('Not part of this exchange');
    }
    return this._toDetail(request, viewerId);
  }

  _otherParty(request, viewerId) {
    const isOwner = request.listing.ownerId === viewerId;
    const other = isOwner ? request.requester : request.listing.owner;
    return { other, role: isOwner ? 'giver' : 'receiver' };
  }

  _stage(request) {
    const terminal = { DECLINED: 'declined', CANCELLED: 'cancelled', EXPIRED: 'expired', DISPUTED: 'disputed' };
    if (terminal[request.status]) return terminal[request.status];
    if (request.status === 'COMPLETED') return 'completed';
    if (request.status === 'PICKUP_SCHEDULED') {
      if (request.exchange?.handoverOtp?.isUsed) return 'handover-verified';
      if (request.pickup?.status === 'CONFIRMED') return 'pickup-confirmed';
      return 'pickup-confirmed';
    }
    if (request.status === 'ACCEPTED') {
      return request.pickup ? 'pickup-proposed' : 'accepted';
    }
    return 'requested';
  }

  _toCard(request, viewerId, exchangeOverride) {
    const { other, role } = this._otherParty(request, viewerId);
    const exchange = exchangeOverride || request.exchange;
    return {
      id: request.id,
      exchangeId: exchange?.id || null,
      status: this._tab(request, viewerId),
      stage: this._stage(request),
      role,
      otherUserId: other.id,
      initials: initialsOf(other.name),
      name: other.name,
      bookKey: request.listingId,
      bookTitle: request.listing.book.title,
      bookAuthor: request.listing.book.author,
      photos: request.listing.photos.map((p) => p.imageUrl),
      loc: null,
      when: request.createdAt,
      // Same shape as _toDetail's `pickup` — the list/poll endpoints feed the
      // same `exchanges` client state as the detail fetch (AppDataContext),
      // so a background poll must never regress a pickup-stage row back to
      // no pickup data.
      pickup: this._pickupOf(request),
      rating: exchange?.ratings?.find((r) => r.raterId === viewerId) ? averageOf(exchange.ratings.find((r) => r.raterId === viewerId)) : null,
      rated: !!exchange?.ratings?.some((r) => r.raterId === viewerId),
    };
  }

  _pickupOf(request) {
    if (!request.pickup) return null;
    return {
      date: request.pickup.pickupDate,
      slot: request.pickup.timeSlot,
      point: request.pickup.pickupPoint?.name || request.pickup.customLocation,
      instructions: request.pickup.instructions,
      status: request.pickup.status,
      proposedById: request.pickup.proposedById,
      rescheduleCount: request.pickup.rescheduleCount,
    };
  }

  _tab(request, viewerId) {
    if (request.status === 'COMPLETED') return 'done';
    if (['DECLINED', 'CANCELLED', 'EXPIRED', 'DISPUTED'].includes(request.status)) return 'cancelled';
    return request.listing.ownerId === viewerId ? 'forme' : 'mine';
  }

  _toDetail(request, viewerId) {
    const { other, role } = this._otherParty(request, viewerId);
    return {
      id: request.id,
      exchangeId: request.exchange?.id || null,
      requestStatus: request.status,
      stage: this._stage(request),
      role,
      otherUserId: other.id,
      initials: initialsOf(other.name),
      name: other.name,
      bookKey: request.listingId,
      bookTitle: request.listing.book.title,
      bookAuthor: request.listing.book.author,
      photos: request.listing.photos.map((p) => p.imageUrl),
      requestedAt: request.requestedAt,
      acceptedAt: request.acceptedAt,
      pickup: this._pickupOf(request),
      handoverVerified: !!request.exchange?.handoverOtp?.isUsed,
      rated: !!request.exchange?.ratings?.some((r) => r.raterId === viewerId),
    };
  }
}

function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function averageOf(rating) {
  return Math.round((rating.conditionAccuracy + rating.communication + rating.reliability) / 3);
}
