import { BadRequestException, Dependencies, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'local-uploads');

/**
 * Fallback image storage for when Cloudflare R2 isn't configured yet — same
 * `uploadImage(buffer, folder)` shape as R2Service so the controller can pick
 * whichever backend is actually configured without the rest of the app caring.
 * Files are served back out via `app.useStaticAssets` in main.js at `/media/*`.
 */
@Dependencies(ConfigService)
@Injectable()
export class LocalStorageService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(LocalStorageService.name);
    this.publicUrl = (config.get('PUBLIC_API_URL') || `http://localhost:${config.get('PORT') || 3001}`).replace(/\/$/, '');
  }

  isConfigured() {
    return true; // always available — it's the fallback.
  }

  async uploadImage(buffer, folder = 'uploads') {
    if (!buffer?.length) throw new BadRequestException('No file uploaded');
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException('File is too large (max 10 MB)');

    const optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
      .catch(() => {
        throw new BadRequestException('Could not read that file as an image');
      });

    const dir = path.join(STORAGE_ROOT, folder);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await fs.writeFile(path.join(dir, filename), optimized);

    return `${this.publicUrl}/media/${folder}/${filename}`;
  }

  async deleteImage(publicUrl) {
    if (!publicUrl?.includes('/media/')) return;
    const relative = publicUrl.split('/media/')[1];
    if (!relative) return;
    await fs.unlink(path.join(STORAGE_ROOT, relative)).catch((err) => {
      this.logger.warn(`Failed to delete local file ${relative}: ${err.message}`);
    });
  }
}
