/**
 * Chat must never surface phone numbers (§14 / Module 11). The backend
 * redacts on write; this is the matching client-side guard for anything
 * already stored or typed.
 */
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export function redactPhoneNumbers(text = '') {
  return text.replace(PHONE_PATTERN, '[number hidden]');
}

export function containsPhoneNumber(text = '') {
  PHONE_PATTERN.lastIndex = 0;
  return PHONE_PATTERN.test(text);
}
