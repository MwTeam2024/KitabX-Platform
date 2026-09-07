'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { loadGoogleMaps, reverseGeocode as reverseGeocodeRest, geocodeAddress } from '@/lib/googleMaps';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
// A separate, separately-restricted key (Geocoding API only) — see
// lib/googleMaps.js for why geocoding goes through plain REST calls with
// this key instead of `new google.maps.Geocoder()`, which would use the
// Maps-JS key above and get REQUEST_DENIED.
const GOOGLE_GEOCODING_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY;
// Roughly the middle of India — just something sane to open the map on
// before a real location (existing value, search, or geolocation) is known.
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const SEARCH_DEBOUNCE_MS = 700;

/**
 * A single "Address" field that IS the location picker — not a field plus a
 * separate always-on map. The map stays collapsed until the visitor taps
 * into the field; typing there (debounced) geocodes and moves the pin the
 * same as dragging the map would, and either path reverse-geocodes back
 * into this same field once the pin settles. One field, one source of
 * truth for the text, matching how Swiggy/Zomato/Google Maps' own "choose a
 * location" pickers work.
 *
 * The map itself is a center-fixed pin: the marker never moves, the
 * visitor pans the MAP under it — simpler and less fiddly on mobile than a
 * draggable marker.
 *
 * For a search result or "use my current location", the target lat/lng is
 * already known, so `moveTo()` reverse-geocodes it directly instead of
 * moving the map (via `panTo`'s animation) and waiting for the resulting
 * `idle` event — confirmed live that `idle` does not reliably fire after an
 * animated `panTo` (this is the one thing actually being waited on, so a
 * dropped event means the field just never updates). The map's `idle`
 * listener stays in place for the one case that has no other signal: the
 * visitor dragging the map by hand.
 */
