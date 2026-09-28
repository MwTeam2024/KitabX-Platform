/**
 * Referral-code capture (§ referral program). A link like
 * `/welcome?ref=ABC123` should keep working even if the visitor lands on
 * `/welcome` first and only reaches the signup form a click or two later —
 * sessionStorage survives that hop within the same tab without needing any
 * Redux/global-state plumbing for what's ultimately a one-shot value.
 */
const STORAGE_KEY = 'kitabx_referral_code';

export function captureReferralCode() {
  if (typeof window === 'undefined') return;
  const ref = new URLSearchParams(window.location.search).get('ref');
  if (!ref) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, ref.trim().toUpperCase());
  } catch {
    // Private/incognito mode can block storage — losing the referral
    // attribution is a fair fallback, never worth breaking signup over.
  }
}

export function getStoredReferralCode() {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/** One-shot value — clear it once a signup actually goes through, so a
 * stale code can't linger in the tab and get reused later (e.g. after a
 * logout, a fresh sign-up-elsewhere accidentally re-attributed to it). */
export function clearStoredReferralCode() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
