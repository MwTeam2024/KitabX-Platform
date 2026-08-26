import { Module } from '@nestjs/common';
import { PickupController } from './pickup.controller';
import { PickupService } from './pickup.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PickupController],
  providers: [PickupService],
})
export class PickupModule {}
