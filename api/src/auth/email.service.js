import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Email-OTP delivery, parallel to `SmsService`. Sends via Brevo's HTTPS API
 * — deliberately not their SMTP relay (port 587/465) — because Render's
 * outbound network can't route to most providers' SMTP over IPv6 and has no
 * connect timeout configured, so SMTP sends there either hang for minutes or
 * fail silently. A plain HTTPS POST has none of that; it's the same reason
 * this app used Resend's API before, not SMTP either.
 *
 * `EMAIL_FROM` must be a sender verified in the Brevo dashboard (Senders,
 * Domains & Dedicated IPs → Senders) — Brevo rejects sends from an
 * unverified address outright, and even a verified-but-unauthenticated
 * personal Gmail/Yahoo/Outlook address gets rate-limited by that provider's
 * own anti-spoofing rules regardless of which ESP relays it. A verified
 * business domain with SPF/DKIM set up (Brevo's Domains page walks through
 * the DNS records) is what actually keeps sends from being blocked.
 *
 * Until `BREVO_API_KEY` is configured, OTPs are logged to the server
 * console so the email-login flow still works on a fresh checkout with zero
 * external accounts.
 */
@Dependencies(ConfigService)
@Injectable()
export class EmailService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(EmailService.name);
  }

  _isConfigured() {
    return !!this.config.get('BREVO_API_KEY');
  }

  _sender() {
    const raw = this.config.get('EMAIL_FROM') || 'KitabX <no-reply@kitabx.com>';
    const match = raw.match(/^(.*?)\s*<(.+)>$/);
    return match ? { name: match[1].trim(), email: match[2].trim() } : { email: raw.trim() };
  }

  async send(to, subject, text) {
    if (!this._isConfigured()) {
      this.logger.log(`[Email -> ${to}] ${subject}: ${text}`);
      return;
    }
    try {
      const res = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': this.config.get('BREVO_API_KEY'),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: this._sender(),
          to: [{ email: to }],
          subject,
          textContent: text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(`Brevo send failed: ${res.status} ${body}`);
      }
    } catch (err) {
      this.logger.error(`Brevo send failed: ${err.message}`);
    }
  }
}
