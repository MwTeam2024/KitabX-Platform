import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FirebaseAdminService } from '../common/firebase/firebase-admin.service';
import { NotificationsGateway } from './notifications.gateway';
// Chat is commented out for now (see chat.module.js) — this used to import
// ChatModule purely to reuse ChatGateway's connection/auth + emitToUser for
// live push (needing the forwardRef below, since ChatModule -> ReportsModule
// -> NotificationsModule already closed a cycle). That machinery now lives
// in its own NotificationsGateway instead, so notifications keep pushing
// live with chat fully off, and there's no cycle left to defer.
// import { forwardRef } from '@nestjs/common';
// import { ChatModule } from '../chat/chat.module';

@Module({
  // imports: [forwardRef(() => ChatModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseAdminService, NotificationsGateway],
  exports: [NotificationsService],
})
export class NotificationsModule {}
