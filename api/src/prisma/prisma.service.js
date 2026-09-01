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

    // Notifications created inside a `$transaction(async (tx) => ...)`
    // block (accept, pickup, handover, ...) used to push `notification:new`
    // over the socket the instant the row was written — but that's still
    // mid-transaction, before Postgres has actually committed. A client
    // that reacts to the push by immediately refetching (AppDataContext's
    // socket handler does exactly this) could occasionally read pre-commit
    // state and show stale data despite the notification having "already
    // arrived." Wrapping `$transaction` here lets `NotificationsService`
    // queue its side effects (socket emit, FCM push) on `tx` and have this
    // fire them only once `$transaction` itself resolves — which Prisma
    // guarantees is after commit — with zero changes needed at any of the
    // ~10 call sites that create notifications inside a transaction.
    const runTransaction = this.$transaction.bind(this);
    this.$transaction = async (arg, options) => {
      if (typeof arg !== 'function') return runTransaction(arg, options);
      let tx;
      const result = await runTransaction(async (txClient) => {
        tx = txClient;
        tx.__pendingSideEffects = [];
        return arg(txClient);
      }, options);
      for (const run of tx.__pendingSideEffects) {
        try {
          run();
        } catch {
          // Same best-effort contract as before: a push/socket hiccup must
          // never surface as a failure of the (already-committed) transaction.
        }
      }
      return result;
    };
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL (Neon)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
