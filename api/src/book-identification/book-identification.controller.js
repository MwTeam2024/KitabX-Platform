import {
  BadRequestException,
  Controller,
  Dependencies,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Params } from '../common/decorators/params.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GoogleBooksService } from './google-books.service';
import { GeminiService } from './gemini.service';

@Dependencies(GoogleBooksService, GeminiService)
@UseGuards(JwtAuthGuard)
@Controller('book-identification')
export class BookIdentificationController {
  constructor(googleBooks, gemini) {
    this.googleBooks = googleBooks;
    this.gemini = gemini;
  }

  @Get('isbn')
  @Params({ 0: Query('isbn') })
  lookupIsbn(isbn) {
    if (!isbn) throw new BadRequestException('isbn query param is required');
    return this.googleBooks.lookupByIsbn(isbn.replace(/[^0-9Xx]/g, ''));
  }

  @Get('search')
  @Params({ 0: Query('q') })
  search(q) {
    if (!q?.trim()) throw new BadRequestException('q query param is required');
    return this.googleBooks.searchByTitleOrAuthor(q.trim());
  }

  /**
   * §6B — one photo, many books. Gemini extracts candidates; each is then
   * matched against Google Books so the frontend never shows Gemini's raw
   * (unverified) guess as if it were confirmed metadata.
   */
  @Post('image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @Params({ 0: UploadedFile() })
  async extractFromImage(file) {
    if (!file?.buffer) throw new BadRequestException('image file is required');

    const candidates = await this.gemini.extractBooksFromImage(file.buffer, file.mimetype);

    const matched = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          if (candidate.isbn) {
            return { ...(await this.googleBooks.lookupByIsbn(candidate.isbn)), confidence: candidate.confidence };
          }
          const results = await this.googleBooks.searchByTitleAndAuthor(
            candidate.title,
            candidate.author,
            { limit: 1 },
          );
          const match = results[0];
          if (!match) return { ...candidate, confidence: 'low', unmatched: true };
          return {
            ...match,
            // The catalog match is preferred (more complete/accurately
            // formatted than Gemini's own read), but a fuzzy title search
            // can land on the wrong book in the same series — one that's
            // real but missing its own author in Google Books/Open
            // Library's data. Confirmed live: Gemini correctly read the
            // author straight off the cover in that exact case, so falling
            // back to it here beats surfacing "Unknown Author" for a book
            // whose author was clearly legible in the photo.
            author: (!match.author || match.author === 'Unknown Author') && candidate.author
              ? candidate.author
              : match.author,
            confidence: candidate.confidence,
          };
        } catch {
          return { ...candidate, confidence: 'low', unmatched: true };
        }
      }),
    );

    return { candidates: matched };
  }
}
