/**
 * Uploads are pre-resized server-side to a fixed 1600×1600 webp (see
 * `cloudinary.service.js`), so every card/spine thumbnail across the app —
 * discovery grid, shelf rows, exchange minis — was downloading that same
 * full-size image just to shrink it in CSS. Inserting a transform right
 * after `/upload/` asks Cloudinary for an already-small, already-optimized
 * version instead. Non-Cloudinary URLs (or anything unexpected) pass
 * through unchanged rather than risk breaking on a malformed rewrite.
 */
export function cldThumb(url, { w = 300 } = {}) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/w_${w},q_auto,f_auto,c_limit/`);
}
