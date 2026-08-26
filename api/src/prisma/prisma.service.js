import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around the generated Prisma Client so it participates in
 * Nest's lifecycle (connect on boot, disconnect on shutdown) and every
 * module gets the same client instance via DI instead of constructing its own.
 */
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn']
          : ['error', 'warn'],
    });
    this.logger = new Logger(PrismaService.name);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL (Neon)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
