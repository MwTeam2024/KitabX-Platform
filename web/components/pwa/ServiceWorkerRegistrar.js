'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useOnlineStatus } from '@/hooks/useClientOnly';

/**
 * Registers the service worker and surfaces the "update available" prompt
 * required by §17. Registration is skipped in development so HMR isn't
 * intercepted by a cached shell.
 */
export default function ServiceWorkerRegistrar() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const offline = !useOnlineStatus();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let registration;
    const onUpdateFound = () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting || installing);
        }
      });
    };

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) setWaitingWorker(reg.waiting);
      reg.addEventListener('updatefound', onUpdateFound);
    }).catch(() => {
      // A failed registration must never break the app — it just loses offline support.
    });

    return () => registration?.removeEventListener('updatefound', onUpdateFound);
  }, []);

  const applyUpdate = () => {
    waitingWorker?.postMessage('SKIP_WAITING');
    setWaitingWorker(null);
    window.location.reload();
  };

  if (!waitingWorker && !offline) return null;

  return (
    <div className="pwa-banner" role="status">
      {offline ? (
        <>
          <Icon name="alertTriangle" style={{ width: 14, height: 14 }} />
          <span>You&apos;re offline — showing your last loaded books.</span>
        </>
      ) : (
        <>
          <Icon name="download" style={{ width: 14, height: 14 }} />
          <span>A new version of KitabX is ready.</span>
          <button onClick={applyUpdate}>Update</button>
        </>
      )}
    </div>
  );
}
