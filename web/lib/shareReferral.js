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
  const fullText = `${SHARE_TEXT} ${url}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      // The link deliberately isn't passed as its own `url` field — iOS's
      // share sheet treats a separate `url` as a link-preview attachment
      // rather than clipboard text, so its own "Copy" action can silently
      // drop the link while "Copy" still works fine when it's folded into
      // `text` (confirmed: direct-send targets like WhatsApp got the link
      // fine either way, only "Copy" was affected).
      await navigator.share({ title: 'KitabX', text: fullText });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // Fall through to the clipboard fallback for any other share failure.
    }
  }

  try {
    await navigator.clipboard.writeText(fullText);
    return 'copied';
  } catch {
    return 'failed';
  }
}
