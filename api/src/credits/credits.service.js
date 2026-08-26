import { Dependencies, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Read-only balance/history endpoints. Every balance change itself happens
 * inside the owning flow's transaction via credits.tx.js — this service
 * never mutates balances outside of admin corrections, per §10: "do not rely
 * on frontend calculations... PostgreSQL transactions are the source of truth."
 */
@Dependencies(PrismaService)
@Injectable()
export class CreditsService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async getBalance(userId) {
    const account = await this.prisma.creditAccount.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return {
      available: account.availableBalance,
      pending: account.pendingBalance,
      reserved: account.reservedBalance,
    };
  }

  async getHistory(userId, { limit = 50 } = {}) {
    const rows = await this.prisma.creditTransaction.findMany({
      where: { userId, hiddenAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      desc: r.description,
      status: this._statusLabel(r),
      time: r.createdAt,
      amount: r.amount,
      type: r.type,
    }));
  }

  /** "Delete for me" on the user's own history view — the row itself stays intact
   * for admin ledger/audit purposes (§10: transactions are the source of truth). */
  async deleteOne(userId, id) {
    await this.prisma.creditTransaction.updateMany({
      where: { id, userId },
      data: { hiddenAt: new Date() },
    });
    return { success: true };
  }

  async deleteAll(userId) {
    await this.prisma.creditTransaction.updateMany({
      where: { userId, hiddenAt: null },
      data: { hiddenAt: new Date() },
    });
    return { success: true };
  }

  _statusLabel(row) {
    if (row.status === 'REVERSED') return 'Released';
    if (row.status === 'PENDING') return row.type === 'BOOK_LISTED' ? 'Pending' : 'Reserved';
    if (row.type === 'EXCHANGE_COMPLETED') return 'Deducted';
    return 'Available';
  }
}
