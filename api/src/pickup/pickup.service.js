import {
  BadRequestException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toPublicUser } from '../common/serializers/user.serializer';

const MAX_RESCHEDULES = 1; // §12 / PDF Module 8: "one reschedule option" for MVP.

/**
 * §12: fixed time slots + predefined society pickup points, and both parties
 * must confirm before it counts as scheduled. Whoever didn't propose is the
 * one who has to confirm — a proposer can't "confirm" their own proposal.
 */
@Dependencies(PrismaService, NotificationsService)
@Injectable()
export class PickupService {
  constructor(prisma, notifications) {
    this.prisma = prisma;
    this.notifications = notifications;
  }

  async propose(requestId, proposerId, { pickupDate, timeSlot, pickupPointId, customLocation, instructions }) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this._loadForParty(tx, requestId, proposerId);
      const otherPartyId = request.listing.ownerId === proposerId ? request.requesterId : request.listing.ownerId;

      const existing = await tx.pickupSchedule.findUnique({ where: { requestId } });

      if (!existing) {
        const created = await tx.pickupSchedule.create({
          data: { requestId, proposedById: proposerId, pickupDate, timeSlot, pickupPointId, customLocation, instructions },
        });
        await this._notifyProposal(tx, otherPartyId, request, created);
        return created;
      }

      if (existing.status === 'CONFIRMED') {
        if (existing.rescheduleCount >= MAX_RESCHEDULES) {
          throw new BadRequestException('This pickup has already been rescheduled once — the MVP allows one reschedule');
        }
        const updated = await tx.pickupSchedule.update({
          where: { requestId },
          data: {
            proposedById: proposerId,
            pickupDate,
            timeSlot,
            pickupPointId,
            customLocation,
            instructions,
            status: 'PROPOSED',
            confirmedByOwnerAt: null,
            confirmedByRequesterAt: null,
            rescheduleCount: { increment: 1 },
          },
        });
        await this._notifyProposal(tx, otherPartyId, request, updated, true);
        return updated;
      }

      // Still PROPOSED — the same or other party is adjusting before anyone confirmed.
      const updated = await tx.pickupSchedule.update({
        where: { requestId },
        data: { proposedById: proposerId, pickupDate, timeSlot, pickupPointId, customLocation, instructions },
      });
      await this._notifyProposal(tx, otherPartyId, request, updated);
      return updated;
    });
  }

  async confirm(requestId, confirmerId) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this._loadForParty(tx, requestId, confirmerId);
      const pickup = await tx.pickupSchedule.findUnique({ where: { requestId } });
      if (!pickup) throw new NotFoundException('No pickup has been proposed yet');
      if (pickup.proposedById === confirmerId) {
        throw new BadRequestException('Waiting for the other member to confirm — you proposed this time');
      }
      if (pickup.status === 'CONFIRMED') return pickup;

      const isOwner = request.listing.ownerId === confirmerId;
      const updated = await tx.pickupSchedule.update({
        where: { requestId },
        data: {
          status: 'CONFIRMED',
          confirmedByOwnerAt: isOwner ? new Date() : pickup.confirmedByOwnerAt,
          confirmedByRequesterAt: !isOwner ? new Date() : pickup.confirmedByRequesterAt,
        },
      });
      await tx.bookRequest.update({ where: { id: requestId }, data: { status: 'PICKUP_SCHEDULED' } });

      await this.notifications.create(tx, {
        userId: pickup.proposedById,
        type: 'PICKUP',
        title: 'Pickup confirmed',
        body: `Your proposed pickup for "${request.listing.book.title}" was confirmed.`,
        entityType: 'exchange',
        entityId: request.exchange?.id,
      });

      return updated;
    });
  }

  async get(requestId, viewerId) {
    const request = await this.prisma.bookRequest.findUnique({
      where: { id: requestId },
      include: { listing: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.requesterId !== viewerId && request.listing.ownerId !== viewerId) {
      throw new ForbiddenException('Not part of this exchange');
    }
    const pickup = await this.prisma.pickupSchedule.findUnique({
      where: { requestId },
      include: { pickupPoint: true, proposedBy: { include: { society: true, block: true } } },
    });
    if (!pickup) throw new NotFoundException('No pickup scheduled yet');
    return { ...pickup, proposedBy: toPublicUser(pickup.proposedBy) };
  }

  async _loadForParty(tx, requestId, userId) {
    const request = await tx.bookRequest.findUnique({
      where: { id: requestId },
      include: { listing: { include: { book: true } }, exchange: true },
    });
    if (!request) throw new NotFoundException('Request not found');
    const isParty = request.requesterId === userId || request.listing.ownerId === userId;
    if (!isParty) throw new ForbiddenException('Not part of this exchange');
    if (!['ACCEPTED', 'PICKUP_SCHEDULED'].includes(request.status)) {
      throw new BadRequestException('Pickup can only be scheduled after the request is accepted');
    }
    return request;
  }

  async _notifyProposal(tx, otherPartyId, request, pickup, isReschedule) {
    await this.notifications.create(tx, {
      userId: otherPartyId,
      type: 'PICKUP',
      title: isReschedule ? 'New pickup time proposed' : 'Pickup time proposed',
      body: `${pickup.pickupDate} · ${pickup.timeSlot} for "${request.listing.book.title}" — confirm or wait for it to change.`,
      entityType: 'exchange',
      entityId: request.exchange?.id,
    });
  }
}
