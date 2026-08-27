'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useIsClient } from '@/hooks/useClientOnly';

/**
 * "Install PWA" prompt required by §5 / §17. Chrome fires `beforeinstallprompt`,
 * which we stash and replay on tap; iOS Safari gets the Share-sheet instruction
 * instead because it has no programmatic install.
 */
export default function InstallPrompt() {
  const isClient = useIsClient();
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  // Browser-only capability checks, derived rather than pushed through an effect.
  const { standalone, isIos } = useMemo(() => {
    if (!isClient) return { standalone: false, isIos: false };
    return {
      standalone:
        window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
      isIos: /iphone|ipad|ipod/i.test(window.navigator.userAgent),
    };
  }, [isClient]);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const canPrompt = !!deferred;

  // Chrome only ever fires `beforeinstallprompt` once its own (undocumented,
  // timing-dependent) engagement heuristics are satisfied — a fully valid
  // manifest + active service worker (both true here) is necessary but not
  // sufficient. Rendering nothing until then made this look broken even
  // though nothing was actually wrong — every non-installed, non-iOS browser
  // now gets the same kind of manual fallback iOS always had.
  if (standalone || installed) return null;

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="note-box" style={{ marginBottom: 18, textAlign: 'left' }}>
      <Icon name="download" />
      <span style={{ flex: 1 }}>
        <b>Install KitabX</b>
        <br />
        {canPrompt ? (
          <>
            Add it to your home screen for a full-screen, offline-ready app.{' '}
            <button className="link-green" onClick={install} style={{ fontSize: 12 }}>Install now</button>
          </>
        ) : isIos ? (
          <>Tap Share, then &ldquo;Add to Home Screen&rdquo; to install KitabX.</>
        ) : (
          <>Open your browser menu (⋮) and tap &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;.</>
        )}
      </span>
    </div>
  );
}
