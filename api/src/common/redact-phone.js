/**
 * §14: phone numbers must never be exposed in chat. Mirrors the frontend's
 * client-side guard (lib/privacy.js) but this is the copy that actually
 * matters — the frontend one only stops an honest client from displaying a
 * number; this is what stops it from ever leaving the server.
 */
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

export function redactPhoneNumbers(text = '') {
  return text.replace(PHONE_PATTERN, '[number hidden]');
}
