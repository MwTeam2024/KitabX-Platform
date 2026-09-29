import { Dependencies, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';

const CACHE_TTL_SECONDS = 60 * 60 * 24; // §7: cache ISBN lookups in Redis.

// Open Library's default search response omits isbn (and some of the other
// fields we need) unless explicitly asked for.
const OPEN_LIBRARY_SEARCH_FIELDS = 'title,subtitle,author_name,cover_i,first_publish_year,isbn,publisher,subject,language,number_of_pages_median';

/**
 * Google Books lookups happen server-side (§7, §18) so the API key — when one
 * is configured — never reaches the browser. The public Google Books endpoint
 * also works without a key at low request volume, so ISBN lookup and search
 * both function immediately; GOOGLE_BOOKS_API_KEY only raises the quota.
 */
@Dependencies(ConfigService, RedisService)
@Injectable()
export class GoogleBooksService {
  constructor(config, redis) {
    this.config = config;
    this.redis = redis;
    this.logger = new Logger(GoogleBooksService.name);
  }

  _apiKeyParam() {
    const key = this.config.get('GOOGLE_BOOKS_API_KEY');
    return key ? `&key=${encodeURIComponent(key)}` : '';
  }

  async lookupByIsbn(isbn) {
    const cacheKey = `googlebooks:isbn:${isbn}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Try Google Books first; only reach for Open Library — a second, free,
    // no-key-needed catalog — when Google Books has nothing (or is itself
    // erroring out), so a normal successful lookup pays no extra latency.
    const normalized = (await this._lookupGoogleBooksIsbn(isbn)) || (await this._lookupOpenLibraryIsbn(isbn));
    if (!normalized) throw new NotFoundException('No book found for that ISBN');

    await this.redis.set(cacheKey, JSON.stringify(normalized), CACHE_TTL_SECONDS);
    return normalized;
  }

  async _lookupGoogleBooksIsbn(isbn) {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${this._apiKeyParam()}`;
      const data = await this._fetchJson(url);
      const item = data?.items?.[0];
      return item ? this._normalize(item, isbn) : null;
    } catch (err) {
      this.logger.warn(`Google Books ISBN lookup failed, falling back to Open Library: ${err.message}`);
      return null;
    }
  }

  async _lookupOpenLibraryIsbn(isbn) {
    try {
      const url = `https://openlibrary.org/api/books.json?bibkeys=ISBN:${encodeURIComponent(isbn)}&jscmd=data&format=json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const entry = data?.[`ISBN:${isbn}`];
      return entry ? this._normalizeOpenLibrary(entry, isbn) : null;
    } catch (err) {
      this.logger.warn(`Open Library ISBN lookup failed: ${err.message}`);
      return null;
    }
  }

  async searchByTitleOrAuthor(query, { limit = 10 } = {}) {
    // Same reasoning as lookupByIsbn: try Google Books first, and only reach
    // for Open Library when Google Books has no matches (or is erroring out).
    const googleResults = await this._searchGoogleBooks(query, limit);
    if (googleResults.length) return googleResults;
    return this._searchOpenLibrary(query, limit);
  }

  /**
   * For callers (Gemini candidate matching) that already know title and
   * author as separate, distinct fields — as opposed to the free-text
   * `searchByTitleOrAuthor` above, meant for a person typing one query box.
   * Google's `intitle:`/`inauthor:` field operators score far more
   * precisely than a bare "title author" keyword soup: confirmed live that
   * the same book which came back as a wrong same-series title via the
   * plain search matched exactly right once title/author were scoped this
   * way. Falls back to the plain combined-string search when the scoped
   * query comes back empty — a real book occasionally isn't indexed with
   * fields clean enough for `intitle`/`inauthor` to hit (unconventional
   * author formatting, a subtitle folded into the main title, etc.).
   */
  async searchByTitleAndAuthor(title, author, { limit = 10 } = {}) {
    const scoped = [`intitle:"${title}"`, author && `inauthor:"${author}"`].filter(Boolean).join(' ');
    const scopedResults = await this._searchGoogleBooks(scoped, limit);
    if (scopedResults.length) return scopedResults;

    // Open Library has its own separate `title=`/`author=` params (not
    // Google's `intitle:`/`inauthor:` syntax) — confirmed live that it's
    // just as precise there: the same title/author scoping that fixed the
    // Google Books mismatch also returned exactly one, correct match on
    // Open Library. Tried here, before falling all the way back to the
    // loose combined-string search on both.
    const structuredOpenLibraryResults = await this._searchOpenLibraryStructured(title, author, limit);
    if (structuredOpenLibraryResults.length) return structuredOpenLibraryResults;

    return this.searchByTitleOrAuthor(`${title} ${author || ''}`.trim(), { limit });
  }

  async _searchGoogleBooks(query, limit) {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${limit}${this._apiKeyParam()}`;
      const data = await this._fetchJson(url);
      return (data?.items || []).map((item) => this._normalize(item));
    } catch (err) {
      this.logger.warn(`Google Books search failed, falling back to Open Library: ${err.message}`);
      return [];
    }
  }

  async _searchOpenLibrary(query, limit) {
    return this._fetchOpenLibrarySearch(
      `q=${encodeURIComponent(query)}`,
      limit,
      'Open Library search failed',
    );
  }

  /**
   * Open Library's own separate `title=`/`author=` params, as opposed to
   * `_searchOpenLibrary`'s single free-text `q=` — the same precision gain
   * as Google's `intitle:`/`inauthor:`, confirmed live: the exact
   * title/author pair that fixed the Google Books same-series mismatch
   * also returned one correct match here instead of the noisier results a
   * bare keyword search can turn up.
   */
  async _searchOpenLibraryStructured(title, author, limit) {
    const params = [`title=${encodeURIComponent(title)}`, author && `author=${encodeURIComponent(author)}`].filter(Boolean).join('&');
    return this._fetchOpenLibrarySearch(params, limit, 'Open Library structured search failed');
  }

  async _fetchOpenLibrarySearch(queryParams, limit, warnMessage) {
    try {
      const url = `https://openlibrary.org/search.json?${queryParams}&limit=${limit}&fields=${OPEN_LIBRARY_SEARCH_FIELDS}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.docs || []).map((doc) => this._normalizeOpenLibrarySearchDoc(doc));
    } catch (err) {
      this.logger.warn(`${warnMessage}: ${err.message}`);
      return [];
    }
  }

  async _fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // A non-2xx here means Google Books itself is unreachable/misconfigured
      // (bad or missing API key, quota exhausted) — genuinely distinct from
      // "the book doesn't exist", which is an empty `items` array on a 200.
      // Swallowing this into a plain [] made a missing GOOGLE_BOOKS_API_KEY
      // indistinguishable from "no results found" everywhere this is called.
      this.logger.error(`Google Books request failed (${res.status}): ${body.slice(0, 300)}`);
      throw new ServiceUnavailableException('Book lookup service is temporarily unavailable. Try again shortly or enter details manually.');
    }
    return res.json();
  }

  _normalize(item, fallbackIsbn) {
    const info = item.volumeInfo || {};
    const identifiers = info.industryIdentifiers || [];
    const isbn13 = identifiers.find((i) => i.type === 'ISBN_13')?.identifier || null;
    const isbn10 = identifiers.find((i) => i.type === 'ISBN_10')?.identifier || null;

    return {
      googleBooksId: item.id,
      title: info.title || 'Untitled',
      subtitle: info.subtitle || null,
      author: (info.authors || []).join(', ') || 'Unknown Author',
      description: info.description || null,
      publisher: info.publisher || null,
      publicationYear: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) || null : null,
      pageCount: info.pageCount || null,
      coverImageUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
      languageCode: info.language || null,
      genre: info.categories?.[0] || null,
      isbn13: isbn13 || (fallbackIsbn?.length === 13 ? fallbackIsbn : null),
      isbn10: isbn10 || (fallbackIsbn?.length === 10 ? fallbackIsbn : null),
    };
  }

  _normalizeOpenLibrary(entry, fallbackIsbn) {
    const isbn13 = entry.identifiers?.isbn_13?.[0] || null;
    const isbn10 = entry.identifiers?.isbn_10?.[0] || null;
    const publishYear = entry.publish_date ? parseInt(String(entry.publish_date).slice(-4), 10) : null;

    return {
      googleBooksId: null,
      title: entry.title || 'Untitled',
      subtitle: entry.subtitle || null,
      author: (entry.authors || []).map((a) => a.name).join(', ') || 'Unknown Author',
      description: null,
      publisher: entry.publishers?.[0]?.name || null,
      publicationYear: Number.isNaN(publishYear) ? null : publishYear,
      pageCount: entry.number_of_pages || null,
      coverImageUrl: entry.cover?.large || entry.cover?.medium || entry.cover?.small || null,
      languageCode: null,
      genre: entry.subjects?.[0]?.name || null,
      isbn13: isbn13 || (fallbackIsbn?.length === 13 ? fallbackIsbn : null),
      isbn10: isbn10 || (fallbackIsbn?.length === 10 ? fallbackIsbn : null),
    };
  }

  _normalizeOpenLibrarySearchDoc(doc) {
    const isbns = doc.isbn || [];
    return {
      googleBooksId: null,
      title: doc.title || 'Untitled',
      subtitle: doc.subtitle || null,
      author: (doc.author_name || []).join(', ') || 'Unknown Author',
      description: null,
      publisher: doc.publisher?.[0] || null,
      publicationYear: doc.first_publish_year || null,
      pageCount: doc.number_of_pages_median || null,
      coverImageUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
      languageCode: doc.language?.[0] || null,
      genre: doc.subject?.[0] || null,
      isbn13: isbns.find((i) => i.length === 13) || null,
      isbn10: isbns.find((i) => i.length === 10) || null,
    };
  }
}
