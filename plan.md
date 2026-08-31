# KitabX — Feature Fix Plan (Round 2)

Source: user feedback messages, 18 items total (13 in the first message, 5 more
— Tasks 14–18 — added in a follow-up). One task per item (a few split into
sub-steps). Status is updated after each task completes. I stop and ask
before starting the next task.

A third round of 14 more items — Tasks 19–32 — was added on 2026-08-24. Started
2026-08-25 per explicit user go-ahead, one task at a time with a stop-and-ask after
each (same process as every prior round).

A fourth round of 5 more items — Tasks 33–37 — was also added on 2026-08-24.
**Same instruction applies: recorded only, not started.**

A fifth round of 1 more item — Task 38 — was also added on 2026-08-24.
**Same instruction applies: recorded only, not started.**

A sixth round of 1 more item — Task 39 — was also added on 2026-08-24.
**Same instruction applies: recorded only, not started.**

Legend: ⬜ not started · 🔄 in progress · ✅ done

---

## Task 1 — Cloudflare R2 with local-disk fallback ✅
Done. `StorageService` picks R2 when fully configured, else `LocalStorageService`
saves optimized webp files under `apps/api/storage/local-uploads/` and serves them
at `/media/*` (registered in `main.js` via `useStaticAssets`, outside the API prefix).
Verified live: with only `R2_ACCOUNT_ID` set (as in the current `.env`), upload now
returns a real local URL and the file is servable (`200 image/webp`) — no more 501.
**Ask:** if `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_PUBLIC_URL` are all
set in `apps/api/.env`, upload to R2 exactly as today. If any are missing, save the
optimized image to a local folder on the API server (e.g. `apps/api/uploads/`), serve
it via a static route, and store that local URL on the row instead — so photo upload
works end-to-end either way, no 501 error.
- Backend: `R2Service` (or a new `LocalStorageService` + a small router in front of
  both) — same `uploadImage(buffer, folder)` interface either way.
- Backend: serve `/uploads/*` as static files from `main.js`.
- No frontend change needed — it already just stores whatever URL comes back.

## Task 2 — Owner has no "Accept" button on incoming requests ✅
Fixed in `ExchangeCard.js`, `ExchangeList.js`, and `requests/page.js` — all three
checked `!exchange.stage` to mean "still pending", but the real backend always
returns a non-empty stage string (`'requested'`), so that check was always false.
Changed all three to check `exchange.stage === 'requested'`. Verified live end-to-end:
created a real incoming request, Accept button appeared, clicked it, exchange moved
to "Accepted" and the pickup-scheduling step.
**Root cause confirmed:** `ExchangeCard.js` shows Accept/Decline only when
`exchange.status === 'forme' && !exchange.stage`. The real backend always returns a
non-empty `stage` string (`'requested'` for a fresh request), which is truthy — so
`!exchange.stage` is always `false` and the buttons never render. Same bad check
lives in `ExchangeList.js`'s pending-badge count and `requests/page.js`'s incoming
filter.
- Fix all three call sites to check `exchange.stage === 'requested'` instead of
  `!exchange.stage`.

## Task 3 — Uploaded photo not shown on book cards (generated placeholder shown instead) ✅
Fixed in two places:
- `BookCover.js` rewritten — `BookCover`/`BookSpine`/`BookCoverDetail` now render the
  real photo (`book.photos[0]`, or an explicit `photoUrl` override) via a new
  `RealPhoto` `<img>` helper, falling back to the generated `cov`/`em` placeholder
  only when no real photo exists.
- `discovery.service.js` was missing `photos` entirely (neither in the Prisma
  `include` nor in `_toCardDto()`), so the Discover/home grid still showed the
  placeholder even though My Shelf/Book Detail (fed by `listings.service.js`, which
  already included `photos`) would not have had this gap. Added
  `photos: { orderBy: { sortOrder: 'asc' } }` to the `include` and
  `photos: listing.photos.map((p) => p.imageUrl)` to `_toCardDto()`, mirroring
  `listings.service.js#_toDto` exactly.
Verified live: confirmed `/api/v1/discovery` now returns a real `photos` array, and
checked the actual rendered `<img src>` in the browser DOM on all three surfaces —
Discover grid, My Shelf, and Book Detail — all showing the real uploaded photo
(`http://localhost:3001/media/listings/b251bb1f-...webp` for the local-storage test
listing, and the real Unsplash URL for a listing seeded with a photo URL directly).

## Task 4 — Chat delete + auto-delete retention toggle (1/3/6 months) ✅
Implemented as "delete for me" (matches how WhatsApp/most chat apps behave — the other
participant keeps their side) plus an opt-in auto-delete window:
- DB migration `chat_delete_and_retention`: `ConversationParticipant.deletedAt`
  (soft-delete per participant) and `UserNotificationPreference.chatRetentionMonths`
  (nullable Int, reusing the existing per-user prefs row rather than a new table).
- Backend: `DELETE /chat/threads/:conversationId` (`chat.controller.js` /
  `chat.service.js#deleteThread`) sets `deletedAt` for the calling participant only;
  `listThreads` filters out `deletedAt != null`. A new message on a hidden thread
  clears `deletedAt` for everyone (`sendMessage`) so a reply is never silently missed.
  Once every participant has deleted their side, the conversation + messages are
  hard-deleted (`_purgeIfAbandoned`).
- Backend: `chat-retention.service.js` (new, in `scheduled-tasks/`), `@Cron` daily —
  for every user with `chatRetentionMonths` set, hides (via the same `deleteThread`)
  any of their conversations quiet longer than that window. Registered in
  `scheduled-tasks.module.js`.
- Backend: `UsersService#setNotificationPreferences` validates `chatRetentionMonths`
  is one of `null/1/3/6` (400 otherwise) — verified live.
- Frontend: trash-icon delete button (with a confirm sheet explaining "delete for me"
  semantics) on both the chat list row and the thread header
  (`app/(main)/chat/page.js`, `components/chat/ChatThread.js`); `chatService.js` +
  `AppDataContext#deleteThread` wire it through.
- Frontend: "Chat auto-delete" row in Profile Settings opens a radio-button sheet
  (Never/1/3/6 months), reusing `usersService.get/updateNotificationPreferences`.
Bug found + fixed during verification: `deleteThread` originally returned nothing,
so NestJS sent an empty 200 body and the frontend's `res.json()` threw "Unexpected
end of JSON input" on every delete. Fixed by returning `{ success: true }`, matching
the existing convention in `listings.service.js#removeListing`.
Verified live: deleted a real conversation from the chat list (confirm sheet →
200 OK → thread disappears); confirmed the fixed endpoint now returns valid JSON via
a direct fetch; set retention to 3 months in Profile Settings and confirmed
`chatRetentionMonths: 3` persisted via GET; confirmed the backend rejects an invalid
value (`2`) with 400.

## Task 5 — Notification delete (per-item ✕ and "Clear all") ✅
- Backend: `DELETE /notifications/:id` and `DELETE /notifications`
  (`notifications.controller.js` / `notifications.service.js#deleteOne/deleteAll`) —
  hard-delete from the DB, `deleteMany` scoped to `userId` so a caller can never
  touch another user's notifications. Both return `{ success: true }` (matching the
  `{success:true}` convention already used by `markRead`/`markAllRead`, and the fix
  applied in Task 4 — avoids the same "empty body" JSON-parse crash).
- Frontend: `notifications.service.js` + new `deleteNotification`/
  `clearAllNotifications` thunks in `notificationSlice.js`. ✕ button added to every
  row in both `NotifDropdown.js` (the panel) and the full `/notifications` page —
  each row's outer `<button>` became a `role="button"` `<div>` so the inner delete
  button (`stopPropagation`) can nest inside it. "Clear all" text button added just
  left of the panel's ✕/close icon, and mirrored next to "Mark all read" on the full
  page for consistency.
