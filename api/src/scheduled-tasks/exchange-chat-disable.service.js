import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';

// User request: once a book exchange is completed, its chat should
// auto-disable 7 days later — reuses the same disable path request-expiry
// already uses, just triggered by completion instead of expiry.
const DISABLE_AFTER_DAYS = 7;

@Dependencies(PrismaService, ChatService)
@Injectable()
export class ExchangeChatDisableService {
  constructor(prisma, chat) {
    this.prisma = prisma;
    this.chat = chat;
    this.logger = new Logger(ExchangeChatDisableService.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async disableStaleChats() {
    const cutoff = new Date(Date.now() - DISABLE_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const exchanges = await this.prisma.exchange.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { lt: cutoff },
        request: { conversation: { status: 'ACTIVE' } },
      },
      select: { requestId: true },
    });
    if (!exchanges.length) return;

    for (const { requestId } of exchanges) {
      // eslint-disable-next-line no-await-in-loop
      await this.chat.disableForRequest(requestId).catch((err) => {
        this.logger.error(`Failed to disable chat for request ${requestId}: ${err.message}`);
      });
    }
    this.logger.log(`Disabled ${exchanges.length} chat(s) ${DISABLE_AFTER_DAYS}+ days after exchange completion`);
  }
}
