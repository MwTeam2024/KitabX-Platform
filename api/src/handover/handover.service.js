import {
  BadRequestException,
  Dependencies,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { deductReservedCredit, movePendingToAvailable } from '../credits/credits.tx';

const OTP_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * §13: exchange handover OTP — separate from login OTP (auth/otp.service.js).
 * Short expiry, one-time use, hashed storage, attempt limit, and the whole
 * completion (exchange, listing, both credit legs, both notifications) is one
 * transaction (§23) so nothing can end up half-updated.
 */
@Dependencies(PrismaService, NotificationsService, ChatService)
@Injectable()
export class HandoverService {
  constructor(prisma, notifications, chat) {
    this.prisma = prisma;
    this.notifications = notifications;
    this.chat = chat;
  }

  /** Only the receiver can view/generate the code they'll read out at pickup. */
  async issueOrGetCode(exchangeId, callerId) {
    const exchange = await this._loadActive(exchangeId);
    if (exchange.receiverId !== callerId) {
      throw new ForbiddenException('Only the receiver can view the handover code');
    }

    // Only the hash is ever stored, so a previous code can't be re-displayed —
    // any existing row is replaced with a fresh one on each request.
    await this.prisma.handoverOtp.deleteMany({ where: { exchangeId } });

    const code = String(crypto.randomInt(100000, 999999));
    await this.prisma.handoverOtp.create({
      data: {
        exchangeId,
        otpHash: hashCode(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      },
    });

    return { code, expiresInMinutes: OTP_TTL_MINUTES };
  }

  /** Only the owner (giver) enters the code the receiver reads to them. */
  async verify(exchangeId, callerId, code) {
    const exchange = await this._loadActive(exchangeId);
    if (exchange.ownerId !== callerId) {
      throw new ForbiddenException('Only the book owner enters the handover code');
    }

    const otp = await this.prisma.handoverOtp.findUnique({ where: { exchangeId } });
    if (!otp || otp.isUsed) throw new BadRequestException('No active code for this exchange — ask the receiver to share it again');
    if (otp.expiresAt < new Date()) throw new BadRequestException('That code expired — ask the receiver to generate a new one');
    if (otp.attemptCount >= MAX_ATTEMPTS) {
      throw new HttpException('Too many incorrect attempts — ask the receiver to generate a new code', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.prisma.handoverOtp.update({ where: { exchangeId }, data: { attemptCount: { increment: 1 } } });

    if (otp.otpHash !== hashCode(String(code))) {
      throw new BadRequestException('Incorrect code');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.handoverOtp.update({ where: { exchangeId }, data: { isUsed: true, verifiedAt: new Date() } });
      await tx.exchange.update({ where: { id: exchangeId }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await tx.bookRequest.update({ where: { id: exchange.requestId }, data: { status: 'COMPLETED' } });
      await tx.bookListing.update({ where: { id: exchange.listingId }, data: { status: 'COMPLETED' } });

      await movePendingToAvailable(tx, {
        userId: exchange.ownerId,
        referenceId: exchangeId,
        bookTitle: exchange.listing.book.title,
        otherPartyName: exchange.receiver.name,
      });
      await deductReservedCredit(tx, {
        userId: exchange.receiverId,
        referenceId: exchangeId,
        bookTitle: exchange.listing.book.title,
        ownerName: exchange.owner.name,
      });

      await this.notifications.create(tx, {
        userId: exchange.ownerId,
        type: 'EXCHANGE',
        title: 'Handover verified!',
        body: `1 credit is now available — "${exchange.listing.book.title}" is on its way to ${exchange.receiver.name}. You can rate the exchange now.`,
        entityType: 'exchange',
        entityId: exchangeId,
      });
      await this.notifications.create(tx, {
        userId: exchange.receiverId,
        type: 'EXCHANGE',
        title: 'Handover verified!',
        body: `You've received "${exchange.listing.book.title}" from ${exchange.owner.name}. You can rate the exchange now.`,
        entityType: 'exchange',
        entityId: exchangeId,
      });

      return { success: true };
    });

    // Not part of the transaction — this is a UX nicety (closing the
    // conversation once there's nothing left to arrange), not something that
    // needs to be atomic with the credit/status changes above.
    await this.chat.disableForRequest(exchange.requestId).catch(() => {});
    return result;
  }

  async _loadActive(exchangeId) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id: exchangeId },
      include: { listing: { include: { book: true } }, owner: true, receiver: true },
    });
    if (!exchange) throw new NotFoundException('Exchange not found');
    if (exchange.status !== 'ACTIVE') throw new BadRequestException(`Exchange is already ${exchange.status.toLowerCase()}`);
    return exchange;
  }
}
