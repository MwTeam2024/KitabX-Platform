import { forwardRef, Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { NotificationsModule } from '../notifications/notifications.module';

// forwardRef on both sides of this specific edge: NotificationsModule now
// imports ChatModule (§35), and ChatModule imports ReportsModule, which
// imports back into NotificationsModule here — closing the cycle.
@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
