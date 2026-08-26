'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * `false` during SSR and the first client render, `true` afterwards.
 * Use it to gate values that only exist in the browser (today's date, media
 * queries) so the server and client markup can never disagree.
 */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function subscribeToConnection(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** Live online/offline flag for the weak-network handling §17 asks for. */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true, // assume online while rendering on the server
  );
}
