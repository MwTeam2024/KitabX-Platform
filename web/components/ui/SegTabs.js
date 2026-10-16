'use client';

import { useEffect, useRef } from 'react';

/**
 * Pill-shaped segmented control used by My Shelf, Exchange and the handover roles.
 * `tabs` = [{ key, label, count, danger }]
 */
export default function SegTabs({ tabs, active, onChange, style }) {
  const barRef = useRef(null);

  // On a very narrow screen the tabs still scroll sideways — when the chosen tab
  // sits partly outside, slide the bar (only the bar, never the page) so it shows.
  useEffect(() => {
    const bar = barRef.current;
    const on = bar?.querySelector('.segtab.on');
    if (!bar || !on) return;
    const left = on.offsetLeft - 4;
    const right = on.offsetLeft + on.offsetWidth + 4;
    if (left < bar.scrollLeft) bar.scrollLeft = left;
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth;
  }, [active]);

  return (
    <div className="segtabs" style={style} ref={barRef}>
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`segtab${active === t.key ? ' on' : ''}`}
          onClick={() => onChange(t.key)}
          aria-pressed={active === t.key}
        >
          {t.label}
          {t.count != null && <span className={`cnt${t.danger ? ' red' : ''}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
