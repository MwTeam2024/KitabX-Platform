import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { reserveCredit, releaseReservedCredit } from '../credits/credits.tx';
import { toPublicUser } from '../common/serializers/user.serializer';
// Chat is switched off for now — see chat.module.js.
// import { ChatService } from '../chat/chat.service';
import { ReportsService } from '../reports/reports.service';

const ACTIVE_REQUEST_STATUSES = ['REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'];

/**
 * §11 (Module 7). Two things get "reserved" at different moments and this is
 * deliberate, not an oversight — the source plan states both, at different
 * points:
 *   - the REQUESTER's credit is reserved the moment they request (§10: "one
 *     credit is reserved when requesting another book")
 *   - the LISTING itself is reserved only once the owner accepts (§11:
 *     "acceptance reserves the listing")
 * So a listing stays visible/requestable-by-others right up until someone
 * accepts one of the pending requests on it; duplicate-request prevention
 * (below) is what stops the same member spamming the same listing meanwhile.
 */
@Dependencies(PrismaService, NotificationsService, /* ChatService, */ ReportsService)
@Injectable()
export class RequestsService {
  constructor(prisma, notifications, /* chat, */ reports) {
    this.prisma = prisma;
    this.notifications = notifications;
    // this.chat = chat;
    this.reports = reports;
  }

  async createRequest(requesterId, listingId) {
    return this.prisma.$transaction(async (tx) => {
      const listing = await tx.bookListing.findUnique({ where: { id: listingId }, include: { book: true, owner: true } });
      if (!listing || listing.status === 'REMOVED') throw new NotFoundException('Listing not found');
      if (listing.ownerId === requesterId) throw new BadRequestException('You cannot request your own book');
      if (listing.status !== 'ACTIVE') throw new BadRequestException('This book is no longer available');
      if (await this.reports.isBlocked(requesterId, listing.ownerId)) {
        throw new ForbiddenException('You cannot request a book from this member');
      }

      const duplicate = await tx.bookRequest.findFirst({
        where: { listingId, requesterId, status: { in: ACTIVE_REQUEST_STATUSES } },
      });
      if (duplicate) throw new ConflictException('You already have an active request for this book');

      const account = await tx.creditAccount.findUnique({ where: { userId: requesterId } });
      if (!account || account.availableBalance < 1) {
        throw new BadRequestException('You need at least 1 available credit to request a book');
      }

      const request = await tx.bookRequest.create({
        data: { listingId, requesterId, status: 'REQUESTED' },
      });

      await reserveCredit(tx, {
        userId: requesterId,
        referenceId: request.id,
        bookTitle: listing.book.title,
        ownerName: listing.owner.name,
      });

      // Chat is switched off for now (see chat.module.js) — this used to
      // create a request-linked Conversation here so the "Message" action
      // was available for the whole lifetime of the request.
      // const conversation = await tx.conversation.create({ data: { requestId: request.id } });
      // await tx.conversationParticipant.createMany({
      //   data: [
      //     { conversationId: conversation.id, userId: requesterId },
      //     { conversationId: conversation.id, userId: listing.ownerId },
      //   ],
      // });

      await this.notifications.create(tx, {
        userId: listing.ownerId,
        type: 'REQUEST',
        title: `New request for "${listing.book.title}"`,
        body: `Someone wants your book "${listing.book.title}".`,
        entityType: 'book_request',
        entityId: request.id,
      });

      return request;
    });
  }

