import { Dependencies, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Session lives in an httpOnly cookie (not a bearer header) so the frontend's
 * `fetch(..., { credentials: 'include' })` (already built into lib/api-client.js)
 * works without the client ever handling the token. Attaches the full user row
 * (minus nothing here — route handlers decide what to expose via the
 * serializers) to `req.user` so downstream code never re-queries it.
 */
@Dependencies(JwtService, ConfigService, PrismaService)
@Injectable()
export class JwtAuthGuard {
  constructor(jwt, config, prisma) {
    this.jwt = jwt;
    this.config = config;
    this.prisma = prisma;
  }

  async canActivate(context) {
    const req = context.switchToHttp().getRequest();
    const cookieName = this.config.get('SESSION_COOKIE_NAME') || 'kitabx_session';
    const token = req.cookies?.[cookieName];
    if (!token) throw new UnauthorizedException('Not signed in');

    let payload;
    try {
      payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
    } catch {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { society: true, block: true, city: true, area: true },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Account no longer active');
    }

    req.user = user;
    return true;
  }
}

/**
 * Same as JwtAuthGuard but never throws — used on routes that behave
 * differently for guests vs. members (none yet, kept for parity with the
 * frontend's public/auth route split).
 */
@Dependencies(JwtService, ConfigService, PrismaService)
@Injectable()
export class OptionalAuthGuard {
  constructor(jwt, config, prisma) {
    this.jwt = jwt;
    this.config = config;
    this.prisma = prisma;
  }

  async canActivate(context) {
    const req = context.switchToHttp().getRequest();
    const cookieName = this.config.get('SESSION_COOKIE_NAME') || 'kitabx_session';
    const token = req.cookies?.[cookieName];
    if (!token) return true;
    try {
      const payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
      req.user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { society: true, block: true },
      });
    } catch {
      // Invalid/expired token on an optional route just means "not signed in".
    }
    return true;
  }
}
