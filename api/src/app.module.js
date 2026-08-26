import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './common/audit/audit-log.module';
import { ScheduledTasksModule } from './scheduled-tasks/scheduled-tasks.module';
import { RedisModule } from './common/redis/redis.module';
import { JwtGlobalModule } from './common/jwt-global.module';
import { AuthModule } from './auth/auth.module';
import { UploadsModule } from './uploads/uploads.module';
import { BookIdentificationModule } from './book-identification/book-identification.module';
import { SocietiesModule } from './societies/societies.module';
import { UsersModule } from './users/users.module';
import { CreditsModule } from './credits/credits.module';
import { ListingsModule } from './listings/listings.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RequestsModule } from './requests/requests.module';
import { PickupModule } from './pickup/pickup.module';
import { HandoverModule } from './handover/handover.module';
import { ExchangesModule } from './exchanges/exchanges.module';
import { RatingsModule } from './ratings/ratings.module';
import { ReportsModule } from './reports/reports.module';
import { ChatModule } from './chat/chat.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditLogModule,
    RedisModule,
    JwtGlobalModule,
    AuthModule,
    UploadsModule,
    BookIdentificationModule,
    SocietiesModule,
    UsersModule,
    CreditsModule,
    ListingsModule,
    DiscoveryModule,
    WishlistModule,
    NotificationsModule,
    RequestsModule,
    PickupModule,
    HandoverModule,
    ExchangesModule,
    RatingsModule,
    ReportsModule,
    ChatModule,
    AdminModule,
    ScheduledTasksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
