import { Body, Controller, Dependencies, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { PickupService } from './pickup.service';

@Dependencies(PickupService)
@UseGuards(JwtAuthGuard)
@Controller('requests/:requestId/pickup')
export class PickupController {
  constructor(pickup) {
    this.pickup = pickup;
  }

  @Get()
  @Params({ 0: Param('requestId'), 1: CurrentUser('id') })
  get(requestId, userId) {
    return this.pickup.get(requestId, userId);
  }

  @Post()
  @Params({ 0: Param('requestId'), 1: CurrentUser('id'), 2: Body() })
  propose(requestId, userId, body) {
    required(body, ['pickupDate', 'timeSlot']);
    return this.pickup.propose(requestId, userId, body);
  }

  @Post('confirm')
  @Params({ 0: Param('requestId'), 1: CurrentUser('id') })
  confirm(requestId, userId) {
    return this.pickup.confirm(requestId, userId);
  }
}
