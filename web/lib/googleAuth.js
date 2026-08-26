'use client';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
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

/**
 * Renders Google's own "Sign in with Google" button into `container` — the
 * button's look/label/rendering are entirely Google's (Google Identity
 * Services), not a custom styled element, per their branding requirements.
 * `onCredential(idToken)` fires with the real signed ID token once the user
 * completes the flow; we never see their Google password.
 */
export async function renderGoogleButton(container, clientId, onCredential, onError) {
  if (!container || !clientId) return;
  try {
    await loadScript();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
    });
    window.google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      width: container.offsetWidth || 320,
      text: 'continue_with',
    });
  } catch (err) {
    onError?.(err);
  }
}
