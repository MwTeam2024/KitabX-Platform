import { Dependencies, forwardRef, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/audit/audit-log.service';

/** §14/§19/Module 14 — reports, blocking and support requests. */
@Dependencies(PrismaService, forwardRef(() => NotificationsService), AuditLogService)
@Injectable()
export class ReportsService {
  constructor(prisma, notifications, auditLog) {
    this.prisma = prisma;
    this.notifications = notifications;
    this.auditLog = auditLog;
  }

  async create(reporterId, { reportedUserId, listingId, exchangeId, reason, description, attachmentUrls, block }) {
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        reportedUserId: reportedUserId || null,
        listingId: listingId || null,
        exchangeId: exchangeId || null,
        reason,
        description: description || null,
      },
    });

    if (attachmentUrls?.length) {
      await this.prisma.reportAttachment.createMany({
        data: attachmentUrls.map((fileUrl) => ({ reportId: report.id, fileUrl, fileType: 'image' })),
      });
    }
    if (block && reportedUserId) {
      await this.blockUser(reporterId, reportedUserId);
    }
    return report;
  }

  async blockUser(blockerId, blockedUserId) {
    return this.prisma.userBlock.upsert({
      where: { blockerId_blockedUserId: { blockerId, blockedUserId } },
      update: {},
      create: { blockerId, blockedUserId },
    });
  }

  async unblockUser(blockerId, blockedUserId) {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedUserId } });
    return { success: true };
  }

  async listBlocked(blockerId) {
    const rows = await this.prisma.userBlock.findMany({ where: { blockerId }, include: { blockedUser: true } });
    return rows.map((r) => ({ id: r.blockedUser.id, name: r.blockedUser.name }));
  }

  async isBlocked(userAId, userBId) {
    const row = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedUserId: userBId },
          { blockerId: userBId, blockedUserId: userAId },
        ],
      },
    });
    return !!row;
  }

  async createSupportRequest(userId, { type, subject, description }) {
    return this.prisma.supportRequest.create({
      data: { userId, type: type || 'SUPPORT', subject: subject || null, description },
    });
  }

  // ---- admin ----

  async adminList({ status } = {}) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      include: { reporter: true, reportedUser: true, listing: { include: { book: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminResolve(id, adminId, notes) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: 'RESOLVED', resolutionNotes: notes || null, resolvedById: adminId, resolvedAt: new Date() },
    });
    await this.notifications.create(this.prisma, {
      userId: report.reporterId,
      type: 'REPORT',
      title: 'Your report was reviewed',
      body: notes || 'Our trust & safety team has reviewed and resolved the report you filed.',
      entityType: 'report',
      entityId: id,
    });
    await this.auditLog.record({
      actorAdminId: adminId,
      action: 'REPORT_RESOLVED',
      entityType: 'report',
      entityId: id,
      newData: { notes: notes || null },
    }).catch(() => {});
    return updated;
  }

  // ---- admin: support/bug requests (Task 25 — the general Reports section's
  // actual source; user/listing reports live in Book Moderation instead) ----

  async adminListSupportRequests(status) {
    const rows = await this.prisma.supportRequest.findMany({
      where: status ? { status } : undefined,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      user: r.user?.name || 'Unknown',
      type: r.type,
      subject: r.subject,
      description: r.description,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async adminResolveSupportRequest(id, adminId) {
    const request = await this.prisma.supportRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Support request not found');
    const updated = await this.prisma.supportRequest.update({ where: { id }, data: { status: 'RESOLVED' } });
    await this.notifications.create(this.prisma, {
      userId: request.userId,
      type: 'REPORT',
      title: 'Your report was reviewed',
      body: 'Our team has looked into the issue you reported — thanks for helping us improve KitabX.',
      entityType: 'support_request',
      entityId: id,
    });
    await this.auditLog.record({
      actorAdminId: adminId,
      action: 'SUPPORT_REQUEST_RESOLVED',
      entityType: 'support_request',
      entityId: id,
    }).catch(() => {});
    return updated;
  }
}
