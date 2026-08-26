import { BadRequestException, Dependencies, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toListingLocation, toPublicUser } from '../common/serializers/user.serializer';

const PROFILE_INCLUDE = { society: true, block: true };
const CHAT_RETENTION_OPTIONS = [null, 1, 3, 6];

/** Public trust profile (§13/Module 2) — average rating, completed exchanges,
 * member-since, verified badge, completion rate. */
@Dependencies(PrismaService)
@Injectable()
export class UsersService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async getPublicProfile(userId) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: PROFILE_INCLUDE });
    if (!user) throw new NotFoundException('User not found');

    const [ratingAgg, completedCount, totalExchangeCount, listedCount] = await Promise.all([
      this.prisma.rating.aggregate({
        where: { ratedUserId: userId },
        _avg: { conditionAccuracy: true, communication: true, reliability: true },
        _count: true,
      }),
      this.prisma.exchange.count({
        where: { status: 'COMPLETED', OR: [{ ownerId: userId }, { receiverId: userId }] },
      }),
      this.prisma.exchange.count({ where: { OR: [{ ownerId: userId }, { receiverId: userId }] } }),
      this.prisma.bookListing.count({ where: { ownerId: userId, status: { not: 'REMOVED' } } }),
    ]);

    const avg = ratingAgg._avg;
    const avgRating = [avg.conditionAccuracy, avg.communication, avg.reliability].filter((v) => v != null);
    const averageRating = avgRating.length
      ? Number((avgRating.reduce((a, b) => a + b, 0) / avgRating.length).toFixed(1))
      : null;

    return {
      ...toPublicUser(user),
      averageRating,
      ratingCount: ratingAgg._count,
      completedExchanges: completedCount,
      completionRate: totalExchangeCount ? Math.round((completedCount / totalExchangeCount) * 100) : 0,
      booksListed: listedCount,
      location: toListingLocation(user),
    };
  }

  async getUserWithListings(userId, { excludeMine } = {}) {
    return this.prisma.bookListing.findMany({
      where: { ownerId: userId, status: 'ACTIVE', ...(excludeMine ? {} : {}) },
      include: { book: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setNotificationPreferences(userId, updates) {
    if ('chatRetentionMonths' in updates && !CHAT_RETENTION_OPTIONS.includes(updates.chatRetentionMonths)) {
      throw new BadRequestException('chatRetentionMonths must be null, 1, 3 or 6');
    }
    return this.prisma.userNotificationPreference.upsert({
      where: { userId },
      update: updates,
      create: { userId, ...updates },
    });
  }

  getNotificationPreferences(userId) {
    return this.prisma.userNotificationPreference.findUnique({ where: { userId } });
  }

  async registerDevice(userId, { fcmToken, platform, browser }) {
    return this.prisma.userDevice.upsert({
      where: { userId_fcmToken: { userId, fcmToken } },
      update: { isActive: true, lastSeenAt: new Date(), browser },
      create: { userId, fcmToken, platform, browser },
    });
  }
}
