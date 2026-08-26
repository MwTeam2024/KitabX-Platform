import { useEffect, useRef } from "react";

/**
 * Runs `callback` every `delayMs` while `enabled` is true (§16 — live data
 * without a manual page refresh). A tick is skipped, not the interval torn
 * down, when the tab is hidden or the device is offline, so a backgrounded
 * screen doesn't keep hammering the API or draining battery.
 */
export function useInterval(callback, delayMs, { enabled = true } = {}) {
  const savedCallback = useRef(callback);

  // Runs after every render (no dependency array) so the interval below
  // always calls the latest closure without needing to restart on every
  // callback identity change.
  useEffect(() => {
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (!enabled || !delayMs) return undefined;
    const tick = () => {
      if (document.hidden || !navigator.onLine) return;
      savedCallback.current();
    };
    const id = setInterval(tick, delayMs);
    return () => clearInterval(id);
  }, [delayMs, enabled]);
}
