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

  /**
   * @param {Buffer} imageBuffer @param {string} mimeType
   *
   * Google's free-tier request quota (20/day, confirmed live via the API's
   * own 429 body) is per model, not per account/key — "20/day" from just
   * gemini-3.6-flash was the real bottleneck, not the key itself. So this
   * tries each model in MODELS in turn: a 429 (quota) or 503 (that specific
   * model overloaded) moves on to the next one instead of failing the whole
   * scan, multiplying the effective free daily capacity across models
   * without needing a second API key or provider. Any other error (bad
   * request, real auth failure, ...) still fails immediately — those aren't
   * "try a different model" situations.
   */
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

    const imagePart = { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBuffer.toString('base64') } };
    let lastError = null;

    for (const model of MODELS) {
      const generationConfig = {
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
      };
      if (model.supportsThinkingLevel) {
        // This model thinks by default and can't have it turned off
        // entirely (thinkingBudget: 0 is rejected as invalid) — confirmed
        // live that left at its default a single call took over 13 seconds
        // for what is, at bottom, a straight vision-recognition task rather
        // than something needing deep chain-of-thought. Capping it to LOW
        // cut that to ~3 seconds with no code-visible quality loss. Other
        // models in the fallback list reject this field outright (confirmed
        // live: "Thinking level is not supported for this model"), so it's
        // only sent to models that are known to accept it.
        generationConfig.thinkingConfig = { thinkingLevel: 'LOW' };
      }

      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, imagePart] }], generationConfig }),
        },
      );

      if (res.ok) {
        // eslint-disable-next-line no-await-in-loop
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        return this._parseCandidates(text);
      }

      // eslint-disable-next-line no-await-in-loop
      const body = await res.text().catch(() => '');
      lastError = { status: res.status, body };
      if (res.status === 429 || res.status === 503) {
        this.logger.warn(`Gemini ${model.id} unavailable (${res.status}) — trying the next model`);
        // eslint-disable-next-line no-continue
        continue;
      }
      this.logger.error(`Gemini request failed (${res.status}): ${body}`);
      throw new ServiceUnavailableException('Could not analyze that photo right now — try again shortly.');
    }

    this.logger.error(`All Gemini models exhausted/unavailable. Last error: ${lastError?.status} ${lastError?.body}`);
    throw new ServiceUnavailableException('Could not analyze that photo right now — try again shortly.');
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

// Tried in this order — ranked by a live, repeatable head-to-head test run
// against the real API: the same 4 real book-cover photos sent to all 7
// models. Every model correctly identified every book at "high" confidence
// (accuracy was a tie), so the ranking below is by response time and how
// complete the secondary fields (isbn/publisher/year) came back:
//   1. gemini-3.5-flash-lite — fastest every time (1.7-2.4s), always complete
//   2. gemini-3.1-flash-lite — ~4s, always complete
//   3. gemini-3.5-flash — ~3-4.6s, complete
//   4. gemini-3.6-flash — the original default, solid quality (no fresh
//      timing data — its free quota was already exhausted during testing)
//   5. gemini-3.7-flash — solid when available, but flaked with a 503
//      "high demand" mid-test, so it's ranked below the proven performers
//   6. gemini-2.5-flash — consistently slowest of the full-size models
//      (5.4-6.2s) and never returns an isbn
//   7. gemini-2.5-flash-lite — least reliable: response time varied wildly
//      across identical calls (3.4s, then 8s, then 21.5s) and it drops
//      fields other models keep (isbn, sometimes publisher/year)
// gemini-2.5-flash, gemini-3.5-flash and gemini-2.5-flash-lite specifically
// reject `thinkingConfig.thinkingLevel` (400 "Thinking level is not
// supported for this model"), hence the per-model flag.
const MODELS = [
  { id: 'gemini-3.5-flash-lite', supportsThinkingLevel: true },
  { id: 'gemini-3.1-flash-lite', supportsThinkingLevel: true },
  { id: 'gemini-3.5-flash', supportsThinkingLevel: false },
  { id: 'gemini-3.6-flash', supportsThinkingLevel: true },
  { id: 'gemini-3.7-flash', supportsThinkingLevel: true },
  { id: 'gemini-2.5-flash', supportsThinkingLevel: false },
  { id: 'gemini-2.5-flash-lite', supportsThinkingLevel: false },
];

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
