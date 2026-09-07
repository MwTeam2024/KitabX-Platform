import { Dependencies, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

const DEFAULT_PICKUP_POINTS = ['Security Gate', 'Reception', 'Clubhouse', 'Common Area'];
const SOCIETIES_CACHE_KEY = 'societies:list';
const SOCIETIES_CACHE_TTL_SECONDS = 60;

/**
 * City → Area → Society → Block/PickupPoint reference data (§8, Module 1/8
 * of the source plan). Also keeps `societies.location` (a PostGIS geography
 * column Prisma Client can't write directly — see discovery.service.js) in
 * sync with the plain lat/lng columns whenever they change.
 */
@Dependencies(PrismaService, RedisService)
@Injectable()
export class SocietiesService {
  constructor(prisma, redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  listCities() {
    return this.prisma.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }

  listAreas(cityId) {
    return this.prisma.area.findMany({ where: { cityId, isActive: true }, orderBy: { name: 'asc' } });
  }

  /**
   * Flat, frontend-friendly list — every active society with its city baked
   * into the label. Loaded on every signup/city-select screen but changes
   * rarely (a new society, or its member/listing counts drifting), so a
   * short cache avoids re-querying on every keystroke of the city filter.
   */
  /**
   * `verifiedOnly` hides any society still awaiting admin review from the
   * result — used by the public signup/city picker (societies.controller.js)
   * so it only ever offers already-reviewed societies. The admin's own
   * Societies list calls this with no options and sees everything,
   * including unreviewed ones, since that's exactly what needs reviewing.
   * Filtered in memory rather than in the query so both callers share the
   * one cache entry.
   */
  async listSocieties({ verifiedOnly = false } = {}) {
    const cached = await this.redis.get(SOCIETIES_CACHE_KEY);
    let dtos;
    if (cached) {
      dtos = JSON.parse(cached);
    } else {
      const societies = await this.prisma.society.findMany({
        where: { isActive: true },
        include: { area: { include: { city: true } }, _count: { select: { users: true, listings: true } } },
        orderBy: { name: 'asc' },
      });
      dtos = societies.map((s) => this._toDto(s));
      await this.redis.set(SOCIETIES_CACHE_KEY, JSON.stringify(dtos), SOCIETIES_CACHE_TTL_SECONDS);
    }
    return verifiedOnly ? dtos.filter((s) => s.verified) : dtos;
  }

  async getSociety(id) {
    const society = await this.prisma.society.findUnique({
      where: { id },
      include: {
        area: { include: { city: true } },
        blocks: { orderBy: { name: 'asc' } },
        pickupPoints: { where: { isActive: true }, orderBy: { name: 'asc' } },
        _count: { select: { users: true, listings: true } },
      },
    });
    if (!society) throw new NotFoundException('Society not found');
    return this._toDto(society, { withBlocks: true, withPickupPoints: true });
  }

  /** Any write outside this service that flips a Society's cached fields
   * (e.g. admin.service.js's removeSociety toggling isActive) must call this
   * or listSocieties() will keep serving the pre-write snapshot until the
   * TTL expires. */
  invalidateCache() {
    return this.redis.del(SOCIETIES_CACHE_KEY);
  }

  listBlocks(societyId) {
    return this.prisma.societyBlock.findMany({ where: { societyId }, orderBy: { name: 'asc' } });
  }

  listPickupPoints(societyId) {
    return this.prisma.societyPickupPoint.findMany({
      where: { societyId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ---- admin ----

  /** Admin's "Add Society" form only collects name + city (see admin/societies
   * page) — find-or-create the City/Area chain rather than requiring the
   * admin to manage geography IDs by hand. */
  async adminCreateSociety({ name, cityName, stateName, address, latitude, longitude, verified }) {
    const city = await this._findOrCreateCity(cityName, stateName);
    const area = await this._findOrCreateArea(city.id, cityName);

    const society = await this.prisma.society.create({
      data: {
        name, address, areaId: area.id, latitude: latitude ?? null, longitude: longitude ?? null,
        verified: verified ?? true,
      },
    });
    await this.prisma.societyPickupPoint.createMany({
      data: DEFAULT_PICKUP_POINTS.map((pointName) => ({ societyId: society.id, name: pointName })),
    });
    if (latitude != null && longitude != null) await this._syncLocation(society.id, latitude, longitude);

    await this.redis.del(SOCIETIES_CACHE_KEY);
    return this.getSociety(society.id);
  }

  async adminUpdateSociety(id, updates) {
    const data = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.address !== undefined) data.address = updates.address;
    if (updates.isActive !== undefined) data.isActive = updates.isActive;
    if (updates.verified !== undefined) data.verified = updates.verified;

    if (updates.cityName) {
      const city = await this._findOrCreateCity(updates.cityName, updates.stateName);
      const area = await this._findOrCreateArea(city.id, updates.cityName);
      data.areaId = area.id;
    }

    await this.prisma.society.update({ where: { id }, data });

    if (updates.latitude != null && updates.longitude != null) {
      await this._syncLocation(id, updates.latitude, updates.longitude);
    }
    await this.redis.del(SOCIETIES_CACHE_KEY);
    return this.getSociety(id);
  }

  async _findOrCreateCity(name, state) {
    const existing = await this.prisma.city.findFirst({ where: { name } });
    if (existing) return existing;
    return this.prisma.city.create({ data: { name, state: state || null } });
  }

  async _findOrCreateArea(cityId, name) {
    // MVP simplification: one catch-all Area per City named after the city
    // itself, since the admin UI collects only a society name + city — a
    // real area picker can be layered on without changing this service's
    // public shape.
    const areaName = `${name} (General)`;
    const existing = await this.prisma.area.findFirst({ where: { cityId, name: areaName } });
    if (existing) return existing;
    return this.prisma.area.create({ data: { cityId, name: areaName } });
  }

  async _syncLocation(societyId, latitude, longitude) {
    await this.prisma.$executeRaw`
      UPDATE societies
      SET latitude = ${latitude}, longitude = ${longitude},
          location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      WHERE id = ${societyId}
    `;
  }

  _toDto(society, { withBlocks, withPickupPoints } = {}) {
    return {
      id: society.id,
      name: society.name,
      address: society.address,
      city: society.area?.city ? { id: society.area.city.id, name: society.area.city.name } : null,
      area: society.area ? { id: society.area.id, name: society.area.name } : null,
      label: society.area?.city ? `${society.name}, ${society.area.city.name}` : society.name,
      latitude: society.latitude,
      longitude: society.longitude,
      verified: society.verified,
      memberCount: society._count?.users ?? 0,
      activeListingCount: society._count?.listings ?? 0,
      blocks: withBlocks ? society.blocks : undefined,
      pickupPoints: withPickupPoints ? society.pickupPoints : undefined,
    };
  }
}
