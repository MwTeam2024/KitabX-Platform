import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser } from '../common/serializers/user.serializer';

/** §13/§20: one rating per completed exchange per rater, only after a verified handover. */
@Dependencies(PrismaService)
@Injectable()
export class RatingsService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async submit(exchangeId, raterId, { conditionAccuracy, communication, reliability, review }) {
    for (const [label, value] of [['conditionAccuracy', conditionAccuracy], ['communication', communication], ['reliability', reliability]]) {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new BadRequestException(`${label} must be an integer from 1 to 5`);
      }
    }

    const exchange = await this.prisma.exchange.findUnique({ where: { id: exchangeId } });
    if (!exchange) throw new NotFoundException('Exchange not found');
    if (exchange.status !== 'COMPLETED') throw new BadRequestException('You can only rate a completed exchange');

    const isOwner = exchange.ownerId === raterId;
    const isReceiver = exchange.receiverId === raterId;
    if (!isOwner && !isReceiver) throw new ForbiddenException('You were not part of this exchange');

    const ratedUserId = isOwner ? exchange.receiverId : exchange.ownerId;

    const existing = await this.prisma.rating.findUnique({
      where: { exchangeId_raterId: { exchangeId, raterId } },
    });
    if (existing) throw new ConflictException('You already rated this exchange');

    return this.prisma.rating.create({
      data: { exchangeId, raterId, ratedUserId, conditionAccuracy, communication, reliability, review: review || null },
    });
  }

  async forUser(userId, { limit = 20 } = {}) {
    const rows = await this.prisma.rating.findMany({
      where: { ratedUserId: userId },
      include: { rater: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      rater: toPublicUser(r.rater),
      conditionAccuracy: r.conditionAccuracy,
      communication: r.communication,
      reliability: r.reliability,
      review: r.review,
      createdAt: r.createdAt,
    }));
  }
}
