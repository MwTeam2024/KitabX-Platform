import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { releaseReservedCredit } from '../credits/credits.tx';

// DB doc §17-18: a REQUESTED request that never gets a response should
// eventually free up both the requester's reserved credit and the listing.
const REQUEST_EXPIRY_HOURS = 48;

/**
 * §12/Module 12 (PDF): pickup reminders + request auto-expiry both need a
 * scheduler, which this module is the first (and so far only) user of.
 * Expiry only applies to still-REQUESTED requests — once accepted, the
 * listing itself is reserved and the two members are expected to coordinate
 * directly rather than have the system silently unwind an agreed exchange.
 */
@Dependencies(PrismaService, NotificationsService, ChatService)
@Injectable()
export class RequestExpiryService {
  constructor(prisma, notifications, chat) {
    this.prisma = prisma;
    this.notifications = notifications;
    this.chat = chat;
    this.logger = new Logger(RequestExpiryService.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleRequests() {
    const cutoff = new Date(Date.now() - REQUEST_EXPIRY_HOURS * 60 * 60 * 1000);
    const stale = await this.prisma.bookRequest.findMany({
      where: { status: 'REQUESTED', requestedAt: { lt: cutoff } },
      include: { listing: { include: { book: true, owner: true } }, requester: true },
    });
    if (!stale.length) return;

    for (const request of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.bookRequest.update({ where: { id: request.id }, data: { status: 'EXPIRED', expiredAt: new Date() } });
          await releaseReservedCredit(tx, {
            userId: request.requesterId,
            referenceId: request.id,
            reason: 'EXPIRED',
            bookTitle: request.listing.book.title,
          });
          await this.notifications.create(tx, {
            userId: request.requesterId,
            type: 'REQUEST',
            title: 'Request expired',
            body: `Your request for "${request.listing.book.title}" expired after ${REQUEST_EXPIRY_HOURS / 24} days with no response — your credit was released.`,
            entityType: 'book_request',
            entityId: request.id,
          });
          await this.notifications.create(tx, {
            userId: request.listing.ownerId,
            type: 'REQUEST',
            title: 'A request expired',
            body: `${request.requester.name}'s request for "${request.listing.book.title}" expired without a response.`,
            entityType: 'book_request',
            entityId: request.id,
          });
        });
        await this.chat.disableForRequest(request.id).catch(() => {});
      } catch (err) {
        this.logger.error(`Failed to expire request ${request.id}: ${err.message}`);
      }
    }
    this.logger.log(`Expired ${stale.length} stale request(s)`);
  }
}
