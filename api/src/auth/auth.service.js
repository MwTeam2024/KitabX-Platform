import { BadRequestException, ConflictException, Dependencies, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SocietiesService } from '../societies/societies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { grantReferralCredit } from '../credits/credits.tx';

const USER_INCLUDE = { society: true, block: true, city: true, area: true };

// Excludes 0/O and 1/I/L — easy to misread when someone retypes a code by
// hand instead of following the link.
const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Owns the session lifecycle: find-or-create the user row after a verified
 * OTP, and issue/clear the httpOnly cookie the frontend already sends with
 * every request (`credentials: 'include'` in lib/api-client.js).
 */
@Dependencies(PrismaService, JwtService, ConfigService, SocietiesService, NotificationsService)
@Injectable()
export class AuthService {
  constructor(prisma, jwt, config, societies, notifications) {
    this.prisma = prisma;
    this.jwt = jwt;
    this.config = config;
    this.societies = societies;
    this.notifications = notifications;
  }

  async findUserByPhone(phone) {
    return this.prisma.user.findUnique({ where: { phone }, include: USER_INCLUDE });
  }

  async findUserByEmail(email) {
    return this.prisma.user.findUnique({ where: { email }, include: USER_INCLUDE });
  }

  /**
   * Signup collects society/block/flat inline (§5); sign-in only ever
   * supplies the phone. `profile` fields are only applied when creating a
   * brand-new user — an existing member's profile is edited via /users/me.
   */
  async findOrCreateUser(phone, profile = {}) {
    const existing = await this.findUserByPhone(phone);
    if (existing) return existing;

    if (profile.email) {
      const emailClash = await this.findUserByEmail(profile.email);
      if (emailClash) throw new ConflictException('This email is already registered to another account');
    }

    const memberId = await this.generateMemberId();
    const referralCode = await this.generateReferralCode();

    // An unknown/malformed code is just ignored rather than blocking signup
    // — the whole point is a smoother signup, not a new way to fail one.
    // Self-referral can't happen structurally: the referrer has to already
    // exist, and this is by definition a brand-new phone number/account.
    let referrer = null;
    if (profile.referralCode) {
      referrer = await this.prisma.user.findUnique({
        where: { referralCode: profile.referralCode.trim().toUpperCase() },
      });
    }

    // A society picker with nothing that matches yet — rather than leaving
    // the member with no society at all until an admin gets to the request
    // (fully blocking discovery/radius in the meantime, see
    // discovery.service.js), create the real society right away, just
    // unverified, and drop the member straight into it. Approving the
    // request later only flips it to verified so it also shows up in
    // everyone else's picker (see admin.service.js#approveLocationRequest);
    // rejecting deactivates it and pulls the member back out.
    let requestedSociety = null;
    if (!profile.societyId && profile.locationRequest?.cityName && profile.locationRequest?.societyName) {
      requestedSociety = await this.societies.adminCreateSociety({
        name: profile.locationRequest.societyName.trim(),
        cityName: profile.locationRequest.cityName.trim(),
        address: profile.locationRequest.address || null,
        latitude: profile.locationRequest.latitude ?? null,
        longitude: profile.locationRequest.longitude ?? null,
        verified: false,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          memberId,
          referralCode,
          referredById: referrer?.id || null,
          name: profile.name || 'New Member',
          email: profile.email || null,
          cityId: requestedSociety ? requestedSociety.city.id : (profile.cityId || null),
          areaId: requestedSociety ? requestedSociety.area.id : (profile.areaId || null),
          societyId: requestedSociety ? requestedSociety.id : (profile.societyId || null),
          blockId: profile.blockId || null,
          flatUnit: profile.flatUnit || null,
          address: profile.address || null,
          latitude: profile.latitude ?? null,
          longitude: profile.longitude ?? null,
          acceptedTermsAt: profile.acceptedTerms ? new Date() : null,
        },
        include: USER_INCLUDE,
      });
      await tx.creditAccount.create({ data: { userId: user.id } });
      await tx.userNotificationPreference.create({ data: { userId: user.id } });
      await tx.userVerification.create({ data: { userId: user.id, status: 'PENDING' } });

      if (requestedSociety) {
        await tx.locationRequest.create({
          data: {
            requestedById: user.id,
            cityName: profile.locationRequest.cityName.trim(),
            societyName: profile.locationRequest.societyName.trim(),
            address: profile.locationRequest.address || null,
            latitude: profile.locationRequest.latitude ?? null,
            longitude: profile.locationRequest.longitude ?? null,
            createdSocietyId: requestedSociety.id,
          },
        });
      }

      // Both sides rewarded the instant the new member finishes OTP
      // verification — not gated on later verification or a first listing,
      // so the "invite a friend, get a credit" pitch pays off immediately
      // for both of them, which is what makes it worth sharing in the
      // first place.
      if (referrer) {
        await grantReferralCredit(tx, {
          userId: referrer.id,
          referenceId: user.id,
          description: `Referral bonus — ${user.name} joined using your invite`,
        });
        await grantReferralCredit(tx, {
          userId: user.id,
          referenceId: referrer.id,
          description: `Referral bonus — you joined using ${referrer.name}'s invite`,
        });
        await this.notifications.create(tx, {
          userId: referrer.id,
          type: 'REFERRAL',
          title: 'You earned 1 credit! 🎉',
          body: `${user.name} joined KitabX using your invite link.`,
          entityType: 'user',
          entityId: user.id,
        });
        await this.notifications.create(tx, {
          userId: user.id,
          type: 'REFERRAL',
          title: 'Welcome bonus: 1 credit! 🎉',
          body: `You earned 1 credit for joining via ${referrer.name}'s invite link.`,
          entityType: 'user',
          entityId: referrer.id,
        });
      }

      return user;
    });
  }

  async generateReferralCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let code = '';
      for (let i = 0; i < 6; i += 1) {
        code += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
      }
      const clash = await this.prisma.user.findUnique({ where: { referralCode: code } });
      if (!clash) return code;
    }
    throw new ConflictException('Could not allocate a referral code — please retry');
  }

  async generateMemberId() {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = String(Math.floor(1000 + Math.random() * 9000));
      const memberId = `KBX-${year}-${suffix}`;
      const clash = await this.prisma.user.findUnique({ where: { memberId } });
      if (!clash) return memberId;
    }
    throw new ConflictException('Could not allocate a member ID — please retry');
  }

  signToken(user) {
    return this.jwt.sign({ sub: user.id, phone: user.phone });
  }

  /** Short-lived proof that `otp/verify-email-signup` actually happened for
   * this exact email — `otp/verify` trusts this token's signature, never a
   * raw client-supplied email string, when finishing an email-first signup. */
  signEmailVerificationToken(email) {
    return this.jwt.sign({ email, purpose: 'signup-email-verified' }, { expiresIn: '10m' });
  }

  verifyEmailVerificationToken(token) {
    let payload;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new BadRequestException('Your email verification expired — please verify it again.');
    }
    if (payload?.purpose !== 'signup-email-verified' || !payload.email) {
      throw new BadRequestException('Invalid email verification.');
    }
    return payload.email;
  }

  issueSession(res, user) {
    const token = this.signToken(user);
    const isProd = this.config.get('NODE_ENV') === 'production';
    res.cookie(this.config.get('SESSION_COOKIE_NAME') || 'kitabx_session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  clearSession(res) {
    res.clearCookie(this.config.get('SESSION_COOKIE_NAME') || 'kitabx_session', { path: '/' });
  }

  async updateProfile(userId, updates) {
    const data = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.bio !== undefined) data.bio = updates.bio;
    if (updates.profileImageUrl !== undefined) data.profileImageUrl = updates.profileImageUrl;
    if (updates.cityId !== undefined) data.cityId = updates.cityId;
    if (updates.areaId !== undefined) data.areaId = updates.areaId;
    if (updates.societyId !== undefined) data.societyId = updates.societyId;
    if (updates.blockId !== undefined) data.blockId = updates.blockId;
    if (updates.flatUnit !== undefined) data.flatUnit = updates.flatUnit;
    if (updates.address !== undefined) data.address = updates.address;
    if (updates.latitude !== undefined) data.latitude = updates.latitude;
    if (updates.longitude !== undefined) data.longitude = updates.longitude;

    const wantsLocationRequest = updates.locationRequest?.cityName && updates.locationRequest?.societyName;
    if (!Object.keys(data).length && !wantsLocationRequest) {
      throw new BadRequestException('No recognized fields to update');
    }

    // Same "not in the picker yet" request as signup (findOrCreateUser
    // above) — move the member into the real (unverified) society right
    // away rather than stranding them in their old one until an admin
    // reviews it; see admin.service.js#approveLocationRequest/rejectLocationRequest.
    let requestedSociety = null;
    if (wantsLocationRequest) {
      requestedSociety = await this.societies.adminCreateSociety({
        name: updates.locationRequest.societyName.trim(),
        cityName: updates.locationRequest.cityName.trim(),
        address: updates.locationRequest.address || null,
        latitude: updates.locationRequest.latitude ?? null,
        longitude: updates.locationRequest.longitude ?? null,
        verified: false,
      });
      data.cityId = requestedSociety.city.id;
      data.areaId = requestedSociety.area.id;
      data.societyId = requestedSociety.id;
    }

    const user = Object.keys(data).length
      ? await this.prisma.user.update({ where: { id: userId }, data, include: USER_INCLUDE })
      : await this.prisma.user.findUnique({ where: { id: userId }, include: USER_INCLUDE });

    if (wantsLocationRequest) {
      await this.prisma.locationRequest.create({
        data: {
          requestedById: userId,
          cityName: updates.locationRequest.cityName.trim(),
          societyName: updates.locationRequest.societyName.trim(),
          address: updates.locationRequest.address || null,
          latitude: updates.locationRequest.latitude ?? null,
          longitude: updates.locationRequest.longitude ?? null,
          createdSocietyId: requestedSociety.id,
        },
      });
    }

    return user;
  }

  async changePhone(userId, newPhone) {
    const clash = await this.findUserByPhone(newPhone);
    if (clash && clash.id !== userId) {
      throw new ConflictException('This number is already registered to another account');
    }
    return this.prisma.user.update({ where: { id: userId }, data: { phone: newPhone }, include: USER_INCLUDE });
  }

  async changeEmail(userId, newEmail) {
    const clash = await this.findUserByEmail(newEmail);
    if (clash && clash.id !== userId) {
      throw new ConflictException('This email is already registered to another account');
    }
    return this.prisma.user.update({ where: { id: userId }, data: { email: newEmail }, include: USER_INCLUDE });
  }

  async requestAccountDeletion(userId) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: new Date() },
      include: USER_INCLUDE,
    });
  }
}
