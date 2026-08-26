import { Body, Controller, Dependencies, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { RequestsService } from './requests.service';

@Dependencies(RequestsService)
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(requests) {
    this.requests = requests;
  }

  @Get('incoming')
  @Params({ 0: CurrentUser('id') })
  incoming(ownerId) {
    return this.requests.listIncoming(ownerId);
  }

  @Get('mine')
  @Params({ 0: CurrentUser('id') })
  mine(requesterId) {
    return this.requests.listMine(requesterId);
  }

  @Post()
  @Params({ 0: CurrentUser('id'), 1: Body() })
  create(requesterId, body) {
    required(body, ['listingId']);
    return this.requests.createRequest(requesterId, body.listingId);
  }

  @Get(':id')
  @Params({ 0: Param('id'), 1: CurrentUser('id') })
  getOne(id, viewerId) {
    return this.requests.getRequest(id, viewerId);
  }

  @Post(':id/accept')
  @Params({ 0: Param('id'), 1: CurrentUser('id') })
  accept(id, ownerId) {
    return this.requests.accept(id, ownerId);
  }

  @Post(':id/decline')
  @Params({ 0: Param('id'), 1: CurrentUser('id') })
  decline(id, ownerId) {
    return this.requests.decline(id, ownerId);
  }

  @Post(':id/cancel')
  @Params({ 0: Param('id'), 1: CurrentUser('id'), 2: Body() })
  cancel(id, callerId, body) {
    return this.requests.cancel(id, callerId, body?.reason);
  }
}
