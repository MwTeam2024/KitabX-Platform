import { Dependencies, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';

const CACHE_TTL_SECONDS = 60 * 60 * 24; // §7: cache ISBN lookups in Redis.

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

    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}${this._apiKeyParam()}`;
    const data = await this._fetchJson(url);
    const item = data?.items?.[0];
    if (!item) throw new NotFoundException('No book found for that ISBN');

    const normalized = this._normalize(item, isbn);
    await this.redis.set(cacheKey, JSON.stringify(normalized), CACHE_TTL_SECONDS);
    return normalized;
  }

  async searchByTitleOrAuthor(query, { limit = 10 } = {}) {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${limit}${this._apiKeyParam()}`;
    const data = await this._fetchJson(url);
    return (data?.items || []).map((item) => this._normalize(item));
  }

  async _fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
      this.logger.warn(`Google Books request failed: ${res.status}`);
      return null;
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
}
