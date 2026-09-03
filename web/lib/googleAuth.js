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
    // practice) size — re-measured live in applyFit() on every fit, NOT
    // captured once here. A caller's page can still be running its own
    // mount/opening transition (e.g. a scale-in animation on first paint)
    // when this first runs, so an early one-time measurement can lock in a
    // too-small width from mid-transition; a real device inspection showed
    // exactly that (`transform: scale(1, 1.136)` — scaleX of 1 meant no
    // width correction was ever applied). Reading it fresh each time, and
    // re-fitting whenever the container's own size actually changes (see
    // the ResizeObserver below), means it always matches the FINAL
    // settled layout, not whatever it was at first mount.
    const getTargetWidth = () => targetWidth || Math.round(container.getBoundingClientRect().width) || containerWidth;

    // A returning visitor already signed into a Google account in this
    // browser gets a *personalized* button ("Sign in as <name>", with their
    // avatar) instead of the generic one. That variant isn't just slower to
    // inject — Google renders a first pass, then SWAPS its inner content
    // (name/avatar) for the real account data once that finishes loading,
    // discarding whatever we'd already applied to the first pass. A single
    // poll-then-apply (even with a long timeout) only ever catches one of
    // those passes. A MutationObserver re-applies the fit on every DOM
    // change instead, so it survives however many passes Google does.
    //
    // That swap can also happen as an ATTRIBUTE change on an element already
    // in the tree (Google resizing its own button/iframe in place), not just
    // as nodes being added/removed — a previous version of this only watched
    // childList and missed that case entirely, so a late resize like that
    // left our stale scale (computed against the old, now-wrong natural
    // size) applied forever. Watching attributes too closes that gap.
    const observerOpts = { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] };
    let observer = null;
    // The observer is watching `container` itself (not just its subtree),
    // so OUR OWN writes onto `container.style.visibility` are just as
    // visible to it as anything Google does — every write below (both this
    // helper and inside applyFit) must go through here, disconnected before
    // and re-armed after, or the observer reacts to its own side effects and
    // never stops re-triggering itself (this exact bug shipped once already:
    // hide -> observed -> hide again -> observed -> ... forever, button
    // stuck invisible).
    const withObserverPaused = (fn) => {
      observer?.disconnect();
      fn();
      observer?.observe(container, observerOpts);
    };

    const applyFit = () => {
      // Google renders an initial `[role="button"]` overlay div, then swaps
      // to a bare `<iframe>` once its FedCM-based flow takes over (the
      // overlay is REMOVED entirely at that point, not just restyled) — a
      // real click test caught this live: the iframe is what's actually
      // interactive afterward, and it carries none of our earlier scale, so
      // it was sitting at Google's own unscaled native size (363x44 vs our
      // 343x50 target). Fit whichever of the two is currently present.
      const rendered = container.querySelector('[role="button"], iframe');
      if (!rendered) return;
      // Google's own chrome shows the browser's default focus ring (a
      // blue/purple outline) after being clicked, same as any div with
      // role="button" — harmless but looks like a stray border sitting on
      // top of an otherwise plain white pill.
      rendered.style.outline = 'none';
      const finalTargetWidth = getTargetWidth();
      if (finalTargetWidth || targetHeight) {
        // Measure the NATURAL size, not whatever scale we last applied —
        // reading getBoundingClientRect() after our own transform would
        // return the already-scaled size and compound on every re-run.
        const prevTransform = rendered.style.transform;
        rendered.style.transform = 'none';
        const rect = rendered.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          rendered.style.transform = prevTransform;
        } else {
          const scaleX = finalTargetWidth ? finalTargetWidth / rect.width : 1;
          const scaleY = targetHeight ? targetHeight / rect.height : 1;
          rendered.style.transform = `scale(${scaleX}, ${scaleY})`;
          rendered.style.transformOrigin = 'center';
        }
      }
    };

    // Debounced: only actually run applyFit (and reveal the container) once
    // 200ms have passed with no further DOM changes, instead of reacting to
    // every intermediate pass Google makes while it's still settling. Also
    // re-hides on EVERY mutation, not just the first — Google can still swap
    // its DOM well after the button was already revealed (e.g. avatar data
    // arriving late for the personalized variant), and without re-hiding
    // here that later swap would show as a visible resize instead of being
    // caught before it's ever shown.
    let settleTimer = null;
    const scheduleApplyFit = () => {
      withObserverPaused(() => { container.style.visibility = 'hidden'; });
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        withObserverPaused(() => {
          applyFit();
          container.style.visibility = 'visible';
        });
      }, 200);
    };

    observer = new MutationObserver(scheduleApplyFit);
    scheduleApplyFit();
    // A CSS-driven size change on `container` (its own mount/opening
    // transition finishing, an orientation change, a sidebar collapsing
    // elsewhere on the page) is NOT a DOM mutation at all — nothing added,
    // removed, or attribute-changed — so the MutationObserver above would
    // never see it. A ResizeObserver reacts to the real layout size
    // regardless of what caused it, which is exactly what's needed to
    // catch the too-small-target-width case described above.
    const resizeObserver = new ResizeObserver(scheduleApplyFit);
    resizeObserver.observe(container);
    // Google's DOM settles within a couple of seconds even for the slowest
    // (personalized) variant — no need to watch forever. Also acts as a
    // failsafe reveal in case sizing never settled for some reason.
    setTimeout(() => {
      observer.disconnect();
      resizeObserver.disconnect();
      clearTimeout(settleTimer);
      container.style.visibility = 'visible';
    }, 8000);
  } catch (err) {
    container.style.visibility = 'visible';
    onError?.(err);
  }
}
