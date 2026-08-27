import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { NotificationsModule } from '../notifications/notifications.module';
// Chat is switched off for now — see chat.module.js.
// import { ChatModule } from '../chat/chat.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [NotificationsModule, /* ChatModule, */ ReportsModule],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
