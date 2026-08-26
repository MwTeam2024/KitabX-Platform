import { Body, Controller, Dependencies, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { HandoverService } from './handover.service';

@Dependencies(HandoverService)
@UseGuards(JwtAuthGuard)
@Controller('exchanges/:exchangeId/handover')
export class HandoverController {
  constructor(handover) {
    this.handover = handover;
  }

  @Get('otp')
  @Params({ 0: Param('exchangeId'), 1: CurrentUser('id') })
  issueCode(exchangeId, userId) {
    return this.handover.issueOrGetCode(exchangeId, userId);
  }

  @Post('verify')
  @Params({ 0: Param('exchangeId'), 1: CurrentUser('id'), 2: Body() })
  verify(exchangeId, userId, body) {
    required(body, ['code']);
    return this.handover.verify(exchangeId, userId, body.code);
  }
}
