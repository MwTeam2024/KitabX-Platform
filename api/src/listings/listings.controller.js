import { Body, Controller, Delete, Dependencies, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard, OptionalAuthGuard } from '../common/guards/jwt-auth.guard';
import { required } from '../common/validate';
import { ListingsService } from './listings.service';

@Dependencies(ListingsService)
@Controller('listings')
export class ListingsController {
  constructor(listings) {
    this.listings = listings;
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  @Params({ 0: CurrentUser('id') })
  listMine(ownerId) {
    return this.listings.listMine(ownerId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('received')
  @Params({ 0: CurrentUser('id') })
  listReceived(userId) {
    return this.listings.listReceived(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @Params({ 0: CurrentUser('id'), 1: Body() })
  create(ownerId, body) {
    required(body, ['condition', 'book']);
    required(body.book, ['title', 'author']);
    return this.listings.createListing(ownerId, body);
  }

  @UseGuards(OptionalAuthGuard)
  @Get(':id')
  @Params({ 0: Param('id'), 1: CurrentUser('id') })
  getOne(id, viewerId) {
    return this.listings.getListing(id, { viewerId });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @Params({ 0: Param('id'), 1: CurrentUser('id'), 2: Body() })
  update(id, ownerId, body) {
    return this.listings.updateListing(id, ownerId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/pause')
  @Params({ 0: Param('id'), 1: CurrentUser('id'), 2: Body() })
  setPaused(id, ownerId, body) {
    required(body, ['paused']);
    return this.listings.setPaused(id, ownerId, !!body.paused);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @Params({ 0: Param('id'), 1: CurrentUser('id') })
  remove(id, ownerId) {
    return this.listings.removeListing(id, ownerId);
  }
}
