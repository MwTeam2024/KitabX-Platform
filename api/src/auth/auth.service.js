import { BadRequestException, ConflictException, Dependencies, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SocietiesService } from '../societies/societies.service';

const USER_INCLUDE = { society: true, block: true, city: true, area: true };

/**
 * Owns the session lifecycle: find-or-create the user row after a verified
 * OTP, and issue/clear the httpOnly cookie the frontend already sends with
 * every request (`credentials: 'include'` in lib/api-client.js).
 */
@Dependencies(PrismaService, JwtService, ConfigService, SocietiesService)
@Injectable()
export class AuthService {
  constructor(prisma, jwt, config, societies) {
    this.prisma = prisma;
    this.jwt = jwt;
    this.config = config;
    this.societies = societies;
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

      return user;
    });
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
