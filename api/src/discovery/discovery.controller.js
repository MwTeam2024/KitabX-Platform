import { Controller, Dependencies, Get, Query, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DiscoveryService } from './discovery.service';

@Dependencies(DiscoveryService)
@UseGuards(JwtAuthGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(discovery) {
    this.discovery = discovery;
  }

  @Get()
  @Params({ 0: CurrentUser(), 1: Query() })
  discover(viewer, query) {
    return this.discovery.discover(viewer, {
      radiusKm: query.radiusKm ? parseFloat(query.radiusKm) : undefined,
      genre: query.genre,
      language: query.language,
      condition: query.condition,
      q: query.q,
      sort: query.sort,
      includeNearby: query.includeNearby !== 'false',
    });
  }

  /** Platform-wide totals for the home page stat tiles (§12) — never per-society. */
  @Get('stats')
  stats() {
    return this.discovery.stats();
  }
}
