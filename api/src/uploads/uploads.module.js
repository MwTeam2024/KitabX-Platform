import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { R2Service } from './r2.service';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [UploadsController],
  providers: [R2Service, LocalStorageService, StorageService],
  exports: [R2Service, StorageService],
})
export class UploadsModule {}
