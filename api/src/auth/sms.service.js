import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * OTP delivery. Real phone-auth SMS (via Firebase Phone Auth or any provider)
 * requires an account with billing set up — not something that can be
 * conjured from an env var alone. Until TWILIO_* is configured, OTPs are
 * logged to the server console so the whole signup/login flow works on a
 * fresh checkout with zero external accounts. Setting SMS_PROVIDER=twilio
 * plus the three TWILIO_* vars switches to real SMS with no code changes.
 */
@Dependencies(ConfigService)
@Injectable()
export class SmsService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(SmsService.name);
  }

  async send(phone, message) {
    const provider = this.config.get('SMS_PROVIDER') || 'console';

    if (provider === 'twilio') {
      const sid = this.config.get('TWILIO_ACCOUNT_SID');
      const token = this.config.get('TWILIO_AUTH_TOKEN');
      const from = this.config.get('TWILIO_FROM_NUMBER');
      if (!sid || !token || !from) {
        this.logger.warn('SMS_PROVIDER=twilio but Twilio credentials are incomplete — falling back to console.');
      } else {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: phone, From: from, Body: message }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          this.logger.error(`Twilio send failed (${res.status}): ${text}`);
        }
        return;
      }
    }

    this.logger.log(`[SMS -> ${phone}] ${message}`);
  }
}
