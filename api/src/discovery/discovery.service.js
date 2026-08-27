import { Dependencies, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toListingLocation } from '../common/serializers/user.serializer';

/**
 * §9: same-society first, then nearby societies within a selectable radius,
 * computed by PostGIS — never by pulling every listing into Node and doing
 * distance math here. `societies.location` is a `geography(Point,4326)`
 * column Prisma Client can't select/filter through its normal query API
 * (see schema.prisma), so the radius half of this is raw SQL; the listing
 * fetch + text/genre filtering stays on the regular Prisma client.
 */
@Dependencies(PrismaService)
@Injectable()
export class DiscoveryService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async discover(viewer, { radiusKm = 0.5, genre, language, q, sort = 'newest', includeNearby = true } = {}) {
    if (!viewer.societyId) {
      return { listings: [], note: 'Join a society to see books nearby.' };
    }

    // Independent of each other — fired together instead of stacking two
    // sequential round trips to Neon.
    const [nearbySocieties, received] = await Promise.all([
      this._societiesWithinRadius(viewer.societyId, includeNearby ? radiusKm : 0),
      this.prisma.exchange.findMany({
        // A book already sitting on the viewer's own shelf shouldn't be
        // offered to them again, even as a different member's copy.
        where: { receiverId: viewer.id, status: 'COMPLETED' },
        select: { listing: { select: { bookId: true } } },
      }),
    ]);
    if (!nearbySocieties.length) {
      // No coordinates set on the society yet (e.g. a freshly admin-created
      // one) — fall back to same-society-only discovery rather than showing
      // nothing.
      nearbySocieties.push({ societyId: viewer.societyId, distanceMeters: 0 });
    }
    const distanceBySociety = new Map(nearbySocieties.map((s) => [s.societyId, s.distanceMeters]));
    const receivedBookIds = [...new Set(received.map((e) => e.listing.bookId))];

    const where = {
      status: 'ACTIVE',
      societyId: { in: [...distanceBySociety.keys()] },
      ownerId: { not: viewer.id },
      ...(receivedBookIds.length ? { bookId: { notIn: receivedBookIds } } : {}),
      ...(genre && genre !== 'All' ? { book: { genre } } : {}),
      ...(language ? { book: { languageCode: language } } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { book: { title: { contains: q.trim(), mode: 'insensitive' } } },
              { book: { author: { contains: q.trim(), mode: 'insensitive' } } },
              { book: { isbn13: { contains: q.trim() } } },
              { book: { isbn10: { contains: q.trim() } } },
            ],
          }
        : {}),
    };

    const listings = await this.prisma.bookListing.findMany({
      where,
      include: {
        book: true,
        owner: { include: { society: true, block: true } },
        photos: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : undefined,
    });

    const withDistance = listings.map((listing) => ({
      listing,
      distanceKm: Math.round((distanceBySociety.get(listing.societyId) || 0) / 100) / 10,
    }));

    if (sort === 'nearest') withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    if (sort === 'recent') withDistance.sort((a, b) => new Date(b.listing.createdAt) - new Date(a.listing.createdAt));

    return {
      listings: withDistance.map(({ listing, distanceKm }) => this._toCardDto(listing, distanceKm)),
    };
  }

  /**
   * Returns [{ societyId, distanceMeters }] for every active society within
   * `radiusKm` of the viewer's own society, using PostGIS ST_DWithin against
   * the `geography(Point,4326)` column. Societies with no location set are
   * excluded from the *nearby* expansion (there's nothing to measure from/to)
   * but the caller always falls back to the viewer's own society regardless.
   */
  async _societiesWithinRadius(originSocietyId, radiusKm) {
    if (radiusKm <= 0) {
      return this.prisma.$queryRaw`
        SELECT id AS "societyId", 0::float AS "distanceMeters"
        FROM societies WHERE id = ${originSocietyId} AND is_active = true
      `;
    }
    return this.prisma.$queryRaw`
      SELECT s.id AS "societyId", ST_Distance(s.location, origin.location) AS "distanceMeters"
      FROM societies s, (SELECT location FROM societies WHERE id = ${originSocietyId}) AS origin
      WHERE s.is_active = true
        AND s.location IS NOT NULL
        AND origin.location IS NOT NULL
        AND ST_DWithin(s.location, origin.location, ${radiusKm * 1000})
      ORDER BY "distanceMeters" ASC
    `;
  }

  /** Real, platform-wide counts — never scoped to the viewer's own society. */
  async stats() {
    const [totalBooks, totalMembers, totalSocieties] = await Promise.all([
      this.prisma.bookListing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.society.count({ where: { isActive: true } }),
    ]);
    return { totalBooks, totalMembers, totalSocieties };
  }

  _toCardDto(listing, distanceKm) {
    return {
      key: listing.id,
      bookId: listing.bookId,
      title: listing.book.title,
      author: listing.book.author,
      genre: listing.book.genre,
      cond: listing.condition,
      tags: [listing.condition, listing.book.genre].filter(Boolean),
      distanceKm,
      owner: initialsOf(listing.owner.name),
      ownerId: listing.owner.id,
      ownerName: listing.owner.name,
      loc: toListingLocation(listing.owner),
      listedDaysAgo: Math.max(0, Math.floor((Date.now() - new Date(listing.createdAt).getTime()) / 86400000)),
      photos: listing.photos.map((p) => p.imageUrl),
    };
  }
}

function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
