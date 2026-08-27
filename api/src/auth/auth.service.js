import { BadRequestException, ConflictException, Dependencies, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const USER_INCLUDE = { society: true, block: true, city: true, area: true };

/**
 * Owns the session lifecycle: find-or-create the user row after a verified
 * OTP, and issue/clear the httpOnly cookie the frontend already sends with
 * every request (`credentials: 'include'` in lib/api-client.js).
 */
@Dependencies(PrismaService, JwtService, ConfigService)
@Injectable()
export class AuthService {
  constructor(prisma, jwt, config) {
    this.prisma = prisma;
    this.jwt = jwt;
    this.config = config;
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

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          memberId,
          name: profile.name || 'New Member',
          email: profile.email || null,
          cityId: profile.cityId || null,
          areaId: profile.areaId || null,
          societyId: profile.societyId || null,
          blockId: profile.blockId || null,
          flatUnit: profile.flatUnit || null,
          address: profile.address || null,
          acceptedTermsAt: profile.acceptedTerms ? new Date() : null,
        },
        include: USER_INCLUDE,
      });
      await tx.creditAccount.create({ data: { userId: user.id } });
      await tx.userNotificationPreference.create({ data: { userId: user.id } });
      await tx.userVerification.create({ data: { userId: user.id, status: 'PENDING' } });

      // A society picker with nothing that matches yet — the member is
      // created without one, and this stands in for it until an admin
      // approves the request (see admin.service.js#approveLocationRequest).
      if (!profile.societyId && profile.locationRequest?.cityName && profile.locationRequest?.societyName) {
        await tx.locationRequest.create({
          data: {
            requestedById: user.id,
            cityName: profile.locationRequest.cityName.trim(),
            societyName: profile.locationRequest.societyName.trim(),
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

    const wantsLocationRequest = updates.locationRequest?.cityName && updates.locationRequest?.societyName;
    if (!Object.keys(data).length && !wantsLocationRequest) {
      throw new BadRequestException('No recognized fields to update');
    }

    const user = Object.keys(data).length
      ? await this.prisma.user.update({ where: { id: userId }, data, include: USER_INCLUDE })
      : await this.prisma.user.findUnique({ where: { id: userId }, include: USER_INCLUDE });

    // Same "not in the picker yet" request as signup (findOrCreateUser
    // above) — a member already has a society here, so this doesn't touch
    // it; approval just gives them somewhere new to move into.
    if (wantsLocationRequest) {
      await this.prisma.locationRequest.create({
        data: {
          requestedById: userId,
          cityName: updates.locationRequest.cityName.trim(),
          societyName: updates.locationRequest.societyName.trim(),
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
