import { Module } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller';
import { AdminController } from './admin.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminService } from './admin.service';
import { SocietiesModule } from '../societies/societies.module';
import { ReportsModule } from '../reports/reports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [SocietiesModule, ReportsModule, NotificationsModule, AuthModule, UploadsModule],
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminService],
})
export class AdminModule {}
