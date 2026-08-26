export const EXCHANGE_STAGES = [
  "requested",
  "accepted",
  "pickup-proposed",
  "pickup-confirmed",
  "handover-verified",
  "completed",
];

export const EXCHANGE_TERMINAL_STAGES = ["declined", "cancelled", "expired", "disputed"];

export const PICKUP_TIME_SLOTS = ["10–12 PM", "2–4 PM", "6–8 PM"];
export const PICKUP_POINTS = ["🏢 Society gate", "🛎️ Reception", "🏛️ Clubhouse", "🌳 Common area"];

export const MIN_RADIUS_KM = 0.5;
export const MAX_RADIUS_KM = 5;

// Placeholder until the real KitabX WhatsApp Business number is supplied —
// digits only (country code, no +/spaces/dashes), as required by wa.me links.
export const SUPPORT_WHATSAPP_NUMBER = '911234567890';
export const SUPPORT_WHATSAPP_LINK = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;

export const LISTING_REPORT_REASONS = [
  { label: 'Wrong condition', value: 'INCORRECT_CONDITION' },
  { label: 'Duplicate listing', value: 'FAKE_DUPLICATE_LISTING' },
  { label: 'Fake listing', value: 'FAKE_DUPLICATE_LISTING' },
  { label: 'Other', value: 'OTHER' },
];

export const USER_REPORT_REASONS = [
  { label: 'Fake or duplicate listing', value: 'FAKE_DUPLICATE_LISTING' },
  { label: 'Incorrect book condition', value: 'INCORRECT_CONDITION' },
  { label: 'Inappropriate content', value: 'INAPPROPRIATE_CONTENT' },
  { label: 'Harassment', value: 'HARASSMENT' },
  { label: 'No response or no-show', value: 'NO_RESPONSE_NO_SHOW' },
  { label: 'Other', value: 'OTHER' },
];
