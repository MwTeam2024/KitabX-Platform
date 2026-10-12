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
 * their `current` GPS location while travelling. Only the choice is
 * remembered — never the coordinates — and "current" re-reads the GPS on each
 * visit, since someone who chose it yesterday may be somewhere else today.
 *
 * The remembered choice is the member's, so a reload that can't get a fix
 * (flaky GPS, no signal) must not overwrite it: that visit shows the home
 * society (and says so), the choice stays "current", and the next reload or a
 * tap on "Current location" tries again.
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
  const [origin, setOrigin] = useState(null);
  const [failed, setFailed] = useState(false);

  // A saved "current" has no coordinates yet on a fresh load — fetch them.
  useEffect(() => {
    if (wanted !== 'current' || origin) return undefined;
    let cancelled = false;
    locate().then(
      (fix) => { if (!cancelled) { setOrigin(fix); setFailed(false); } },
      (err) => {
        if (cancelled) return;
        setFailed(true);
        showToast(`${locateErrorMessage(err)} Showing your home society — pick Current location to try again.`, 6000);
      },
    );
    return () => { cancelled = true; };
    // `origin` is deliberately not a dependency: this only fills it in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

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
