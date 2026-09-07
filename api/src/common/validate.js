import { BadRequestException } from '@nestjs/common';

/**
 * Minimal request-body validation used across every controller instead of
 * class-validator DTOs. class-validator's automatic `@Body() body: SomeDto`
 * binding relies on TypeScript's `design:paramtypes` reflection to know which
 * class to instantiate/validate against — that metadata doesn't exist in a
 * plain-JavaScript codebase (no TS compiler ever runs here), so it silently
 * never validates anything. These small explicit checks are the reliable
 * substitute; every mutating endpoint calls one at the top of its handler.
 */
export function required(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body?.[f] === null || body[f] === '');
  if (missing.length) {
    throw new BadRequestException(`Missing required field(s): ${missing.join(', ')}`);
  }
}

export function assertOneOf(value, options, fieldName = 'value') {
  if (!options.includes(value)) {
    throw new BadRequestException(`${fieldName} must be one of: ${options.join(', ')}`);
  }
}

export function assertInt(value, fieldName = 'value', { min, max } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new BadRequestException(`${fieldName} must be an integer`);
  if (min != null && n < min) throw new BadRequestException(`${fieldName} must be >= ${min}`);
  if (max != null && n > max) throw new BadRequestException(`${fieldName} must be <= ${max}`);
  return n;
}

/**
 * Every member-facing number in this app is Indian, so an explicit leading
 * "+" is trusted as an already-fully-qualified international number
 * (preserved as-is — this is the one path that tolerates a non-India code).
 * Anything else is assumed Indian and reduced to the one canonical form
 * (`+91` + 10 digits) regardless of how it was typed — bare 10 digits, a
 * leading trunk "0", or the "91"/"0091" country code without a "+". The
 * previous version blindly prefixed "+91" onto whatever wasn't already
 * "+"-led, so "91 98765 43210" normalized to "+91919876543210" — a second,
 * silently-different string for the exact same real number as the already-
 * registered "+919876543210", which let one person register twice
 * (confirmed live: two accounts, same real phone, different login screens).
 */
export function normalizePhone(phone) {
  if (typeof phone !== 'string') throw new BadRequestException('phone must be a string');
  const trimmed = phone.trim();

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length < 10) throw new BadRequestException('Enter a valid phone number');
    return `+${digits}`;
  }

  let digits = trimmed.replace(/\D/g, '');
  digits = digits.replace(/^0+/, ''); // a leading trunk "0", or a "00" international-dialing prefix
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2).replace(/^0+/, '');
  }
  if (digits.length !== 10) throw new BadRequestException('Enter a valid phone number');
  return `+91${digits}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  if (typeof email !== 'string') throw new BadRequestException('email must be a string');
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) throw new BadRequestException('Enter a valid email address');
  return trimmed;
}
