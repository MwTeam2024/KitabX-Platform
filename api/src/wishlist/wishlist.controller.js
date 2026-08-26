import { Body, Controller, Delete, Dependencies, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { WishlistService } from './wishlist.service';

@Dependencies(WishlistService)
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(wishlist) {
    this.wishlist = wishlist;
  }

  @Get()
  @Params({ 0: CurrentUser('id') })
  list(userId) {
    return this.wishlist.list(userId);
  }

  @Post()
  @Params({ 0: CurrentUser('id'), 1: Body() })
  add(userId, body) {
    required(body, ['bookId']);
    return this.wishlist.add(userId, body.bookId);
  }

  @Delete(':bookId')
  @Params({ 0: CurrentUser('id'), 1: Param('bookId') })
  remove(userId, bookId) {
    return this.wishlist.remove(userId, bookId);
  }
}
