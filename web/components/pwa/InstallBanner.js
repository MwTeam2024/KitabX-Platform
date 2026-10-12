'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { isStandalone } from '@/lib/platform';

// Set only when the app actually gets installed (the browser tab stays open
// afterwards and would keep offering it). ✕ does NOT remember anything — it just
// closes the card for now, and it comes back the next time the home screen opens.
const INSTALLED_KEY = 'kitabx.installedAt';
const SHOW_AFTER_MS = 2000;
const VISIBLE_FOR_MS = 10000;
const INSTALLED_QUIET_MS = 30 * 24 * 60 * 60 * 1000;
// Only on the home (Discover) screen — where the member lands on opening the
// app and right after signing in — and nowhere else, so it never gets in the
// way of sign-in, onboarding, the admin console or any other screen.
const SHOW_ON_PATH = '/home';

// Chrome fires `beforeinstallprompt` once, a few hundred ms after load — before
// React's JavaScript runs. app/layout.js keeps it on `window.__kxInstallPrompt`
// from an inline script that runs first; this reads it (and clears it once it's
// been used, since an install prompt can only be used once).
const getStoredPrompt = () => (typeof window !== 'undefined' ? window.__kxInstallPrompt || null : null);
const clearStoredPrompt = () => {
  if (typeof window !== 'undefined') window.__kxInstallPrompt = null;
};

function readStorage(storage, key) {
  try {
    return window[storage].getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    window[storage].setItem(key, value);
  } catch {
    // Storage blocked — the banner may just show again next time.
  }
}

/** Every browser on an iPhone/iPad (all WebKit). iPadOS reports itself as a Mac. */
function onIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

/**
 * "Add KitabX to your home screen" — a small card at the top that appears a
 * couple of seconds after the app opens (every time it opens) and goes away by
 * itself after a few seconds.
 *
 * Android (Chrome): Install opens the browser's own install dialog and the app
 * lands on the home screen. iOS has no way to install from a button — Apple
 * only allows it through the Share menu — so there it shows those steps.
 * Browsers that never fire the install event get the "browser menu" steps.
 *
 * Shown on the home screen only (see SHOW_ON_PATH — that includes landing there
 * right after signing in), every time it opens. Closing it with ✕ is only for
 * now; it stays away only inside the installed app and for a month after the
 * app has been installed.
 */
export default function InstallBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState(getStoredPrompt);
  const [ios, setIos] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const blocked = pathname !== SHOW_ON_PATH;

  useEffect(() => {
    if (blocked) return undefined;
    const onPrompt = (event) => {
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      clearStoredPrompt();
      writeStorage('localStorage', INSTALLED_KEY, String(Date.now()));
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const installedAt = Number(readStorage('localStorage', INSTALLED_KEY));
    const recentlyInstalled = installedAt && Date.now() - installedAt < INSTALLED_QUIET_MS;
    let timer;
    if (!isStandalone() && !recentlyInstalled) {
      timer = setTimeout(() => {
        // Picks up a prompt that fired between the first render and now.
        setDeferred((current) => current || getStoredPrompt());
        setIos(onIos());
        setVisible(true);
      }, SHOW_AFTER_MS);
    }
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [blocked]);

  // Goes away on its own — unless the member opened the how-to steps.
  useEffect(() => {
    if (!visible || helpOpen) return undefined;
    const timer = setTimeout(() => setVisible(false), VISIBLE_FOR_MS);
    return () => clearTimeout(timer);
  }, [visible, helpOpen]);

  if (!visible || blocked) return null;

  // Closes it for now only — see INSTALLED_KEY.
  const dismiss = () => setVisible(false);

  const install = async () => {
    deferred.prompt();
    clearStoredPrompt(); // an install prompt can only be used once
    const choice = await deferred.userChoice.catch(() => null);
    setDeferred(null);
    if (choice?.outcome === 'accepted') setVisible(false);
    else setHelpOpen(false);
  };

  return (
    <div className="install-banner" role="status">
      <div className="install-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="install-icon" width="40" height="40" />
        <div className="install-text">
          <b>Install KitabX</b>
          <span>Open it like an app, full screen.</span>
        </div>
        {/* One button, one name. With the browser's install event (Chrome/Edge,
            Android) it opens the install dialog on the spot; where there is none
            (iOS, Firefox, an app that's already installed) a page can't do it for
            the member, so the same button shows the steps. */}
        <button
          className="install-btn"
          onClick={deferred ? install : () => setHelpOpen((o) => !o)}
          aria-expanded={deferred ? undefined : helpOpen}
        >
          Add to Home Screen
        </button>
        <button className="install-x" onClick={dismiss} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>
      {helpOpen && !deferred && (
        <p className="install-help">
          {ios ? (
            <>Tap the <b>Share</b> button in your browser, then choose <b>Add to Home Screen</b>.</>
          ) : (
            <>Open your browser menu <b>(⋮)</b> and tap <b>Install app</b> or <b>Add to Home screen</b>.</>
          )}
        </p>
      )}
    </div>
  );
}