export default function LocationMapPicker({ address, lat, lng, onChange, label = 'Address', placeholder = 'e.g. B-402, near XYZ mall' }) {
  // Not a hardcoded string — the "request a new society" popup renders a
  // SECOND LocationMapPicker on top of whichever one the surrounding form
  // already has (e.g. Profile Settings' own home-address field), and two
  // elements sharing one id is invalid HTML; confirmed live it made
  // `document.getElementById` (and any label's `htmlFor`) resolve to
  // whichever instance happened to come first in the DOM, not necessarily
  // the one being typed into.
  const inputId = useId();
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const addressRef = useRef(address);
  addressRef.current = address;
  const searchTimerRef = useRef(null);
  // Bumped by every new "move the pin" intent (a keystroke, a search
  // result, the map settling from a drag, geolocation) — an in-flight
  // async lookup only applies its result if this hasn't moved on since.
  const requestIdRef = useRef(0);
  // A pan target requested before the map finished loading (typed while
  // still collapsed) gets stashed here and applied once it's ready,
  // instead of moveTo() silently no-op'ing on a null map.
  const pendingMoveRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [locating, setLocating] = useState(false);

  // The map only actually mounts once expanded, so its own load only needs
  // to start then — not on every render before the visitor has even opened it.
  useEffect(() => {
    if (!expanded || status !== 'idle') return;
    if (!GOOGLE_MAPS_API_KEY) { setStatus('error'); return; }
    setStatus('loading');
    let cancelled = false;
    loadGoogleMaps(GOOGLE_MAPS_API_KEY).then((maps) => {
      if (cancelled || !mapDivRef.current) return;
      const hasInitial = lat != null && lng != null;
      const map = new maps.Map(mapDivRef.current, {
        center: hasInitial ? { lat, lng } : DEFAULT_CENTER,
        zoom: hasInitial ? 16 : 5,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
      mapRef.current = map;
      // Covers the visitor dragging the map by hand — a search result or
      // geolocation fix calls reverseGeocode() directly instead (see
      // moveTo below) rather than relying on this firing after a
      // programmatic move.
      map.addListener('idle', () => {
        const c = map.getCenter();
        reverseGeocode(c.lat(), c.lng());
      });
      if (pendingMoveRef.current) {
        // A search was already typed out while the map was still loading —
        // go straight there instead of settling on the map's own default
        // first-paint position.
        const { la, ln } = pendingMoveRef.current;
        map.setCenter({ lat: la, lng: ln });
        pendingMoveRef.current = null;
      } else if (!hasInitial && !addressRef.current?.trim()) {
        // The very first `idle` after a map is constructed with a static
        // center/zoom (nothing external to load) can fire before the
        // listener above even gets attached, on the same tick as
        // `new maps.Map()` returning — confirmed live (it never once fired
        // for the initial center). Geocoding that starting position
        // explicitly, once, covers that miss. Skipped entirely when there's
        // already an address (a saved one, or mid-search) — reverse-
        // geocoding the map's own default center would only overwrite it
        // with an unrelated result.
        const startCenter = map.getCenter();
        reverseGeocode(startCenter.lat(), startCenter.lng());
      }
      setStatus('ready');
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const reverseGeocode = async (la, ln) => {
    const myId = ++requestIdRef.current;
    if (!GOOGLE_GEOCODING_API_KEY) { onChangeRef.current({ lat: la, lng: ln, address: addressRef.current || '' }); return; }
    const formatted = await reverseGeocodeRest(GOOGLE_GEOCODING_API_KEY, la, ln).catch(() => '');
    if (myId !== requestIdRef.current) return; // a newer move started before this one resolved — drop it
    onChangeRef.current({ lat: la, lng: ln, address: formatted || addressRef.current || '' });
  };

  // The target lat/lng is already known here (a search result, a
  // geolocation fix) — reverse-geocode it directly rather than moving the
  // map and waiting for `idle` to notice, which doesn't reliably follow an
  // animated move. The map still visually re-centers, just as a plain,
  // immediate jump (setCenter) instead of panTo's animation.
  const moveTo = (la, ln) => {
    if (mapRef.current) {
      mapRef.current.setCenter({ lat: la, lng: ln });
    } else {
      pendingMoveRef.current = { la, ln };
    }
    reverseGeocode(la, ln);
  };

  // Typing moves the pin too (debounced), not just panning the map — the
  // field's own text is updated immediately on every keystroke regardless,
  // it's only the "go geocode this and move the pin" side that waits for a
  // pause, so the pin isn't chasing every half-typed word.
  const onAddressInput = (text) => {
    setExpanded(true);
    requestIdRef.current += 1; // invalidate any reverse-geocode already in flight from the old position
    onChangeRef.current({ lat, lng, address: text });
    clearTimeout(searchTimerRef.current);
    if (!text.trim() || !GOOGLE_GEOCODING_API_KEY) return;
    searchTimerRef.current = setTimeout(async () => {
      const loc = await geocodeAddress(GOOGLE_GEOCODING_API_KEY, text.trim()).catch(() => null);
      if (loc) moveTo(loc.lat, loc.lng);
    }, SEARCH_DEBOUNCE_MS);
  };

  const useCurrentLocation = () => {
    setExpanded(true);
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        moveTo(pos.coords.latitude, pos.coords.longitude);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="field">
      {label && <label htmlFor={inputId}>{label}</label>}
      <div style={{ display: 'flex', gap: 6 }}>
        <div className="input-wrap" style={{ flex: 1 }}>
          <span className="input-ic-badge"><Icon name="home" style={{ width: 14, height: 14 }} /></span>
          <input
            id={inputId}
            className="has-badge"
            placeholder={placeholder}
            value={address || ''}
            onChange={(e) => onAddressInput(e.target.value)}
            onFocus={() => setExpanded(true)}
          />
        </div>
        <button
          type="button"
          className="ghost-btn sm"
          onClick={useCurrentLocation}
          disabled={locating}
          title="Use my current location"
        >
          <Icon name="mapPin" style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {expanded && status === 'error' && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
          Map isn&apos;t available right now — you can still type the address above.
        </p>
      )}

      {expanded && status !== 'error' && (
        <>
          <div style={{ position: 'relative', height: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 8 }}>
            <div ref={mapDivRef} style={{ width: '100%', height: '100%', background: 'var(--surface-muted, #eee)' }} />
            {status === 'ready' && (
              <div
                style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)',
                  pointerEvents: 'none', fontSize: 32, lineHeight: 1, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.35))',
                }}
              >
                📍
              </div>
            )}
            {status === 'loading' && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                Loading map…
              </div>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
            Move the map so the pin sits on your building, or keep typing the address above.
          </p>
        </>
      )}
    </div>
  );
}
