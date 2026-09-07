import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * OTP delivery. Real phone-auth SMS requires an account with billing set up
 * — not something that can be conjured from an env var alone. Until MSG91's
 * env vars are configured, OTPs are logged to the server console so the
 * whole signup/login flow works on a fresh checkout with zero external
 * accounts. Setting SMS_PROVIDER=msg91 (plus the MSG91_ vars) switches to
 * real SMS with no code changes.
 */
@Dependencies(ConfigService)
@Injectable()
export class SmsService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(SmsService.name);
  }

  /** `code` is the raw OTP digits, passed alongside the already-rendered
   * `message` sentence — console sends that sentence as-is, but MSG91
   * (India's DLT regulations) can only fill a variable into a pre-approved,
   * fixed-text template, never send arbitrary free text. */
  async send(phone, message, code) {
    const provider = this.config.get('SMS_PROVIDER') || 'console';

    if (provider === 'msg91') {
      const authKey = this.config.get('MSG91_AUTH_KEY');
      const templateId = this.config.get('MSG91_TEMPLATE_ID');
      // Whatever the variable was named when the DLT-approved template was
      // added in the MSG91 dashboard (its own "Add Template" screen shows
      // this) — MSG91's own docs example uses "VAR1", so that's the default.
      const varName = this.config.get('MSG91_TEMPLATE_VAR_NAME') || 'VAR1';
      if (!authKey || !templateId) {
        this.logger.warn('SMS_PROVIDER=msg91 but MSG91 credentials are incomplete — falling back to console.');
      } else {
        // MSG91 wants the number with country code but no leading "+".
        const mobile = phone.replace(/^\+/, '');
        const res = await fetch('https://control.msg91.com/api/v5/flow', {
          method: 'POST',
          headers: {
            authkey: authKey,
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            template_id: templateId,
            short_url: '0',
            recipients: [{ mobiles: mobile, [varName]: code ?? message }],
          }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          this.logger.error(`MSG91 send failed (${res.status}): ${text}`);
        }
        return;
      }
    }

    this.logger.log(`[SMS -> ${phone}] ${message}`);
  }
}
