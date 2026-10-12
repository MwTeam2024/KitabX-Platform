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

/** One GPS fix. Low accuracy on purpose: a book search only needs the
 * neighbourhood, and the fast network/WiFi fix beats waiting on a GPS lock. */
function locate() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 0 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  });
}

function locateErrorMessage(err) {
  // GeolocationPositionError.PERMISSION_DENIED
  if (err?.code === 1) {
    return 'Location permission is blocked. Allow location for this site in your browser settings, then try again.';
  }
  return "Couldn't get your location. Check that location is on and try again.";
}

/**
 * Where Discover is centred: the member's `home` society (the default), or
 * their `current` GPS location while travelling. Only the choice is
 * remembered — never the coordinates — and "current" re-reads the GPS on each
 * visit, since someone who chose it yesterday may be somewhere else today.
 *
 *   place    'home' | 'current'
 *   origin   { lat, lng } while place is 'current' and a fix is in, else null
 *   placeName  "Powai, Mumbai" for that fix once it's been looked up, else ''
 *   waiting  true while 'current' is chosen but the fix hasn't arrived yet
 *   choose   (place) => Promise — rejects with a user-readable Error if GPS fails
 */
export function useDiscoveryPlace() {
  const showToast = useToast();
  const [place, setPlace] = useState(loadPlace);
  const [origin, setOrigin] = useState(null);

  // A saved "current" has no coordinates yet on a fresh load — fetch them, and
  // drop back to the home society (saying so) if that can't be done.
  useEffect(() => {
    if (place !== 'current' || origin) return undefined;
    let cancelled = false;
    locate().then(
      (fix) => { if (!cancelled) setOrigin(fix); },
      (err) => {
        if (cancelled) return;
        savePlace('home');
        setPlace('home');
        showToast(`${locateErrorMessage(err)} Showing your home society instead.`, 4000);
      },
    );
    return () => { cancelled = true; };
    // `origin` is deliberately not a dependency: this only fills it in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

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
      setPlace('home');
      setOrigin(null);
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
    setPlace('current');
  }, []);

  return { place, origin, placeName, waiting: place === 'current' && !origin, choose };
}
