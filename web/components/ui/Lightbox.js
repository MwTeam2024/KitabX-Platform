'use client';

import Icon from './Icon';

/** Full-screen tap-to-zoom viewer for a single photo. Renders nothing if `src` is falsy. */
export default function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="lightbox-overlay">
      <button type="button" className="lightbox-backdrop" onClick={onClose} aria-label="Close" />
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        <Icon name="x" style={{ width: 15, height: 15 }} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="lightbox-img" />
    </div>
  );
}
