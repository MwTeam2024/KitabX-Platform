import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/**
 * Email-OTP delivery, parallel to `SmsService`. Uses Resend's HTTPS API
 * instead of raw SMTP — Render's outbound network can't route to Gmail's
 * SMTP servers over IPv6 and has no connect timeout configured, so SMTP
 * sends there either hang for minutes or fail silently.
 *
 * `EMAIL_FROM` must stay Resend's own sandbox address
 * (`onboarding@resend.dev`) unless a real domain is verified in Resend —
 * sending "From" a personal Gmail/Yahoo/Outlook address via any third-party
 * relay gets rate-limited/deferred by that provider's own anti-spoofing
 * rules (confirmed against Gmail: "rate limited because the From: header
 * isn't aligned with... SPF or DKIM organizational domain"), regardless of
 * which ESP is used. The sandbox address avoids that, at the cost of only
 * delivering to the Resend account's own verified email until a domain is
 * added.
 *
 * Until `RESEND_API_KEY` is configured, OTPs are logged to the server
 * console so the email-login flow still works on a fresh checkout with zero
 * external accounts.
 */
@Dependencies(ConfigService)
@Injectable()
export class EmailService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(EmailService.name);
    this.resend = null;
  }

  _isConfigured() {
    return !!this.config.get('RESEND_API_KEY');
  }

  _getClient() {
    if (!this.resend) {
      this.resend = new Resend(this.config.get('RESEND_API_KEY'));
    }
    return this.resend;
  }

  async send(to, subject, text) {
    if (!this._isConfigured()) {
      this.logger.log(`[Email -> ${to}] ${subject}: ${text}`);
      return;
    }
    try {
      const { error } = await this._getClient().emails.send({
        from: this.config.get('EMAIL_FROM') || 'KitabX <onboarding@resend.dev>',
        to,
        subject,
        text,
      });
      if (error) this.logger.error(`Resend send failed: ${error.message}`);
    } catch (err) {
      this.logger.error(`Resend send failed: ${err.message}`);
    }
  }
}
