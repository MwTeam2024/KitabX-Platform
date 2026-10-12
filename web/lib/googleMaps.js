'use client';

const SCRIPT_ID = 'google-maps-script';
let scriptPromise = null;

/** Loads the Google Maps JS API once, sharing the same promise across every
 * LocationMapPicker mounted on a page — a second `<script>` tag for the
 * same API throws.
 *
 * Deliberately the CLASSIC (non-`loading=async`) script load, not Google's
 * newer recommended `importLibrary()` pattern — that one only works
 * reliably with Google's own exact inline bootstrap loader snippet, which
 * sets up `google.maps.importLibrary` as a shim *before* the real script
 * even starts downloading. Creating the `<script>` tag ourselves and
 * calling `importLibrary` from its `onload` races Google's own internal
 * setup of that shim: confirmed live — `onload` fired but
 * `google.maps.importLibrary` was "not a function" at that exact instant,
 * only becoming callable a moment later. The classic load has no such
 * race: every class (`Map`, etc.) is already on `google.maps` by the time
 * `onload` fires. */
export function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps is only available in the browser'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google.maps);
      script.onerror = () => reject(new Error('Could not load Google Maps'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Deliberately a plain REST call, not `new google.maps.Geocoder()` — that
 * class makes its requests under the SAME key the Maps JS script was loaded
 * with, but this project's Maps-JS key and Geocoding key are two separate
 * keys, each restricted to only its own API. Calling the REST endpoint
 * directly lets each half of the flow use the key that's actually
 * authorized for it. */
export async function reverseGeocode(apiKey, lat, lng) {
  const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.status === 'OK' && data.results[0] ? data.results[0].formatted_address : '';
}

/** A short, human place name for a point — "Powai, Mumbai" — rather than the
 * full street address `reverseGeocode` returns. Neighbourhood + city, or just
 * the city when there's no neighbourhood; '' when Google can't name it. */
export async function reverseGeocodePlace(apiKey, lat, lng) {
  const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK') return '';
  const find = (...types) => {
    for (const result of data.results) {
      const hit = result.address_components?.find((c) => types.some((t) => c.types.includes(t)));
      if (hit) return hit.long_name;
    }
    return '';
  };
  const area = find('sublocality_level_1', 'sublocality', 'neighborhood');
  const city = find('locality', 'administrative_area_level_2');
  return [area, city].filter((p, i, all) => p && all.indexOf(p) === i).join(', ');
}

export async function geocodeAddress(apiKey, address) {
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results[0]) return null;
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}
