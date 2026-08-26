'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { renderGoogleButton } from '@/lib/googleAuth';
import { signInWithApple } from '@/lib/appleAuth';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
const APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI;

/**
 * Google + Apple sign-in (Task 32), shared by the member login form and the
 * admin login page. Renders nothing for a provider whose client id isn't
 * set — neither SDK does anything useful without one, so there's no working
 * button to show rather than a disabled placeholder.
 */
export default function SocialSignInButtons({ onToken, onError, busy }) {
  const googleContainerRef = useRef(null);
  const [appleBusy, setAppleBusy] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleContainerRef.current) return;
    renderGoogleButton(
      googleContainerRef.current,
      GOOGLE_CLIENT_ID,
      (idToken) => onToken('google', idToken),
      onError,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApple = async () => {
    setAppleBusy(true);
    try {
      const idToken = await signInWithApple(APPLE_CLIENT_ID, APPLE_REDIRECT_URI);
      onToken('apple', idToken);
    } catch (err) {
      onError?.(err);
    } finally {
      setAppleBusy(false);
    }
  };

  if (!GOOGLE_CLIENT_ID && !APPLE_CLIENT_ID) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
      {GOOGLE_CLIENT_ID && <div ref={googleContainerRef} style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }} />}
      {APPLE_CLIENT_ID && (
        <button
          type="button"
          className="btn btn-outline"
          onClick={handleApple}
          disabled={busy || appleBusy}
        >
          <Icon name="apple" style={{ width: 15, height: 15 }} />
          {appleBusy ? 'Connecting…' : 'Sign in with Apple'}
        </button>
      )}
    </div>
  );
}
