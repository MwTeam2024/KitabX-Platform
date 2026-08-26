import { Body, Controller, Delete, Dependencies, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { toSelfUser } from '../common/serializers/user.serializer';
import { AuthService } from '../auth/auth.service';
import { UsersService } from './users.service';
import { ReportsService } from '../reports/reports.service';
import { RatingsService } from '../ratings/ratings.service';

@Dependencies(UsersService, AuthService, ReportsService, RatingsService)
@Controller('users')
export class UsersController {
  constructor(users, authService, reports, ratings) {
    this.users = users;
    this.authService = authService;
    this.reports = reports;
    this.ratings = ratings;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/blocked')
  @Params({ 0: CurrentUser('id') })
  listBlocked(userId) {
    return this.reports.listBlocked(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @Params({ 0: CurrentUser(), 1: Body() })
  async updateMe(user, body) {
    const updated = await this.authService.updateProfile(user.id, body);
    return { user: toSelfUser(updated) };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/notification-preferences')
  @Params({ 0: CurrentUser() })
  getMyPreferences(user) {
    return this.users.getNotificationPreferences(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/notification-preferences')
  @Params({ 0: CurrentUser(), 1: Body() })
  updateMyPreferences(user, body) {
    return this.users.setNotificationPreferences(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/devices')
  @Params({ 0: CurrentUser(), 1: Body() })
  registerDevice(user, body) {
    required(body, ['fcmToken', 'platform']);
    return this.users.registerDevice(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/block')
  @Params({ 0: CurrentUser('id'), 1: Param('id') })
  block(userId, targetId) {
    return this.reports.blockUser(userId, targetId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/block')
  @Params({ 0: CurrentUser('id'), 1: Param('id') })
  unblock(userId, targetId) {
    return this.reports.unblockUser(userId, targetId);
  }

  @Get(':id/ratings')
  @Params({ 0: Param('id') })
  getRatings(id) {
    return this.ratings.forUser(id);
  }

  /** Public trust profile — kept last so it doesn't shadow the routes above. */
  @Get(':id')
  @Params({ 0: Param('id') })
  getPublicProfile(id) {
    return this.users.getPublicProfile(id);
  }
}
