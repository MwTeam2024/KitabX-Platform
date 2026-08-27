import { Module } from '@nestjs/common';
import { RequestExpiryService } from './request-expiry.service';
// Chat is switched off for now — see chat.module.js. These two cron jobs
// are chat-only (retention cleanup + auto-disabling old conversations), so
// they're commented out entirely along with the module they depend on.
// import { ChatRetentionService } from './chat-retention.service';
// import { ExchangeChatDisableService } from './exchange-chat-disable.service';
import { NotificationsModule } from '../notifications/notifications.module';
// import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [NotificationsModule /* , ChatModule */],
  providers: [RequestExpiryService /* , ChatRetentionService, ExchangeChatDisableService */],
})
export class ScheduledTasksModule {}
