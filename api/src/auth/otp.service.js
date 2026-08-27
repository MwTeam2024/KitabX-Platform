import { BadRequestException, Dependencies, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { RedisService } from '../common/redis/redis.service';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';

const OTP_TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Login OTP — separate from the exchange handover OTP (handover.service.js)
 * per the architecture doc §5/§13. Codes are never stored in plaintext.
 * `requestOtp`/`verifyOtp` are the SMS (phone) channel; `requestEmailOtp`
 * shares the same generate/store/verify mechanics over email instead —
 * `verifyOtp` doesn't care which channel a code was delivered through, only
 * that the identifier+purpose+code match.
 */
@Dependencies(RedisService, SmsService, EmailService, ConfigService)
@Injectable()
export class OtpService {
  constructor(redis, sms, email, config) {
    this.redis = redis;
    this.sms = sms;
    this.email = email;
    this.config = config;
  }

  /**
   * `purpose` namespaces the Redis keys (default `login`) so an OTP for one
   * flow never collides with or gets consumed by another — e.g. a member
   * verifying their new number (`phone-change`) shouldn't interfere with
   * someone else's login OTP for that same number.
   */
  async _issueCode(identifier, purpose) {
    const cooldownKey = `otp:${purpose}:cooldown:${identifier}`;
    if (await this.redis.get(cooldownKey)) {
      throw new HttpException('Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = String(crypto.randomInt(100000, 999999));
    await this.redis.set(`otp:${purpose}:${identifier}`, hashCode(code), OTP_TTL_SECONDS);
    await this.redis.set(`otp:${purpose}:attempts:${identifier}`, '0', OTP_TTL_SECONDS);
    await this.redis.set(cooldownKey, '1', RESEND_COOLDOWN_SECONDS);
    return code;
  }

  _response(code) {
    const isProd = this.config.get('NODE_ENV') === 'production';
    // TEMPORARY, for client testing before real SMS/email is wired up — set
    // EXPOSE_DEV_OTP=true on Render to surface the code here even in
    // production. This is a real security hole while it's on: anyone who
    // knows a phone/email can log in as that person without ever touching
    // their phone. Turn it back off (unset the env var, no redeploy needed)
    // once client testing is done and before any real users show up.
    const exposeAnyway = this.config.get('EXPOSE_DEV_OTP') === 'true';
    return {
      sent: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      // Only surfaced outside production so the app is usable without a real
      // SMS/SMTP account configured — see sms.service.js / email.service.js.
      devCode: isProd && !exposeAnyway ? undefined : code,
    };
  }

  async requestOtp(phone, purpose = 'login') {
    const code = await this._issueCode(phone, purpose);
    const message = purpose === 'phone-change' || purpose === 'admin-phone-change'
      ? `Your KitabX code to confirm your new number is ${code}. It expires in 5 minutes.`
      : `Your KitabX verification code is ${code}. It expires in 5 minutes.`;
    await this.sms.send(phone, message);
    return this._response(code);
  }

  async requestEmailOtp(email, purpose = 'login-email') {
    const code = await this._issueCode(email, purpose);
    await this.email.send(email, 'Your KitabX verification code', `Your KitabX verification code is ${code}. It expires in 5 minutes.`);
    return this._response(code);
  }

  async verifyOtp(identifier, code, purpose = 'login') {
    const attemptsKey = `otp:${purpose}:attempts:${identifier}`;
    const attempts = parseInt((await this.redis.get(attemptsKey)) || '0', 10);
    if (attempts >= MAX_ATTEMPTS) {
      throw new HttpException('Too many attempts — request a new code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const codeKey = `otp:${purpose}:${identifier}`;
    const storedHash = await this.redis.get(codeKey);
    if (!storedHash) {
      throw new BadRequestException('Code expired — request a new one');
    }

    await this.redis.incr(attemptsKey, OTP_TTL_SECONDS);

    if (storedHash !== hashCode(String(code))) {
      throw new BadRequestException('Incorrect code');
    }

    await this.redis.del(codeKey);
    await this.redis.del(attemptsKey);
    return true;
  }
}