Verified live: opened the notification panel, deleted a single real notification via
its ✕ (confirmed `DELETE /notifications/:id` → 200, item vanished, re-fetch from the
API confirmed it's gone from the DB); called `DELETE /notifications` directly and
confirmed a clean `{"success":true}` response with no route conflict against the
`:id` route.

## Task 6 — Rating stars should start empty, not pre-filled at 5 ✅
- `RateExchange.js`: initial `scores` state changed from `{conditionAccuracy: 5,
  communication: 5, reliability: 5}` to all `0`s. `StarRating` already renders `0`
  as no stars filled (`n <= value` is false for every star when `value` is 0), so no
  change needed there. Submit is now disabled (`!allRated`, i.e. every criterion > 0)
  and shows "Rate all three to continue" until then, matching the backend's existing
  1–5 validation in `ratings.service.js#submit` (would 400 on a 0 rating anyway).
Verified live: built a fresh completed exchange fixture, opened its rate screen —
all 15 star buttons (3 criteria × 5 stars) started with no `on` class and the submit
button read "Rate all three to continue"; clicked 4 stars on each criterion, button
became "Submit rating", submitted successfully and landed on the Completed tab.

## Task 7 — Real barcode scan + real bulk AI upload (remove all demo data) ✅
- **Barcode scan**: added `lib/barcode.js` (new) using `@zxing/browser` +
  `@zxing/library` (installed) — `startScan(videoEl, onResult, onError)` opens the
  real device camera and decodes barcodes frame-by-frame, resolving on the first hit
  and exposing a `stop()` to release the camera on unmount/cancel.
  `books/add/scan/page.js` rewritten: `idle` → real `<video>` scanning UI → `looking-up`
  → `match`/`notfound`, replacing the hardcoded `'9780062316097'` ISBN with the real
  decoded barcode text (digits/X only) fed into the existing real
  `booksService.lookupByIsbn`. Camera-permission failures show a toast and fall back
  to idle rather than hanging. Also fixed the genre bug on this screen: it hardcoded
  `genre: 'Non-fiction'` regardless of the actual book — now uses the book's real
  category when Google Books has one, else a sane default.
- **Bulk AI upload**: removed the hardcoded `DETECTED` array entirely from
  `books/add/bulk/page.js`. `runScan(file)` now calls the real
  `booksService.extractFromImage` and renders whatever the backend actually returns
  (`{candidates: [...]}`), mapping each into a review-list item via a new
  `toDetectedItem()` (real title/author/genre/isbn/year/confidence, `coverForDraft`
  for the placeholder art since real candidates carry no pre-baked cover). Added an
  `empty` phase for "no books detected" and surfaces real backend errors (e.g. 503
  when Gemini is unavailable) via toast instead of silently falling through to fake
  data. Unmatched Gemini guesses (no Google Books match) are now honestly labelled
  "⚠ Unverified" rather than a false confidence badge.
- **Backend**: `google-books.service.js#_normalize` now also returns `genre` (from
  Google Books `categories[0]`) — previously missing entirely, which is what made
  every scanned/detected book silently need a hardcoded genre on the frontend.
- **Real bug found and fixed via live testing**: the bulk-upload endpoint was
  hard-failing every request with a 503 — `gemini.service.js` called the model
  `gemini-2.0-flash`, which Google's API confirmed (via its own 404 response) has
  been retired; updated to the model Google's error pointed to as the replacement
  (`gemini-3.6-flash`).
Verified live: (1) ISBN lookup — confirmed `GET /book-identification/isbn` returns
real Google Books data for a real ISBN. (2) Bulk extraction — posted a real "Sapiens"
book-cover photo to `POST /book-identification/image` directly and got back a real,
correctly-matched, high-confidence result (title, author, real genre "History",
ISBN); then reproduced the same flow through the actual browser UI (file input →
real fetch → review screen showing the real detected book, not mock data) and
published it — it appeared for real on My Shelf. (3) Confirmed graceful handling of
two real external-API failure modes hit during testing: a camera-permission denial
(toast + revert to idle) and a genuine Gemini 503 "high demand" response (toast +
revert to idle, no hang/crash) — both before the model-name fix and reproduced
independently of it.

## Task 8 — Edit mobile number, with OTP verification of the new number ✅
- Backend: `otp.service.js` now namespaces its Redis keys by a `purpose` param
  (default `login`) so a phone-change OTP can't collide with a concurrent login OTP
  for the same number. Two new endpoints in `auth.controller.js`, both behind
  `JwtAuthGuard`: `POST /auth/phone-change/request` (rejects with 400 if the new
  number equals the current one, 409 if it belongs to another account, else sends an
  OTP via `OtpService.requestOtp(newPhone, 'phone-change')`) and
  `POST /auth/phone-change/verify` (verifies the code, calls new
  `AuthService.changePhone(userId, newPhone)` which re-checks the uniqueness race and
  updates `User.phone`, then re-issues the session cookie via `issueSession` so the
  JWT's embedded phone stays in sync).
- Frontend: "Phone Number" row in Profile Settings (`app/(main)/profile/settings/page.js`)
  is now clickable, opening a new `PhoneChangeForm` sheet — new-number entry step then
  an OTP step reusing the existing `OtpInput` component (resend cooldown, 6-digit
  auto-advance). On success calls `setSession(user)` so the change reflects instantly
  without a reload. `authService.js` got two new methods
  (`requestPhoneChangeOtp`/`confirmPhoneChange`) following the existing calling
  convention.
Verified live end-to-end: logged in as a test member, changed their number via the
real UI (request OTP → real 6-digit code → verify), confirmed the new number shows
immediately in Profile Settings and survives a hard page reload (real DB write +
re-issued cookie, not just client state). Also verified both guards directly against
the API: requesting a change to your own current number → 400 "already your current
number"; a second account requesting a change to a number already owned by the first
account → 409 "already registered to another account".

## Task 9 — Wishlist heart should turn red/filled on add ✅
Root cause was CSS, not the toggle/id logic (`bookId` plumbing turned out fine —
verified `book.bookId` is populated end-to-end from both `discovery.service.js` and
`listings.service.js`, and `isWishlisted`/`toggleWishlist` in `AppDataContext.js` work
correctly). The shared `Icon.js` renders every icon as `<svg fill="none" stroke=
"currentColor">…</svg>`; `globals.css`'s rule `.wish-btn.on .ic{fill:var(--maroon)}`
set `fill` on the *outer wrapper span* (`.ic`), one level too high — the `<svg>`'s own
hardcoded `fill="none"` attribute is a specified value on that exact element, which
blocks CSS inheritance from any ancestor (an SVG presentation attribute has the
lowest cascade priority, but it still beats inheriting from a parent). So the color
change never reached the actual heart path; only the invisible wrapper span picked it
up. Fixed by targeting the `<svg>` one level deeper:
`.wish-btn.on .ic svg{fill:var(--maroon)}` in `apps/web/app/globals.css` — a real CSS
rule against that element does override the presentation attribute.
Verified live: reproduced the bug in an isolated DOM snippet first (confirmed
`getComputedStyle(path).fill` stayed `none` with the old CSS, `rgb(124,31,46)` i.e.
`var(--maroon)` with the fix), then re-verified against the real app — created a real
test listing, wishlisted it from a second real account via the actual UI button,
confirmed the rendered heart's computed `fill` is maroon, confirmed it survives a
page reload (persisted, not just optimistic client state), and confirmed un-wishlisting
correctly reverts every heart on the page back to `fill: none`.

## Task 10 — Admin panel: real auth (mobile OTP, not email/password) + make every screen actually fetch data ✅
Diagnosis first (via research agent): the backend/frontend data-fetching plumbing for
all 7 admin screens was already correct end-to-end (guard → service → controller →
frontend service → `AppDataContext` → page) — the real bug was that admin auth
failures were **invisible**: `app/admin/page.js`'s dashboard fetch had no `.catch()`
at all (unhandled rejection), every other admin page did `.catch(() => {})` (silently
swallowed), and nothing anywhere redirected to `/admin/login` on a 401 — so an
invalid/missing/expired admin session just rendered an empty console with no error
and no bounce to login, which is exactly what made it *look* completely broken.
- **Schema**: `AdminUser.passwordHash` dropped, `phone String @unique` added,
  `email` made optional (kept only as a contact field, never used for login).
  Hand-authored migration `20260824120000_admin_phone_otp_auth` (backfilled the one
  existing bootstrap row's phone before enforcing `NOT NULL`+unique, since
  `prisma migrate dev`'s interactive data-loss prompt doesn't work in this
  non-interactive shell) — applied with `prisma migrate deploy` + `prisma generate`.
- **Backend**: `AuthModule` now exports `OtpService` too (was `AuthService`-only) so
  `AdminModule` can reuse it — `admin-auth.controller.js` gets new
  `POST /admin/auth/otp/request` / `POST /admin/auth/otp/verify` (namespaced
  `purpose: 'admin-login'`, so it can never collide with a member or phone-change OTP
  for the same number — same Redis namespacing added in Task 8) and a new
  `GET /admin/auth/me`. `admin-auth.service.js`'s bcrypt `login(email, password)`
  replaced with `findByPhone(phone)` / `login(phone)` (lookup only — admins are
  seeded/DB-provisioned, never self-signup). `AdminAuthGuard` untouched (already
  cookie/JWT-based, just needed a valid admin row to check against).
- **Seed**: `ADMIN_BOOTSTRAP_PHONE` env var replaces `ADMIN_BOOTSTRAP_EMAIL`+
  `ADMIN_BOOTSTRAP_PASSWORD` for creating the first SUPER_ADMIN row.
- **Frontend**: `/admin/login` rewritten as phone → OTP (mirrors the member
  `OtpInput`/resend-cooldown pattern from `OtpVerifyForm.js`). `admin.service.js` gets
  `requestOtp`/`verifyOtp`/`me`, drops `login(email,password)`.
- **Fixed the actual "nothing loads" bug**: `AdminShell.js` now calls
  `adminService.me()` on every admin route change and redirects to `/admin/login` on
  failure — this is the piece that was completely missing. Also fixed
  `AdminSidebar.js`'s "Log Out" button, which never actually called the logout
  endpoint (`kitabx_admin_session` cookie was never cleared, just discarded
  client-side) — now calls `adminService.logout()` first.
Verified live end-to-end: logged in through the real phone+OTP UI, landed on a
dashboard showing real counts (13 users, 13 listings, 6 completed exchanges) matching
a direct API call; every other screen — Users (13 real rows), Societies (3, real
member/listing counts), Book Moderation (real empty state, 0 open listing reports),
Exchanges (7 real rows), Credits Ledger (6 real rows), Reports (real rows), Settings
(real saved values) — confirmed showing real DB data, not placeholders. Confirmed the
401→redirect fix by clearing the admin cookie and hitting `/admin/users` directly —
correctly bounced to `/admin/login` instead of the old silent-empty-page. Confirmed
"Log Out" now really calls the backend (`POST /admin/auth/logout` → 201) before
redirecting. **Report → resolve → notify loop**: submitted a real report from a
member account, resolved it through the real admin Reports UI, and confirmed the
reporting member received a real notification ("Your report was reviewed") both via
the API and rendered in their actual `/notifications` page.

## Task 11 — Redesign the 3-photo uploader (fixed cover slot + swipeable gallery) ✅
- `PhotoUploader.js` rewritten: three fixed, labeled slots in one row ("Cover",
  "Photo 2", "Photo 3") instead of a growing list + trailing add button. Slot 1 is
  always the cover; slots 2–3 unlock only once the previous slot is filled, so
  `photos[0]` is always the cover and removing any slot shifts the rest up (no gaps,
  no re-ordering surprises) via a plain `filter`.
- `BookDetailView.js`: the cover (`photos[0]`) was already shown first at the top of
  the page (from Task 3's fix) — added a new `ConditionPhotoGallery` component that
  pages through `photos.slice(1)` (the 2 condition photos) with working prev/next
  arrow buttons (new `.cp-nav` CSS) and dots that reflect the real active index
  (previously static/decorative — the 3 dots were hardcoded with the first always
  "on" and did nothing). Falls back to the cover itself (or the generated
  placeholder) when there's nothing else to page through.
Verified live: rendered the manual "Book details" form and confirmed 3 labeled slots
in one row, with slots 2–3 correctly `disabled` until slot 1 (cover) is filled.
Created a real 3-photo listing via the API and opened its detail page as a different
(non-owner) member: confirmed the top cover shows `photos[0]`, the condition-photo
card starts on `photos[1]` with 2 dots (first active), clicking next advances to
`photos[2]` (dot moves), and clicking next again wraps back to `photos[1]` —
same for prev in the other direction.

## Task 12 — Home page stat tiles must be real, platform-wide, non-personal counts ✅
Root cause: "Books listed" and "Members" were reading `mySociety?.activeListingCount`/
`memberCount` — real numbers, but scoped to only the viewer's own society, not the
whole platform. "Societies" (`societies.length`, from the public societies list used
by the signup dropdown) was already correctly platform-wide by coincidence.
- Backend: new `GET /discovery/stats` (`discovery.controller.js` /
  `discovery.service.js#stats`, same `JwtAuthGuard` as the rest of that controller)
  returns `{ totalBooks, totalMembers, totalSocieties }` from real
  `prisma.bookListing.count({status:'ACTIVE'})` / `user.count({isActive:true})` /
  `society.count({isActive:true})` — no scoping, no hardcoding.
- Frontend: `discoveryService.stats()` added; `app/(main)/home/page.js` now fetches
  it once on mount and wires all 3 non-personal tiles to it (dropped the
  `useSocieties()`/`mySociety` lookup entirely — the stats endpoint is now the single
  source for all three). "My wishlist" untouched — still genuinely personal
  (`wishlist.length`).
Verified live: called `GET /discovery/stats` directly (8 books, 15 members, 4
societies — real current DB state) and confirmed the home page's tiles render the
exact same numbers, with 0 hardcoded/dummy values anywhere in the chain.

## Task 13 — Email OTP as an alternate login method (user + admin), SMTP-driven ✅
**Design decision (flagging, not assuming silently):** phone stays the one required
identity for a member account — `User.phone` is `@unique`/`NOT NULL` and everything
downstream (handover, notifications, phone-change from Task 8) depends on every
member always having one. So email-OTP is **sign-in-only** for an account that
already has an email on file — never a way to create a brand-new phone-less account.
A member adds their email once (self-service, OTP-verified, in Profile Settings);
after that it works as a second door into the same account. Same rule for admins,
except an admin's email is provisioned via seed/DB (consistent with Task 10's "admins
are never self-signup") rather than a self-service UI.
- **Schema**: `User.email String? @unique` added (hand-authored migration
  `20260824130000_add_user_email` — nullable column, no backfill needed).
  `AdminUser.email` already existed (added optionally in Task 10).
- **Backend**: new `EmailService` (`auth/email.service.js`) — nodemailer-based,
  mirrors `SmsService`'s pattern exactly (logs to console until `SMTP_HOST`/
  `SMTP_USER`/`SMTP_PASS` are set, real SMTP after). `OtpService` refactored to
  extract the shared generate/store/cooldown logic into `_issueCode()`, so
  `requestOtp` (SMS) and the new `requestEmailOtp` (email) both reuse it —
  `verifyOtp` was already channel-agnostic. New `normalizeEmail()` validator in
  `common/validate.js`.
  - Member: `POST /auth/otp/request-email` + `verify-email` (public, login only —
    404s with a clear message if no account has that email) and
    `POST /auth/email-change/request` + `verify` (authenticated, same uniqueness-
    check + re-issue-session pattern as Task 8's phone-change).
  - Admin: `POST /admin/auth/otp/request-email` + `verify-email`, reusing
    `AdminAuthService.findByEmail`/new `loginByEmail` (lookup only, matching the
    phone flow's no-auto-create rule).
- **Frontend**: `authService`/`adminService` get the matching methods. Member sign-in
  tab (`AuthForm.js`) gets an inline two-step "Or continue with email" toggle (email
  entry → `OtpInput` verify, reusing the same component as phone). Admin login page
  rewritten with the same phone/email toggle. Profile Settings gets a new "Email" row
  (`Add an email address` when unset) opening an `EmailChangeForm` sheet, identical
  shape to Task 8's `PhoneChangeForm`. `toSelfUser` now includes `email`.
- **Env**: `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` placeholders
  added to both `.env` and `.env.example` — real values to be filled in separately.
Verified live end-to-end, all with the console-logged `devCode` (no real SMTP
configured yet, exactly like SMS): (1) added a real email to a test member's account
via Profile Settings → OTP → saved, confirmed it now shows there. (2) Logged out,
signed back in via email-OTP through the actual `/login` UI (toggle → email → code →
landed on `/home` as the correct member, confirmed via `/auth/me`). (3) Logged into
the admin console via email-OTP using the bootstrap admin's seeded email, landed on a
real dashboard. (4) Confirmed the login-only boundary: requesting an OTP for an email
with no matching account returns a real 404 ("sign in with your phone number"), not a
silent account creation.

## Task 14 — Schedule pickup: fix the owner-vs-requester workflow ✅
Diagnosis first (via research agent): the backend was already almost entirely
correct — `PickupService#propose()` already flips `proposedById` to whoever calls it
while a proposal is still pending, `confirm()` already rejects a proposer confirming
their own proposal, and the exchange DTO (`ExchangesService#_toDetail`) already sends
`pickup.proposedById` and a viewer-relative `name`. The bug was 100% frontend:
`PickupScheduler.js` branched only on `exchange.stage` (identical for both parties)
and never compared `pickup.proposedById` to the logged-in user's own id — so both
sides always rendered the exact same "waiting for X" screen, including a button
literally labelled "{partner} confirms" that actually called the *viewer's own*
confirm endpoint (which the backend would correctly reject, just with a confusing,
silently-toasted error). "Suggest another time" was wired to a real, working
endpoint, but had no picker UI once a pickup already existed — it silently resubmitted
whatever stale default values were sitting in local state, so it looked like a no-op.
- `PickupScheduler.js`: added `amProposer` (`pickup.proposedById === session user id`,
  via `useAuth()`). The `pickup-proposed` stage now renders two genuinely different
  views: the proposer sees ⏳ "Waiting for {other} to confirm" with only "Suggest a
  different time" / "Cancel exchange" (no confirm button — matches the backend's
  self-confirm rejection); the other party sees 📅 "{other} suggested a pickup time"
  with "Confirm this time" / "Suggest a different time" / "Cancel exchange".
- New `SuggestTimeForm` sheet component (reuses the same date/slot/pickup-point
  `PillSelect`s as the initial-propose form, pre-filled from the pending pickup) —
  "Suggest a different time" now opens this real picker for *either* role and submits
  genuinely chosen values via the existing `propose()`/`POST /requests/:id/pickup`
  endpoint (no new backend route needed — reusing it as a counter-proposal is exactly
  what already flips `proposedById` correctly).
- Same viewer-relative-copy bug existed one level up, on the exchange detail page's
  "Next step" note and timeline sub-label (`lib/exchange.js#nextAction`/
  `buildTimeline`, both always said "waiting for the other party" regardless of who
  actually owed a response) — fixed alongside it for consistency, since a user would
  otherwise see contradictory copy between the exchange detail screen and the pickup
  screen. Both functions now take a `viewerId` param; `ExchangeDetailView.js` passes
  `useAuth().user.id`.
Verified live end-to-end with two real accounts across a real accept → propose →
counter-propose → confirm cycle: (1) proposer's pickup screen showed the waiting view
with no confirm button; (2) the other party's screen showed "suggested a pickup
time" + working Confirm/Suggest-different buttons; (3) submitting a genuinely
different date/slot/point via the new picker sheet correctly flipped which side was
waiting — verified both parties' screens updated to match; (4) confirming from the
now-correct side moved the exchange to "Pickup confirmed" and the detail page's next
step to "Verify the handover"; (5) confirmed the exchange-detail page's "Next step"
note and timeline label are also role-correct at every stage of the above.

## Task 15 — Refine Gemini book-detection: better accuracy from cover images + faster ✅
**Root cause of "sometimes can't detect anything":** the old prompt told Gemini to
report a book's title *only if the text itself was legible* ("never guess a title
you cannot read") — so any photo that wasn't a crisp, straight-on, well-lit shot
(angled, blurry, small text, partial occlusion) came back with zero candidates, even
though the book was often visually identifiable from its cover design alone.
- **Prompt** (`gemini.service.js`): now explicitly tells the model to recognize books
  from cover design/artwork/layout, not just literal legible text — a book should
  only be skipped entirely if it's truly unidentifiable, with visual-only guesses
  tagged `"low"` confidence so the review screen never overstates them. Still
  forbids inventing an ISBN.
- **Structured output**: added `generationConfig.responseMimeType: 'application/json'`
  + an explicit `responseSchema` (was free-text + regex-extracting a JSON array out
  of it, including markdown-fence stripping). This guarantees schema-conforming JSON
  with no wrapping prose — `_parseCandidates` is now a plain `JSON.parse`, removing
  an entire class of "the model added a preamble and the regex/parse failed →
  silently empty result" failures. Also set `temperature: 0.1` (deterministic
  extraction, not creative variation) and `maxOutputTokens: 2048` (caps runaway
  generation).
- **Speed**: `apps/web/components/ui/UploadBox.js` now takes an optional
  `resizeOptions` prop forwarded to its existing client-side `resizeImageFile` call
  (previously hardcoded to the single-cover-photo default of 1280px/0.82 quality for
  every caller). The bulk-upload page passes `{maxWidth: 1600, quality: 0.85}` —
  enough to keep several book covers legible in one frame, still far below a raw
  phone photo's 4000px+, which cuts upload size and the vision-token cost that scales
  with image resolution. (Caught and fixed a real bug while wiring this up: my first
  pass added a *second*, redundant resize call inside the bulk page itself — but
  `UploadBox` was already resizing before handing the file over, so that second call
  was a wasted no-op re-compression pass, not the intended "keep more resolution for
  multi-book photos" behavior. Fixed by threading the wider `resizeOptions` into
  `UploadBox`'s own resize call instead, and removed the redundant one.)
- Benchmarked structured vs. free-text output directly against the live Gemini API
  (3 trials each, same image): free-text ranged 9.7s–**89s** (one very slow outlier);
  structured stayed a consistent 5.8s–17.2s. Median latency is roughly comparable,
  but structured output avoids the catastrophic tail latency, which matters more for
  perceived "speed" than the median — a 90-second hang is a far worse experience than
  a consistent ~12s response even at the same average.
Verified live end-to-end through the real UI (synthetic file drop → real client-side
resize → real upload → real Gemini call → real Google Books matching → real render):
a photo of a stack of 8 different real business books, several partially obscured/at
an angle, was correctly identified as 8 distinct real titles, each matched to real
Google Books metadata with "✓ High match" — including titles Gemini could only have
gotten right via cover-design recognition, not perfect OCR, directly confirming the
accuracy fix. Also directly verified a single-cover photo resolves via genuine visual
recognition (a stock photo correctly identified as "Milk and Honey" by Rupi Kaur).

## Task 16 — Live data updates without manual page refresh ✅
Research first: chat already has a real, working Socket.IO layer (`chat.gateway.js`
+ `lib/socket.js`) — an open chat thread already gets the other party's messages live
via `message:new`. Everything else (requests/exchanges, the chat *list*, notifications)
was pure fetch-once REST with zero refresh while a screen sat open — exactly the
complaint. Went with polling for those (explicitly one of the two options the plan
called for), since building out socket events for every request/pickup/notification
mutation across every backend service would be a far larger, riskier change for the
same user-visible result.
- New `apps/web/hooks/useInterval.js` — runs a callback every N ms, skipping (not
  tearing down) a tick when `document.hidden` or the device is offline, so a
  backgrounded tab doesn't keep polling. Follows the existing `useDebounce`/
  `useOnlineStatus` hook conventions already in `apps/web/hooks/`.
- `AppDataContext.js`: one shared 15s interval (gated on a real session) refreshes
  `exchanges` + `chatThreads` + dispatches `fetchNotifications()` — covers the
  Requests tab, Exchange list, Chat list, and the notification bell/badge in one
  place, since they all read from this same context/Redux state.
- `ExchangeDetailView.js` and `PickupScheduler.js` (the two "actively watching one
  thing" screens, and exactly where Task 14's "waiting for the other party" problem
  lives) each poll `refreshExchangeDetail(id)` on a tighter 8s interval while mounted
  — stops once the exchange reaches a terminal/completed stage (detail view) or once
  a pickup is no longer pending (pickup view), so there's nothing left to watch for.
Verified live end-to-end with two fully independent real sessions (one driven via
curl, untouched browser driving the other) — no manual reload at any point:
(1) created a new book request from one account while the owner sat on the Requests
page; it appeared automatically within the polling window. (2) Combined with Task 14:
proposed a pickup as the owner, then counter-proposed a different time from the other
account via a direct API call while the owner's pickup screen stayed open — the
screen live-updated from "waiting for them to confirm" to "they suggested a time —
confirm or suggest another" with the new date/slot/location, entirely on its own.
(Also had to explicitly verify the tab-hidden guard against a false negative: this
headless test browser reports `document.hidden: true` even when "fronted," which
correctly paused polling — confirmed by temporarily overriding it in-session, not a
product bug, just this specific automation harness not registering as a focused tab
the way a real user's browser would.)

## Task 17 — Credit transaction history: per-row delete + "Clear all" ✅
Design decision: like Task 4's chat delete, this is "delete for me" on the row's
*visibility*, not a real ledger deletion — `CreditTransaction` rows back real balance
history (§10: "transactions are the source of truth") and the admin Credits Ledger
screen (Task 10) reads from this same table, so hard-deleting would corrupt the
audit trail. A new nullable `hiddenAt` column does the hiding; balances themselves
are never touched.
- DB migration `credit_transaction_hidden_at`: `CreditTransaction.hiddenAt
  DateTime?`. `CreditsService#getHistory` now filters `hiddenAt: null`; the admin
  ledger (`admin.service.js#creditsLedger`, filtered to `ADMIN_ADJUSTMENT` rows only)
  is untouched and unaffected either way.
- Backend: `DELETE /credits/transactions/:id` and `DELETE /credits/transactions`
  (`credits.controller.js` / `credits.service.js#deleteOne/deleteAll`) — `updateMany`
  scoped by `userId`, sets `hiddenAt = now()`, returns `{ success: true }`.
- Frontend: `creditsService.deleteTransaction/clearHistory` +
  `AppDataContext#deleteCreditTransaction/clearCreditHistory` (local state filtered,
  no full refetch needed since hiding never changes the balance). `credits/page.js`
  gets a ✕ on every transaction row and a "Clear all" link next to the "Transaction
  history" heading, matching Task 5's notification-delete UI pattern.
Verified live: logged in as a real member with 2 real pending-credit transactions,
deleted one via its ✕ (`DELETE .../transactions/:id` → 200, row vanished, survived a
hard reload, "Pending" balance stayed at 2 — confirming it's a view-only hide, not a
balance change), then used "Clear all" (`DELETE .../transactions` → 200, list now
empty, also survived a reload, balance still untouched).

## Task 18 — Use the uploaded book-cover photo everywhere a book's image appears ✅
Audited every surface that renders a book image. Discovery grid, My Shelf, and Book
Detail were already correct (Task 3); the "seller's books" sheet (`useAppSheets.js`)
and Book Detail's condition-photo gallery (Task 11) read from the same already-fixed
`books`/listing DTOs, so no change needed there either. The admin panel never renders
book images at all (`admin/listings/page.js` is a text-only table — Book/Owner/Reason/
Action), so nothing to fix there. There is no separate "chat thread book-context
card" component in this codebase (chat only shows the book title as text) — nothing
to fix there either since it doesn't exist.
Found two real, confirmed gaps:
- **Exchange/request cards**: `exchanges.service.js`'s shared `REQUEST_INCLUDE` never
  fetched the listing's `photos` from Prisma at all, and neither `_toCard` (feeds
  `ExchangeCard.js`, used by the Requests page and Exchange list) nor `_toDetail`
  (feeds `ExchangePartnerCard.js` on the exchange detail page) put `photos` in the
  DTO — so these two cards always showed the generated placeholder, never the real
  photo, regardless of what the listing actually had. Fixed by adding
  `photos: { orderBy: { sortOrder: 'asc' } }` to the shared include and
  `photos: request.listing.photos.map((p) => p.imageUrl)` to both DTO methods, then
  threading `photos: exchange.photos` through in the two frontend components (which
  were building a stripped-down `{title, author, cov}` object for `BookCover` instead
  of passing `photos` along).
- **Wishlist**: `wishlist.service.js#list()` never fetched/returned the active
  listing's photos either — same fix, `photos` added to the `activeListing` include
  and mapped into the returned row (`[]` when no active listing exists to have
  photos from).
Verified live end-to-end with real accounts and real data (no shortcuts): created a
fresh listing owned by a real member with a real uploaded photo, had a second real
account request it — confirmed the owner's incoming-request card
(`ExchangeCard.js`) rendered the real `<img>`, not the placeholder; accepted it and
confirmed the exchange detail page's `ExchangePartnerCard` also rendered the real
photo, both via the actual browser DOM. Separately created a second real listing
with a photo, wishlisted it from the second account, logged into that account
through the real sign-in UI, and confirmed the Wishlist page also renders the real
photo, not the placeholder.

---

## Round 3 — new requests, added 2026-08-24 (⬜ not started — hold until told to begin)

## Task 19 — Replace "Chat with Support" with "Chat on WhatsApp" (user profile) ✅
- `lib/constants.js`: dropped `SUPPORT_EMAIL`/`SUPPORT_PHONE` (now unused), added
  `SUPPORT_WHATSAPP_NUMBER` (placeholder, digits-only per `wa.me` link requirements)
  + derived `SUPPORT_WHATSAPP_LINK` — the config value to swap in once the real
  business number is supplied.
- `Icon.js`: added a `whatsapp` icon.
- `app/(main)/profile/page.js`: the "Chat with support" menu row now reads "Chat on
  WhatsApp" with the new icon, and `onClick` opens `SUPPORT_WHATSAPP_LINK` in a new
  tab instead of the old in-app support-ticket sheet.
- Removed the now-fully-dead code this left behind: the `support()` sheet callback
  in `useAppSheets.js` (and its now-unused `SUPPORT_EMAIL`/`SUPPORT_PHONE`/
  `SupportForm` imports) and the `SupportForm.js` component itself (deleted — it had
  no other caller). Left the *separate* "Chat with support" trigger inside
  `app/(main)/layout.js`'s suspended-account overlay untouched — that's a distinct
  emergency-contact surface outside this task's explicit "user profile" scope, not
  the same code path.
Verified live: profile page now shows "Chat on WhatsApp" with the new icon rendering
correctly (real DOM check, not just a diff read); clicking it — with `window.open`
intercepted to inspect the argument rather than actually navigate — confirmed it
opens exactly `https://wa.me/911234567890` (the placeholder link built from the new
constant); confirmed no console errors on a fresh tab load.

## Task 20 — Auto-disable chat 7 days after exchange completion ✅
- New `exchange-chat-disable.service.js` (in `scheduled-tasks/`), `@Cron` hourly —
  finds every `Exchange` with `status: 'COMPLETED'` and `completedAt` more than 7
  days ago whose linked conversation (`request.conversation`, the same 1:1 relation
  `chat.service.js` already uses) is still `ACTIVE`, and disables it via the
  existing `ChatService#disableForRequest` — the same method `RequestExpiryService`
  already uses for the unrelated 48h-no-response case, just triggered by completion
  instead of expiry, per the plan's own note. Registered in
  `scheduled-tasks.module.js`. No DB changes needed — `Exchange.completedAt` and
  `Conversation.status`/`disabledAt` already existed.
Verified live with the real cron running (not a unit-test shortcut): backdated a
real completed exchange's `completedAt` to 8 days ago via a direct DB fixture,
temporarily sped the `@Cron` interval up to every 10 seconds to observe it within
this session (reverted to the real hourly schedule immediately after and confirmed
a clean restart with it back in place), and confirmed: the conversation flipped
from `ACTIVE` to `DISABLED` with a real `disabledAt` timestamp; the requester's real
`/chat/threads` API response showed `"disabled": true` for that thread; and a real
attempt to send a message into it was rejected server-side with 403 "This chat has
been closed" (the pre-existing guard in `sendMessage`, now correctly fed by this
new trigger).

## Task 21 — Remove "radius" option from admin panel settings ✅
Confirmed nothing else depends on it first: `AppDataContext`'s `loadAdminSettings`/
`saveAdminSettings` (which fed the field) were its only readers, and the admin
page's `dispatch(setRadiusKm(...))` after save only ever touched the *admin's own*
Redux session — the real per-user Discover-page radius stepper
(`locationSlice.js`) has its own hardcoded `0.5` initial state and never read this
admin setting at all, so it was already fully non-functional as a "default", not
just redundant.
- Removed the "Default Discovery Radius (km)" field from `admin/settings/page.js`
  (and its now-unused `useDispatch`/`setRadiusKm` import).
- `AppDataContext.js`: dropped `defaultRadiusKm` from `adminSettings` state and both
  `loadAdminSettings`/`saveAdminSettings`.
- `admin.service.js`: dropped `defaultRadiusKm` from `DEFAULT_SETTINGS` (`AppSetting`
  is a generic key/value table, no schema/migration needed either way).
- Deleted the one real `defaultRadiusKm` row already sitting in `AppSetting` from
  earlier testing, so the API response is genuinely clean, not just ignored by the
  frontend.
Verified live: logged into the real admin console, confirmed the Settings screen no
longer shows the radius field; `GET /admin/settings` returns only
`{supportEmail, supportPhone}`; saved the form and confirmed `PATCH /admin/settings`
still returns 200 with the two remaining fields intact.

## Task 22 — Add delete option to admin Societies section ✅
Checked the schema first: `User.societyId`/`BookListing.societyId` are required FKs
into `Society` with no cascade, so a real `DELETE` would throw a foreign-key error
on any society that already has members or listings (i.e. all of them) — a hard
delete was never viable here. Went with the same soft-delete pattern already used
for `Society.isActive` (which `listSocieties()` already filters on) and for
`removeListing`'s `status: 'REMOVED'`.
- Backend: `admin.service.js#removeSociety` — sets `isActive: false`, records an
  audit-log entry (`SOCIETY_REMOVED`, matching `removeListing`'s convention). New
  `DELETE /admin/societies/:id` route in `admin.controller.js`.
- Frontend: `adminService.removeSociety` + `AppDataContext#deleteAdminSociety`
  (refetches the list after, same pattern as add/edit). `admin/societies/page.js`
  adds a "Delete" button next to "Edit" on every row, opening a confirm sheet
  (`useSheet`, globally available even on admin routes via the root `Providers`
  tree) — explicitly called out as needed since this is destructive, unlike the
  no-confirm pattern the existing "Remove" listing action uses.
Verified live: created a real disposable test society through the actual admin UI,
clicked its new "Delete" button, confirmed the sheet showed the right name/member/
listing counts, confirmed deletion — `DELETE /admin/societies/:id` → 200, row
disappeared from the list. Confirmed via a direct DB read that the row still exists
with `isActive: false` (soft-deleted, not destroyed) rather than gone entirely.

## Task 23 — User-settable location in profile, drives listing/home scoping ✅
Discovery is already 100% scoped by `User.societyId` (`discovery.service.js`:
same-society first, then nearby societies by PostGIS radius) and the backend's
generic `updateProfile` already accepted `societyId`/`blockId`/`flatUnit` — this
was a real, working capability with zero frontend UI ever exposing it. Purely a
frontend task.
- New `LocationChangeForm` (in `profile/settings/page.js`, alongside the existing
  `PhoneChangeForm`/`EmailChangeForm`) reuses the exact `SocietyFields`
  City → Society → Block component from onboarding, pre-filled from the current
  user, so the signup and change-later flows never drift apart. Includes
  `flatUnit` in the same form/save call (rather than leaving it half-covered by
  `SocietyFields`'s bundled flat input) and calls `setSession(updated)` on success
  so Discover/home re-scope immediately without a manual reload.
- Profile Settings' "Location" group: the existing "Flat / Unit" row and a new
  "Society" row (showing `block, society name`) both open this same form now,
  instead of two independent, divergent editing paths for related fields.
Verified live end-to-end with a real account: opened the form, confirmed it was
pre-filled with the current city/society/block, switched to a different real
society (Palm Meadows, Andheri), saved — `PATCH /users/me` succeeded, Profile
Settings immediately showed the new society. Navigated to the home page: it now
displays "Palm Meadows, Andheri" and Discover correctly shows "No books nearby
yet" (that society's real, distinct empty state) rather than any of the old
society's listings — confirming live re-scoping, not a cached view. Survived a
hard reload; confirmed via a direct `/auth/me` call that the new society is a
real DB write, not just client state.

## Task 24 — Consolidate all reports into Book Moderation, with full detail ✅
"Not scattered elsewhere" meant genuinely moving user/listing reports out of the
general Reports section, not just duplicating them into Book Moderation too — done
on both ends.
- Backend (`admin.service.js`): `listFlaggedListings()` extended with the missing
  detail (`reporter`, `message` = the report's free-text `description`, `createdAt`).
  New `listFlaggedUsers()` — same shape for `reportedUserId`-type reports
  (`reportedUser`, `reporter`, `reason`, `message`, `createdAt`). `reports()` (the
  general queue) now excludes both types (`reportedUserId: null, listingId: null`),
  so they can't show up in both places at once — see the note below on what that
  leaves in the general Reports section.
- **Real bug found and fixed**: `removeListing` (the moderation action for a
  flagged listing) never touched the `Report` row's status — a resolved-by-removal
  listing's report stayed `OPEN` forever and would have kept reappearing in the
  flagged queue indefinitely. Now closes every open report against that listing via
  the existing `ReportsService#adminResolve` (newly injected into `AdminService` —
  `ReportsModule` was already available to `AdminModule`) — same reporter
  notification (`"Your report was reviewed"`) as resolving a user report.
- Frontend: `admin/listings/page.js` (Book Moderation) rewritten with two tabs —
  "Listing Reports" (Book/Owner/Reported By/Reason/Message/When/Remove) and "User
  Reports" (Reported/Reported By/Reason/Message/When/Resolve) — covering the "each
  with an action tab" + full-detail requirement literally. New
  `GET /admin/users/flagged` route + `adminService.listFlaggedUsers` +
  `AppDataContext#loadAdminFlaggedUsers/resolveFlaggedUser` (reusing the existing
  generic `POST /admin/reports/:id/resolve`, not a new endpoint).
**Flagging, not assuming silently:** the general Reports section (`admin/reports/
page.js`) now correctly shows "No reports filed" — not broken, just empty, because
nothing currently writes a `Report` row with neither `reportedUserId` nor
`listingId` set. Real bug/support reports (`reportBug`) actually write to a wholly
separate `SupportRequest` table that **no admin endpoint reads at all today** —
Task 25 will need to build that read path from scratch, not just re-point this
page at existing data.
Verified live with real data — a mix of genuine pre-existing production reports
(from actual earlier product testing) and two reports I filed through the real API
for this check: Book Moderation's two tabs showed correct counts and full detail
(book/reporter/message/reason/timestamp for listings; reported-member/reporter/
message/reason/timestamp for users). Clicked "Resolve" on a real user report —
row disappeared, count dropped, and the reporter's real `/notifications` showed
"Your report was reviewed". Clicked "Remove" on a real flagged listing — row
disappeared, and confirmed via the reporter's notifications that the *report* was
also auto-resolved this time (`"The reported listing was removed by an admin"`),
proving the bug fix. Confirmed the general Reports page now shows "No reports
filed" — the data is gone from there, not duplicated.

## Task 25 — Admin Reports section limited to webapp/bug reports only ✅
As flagged at the end of Task 24: `reportBug()` always wrote to a real
`SupportRequest` table (a real, working `OPEN`/`IN_PROGRESS`/`RESOLVED` workflow
already in the schema) that literally no admin endpoint had ever read — this was
the actual reason the Reports section only ever showed user/listing reports before
Task 24, never bug reports at all.
- `reports.service.js`: new `adminListSupportRequests(status)` and
  `adminResolveSupportRequest(id, adminId)` (parallel to the existing Report-model
  `adminList`/`adminResolve`) — the latter notifies the reporter
  ("Your report was reviewed... thanks for helping us improve KitabX") and audit-
  logs `SUPPORT_REQUEST_RESOLVED`, matching the existing resolve-and-notify
  convention exactly.
- `admin.service.js#reports(status)` repointed from the `Report` table to
  `reportsService.adminListSupportRequests(status)` — this method (and its
  `GET /admin/reports` route) had no other caller left after Task 24, so
  repointing it in place was correct rather than adding parallel dead routes.
  New `resolveSupportRequest`/`POST /admin/support-requests/:id/resolve` — kept
  fully separate from the existing `POST /admin/reports/:id/resolve` (still
  Report-model, still used by Book Moderation's User Reports "Resolve") so the two
  sections' resolve actions can never cross-wire.
  (Caught and fixed a naming collision while wiring this up: `AdminService`'s
  constructor originally assigned the injected `ReportsService` to `this.reports`,
  which silently shadowed the class's own `reports()` method — renamed the
  property to `this.reportsService`.)
- `admin/reports/page.js` rewritten around the real `SupportRequest` shape:
  Reported By / Type (Bug/Support/Account/Other) / Screen-Subject / Message /
  Status / When / Resolve.
Verified live: submitted a real bug report through the actual
`POST /support-requests` endpoint, confirmed it appeared in the real admin Reports
UI with full detail; resolved it — row flipped to "Resolved" with no button left,
and the reporter's real `/notifications` showed the new bug-specific message.
Also saw genuine pre-existing production data here for the first time ever
(older real bug/support submissions that had been invisible to admins until this
fix). Confirmed Book Moderation (Task 24) is completely unaffected — reloaded it
and its Listing/User Reports tabs still show their own correct counts, proving the
two sections' data and resolve actions never cross-wired.

## Task 26 — New "Account Deletion Requests" admin section ✅
Same gap shape as Tasks 24/25 again: Profile Settings' "Request account deletion"
(built in round 1) only ever set `User.deletionRequestedAt` — no admin endpoint had
ever read it back.
- Backend (`admin.service.js`): `listDeletionRequests()` (`deletionRequestedAt` not
  null, `deletedAt` null). `actionDeletionRequest(userId, adminId)` — soft-deletes
  (`deletedAt` + `isActive: false`, the same column every admin count/listing query
  already filters on) rather than a hard delete, given the User model's huge FK
  surface (listings, exchanges, credits, chat, ratings...) — same reasoning as
  Task 22's society soft-delete. `JwtAuthGuard` already rejects any request where
  `deletedAt` is set, so the account is locked out immediately with no extra step;
  no notification is sent since a deleted account can't sign back in to see one.
  `rejectDeletionRequest(userId, adminId)` — clears `deletionRequestedAt`, account
  stays fully active, and *does* notify the member (mirrors the existing
  verification-reject notification pattern). Both audit-logged.
- Three new routes under `/admin/deletion-requests`; new nav entry ("Account
  Deletions") in `AdminSidebar.js`; new `admin/deletion-requests/page.js` — Member /
  Phone / Member ID / Requested / Delete+Reject actions.
Verified live with two real disposable accounts: submitted a real deletion request
through the actual `POST /auth/account/deletion-request` endpoint for each, saw
both land in the new admin section with real data. "Delete" on the first — row
disappeared, and confirmed via a direct `/auth/me` call that the account is now
hard-locked-out ("Account no longer active", 401), not just hidden from the list.
"Reject" on the second — row disappeared, confirmed via `/auth/me` the account is
still fully active, and confirmed via `/notifications` that the real decline
message was delivered.

## Task 27 — Show mobile number in admin Users section ✅
Pure frontend gap — `admin.service.js#listUsers` already returned `phone` on every
row, just never rendered. Added a "Phone" column to `admin/users/page.js` (right
after Name).
Verified live: real phone numbers now render for every one of the ~19 real users
currently in the table, including the two just-created Task 26 test accounts —
confirming it reads live data, not a placeholder.

## Task 28 — Admin Exchange section: full listing data, owner, status tabs ✅
**Design call, flagging it rather than assuming silently:** `Exchange.status` in the
schema is only `ACTIVE | COMPLETED | CANCELLED | DISPUTED` — no literal "In
Process" state exists at that level. Read "In Process" as the real, already-
modeled distinction between "just accepted, nothing arranged yet" (Active) and
"pickup scheduled, handover pending" (In Process) — i.e. splitting `ACTIVE` on
whether `request.pickup` exists, reusing data the member-facing pickup flow
already relies on rather than inventing a new field. `CANCELLED`/`DISPUTED` don't
cleanly fit any of the 3 named buckets (cancelled is terminal, not "in process")
so they intentionally only surface under "All", not force-fit into one.
- Backend (`admin.service.js#listExchanges`): kept the existing query/columns
  entirely intact per the task's own instruction, and added `request: {include:
  {pickup: true}}` to the include plus new fields — `author`, `genre`,
  `condition`, `listedBy` (the owner — "which user created the listing"), and a
  derived `stage` (`ACTIVE`/`IN_PROCESS`/`COMPLETED`/raw status for anything else)
  used only for the tab filter, not shown as its own column.
- Frontend (`admin/exchanges/page.js`): added Author/Genre/Condition/Listed By
  columns alongside the untouched Book/From→To/Status/Updated ones, plus 4 tabs
  (All/Active/In Process/Completed) with live counts, filtering client-side on
  the new `stage` field. Kept the section title "Exchanges" — already the right
  name for this shape, nothing to rename there.
Verified live against real, existing production data (no fixtures needed — the
platform already had a natural mix): All correctly showed 13 rows including one
`CANCELLED` exchange absent from every named tab; Active correctly isolated to
exactly the 1 real freshly-accepted exchange with no pickup yet; In Process
correctly isolated to exactly the 3 real exchanges with a pickup scheduled but not
yet completed; Completed's 8 matched every real `COMPLETED` row. All new columns
(author/genre/condition/listed-by) rendered real data pulled from the actual
book/listing/owner records for every row.

## Task 29 — Add an "Others" option everywhere report functionality exists ✅
Audited all three real report entry points in the codebase (`useAppSheets.js`'s
`reportListing`/`reportUser`/`reportBug` — confirmed there's no 4th):
- `LISTING_REPORT_REASONS` already had "Other" — no change needed.
- `USER_REPORT_REASONS` (`lib/constants.js`) was missing it — added
  `{ label: 'Other', value: 'OTHER' }`. Feeds every `reportUser` call site (chat
  thread, book-detail owner profile) automatically since they all share the same
  `ReportForm` + reasons list.
- `BugReportForm.js`'s "Which screen?" selector (`SCREENS`) had no escape hatch
  for a report that doesn't fit Discover/My Shelf/Exchange/Chat — added `'Other'`.
Confirmed the `reason-list`-styled selectors elsewhere (`PickupScheduler.js`'s
cancel-a-request reasons, `SortSheet.js`'s sort options) are a different feature
entirely, not report functionality, and left them alone.
Verified live: opened the real "Report a bug" sheet — the screen dropdown now
lists Discover/My Shelf/Exchange/Chat/**Other**. Opened a real "Report user" sheet
from an actual chat thread (Report Block Tester) — the reason list now shows all 6
options ending in **Other**, up from 5.

## Task 30 — Latest-first ordering + new-item badges on 3 admin tabs ✅
**Ordering audit** — checked every admin list query: Users, Deletion Requests,
Book Moderation (both listing + user reports), Exchanges, Credits Ledger, and
Reports (SupportRequest) were **already** `orderBy: createdAt/deletionRequestedAt
'desc'` — nothing to fix. **Flagging, not silently skipping:** `SocietiesService
#listSocieties` orders alphabetically by name, not newest-first, and I left it
that way on purpose — that one query is shared with the *member-facing* signup
society picker (`SocietyFields.js`/`useSocieties()`), where alphabetical is the
correct, expected UX for scanning a dropdown for your own society by name;
switching it to newest-first for the admin's sake would have broken that shared
surface. Societies is also reference/config data, not activity data, so "latest
first" doesn't really apply to it in spirit either.
**New-item badges** — no server-side "seen" state; each admin's browser tracks
its own last-viewed timestamp per badged tab in `localStorage` (seeded to "now"
on first-ever visit so a fresh console doesn't show every historical item as
"new" on day one).
- Backend: `admin.service.js#notificationCounts({usersSince, reportsSince,
  moderationSince})` — three independent `count()` queries (new users created
  after cutoff; new `SupportRequest` rows = Reports tab; new *open*
  listing/user reports combined = Book Moderation tab), each skipped (returns 0)
  when its cutoff is absent. New `GET /admin/notification-counts` route.
- Frontend: new `useAdminNotificationBadges(pathname)` hook — polls the endpoint
  every 30s (reusing the Task 16 `useInterval` hook), and clears (persists "now",
  re-zeros that count) whichever of the 3 tabs' route the admin just navigated
  into. `AdminSidebar.js` renders a small numbered pill (new `.admin-nav-badge`
  CSS) next to Users/Book Moderation/Reports only, next to their nav label.
Verified live: seeded all 3 "last seen" timestamps to 24h ago and reloaded —
confirmed `GET /admin/notification-counts` returned real non-zero counts (4/4/4)
against genuinely new real data created earlier in this session (test accounts,
bug report, user/listing reports), and confirmed all 3 badges actually rendered
in the DOM with those numbers. Clicked into Users, then Reports, then Book
Moderation one at a time — confirmed each tab's badge disappeared exactly when
its tab was opened (3 → 2 → 1 → 0), and that `kitabx_admin_seen_users` etc.
updated to the current time in `localStorage` each time.

## Task 31 — Show report submission timestamp ✅
Already fully satisfied — as anticipated in this plan's own notes, Tasks 24/25's
"full detail" requirement already added a real "When" column (`timeAgo(createdAt)`)
to every report table: both Book Moderation tabs (Listing Reports, User Reports)
and the Reports section. No new code needed; re-verified live rather than
assuming — both Book Moderation tabs and Reports still show real, correct
timestamps for every row ("22h ago", "33m ago", etc.) with no regression.

## Task 32 — Google and Apple sign-in support (admin + user) ✅
Built real, working scaffolding — not a mock — using placeholder credentials, as
agreed given real Google/Apple OAuth client IDs weren't available yet.
**Design call, flagging it rather than assuming silently (same tension as Task
33's own note):** Google/Apple only ever hand back an email, never a phone number,
but `User.phone`/`AdminUser.phone` are required+unique columns the rest of the app
depends on throughout. Rather than a schema change, this follows Task 13's exact
precedent: Google/Apple sign-in is **login-only** for an account that already has
this email on file (a member adds theirs once in Profile Settings; an admin's is
seed/DB-provisioned) — not a way to create a brand-new account.
- Installed `google-auth-library`, `jsonwebtoken`, `jwks-rsa`. New
  `auth/oauth.service.js` — `verifyGoogleIdToken`/`verifyAppleIdToken` do real
  signature verification against each provider's own public keys (Google via
  the official library; Apple via its published JWKS + `jsonwebtoken`), never
  trusting a client-supplied claim as-is. Both throw a clear 503 (matching the
  `GeminiService`/`R2Service` convention) when their client ID env var is unset,
  rather than silently accepting anything.
- New routes, mirroring the existing email-OTP login routes exactly:
  `POST /auth/oauth/google` + `/apple` (member, via `AuthService.findUserByEmail`)
  and `POST /admin/auth/oauth/google` + `/apple` (admin, via the existing
  `AdminAuthService.loginByEmail`) — both issue the real session cookie on
  success.
- Frontend: `lib/googleAuth.js` (loads Google Identity Services, renders Google's
  own branded button) and `lib/appleAuth.js` (loads Apple's JS SDK, runs the real
  popup flow) — both real SDKs, real token retrieval. New shared
  `SocialSignInButtons.js` renders nothing for a provider whose
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID`/`NEXT_PUBLIC_APPLE_CLIENT_ID` isn't set (no
  working button to show without one), used identically by the member sign-in
  tab (`AuthForm.js`) and admin login. New `apple` icon added to `Icon.js`.
- `.env`/`.env.example` (both apps) document exactly where to get real values
  (Google Cloud Console credential, Apple Developer Services ID) — currently
  blank, buttons correctly stay hidden until they're filled in.
Verified live: confirmed all 4 new routes register cleanly with no DI errors.
With the client ID blank, all 3 endpoints correctly return 503 with the
documented message. **Then temporarily set a dummy `GOOGLE_CLIENT_ID`, restarted,
and confirmed a garbage token is genuinely rejected with 401** (backend log showed
`google-auth-library`'s own real parse error, not a stub) — proving the
verification path is real, not a rubber stamp — then reverted the client ID back
to blank. Confirmed the member sign-in tab and admin login both render with no
broken/empty social buttons while unconfigured, and that regular phone-OTP login
still works end-to-end with no regression.
Full end-to-end testing of the actual Google/Apple consent-screen handshake still
needs real client IDs from the user (Google Cloud Console + Apple Developer,
exactly as flagged in this plan back when Round 3 started) — this is a real,
inherent limitation of OAuth (their SDKs refuse to run against an unregistered
origin/client), not something further code changes here can close.

---

## Round 4 — new requests, added 2026-08-24 (⬜ not started — hold until told to begin)

## Task 33 — Email-OTP sign-in should also support account creation ✅
**Design call, per explicit user instruction ("Task 38 ke according krde is
wale task ko" — build this per Task 38's approach):** built the member
Create-Account/Sign-In screens around Task 38's merged "Phone Number / Email
Address" field now, rather than a separate temporary UI. On the
phone-requirement question this task itself raised: kept `User.phone`
required/unique with no schema change (lowest-risk option) — an email-first
signup verifies the email, then still requires a follow-up phone-number
verification before the account is actually created. Admin's merged-field
sign-in is left for when Task 38 itself formally starts (this task is scoped
to member signup).
- Backend (`auth.controller.js`/`auth.service.js`): `otp/request-email` now
  accepts `intent: 'signup'`, which flips its check to "email must NOT already
  be registered" and requests an OTP under a new `signup-email` purpose. New
  `POST otp/verify-email-signup` verifies that OTP and, rather than creating
  the account immediately (phone is still required), returns a short-lived
  (10 min) server-signed `emailVerificationToken` (`purpose:
  'signup-email-verified'`, via the existing `JwtService`) as proof. The
  existing `otp/verify` (phone verify-and-create) now accepts that token
  optionally, decodes it server-side (never trusting a raw client-supplied
  email string), and attaches the email to the new account alongside the
  phone. `findOrCreateUser` now also checks email uniqueness before creating.
- Frontend (`auth.service.js`, `OtpVerifyForm.js`): added
  `requestSignupEmailOtp`/`verifySignupEmailOtp`; `signupDraft` carries the
  `emailVerificationToken` through the redirect to `/login/verify` so the
  final phone-verify call includes it automatically.
- `AuthForm.js` rewritten: the old separate `mobile` field (signup) and
  phone/email toggle (sign-in) are gone. Signup now has one "Phone Number /
  Email Address" field, auto-detected (`.includes('@')`) on submit — a phone
  keeps the exact existing flow (OTP → `/login/verify`); an email goes through
  new inline steps (`verify-email` → `need-phone`) before landing on the same
  existing `/login/verify` page for the final phone step. Sign-in is now a
  single merged field too, with the whole OTP exchange handled inline
  (no more separate phone-tab vs. email-tab toggle) — channel auto-detected
  the same way, reusing the existing `requestOtp`/`verifyOtp` and
  `requestEmailOtp`/`verifyEmailOtp` calls under the hood.
Verified live end-to-end via curl + real browser (Task 33's dev-mode
`devCode`, no assumptions): (1) email-first signup — sent+verified an email
OTP, got a real `emailVerificationToken`, then verified a phone OTP with it;
confirmed via the API response the new account has both `phone` and `email`
set. Repeated the identical flow through the actual browser UI end-to-end
(typed into the merged field, verified both OTP steps digit-by-digit, landed
on `/home`) — the created account again showed both fields set correctly.
(2) Regression check — plain phone-only signup/login through the merged field
still works unchanged. (3) Duplicate-email signup correctly rejected with 409
("already registered — sign in instead"). (4) Sign-in tab's merged field
correctly auto-routed an email to the email-OTP channel end-to-end in the
browser (inline OTP step, no page navigation) and landed on `/home`.

## Task 34 — Fix lag / blank-screen bugs in the Schedule Pickup flow ✅
Root-caused to 3 distinct, compounding bugs — not the 8s poll itself, but how
list data, detail data, and render state around it disagreed with each other:
1. **Backend, root cause of "no exchange to schedule":** `exchanges.service.js`
   `listForUser`'s `forme` tab (the book *owner's* view) only ever queried
   `status: 'REQUESTED'`. The instant the owner accepted a request — i.e. the
   exact moment they're routed into the pickup-scheduling flow — that row fell
   out of `forme` (wrong status) and isn't in `mine` either (owner isn't the
   requester), so it vanished from `exchanges` entirely. `mine` already
   included `ACCEPTED`/`PICKUP_SCHEDULED`; `forme` now matches it.
2. **Backend, corrupted pickup data on every background poll:** the list/poll
   endpoint's row shape (`_toCard`) had no `pickup` field at all, unlike the
   single-exchange detail shape (`_toDetail`). Since the shared frontend
   `exchanges` state is written by both a global 15s list-poll (full replace)
   and per-screen detail fetches (merge), every list poll silently wiped
   `exchange.pickup` back to `undefined` for any row currently at the
   pickup-proposed/confirmed stage — flipping "waiting for the other party" ⇄
   "you have a time to confirm" at random, and corrupting the "Pickup
   scheduled" summary to fall back to blank local form defaults. Added the
   same `pickup` sub-object (factored into a shared `_pickupOf()` helper) to
   `_toCard` so a background poll can never regress a row's pickup data.
3. **Frontend, the actual "blank screen":** `PickupScheduler.js` and
   `ExchangeDetailView.js` both treated "`exchange` is falsy" as one single,
   definitive "gone" state, with no distinction between "haven't resolved this
   id yet" and "resolved and it's genuinely absent" — so the brief window on
   every mount while `ensureExchange`'s fetch is in flight rendered the hard
   "no longer available" empty state before snapping back once data arrived.
   Added a `checked` state to both (mirroring the same fix in both places) —
   `ensureExchange` now returns whether it found something, and the empty
   state only renders once that's actually settled; until then it shows the
   same `bulk-spinner` loading UI `SessionGate.js` already uses elsewhere.
Verified live end-to-end with real accounts and a real listing (not assumed):
created a fresh listing, requested it from a second account, and drove the
full owner-side flow through curl + the real API — confirmed the row now
*stays* in `forme` through `requested` → `accepted` → `pickup-proposed` →
`pickup-confirmed` (previously it disappeared right after acceptance), and
confirmed the card's `pickup` field is correctly populated at every stage
instead of `null`. Then drove the actual UI in a real browser as both
parties: giver's pickup screen correctly showed "Waiting for Task33 to
confirm" with the real proposed date/slot/point; receiver's screen correctly
showed "Live suggested a pickup time" with a working "Confirm this time" that
posted the real `pickup/confirm` call; the resulting exchange detail page
correctly showed "Scheduled pickup — 2026-08-27 · Evening (5-8 PM) · Main
Gate" with no blank/empty-state flash at any point, despite the global 15s
poll firing multiple times in the background throughout the whole test.

## Task 35 — Speed up live data updates (currently noticeably slow) ✅
Went with real socket events over the existing Socket.IO gateway (Task 16),
not just interval tuning — interval tuning alone can't get both "fast" and
"not over-polling" at once, but it's still kept as a slower safety net under
the new push.
- **Backend — extended the existing chat gateway rather than building a new
  one.** `chat.gateway.js`'s already-race-safe cookie/JWT auth middleware
  (documented reasoning already there: `handleConnection` isn't blocking,
  `server.use` is) now also does `socket.join('user:'+userId)` for *every*
  connection, not just chat ones — reusing that exact mechanism rather than a
  new client-sent event. Added `emitToUser(userId, event, payload)`, the same
  emit style already used for `message:new`.
  `NotificationsService#create` is the single choke point every request/
  pickup/exchange notification already flows through (Task 16's design), so
  one `emitToUser(userId, 'notification:new', notification)` there — same
  best-effort, fire-and-forget treatment as the FCM push right next to it —
  instantly covers every current *and future* notification-worthy event,
  instead of instrumenting `requests.service.js`/`pickup.service.js`
  individually.
- **Circular-dependency fix required by that wiring:** `ChatModule` already
  imported `ReportsModule`, which already imported `NotificationsModule` —
  so `NotificationsModule` importing `ChatModule` (for `ChatGateway`) closed a
  3-module cycle. Resolved with `forwardRef()` on both edges that close it
  (`NotificationsModule → ChatModule`, `ReportsModule → NotificationsModule`)
  **and** at the actual constructor-injection level in both services
  (`NotificationsService`'s `@Dependencies(...)`, `ReportsService`'s) — a
  module-level `forwardRef` alone wasn't enough; confirmed by hitting (and
  fixing) both `UndefinedModuleException` and `UndefinedDependencyException`
  in sequence on real restarts before it booted clean.
- **Frontend — `AppDataContext.js`** now opens the shared `lib/socket.js`
  singleton once a session exists (previously only `ChatThread.js` ever
  connected it, and only while a thread screen was open) and listens for
  `notification:new` to immediately re-run the exact same
  `refreshExchanges()`/`refreshChatThreads()`/`fetchNotifications()` the poll
  already did — same data path, just triggered instantly instead of on a
  timer. Explicitly disconnects on sign-out so a different user signing in
  in the same tab afterward can't inherit a socket still authenticated as the
  previous one.
- **Polls kept, but slowed to safety-net intervals** now that they're not the
  primary delivery path: the global poll 15s → 45s; the two per-screen
  detail polls (`PickupScheduler.js`, `ExchangeDetailView.js`) 8s → 25s.
- **Two "while I'm in this file" fixes from the same investigation**, both
  low-risk and in code already being touched: `exchanges.service.js`'s
  `REQUEST_INCLUDE` was fetching the *entire* `owner`/`requester` `User` row
  on every list/detail query when `_otherParty`/`initialsOf` only ever read
  `.id`/`.name` — narrowed to a `select`. `chat.service.js#listThreads` ran
  one separate `message.count()` per conversation (a real N+1, on every poll
  tick) — replaced with one grouped `groupBy` query for all of a user's
  conversations at once.
- **Flagging, not silently expanding scope:** the REST chat-send fallback
  (`chat.controller.js`, used by `AppDataContext.sendMessage`) still doesn't
  emit `message:new` the way the Socket.IO `message:send` path does — a
  message sent while the sender's own socket happens to be disconnected
  wouldn't live-push to the recipient (their own screen already updates via
  local optimistic state either way). Pre-existing, narrower than this task's
  scope, and not touched.
Verified live end-to-end, not assumed: confirmed the full DI graph resolves
cleanly on a real cold boot after both `forwardRef` fixes (no more
`UndefinedModuleException`/`UndefinedDependencyException`). Connected a real
authenticated Socket.IO client (via curl-obtained session JWTs) and confirmed
it receives a real `notification:new` payload the instant a real
`createRequest` call landed server-side. Confirmed `exchanges`/`chat/threads`
still return fully correct data (names, unread counts) after the `select`
narrowing and the `groupBy` rewrite — sent a real chat message and confirmed
`unread` was exactly right. Then drove it through the actual browser UI: with
a real giver session sitting on `/requests` (no manual reload, no keyboard/
mouse action at all), a `curl`-created request from a second real account
appeared on-screen and the notification-bell count incremented within
roughly a second — confirmed via network-log timing that this fired exactly
once per real event (isolated a clean before/after pair in a fresh tab to
rule out it being coincidental timing with the slower safety-net poll, and to
rule out a duplicate-listener bug from React re-renders).

## Task 36 — Admin profile: edit email + phone number ✅
New "My Profile" section in the admin console, mirroring the member Profile
Settings phone/email-change UX (Tasks 8/13) exactly, against the separate
admin session/table.
- Backend (`admin-auth.service.js`/`admin-auth.controller.js`): added
  `changePhone`/`changeEmail` (same conflict-check shape as `AuthService`'s
  member-side equivalents) and 4 new `AdminAuthGuard`-protected routes —
  `phone-change/request`+`verify`, `email-change/request`+`verify` — under
  their own OTP purpose namespace (`admin-phone-change`/`admin-email-change`)
  so they can never collide with a member's own change or an admin login OTP.
  `otp.service.js`'s SMS wording branch extended to recognize
  `admin-phone-change` too, for the same "confirm your new number" message.
- Frontend: new `admin/profile/page.js` — Name/Role (read-only) + Phone/Email
  rows that open the exact same enter → OTP-verify sheet flow as the member
  side (`AdminPhoneChangeForm`/`AdminEmailChangeForm`, calling the new
  `adminService` methods). Added a "My Profile" entry to `AdminSidebar.js`.
Verified live end-to-end via curl (request/verify round trip for both phone
and email, same-value guard correctly rejecting a no-op change) and then
through the actual admin console UI in a real browser: opened "My Profile",
changed the phone number through the real sheet + OTP flow, saw the row and
a "Phone number updated" toast update live, then changed it back the same
way — full loop confirmed working both directions, not just one.

## Task 37 — User profile: add/update email via SMTP OTP ✅
Already fully satisfied — checked live *before* writing any code, per
standing instruction to always verify a task isn't already done first,
rather than assuming from the task's own wording that something is missing.
`EmailChangeForm`/`openEmailChange` (`profile/settings/page.js`) never had an
"only when unset" restriction: the sheet title itself is conditional
(`user.email ? 'Change Email' : 'Add Email'`), and both the form and the
backend (`email-change/request`/`verify` in `auth.controller.js` →
`AuthService#changeEmail`) unconditionally overwrite whatever email was
there before — the only guards are "not already your current email" and "not
already someone else's," neither of which cares whether one was set to begin
with.
No code changes made. Verified live rather than just re-reading the code:
logged in as a real member who already had an email on file
(`livebrowser.task33@example.com`), opened Profile Settings — the sheet
correctly opened as "Change Email" (not "Add Email") showing the current
one — sent a real OTP to a different new email, verified it, and confirmed
the row and a "Email updated" toast updated live to the new address. Then
reversed the exact same flow to set it back to the original, confirming the
change direction works both ways, not just once.

---

## Task 38 — Merge phone + email into one labelled field on sign-in / create-account (member + admin) ⬜
- Wherever the phone-number input appears on the member Sign In / Create
  Account screens, relabel it "Phone Number / Email Address" and accept
  either kind of input in that single field.
- If the user types a mobile number, send the OTP via SMS (existing
  phone-OTP flow); if they type an email address, send it via SMTP
  email-OTP instead — detected from what was typed, not a separate
  toggle/tab.
- Apply the exact same combined field + routing on the admin sign-in page
  too, since admin only has a sign-in page (no separate create-account),
  per Tasks 10/13.
- This effectively replaces the separate phone-tab vs. email-tab toggle UI
  built in Task 13 (`AuthForm.js` for members, the admin login page) —
  confirm with the user when this starts whether the toggle should disappear
  entirely or stay as a fallback.

---
## Task 39 — Show user's email in admin Users section, when registered via email ✅
Checked live before writing code (per standing practice) whether this was
already covered by Task 27 the way Task 27 itself covered phone — it wasn't:
`admin.service.js#listUsers` added `phone` explicitly but never `email`, and
`toPublicUser()` (the shared serializer it spreads) never includes `email`
either — that one's by design (only the self-view serializer does), so this
needed a real, small addition, not just a rename.
- Backend: `admin.service.js#listUsers` — added `email: u.email` alongside
  the existing explicit `phone: u.phone`.
- Frontend: `admin/users/page.js` — new "Email" column right after Phone,
  same table, `u.email || '—'`.
Verified live: `GET /admin/users` now returns real `email` values for users
who have one and `null` for phone-only accounts. Confirmed in the actual
admin console table — real accounts with an email (Live Browser, Task33
Tester, a Gmail-registered real user) show it correctly; every phone-only
account in the same table correctly shows "—" instead.

---

## Task 40 — Fix admin Exchanges section + redefine its status tabs + rename the section ✅
Root-caused the "new book doesn't show" report *before* writing any code:
it wasn't a bug (no stale refresh, no wrong filter) — `listExchanges()` was
rooted entirely on `Exchange` rows, which are only born once a request is
*accepted*, so a freshly listed book with zero requests against it
structurally couldn't appear no matter what. That turned out to be the exact
same fix as the tab redefinition — confirmed the design with the user before
implementing (per standing practice of verifying/clarifying rather than
guessing on a real reinterpretation): make "Active" mean "any currently
listed, available book" (`BookListing.status === 'ACTIVE'`), which fixes the
bug report *and* matches the new tab spec in one move.
- Backend (`admin.service.js#listExchanges`): now queries **two** models in
  parallel and blends them into one row shape — `BookListing` (status
  `ACTIVE`) for the Active tab (no receiver/pickup yet, so those columns show
  placeholders: `to: '—'`, `status: 'Available'`), and `Exchange` (as
  before) for the other 3. Kept a real `id` on every row (was previously a
  `book+to+index` fallback key on the frontend — a real id is available on
  both source rows, so used it).
  **Flagging a judgment call the task text didn't cover:** an exchange that's
  *accepted but has no pickup scheduled yet* (the old "Active" meaning) now
  has no named tab at all — it's not available-for-everyone anymore (the
  listing flips to `RESERVED` on accept) and it's not "in process" either
  (no pickup yet). Left it unbucketed (still visible if a future "All" view
  is ever added) rather than force-fitting it — same precedent this code
  already had for `DISPUTED`. Confirmed via real DB checks that cancelled
  `PickupSchedule` rows are never deleted, so "Cancelled" can reliably
  require `request.pickup` to exist (cancelled *after* a pickup was
  scheduled) versus a plain early cancellation, which is also left
  unbucketed for the same reason.
- Frontend (`admin/exchanges/page.js`): title → "Listings & Exchanges" (the
  user's choice, offered alongside 3 other options). Exactly 4 tabs, no
  "All" tab anymore, defaulting to Active. `AdminSidebar.js`'s nav label
  updated to match.
Verified live end-to-end, the actual bug scenario specifically: created a
brand-new listing via the real API and confirmed it appeared in `GET
/admin/exchanges` **immediately** under `stage: "ACTIVE"` with
`status: "Available"` and `to: "—"` — then confirmed the same thing rendered
correctly in the real admin console UI ("Just now", Active tab). Checked
all 4 tabs against real production-ish data: Cancelled correctly isolated to
exactly the 2 real exchanges cancelled after a pickup was scheduled (each
showing the real owner→receiver, not blank); In Process correctly showed 4
real pickup-scheduled/confirmed exchanges (including this session's own
Task 34 test exchange); Completed showed all 8 real completed exchanges
unaffected by any of this.

**Follow-up bug found and fixed post-deploy** (during a full production
smoke test, not caught by the original verification above because no test
data happened to sit in the "accepted, no pickup yet" state at the time):
the "unbucketed" fallback for that exact case evaluated to the raw Exchange
status string `'ACTIVE'` — which is *also* the literal stage value the
listing-based Active tab uses, so an already-accepted (no longer available)
book was wrongly showing up in "Active" as if still up for grabs. Same
collision existed for a cancelled-before-any-pickup exchange landing in
"Cancelled". Fixed by giving both truly-unbucketed cases their own sentinel
values (`UNBUCKETED_ACCEPTED`/`UNBUCKETED_CANCELLED`) that can never match a
real tab key. Verified against the real record that surfaced this (a live
accepted exchange on production), confirmed the fix locally first, then
deployed it (committed → pushed to `KitabX-Platform` → Render auto-deployed
in ~75s) and re-confirmed the same production record now reads
`stage: "UNBUCKETED_ACCEPTED"` and no longer appears under "Active".

## Task 41 — Notification count badge on the admin Account Deletion Requests tab ✅
Verified first (confirmed genuinely missing, not already covered) — same
badge treatment as Task 30's other 3 tabs, extended rather than duplicated:
- Backend: `admin.service.js#notificationCounts` — added a 4th parallel
  count (`User.deletionRequestedAt > since`) alongside the existing 3;
  `admin.controller.js` — added the matching `deletionRequestsSince` query
  param.
- Frontend: `useAdminNotificationBadges.js` — added the 4th storage key +
  count key (generalized the old 3-way ternary in `markSeen` into a
  `TAB_COUNT_KEY` lookup so adding this one didn't need a new branch);
  `AdminSidebar.js` — added `badgeKey: 'newDeletionRequests'` to the nav
  entry (the badge-rendering JSX was already generic over `badgeKey`, so
  nothing else to change there).
Verified live: submitted a real account-deletion request from a real test
account, confirmed `GET /admin/notification-counts` returned
`newDeletionRequests: 1` for a since-cutoff before it and `0` for one after.
In the real browser, seeded a 24h-old "last seen" and confirmed the sidebar
literally rendered "Account Deletions**1**" — then navigated into that tab
and confirmed the badge disappeared immediately, while the unrelated Book
Moderation/Reports badges stayed untouched. Rejected the test deletion
request afterward to leave the test account in a clean, active state.

## Task 42 — Notify the user whenever an admin updates their profile ✅
Enumerated every admin-side mutation to a `User` row before writing anything
(per standing practice) — there are exactly 4 (`admin.controller.js`'s
`users/:id/verification`, `/suspension`, `/approve`, `/reject`; no admin
route touches society/block/flat/name — those are member self-service only,
Task 23). 3 of the 4 already notified (`setVerification`/`approveUser`/
`rejectUser` all go through `_notifyVerification`, and Task 26's deletion-
request rejection already notifies too) — **`setSuspended` was the one real
gap**, for both directions (suspending *and* reactivating).
- `admin.service.js#setSuspended` — added a `notifications.create()` call
  (best-effort, `.catch()`'d like every other one here) for both the
  suspend and reactivate case, distinct titles/bodies for each. Deliberately
  did **not** touch `actionDeletionRequest` (approving a deletion) — its
  existing comment already correctly explains why not: a deleted account is
  immediately locked out, so there's no session left to see an in-app row,
  matching the exact reasoning this task is otherwise trying to fix
  elsewhere.
Verified live via real DB state, not just re-reading the code: suspended a
real test account as admin, confirmed their own `/notifications` request
correctly 401s with "Account no longer active" (they really are locked out,
consistent with why `actionDeletionRequest` skips notifying) — then
reactivated them and confirmed, with the *same* old session cookie (proving
the guard re-checks live DB state rather than a cached JWT claim), that
`GET /notifications` now returns both "Account suspended" and "Account
reactivated" rows, newest-first, exactly as expected. Delivery itself goes
through the same `NotificationsService#create` choke point Task 35 already
wired up for live Socket.IO push and verified end-to-end in a real browser —
didn't re-prove that plumbing again here since it's identical and already
closed out; this task's own verification focused on the mutation being
correct (right notification, right access-lockout/restore behavior).

## Task 43 — Fix the WhatsApp icon on the user profile's "Chat on WhatsApp" row ✅
Checked the actual rendering before assuming it was a sizing/viewBox/CSS
issue: `Icon.js`'s wrapper (`viewBox="0 0 24 24"`, `overflow: visible` badge,
17×17 SVG centered in a 38×38 circle — measured live via
`getBoundingClientRect()`) was completely correctly sized; nothing was
clipping it at the container/CSS level. The actual defect was in the icon's
own hand-drawn path data (Task 19): the outer "bubble" shape was built from
3 arc commands, and inspecting it (sampling `getPointAtLength()` along the
path) showed a self-intersecting, folded-back loop — the arc sweep
direction was wrong on at least one segment, so it rendered as a visibly
broken/"cut" shape rather than a clean outline, regardless of container
size.
- `Icon.js` — replaced the icon with a plain rounded chat-bubble outline
  (dropped the inner hand-drawn "receiver" squiggle entirely, which had the
  same problem) — kept it a single, well-formed closed path in the same
  stroke-only style as every other icon in this file. The row's own green
  tint (`--mint`/`--brand-2`, already set in `profile/page.js`) still carries
  the WhatsApp association without the icon itself needing to be a literal
  logo reproduction.
Verified live rather than just re-reading the SVG: navigated to the real
Profile screen, located the actual rendered `<svg>` for this row via the
DOM, and confirmed via `getBBox()`/`getPointAtLength()` sampling that the new
path traces a smooth, monotonic, non-self-intersecting closed loop entirely
within the 0–24 viewBox — the concrete defect found in the old path is gone.
(Screenshot tooling wasn't available in this session to eyeball it
pixel-by-pixel, so verification was done geometrically against the real
rendered path data instead of assumed from re-reading the source.)

## Task 44 — Webapp is slow to open and laggy — general performance pass ✅
Measured the real cold-load network waterfall in a live browser session
(not assumed) before touching anything, logged in as a real account,
reloading `/home` and reading the actual request log:
- **Real finding #1 — every hydration fetch fires twice per page load.**
  All ~13 endpoints `AppDataContext`'s session-hydration effect calls
  (books, credits, wishlist, exchanges ×4, chat threads, notifications) ran
  a second, near-identical time within the same load. Traced this to React
  18 Strict Mode's dev-only double-invoke of effects with no cleanup
  function (Next's App Router default) — confirmed this is a **dev-only
  artifact, not a production bug**, and deliberately did not disable Strict
  Mode to "fix" it, since that would just hide the dev-mode symptom while
  losing a real safety net (it exists specifically to catch missing-cleanup
  bugs) without changing anything about actual production behavior.
- **Real finding #2 — `refreshExchanges()`'s 4 separate tab requests were
  the single biggest fixable contributor.** Confirmed via `Grep` that
  `exchangesService.list()` had exactly one caller in the whole frontend
  (`AppDataContext.js`) — safe to change its shape without touching any
  other code path. Added `ExchangesService#listAllForUser`/`GET
  /exchanges/all` (runs the same 4 existing queries in `Promise.all`
  server-side instead of the client firing 4 separate HTTP requests) and
  switched `refreshExchanges()` to call it — cuts 4 GET + 4 OPTIONS
  preflights down to 1 + 1, on every hydration *and* every safety-net poll
  tick.
- **Real finding #3 — no CORS preflight caching at all.** `main.js`'s
  `enableCors()` had no `maxAge`, so the browser couldn't skip a repeat
  preflight for the same endpoint+method across nearby calls (e.g. the
  notification bell's per-navigation refetch, Task 35's safety-net poll).
  Added `maxAge: 600`.
- **Investigated and deliberately left alone:** whether the hydration-time
  blind `searchBooks({})` call (feeds the shared `books` dict) is wasted
  since `home/page.js` immediately re-fetches its own filtered view anyway —
  checked every consumer of `books` and found `BookDetailView.js` reads
  `books[bookKey]` with **no fallback fetch of its own**, so removing this
  call would have broken any deep link straight to `/books/:id` without
  visiting Home first. Left it in — flagging it rather than silently
  "fixing" something that would have been a real regression.
Verified live: confirmed via `curl` that `GET /exchanges/all` returns the
same correctly-bucketed `{forme, mine, done, cancelled}` shape the 4 old
calls used to, and that `Access-Control-Max-Age: 600` is actually present on
a real preflight response. In the real browser, a cold reload of `/home`
now shows exactly one `/exchanges/all` request pair (was 4 pairs before, ×2
from Strict Mode either way) with no more `?tab=` calls anywhere. Confirmed
no regression across `/requests` (real pending requests still render) and
`/exchanges` (Completed/Cancelled tabs still show correct, real data).

## Task 45 — Remove the standalone "Flat / Unit" row from user Profile Settings ✅
- `profile/settings/page.js` — removed the standalone "Flat / Unit" row
  (both it and "Society" already opened the exact same
  `LocationChangeForm`). Folded the flat/unit value into the "Society"
  row's own value line instead of dropping it from view — e.g.
  `"A Block, Green Meadows, Powai · A-501"` — still opens the same edit flow.
Verified live: opened the real Profile Settings screen — only one
"Society" row remains. Set a real flat/unit value ("A-501") through the
actual `LocationChangeForm` sheet, saved, and confirmed the row's value line
updated live to `"Green Meadows, Powai · A-501"` with a "Location updated"
toast — the value is fully visible and still editable, not silently lost.

## Task 46 — Refine Socket.IO further so responses arrive with no delay at all ✅
Went straight for the real gap Task 35's own writeup had already flagged
rather than speculating about new ones: **chat had zero live delivery
through the actual app.** Confirmed by reading the real code path before
touching anything — `ChatThread.js`'s send button calls `sendMessage()`
(REST, `POST /chat/threads/:id/messages`) on every real send; the socket's
`message:new` emit only ever lived inside `chat.gateway.js#onSend`, which
only fires for the socket-native `message:send` event — a path the real UI
never uses. So a message sent through the app today reached the recipient
only on their next poll/reopen (up to 45s after Task 35's own poll-slowdown,
or effectively "whenever they happen to look again" for someone with the
thread open), while the underlying infra to push it instantly already
existed and simply wasn't wired to the path people actually use.
- `chat.gateway.js` — added `emitToConversation(conversationId, event,
  payload)`, the conversation-room equivalent of Task 35's `emitToUser`.
- `chat.service.js#sendMessage` — this was already explicitly the single
  shared method behind *both* the REST and socket send paths (per its own
  pre-existing comment) for persistence; moved the `message:new` emit in
  here too so both paths now push it, not just one. Required the same kind
  of `forwardRef()` fix as Task 35 — `ChatService` and `ChatGateway` now
  depend on each other, resolved with `forwardRef()` on both sides since
  they're both providers in the same `ChatModule` (a same-module provider
  cycle, simpler than Task 35's 3-module one, but the same underlying fix).
  Simplified `chat.gateway.js#onSend` to just call `sendMessage()` and let it
  handle the emit, instead of duplicating the emit logic in both places.
Verified live, and caught my own testing mistake along the way: my first
attempt used two tabs in the same Browser pane as "two different users," but
this pane shares **one cookie jar across all tabs** — logging into tab B
silently re-authenticates tab A too, so both tabs were actually the same
session the whole time (confirmed via a live `/auth/me` check on both).
That explained an apparent "not delivered" result that was actually the
existing self-echo filter correctly rejecting your own message — not a bug.
Redid it properly two ways: (1) two independent Node `socket.io-client`
connections authenticated with two real, distinct session tokens (bypassing
the shared-cookie-jar problem entirely) — confirmed a REST-sent message
pushes `message:new` to the other party's socket instantly, and confirmed
the native `message:send` socket path still delivers exactly once (no
duplicate emit introduced by sharing the code path). (2) One real browser
tab as the giver with the chat screen genuinely open, and an independent
`curl` session as the receiver sending a real message via REST — it
appeared in the giver's live UI with no reload, and a follow-up message
sent as the giver still showed up instantly via the existing optimistic
local update, confirming no regression on the sender's own view either.

## Round 5 — new requests, added 2026-08-27

## Task 47 — Cloudinary instead of R2, dev-OTP UI popup, request-a-new-city/society flow ✅
Four independent asks from the same message, done together.

**1) Cloudinary instead of Cloudflare R2, with real delete-on-remove**
- Deleted `r2.service.js`, `local-storage.service.js`, `storage.service.js`
  (the R2-vs-local-disk fallback abstraction), the `storage/local-uploads/`
  folder, and the `@aws-sdk/*` packages. Removed `app.useStaticAssets(...)`
  from `main.js` — no more local-disk fallback at all, Cloudinary-only per
  the request.
- New `uploads/cloudinary.service.js` — same sharp resize/webp pipeline as
  before (1600×1600 max, quality 82), now uploads via
  `cloudinary.uploader.upload_stream`. `deleteImage(url)` recovers the
  `public_id` by parsing it back out of the returned URL
  (`/upload/v<n>/<folder>/<id>.<ext>`), since Cloudinary needs the id, not
  the URL, to delete an asset.
- **Real bug fixed in passing, not just a provider swap**: listing photo
  files were never actually deleted from storage before — `removeListing`
  only soft-deleted the `BookListing` row, and `updateListing`'s photo
  replacement just deleted+recreated the `bookListingPhoto` *rows*, with the
  underlying files left behind in the bucket forever. Wired
  `CloudinaryService.deleteImage` into both `listings.service.js` (member
  remove + photo-replace, computing only the URLs actually dropped so
  reordered-but-kept photos aren't deleted) and `admin.service.js`'s
  moderation `removeListing`.
- `apps/api/.env`/`.env.example` — `CLOUDINARY_CLOUD_NAME`,
  `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (left blank; the user adds
  their own real values).

**2) Dev-mode OTP as a UI popup instead of only the server console**
- `otp.service.js` already echoed the code back in the API response outside
  production (`devCode`) — nothing to add server-side. The gap was purely
  that no screen ever displayed it.
- `ToastProvider.js` — added a module-level `notifyDevOtp(code)` any
  non-component code can call (`lib/api-client.js` isn't a hook), wired to
  the mounted provider's real `showToast` via a `useEffect`. Given a code to
  actually read and type, not just glance at, it gets a longer 6s toast
  instead of the normal 2.4s.
- `lib/api-client.js` — after every response, if `devCode` is present, calls
  `notifyDevOtp`. One change covers every OTP flow at once (member
  signup/sign-in, admin login, phone/email change) instead of touching each
  screen.

**3) City-filtered society dropdown already worked — the actual gap was no
way to add a city/society that isn't listed yet**
- Confirmed live first (per the standing "verify before implementing" rule):
  `SocietyFields.js`'s society dropdown already filters to the selected
  city correctly — no bug there.
- New Prisma model `LocationRequest` (`requestedById`, `cityName`,
  `societyName`, `status` PENDING/APPROVED/REJECTED, `reviewedById`,
  `createdSocietyId`) — migration `20260827070516_add_location_requests`,
  applied to the real (shared local+prod) database.
- `SocietyFields.js` — "Don't see your city or society? Request to add it"
  swaps the two dropdowns for free-text city/society name inputs
  (`values.locationRequest`), with a way back to the picker. Shared by all
  three places that use this component (signup, onboarding, profile
  location-change), so all three got the flow from one change.
- `auth.service.js#findOrCreateUser` — a signup with a `locationRequest`
  instead of a `societyId` creates the member with no society yet, plus a
  PENDING `LocationRequest` row, inside the same transaction.
  `auth.service.js#updateProfile` — same idea for an existing member (used
  by both the onboarding wizard and Profile Settings), without touching
  their current society.
- `admin.service.js` — `listLocationRequests`, `approveLocationRequest`
  (reuses `SocietiesService.adminCreateSociety`'s existing find-or-create
  City/Area/Society path — same one the admin's manual "Add Society" form
  already used — then moves the requester straight into the new society),
  `rejectLocationRequest`. Both send the member a notification either way.
  `notificationCounts` gained a `newLocationRequests` count, same
  `Since`-cutoff pattern as the other 4 badges.
- `admin/societies/page.js` — split into "Societies" / "Requests (N)" tabs,
  the latter with Approve/Reject; approving now also refreshes the
  Societies list so the new one shows immediately, not just on next reload.
  `AdminSidebar.js` — Societies nav item gets the same numbered-badge
  treatment as Users/Reports/Moderation/Deletion Requests.

**4) Profile Settings' location field**
- Free — it already opens the exact same `LocationChangeForm` →
  `SocietyFields`, so it got the request flow automatically. Verified
  separately anyway rather than assuming: "Request to add it" appears
  there too, the save button relabels to "Send request", and submitting
  leaves the member's current society untouched until an admin approves.

Verified live end-to-end, backend via `curl` and the actual UI via the real
browser: local server starts clean with the Cloudinary DI wiring (warns and
501s until real credentials are added, exactly like R2 used to); dev-OTP
toast appeared on real signup, sign-in and admin-login screens; a full
signup with a brand-new city/society completed with no society, showed the
"reached the admin" toast, appeared in the admin Requests tab, and the
Societies sidebar badge showed the correct count *before* opening that tab
(cleared after, matching the existing 4 badges' behavior) — approving it
created the real society with default pickup points, the requester's own
account was immediately reassigned to it (checked via `/admin/users`), and
it appeared in the public `/societies` list (and, live in the browser, in a
fresh signup's dropdown) without needing a reload. Rejected a second test
request and confirmed it clears from the queue. Regression-checked plain
signup-with-a-real-society and a plain profile update with no
`locationRequest` still work exactly as before. Separately drove the
Profile Settings "Change Location" sheet through the real UI and got the
same request flow and toast.

## Task 48 — Fix the dev-OTP toast being overwritten on resend, plus a temporary EXPOSE_DEV_OTP flag ✅
Found while using Task 47's own dev-OTP popup for real: clicking "Resend"
worked correctly end to end (a genuinely fresh code was issued and usable),
but the code was never actually visible — every resend/change-number flow
followed its API call with its own "OTP resent" / "OTP sent to X"
confirmation toast, which fired a beat *after* `api-client.js`'s automatic
dev-OTP toast and silently overwrote it before it could be read. Fixed all
8 call sites (member signup/sign-in, admin login, phone/email change for
both member and admin) to skip that confirmation toast specifically when
the response carried a `devCode` — the code showing up already *is* the
confirmation in that case. Also bumped the dev-OTP toast's own duration
from 6s to 12s (asked for "kuch second bada") since it now has to survive
being read and typed, not just glanced at.

Separately, added `EXPOSE_DEV_OTP` — an explicit, off-by-default env flag
in `otp.service.js` that lets the OTP code surface in the API response even
in *production*, for client testing before real SMS/email delivery exists.
Deliberately not a code change to the production check itself, so turning
it back off later is a one-line env var flip on Render, no redeploy needed.
Flagged clearly in code/`.env.example` comments that this is a real,
temporary security hole while it's on — anyone who knows a phone/email can
log in as that person without ever touching their phone.

Verified live: resent a code on the real sign-in screen and confirmed the
new toast now shows the fresh code (didn't get overwritten) and that code
successfully logged in.

## Task 49 — Fix "Install to home screen", add an Address field, and rework City/Society on the create-account flow ✅
**Install prompt.** Checked live against the real deployed Vercel site
first rather than assuming the manifest was broken: `manifest.webmanifest`
loads fine (200, all fields correct), the service worker registers and is
active — nothing was actually misconfigured. The real gap was in
`InstallPrompt.js` itself: it rendered *nothing* for any non-iOS browser
until Chrome's own `beforeinstallprompt` event fired, and that event's
timing is governed by Chrome's own undocumented engagement heuristics —
invisible and uncontrollable from the app's side, even with a fully valid
manifest + active service worker. To a client testing on Android/desktop
Chrome before that heuristic tripped, the feature looked completely absent.
Fixed by giving every non-installed, non-iOS browser the same kind of
manual fallback iOS always had ("Open your browser menu (⋮) and tap
'Install app' or 'Add to Home screen'") instead of showing nothing.

**Address field + City/Society rework**, on `SocietyFields.js` — shared by
signup, the onboarding wizard and Profile Settings' location change, so all
three got this in one change:
- New `User.address` column (migration `20260827094359_add_user_address`);
  a free-text "Address" field now sits above City in all three forms,
  wired through `auth.service.js#findOrCreateUser`/`updateProfile` and
  exposed on `toSelfUser` so an edit doesn't wipe an existing value.
- City is no longer a `<select>` — it's free text now, matched
  case-insensitively against known city names (with a `<datalist>` for
  suggestions, not a forced pick) as the member types. The Society dropdown
  re-filters live to whatever's typed, with a clear "We don't have that
  city yet" state instead of ever showing every society unfiltered. The
  existing Task 47 request-to-add flow now pre-fills its city field from
  whatever was already typed, so nothing has to be retyped.
- Block/Tower and Flat/Unit fields commented out, not deleted — on hold per
  the current design; `toListingLocation`'s existing fallback (drops
  cleanly to just the society name when block/flatUnit are absent) needed
  no changes since those fields were already optional there.

Verified live across all three entry points end to end: signup with a
typed city that live-filtered the society list correctly, an unrecognized
city correctly blocking the picker and pre-filling the request-to-add form,
a completed signup with a real address persisted (checked via `/auth/me`);
the bare-phone → onboarding wizard path saving both address and society;
and Profile Settings' "Change Location" sheet correctly pre-filling the
current city (derived from the existing society) and address on open, then
saving a change through the same flow.

Flagged separately (spawned as its own background task, not fixed here
since unrelated to today's asks): the onboarding wizard's "Finish" step
never actually persists terms acceptance — `acceptedTerms` isn't in its
`updateProfile` payload, and `updateProfile` itself has no handling for it
at all (only `findOrCreateUser`'s phone-signup path sets `acceptedTermsAt`).

---

### Notes / things I'm flagging rather than assuming silently
- Task 4 (chat auto-delete) and Task 13 (email OTP) are the two genuinely new
  subsystems — most scope in this round.
- Task 10 asks for admin auth to be OTP-based; this replaces the email/password
  admin auth built in round 1 for the admin console (super-admin bootstrap in
  `seed.js` will need to seed a phone number instead of only email/password).
- Round 3, Tasks 24/25/31 all touch the same "reports" data — Task 24 moves
  user/listing reports into Book Moderation with full detail (incl.
  timestamp), Task 25 narrows the separate Reports section to bug reports
  only, and Task 31 calls out the timestamp again on its own. Treating these
  as one coherent reports rework when the round starts, not three independent
  changes, unless the user says otherwise.
- Round 3, Task 32 (Google/Apple sign-in) will need real OAuth
  client credentials from the user (Google Cloud console + Apple Developer)
  before it can be wired up for real — flagging now so it isn't a surprise
  blocker when that task starts.

## Task 50 — Switch chat off (commented out, not deleted) and replace it with WhatsApp between an accepted request's two parties ✅
Found a real coupling before touching anything: `ChatGateway` wasn't
chat-only — it was the *only* Socket.IO gateway in the app, and
`NotificationsService`'s live push (new requests, admin actions, everything)
went through it purely because it was the one gateway that existed.
Commenting out the whole chat module as asked would have taken real-time
notifications down with it. Flagged this to the user before proceeding —
asked to keep notifications live, so the fix split the connection/auth +
`emitToUser` machinery out into its own `notifications/notifications.gateway.js`
first, decoupled from chat entirely, then commented chat out on top of that.

**Backend — every registration point commented out, not the files
themselves** (`chat.controller.js`/`chat.service.js`/`chat.gateway.js` are
untouched — nothing outside them references them anymore, so they're simply
never wired into the DI graph rather than deleted or edited):
- `app.module.js` — `ChatModule` import + registration.
- `requests.module.js`/`requests.service.js` — `ChatModule` import,
  `ChatService` injection, the request-linked `Conversation` created on
  every new request, and the 2 `disableForRequest` calls (decline, cancel).
- `handover.module.js`/`handover.service.js` — same pattern, 1 call
  (closing the conversation after a verified handover).
- `scheduled-tasks.module.js`/`request-expiry.service.js` — `ChatModule`
  import, the two chat-only cron services (`ChatRetentionService`,
  `ExchangeChatDisableService`) commented out of registration entirely
  (they're chat-exclusive, unlike the other files above), and the 1
  `disableForRequest` call in the expiry cron.
- `notifications.module.js`/`notifications.service.js` — swapped
  `ChatGateway` (via `forwardRef`, since it lived on the far side of a
  3-module cycle: ChatModule → ReportsModule → NotificationsModule →
  ChatModule) for the new standalone `NotificationsGateway` — no cycle left
  to defer once chat's out of the picture.

**WhatsApp instead, gated on acceptance** — `exchanges.service.js` gained
`OTHER_PARTY_SELECT`'s `phone` field and a shared `_wasAccepted(request)`
helper (`status` isn't `REQUESTED`/`DECLINED`/`EXPIRED`), used to add
`otherPhone` to **both** `_toCard` and `_toDetail` — added to both because
`AppDataContext.js#ensureExchange` only fetches the full detail DTO when
this id isn't already in state at all, so a card-only version missing the
field would have gone stale in a way I only caught by testing the exact
sequence a real user hits (list loads first, phone claims to be missing
even after accepting, because the stale card data never gets replaced).
`otherPhone` is `null` before acceptance, the real number after — same
gating precedent as `toListingLocation`'s exact address.
- `ExchangePartnerCard.js` — the old chat-shortcut button is now a
  `wa.me/<digits>?text=...` link, rendered only when `otherPhone` is
  present. `openThreadForExchange` itself is untouched in AppDataContext
  (still exported, just unused) for when chat comes back.
- `BookDetailView.js` — removed its 2 "Message" buttons outright rather
  than replacing them — neither of that page's two non-owner states
  (viewing before requesting, or after requesting but not yet accepted)
  guarantees acceptance, so there's nowhere on this page to gate a WhatsApp
  button the same way; the exchange detail page is the accepted-only path.
- `BottomNav.js` — Chat tab commented out of the nav item list.
- `AppDataContext.js` — the 3 automatic `refreshChatThreads()` call sites
  (initial load, live-update handler, 45s poll) commented out so the app
  doesn't keep hitting the now-unregistered chat endpoints; the function
  itself and `chatThreads` state are untouched.

Verified live and thoroughly, since this touched a lot of surface at once:
local server starts clean with zero DI/resolution errors after the
extraction; a raw two-client Socket.IO test confirmed real-time
notifications still push instantly through the new gateway (approved a
location request via the admin API while a browser socket listened —
`notification:new` arrived with the correct payload); created a listing,
requested it, and confirmed via the real API that `otherPhone` is `null`
pre-acceptance; accepted it (no crash, despite every chat call site being
commented out mid-flow) and confirmed `otherPhone` populates and the actual
rendered exchange-detail page now shows a real WhatsApp link with the
correct number and a prefilled message — and confirmed a second, still-
pending request's detail page correctly shows no WhatsApp link at all.
Checked browser resource timing (not just console, which has a known
stale-history quirk in this environment) for any 404s from the removed
polling — none. Bottom nav confirmed to no longer show a Chat tab.

## Task 51 — Fix notification deep-links pointing at the wrong id ✅
User reported clicking a notification sometimes lands on "This exchange is
no longer available." The app's convention (documented at the top of
`exchanges.service.js`) is that the frontend always identifies an exchange
by `BookRequest.id`, never the raw `Exchange.id` — `AppDataContext.js`'s
cached `exchanges` state is keyed by it, and `getExchange(id)` does a plain
`e.id === id` lookup with no fallback. Four notification-creation call
sites were passing the raw `Exchange.id` instead:
- `pickup.service.js` `confirm()` and `_notifyProposal()` — pickup
  confirmed/proposed notifications.
- `requests.service.js` `accept()` — "Request accepted!" notification.
- `handover.service.js` `verify()` — both parties' "Handover verified!"
  notifications (confirmed via `HandoverVerify.js` that this route
  genuinely operates on the raw `Exchange.id` by design, since
  `HandoverOtp` is keyed by it — the notification itself still needs
  `exchange.requestId`, not that raw id).

All four now pass the request id instead. Verified live end-to-end with
real accounts: rescheduled and confirmed a pickup, and ran a full handover
verify — each produced a fresh notification with `entityId` matching the
exchange's own `id` field, then clicked through in the real rendered UI and
confirmed it opens the correct exchange page instead of the "not available"
screen.

## Task 52 — Fix app-wide slowness: N+1 relation queries and a stale dev-process pileup ✅
User reported every button/data fetch across the app feeling slow, with an
occasional need to refresh. Traced it to Prisma's default relation-loading
strategy: a nested `include` (e.g. `exchanges.service.js`'s
`listing.book/owner/photos` + `exchange.handoverOtp/ratings` + `pickup`)
fires one round trip *per relation* instead of a single SQL join — measured
10 separate queries for one exchanges-tab row. Neon's pooler is a network
hop away (~90-200ms/round trip from here), so this stacked badly: the
`JwtAuthGuard` alone — which runs on *every* authenticated request, and
`include`s `society`/`block`/`city`/`area` on the user lookup — was costing
~900ms on its own before the endpoint's own work even started.

Fixed at the source instead of touching every call site: `prisma.service.js`
now applies a client extension (`$allOperations`) that sets
`relationLoadStrategy: 'join'` on any query with an `include` that doesn't
already specify one, via `Object.assign(this, this.$extends(...))` inside
the constructor (keeps `PrismaService`'s own class identity and NestJS
lifecycle hooks intact, unlike returning the extended client directly).
Requires the `relationJoins` preview feature (added to `schema.prisma`).
Confirmed this also applies inside `$transaction(async (tx) => ...)` blocks,
which most of the write-path services use.

Measured effect: the guard's per-request user lookup went from 5 round
trips (~900ms) to 1 (~180ms); the exchanges list endpoint from ~1.7s to
~0.4-0.6s. Also parallelized two independent sequential queries in
`discovery.service.js#discover` (the radius lookup and the "already
received" book-id lookup don't depend on each other) that were needlessly
stacking.

Separately found and cleaned up: this session's repeated local server
restarts had left 8 orphaned `npm run start:dev`/nodemon process pairs
running in the background (Windows doesn't reliably cascade-kill a process
tree from `taskkill` on just the parent PID), competing for port 3001 and
occasionally causing a stale/crashed instance to win the race and serve
requests with outdated code. Killed the orphans, left one clean instance
running.

## Round 6 — new requests, added 2026-08-31 (⬜ not started — hold until told to begin)

Cross-cutting requirement for every task in this round: verify the
touched screens/flows work correctly on a real mobile viewport, not just
desktop — this was called out both per-task below and as a blanket
requirement for the whole round.

## Task 53 — Mobile-responsive pass on Exchange / notification-heavy pages ✅
User attached screenshots of the Exchange page ("For Me / My Requests /
Completed / Cancelled" tabs) and the Notifications page and asked for a
mobile-responsive pass.

**Investigation first (per the standing verify-before-implementing rule):**
the whole non-admin app already renders inside a fixed `max-width:480px`
centered column (`AppFrame.js`), so this was never a desktop-vs-mobile
problem — the real risk was fixed-px layouts breaking on genuinely narrow
phones. Audited every candidate screen live in the browser pane at 375px
(iPhone-class) and 320px (iPhone SE-class, the narrowest common width):
- **Real bug found and fixed**: the Exchange page's 4-tab `SegTabs` ("For
  Me / My Requests / Completed / Cancelled") measured 394-398px of
  required content width against a 320-343px available width at these
  sizes — `.segtabs` (`globals.css`) had no overflow handling
  (`overflow-x` computed as `visible`), so the "Cancelled" tab (and
  sometimes "Completed") was silently clipped off-screen with **no way
  to reach it at all** — confirmed via `scrollWidth` vs `clientWidth` in
  the live page before touching any code.
- `SegTabs` is shared by 3 other screens (auth signup/signin — 2 tabs, My
  Shelf — 3 tabs) which all fit comfortably and were confirmed unaffected.
- The Notifications page (header row with "Clear all" + checkmark,
  activity list) was checked at both 375px and 320px and had no overflow
  issue — no changes needed there.
- The home page's category-chip row ("All / Fiction / Non-fiction /
  School / College / Sort") looked clipped at first glance but was
  confirmed to already be an intentional horizontally-scrollable
  `.chiprow` (`overflow-x:auto` already set) — a false alarm, not a bug.
- The exchange detail page (pickup timeline, Cancel/Schedule buttons) was
  also checked at 320px — wraps correctly, no page-level horizontal
  overflow (`document.documentElement.scrollWidth === window.innerWidth`).

**Fix**: `apps/web/app/globals.css` — `.segtabs` gets
`overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none`
plus a `::-webkit-scrollbar{display:none}` rule to hide the native
scrollbar while keeping it swipeable; `.segtab` changed from `flex:1` to
`flex:1 0 auto` so tabs still stretch evenly to fill the bar when
everything fits (unchanged behavior for the 2/3-tab screens) but no
longer get force-shrunk/clipped when content doesn't fit — they now
scroll into view instead.

Verified live in the browser pane at 320px and 375px: reloaded the real
Exchange page as a real logged-in test account (Live Browser,
`+919876511122`), confirmed via `scrollLeft`/`scrollWidth` that the row
is now genuinely scrollable, scrolled it, and clicked the now-reachable
"Cancelled" tab (via a real dispatched click, not just visually) — it
activated and correctly rendered that user's actual cancelled/expired
requests. Re-checked desktop width afterward — no regression, still
shows all 4 tabs at full width with no stray scrollbar. Also re-verified
My Shelf's 3-tab bar and the auth 2-tab bar render identically to before
(full-width, evenly stretched, no scrolling needed).

## Task 54 — ISBN barcode scanner doesn't open the camera on mobile ✅ (confirmed working on real device)
The "scan ISBN code" feature blocks the phone's camera from opening at
all on mobile (works differently than desktop, per user report).

**Investigation.** Confirmed with the user directly this reproduces on
the real deployed Vercel (HTTPS) site, on Android Chrome, in a plain
browser tab (not the installed PWA) — which rules out the most common
version of this bug (an insecure `http://` origin over LAN during dev,
where `navigator.mediaDevices` is simply undefined) and rules out iOS
standalone-PWA camera quirks. Read the scanner code end-to-end
(`lib/barcode.js` using `@zxing/browser`'s `BrowserMultiFormatReader`,
triggered from `app/(main)/books/add/scan/page.js`): the `<video>` tag
already has the correct `autoPlay playsInline muted` attributes for
mobile, and `decodeFromVideoDevice(undefined, ...)` already resolves to
`{ facingMode: 'environment' }` internally (confirmed by reading
`node_modules/@zxing/browser`'s source directly) — so it wasn't picking
the wrong camera either. The actual gap: **every** `getUserMedia`
failure (permission denied, no camera, camera in use by another app, a
device rejecting the `facingMode` hint outright) was being swallowed into
one generic toast — "Could not access the camera — check permissions or
enter details manually" — that also auto-dismissed after 2.4s, easy to
miss on a phone. That's consistent with "the scanner just doesn't work,"
without telling anyone (the user or a future debugging session) which of
several very different real causes it actually was.

**Fix:**
- `lib/barcode.js` — if the initial `facingMode:'environment'` request
  throws `OverconstrainedError` (some devices/browsers treat it as a hard
  requirement rather than the spec'd hint), automatically retries once
  with a plain `{ video: true }` constraint before giving up, so a real
  failure isn't masked by a constraint quirk on a device with only one
  camera or unusual hardware.
- `app/(main)/books/add/scan/page.js` — new `cameraErrorMessage(err)`
  maps the actual browser error to a specific, actionable message
  (`NotAllowedError`/`SecurityError` → check the site's camera permission
  *and* the phone's OS-level browser permission; `NotFoundError` → no
  camera on this device; `NotReadableError`/`TrackStartError` → camera in
  use elsewhere; insecure-context/no-`mediaDevices` → explicit "needs
  https" message for anyone testing over local LAN in future), shown as
  a **persistent** inline red banner above the "Tap to open camera"
  button (cleared on retry) instead of only a fast-vanishing toast.

**Verified live**, and unusually well for a hardware-dependent feature:
the browser pane environment used for this session has no real camera
and actively blocks `getUserMedia`, so triggering the real scan flow
there produces a genuine, unmocked camera-access rejection from the
browser engine — not a simulated one. Tapped "Tap to open camera" on the
live local app and confirmed the new persistent banner appeared with the
correct specific copy ("Camera permission is blocked for this site. Tap
the lock/info icon next to the address bar, allow Camera, then try
again — also check your phone's system settings..."), and confirmed it
renders cleanly (readable, no overflow) at 375px mobile width too.

**Update after user retest:** camera now opens correctly on the phone
(the permission-diagnostics fix above did its job — the camera-access
blocker is resolved), but the barcode itself never gets recognized/
decoded once the live feed is showing. A new, distinct bug from the
original "won't open" report.

**Investigation.** `lib/barcode.js` constructed `new
BrowserMultiFormatReader()` with **no hints at all**. Read `@zxing/library`'s
`MultiFormatReader.setHints` directly: with no `POSSIBLE_FORMATS` hint, it
falls back to trying *every* supported format on every single frame —
QR/DataMatrix/Aztec/PDF417/MaxiCode as well as the 1D reader ISBNs
actually need (EAN-13, always, since every ISBN-13 barcode is EAN-13
encoded) — and `TRY_HARDER` defaults to off. `TRY_HARDER` is ZXing's more
thorough (slower) decode pass that real-world conditions (a curved book
cover, a slight angle, uneven lighting) generally need — without it,
ZXing gives up on a frame quickly rather than working harder to extract
a barcode from an imperfect capture. Running 5 irrelevant 2D decoders
against every frame while never invoking the thorough pass for the one
format that actually matters is a very plausible explanation for
"camera works, barcode never registers."

**Fix**: `lib/barcode.js` now constructs `BrowserMultiFormatReader` with
explicit hints — `POSSIBLE_FORMATS: [EAN_13, EAN_8, UPC_A, UPC_E]` (skips
the irrelevant 2D formats entirely, so every frame's compute budget goes
toward the format that matters) and `TRY_HARDER: true`.

**Verified only as far as this environment allows**: confirmed locally
that the new `BrowserMultiFormatReader(HINTS)` construction doesn't throw
and the existing error-banner flow still works correctly end-to-end
(same "camera permission is blocked" banner as before, proving the hints
object didn't break initialization). **Cannot verify the actual "does a
real barcode now decode successfully" outcome from here** — no physical
camera or printed barcode available in this environment, same limitation
as the original camera-access bug. This is a solid, well-understood fix
based on ZXing's own documented defaults, not a guess, but it still
needs a real retest on the phone to confirm it actually resolves the
scan-never-registers symptom.

**Confirmed by user on a real device**: camera opens and barcode scanning
now works correctly end-to-end. Closing this out.

## Task 55 — "Search by title and author" is non-functional ✅
Confirmed with the user this meant the "Add a book" flow's step 2 option
next to ISBN scan — `Search by title or author` (`app/(main)/books/add/search/page.js`),
backed by a server-side Google Books proxy — not the home page's
discovery search box (that one was traced separately, by the parallel
exploration agent, and works correctly against the live DB).

**Investigation.** Read the full chain: frontend page →
`booksService.searchByTitleOrAuthor` → NestJS
`BookIdentificationController#search` → `GoogleBooksService.searchByTitleOrAuthor`
→ the public Google Books API. Tested locally first and it worked
perfectly (real results for "Atomic Habits"), so — per the standing
verify-before-implementing rule, and since local vs. production had
already diverged once this session (Task 54) — tested the real deployed
site (`https://kitab-x-platform.vercel.app`, provided by the user) before
assuming the code itself was the problem:
- Logged in on production with the dev-OTP flow (still enabled there per
  Task 47/48's deliberate choice) and searched "Atomic Habits", then
  "Sapiens", then "Harry Potter" — all came back **"No match"**, which
  is essentially impossible for real queries against Google Books.
- The `read_network_requests` tool's log only showed the frontend's own
  static asset requests — no visible call to the backend at all — until
  a manual `window.fetch` hook (`javascript_tool`) revealed the real
  target: `https://kitabx-platform.onrender.com/api/v1/book-identification/search`,
  returning a plain **200 OK with body `[]`**. Not a network failure, not
  a CORS block — the backend itself decided there were zero results.
- Fetched Google's own public API directly from the browser with no key:
  `https://www.googleapis.com/books/v1/volumes?q=...` came back
  **429 "Quota exceeded for quota metric 'Queries' ... for consumer
  'project_number:624717413613'"** — Google's shared anonymous-caller
  quota, which is trivially exhausted globally since it's shared across
  every keyless caller on the internet, not scoped to this app.
- `apps/api/render.yaml` declares `GOOGLE_BOOKS_API_KEY` with `sync: false`
  (a manually-entered Render secret, never synced from the repo) — the
  local `apps/api/.env` has a real working key, but nothing proves the
  same value was ever entered into the Render dashboard for the deployed
  API service. **User confirmed directly**: the Google Books API key on
  Render was in fact wrong/not set.
- Root cause confirmed: with no valid key, `GoogleBooksService._apiKeyParam()`
  returns an empty string, so every call goes out unauthenticated, Google
  immediately 429s it, and the *old* `_fetchJson` swallowed any non-OK
  response into a silent `null` → `[]` — indistinguishable from "genuinely
  no results," which is exactly why this looked like the search feature
  itself was broken rather than a missing production secret.

**Code fix** (`apps/api/src/book-identification/google-books.service.js`):
`_fetchJson` now throws a `ServiceUnavailableException` with a clear
message ("Book lookup service is temporarily unavailable...") on any
non-OK Google response instead of returning `null`/swallowing it — this
fixes both `searchByTitleOrAuthor` (this task) and `lookupByIsbn` (shared
by the ISBN scan flow from Task 54) at the source, so a future
misconfiguration or a real quota exhaustion is never silently
indistinguishable from "no results" again.

**Verified live, both failure and success paths**, on the local server:
temporarily blanked `GOOGLE_BOOKS_API_KEY` in `apps/api/.env`, confirmed
the real UI now shows "Book lookup service is temporarily unavailable —
try again shortly or enter details manually" instead of the misleading
"No match for 'Harry Potter'", then restored the key and confirmed a
real search for "Harry Potter" correctly returns actual results (multiple
genuine editions, correct authors/publishers) again.

**Still needs a manual step from the user** (not something I can do —
no Render dashboard access): set a valid `GOOGLE_BOOKS_API_KEY` in the
Render dashboard's environment variables for the API service (the same
key already working in local `apps/api/.env` can be reused, or a fresh
one from Google Cloud Console with the Books API enabled), then redeploy.
Once that's done, this same fix also means the ISBN-scan flow's "no
match" case (Task 54, once camera access itself is confirmed working)
will show the real reason too if this specific cause ever recurs.

## Task 56 — Bulk upload with AI: add photo-capture option, fix mobile ✅
The bulk-upload-with-AI flow needed both an "upload from gallery" option
and a "take photo" (camera capture) option — only one path worked.

**Investigation.** Read the shared `UploadBox.js` component (used by both
this screen and the unrelated bug-report screenshot uploader): it rendered
a single `<input type="file" accept="image/*" capture="environment">`.
`capture="environment"` on mobile (notably Android Chrome) launches the
camera directly and suppresses the normal gallery/file chooser entirely —
that's the actual mechanism behind "only one option works," confirmed by
reading the spec'd behavior of that attribute rather than guessing.

A parallel finding from this same investigation turned out to be a false
alarm and is retracted here for the record: an earlier exploration pass
(during Task 55) reported `books.service.js`'s `extractFromImage` request
path as `"\book-identification\image"` (backslashes, evaluating to a
garbage string via JS escape-sequence rules) and I repeated that claim to
the user without checking the actual file myself first. Reading the real
file (and `cat -A`'ing the raw bytes to rule out lookalike characters)
showed it has always been the correct `"/book-identification/image"` —
no bug there, nothing to fix. Lesson applied: verify an agent's quoted
excerpt against the real file before acting on it, especially before
repeating it to the user as fact.

**Fix, revised after user feedback** (`apps/web/components/ui/UploadBox.js`):
first attempt added a `bothOptions` prop rendering two separate visible
buttons ("Take Photo" / "Choose from Gallery"), but the user wanted the
original single-tile "Tap to take / upload a photo" look kept exactly as
it was — not two buttons. Landed on a simpler and more correct fix
instead: added a `capture` prop (default `true`, preserving today's
behavior everywhere it isn't explicitly overridden) controlling whether
`capture="environment"` is set on the one file input at all. On mobile,
removing `capture` entirely doesn't lose the camera option — it hands
control back to the OS's native picker, which itself offers "Take Photo"
*and* "Photo Library"/gallery together in one native sheet (standard
behavior on both iOS Safari and Android Chrome); `capture="environment"`
is what was suppressing that native chooser and forcing camera-only. The
bulk-upload screen now passes `capture={false}`, restoring the exact
original single-tile visual with both real options available through the
one native tap target. The bug-report screenshot uploader (`ReportForm.js`,
the only other consumer) doesn't pass this prop, so `capture` stays `true`
there and its exact original camera-first behavior is untouched.

**Verified live end-to-end**, including the full real pipeline, not just
the picker UI: confirmed the bulk-upload tile now renders pixel-identical
to the original screenshot the user pointed at ("Tap to take / upload a
photo", single dashed tile, no visible second button), confirmed via JS
that the input's `capture` attribute is now absent, and dispatched a real
synthesized file through that same single input via a `DataTransfer`-backed
`change` event — confirmed it resized, uploaded to
`POST /book-identification/image` (201 Created), and the real Gemini call
completed (an actual multimodal API round trip, not mocked) returning the
correct "No books detected in that photo" empty state for the blank test
image. (What can't be verified from this environment: that a real phone's
OS actually surfaces "Take Photo" in the native chooser it now falls back
to — no physical camera/device is available here — but this is
long-standing, spec'd, well-documented behavior across iOS Safari and
Android Chrome, not something the app's own code controls further.)

## Task 57 — Admin panel: show each user's total current credit in the Credit section ✅
The admin panel's credit section needed to show a given user's total
current credit balance, not just transaction-level detail.

**Investigation.** `apps/web/app/admin/credits/page.js` was a flat table of
only `ADMIN_ADJUSTMENT` correction rows (`admin.service.js#creditsLedger`)
— User (a display name string, no id), Change, Reason — no balance
anywhere, and no way to look one up. The real per-user balance already
existed (`CreditsService#getBalance`, backed by the `CreditAccount` table's
`availableBalance` — the exact same field the member-facing header/credits
page already shows as "N credits") but nothing in the admin service ever
read it.

**Fix:**
- `apps/api/src/admin/admin.service.js#listUsers` — batch-fetches
  `creditAccount` rows for all listed users in one query (same pattern as
  the existing ratings `groupBy`) and adds `credits: availableBalance` to
  each user object (0 if the account row doesn't exist yet — lazily
  created on first use elsewhere, not an error).
- `admin.service.js#creditsLedger` — each row now also carries `userId`
  (previously only a display name, which can collide between test users
  and couldn't be matched back to a real balance).
- `apps/web/app/admin/credits/page.js` — added a "Current Balance" column
  to the ledger table (looked up by `userId`, live from `admin.users`),
  and a "Current balance: N credits" line under the Add Correction form's
  user picker, updating as the selection changes.
- `apps/web/contexts/AppDataContext.js#submitAdminCreditCorrection` — was
  only reloading the ledger after applying a correction, not `admin.users`
  — since the new balance display reads from `admin.users`, it would have
  shown a stale number immediately after the exact action that changed it.
  Now reloads both in parallel.

**Verified live** as the real bootstrap admin (`+919999900099`): the new
Current Balance column matched real, cross-checked data (e.g. "Live
Browser" correctly showed the same balance on every one of their multiple
ledger rows, matching what that account's own member-facing header showed
earlier this session); selecting different users in the correction
dropdown showed each one's distinct real balance (0 for one, 6 for
another, etc.) instead of anything hardcoded. Applied a real +2 correction
end-to-end and confirmed — without a page reload — every row for that user
across the whole table updated from 6 to 8 credits instantly, proving the
refresh fix actually closes the staleness gap rather than just looking
right on first load.

## Task 58 — Add "Others" option to pickup date, time slot, and pickup point ✅
The pickup-scheduling flow (date / time slot / pickup point) needed an
"Others" option in all three fields, not just the preset choices.

**Investigation.** All three fields (`PickupScheduler.js`, used by both
the initial propose form and the `SuggestTimeForm` counter-proposal sheet)
were `PillSelect` — a single-purpose preset-only pill-button widget with
no free-text fallback. Confirmed this was a pure frontend gap, not a
backend/schema one: `pickupDate`/`timeSlot` are plain `String` columns
with no Prisma enum constraining them, and `customLocation` (a dedicated
free-text column, distinct from the optional `pickupPointId` FK) already
existed and was already wired end-to-end for the pickup-point pills —
nothing on the backend needed to change.

**Fix:**
- `apps/web/components/ui/PillSelect.js` — added a generic `allowOther`
  mode: an extra "Others" pill reveals an input (text by default, or
  `otherType="date"` for a native date picker) in place of the presets.
  The raw input is kept in local component state so the date type can
  render correctly (a native date input needs `YYYY-MM-DD` to display a
  selected value), while an optional `formatOther` transform controls
  what actually reaches the parent's `onChange`. Correctly detects and
  re-highlights "Others" on mount when the incoming `value` is already a
  custom string outside the preset list (needed for `SuggestTimeForm`,
  which pre-fills from a pending proposal that might itself be a
  previous custom value).
- `apps/web/lib/dates.js` — added `formatPickupDate(isoDateStr)` (shares
  the same `Intl.DateTimeFormat` instance `nextPickupDates` already used,
  factored out instead of duplicated) so a custom-picked date renders as
  "Thu 10 Sept" — identical style to the presets — everywhere it's shown
  or dropped into a notification string, instead of a raw ISO date
  looking inconsistent next to them. Added `tomorrowIsoDate()` for the
  date input's `min`, matching the presets' existing "never today"
  behavior (`nextPickupDates` starts at `i + 1`).
- `apps/web/components/pickup/PickupScheduler.js` — wired `allowOther`
  onto all three fields in both the main form and `SuggestTimeForm`, with
  short example placeholders for time slot ("e.g. 5–6 PM") and pickup
  point ("e.g. Basement parking").

**Verified live end-to-end** as a real logged-in test account: opened a
real exchange's "Schedule pickup" screen, selected "Others" on all three
fields, picked a real date via the native date input (2026-09-10) and
typed a custom time slot and pickup point, submitted, and confirmed via
a `window.fetch` hook the real request body sent
`{"pickupDate":"Thu 10 Sept","timeSlot":"5–6 PM","customLocation":"Basement parking, Tower B"}`
— the date correctly reformatted from raw ISO into the preset style — and
got back a real `201 Created` from a genuine `PickupSchedule` row. The
resulting screen correctly showed "Thu 10 Sept · 5–6 PM · Basement
parking, Tower B". Also opened "Suggest a different time" and confirmed
it correctly pre-filled and re-highlighted "Others" for the just-set
custom time slot and pickup point (proving the custom-value-on-mount
detection works, not just the fresh-selection path). Confirmed the whole
form renders cleanly at 375px mobile width with no overflow.

## Task 59 — Home page filters/search broken; add ISBN search ✅
All the filter and search functionality on the home page needed to work
correctly, plus add "search by ISBN code" to the search section.

**Investigation.** A parallel exploration during Task 55 had already
traced the backend discovery search (`discovery.service.js`) and found it
correct — including that its Prisma `OR` filter already matched
`isbn13`/`isbn10`, not just title/author — verified directly against the
real DB. That made "add ISBN search" look almost done already, so this
session started by testing it live rather than assuming: searched a real,
verified, in-scope ISBN (`9789357287586`, an active "Oswaal 24 JEE
Main..." listing, confirmed via a direct Prisma query against the shared
DB) on the real production site — **zero results**, despite the exact
same title being findable by name seconds earlier.

Isolated it precisely rather than guessing:
- Curled the live Render API directly with a real session cookie for the
  ISBN query — **it returned the correct match.** The backend was right
  all along; the bug was purely client-side.
- That pointed straight at `hooks/useBooks.js`, which — despite its own
  doc comment saying it "only searches/sorts the page of listings the API
  would have already returned" — was independently re-filtering the
  server's (already correct) results with its own separate 200ms-debounced
  copy of the query, checking `` `${title} ${author}` `` only. Since the
  listing objects returned by discovery don't even carry an ISBN field,
  this second filter silently discarded every listing the server had
  legitimately matched by ISBN — a real, confirmed bug, not a hypothesis
  (this exact code path was flagged as suspicious-but-unconfirmed during
  Task 55; today's live test is what confirmed it).
- Confirmed `useBooks` has exactly one caller (`home/page.js`) before
  touching it, so no other screen could be affected.

**Fix**: `hooks/useBooks.js` — removed the redundant text-search filter
(and its own separate debounce) entirely; the hook now only sorts what
the server already returned, matching what its own comment always said
it should do. `home/page.js` — dropped the now-unused `query` param from
the `useBooks` call, and changed the search placeholder from "Search
title, author, genre…" to "Search title, author, ISBN…" so the
already-working (once unblocked) ISBN search is actually discoverable.

**Verified live** end-to-end on local dev against the same shared DB used
above: searching the exact ISBN now correctly surfaces "Oswaal 24 JEE
Main..."; re-tested title search ("Physical" → Physical Education) as a
regression check — still correct; tested the Non-fiction genre chip
(legitimately zero results at this radius — confirmed via the network
request that `genre=Non-fiction` was sent and the empty result is real,
not a bug); reset to "All" and confirmed all 14 books list correctly
with full data; opened the Sort sheet and confirmed it presents all
three options correctly. Confirmed the updated search bar renders
cleanly at 375px mobile width.

## Task 60 — Book detail page shows only partial book data ✅
Clicking into a particular book's detail page only showed a subset of
fields — user wants the complete book detail data shown there.

**Investigation.** Found a two-layer gap, both real:
- `BookDetailView.js` reads `book` purely from `AppDataContext`'s
  in-memory `books` map — it never called the dedicated
  `GET /listings/:id` detail endpoint at all, despite that endpoint
  (`listings.service.js#getListing` → `_toDto`) and its frontend wrapper
  (`listingsService.get`) already existing and being noticeably richer
  than discovery's card DTO. A repo-wide grep confirmed `listingsService.get`
  had zero callers — genuinely dead code. So the detail page was always
  stuck with whichever skinny/medium DTO happened to already be cached
  from wherever the viewer navigated from (discovery's `_toCardDto` is the
  thinnest; my-books/received's `_toDto` is richer but still incomplete).
- Even the richer `_toDto` itself was missing real `Book` schema fields
  that were already being fetched from Postgres (`include: { book: true }`
  pulls every column) but never mapped into the DTO: `publisher`,
  `description`, `pageCount`, `edition` — confirmed by reading
  `schema.prisma`'s `Book` model directly against `_toDto`'s return object.
- A smaller labeling bug in the same area: the one identifier line that
  did exist showed `Edition: {book.year}` — `year` is actually
  `publicationYear`, not the separate (and always-empty-in-`_toDto`,
  until now) `edition` field, so this label was simply wrong regardless
  of the missing-fields issue.

**Fix:**
- `apps/api/src/listings/listings.service.js#_toDto` — added `edition`,
  `publisher`, `description`, `pageCount` to the returned object; no
  Prisma query changes needed, the data was already being fetched.
- `apps/web/contexts/AppDataContext.js` — new `ensureBookDetail(id)`,
  finally putting the dead `listingsService.get` to use: fetches the full
  detail DTO and merges it over whatever's cached (`mergeListings`
  already replaces-by-key), swallowing errors so a removed/missing
  listing falls back cleanly instead of throwing.
- `BookDetailView.js` — calls `ensureBookDetail(bookKey)` on mount, every
  time, regardless of what's already cached, so the page always ends up
  with the complete record. Added a `checked` guard (same pattern as
  `PickupScheduler.js`'s exchange-detail fetch) so a fresh direct-link
  page load — nothing cached yet — shows a loading spinner instead of
  incorrectly flashing "no longer available" before the fetch lands.
  Now renders: `subtitle` (under the title), a `MetaGrid` that flexibly
  wraps in however many fact cells are actually present (Condition,
  Language, plus Publisher/Pages only when non-null, correct dividers on
  every side including between wrapped rows), `condDesc` (the owner's own
  condition note, previously fetched but never rendered), a corrected
  identifier line (`ISBN: … · Published: … · Edition: …`, each field only
  shown when present, no more `year` mislabeled as edition), and a new
  "About this book" section for `description` when the record has one.

**Verified live end-to-end**, including a genuine cold-cache case: found
a real listing (Atomic Habits) in the shared DB whose `Book` row actually
has `description`/`pageCount` populated (confirmed via direct query
first, to know what a positive case should show), navigated to it by
listing id directly (a fresh page load with nothing pre-cached — exactly
the scenario the dead detail-endpoint bug would have hit hardest) and
confirmed the full real page: Pages (320), the condition note ("Book is
in good condition"), a correct "ISBN: … · Published: 2018" line, and a
real "About this book" paragraph rendered from Google Books' description
text — all fields that were previously invisible on this exact screen.
Cross-checked a book whose record genuinely has no publisher/description/
pageCount (Sapiens [Tenth Anniversary Edition]) and confirmed those
sections are correctly omitted rather than showing blank/undefined.
Confirmed the pre-existing "this listing is no longer available" path
still works correctly for a genuinely invalid id (regression check on the
new `checked` state logic). Confirmed the whole page, including the new
wrapped `MetaGrid`, renders cleanly at 375px mobile width.

Noted but not investigated further (looked like test-data noise, not an
app bug): the user's own screenshot and one test listing here both show a
condition photo that doesn't match the listed book (e.g. Atomic Habits
showing a "milk and honey" cover) — since condition photos are whatever
the individual lending member actually uploaded of their own physical
copy, a mismatch is a data-entry issue for that one test listing, not
something the code got wrong.

## Task 61 — Book cancellation reason for both owner and buyer, surfaced in notifications ✅
A cancellation reason must be captured from whichever side cancels
(owner or buyer), but only once the book request has already been
accepted by the owner (not for a plain pending-request cancellation).
The reason must also be shown in the notification itself, not just
somewhere in-app.

**Investigation.** Reason-capture already existed, but only in one of
two places: `PickupScheduler.js`'s cancel sheet (a `CancelReasonForm`
with a fixed 4-option radio list, reachable once a request is accepted).
The gap was `ExchangeDetailView.js` — the main exchange screen — whose
own "Cancel" button called `cancelExchange(exchange.id)` with **no
reason at all**, and was reachable at every non-terminal stage including
already-accepted ones, for both roles (no role gating in the JSX). The
backend (`requests.service.js#cancel`) already accepted an optional
`reason` and — this part needed no change — already appended it to the
other party's notification body whenever one was supplied
(`` `...was cancelled${reason ? ` — ${reason}` : ''}.` ``); the only real
gaps were (a) that second UI entry point never supplying one, and (b)
nothing server-side actually requiring one once a request moves past
`REQUESTED`.

**Fix:**
- `apps/api/src/requests/requests.service.js#cancel` — now throws
  `BadRequestException('A reason is required to cancel an accepted
  exchange')` when `request.status !== 'REQUESTED'` and no reason is
  given, so the rule holds even if a client ever skips the prompt —
  cancelling a still-pending request is untouched, exactly as the task
  asked.
- Extracted `PickupScheduler.js`'s inline `CancelReasonForm` (+ its
  `CANCEL_REASONS` list) into a new shared
  `apps/web/components/exchange/CancelReasonForm.js`, so it's one
  component instead of a near-duplicate in two places.
- `ExchangeDetailView.js` — `onCancel` now branches on
  `exchange.stage === 'requested'`: pending stays a direct one-tap cancel
  with no prompt (unchanged); anything past that opens the same
  `CancelReasonForm` sheet used by PickupScheduler, for either role, since
  the button itself was never role-gated to begin with.

**Verified live end-to-end**, both roles, both the UI and the API
directly:
- As the real requester on a genuine `ACCEPTED` exchange ("Test Accept
  Flow Book"): tapped Cancel on the exchange detail page, confirmed the
  reason sheet now appears (it didn't before), picked "Unable to contact
  the other user", submitted, and confirmed via a direct DB query both
  that `BookRequest.cancellationReason` was persisted correctly **and**
  that the real notification row created for the other party (the owner)
  has body `"The exchange for \"Test Accept Flow Book\" was cancelled —
  Unable to contact the other user."` — the reason genuinely reaches the
  notification, not just the UI.
- Backend validation, via direct authenticated API calls bypassing the
  UI entirely: cancelling a different real `ACCEPTED` request with an
  empty body correctly 400s with the new message; the identical request
  immediately after, with a real reason, succeeds (201).
- Pending-stage regression check: created a fresh `REQUESTED` request via
  the real API and cancelled it with an empty body — succeeds (201), no
  reason required, confirming the "not for a plain pending-request
  cancellation" rule holds.
- Logged in as the real *owner* of a separate accepted (`pickup-proposed`
  stage) exchange and confirmed the Cancel button on `ExchangeDetailView`
  also opens the same reason sheet for that role — the fix isn't
  requester-only.

**Revised after user feedback: made optional, not required.** The user
clarified the reason should be optional at the accepted stage too, not
mandatory — reverted the backend's `BadRequestException` requiring one,
and changed `CancelReasonForm` to start with nothing pre-selected
(previously a reason was always pre-checked, so the UI never actually
let anyone submit without one even before the mandatory backend check
existed) plus relabelled the sheet's copy to "Reason (optional)".
Verified live end-to-end again after the change: a direct API call
cancelling a real accepted exchange with an empty body now succeeds
(no more 400), the resulting notification reads the clean
`"...was cancelled."` with no dangling `" — "` when no reason is given;
and — through the real browser UI this time, not just curl — opened a
fresh accepted exchange's cancel sheet, confirmed no radio is
pre-selected, and submitted with none picked, which cancelled correctly
with a normal success toast.

## Task 62 — Remove the tick/checkmark icon from Notification Preferences (next to Clear all) ✅
User attached a screenshot of the Notifications page — remove the
checkmark icon sitting to the right of "Clear all".

**Fix**: `app/(main)/notifications/page.js` — that button dispatched
`markAllRead()`; removed the button (and the now-unused `markAllRead`
import) and simplified the header's `right` slot back to just the
"Clear all" button, no longer wrapped in a flex row that existed purely
to hold both buttons.

**Verified live**: confirmed the icon is gone and "Clear all" still
works correctly (cleared a real account's notifications, list emptied,
subtitle correctly updated to "You're all caught up", and the header's
right-side controls correctly disappear entirely when there's nothing
left to clear — pre-existing behavior, unaffected). Re-checked with a
second account that still had notifications to confirm the header layout
looks clean with just "Clear all" alone, at both desktop and 375px
mobile width, with no leftover spacing from the removed button.

## Task 63 — Remove the wishlist (heart) icon from the book detail page ⬜
User attached a screenshot of a book detail page — remove the heart/
wishlist icon shown top-right of that page.

## Task 64 — "Not signed in" error when listing a book manually right after OTP signup ✅ (confirmed working on real device)
User reported: signed up using the OTP shown on screen (dev OTP), then
tried to list a book manually on their phone, and got a "not signed in"
error even though signup/OTP verification had just succeeded.

**Investigation.** Ruled out several plausible causes with real evidence
before settling on the actual one:
- Not a frontend race — `OtpVerifyForm.js` awaits the verify request and
  only navigates after it resolves; no premature redirect.
- Not the `JwtAuthGuard` throwing on stale client state — confirmed via
  code that "Not signed in" is a real backend 401
  (`apps/api/src/common/guards/jwt-auth.guard.js`) thrown when
  `req.cookies[SESSION_COOKIE_NAME]` is genuinely missing from the
  request — not a frontend-only illusion.
- An initial hypothesis (session cookie getting `secure:false,
  sameSite:'lax'` because dev-OTP visibility implied `NODE_ENV !==
  'production'`) turned out to be **wrong on direct inspection** — curled
  the real production OTP-verify endpoint directly and confirmed the
  actual `Set-Cookie` header already has the correct
  `HttpOnly; Secure; SameSite=None`. Also reproduced a full sign-up on
  the live site and confirmed a same-browser follow-up cross-origin call
  to `/auth/me` succeeded — so the cookie *is* being set and sent
  correctly in a Chromium-based browser.
- **Real root cause**: the frontend (Vercel) and API (Render) are on two
  entirely different domains, which makes the session cookie a
  third-party cookie from the browser's perspective — and **iOS Safari
  blocks third-party cookies by default** ("Prevent Cross-Site
  Tracking", on for every iPhone out of the box), regardless of correct
  `Secure`/`SameSite=None` flags. This is a known, common failure mode
  for exactly this frontend/backend-on-different-domains architecture,
  and explains "works right after signing in on desktop, fails
  specifically on an iPhone" precisely. Confirmed with the user this was
  tested on a mobile phone.
- Asked the user how to fix it given this is an architectural choice, not
  a one-line patch — they chose the Vercel proxy/rewrite approach over
  switching to bearer-token auth.

**Fix**: `apps/web/next.config.mjs` now proxies `/api/v1/*` through the
same Vercel domain via `rewrites()`, forwarding to `BACKEND_API_URL`
server-side — so the browser only ever talks to its own origin for API
calls, eliminating the third-party-cookie problem entirely with no
changes needed anywhere else in the app. Guarded behind `BACKEND_API_URL`
being set at all, so local dev (where frontend and API are same-site
`localhost` ports and already work fine) is completely unaffected —
verified live, local dev still works exactly as before after this change.
`apps/web/.env.example` documents the new `BACKEND_API_URL` var and that
`NEXT_PUBLIC_API_URL` must become the *relative* path `/api/v1` in
production specifically (not touched locally). Checked every usage of
`NEXT_PUBLIC_API_URL` in the codebase (`lib/api-client.js` is the only
functional one) — a relative base URL works fine there since `fetch()`
resolves relative paths against the current page's own origin.

**Deliberately left as a separate follow-up, not fixed here**: the
Socket.IO notification gateway (`NEXT_PUBLIC_SOCKET_URL`) still connects
directly cross-origin to Render, unproxied — WebSocket rewrite support
through Vercel is less proven/reliable than plain HTTP, and this wasn't
the reported symptom (chat itself is already switched off per an earlier
task; only real-time notification push is at stake, which has a working
non-realtime fallback per its own code comments). If the same
third-party-cookie issue turns out to affect socket auth on iOS too,
that's follow-up work, not bundled into this fix.

**Still needs a manual step from the user** (Vercel dashboard access,
not something I can do): set `BACKEND_API_URL=https://kitabx-platform.onrender.com`
(no `/api/v1` suffix) and change the existing `NEXT_PUBLIC_API_URL` to
the literal relative value `/api/v1` in the Vercel project's production
environment variables, then redeploy. Until that's done, production
keeps working exactly as it does today (calling Render directly) since
the rewrite is a no-op without `BACKEND_API_URL` — this change is inert
until that env var is set.

**User set the env vars, redeployed, and confirmed on a real iPhone**:
signing up and immediately listing a book no longer throws "Not signed
in." Closing this out.

## Task 65 — Manual "Enter details" photo slots force camera-only, same as bulk upload did ✅
The manual add-a-book flow's 3 photo slots (Cover/Photo 2/Photo 3) needed
the same "Take Photo or Choose from Gallery" native-chooser fix already
applied to bulk-upload-with-AI in Task 56.

**Investigation.** `components/books/PhotoUploader.js` doesn't reuse the
shared `UploadBox` component at all — it's a separate, standalone
3-slot grid with its own hidden `<input type="file">` per slot, each
hardcoded with `capture="environment"` — the exact same bug as Task 56,
just in a second, independent component.

**Fix**: removed `capture="environment"` from all three inputs, same
reasoning as Task 56 — the plain input hands control to the phone's
native chooser, which offers both "Take Photo" and the gallery through
one tap target, instead of the app forcing the camera open directly and
hiding the gallery option.

**Verified live end-to-end**: confirmed all three inputs now have no
`capture` attribute, then dispatched a real synthesized file into the
Cover slot via a `DataTransfer`-backed `change` event — confirmed it
correctly uploaded to `POST /uploads/listing-photo` (201 Created) and
the UI updated to "1/3 photos added" with the cover slot showing the
uploaded image, proving the fix didn't disturb the working upload
pipeline.

## Task 66 — Remove owner-only actions (Edit/Pause/Remove listing) from Received and Given books on My Shelf ✅
On My Shelf's "Received" and "Given" tabs, tapping "View" on a book opened
the same detail page as an active listing, which showed "Edit listing" /
"Pause listing" / "Remove listing" — these only make sense for a book
the viewer still actively owns and lists, not one they've received from
someone else or already given away.

**Investigation.** `BookDetailView.js` gated all owner actions on one flag,
`const mine = !!book.mine`. Traced where that flag actually comes from
(`AppDataContext.js#refreshMyBooks`): "My Books" gets real ownership from
the backend, but **received books have `mine` force-set to `true`** —
deliberately, but only so `books/page.js`'s tab-bucketing (`Object.values(
books).filter(b => b.mine)`, then split further by `b.status`) can find
received/given rows through one shared flag. `BookDetailView.js` reuses
that same overloaded flag for owner-permission purposes, which is where
it breaks — a received book was never actually owned by the viewer, and a
given-away book, while genuinely once-owned, has a COMPLETED exchange
with nothing left to manage (the backend's own `removeListing`/`setPaused`
already reject actions on a COMPLETED listing).

**A second, subtler bug found while fixing this**: Task 60 made the detail
page always call the generic `GET /listings/:id` endpoint on mount and
merge the result over the cache. That endpoint's `isMine` is a plain
"are you this listing's real owner" check — for a *receiver* viewing a
book they received, that's correctly `false` server-side, and the
server's own `_statusLabel(listing, isMine=false)` has no concept of
"received by this specific viewer" at all — it just returns `'Available'`
for a non-owner viewing *any* non-reserved listing, including a
COMPLETED one. Combined, Task 60's fresh-fetch would have **silently
overwritten** a received book's correct `mine:true, status:'Received'`
framing back to `mine:false, status:'Available'` the moment this task's
fetch-on-mount fired — reintroducing a *worse* bug (a "Request this book"
button on an already-completed exchange) while fixing this one, had it
gone unnoticed.

**Fix:**
- `AppDataContext.js#ensureBookDetail` — when the already-cached entry for
  a book is tagged `'Received'` or `'Given away'`, the fresh fetch now
  enriches it with the fuller fields (description, publisher, pageCount,
  ...) but preserves the existing `mine`/`status`/`receivedAt`, instead of
  letting the generic endpoint's owner-blind view clobber that
  viewer-specific framing.
- `BookDetailView.js` — new `canManage = mine && book.status !== 'Given away'
  && book.status !== 'Received'`, used (instead of the raw `mine` flag) to
  gate the "How credits work" note + Pause/Reactivate block, and the
  sticky action bar's Edit/Remove branch. For a `mine`-but-not-`canManage`
  book (Given/Received), the entire sticky action bar is now omitted
  outright — there's nothing to request, cancel, edit, or remove once an
  exchange is done. `mine` itself is left untouched everywhere else (the
  address-reveal and Report-listing logic), since those weren't part of
  what was asked and already behaved reasonably.

**Verified live** with three real accounts/scenarios on local dev (shared
DB with production): an active "My Books" listing (Live Browser's "Task 40
Bug Repro Book") still correctly shows "How credits work", "Pause
listing", "Edit listing", "Remove listing" — confirming no regression;
Live Browser's one "Given away" listing ("Task 35 Clean Trigger Book")
now shows none of that and no action bar at all; and — logging in as
Priya Sharma, a real account with a genuine completed "Received" exchange
for "Sapiens" — confirmed the same, plus confirmed the owner's address
still correctly shows as block-level only (not the full address), proving
the preserved `mine` flag didn't leak into the separate address-reveal
logic. All three checked via real page navigation and `get_page_text`,
not assumed from code alone.

## Task 67 — Home page "Search & Filters" sheet (Genre/Language/Condition) doesn't actually filter, from either of its 2 entry points ✅
The "Search & Filters" bottom sheet on the home page — reachable from two
separate places there — didn't apply Genre/Language/Condition filtering
at all when "Show N books" was tapped. Discovery-radius filtering inside
this same sheet was skipped/deprioritized per the user (it already
worked — see below).

**Investigation.** Confirmed both entry points (the sliders icon next to
the search box, and an identical sliders icon inside `GenreChips.js`)
open the exact same `FilterSheet`, via the same `openFilters` in
`home/page.js`. The sheet itself was a fully disconnected mock: it kept
its own local `selected` state and computed a **fake** "Show N books"
count via plain arithmetic (`totalBooks - activeCount*4 - radiusSteps`)
— never a real query. Worse, when "Show N books" was tapped, the parent's
`onApply` handler was `({ resultCount }) => showToast(...)` — it
destructured out only the fake count and **silently discarded**
`genre`/`lang`/`cond` entirely. Selections never reached any state that
fed the actual `searchBooks` call.

Two further, independent bugs surfaced once tracing this against real
data (checked directly against the shared DB, not assumed):
- `CONDITION_FILTERS` in the old sheet was `['New', 'Like New', 'Good',
  'Fair']` — real listings are only ever created with 'Brand New',
  'Like New', 'Good', or 'Well Read' (`lib/mockData.js`'s `CONDITIONS`,
  the same list the add-book form uses). 'New' and 'Fair' were never
  real values at all — those two chips could never have matched
  anything even if wired up correctly.
- Real listing data has **inconsistent casing** for `condition`
  ("Good" × 9, "GOOD" × 21 within the test society alone) and for
  `languageCode` ("English" vs "en"). An exact-match filter would
  silently miss whichever casing wasn't typed — this was a real,
  measured gap, not a hypothetical.
- A latent bug from Task 59's era, now newly exposed: `discovery.service.js`
  built `genre` and `language` as two separate `book: {...}` object
  spreads in the same `where` clause — the second spread would have
  **silently clobbered the first** the moment both were ever supplied
  together (plain object spread replaces the whole `book` key, it
  doesn't merge). Harmless while the frontend never sent `language` at
  all; about to become a live bug the moment this fix let the sheet send
  both at once.
- `radiusKm` inside the sheet, by contrast, already worked — `adjustRadius`
  dispatches to the same global Redux `locationSlice` the main page's
  `radiusKm` reads from `searchBooks`, so it was never dead state like
  the other three; left untouched per the user's own instruction to skip it.

**Fix:**
- `apps/api/src/discovery/discovery.controller.js` /
  `discovery.service.js` — added `condition` support end-to-end (a plain
  `BookListing.condition` filter, case-insensitive); merged `genre` and
  `language` into one `bookFilter` object instead of two colliding
  spreads; made `language` case-insensitive too.
- `apps/web/services/discovery.service.js` — passes `condition` through
  to the query string alongside the existing params.
- `apps/web/components/discovery/FilterSheet.js` — rewritten as a
  properly *controlled* component: takes `genre`/`language`/`condition`
  as props (so reopening it reflects whatever's actually applied),
  single-select per group (tap again to clear) rather than multi-select
  arrays the backend has no "OR" support for, corrected `CONDITION_FILTERS`
  to the real values, dropped an ad-hoc extra `'Marathi'` language option
  that wasn't in the canonical list used at listing-creation time, and
  removed the fake result-count arithmetic entirely — the button just
  says "Apply filters" now rather than presenting a number nobody
  computed for real.
- `apps/web/app/(main)/home/page.js` — added real `language`/`condition`
  state, included both in the `searchBooks` call and its effect
  dependencies, and rewrote `openFilters`'s `onApply` to actually call
  `setGenre`/`setLanguage`/`setCondition` instead of discarding them.

**Verified live end-to-end** against real, precisely-known data (checked
DB values first so the test had a known-correct answer, not a guess):
filtering by "Good" condition correctly returned all 12 real listings
whose stored condition is "Good" **or** "GOOD" (confirmed via the actual
network response body — every returned `cond` was one of those two,
case-insensitively matched) and correctly excluded a real "Physical
Education" listing whose genuine condition is "Like New" — then
switching the filter to "Like New" correctly returned exactly that one
listing and nothing else. Confirmed both entry points (the search-bar
icon and `GenreChips`' icon) open the identical, now-working sheet.
Confirmed the sheet is genuinely controlled — reopening it after
applying "Good" showed "Good" still selected, not reset. Confirmed
"Clear all" correctly resets the real applied filters (not just local
UI state) back to the unfiltered set. Checked the corrected Condition/
Language chip labels render correctly at 375px mobile width (the same
pre-existing horizontally-scrollable `.chiprow` pattern already used
elsewhere on this page, not a new issue).
