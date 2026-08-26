import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis is the doc's cache/rate-limit/OTP-attempt-counter layer (§17) —
 * never the source of truth. When REDIS_URL isn't configured (e.g. a fresh
 * dev machine with no Redis instance), this falls back to an in-process Map
 * with the same get/set/incr/expire surface, so the whole app — including
 * OTP login — still works on one machine. A real REDIS_URL (a free Upstash
 * instance works fine) is required for multi-instance deployments and for
 * Socket.IO to fan out across more than one backend process.
 *
 * DI note: Babel's "legacy" decorator transform (used across this backend
 * since it's plain JavaScript, not TypeScript) does not support parameter
 * decorators, so `@Inject()` on a constructor argument silently fails to
 * parse. NestJS's documented plain-JS workaround is the class-level
 * `@Dependencies(...)` decorator used below — every service/controller/
 * gateway in this codebase follows the same pattern.
 */
@Dependencies(ConfigService)
@Injectable()
export class RedisService {
  constructor(config) {
    this.logger = new Logger(RedisService.name);
    this.config = config;
    this.memory = new Map();
    this.timers = new Map();
    this.client = null;

    const url = this.config.get('REDIS_URL');
    if (url) {
      this.client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
      this.client.on('error', (err) => {
        this.logger.warn(`Redis error, falling back to in-memory store: ${err.message}`);
        this.client = null;
      });
      this.client.connect().catch((err) => {
        this.logger.warn(`Could not connect to Redis (${err.message}) — using in-memory store instead.`);
        this.client = null;
      });
    } else {
      this.logger.warn('REDIS_URL not set — using an in-memory store (single-instance dev only).');
    }
  }

  isReal() {
    return !!this.client;
  }

  async set(key, value, ttlSeconds) {
    if (this.client) {
      if (ttlSeconds) return this.client.set(key, value, 'EX', ttlSeconds);
      return this.client.set(key, value);
    }
    this.memory.set(key, value);
    this._armExpiry(key, ttlSeconds);
  }

  async get(key) {
    if (this.client) return this.client.get(key);
    return this.memory.has(key) ? this.memory.get(key) : null;
  }

  async del(key) {
    if (this.client) return this.client.del(key);
    this.memory.delete(key);
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
  }

  /** Atomic increment used for OTP attempt counters and simple rate limiting. */
  async incr(key, ttlSeconds) {
    if (this.client) {
      const value = await this.client.incr(key);
      if (value === 1 && ttlSeconds) await this.client.expire(key, ttlSeconds);
      return value;
    }
    const next = (parseInt(this.memory.get(key), 10) || 0) + 1;
    this.memory.set(key, String(next));
    if (next === 1) this._armExpiry(key, ttlSeconds);
    return next;
  }

  _armExpiry(key, ttlSeconds) {
    clearTimeout(this.timers.get(key));
    if (!ttlSeconds) return;
    const timer = setTimeout(() => this.memory.delete(key), ttlSeconds * 1000);
    timer.unref?.();
    this.timers.set(key, timer);
  }

  async onModuleDestroy() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    if (this.client) await this.client.quit().catch(() => {});
  }
}
