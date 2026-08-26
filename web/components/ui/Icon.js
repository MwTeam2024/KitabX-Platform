const PATHS = {
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><circle cx="4" cy="14" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="20" cy="14" r="2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  chevronRight: '<path d="M9 18l6-6-6-6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.2 2.2L16 9.5"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.8-4.8 4.6 1.2 6.5L12 17.2 6.1 20.4l1.2-6.5L2.5 9.3l6.6-.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h13l-2.6 4.2L18 12.4H5"/>',
  shieldCheck: '<path d="M12 2.5l7.5 3.5v5.5c0 5-3.4 7.9-7.5 9.5-4.1-1.6-7.5-4.5-7.5-9.5V6z"/><path d="M8.7 12l2 2 4-4.2"/>',
  camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="14" r="3.4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  mapPin: '<path d="M12 22s7-7.4 7-12a7 7 0 1 0-14 0c0 4.6 7 12 7 12z"/><circle cx="12" cy="10" r="2.4"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  paperclip: '<path d="M21 11.5l-9.2 9.2a4.5 4.5 0 0 1-6.4-6.4l9.2-9.2a3 3 0 1 1 4.3 4.3L11.2 17l-1.4-1.4 7.4-7.4"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M9 22V12h6v10"/>',
  building: '<path d="M4 22V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v18"/><path d="M15 22V9l5 2v11"/><path d="M8 6h3M8 10h3M8 14h3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.4 3.4 5.8 3.4 9s-1 6.6-3.4 9c-2.4-2.4-3.4-5.8-3.4-9s1-6.6 3.4-9z"/>',
  lock: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  alertTriangle: '<path d="M10.3 3.9l-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3.1l-8.2-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  helpCircle: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.9 2.5c-1 .8-1.9 1.2-1.9 2.5"/><path d="M12 17h.01"/>',
  messageCircle: '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5H3l3-3.5a8.5 8.5 0 1 1 15-5z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2z"/>',
  fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 6 10-6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.9 2.2z"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18"/><path d="M12 8c-2.2 0-4-1.3-4-3s1.3-2.5 2.6-2c1.3.5 1.4 2.7 1.4 5zm0 0c2.2 0 4-1.3 4-3s-1.3-2.5-2.6-2c-1.3.5-1.4 2.7-1.4 5z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  bookOpen: '<path d="M12 6.5C10.5 5 8 4.3 3 4.3v14.4c5 0 7.5.7 9 2.3 1.5-1.6 4-2.3 9-2.3V4.3c-5 0-7.5.7-9 2.2z"/><path d="M12 6.5V21"/>',
  layers: '<path d="M4 19V5M9 19V8M14 19V5M19 19V10"/>',
  download: '<path d="M12 3v13m0 0l4-4m-4 4l-4-4"/><path d="M4 21h16"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 1c0 2-2.5 1.7-2.5 3.5"/><path d="M12 16.5h.01"/>',
  tag: '<path d="M20.6 12.6L12.6 20.6a2 2 0 0 1-2.8 0l-6.4-6.4a2 2 0 0 1 0-2.8L11.4 3.4A2 2 0 0 1 12.8 3H19a2 2 0 0 1 2 2v6.2a2 2 0 0 1-.4 1.4z"/><circle cx="15.5" cy="8.5" r="1.4"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  exchange: '<path d="M16 3l4 4-4 4"/><path d="M20 7H5"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h15"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6M14 11v6"/>',
  moreVertical: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  // Task 43: the original hand-drawn bubble+handset glyph rendered with a
  // malformed/"cut off" look (self-intersecting arc segments) — replaced
  // with a plain rounded chat-bubble outline, same shape family as every
  // other icon in this stroke-only set; the row's own green tint already
  // carries the WhatsApp association.
  whatsapp: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  apple: '<path d="M16.7 2c.1 1.1-.3 2.2-1 3-.7.8-1.9 1.5-3 1.4-.1-1.1.4-2.2 1-3 .8-.8 2-1.4 3-1.4z"/><path d="M20.7 17.4c-.5 1.1-.8 1.6-1.4 2.6-.9 1.4-2.2 3.1-3.7 3.1-1.4 0-1.7-.9-3.6-.9-1.9 0-2.3.9-3.6.9-1.5 0-2.7-1.5-3.6-2.9C2.5 17.4 2 13.6 3.5 11c.8-1.4 2.3-2.3 3.8-2.3 1.4 0 2.3 1 3.5 1 1.1 0 1.8-1 3.5-1 1.3 0 2.7.7 3.6 1.9-3.2 1.8-2.7 6.3 1.8 6.8z"/>',
};

/**
 * Feather-style stroke icon rendered inline so it inherits `currentColor`.
 * Usage: <Icon name="mapPin" className="ic" />
 */
export default function Icon({ name, className = 'ic', style, title }) {
  if (name === 'coin') {
    return (
      <span className={className} style={style} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="9" />
          <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" stroke="none" fill="currentColor" fontFamily="Georgia,serif">₹</text>
        </svg>
      </span>
    );
  }
  const d = PATHS[name];
  if (!d) return null;
  return (
    <span className={className} style={style} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: d }}
      />
    </span>
  );
}
