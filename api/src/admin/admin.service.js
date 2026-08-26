import { BadRequestException, Dependencies, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser } from '../common/serializers/user.serializer';
import { adminAdjustCredit } from '../credits/credits.tx';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { ReportsService } from '../reports/reports.service';

const DEFAULT_SETTINGS = {
  supportEmail: 'support@kitabx.app',
  supportPhone: '',
};

/** §21 — the MVP admin console's non-auth, non-society operations. */
@Dependencies(PrismaService, NotificationsService, AuditLogService, ReportsService)
@Injectable()
export class AdminService {
  constructor(prisma, notifications, auditLog, reportsService) {
    this.prisma = prisma;
    this.notifications = notifications;
    this.auditLog = auditLog;
    this.reportsService = reportsService;
  }

  async dashboard() {
    const [totalUsers, totalListings, completedExchanges, openReports] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.bookListing.count({ where: { status: { not: 'REMOVED' } } }),
      this.prisma.exchange.count({ where: { status: 'COMPLETED' } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
    ]);

    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const recent = await this.prisma.exchange.findMany({
      where: { status: 'COMPLETED', completedAt: { gte: since } },
      select: { completedAt: true },
    });
    const byDay = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const count = recent.filter((e) => sameDay(e.completedAt, d)).length;
      return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), count };
    });

    return { totalUsers, totalListings, completedExchanges, openReports, exchangesLast7Days: byDay };
  }

  /** New-item sidebar badges (Task 30, +Task 41 for deletion requests) — each
   * counting real rows created after the admin's own client-tracked "last
   * viewed" cutoff for that tab (no server-side "seen" state needed; a
   * missing `since` just means "nothing new yet" for that tab). */
  async notificationCounts({ usersSince, reportsSince, moderationSince, deletionRequestsSince } = {}) {
    const [newUsers, newSupportRequests, newListingReports, newUserReports, newDeletionRequests] = await Promise.all([
      usersSince
        ? this.prisma.user.count({ where: { createdAt: { gt: new Date(usersSince) }, deletedAt: null } })
        : 0,
      reportsSince
        ? this.prisma.supportRequest.count({ where: { createdAt: { gt: new Date(reportsSince) } } })
        : 0,
      moderationSince
        ? this.prisma.report.count({
            where: { status: 'OPEN', listingId: { not: null }, createdAt: { gt: new Date(moderationSince) } },
          })
        : 0,
      moderationSince
        ? this.prisma.report.count({
            where: { status: 'OPEN', reportedUserId: { not: null }, createdAt: { gt: new Date(moderationSince) } },
          })
        : 0,
      deletionRequestsSince
        ? this.prisma.user.count({
            where: { deletionRequestedAt: { gt: new Date(deletionRequestsSince) }, deletedAt: null },
          })
        : 0,
    ]);
    return {
      newUsers,
      newReports: newSupportRequests,
      newModeration: newListingReports + newUserReports,
      newDeletionRequests,
    };
  }

  // ---- users ----

  async listUsers({ q } = {}) {
    const users = await this.prisma.user.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      include: { society: true, block: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const ratings = await this.prisma.rating.groupBy({
      by: ['ratedUserId'],
      _avg: { conditionAccuracy: true, communication: true, reliability: true },
      where: { ratedUserId: { in: users.map((u) => u.id) } },
    });
    const ratingMap = new Map(
      ratings.map((r) => [
        r.ratedUserId,
        Number((((r._avg.conditionAccuracy || 0) + (r._avg.communication || 0) + (r._avg.reliability || 0)) / 3).toFixed(1)),
      ]),
    );

    return users.map((u) => ({
      ...toPublicUser(u),
      phone: u.phone,
      // Task 39 — blank/absent for a user who only ever signed up/in by
      // phone (Task 33/38's email-OTP path is the only way this gets set).
      email: u.email,
      status: !u.isActive ? 'suspended' : u.verificationStatus === 'PENDING' ? 'pending' : 'active',
      verified: u.verificationStatus === 'VERIFIED',
      rating: ratingMap.get(u.id) || null,
    }));
  }

  async setVerification(userId, verified) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { verificationStatus: verified ? 'VERIFIED' : 'PENDING' },
    });
    await this._notifyVerification(user, verified);
    return user;
  }

  async setSuspended(userId, suspended, adminId) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { isActive: !suspended } });
    // §42: this was the one admin-side profile mutation with no
    // notification at all — verification/approve/reject/deletion-rejection
    // all already had one. A push still reaches a suspended user even
    // though the in-app row isn't reachable until they're reactivated
    // (JwtAuthGuard rejects an inactive session), same as any other
    // notification here — best-effort, never blocks the mutation itself.
    await this.notifications.create(this.prisma, {
      userId,
      type: 'ADMIN',
      title: suspended ? 'Account suspended' : 'Account reactivated',
      body: suspended
        ? 'Your KitabX account has been suspended by an admin. Contact support if you think this is a mistake.'
        : 'Your KitabX account has been reactivated — welcome back!',
      entityType: 'profile',
    }).catch(() => {});
    await this.auditLog.record({
      actorAdminId: adminId,
      action: suspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      entityType: 'user',
      entityId: userId,
    }).catch(() => {});
    return user;
  }

  async approveUser(userId) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { verificationStatus: 'VERIFIED', isActive: true } });
    await this._notifyVerification(user, true);
    return user;
  }

  async rejectUser(userId) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { verificationStatus: 'REJECTED', isActive: false } });
    await this._notifyVerification(user, false);
    return user;
  }

  // ---- account deletion requests (§14/§19 — Task 26; a member's own
  // "Request account deletion" only ever set `deletionRequestedAt` with no
  // admin-facing read/action anywhere, same gap pattern as Tasks 24/25) ----

  async listDeletionRequests() {
    const users = await this.prisma.user.findMany({
      where: { deletionRequestedAt: { not: null }, deletedAt: null },
      orderBy: { deletionRequestedAt: 'desc' },
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      memberId: u.memberId,
      requestedAt: u.deletionRequestedAt,
    }));
  }

  /** Actions the request for real — soft-deletes (matches the `deletedAt`
   * column every admin count/listing query already filters on) and
   * immediately locks the account out (`JwtAuthGuard` already rejects any
   * session where `deletedAt` is set), so no separate "disable session" step
   * is needed. No notification — a deleted account can't sign back in to see one. */
  async actionDeletionRequest(userId, adminId) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.auditLog.record({
      actorAdminId: adminId,
      action: 'USER_DELETED',
      entityType: 'user',
      entityId: userId,
    }).catch(() => {});
    return user;
  }

  async rejectDeletionRequest(userId, adminId) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: null },
    });
    await this.notifications.create(this.prisma, {
      userId,
      type: 'ADMIN',
      title: 'Account deletion request declined',
      body: 'Your request to delete your KitabX account was reviewed and declined by an admin — your account stays active. Contact support if you still want this done.',
      entityType: 'user',
      entityId: userId,
    });
    await this.auditLog.record({
      actorAdminId: adminId,
      action: 'USER_DELETION_REJECTED',
      entityType: 'user',
      entityId: userId,
    }).catch(() => {});
    return user;
  }

  async _notifyVerification(user, verified) {
    await this.notifications.create(this.prisma, {
      userId: user.id,
      type: 'VERIFICATION',
      title: verified ? "You're verified!" : 'Verification update',
      body: verified
        ? 'Your society admin has verified your account. You can now list and request books.'
        : 'Your account verification was not approved. Contact support if you think this is a mistake.',
      entityType: 'profile',
    });
  }

  // ---- moderation: reports against a listing or a user (§14/§19 — consolidated
  // here instead of the general Reports section, which is bug/support-request
  // only; both report types resolve through the same ReportsService#adminResolve
  // so the reporter always gets the same "your report was reviewed" notification) ----

  async listFlaggedListings() {
    const reports = await this.prisma.report.findMany({
      where: { status: 'OPEN', listingId: { not: null } },
      include: { listing: { include: { book: true, owner: true } }, reporter: true },
      orderBy: { createdAt: 'desc' },
    });
    return reports.map((r) => ({
      reportId: r.id,
      listingId: r.listingId,
      title: r.listing?.book?.title || 'Untitled',
      owner: r.listing?.owner?.name || 'Unknown',
      reporter: r.reporter?.name || 'Unknown',
      reason: r.reason,
      message: r.description,
      createdAt: r.createdAt,
    }));
  }

  async listFlaggedUsers() {
    const reports = await this.prisma.report.findMany({
      where: { status: 'OPEN', reportedUserId: { not: null } },
      include: { reportedUser: true, reporter: true },
      orderBy: { createdAt: 'desc' },
    });
    return reports.map((r) => ({
      reportId: r.id,
      reportedUserId: r.reportedUserId,
      reportedUser: r.reportedUser?.name || 'Unknown',
      reporter: r.reporter?.name || 'Unknown',
      reason: r.reason,
      message: r.description,
      createdAt: r.createdAt,
    }));
  }

  // ---- societies (soft-delete only — real members/listings still reference
  // this row via a required FK, so a hard delete isn't safe; deactivating
  // matches how `listSocieties()` already filters to `isActive: true`) ----

  async removeSociety(societyId, adminId) {
    const society = await this.prisma.society.findUnique({ where: { id: societyId } });
    if (!society) throw new NotFoundException('Society not found');
    const updated = await this.prisma.society.update({ where: { id: societyId }, data: { isActive: false } });
    await this.auditLog.record({
      actorAdminId: adminId,
      action: 'SOCIETY_REMOVED',
      entityType: 'society',
      entityId: societyId,
      oldData: { isActive: society.isActive },
    }).catch(() => {});
    return updated;
  }

  async removeListing(listingId, adminId) {
    const listing = await this.prisma.bookListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    const updated = await this.prisma.bookListing.update({ where: { id: listingId }, data: { status: 'REMOVED', removedAt: new Date() } });
    await this.auditLog.record({
      actorAdminId: adminId,
      action: 'LISTING_REMOVED',
      entityType: 'listing',
      entityId: listingId,
      oldData: { status: listing.status },
    }).catch(() => {});

    // Taking the listing down is the moderation action itself — close out
    // every OPEN report against it too, or it would keep reappearing in the
    // flagged-listings queue for a listing that's already gone.
    const openReports = await this.prisma.report.findMany({
      where: { listingId, status: 'OPEN' },
      select: { id: true },
    });
    for (const { id } of openReports) {
      // eslint-disable-next-line no-await-in-loop
      await this.reportsService.adminResolve(id, adminId, 'The reported listing was removed by an admin.').catch(() => {});
    }

    return updated;
  }

  // ---- listings & exchanges (read-only ledger view) ----

  /**
   * §40: "Active" was previously an accepted-but-no-pickup-yet `Exchange`
   * row — meaning a freshly listed book with zero requests against it could
   * never appear here at all, which is what was reported as "adding a new
   * book, data doesn't show." Redefined so "Active" means what it sounds
   * like — any currently listed, still-available book (`BookListing.status
   * === 'ACTIVE'`) — blended with the exchange-lifecycle rows for the other
   * 3 tabs. These are two different Prisma models with no shared row shape,
   * so listing-only rows fill in placeholders for the exchange-only columns
   * (no receiver yet, no pickup/exchange status yet).
   */
  async listExchanges() {
    const [listings, exchanges] = await Promise.all([
      this.prisma.bookListing.findMany({
        where: { status: 'ACTIVE' },
        include: { book: true, owner: true },
        orderBy: { publishedAt: 'desc' },
        take: 200,
      }),
      this.prisma.exchange.findMany({
        include: {
          listing: { include: { book: true } },
          owner: true,
          receiver: true,
          request: { include: { pickup: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    const activeRows = listings.map((l) => ({
      id: l.id,
      book: l.book.title,
      author: l.book.author,
      genre: l.book.genre,
      condition: l.condition,
      listedBy: l.owner.name,
      from: l.owner.name,
      to: '—',
      status: 'Available',
      stage: 'ACTIVE',
      when: l.publishedAt || l.createdAt,
    }));

    const exchangeRows = exchanges.map((e) => ({
      id: e.id,
      book: e.listing.book.title,
      author: e.listing.book.author,
      genre: e.listing.book.genre,
      condition: e.listing.condition,
      listedBy: e.owner.name,
      from: e.owner.name,
      to: e.receiver.name,
      status: e.status,
      // An accepted exchange with no pickup yet, or a cancellation that
      // happened before any pickup was ever scheduled, intentionally has no
      // named tab of its own (same precedent DISPUTED already had) — only
      // IN_PROCESS/CANCELLED specifically require a pickup to already be on
      // record, per this task's own definitions.
      //
      // Bug fixed here: the raw Exchange status enum is literally 'ACTIVE'/
      // 'CANCELLED' — falling through to `e.status` for the "no pickup yet"
      // case collided with the *listing*-based Active/Cancelled tab keys
      // below, wrongly surfacing an already-accepted (no longer available)
      // book under "Active", and a still-pending cancellation under
      // "Cancelled". Both unbucketed cases now get a distinct sentinel that
      // can never match a real tab key.
      stage: e.status === 'COMPLETED'
        ? 'COMPLETED'
        : e.status === 'ACTIVE'
          ? (e.request?.pickup ? 'IN_PROCESS' : 'UNBUCKETED_ACCEPTED')
          : e.status === 'CANCELLED'
            ? (e.request?.pickup ? 'CANCELLED' : 'UNBUCKETED_CANCELLED')
            : e.status,
      when: e.completedAt || e.createdAt,
    }));

    return [...activeRows, ...exchangeRows].sort((a, b) => new Date(b.when) - new Date(a.when));
  }

  // ---- credits ----

  async creditsLedger() {
    const rows = await this.prisma.creditTransaction.findMany({
      where: { type: 'ADMIN_ADJUSTMENT' },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => ({
      user: r.user.name,
      change: r.amount > 0 ? `+${r.amount}` : `${r.amount}`,
      positive: r.amount > 0,
      reason: r.description,
      when: r.createdAt,
    }));
  }

  async correctCredit(userId, amount, reason, adminId) {
    if (!Number.isInteger(amount) || amount === 0) throw new BadRequestException('amount must be a non-zero integer');
    if (!reason?.trim()) throw new BadRequestException('A reason is required for manual credit corrections');
    const result = await this.prisma.$transaction((tx) => adminAdjustCredit(tx, { userId, amount, reason: reason.trim() }));
    await this.auditLog.record({
      actorAdminId: adminId,
      action: 'CREDIT_ADJUSTED',
      entityType: 'credit_account',
      entityId: result.account.id,
      newData: { userId, amount, reason: reason.trim() },
    }).catch(() => {});
    return result;
  }

  // ---- reports (general queue — user/listing reports moved to Book
  // Moderation per Task 24; this section is bug/support requests only per
  // Task 25, backed by the SupportRequest table `reportBug()` actually
  // writes to (nothing previously read it back) ----

  reports(status) {
    return this.reportsService.adminListSupportRequests(status);
  }

  resolveSupportRequest(id, adminId) {
    return this.reportsService.adminResolveSupportRequest(id, adminId);
  }

  // ---- settings ----

  async getSettings() {
    const rows = await this.prisma.appSetting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULT_SETTINGS, ...map };
  }

  async updateSettings(adminId, updates) {
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        this.prisma.appSetting.upsert({
          where: { key },
          update: { value: String(value), updatedById: adminId },
          create: { key, value: String(value), updatedById: adminId },
        }),
      ),
    );
    return this.getSettings();
  }
}

function sameDay(a, b) {
  return a && a.toDateString() === b.toDateString();
}
