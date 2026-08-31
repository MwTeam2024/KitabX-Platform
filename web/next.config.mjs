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
};

export default nextConfig;
