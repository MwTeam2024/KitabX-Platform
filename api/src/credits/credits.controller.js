import { Controller, Delete, Dependencies, Get, Param, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreditsService } from './credits.service';

@Dependencies(CreditsService)
@UseGuards(JwtAuthGuard)
@Controller('credits')
export class CreditsController {
  constructor(credits) {
    this.credits = credits;
  }

  @Get('me')
  @Params({ 0: CurrentUser('id') })
  getBalance(userId) {
    return this.credits.getBalance(userId);
  }

  @Get('me/history')
  @Params({ 0: CurrentUser('id') })
  getHistory(userId) {
    return this.credits.getHistory(userId);
  }

  @Delete('transactions/:id')
  @Params({ 0: CurrentUser('id'), 1: Param('id') })
  deleteOne(userId, id) {
    return this.credits.deleteOne(userId, id);
  }

  @Delete('transactions')
  @Params({ 0: CurrentUser('id') })
  deleteAll(userId) {
    return this.credits.deleteAll(userId);
  }
}
