import { Body, Controller, Dependencies, Param, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { RatingsService } from './ratings.service';

@Dependencies(RatingsService)
@UseGuards(JwtAuthGuard)
@Controller('exchanges/:exchangeId/rating')
export class RatingsController {
  constructor(ratings) {
    this.ratings = ratings;
  }

  @Post()
  @Params({ 0: Param('exchangeId'), 1: CurrentUser('id'), 2: Body() })
  submit(exchangeId, raterId, body) {
    required(body, ['conditionAccuracy', 'communication', 'reliability']);
    return this.ratings.submit(exchangeId, raterId, body);
  }
}
