import { Module } from '@nestjs/common';
import { BookIdentificationController } from './book-identification.controller';
import { GoogleBooksService } from './google-books.service';
import { GeminiService } from './gemini.service';

@Module({
  controllers: [BookIdentificationController],
  providers: [GoogleBooksService, GeminiService],
  exports: [GoogleBooksService, GeminiService],
})
export class BookIdentificationModule {}
