import { BadRequestException, Dependencies, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — the compressed output is far smaller.

/**
 * Cloudinary storage for book cover / condition photos. Every image is
 * re-encoded to WebP and resized with sharp before upload — nothing a phone
 * camera produces is stored unmodified.
 *
 * Until CLOUDINARY_* is configured this throws a clear 501 rather than
 * silently pretending to succeed, since a listing photo URL is user-facing
 * data that must be real once it's saved to the book_listing_photos table.
 */
@Dependencies(ConfigService)
@Injectable()
export class CloudinaryService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(CloudinaryService.name);

    const cloudName = config.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get('CLOUDINARY_API_KEY');
    const apiSecret = config.get('CLOUDINARY_API_SECRET');
    this.configured = !!(cloudName && apiKey && apiSecret);

    if (this.configured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    } else {
      this.logger.warn(
        'CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET not fully set — ' +
          'photo uploads will return 501 until Cloudinary credentials are added to .env.',
      );
    }
  }

  isConfigured() {
    return this.configured;
  }

  /**
   * @param {Buffer} buffer   raw upload from multer's memory storage
   * @param {string} folder   e.g. "listings" — keeps the account organised
   * @returns {Promise<string>} the public (secure) URL to store on the row
   */
  async uploadImage(buffer, folder = 'uploads') {
    if (!this.configured) {
      throw new InternalServerErrorException(
        'Image uploads are not configured yet — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ' +
          'and CLOUDINARY_API_SECRET in apps/api/.env.',
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

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, format: 'webp', resource_type: 'image' },
        (err, result) => (err ? reject(err) : resolve(result.secure_url)),
      );
      stream.end(optimized);
    });
  }

  async deleteImage(publicUrl) {
    if (!this.configured || !publicUrl) return;
    const publicId = this._publicIdFromUrl(publicUrl);
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch((err) => {
      this.logger.warn(`Failed to delete ${publicId} from Cloudinary: ${err.message}`);
    });
  }

  /** Cloudinary URLs look like .../image/upload/v<version>/<folder>/<id>.<ext>
   * — the public_id needed to delete an asset is that folder/id path, without
   * the version segment or file extension. */
  _publicIdFromUrl(url) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+(?:\?.*)?$/);
    return match ? match[1] : null;
  }
}
