'use client';

/**
 * Pill-shaped segmented control used by My Shelf, Exchange and the handover roles.
 * `tabs` = [{ key, label, count, danger }]
 */
export default function SegTabs({ tabs, active, onChange, style }) {
  return (
    <div className="segtabs" style={style}>
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
