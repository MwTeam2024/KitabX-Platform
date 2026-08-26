import { Module } from '@nestjs/common';
import { RequestExpiryService } from './request-expiry.service';
import { ChatRetentionService } from './chat-retention.service';
import { ExchangeChatDisableService } from './exchange-chat-disable.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [NotificationsModule, ChatModule],
  providers: [RequestExpiryService, ChatRetentionService, ExchangeChatDisableService],
})
export class ScheduledTasksModule {}
