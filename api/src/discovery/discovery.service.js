import { Dependencies, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { toBookListingLocation } from '../common/serializers/user.serializer';
import { DEFAULT_LANGUAGES, OTHERS, languageName } from '../common/languages';

const STATS_CACHE_KEY = 'discovery:stats';
const STATS_CACHE_TTL_SECONDS = 30;
// Admin Settings toggle (AppSetting row, 'true'/'false') for the Discover stat tiles.
const SHOW_STATS_SETTING_KEY = 'showDiscoveryStats';
const NEVER_MATCHES = '00000000-0000-0000-0000-000000000000';
const POPULAR_COUNT = 6;

/** "Non-fiction", "Nonfiction", "non fiction" and "NON-FICTION" are one genre. */
const genreKey = (g) => String(g ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * §9: same-society first, then nearby societies within a selectable radius,
 * computed by PostGIS — never by pulling every listing into Node and doing
 * distance math here. `societies.location` is a `geography(Point,4326)`
 * column Prisma Client can't select/filter through its normal query API
 * (see schema.prisma), so the radius half of this is raw SQL; the listing
 * fetch + text/genre filtering stays on the regular Prisma client.
 */
@Dependencies(PrismaService, RedisService)
@Injectable()
export class DiscoveryService {
  constructor(prisma, redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  async discover(viewer, { radiusKm = 0.5, genre = [], language = [], condition = [], q, sort = 'newest' } = {}) {
    if (!viewer.societyId) {
      return { listings: [], note: 'Join a society to see books nearby.' };
    }

    // Independent of each other — fired together instead of stacking two
    // sequential round trips to Neon.
    const [nearbySocieties, received] = await Promise.all([
      this._societiesWithinRadius(viewer.societyId, radiusKm),
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

    // Each of genre/language/condition takes several values (any of them
    // matches; the three groups are ANDed together). They go into one
    // `AND` list — `q` below already owns the `OR` key, and `genre`/`language`
    // both narrow the related `book` row, so spreading them as separate
    // `book: {...}` keys would clobber each other.
    const bookAnd = [];
    const genreOr = await this._genreMatches(genre);
    if (genreOr.length) bookAnd.push({ OR: genreOr });
    const languageOr = await this._languageMatches(language);
    if (languageOr.length) bookAnd.push({ OR: languageOr });

    // `condition` lives on the listing itself, not the book. Case-
    // insensitive because real data has both "Good" and "GOOD" — an exact
    // match would silently miss whichever casing the filter isn't.
    const conditionOr = condition.map((c) => ({ condition: { equals: c, mode: 'insensitive' } }));

    const where = {
      status: 'ACTIVE',
      societyId: { in: [...distanceBySociety.keys()] },
      ownerId: { not: viewer.id },
      ...(receivedBookIds.length ? { bookId: { notIn: receivedBookIds } } : {}),
      ...(bookAnd.length ? { book: { AND: bookAnd } } : {}),
      ...(conditionOr.length ? { AND: [{ OR: conditionOr }] } : {}),
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
        society: true,
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

  /** Genres come straight from Google Books / Open Library, so the same one
   * turns up as "Fiction", "fiction" or "Non-fiction"/"Nonfiction" — a chosen
   * genre matches every stored spelling of it. "Others" is also every book
   * that has no genre at all. */
  async _genreMatches(genres) {
    if (!genres.length) return [];
    const wanted = new Set(genres.map(genreKey));
    const rows = await this.prisma.book.groupBy({ by: ['genre'], where: { genre: { not: null } } });
    const out = rows
      .map((r) => r.genre)
      .filter((raw) => raw.trim() && wanted.has(genreKey(raw)))
      .map((raw) => ({ genre: { equals: raw, mode: 'insensitive' } }));
    if (wanted.has(genreKey(OTHERS))) out.push({ genre: null }, { genre: '' });
    // A genre nobody has stored matches nothing (an empty list would read as "no filter").
    return out.length ? out : [{ id: NEVER_MATCHES }];
  }

  /** `languageCode` holds "en", "eng" or "English" depending on where the
   * book came from, so a language name is expanded to every stored spelling
   * that resolves to it. */
  async _languageMatches(languages) {
    if (!languages.length) return [];
    const wanted = new Set(languages.map((l) => (languageName(l) || l).toLowerCase()));
    const rows = await this.prisma.book.groupBy({ by: ['languageCode'], where: { languageCode: { not: null } } });
    const spellings = rows
      .map((r) => r.languageCode)
      .filter((raw) => raw.trim() && wanted.has((languageName(raw) || '').toLowerCase()));
    const out = spellings.map((raw) => ({ languageCode: { equals: raw, mode: 'insensitive' } }));
    if (wanted.has(OTHERS.toLowerCase())) {
      out.push({ languageCode: null }, { languageCode: '' }, { languageCode: { equals: OTHERS, mode: 'insensitive' } });
    }
    // A language nobody has stored yet (Hindi on day one) must match nothing —
    // an empty list here would read as "no language filter" and show everything.
    return out.length ? out : [{ id: NEVER_MATCHES }];
  }

  /** Every genre and language that exists on any book — drives the Discover
   * filters and the add-book dropdowns, so a new one from a scan shows up
   * everywhere on its own. Duplicates that differ only by case/spelling are
   * merged, and "Others" is always last. */
  async facets() {
    const [genreRows, languageRows] = await Promise.all([
      this.prisma.book.groupBy({ by: ['genre'], where: { genre: { not: null } }, _count: { _all: true } }),
      this.prisma.book.groupBy({ by: ['languageCode'], where: { languageCode: { not: null } }, _count: { _all: true } }),
    ]);

    // One entry per genre (ignoring case, hyphens, spacing), shown the way most books spell it.
    const byKey = new Map();
    for (const row of genreRows) {
      const label = row.genre.trim();
      const key = genreKey(label);
      if (!key || key === genreKey(OTHERS)) continue;
      const entry = byKey.get(key) || { total: 0, best: label, bestCount: 0 };
      entry.total += row._count._all;
      if (row._count._all > entry.bestCount) { entry.best = label; entry.bestCount = row._count._all; }
      byKey.set(key, entry);
    }
    const entries = [...byKey.values()];
    const genres = entries.map((e) => e.best).sort((a, b) => a.localeCompare(b));
    // The handful with the most books — what the filter sheet shows as chips before "View all".
    const popularGenres = [...entries].sort((a, b) => b.total - a.total || a.best.localeCompare(b.best)).slice(0, POPULAR_COUNT).map((e) => e.best);

    const langCounts = new Map();
    for (const r of languageRows) {
      const name = languageName(r.languageCode);
      if (name && name !== OTHERS) langCounts.set(name, (langCounts.get(name) || 0) + r._count._all);
    }
    const extra = [...langCounts.keys()].filter((n) => !DEFAULT_LANGUAGES.includes(n)).sort((a, b) => a.localeCompare(b));
    const languages = [...DEFAULT_LANGUAGES, ...extra];
    const popularLanguages = [...languages]
      .sort((a, b) => (langCounts.get(b) || 0) - (langCounts.get(a) || 0) || languages.indexOf(a) - languages.indexOf(b))
      .slice(0, POPULAR_COUNT);

    return {
      genres: [...genres, OTHERS],
      languages: [...languages, OTHERS],
      popularGenres,
      popularLanguages,
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
  /** Platform-wide, loaded on every home-screen visit — a few seconds of
   * staleness on a "total books/members/societies" counter is unnoticeable,
   * so cache it rather than running 3 COUNTs on every load. */
  async stats() {
    // Read fresh every time (not cached with the counts below) so an admin
    // flipping the toggle takes effect on the next load. Off by default —
    // totals this small on a young platform read as empty, not impressive.
    const flag = await this.prisma.appSetting.findUnique({ where: { key: SHOW_STATS_SETTING_KEY } });
    if (flag?.value !== 'true') return { show: false };

    const cached = await this.redis.get(STATS_CACHE_KEY);
    if (cached) return { show: true, ...JSON.parse(cached) };

    const [totalBooks, totalMembers, totalSocieties] = await Promise.all([
      this.prisma.bookListing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.society.count({ where: { isActive: true } }),
    ]);
    const result = { totalBooks, totalMembers, totalSocieties };
    await this.redis.set(STATS_CACHE_KEY, JSON.stringify(result), STATS_CACHE_TTL_SECONDS);
    return { show: true, ...result };
  }

  _toCardDto(listing, distanceKm) {
    return {
      key: listing.id,
      bookId: listing.bookId,
      title: listing.book.title,
      author: listing.book.author,
      genre: listing.book.genre || OTHERS,
      cond: listing.condition,
      tags: [listing.condition, listing.book.genre || OTHERS].filter(Boolean),
      distanceKm,
      owner: initialsOf(listing.owner.name),
      ownerId: listing.owner.id,
      ownerName: listing.owner.name,
      loc: toBookListingLocation(listing),
      listedDaysAgo: Math.max(0, Math.floor((Date.now() - new Date(listing.createdAt).getTime()) / 86400000)),
      photos: listing.photos.map((p) => p.imageUrl),
    };
  }
}

function initialsOf(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
