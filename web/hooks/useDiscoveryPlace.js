'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { reverseGeocodePlace } from '@/lib/googleMaps';

const PLACE_KEY = 'kitabx.discoveryPlace';
// Geocoding-only key (see lib/googleMaps.js) — same one the address picker uses.
const GEOCODING_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY;

function loadPlace() {
  try {
    return window.localStorage.getItem(PLACE_KEY) === 'current' ? 'current' : 'home';
  } catch {
    return 'home';
  }
}

function savePlace(place) {
  try {
    window.localStorage.setItem(PLACE_KEY, place);
  } catch {
    // Storage blocked — the choice just won't survive a reload.
  }
}

// The last fix the GPS gave, kept on this device only (never sent anywhere) so a
// reload can use it straight away instead of waiting on a fresh GPS read that
// phones are slow or unwilling to give with no tap behind it. Stale after 12h.
const FIX_KEY = 'kitabx.discoveryFix';
const FIX_MAX_AGE_MS = 12 * 60 * 60 * 1000;
// A fresh fix this close to the remembered one is the same place (GPS jitter),
// so it must not re-run the book search.
const SAME_PLACE_KM = 0.15;

function loadFix() {
  try {
    const f = JSON.parse(window.localStorage.getItem(FIX_KEY));
    if (f && Number.isFinite(f.lat) && Number.isFinite(f.lng) && Date.now() - f.at < FIX_MAX_AGE_MS) {
      return { lat: f.lat, lng: f.lng };
    }
  } catch {
    // Unreadable or blocked — treated as no remembered fix.
  }
  return null;
}

function saveFix(fix) {
  try {
    window.localStorage.setItem(FIX_KEY, JSON.stringify({ lat: fix.lat, lng: fix.lng, at: Date.now() }));
  } catch {
    // Storage blocked — a reload just has to read the GPS again.
  }
}

function clearFix() {
  try {
    window.localStorage.removeItem(FIX_KEY);
  } catch {
    // Nothing to clear.
  }
}

function distanceKm(a, b) {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function getPosition(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      options,
    );
  });
}

/** One GPS fix. The first try is the fast, low-accuracy network/WiFi fix — a
 * book search only needs the neighbourhood. A phone's first fix after the
 * browser opens can easily take longer than a few seconds (reported live: it
 * only worked on the 3rd-4th tap, by which time the OS had one cached), so it
 * gets a generous 12s, and if that times out or the device can't place itself
 * it tries once more with a real GPS lock and 20s. A denied permission (or no
 * location support) won't change on a second try, so that fails straight away. */
async function locate() {
  try {
    return await getPosition({ enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  } catch (err) {
    if (err?.code !== 2 && err?.code !== 3) throw err;
    return getPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
}

/** What went wrong, in words. Each browser error code (1 denied, 2 unavailable,
 * 3 timed out, 0 unsupported) gets its own message, so the cause is clear
 * without showing the member a number. */
function locateErrorMessage(err) {
  switch (err?.code) {
    case 1:
      return 'Location permission is blocked. Allow location for this site in your browser settings, then try again.';
    case 2:
      return "Your device couldn't work out where you are. Check that location is on, then try again.";
    case 3:
      return 'Finding your location took too long. Try again.';
    default:
      return "This browser can't share your location.";
  }
}

/**
 * Where Discover is centred: the member's `home` society (the default), or
 * their `current` GPS location while travelling.
 *
 * The choice is remembered, and so is the last GPS fix (on this device only,
 * 12h) — a reload shows "current" at once from that fix and re-reads the GPS
 * in the background, moving to the new position only if it really differs. A
 * phone often can't (or won't) give a fresh fix on a bare page load, so a
 * reload must not depend on one.
 *
 * With no recent fix to fall back on and a GPS read that fails, that visit
 * shows the home society (and says so) but the choice stays "current", so the
 * next reload or a tap on "Current location" tries again.
 *
 *   place    what Discover is actually centred on right now: 'current' only
 *            once a fix is in, otherwise 'home'
 *   origin   { lat, lng } while place is 'current', else null
 *   placeName  "Powai, Mumbai" for that fix once it's been looked up, else ''
 *   waiting  true while 'current' is the saved choice and its fix is still being read
 *   choose   (place) => Promise — rejects with a user-readable Error if GPS fails
 */
export function useDiscoveryPlace() {
  const showToast = useToast();
  // The remembered choice — not necessarily what's showing (see above).
  const [wanted, setWanted] = useState(loadPlace);
  // Start from the remembered fix, so a reload shows "current" immediately.
  const [origin, setOrigin] = useState(() => (loadPlace() === 'current' ? loadFix() : null));
  const [failed, setFailed] = useState(false);

  // On a load with "current" saved, read the GPS again — the member may have
  // moved. With a remembered fix already showing, a failed read is silent and
  // a successful one only replaces it if it's a different place.
  useEffect(() => {
    if (wanted !== 'current') return undefined;
    const hadFix = origin !== null;
    let cancelled = false;
    locate().then(
      (fix) => {
        if (cancelled) return;
        saveFix(fix);
        setFailed(false);
        setOrigin((prev) => (prev && distanceKm(prev, fix) < SAME_PLACE_KM ? prev : fix));
      },
      (err) => {
        if (cancelled || hadFix) return;
        setFailed(true);
        showToast(`${locateErrorMessage(err)} Showing your home society — pick Current location to try again.`, 6000);
      },
    );
    return () => { cancelled = true; };
    // Once, on load, for whatever was remembered. Choosing from the sheet does
    // its own GPS read in `choose`, so it must not trigger this one as well.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Name the fix so the header can say where "current location" is. Purely
  // cosmetic: if the lookup fails the header just keeps saying "Current location".
  // The name is stored with the point it was looked up for, so a name from an
  // earlier fix is never shown against a newer one while its lookup is pending.
  const [named, setNamed] = useState({ at: '', name: '' });
  useEffect(() => {
    if (!origin || !GEOCODING_API_KEY) return undefined;
    let cancelled = false;
    const at = `${origin.lat},${origin.lng}`;
    reverseGeocodePlace(GEOCODING_API_KEY, origin.lat, origin.lng)
      .then((name) => { if (!cancelled) setNamed({ at, name }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [origin]);
  const placeName = origin && named.at === `${origin.lat},${origin.lng}` ? named.name : '';

  const choose = useCallback(async (next) => {
    if (next === 'home') {
      savePlace('home');
      clearFix();
      setWanted('home');
      setOrigin(null);
      setFailed(false);
      return;
    }
    // Asked from the tap itself (not an effect) so the browser's permission
    // prompt is allowed to appear — Safari refuses it otherwise.
    let fix;
    try {
      fix = await locate();
    } catch (err) {
      throw new Error(locateErrorMessage(err));
    }
    savePlace('current');
    saveFix(fix);
    setOrigin(fix);
    setFailed(false);
    setWanted('current');
  }, []);

  return {
    place: origin ? 'current' : 'home',
    origin,
    placeName,
    waiting: wanted === 'current' && !origin && !failed,
    choose,
  };
}
