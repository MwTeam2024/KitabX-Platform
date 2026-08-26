import { Dependencies, Injectable } from '@nestjs/common';
import { R2Service } from './r2.service';
import { LocalStorageService } from './local-storage.service';

/**
 * Picks Cloudflare R2 when fully configured, otherwise falls back to local
 * disk storage — so "upload a photo" always works, R2 keys or not, without
 * any caller needing to know which backend actually served the request.
 */
@Dependencies(R2Service, LocalStorageService)
@Injectable()
export class StorageService {
  constructor(r2, local) {
    this.r2 = r2;
    this.local = local;
  }

  _backend() {
    return this.r2.isConfigured() ? this.r2 : this.local;
  }

  uploadImage(buffer, folder) {
    return this._backend().uploadImage(buffer, folder);
  }

  deleteImage(publicUrl) {
    // A URL always tells us which backend actually stored it, regardless of
    // which one is "active" right now (config could change between upload and delete).
    const backend = publicUrl?.includes('/media/') ? this.local : this.r2;
    return backend.deleteImage(publicUrl);
  }
}
