'use client';

import { useRouter } from 'next/navigation';
import Icon from './Icon';
import BrandLogo from '@/components/layout/BrandLogo';

// Captured once, the moment this module first loads in the browser tab —
// the history length at that instant is "how many entries existed before
// this app session started" (a fresh load, refresh, or direct/shared
// link). Every `router.push` during the session grows `history.length`
// further past that baseline, so comparing against it tells us whether
// there's real in-app navigation to pop back through right now, or
// whether we're sitting on the very first screen this tab ever loaded —
// where `router.back()` would leave the app (or do nothing) instead of
// going anywhere useful.
const baseHistoryLength = typeof window !== 'undefined' ? window.history.length : 0;

/**
 * The curved cream header at the top of every screen.
 * `variant="main"` = tall home-style header (logo + actions + children),
 * `variant="sub"`  = short back-button header with a title.
 */
export default function ScreenHeader({
  title,
  subtitle,
  back,
  backHref,
  right,
  children,
  className = '',
  style,
}) {
  const router = useRouter();

  const goBack = () => {
    // Prefer real history navigation — it retraces exactly the screens the
    // user actually visited (however many times they tap back), instead of
    // always jumping to one fixed `backHref` and pushing a *new* history
    // entry each time, which left the tab's real back/forward stack out of
    // sync with what the button visibly did (the app's own back button and
    // the device's back gesture would then disagree, bouncing between just
    // two screens instead of walking all the way back).
    const canGoBack = typeof window !== 'undefined' && window.history.length > baseHistoryLength;
    if (canGoBack) router.back();
    else if (backHref) router.push(backHref);
    else router.back();
  };

  return (
    <header className={`hdr ${className}`} style={style}>
      <div className="hdr-row">
        <div className="flex items-center gap-2.5 min-w-0">
          {back && (
            <button className="circle-btn" onClick={goBack} aria-label="Go back" style={{ flexShrink: 0 }}>
              <Icon name="arrowLeft" />
            </button>
          )}
          {title ? (
            <div className="min-w-0">
              <div className="hdr-title" style={{ fontSize: 17 }}>{title}</div>
              {subtitle && <div className="hdr-sub">{subtitle}</div>}
            </div>
          ) : (
            <BrandLogo />
          )}
        </div>
        {right}
      </div>
      {children}
    </header>
  );
}

/** Step counter + progress bar shown across the add-book wizard. */
export function StepProgress({ label, percent }) {
  return (
    <>
      <div className="step-label">{label}</div>
      <div className="step-bar"><i style={{ width: `${percent}%` }} /></div>
    </>
  );
}
