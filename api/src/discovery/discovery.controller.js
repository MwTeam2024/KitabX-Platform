import { Controller, Dependencies, Get, Query, UseGuards } from '@nestjs/common';
import { Params } from '../common/decorators/params.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DiscoveryService } from './discovery.service';

/** `?genre=a&genre=b` arrives as an array, a single `?genre=a` as a string. */
function toList(value) {
  return [value].flat().filter((v) => typeof v === 'string' && v.trim() && v !== 'All').map((v) => v.trim());
}

/** A coordinate from the query string: a finite number, or undefined if absent/garbage. */
function toCoord(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

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
      // Optional "browse near here" point (a traveller's current location) —
      // when both are present it replaces the viewer's own society as the centre.
      lat: toCoord(query.lat),
      lng: toCoord(query.lng),
      genre: toList(query.genre),
      language: toList(query.language),
      condition: toList(query.condition),
      q: query.q,
      sort: query.sort,
    });
  }

  /** Every genre and language on any book, for the filters and add-book dropdowns. */
  @Get('facets')
  facets() {
    return this.discovery.facets();
  }

  /** Platform-wide totals for the home page stat tiles (§12) — never per-society. */
  @Get('stats')
  stats() {
    return this.discovery.stats();
  }
}
