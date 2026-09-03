'use client';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
// Google's own hard cap for `size: 'large'` — confirmed empirically
// (requesting more than this just silently clamps to it).
const GOOGLE_LARGE_BUTTON_MAX_WIDTH = 400;
let scriptPromise = null;

function loadScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google sign-in is only available in the browser'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load Google sign-in'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/** Polls instead of reading exactly once — used both for the container's
 * width right after mount (layout may not be committed on the very first
 * check) and for Google's own button element after renderButton() (it's
 * injected asynchronously, not within the same tick as that call). */
function pollFor(read, tries = 20) {
  return new Promise((resolve) => {
    let n = 0;
    const check = () => {
      const value = read();
      if (value || n >= tries) return resolve(value);
      n += 1;
      requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * Renders Google's own "Sign in with Google" button into `container`, then
 * CSS-scales the *actual rendered result* to exactly match `targetWidth` /
 * `targetHeight` — measured after the fact rather than pre-computed, so a
 * wrong guess can't send it out of bounds like an earlier version of this
 * did on real phones. `container` should have `overflow: hidden` set by the
 * caller as a hard backstop regardless.
 *
 * The button's look/label are entirely Google's (Google Identity Services),
 * not a custom styled element, per their branding requirements — scaling
 * non-uniformly to hit an exact width and height both does stretch the
 * logo/text somewhat, which their guidelines discourage, but that trade-off
 * is the point of passing explicit target dimensions here at all; callers
 * that don't need an exact match can simply omit them.
 * `onCredential(idToken)` fires with the real signed ID token once the user
 * completes the flow; we never see their Google password.
 */
export async function renderGoogleButton(container, clientId, onCredential, onError, targetWidth, targetHeight) {
  if (!container || !clientId) return;
  // React 18 Strict Mode fires this effect's body twice on mount (the same
  // DOM node both times) — without this guard, two renderButton() calls
  // race on the same container.
  if (container.dataset.googleButtonRendered) return;
  container.dataset.googleButtonRendered = '1';
  // Hidden until the fit below settles — Google's button doesn't arrive at
  // its final natural size in one shot (an icon-only pass, then the real
  // label), so measuring too early scales against a too-small natural size
  // and produces an oversized button that then visibly snaps down once a
  // later pass corrects it. Staying hidden until sizing has settled means
  // the visitor only ever sees the final, correctly-scaled result.
  container.style.visibility = 'hidden';
  try {
    await loadScript();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
    });

    const containerWidth = (await pollFor(() => Math.round(container.getBoundingClientRect().width))) || 320;
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      logo_alignment: 'center',
      width: Math.min(containerWidth, GOOGLE_LARGE_BUTTON_MAX_WIDTH),
    });

    // Width defaults to the container's own (already `width:100%` in
    // practice) size, so the common case — "match whatever row this sits
    // in" — needs only a `targetHeight` from the caller, not a hardcoded
    // pixel width that would drift if the layout around it ever changes.
    const finalTargetWidth = targetWidth || containerWidth;

    // A returning visitor already signed into a Google account in this
    // browser gets a *personalized* button ("Sign in as <name>", with their
    // avatar) instead of the generic one. That variant isn't just slower to
    // inject — Google renders a first pass, then SWAPS its inner content
    // (name/avatar) for the real account data once that finishes loading,
    // discarding whatever we'd already applied to the first pass. A single
    // poll-then-apply (even with a long timeout) only ever catches one of
    // those passes. A MutationObserver re-applies the fit on every DOM
    // change instead, so it survives however many passes Google does.
    const applyFit = () => {
      const rendered = container.querySelector('[role="button"]');
      if (!rendered) return;
      // Google's own chrome shows the browser's default focus ring (a
      // blue/purple outline) after being clicked, same as any div with
      // role="button" — harmless but looks like a stray border sitting on
      // top of an otherwise plain white pill.
      rendered.style.outline = 'none';
      if (!finalTargetWidth && !targetHeight) return;
      // Measure the NATURAL size, not whatever scale we last applied —
      // reading getBoundingClientRect() after our own transform would
      // return the already-scaled size and compound on every re-run.
      const prevTransform = rendered.style.transform;
      rendered.style.transform = 'none';
      const rect = rendered.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        rendered.style.transform = prevTransform;
        return;
      }
      const scaleX = finalTargetWidth ? finalTargetWidth / rect.width : 1;
      const scaleY = targetHeight ? targetHeight / rect.height : 1;
      rendered.style.transform = `scale(${scaleX}, ${scaleY})`;
      rendered.style.transformOrigin = 'center';
    };

    // Debounced: only actually run applyFit (and reveal the container) once
    // the DOM has been quiet for a while, instead of reacting to every
    // intermediate pass Google makes while it's still settling. Google does
    // this in (at least) two passes close together — an initial insert, then
    // a follow-up once its own asset/data loading finishes — so a short
    // debounce (previously 200ms) reveals after the FIRST pass and then has
    // to re-hide for the second, which is itself a visible flicker. 600ms
    // comfortably covers the gap between those passes so both normally
    // collapse into a single reveal with nothing shown in between. Re-hiding
    // on every mutation (not just while unsettled) stays in place as a
    // safety net for a genuinely late swap (e.g. slow personalized-avatar
    // data arriving after this window).
    let settleTimer = null;
    const scheduleApplyFit = () => {
      container.style.visibility = 'hidden';
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        applyFit();
        container.style.visibility = 'visible';
      }, 600);
    };

    scheduleApplyFit();
    // childList/subtree only (not `attributes`) — our own applyFit() writes
    // are attribute (style) changes, so watching those too would make the
    // observer re-trigger itself on every write it just made.
    const observer = new MutationObserver(scheduleApplyFit);
    observer.observe(container, { childList: true, subtree: true });
    // Google's DOM settles within a couple of seconds even for the slowest
    // (personalized) variant — no need to watch forever. Also acts as a
    // failsafe reveal in case sizing never settled for some reason.
    setTimeout(() => {
      observer.disconnect();
      clearTimeout(settleTimer);
      container.style.visibility = 'visible';
    }, 8000);
  } catch (err) {
    container.style.visibility = 'visible';
    onError?.(err);
  }
}
