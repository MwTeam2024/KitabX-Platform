import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';

/**
 * Automates "delete for me" (chat.service.js#deleteThread) for users who've
 * opted into an auto-delete window in their notification preferences — a
 * conversation is hidden on their side once it's been quiet longer than the
 * chosen window. Reusing deleteThread keeps this in sync with manual delete:
 * once every participant has hidden their side, the conversation is purged.
 */
@Dependencies(PrismaService, ChatService)
@Injectable()
export class ChatRetentionService {
  constructor(prisma, chat) {
    this.prisma = prisma;
    this.chat = chat;
    this.logger = new Logger(ChatRetentionService.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async applyRetention() {
    const users = await this.prisma.userNotificationPreference.findMany({
      where: { chatRetentionMonths: { not: null } },
      select: { userId: true, chatRetentionMonths: true },
    });
    if (!users.length) return;

    let hidden = 0;
    for (const { userId, chatRetentionMonths } of users) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - chatRetentionMonths);

      const participations = await this.prisma.conversationParticipant.findMany({
        where: { userId, deletedAt: null },
        include: { conversation: { include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
      });

      for (const p of participations) {
        const lastActivity = p.conversation.messages[0]?.createdAt || p.conversation.createdAt;
        if (lastActivity < cutoff) {
          await this.chat.deleteThread(p.conversationId, userId).catch((err) => {
            this.logger.error(`Failed to auto-delete conversation ${p.conversationId} for ${userId}: ${err.message}`);
          });
          hidden += 1;
        }
      }
    }
    if (hidden) this.logger.log(`Auto-retention hid ${hidden} conversation(s) past their retention window`);
  }
}
