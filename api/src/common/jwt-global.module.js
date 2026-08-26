import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * JwtAuthGuard (used by nearly every feature module) needs JwtService.
 * PrismaModule/RedisModule are already @Global(); this does the same for
 * JwtModule so no feature module has to remember to import it just to use
 * the guard.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') || '30d' },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class JwtGlobalModule {}
