import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { softDeleteUser } from '../users/user-deletion.tx';

// Matches the copy shown on the "Request account deletion" sheet
// (profile/settings/page.js): if a society admin never approves or rejects
// the request, the account is deleted automatically after this many days —
// a pending request can't leave a member in permanent limbo just because no
// admin ever looked at the queue.
const ACCOUNT_DELETION_GRACE_DAYS = 30;

/**
 * Same soft-delete `admin.service.js#actionDeletionRequest` performs by
 * hand, just auto-fired once a deletion request has sat unreviewed past the
 * grace period. Requests an admin rejects clear `deletionRequestedAt`
 * (admin.service.js#rejectDeletionRequest) so they're never picked up here
 * — only genuinely unreviewed requests age out.
 */
@Dependencies(PrismaService)
@Injectable()
export class AccountDeletionExpiryService {
  constructor(prisma) {
    this.prisma = prisma;
    this.logger = new Logger(AccountDeletionExpiryService.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireUnreviewedDeletionRequests() {
    const cutoff = new Date(Date.now() - ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    const stale = await this.prisma.user.findMany({
      where: { deletionRequestedAt: { not: null, lt: cutoff }, deletedAt: null },
    });
    if (!stale.length) return;

    for (const user of stale) {
      try {
        await this.prisma.$transaction((tx) => softDeleteUser(tx, user));
      } catch (err) {
        this.logger.error(`Failed to auto-delete user ${user.id}: ${err.message}`);
      }
    }
    this.logger.log(`Auto-deleted ${stale.length} account(s) whose deletion request went unreviewed for ${ACCOUNT_DELETION_GRACE_DAYS} days`);
  }
}
