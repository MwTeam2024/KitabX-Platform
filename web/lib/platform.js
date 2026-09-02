/**
 * Cross-platform install/standalone detection, shared by InstallPrompt.js
 * and the push-permission flow (lib/firebase.js's caller) — both need to
 * know the same thing: is this iOS, and is the app already installed to
 * the home screen. `navigator.standalone` is iOS Safari's own (non-
 * standard) flag; `matchMedia('(display-mode: standalone)')` is the
 * cross-platform standard every other installable-PWA browser sets.
 */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIosDevice() {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}
