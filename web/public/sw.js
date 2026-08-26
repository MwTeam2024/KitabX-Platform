/**
 * KitabX service worker (§17).
 *
 * Strategy, deliberately conservative:
 *  - App shell + static assets: cache-first, so the app opens on a weak network.
 *  - Navigations: network-first with an offline fallback page.
 *  - Authenticated API responses: NEVER cached (§17 — "do not cache sensitive
 *    authenticated API responses indiscriminately").
 */

const VERSION = 'kitabx-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';

const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => null)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** The page asks us to activate a waiting update (see UpdatePrompt). */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.includes('/auth/');
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || /\.(?:png|jpe?g|svg|webp|avif|woff2?|ico)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Authenticated data always goes to the network — never served from cache.
  if (isApiRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then(async (res) => {
        if (res.ok) (await caches.open(ASSET_CACHE)).put(request, res.clone());
        return res;
      })),
    );
  }
});

/** FCM web push (§15). The notification body comes from the server payload. */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'KitabX', body: event.data.text() };
  }
  const data = payload.notification || payload;
  event.waitUntil(
    self.registration.showNotification(data.title || 'KitabX', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/maskable-192.png',
      data: { url: data.click_action || payload.data?.url || '/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
