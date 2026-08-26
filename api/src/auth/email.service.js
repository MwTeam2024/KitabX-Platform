import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

/**
 * Email-OTP delivery, parallel to `SmsService`. Real SMTP requires an
 * account with credentials — until `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are
 * configured, OTPs are logged to the server console so the email-login flow
 * still works on a fresh checkout with zero external accounts. Setting all
 * three (plus optionally `SMTP_PORT`/`SMTP_FROM`) switches to real email with
 * no code changes.
 */
@Dependencies(ConfigService)
@Injectable()
export class EmailService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(EmailService.name);
    this.transporter = null;
  }

  _isConfigured() {
    return !!(this.config.get('SMTP_HOST') && this.config.get('SMTP_USER') && this.config.get('SMTP_PASS'));
  }

  _getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.get('SMTP_HOST'),
        port: parseInt(this.config.get('SMTP_PORT'), 10) || 587,
        secure: parseInt(this.config.get('SMTP_PORT'), 10) === 465,
        auth: { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASS') },
      });
    }
    return this.transporter;
  }

  async send(to, subject, text) {
    if (!this._isConfigured()) {
      this.logger.log(`[Email -> ${to}] ${subject}: ${text}`);
      return;
    }
    try {
      await this._getTransporter().sendMail({
        from: this.config.get('SMTP_FROM') || this.config.get('SMTP_USER'),
        to,
        subject,
        text,
      });
    } catch (err) {
      this.logger.error(`SMTP send failed: ${err.message}`);
    }
  }
}
