'use client';

import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { setRadiusKm } from './slices/locationSlice';

const RADIUS_KEY = 'kitabx.radiusKm';

/** Radius lives in Redux only, so a refresh reset it to the 0.5 km default —
 * restore the last chosen value on mount and keep saving it as it changes. */
function useRadiusPersistence() {
  useEffect(() => {
    try {
      const saved = parseFloat(window.localStorage.getItem(RADIUS_KEY));
      if (Number.isFinite(saved)) store.dispatch(setRadiusKm(saved));
    } catch {
      // Storage blocked (private mode etc.) — radius just won't persist.
    }
    let last = store.getState().location.radiusKm;
    return store.subscribe(() => {
      const next = store.getState().location.radiusKm;
      if (next === last) return;
      last = next;
      try {
        window.localStorage.setItem(RADIUS_KEY, String(next));
      } catch {
        // Same as above.
      }
    });
  }, []);
}

export default function StoreProvider({ children }) {
  useRadiusPersistence();
  return <Provider store={store}>{children}</Provider>;
}
