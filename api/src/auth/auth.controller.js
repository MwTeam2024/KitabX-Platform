import { BadRequestException, Body, ConflictException, Controller, Dependencies, Get, NotFoundException, Post, Res, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { normalizeEmail, normalizePhone, required } from '../common/validate';
import { toSelfUser } from '../common/serializers/user.serializer';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { OAuthService } from './oauth.service';

@Dependencies(AuthService, OtpService, OAuthService)
@Controller('auth')
export class AuthController {
  constructor(authService, otpService, oauthService) {
    this.authService = authService;
    this.otpService = otpService;
    this.oauthService = oauthService;
  }

  @Post('otp/request')
  @Params({ 0: Body() })
  async requestOtp(body) {
    required(body, ['phone']);
    const phone = normalizePhone(body.phone);
    return this.otpService.requestOtp(phone);
  }

  /**
   * One endpoint for both sign-in and sign-up: an existing phone logs the
   * member in as-is; a new phone creates the account using whatever profile
   * fields the signup form collected (society/block/flat/terms — §5).
   *
   * Task 33/38: a signup started from the merged phone-or-email field may
   * have verified an *email* first (see `otp/verify-email-signup` below) —
   * `emailVerificationToken` is that step's proof, checked server-side so a
   * client can never just claim an email it never actually verified. Phone
   * stays the one thing every account is ultimately created around either
   * way — this just lets the email come along for the ride when there is one.
   */
  @Post('otp/verify')
  @Params({ 0: Body(), 1: Res({ passthrough: true }) })
  async verifyOtp(body, res) {
    required(body, ['phone', 'code']);
    const phone = normalizePhone(body.phone);
    await this.otpService.verifyOtp(phone, body.code);

    const email = body.emailVerificationToken
      ? this.authService.verifyEmailVerificationToken(body.emailVerificationToken)
      : undefined;

    const combinedName = `${body.firstName || ''} ${body.lastName || ''}`.trim();
    const user = await this.authService.findOrCreateUser(phone, {
      name: combinedName || body.name || undefined,
      email,
      cityId: body.cityId,
      areaId: body.areaId,
      societyId: body.societyId,
      blockId: body.blockId,
      flatUnit: body.flatUnit,
      acceptedTerms: body.acceptedTerms,
    });

    this.authService.issueSession(res, user);
    return { user: toSelfUser(user) };
  }

  /**
   * Email-OTP login (§13) — an alternate way in for a member who already has
   * an email on file (added via `email-change/*` below). `intent: 'signup'`
   * (Task 33/38 — the merged phone-or-email field detected an email on the
   * *Create account* tab) flips this to the opposite check: the email must
   * NOT already belong to an account, since that flow verifies the email
   * first and only actually creates the account once a phone is verified
   * too, via `otp/verify` above — phone stays the one required identity.
   */
  @Post('otp/request-email')
  @Params({ 0: Body() })
  async requestEmailOtp(body) {
    required(body, ['email']);
    const email = normalizeEmail(body.email);
    if (body.intent === 'signup') {
      const clash = await this.authService.findUserByEmail(email);
      if (clash) throw new ConflictException('This email is already registered — sign in instead.');
      return this.otpService.requestEmailOtp(email, 'signup-email');
    }
    const user = await this.authService.findUserByEmail(email);
    if (!user) throw new NotFoundException('No account found with this email — sign in with your phone number');
    return this.otpService.requestEmailOtp(email, 'login-email');
  }

  /**
   * Confirms email ownership for an email-first signup, but does not create
   * the account yet — that only happens once a phone is verified too (see
   * `otp/verify` above). Returns a short-lived, server-signed token as proof
   * of this step, rather than trusting a client-supplied email string later.
   */
  @Post('otp/verify-email-signup')
  @Params({ 0: Body() })
  async verifyEmailSignupOtp(body) {
    required(body, ['email', 'code']);
    const email = normalizeEmail(body.email);
    await this.otpService.verifyOtp(email, body.code, 'signup-email');
    const clash = await this.authService.findUserByEmail(email);
    if (clash) throw new ConflictException('This email is already registered — sign in instead.');
    return { verified: true, email, emailVerificationToken: this.authService.signEmailVerificationToken(email) };
  }

  @Post('otp/verify-email')
  @Params({ 0: Body(), 1: Res({ passthrough: true }) })
  async verifyEmailOtp(body, res) {
    required(body, ['email', 'code']);
    const email = normalizeEmail(body.email);
    await this.otpService.verifyOtp(email, body.code, 'login-email');
    const user = await this.authService.findUserByEmail(email);
    if (!user) throw new NotFoundException('No account found with this email — sign in with your phone number');
    this.authService.issueSession(res, user);
    return { user: toSelfUser(user) };
  }

  /**
   * Google/Apple sign-in (§13/§19 — Task 32): same login-only-by-email rule as
   * `otp/verify-email` above, for the same reason (phone stays the one
   * required identity). A member must already have this email on file.
   */
  @Post('oauth/google')
  @Params({ 0: Body(), 1: Res({ passthrough: true }) })
  async googleLogin(body, res) {
    required(body, ['idToken']);
    const { email } = await this.oauthService.verifyGoogleIdToken(body.idToken);
    const user = await this.authService.findUserByEmail(normalizeEmail(email));
    if (!user) {
      throw new NotFoundException('No KitabX account uses this email yet — sign in with your phone number, or add this email from Profile Settings first.');
    }
    this.authService.issueSession(res, user);
    return { user: toSelfUser(user) };
  }

  @Post('oauth/apple')
  @Params({ 0: Body(), 1: Res({ passthrough: true }) })
  async appleLogin(body, res) {
    required(body, ['idToken']);
    const { email } = await this.oauthService.verifyAppleIdToken(body.idToken);
    const user = await this.authService.findUserByEmail(normalizeEmail(email));
    if (!user) {
      throw new NotFoundException('No KitabX account uses this email yet — sign in with your phone number, or add this email from Profile Settings first.');
    }
    this.authService.issueSession(res, user);
    return { user: toSelfUser(user) };
  }

  /** Profile Settings "add/change email" — OTP-verified before it's saved. */
  @UseGuards(JwtAuthGuard)
  @Post('email-change/request')
  @Params({ 0: Body(), 1: CurrentUser() })
  async requestEmailChangeOtp(body, user) {
    required(body, ['newEmail']);
    const newEmail = normalizeEmail(body.newEmail);
    if (newEmail === user.email) {
      throw new BadRequestException('This is already your current email');
    }
    const clash = await this.authService.findUserByEmail(newEmail);
    if (clash && clash.id !== user.id) {
      throw new ConflictException('This email is already registered to another account');
    }
    return this.otpService.requestEmailOtp(newEmail, 'email-change');
  }

  @UseGuards(JwtAuthGuard)
  @Post('email-change/verify')
  @Params({ 0: Body(), 1: CurrentUser(), 2: Res({ passthrough: true }) })
  async verifyEmailChangeOtp(body, user, res) {
    required(body, ['newEmail', 'code']);
    const newEmail = normalizeEmail(body.newEmail);
    await this.otpService.verifyOtp(newEmail, body.code, 'email-change');
    const updated = await this.authService.changeEmail(user.id, newEmail);
    this.authService.issueSession(res, updated);
    return { user: toSelfUser(updated) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @Params({ 0: CurrentUser() })
  me(user) {
    return { user: toSelfUser(user) };
  }

  @Post('logout')
  @Params({ 0: Res({ passthrough: true }) })
  logout(res) {
    this.authService.clearSession(res);
    return { success: true };
  }

  /**
   * Editing an existing member's phone (Profile Settings) is OTP-gated
   * separately from login — the new number must be verified before it
   * replaces `User.phone`, and the flow needs to know *which* user is
   * changing their number, so both endpoints sit behind the session guard.
   */
  @UseGuards(JwtAuthGuard)
  @Post('phone-change/request')
  @Params({ 0: Body(), 1: CurrentUser() })
  async requestPhoneChangeOtp(body, user) {
    required(body, ['newPhone']);
    const newPhone = normalizePhone(body.newPhone);
    if (newPhone === user.phone) {
      throw new BadRequestException('This is already your current number');
    }
    const clash = await this.authService.findUserByPhone(newPhone);
    if (clash && clash.id !== user.id) {
      throw new ConflictException('This number is already registered to another account');
    }
    return this.otpService.requestOtp(newPhone, 'phone-change');
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone-change/verify')
  @Params({ 0: Body(), 1: CurrentUser(), 2: Res({ passthrough: true }) })
  async verifyPhoneChangeOtp(body, user, res) {
    required(body, ['newPhone', 'code']);
    const newPhone = normalizePhone(body.newPhone);
    await this.otpService.verifyOtp(newPhone, body.code, 'phone-change');
    const updated = await this.authService.changePhone(user.id, newPhone);
    this.authService.issueSession(res, updated);
    return { user: toSelfUser(updated) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('account/deletion-request')
  @Params({ 0: CurrentUser() })
  async requestDeletion(user) {
    const updated = await this.authService.requestAccountDeletion(user.id);
    return { user: toSelfUser(updated) };
  }
}
