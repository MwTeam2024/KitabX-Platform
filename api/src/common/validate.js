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

export function normalizePhone(phone) {
  if (typeof phone !== 'string') throw new BadRequestException('phone must be a string');
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 10) throw new BadRequestException('Enter a valid phone number');
  return digits.startsWith('+') ? digits : `+91${digits.replace(/^0+/, '')}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  if (typeof email !== 'string') throw new BadRequestException('email must be a string');
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) throw new BadRequestException('Enter a valid email address');
  return trimmed;
}
