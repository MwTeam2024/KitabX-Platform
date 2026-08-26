import { Dependencies, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * DB doc §32 — a permanent record of every sensitive admin action
 * (credit corrections, suspensions, listing removals, report resolutions).
 * Best-effort by design: a logging failure must never roll back the action
 * it's recording, so callers fire-and-catch this rather than awaiting it
 * inside their own transaction.
 */
@Dependencies(PrismaService)
@Injectable()
export class AuditLogService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async record({ actorAdminId, actorUserId, action, entityType, entityId, oldData, newData }) {
    await this.prisma.auditLog.create({
      data: { actorAdminId, actorUserId, action, entityType, entityId, oldData, newData },
    });
  }
}
