import { Controller, Delete, Dependencies, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Dependencies(NotificationsService)
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(notifications) {
    this.notifications = notifications;
  }

  @Get()
  @Params({ 0: CurrentUser('id') })
  list(userId) {
    return this.notifications.list(userId);
  }

  @Get('unread-count')
  @Params({ 0: CurrentUser('id') })
  async unreadCount(userId) {
    return { count: await this.notifications.unreadCount(userId) };
  }

  @Patch('read-all')
  @Params({ 0: CurrentUser('id') })
  markAllRead(userId) {
    return this.notifications.markAllRead(userId);
  }

  @Patch(':id/read')
  @Params({ 0: CurrentUser('id'), 1: Param('id') })
  markRead(userId, id) {
    return this.notifications.markRead(userId, id);
  }

  @Delete(':id')
  @Params({ 0: CurrentUser('id'), 1: Param('id') })
  deleteOne(userId, id) {
    return this.notifications.deleteOne(userId, id);
  }

  @Delete()
  @Params({ 0: CurrentUser('id') })
  deleteAll(userId) {
    return this.notifications.deleteAll(userId);
  }
}