  async accept(requestId, ownerId) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.bookRequest.findUnique({
        where: { id: requestId },
        include: { listing: { include: { book: true } }, requester: true },
      });
      if (!request) throw new NotFoundException('Request not found');
      if (request.listing.ownerId !== ownerId) throw new ForbiddenException('Not your listing');
      if (request.status !== 'REQUESTED') throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);

      // Conditional update instead of a plain write — guards against two
      // concurrent accepts on the same listing (e.g. two browser tabs) both
      // reserving it and creating two Exchange rows for one physical book.
      const reserved = await tx.bookListing.updateMany({
        where: { id: request.listingId, status: 'ACTIVE' },
        data: { status: 'RESERVED' },
      });
      if (reserved.count === 0) {
        throw new ConflictException('This listing was just reserved by another request');
      }
      const updatedRequest = await tx.bookRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
        include: { listing: { include: { book: true } }, requester: true },
      });

      const exchange = await tx.exchange.create({
        data: {
          requestId,
          ownerId,
          receiverId: request.requesterId,
          listingId: request.listingId,
          status: 'ACTIVE',
        },
      });

      // §11: "close other pending requests" for the same listing.
      const competing = await tx.bookRequest.findMany({
        where: { listingId: request.listingId, status: 'REQUESTED', id: { not: requestId } },
      });
      for (const other of competing) {
        await tx.bookRequest.update({ where: { id: other.id }, data: { status: 'DECLINED', declinedAt: new Date() } });
        await releaseReservedCredit(tx, {
          userId: other.requesterId,
          referenceId: other.id,
          reason: 'DECLINED',
          bookTitle: request.listing.book.title,
        });
        await this.notifications.create(tx, {
          userId: other.requesterId,
          type: 'REQUEST',
          title: 'Request declined',
          body: `"${request.listing.book.title}" was given to another member.`,
          entityType: 'book_request',
          entityId: other.id,
        });
      }

      await this.notifications.create(tx, {
        userId: request.requesterId,
        type: 'REQUEST',
        title: 'Request accepted!',
        body: `Your request for "${request.listing.book.title}" was accepted — schedule a pickup.`,
        entityType: 'exchange',
        entityId: request.id,
      });

      return { request: updatedRequest, exchange };
    });
  }

  async decline(requestId, ownerId) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.bookRequest.findUnique({ where: { id: requestId }, include: { listing: { include: { book: true } } } });
      if (!request) throw new NotFoundException('Request not found');
      if (request.listing.ownerId !== ownerId) throw new ForbiddenException('Not your listing');
      if (request.status !== 'REQUESTED') throw new BadRequestException(`Request is already ${request.status.toLowerCase()}`);

      await tx.bookRequest.update({ where: { id: requestId }, data: { status: 'DECLINED', declinedAt: new Date() } });
      await releaseReservedCredit(tx, {
        userId: request.requesterId,
        referenceId: request.id,
        reason: 'DECLINED',
        bookTitle: request.listing.book.title,
      });
      await this.notifications.create(tx, {
        userId: request.requesterId,
        type: 'REQUEST',
        title: 'Request declined',
        body: `Your request for "${request.listing.book.title}" was declined.`,
        entityType: 'book_request',
        entityId: request.id,
      });
      return { success: true };
    });
    // Chat is switched off for now — see chat.module.js.
    // await this.chat.disableForRequest(requestId).catch(() => {});
    return result;
  }

  /** Either party can cancel before completion (PDF Module 8, step 9). */
  async cancel(requestId, callerId, reason) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.bookRequest.findUnique({
        where: { id: requestId },
        include: { listing: { include: { book: true } }, exchange: true },
      });
      if (!request) throw new NotFoundException('Request not found');
      const isRequester = request.requesterId === callerId;
      const isOwner = request.listing.ownerId === callerId;
      if (!isRequester && !isOwner) throw new ForbiddenException('Not part of this exchange');
      if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) {
        throw new BadRequestException(`Cannot cancel a request that is already ${request.status.toLowerCase()}`);
      }
      await tx.bookRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason || null },
      });
      if (request.status !== 'REQUESTED') {
        await tx.bookListing.update({ where: { id: request.listingId }, data: { status: 'ACTIVE' } });
      }
      if (request.exchange) {
        await tx.exchange.update({ where: { id: request.exchange.id }, data: { status: 'CANCELLED' } });
      }
      await releaseReservedCredit(tx, {
        userId: request.requesterId,
        referenceId: request.id,
        reason: 'CANCELLED',
        bookTitle: request.listing.book.title,
      });

      const otherPartyId = isRequester ? request.listing.ownerId : request.requesterId;
      await this.notifications.create(tx, {
        userId: otherPartyId,
        type: 'REQUEST',
        title: 'Exchange cancelled',
        body: `The exchange for "${request.listing.book.title}" was cancelled${reason ? ` — ${reason}` : ''}.`,
        entityType: 'book_request',
        entityId: request.id,
      });
      return { success: true };
    });
    // Chat is switched off for now — see chat.module.js.
    // await this.chat.disableForRequest(requestId).catch(() => {});
    return result;
  }

  async getRequest(id, viewerId) {
    const request = await this.prisma.bookRequest.findUnique({
      where: { id },
      include: {
        listing: { include: { book: true, owner: { include: { society: true, block: true } } } },
        requester: { include: { society: true, block: true } },
        exchange: true,
        pickup: true,
      },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.requesterId !== viewerId && request.listing.ownerId !== viewerId) {
      throw new ForbiddenException('Not part of this request');
    }
    return {
      ...request,
      requester: toPublicUser(request.requester),
      listing: { ...request.listing, owner: toPublicUser(request.listing.owner) },
    };
  }

  listIncoming(ownerId) {
    return this.prisma.bookRequest.findMany({
      where: { listing: { ownerId }, status: 'REQUESTED' },
      include: { listing: { include: { book: true } }, requester: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listMine(requesterId) {
    return this.prisma.bookRequest.findMany({
      where: { requesterId, status: { in: ACTIVE_REQUEST_STATUSES } },
      include: { listing: { include: { book: true, owner: true } }, exchange: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
