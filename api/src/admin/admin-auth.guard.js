import { Dependencies, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Dependencies(JwtService, ConfigService, PrismaService)
@Injectable()
export class AdminAuthGuard {
  constructor(jwt, config, prisma) {
    this.jwt = jwt;
    this.config = config;
    this.prisma = prisma;
  }

  async canActivate(context) {
    const req = context.switchToHttp().getRequest();
    const cookieName = this.config.get('ADMIN_SESSION_COOKIE_NAME') || 'kitabx_admin_session';
    const token = req.cookies?.[cookieName];
    if (!token) throw new UnauthorizedException('Admin session required');

    let payload;
    try {
      payload = this.jwt.verify(token, { secret: this.config.get('JWT_SECRET') });
    } catch {
      throw new UnauthorizedException('Admin session expired');
    }
    if (payload.type !== 'admin') throw new UnauthorizedException('Not an admin session');

    const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Admin account is not active');

    req.admin = admin;
    return true;
  }
}
