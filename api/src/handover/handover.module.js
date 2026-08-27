import { Module } from '@nestjs/common';
import { HandoverController } from './handover.controller';
import { HandoverService } from './handover.service';
import { NotificationsModule } from '../notifications/notifications.module';
// Chat is switched off for now — see chat.module.js.
// import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [NotificationsModule /* , ChatModule */],
  controllers: [HandoverController],
  providers: [HandoverService],
})
export class HandoverModule {}
