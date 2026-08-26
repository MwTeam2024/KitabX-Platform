import { forwardRef, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseAdminService } from '../common/firebase/firebase-admin.service';
import { ChatModule } from '../chat/chat.module';

// forwardRef: ChatModule -> ReportsModule -> NotificationsModule already
// exists, so importing ChatModule here (for ChatGateway's live-push, §35)
// closes a cycle — forwardRef defers resolving this specific edge instead of
// requiring both modules fully built up front.
@Module({
  imports: [forwardRef(() => ChatModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseAdminService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
