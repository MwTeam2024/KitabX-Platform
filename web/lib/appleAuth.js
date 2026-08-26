'use client';

const SCRIPT_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
let scriptPromise = null;

function loadScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Apple sign-in is only available in the browser'));
  if (window.AppleID) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load Apple sign-in'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

/**
 * Runs the real Apple JS SDK popup flow and resolves with the signed
 * `id_token` — verified server-side against Apple's own public keys, never
 * trusted as-is just because the browser handed it back.
 */
export async function signInWithApple(clientId, redirectURI) {
  if (!clientId) throw new Error('Apple sign-in is not configured');
  await loadScript();
  window.AppleID.auth.init({
    clientId,
    scope: 'name email',
    redirectURI,
    usePopup: true,
  });
  const result = await window.AppleID.auth.signIn();
  const idToken = result?.authorization?.id_token;
  if (!idToken) throw new Error('Apple did not return a sign-in token');
  return idToken;
}
