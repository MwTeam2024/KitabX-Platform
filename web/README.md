# KitabX — Frontend (Next.js PWA)

Society book-exchange PWA. UI is a 1:1 port of the Figma-matched HTML prototype
(`../../index.html`); the module scope and workflow come from `KitabX.pdf`, and the
layering follows `KitabX-Frontend-NextJS-JavaScript.md`.

- Next.js 16 App Router · JavaScript (no TypeScript) · React 19
- Tailwind CSS v4 (`@theme` tokens) alongside the prototype's design-system classes
- Redux Toolkit for global client state · React Context for demo resource state
- PWA: manifest, service worker, offline fallback, install + update prompts

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 — `/` redirects to `/welcome`.

```bash
npm run build   # production build
npm run lint    # eslint (must stay clean)
```

### Environment

Copy the keys you need into `.env.local` (never commit it):

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

Without these the app still runs end-to-end: service calls fail softly and the
screens fall back to the seed data in `lib/mockData.js`.

## Routes

| Route | Prototype screen | Module |
| --- | --- | --- |
| `/welcome` | 01 Splash | 1 Onboarding |
| `/login` | 02 Auth, 03 OTP (inline — channel choice + code entry) | 1 |
| `/onboarding` | multi-step profile/society/terms | 1 |
| `/home` | 04 Discover | 4 Discover & search |
| `/books/:id` | 05 Book detail | 3, 4 |
| `/books/add` → `scan` / `search` / `bulk` / `details` / `preview` | 06–10 | 3 Book listing |
| `/books` | 11 My Shelf | 3 |
| `/wishlist` | 12 Wishlist | 5 |
| `/requests` | incoming-request queue | 7 Book request |
| `/exchanges`, `/exchanges/:id` | 13, 14 | 7, 10 |
| `/exchanges/:id/pickup` | 15 | 8 Pickup scheduling |
| `/exchanges/:id/handover` | 16 | 9 Handover OTP |
| `/exchanges/:id/rate` | 17 | 13 Ratings |
| `/chat`, `/chat/:requestId` | 18 | 11 Chat |
| `/notifications` | notification centre | 12 |
| `/credits` | 19b Credit system | 6 Credits |
| `/profile`, `/profile/settings` | 19, 20 | 2 Profile |
| `/admin/*` | Admin console | Simple Super Admin |
| `/offline` | offline fallback | 15 PWA |

## Layering

```
app/**/page.js   → a URL; assembles the screen
components/      → reusable UI
hooks/           → reusable React/browser behaviour
services/        → NestJS API calls (via lib/api-client.js)
store/           → global client state (auth, location, notifications, UI)
contexts/        → AppDataContext: demo stand-in for server resources
```

`contexts/AppDataContext.js` is the one piece meant to be **deleted**. It mimics
the resources NestJS will own (books, wishlist, credits, exchanges, chat, admin
tables) so every screen is clickable before the API exists. Swap each action for
the matching `services/*.service.js` call and the pages stay untouched.

## What the frontend must never decide

Enforced in NestJS, mirrored (not owned) here — see architecture doc §19:

- credit deduction, reservation and release
- exchange completion and handover OTP validation
- user authorization and admin permissions
- private address visibility, report resolution, listing ownership

Two privacy rules are additionally guarded client-side so a UI slip can't leak
them: `lib/privacy.js` redacts phone numbers in chat, and `BookDetailView`
reduces another member's `A-402, Society` to `A block, Society`.

## Styling

`app/globals.css` holds the prototype's design system verbatim — CSS custom
properties (`--brand`, `--cream`, `--gold`, …) plus the component classes
(`.hdr`, `.book-card`, `.segtabs`, `.exch-card`, `.tl`, `.sheet`, `.admin-*`).
Tailwind utilities are available and used for one-off layout; reach for the
existing class first so screens stay pixel-identical to the prototype.

The phone-mockup chrome from the prototype (`.phone`, `.notch`, fake status bar,
screen-index drawer) is intentionally gone: this is the real app, so `.app-frame`
is a max-480px column that fills the viewport on a device and letterboxes on
desktop.

## Loading & error states (§18)

Loading, empty, error and retry states live **inside each screen** — the scan and
bulk-upload spinners, `EmptyState` on every list, "Verifying…"/"Submitting…" button
states, and `error.js` / `not-found.js` at the root.

Do **not** add a route-level `loading.js`. A `loading.js` anywhere above these
client screens (root or route group) leaves the app permanently stuck on the
fallback: the Suspense boundary never resolves and every page renders only
"Loading…". This was verified in a production build, not just dev. Per-screen
states cover the same requirement without that failure mode.

## PWA

- `app/manifest.js` — icons, shortcuts, `start_url: /home`
- `public/sw.js` — cache-first shell/assets, network-first navigation with an
  `/offline` fallback, FCM push handling. **Authenticated API responses are never
  cached.** Registered only in production (`components/pwa/ServiceWorkerRegistrar.js`).
- `public/icons/*` — regenerate from `public/logo.png` with `sharp` if the logo changes.
