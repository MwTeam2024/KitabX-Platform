import { Controller, Dependencies, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

@Dependencies(PrismaService, RedisService)
@Controller('health')
export class HealthController {
  constructor(prisma, redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  @Get()
  async check() {
    const dbOk = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return {
      status: 'ok',
      database: dbOk ? 'connected' : 'unreachable',
      redis: this.redis.isReal() ? 'connected' : 'in-memory-fallback',
      time: new Date().toISOString(),
    };
  }
}
