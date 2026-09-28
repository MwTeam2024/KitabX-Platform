/** Referral share action — native share sheet where available, clipboard
 * copy as the fallback (desktop browsers with no navigator.share). */
export function buildReferralUrl(code) {
  if (!code) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/welcome?ref=${code}`;
}

const SHARE_TEXT = "Join me on KitabX — give a book, get a book! Sign up with my link and we both get a free credit:";

/** Returns 'shared' | 'copied' | 'cancelled' | 'failed' so the caller can
 * decide what (if anything) to tell the user — a native share sheet already
 * shows its own confirmation, so only 'copied'/'failed' need a toast. */
export async function shareReferral(code) {
  const url = buildReferralUrl(code);
  if (!url) return 'failed';

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: 'KitabX', text: SHARE_TEXT, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Fall through to the clipboard fallback for any other share failure.
    }
  }

  try {
    await navigator.clipboard.writeText(`${SHARE_TEXT} ${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
