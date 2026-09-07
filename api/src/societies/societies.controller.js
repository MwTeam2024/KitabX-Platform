import { Controller, Dependencies, Get, Param } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { SocietiesService } from './societies.service';

/** Public reference data — needed on the signup form before a session exists. */
@Dependencies(SocietiesService)
@Controller()
export class SocietiesController {
  constructor(societies) {
    this.societies = societies;
  }

  @Get('cities')
  listCities() {
    return this.societies.listCities();
  }

  @Get('cities/:cityId/areas')
  @Params({ 0: Param('cityId') })
  listAreas(cityId) {
    return this.societies.listAreas(cityId);
  }

  @Get('societies')
  listSocieties() {
    // Only reviewed societies — one a member just requested via "Don't see
    // your city or society?" isn't offered to anyone else until an admin
    // approves it (see societies.service.js#listSocieties).
    return this.societies.listSocieties({ verifiedOnly: true });
  }

  @Get('societies/:id')
  @Params({ 0: Param('id') })
  getSociety(id) {
    return this.societies.getSociety(id);
  }

  @Get('societies/:id/blocks')
  @Params({ 0: Param('id') })
  listBlocks(id) {
    return this.societies.listBlocks(id);
  }

  @Get('societies/:id/pickup-points')
  @Params({ 0: Param('id') })
  listPickupPoints(id) {
    return this.societies.listPickupPoints(id);
  }
}
