import { Dependencies, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Multi-book photo extraction (§6B, §7). Gemini is explicitly an extraction
 * aid, never authoritative metadata — every candidate it returns still goes
 * through GoogleBooksService to match/normalize before the frontend shows it
 * (see book-identification.controller.js). Requires GEMINI_API_KEY; without
 * it, this throws a clear 503 rather than fabricating results.
 */
@Dependencies(ConfigService)
@Injectable()
export class GeminiService {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(GeminiService.name);
  }

  isConfigured() {
    return !!this.config.get('GEMINI_API_KEY');
  }

  /** @param {Buffer} imageBuffer @param {string} mimeType */
  async extractBooksFromImage(imageBuffer, mimeType) {
    const apiKey = this.config.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Bulk photo scanning needs GEMINI_API_KEY in apps/api/.env — use manual entry or search until it is set.',
      );
    }

    // Recognize the book from its cover design/layout even when the text
    // itself is small, angled or partly blurred — this was previously the
    // main cause of "nothing detected": the old prompt told the model to
    // report only text it could literally read, so any photo that wasn't a
    // crisp straight-on shot came back empty. Visual-recognition guesses are
    // still explicitly tagged "low" so the review screen never overstates them.
    const prompt = [
      'You are looking at a photo of one or more physical books (covers, spines, or a stack).',
      'Identify every distinct book you can find. For each one, use BOTH the legible text AND the',
      "cover's visual design (color, layout, artwork, typography) to recognize it — well-known covers",
      'are often identifiable even when the title text is small, angled, partly occluded or blurry.',
      'Do not skip a book just because the text is hard to read; make your best identification from the',
      'cover art and mark it "low" confidence instead. Only omit a book entirely if you truly cannot',
      'tell what it is. Never invent an ISBN — leave it blank unless it is actually printed and legible.',
      'Return one entry per distinct book, in the JSON format defined by the response schema.',
    ].join(' ');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBuffer.toString('base64') } },
            ],
          },
        ],
        generationConfig: {
          // Structured output — the API guarantees a schema-conforming JSON
          // body with no wrapping prose/markdown fences, which is both more
          // reliable to parse than regex-extracting a JSON array out of free
          // text and faster (no wasted prose tokens to generate).
          responseMimeType: 'application/json',
          responseSchema: BOOK_CANDIDATES_SCHEMA,
          // Low temperature suits this extraction task (we want the model's
          // best single read, not creative variation) and converges faster.
          temperature: 0.1,
          maxOutputTokens: 2048,
          // gemini-3.6-flash thinks by default (it can't be turned off
          // entirely — thinkingBudget: 0 is rejected as invalid for this
          // model) — confirmed live that left at its default this single
          // call took over 13 seconds for what is, at bottom, a straight
          // vision-recognition task rather than something needing deep
          // chain-of-thought. Capping it to LOW cut that to ~3 seconds with
          // no code-visible change in output quality on the same test image.
          thinkingConfig: { thinkingLevel: 'LOW' },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Gemini request failed (${res.status}): ${text}`);
      throw new ServiceUnavailableException('Could not analyze that photo right now — try again shortly.');
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    return this._parseCandidates(text);
  }

  _parseCandidates(text) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.filter((c) => c?.title) : [];
    } catch {
      this.logger.warn('Gemini returned non-JSON content; treating as no candidates.');
      return [];
    }
  }
}

const BOOK_CANDIDATES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      author: { type: 'STRING' },
      isbn: { type: 'STRING' },
      publisher: { type: 'STRING' },
      year: { type: 'STRING' },
      confidence: { type: 'STRING', enum: ['high', 'low'] },
    },
    required: ['title', 'confidence'],
  },
};
