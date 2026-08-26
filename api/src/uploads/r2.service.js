import { BadRequestException, Dependencies, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — the compressed output is far smaller.

/**
 * Cloudflare R2 (S3-compatible) storage for book cover / condition photos.
 * Every image is re-encoded to WebP and resized with sharp before upload —
 * that's the "image optimization" the frontend requirement asks for; nothing
 * a phone camera produces is stored unmodified.
 *
 * Until R2_* is configured this throws a clear 501 rather than silently
 * pretending to succeed, since a listing photo URL is user-facing data that
 * must be real once it's saved to the book_listing_photos table.
 */
@Dependencies(ConfigService)
@Injectable()
export class R2Service {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(R2Service.name);
    this.bucket = config.get('R2_BUCKET_NAME') || 'kitabx-uploads';
    this.publicUrl = (config.get('R2_PUBLIC_URL') || '').replace(/\/$/, '');

    const accountId = config.get('R2_ACCOUNT_ID');
    const accessKeyId = config.get('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get('R2_SECRET_ACCESS_KEY');
    this.configured = !!(accountId && accessKeyId && secretAccessKey && this.publicUrl);

    if (this.configured) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn(
        'R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_PUBLIC_URL not fully set — ' +
          'photo uploads will return 501 until Cloudflare R2 credentials are added to .env.',
      );
    }
  }

  isConfigured() {
    return this.configured;
  }

  /**
   * @param {Buffer} buffer   raw upload from multer's memory storage
   * @param {string} folder   e.g. "listings" — keeps the bucket organised
   * @returns {Promise<string>} the public URL to store on the row
   */
  async uploadImage(buffer, folder = 'uploads') {
    if (!this.configured) {
      throw new InternalServerErrorException(
        'Image uploads are not configured yet — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
          'R2_SECRET_ACCESS_KEY and R2_PUBLIC_URL in apps/api/.env.',
      );
    }
    if (!buffer?.length) throw new BadRequestException('No file uploaded');
    if (buffer.length > MAX_UPLOAD_BYTES) throw new BadRequestException('File is too large (max 10 MB)');

    const optimized = await sharp(buffer)
      .rotate() // respects EXIF orientation from phone cameras
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
      .catch(() => {
        throw new BadRequestException('Could not read that file as an image');
      });

    const key = `${folder}/${randomUUID()}.webp`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  async deleteImage(publicUrl) {
    if (!this.configured || !publicUrl?.startsWith(this.publicUrl)) return;
    const key = publicUrl.slice(this.publicUrl.length + 1);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch((err) => {
      this.logger.warn(`Failed to delete ${key} from R2: ${err.message}`);
    });
  }
}
