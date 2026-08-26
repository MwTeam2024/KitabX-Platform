import { ConflictException, Dependencies, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * §21: admin authorization is entirely server-side and deliberately isolated
 * from member auth — a different table (admin_users), a different JWT claim
 * shape, and its own cookie name, so an admin session can never be confused
 * with (or escalate from) a regular member session. Login is phone+OTP only
 * (no email/password) — admins are provisioned by seed/DB, never self-signup,
 * so there's no find-or-create here, only a lookup.
 */
@Dependencies(PrismaService, JwtService, ConfigService)
@Injectable()
export class AdminAuthService {
  constructor(prisma, jwt, config) {
    this.prisma = prisma;
    this.jwt = jwt;
    this.config = config;
  }

  async findByPhone(phone) {
    return this.prisma.adminUser.findUnique({ where: { phone } });
  }

  async findByEmail(email) {
    return this.prisma.adminUser.findUnique({ where: { email } });
  }

  async login(phone) {
    const admin = await this.findByPhone(phone);
    if (!admin || !admin.isActive) throw new UnauthorizedException('This number is not registered as an admin');
    return this._touchLastLogin(admin);
  }

  async loginByEmail(email) {
    const admin = await this.findByEmail(email);
    if (!admin || !admin.isActive) throw new UnauthorizedException('This email is not registered as an admin');
    return this._touchLastLogin(admin);
  }

  async _touchLastLogin(admin) {
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    return admin;
  }

  signToken(admin) {
    return this.jwt.sign({ sub: admin.id, role: admin.role, type: 'admin' }, { expiresIn: '12h' });
  }

  issueSession(res, admin) {
    const token = this.signToken(admin);
    const isProd = this.config.get('NODE_ENV') === 'production';
    res.cookie(this._cookieName(), token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 12 * 60 * 60 * 1000,
      path: '/',
    });
  }

  clearSession(res) {
    res.clearCookie(this._cookieName(), { path: '/' });
  }

  _cookieName() {
    return this.config.get('ADMIN_SESSION_COOKIE_NAME') || 'kitabx_admin_session';
  }

  /** Task 36 — same self-service pattern as the member side (`AuthService
   * #changePhone`/`#changeEmail`), OTP-gated in the controller before either
   * of these runs. */
  async changePhone(adminId, newPhone) {
    const clash = await this.findByPhone(newPhone);
    if (clash && clash.id !== adminId) {
      throw new ConflictException('This number is already registered to another admin');
    }
    return this.prisma.adminUser.update({ where: { id: adminId }, data: { phone: newPhone } });
  }

  async changeEmail(adminId, newEmail) {
    const clash = await this.findByEmail(newEmail);
    if (clash && clash.id !== adminId) {
      throw new ConflictException('This email is already registered to another admin');
    }
    return this.prisma.adminUser.update({ where: { id: adminId }, data: { email: newEmail } });
  }
}
