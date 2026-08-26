import { Dependencies, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

/**
 * Task 32 — real Google/Apple ID-token verification (real signature checks
 * against each provider's own public keys, no client-supplied claim is ever
 * trusted as-is). Needs a real `GOOGLE_CLIENT_ID`/`APPLE_CLIENT_ID` in
 * `apps/api/.env` to actually work end-to-end — until then both throw a
 * clear 503 rather than silently accepting anything, same convention as
 * `GeminiService`/`R2Service` when their own credentials are missing.
 *
 * Design note (flagging, not assuming silently): Google/Apple only ever hand
 * back an email — never a phone number — and `User.phone`/`AdminUser.phone`
 * are required+unique columns everything else in the app depends on. So, same
 * as Task 13's email-OTP, this is sign-in-only for an account that already
 * has this email on file (a member adds theirs once, in Profile Settings;
 * an admin's is seed/DB-provisioned) — never a way to create a brand-new
 * account. A schema change to make phone optional would be the alternative,
 * but that's a much bigger call than this task on its own should make.
 */
@Dependencies(ConfigService)
@Injectable()
export class OAuthService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(OAuthService.name);
    this.appleJwks = jwksClient({ jwksUri: APPLE_JWKS_URI, cache: true, cacheMaxAge: 24 * 60 * 60 * 1000 });
  }

  isGoogleConfigured() {
    return !!this.config.get('GOOGLE_CLIENT_ID');
  }

  isAppleConfigured() {
    return !!this.config.get('APPLE_CLIENT_ID');
  }

  /** @returns {Promise<{email: string, name: string|null}>} */
  async verifyGoogleIdToken(idToken) {
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Google sign-in needs GOOGLE_CLIENT_ID in apps/api/.env — use phone or email OTP until it is set.',
      );
    }
    const client = new OAuth2Client(clientId);
    let ticket;
    try {
      ticket = await client.verifyIdToken({ idToken, audience: clientId });
    } catch (err) {
      this.logger.warn(`Google ID token verification failed: ${err.message}`);
      throw new UnauthorizedException('Could not verify that Google sign-in — please try again.');
    }
    const payload = ticket.getPayload();
    if (!payload?.email) throw new UnauthorizedException('Google did not share an email for this account.');
    return { email: payload.email, name: payload.name || null };
  }

  /** @returns {Promise<{email: string, name: string|null}>} */
  async verifyAppleIdToken(idToken) {
    const clientId = this.config.get('APPLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Apple sign-in needs APPLE_CLIENT_ID in apps/api/.env — use phone or email OTP until it is set.',
      );
    }
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded?.header?.kid) throw new UnauthorizedException('Could not verify that Apple sign-in — please try again.');

    let payload;
    try {
      const signingKey = await this.appleJwks.getSigningKey(decoded.header.kid);
      payload = jwt.verify(idToken, signingKey.getPublicKey(), {
        algorithms: ['RS256'],
        issuer: APPLE_ISSUER,
        audience: clientId,
      });
    } catch (err) {
      this.logger.warn(`Apple ID token verification failed: ${err.message}`);
      throw new UnauthorizedException('Could not verify that Apple sign-in — please try again.');
    }
    if (!payload?.email) throw new UnauthorizedException('Apple did not share an email for this account.');
    // Apple sends a real name only on the very first authorization (never
    // inside the id_token) — the frontend forwards it separately if present.
    return { email: payload.email, name: null };
  }
}
