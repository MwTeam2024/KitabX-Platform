import { Controller, Dependencies, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ExchangesService } from './exchanges.service';

@Dependencies(ExchangesService)
@UseGuards(JwtAuthGuard)
@Controller('exchanges')
export class ExchangesController {
  constructor(exchanges) {
    this.exchanges = exchanges;
  }

  @Get()
  @Params({ 0: CurrentUser('id'), 1: Query('tab') })
  list(userId, tab) {
    return this.exchanges.listForUser(userId, ['forme', 'mine', 'done', 'cancelled'].includes(tab) ? tab : 'forme');
  }

  // §44: must be declared before the `:id` route below, or "all" would be
  // matched as a `:id` param instead.
  @Get('all')
  @Params({ 0: CurrentUser('id') })
  listAll(userId) {
    return this.exchanges.listAllForUser(userId);
  }

  @Get(':id')
  @Params({ 0: Param('id'), 1: CurrentUser('id') })
  getOne(id, viewerId) {
    return this.exchanges.getDetail(id, viewerId);
  }
}
