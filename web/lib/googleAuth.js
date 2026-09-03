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
    // avatar) instead of the generic one — it takes noticeably longer to
    // inject (fetching that account's name/photo first), so this needs a
    // much longer leash than the generic button ever does or the poll gives
    // up before Google's finished, leaving it at its own small default size.
    const rendered = await pollFor(() => container.querySelector('[role="button"]'), 180);
    if (rendered) {
      // Google's own chrome shows the browser's default focus ring (a
      // blue/purple outline) after being clicked, same as any div with
      // role="button" — harmless but looks like a stray border sitting on
      // top of an otherwise plain white pill.
      rendered.style.outline = 'none';
      if (finalTargetWidth || targetHeight) {
        const rect = rendered.getBoundingClientRect();
        const scaleX = finalTargetWidth ? finalTargetWidth / rect.width : 1;
        const scaleY = targetHeight ? targetHeight / rect.height : 1;
        rendered.style.transform = `scale(${scaleX}, ${scaleY})`;
        rendered.style.transformOrigin = 'center';
      }
    }
  } catch (err) {
    onError?.(err);
  }
}
