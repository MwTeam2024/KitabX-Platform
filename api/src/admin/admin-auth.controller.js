import { BadRequestException, Body, ConflictException, Controller, Dependencies, Get, Post, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminAuthGuard } from './admin-auth.guard';
import { normalizeEmail, normalizePhone, required } from '../common/validate';
import { AdminAuthService } from './admin-auth.service';
import { OtpService } from '../auth/otp.service';
import { OAuthService } from '../auth/oauth.service';

const OTP_PURPOSE = 'admin-login';
const OTP_PURPOSE_EMAIL = 'admin-login-email';

@Dependencies(AdminAuthService, OtpService, OAuthService)
@Controller('admin/auth')
export class AdminAuthController {
  constructor(adminAuth, otpService, oauthService) {
    this.adminAuth = adminAuth;
    this.otpService = otpService;
    this.oauthService = oauthService;
  }

  @Post('otp/request')
  @Params({ 0: Body() })
  async requestOtp(body) {
    required(body, ['phone']);
    const phone = normalizePhone(body.phone);
    const admin = await this.adminAuth.findByPhone(phone);
    if (!admin || !admin.isActive) throw new UnauthorizedException('This number is not registered as an admin');
    return this.otpService.requestOtp(phone, OTP_PURPOSE);
  }

  @Post('otp/verify')
  @Params({ 0: Body(), 1: Res({ passthrough: true }) })
  async verifyOtp(body, res) {
    required(body, ['phone', 'code']);
    const phone = normalizePhone(body.phone);
    await this.otpService.verifyOtp(phone, body.code, OTP_PURPOSE);
    const admin = await this.adminAuth.login(phone);
    this.adminAuth.issueSession(res, admin);
    return { admin: { id: admin.id, phone: admin.phone, email: admin.email, name: admin.name, role: admin.role } };
  }

  /** Email-OTP login (§13) — alternate to phone, for an admin with an email on file. */
  @Post('otp/request-email')
  @Params({ 0: Body() })
  async requestEmailOtp(body) {
    required(body, ['email']);
    const email = normalizeEmail(body.email);
    const admin = await this.adminAuth.findByEmail(email);
    if (!admin || !admin.isActive) throw new UnauthorizedException('This email is not registered as an admin');
    return this.otpService.requestEmailOtp(email, OTP_PURPOSE_EMAIL);
  }

  @Post('otp/verify-email')
  @Params({ 0: Body(), 1: Res({ passthrough: true }) })
  async verifyEmailOtp(body, res) {
    required(body, ['email', 'code']);
    const email = normalizeEmail(body.email);
    await this.otpService.verifyOtp(email, body.code, OTP_PURPOSE_EMAIL);
    const admin = await this.adminAuth.loginByEmail(email);
    this.adminAuth.issueSession(res, admin);
    return { admin: { id: admin.id, phone: admin.phone, email: admin.email, name: admin.name, role: admin.role } };
  }

  /** Google/Apple sign-in (Task 32) — same lookup-only rule as email-OTP
   * above: an admin's email is seed/DB-provisioned, never self-signup. */
  @Post('oauth/google')
  @Params({ 0: Body(), 1: Res({ passthrough: true }) })
  async googleLogin(body, res) {
    required(body, ['idToken']);
    const { email } = await this.oauthService.verifyGoogleIdToken(body.idToken);
    const admin = await this.adminAuth.loginByEmail(normalizeEmail(email));
    this.adminAuth.issueSession(res, admin);
    return { admin: { id: admin.id, phone: admin.phone, email: admin.email, name: admin.name, role: admin.role } };
  }

  @Post('oauth/apple')
  @Params({ 0: Body(), 1: Res({ passthrough: true }) })
  async appleLogin(body, res) {
    required(body, ['idToken']);
    const { email } = await this.oauthService.verifyAppleIdToken(body.idToken);
    const admin = await this.adminAuth.loginByEmail(normalizeEmail(email));
    this.adminAuth.issueSession(res, admin);
    return { admin: { id: admin.id, phone: admin.phone, email: admin.email, name: admin.name, role: admin.role } };
  }

  @UseGuards(AdminAuthGuard)
  @Get('me')
  @Params({ 0: CurrentAdmin() })
  me(admin) {
    return { admin: { id: admin.id, phone: admin.phone, email: admin.email, name: admin.name, role: admin.role } };
  }

  @Post('logout')
  @Params({ 0: Res({ passthrough: true }) })
  logout(res) {
    this.adminAuth.clearSession(res);
    return { success: true };
  }

  /**
   * Task 36 — admin self-service phone/email editing, OTP-gated exactly the
   * same way as the member side (`auth.controller.js`'s `phone-change/*`/
   * `email-change/*`), just under a distinct OTP purpose namespace
   * (`admin-*`) so it can never be confused with a member's own change or an
   * admin login OTP.
   */
  @UseGuards(AdminAuthGuard)
  @Post('phone-change/request')
  @Params({ 0: Body(), 1: CurrentAdmin() })
  async requestPhoneChangeOtp(body, admin) {
    required(body, ['newPhone']);
    const newPhone = normalizePhone(body.newPhone);
    if (newPhone === admin.phone) {
      throw new BadRequestException('This is already your current number');
    }
    const clash = await this.adminAuth.findByPhone(newPhone);
    if (clash && clash.id !== admin.id) {
      throw new ConflictException('This number is already registered to another admin');
    }
    return this.otpService.requestOtp(newPhone, 'admin-phone-change');
  }

  @UseGuards(AdminAuthGuard)
  @Post('phone-change/verify')
  @Params({ 0: Body(), 1: CurrentAdmin(), 2: Res({ passthrough: true }) })
  async verifyPhoneChangeOtp(body, admin, res) {
    required(body, ['newPhone', 'code']);
    const newPhone = normalizePhone(body.newPhone);
    await this.otpService.verifyOtp(newPhone, body.code, 'admin-phone-change');
    const updated = await this.adminAuth.changePhone(admin.id, newPhone);
    this.adminAuth.issueSession(res, updated);
    return { admin: { id: updated.id, phone: updated.phone, email: updated.email, name: updated.name, role: updated.role } };
  }

  @UseGuards(AdminAuthGuard)
  @Post('email-change/request')
  @Params({ 0: Body(), 1: CurrentAdmin() })
  async requestEmailChangeOtp(body, admin) {
    required(body, ['newEmail']);
    const newEmail = normalizeEmail(body.newEmail);
    if (newEmail === admin.email) {
      throw new BadRequestException('This is already your current email');
    }
    const clash = await this.adminAuth.findByEmail(newEmail);
    if (clash && clash.id !== admin.id) {
      throw new ConflictException('This email is already registered to another admin');
    }
    return this.otpService.requestEmailOtp(newEmail, 'admin-email-change');
  }

  @UseGuards(AdminAuthGuard)
  @Post('email-change/verify')
  @Params({ 0: Body(), 1: CurrentAdmin(), 2: Res({ passthrough: true }) })
  async verifyEmailChangeOtp(body, admin, res) {
    required(body, ['newEmail', 'code']);
    const newEmail = normalizeEmail(body.newEmail);
    await this.otpService.verifyOtp(newEmail, body.code, 'admin-email-change');
    const updated = await this.adminAuth.changeEmail(admin.id, newEmail);
    this.adminAuth.issueSession(res, updated);
    return { admin: { id: updated.id, phone: updated.phone, email: updated.email, name: updated.name, role: updated.role } };
  }
}
