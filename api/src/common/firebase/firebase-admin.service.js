import { Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * FCM push delivery only — not phone auth. Real Firebase Phone Auth needs a
 * Firebase project with the Phone provider enabled (and billing past the
 * free SMS quota) plus the client SDK + reCAPTCHA wired into the frontend;
 * that's a manual console setup no env var can substitute for, so login OTP
 * is handled by auth/otp.service.js instead (see its file comment). FCM push
 * only needs a service account, which is exactly what FIREBASE_* holds here.
 *
 * The notification centre (notifications table) is always written regardless
 * of whether this is configured — push is delivery, not the record (§16).
 */
@Dependencies(ConfigService)
@Injectable()
export class FirebaseAdminService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(FirebaseAdminService.name);
    this.app = null;
    this._tryInit();
  }

  _tryInit() {
    const projectId = this.config.get('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get('FIREBASE_PRIVATE_KEY');
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('FIREBASE_* not fully set — push notifications are disabled (in-app notifications still work).');
      return;
    }
    try {
      // Lazy require so a missing/misconfigured SDK never breaks routes that
      // don't touch push notifications.
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      }
      this.app = admin;
    } catch (err) {
      this.logger.error(`Firebase Admin init failed: ${err.message}`);
    }
  }

  isConfigured() {
    return !!this.app;
  }

  /** @param {string[]} tokens @param {{title:string, body:string, data?:object}} payload */
  async sendToTokens(tokens, payload) {
    if (!this.app || !tokens?.length) return { sent: 0 };
    try {
      const res = await this.app.messaging().sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
      });
      return { sent: res.successCount, failed: res.failureCount };
    } catch (err) {
      this.logger.error(`FCM send failed: ${err.message}`);
      return { sent: 0, failed: tokens.length };
    }
  }
}
