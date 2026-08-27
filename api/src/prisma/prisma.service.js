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

    // Neon's pooler is a network hop away (~90ms/round-trip from here), and
    // Prisma's default relation strategy fetches each `include`d relation as
    // its own round trip — a query with 5-6 relations was taking 2s+ purely
    // from stacked latency, not real DB work. `join` folds them into one SQL
    // query via LEFT JOINs, cutting that to ~1 round trip app-wide.
    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            if (args && args.include && args.relationLoadStrategy === undefined) {
              args.relationLoadStrategy = 'join';
            }
            return query(args);
          },
        },
      },
    });
    Object.assign(this, extended);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL (Neon)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
