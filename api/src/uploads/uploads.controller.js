import { Controller, Dependencies, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Params } from '../common/decorators/params.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CloudinaryService } from './cloudinary.service';

/**
 * Generic authenticated image upload. The frontend calls this once per photo
 * (cover + up to 2 condition photos — 3 total, enforced in listings.service.js
 * when the URLs are attached to a listing) and stores the returned URL.
 */
@Dependencies(CloudinaryService)
@Controller('uploads')
export class UploadsController {
  constructor(cloudinary) {
    this.cloudinary = cloudinary;
  }

  @UseGuards(JwtAuthGuard)
  @Post('listing-photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @Params({ 0: UploadedFile() })
  async uploadListingPhoto(file) {
    const url = await this.cloudinary.uploadImage(file?.buffer, 'listings');
    return { url };
  }
}
