/**
 * Task 64 — the frontend (Vercel) and API (Render) live on different domains,
 * which makes the session cookie a third-party cookie from the browser's
 * point of view. Even with the correct `Secure; SameSite=None` flags (already
 * set server-side), iOS Safari blocks third-party cookies outright by
 * default ("Prevent Cross-Site Tracking"), which is exactly what caused
 * "Not signed in" right after a fresh sign-up on an iPhone.
 *
 * Fix: proxy `/api/v1/*` through this same Vercel domain via `rewrites()`,
 * so the browser only ever talks to its own origin — no cross-site request,
 * no third-party-cookie problem, and no code changes needed anywhere else
 * (NEXT_PUBLIC_API_URL just becomes a relative path in production; see
 * .env.example). Only active when BACKEND_API_URL is set (production),
 * so local dev — where the frontend and API are same-site `localhost`
 * ports anyway — is completely unaffected.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backend = process.env.BACKEND_API_URL;
    if (!backend) return [];
    return [{ source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` }];
  },
  experimental: {
    // Every screen here is a 'use client' page with no server-side data
    // fetching, so Next classifies its route segment as static and reuses
    // the cached client render for up to 5 minutes on revisit — meaning a
    // page's own mount-time refresh (My Shelf, Wishlist, Credits, Exchange)
    // silently never re-ran on a plain in-app tab switch, only on a full
    // reload. Confirmed live: clicking away and back left `books` state
    // stale even though a direct fetch showed the real data was already
    // there. Setting both stale-time windows to 0 makes every navigation —
    // prefetched or not — treat the segment as needing a fresh render, so
    // these pages' own refresh effects actually fire again.
    staleTimes: { dynamic: 0, static: 30 }, // 30 is the minimum Next.js allows for `static`
  },
};

export default nextConfig;
