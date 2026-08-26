/** PWA manifest (§17). Installable on Android, iOS Safari and desktop. */
export default function manifest() {
  return {
    name: 'KitabX — Society Book Exchange',
    short_name: 'KitabX',
    description: 'A community where books live, stories grow, and readers connect.',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F4F0E6',
    theme_color: '#123D25',
    lang: 'en',
    dir: 'ltr',
    categories: ['books', 'social', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'List a book', short_name: 'List', url: '/books/add' },
      { name: 'My exchanges', short_name: 'Exchange', url: '/exchanges' },
      { name: 'Wishlist', short_name: 'Wishlist', url: '/wishlist' },
    ],
  };
}
