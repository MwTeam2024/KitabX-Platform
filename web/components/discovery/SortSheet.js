'use client';

import { useLocation } from '@/hooks/useLocation';

export const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'nearest', label: 'Nearest' },
  { key: 'recent', label: 'Recently added' },
];

/** Newest / nearest / recently-added ordering required by §8. */
export default function SortSheet({ value, onSelect }) {
  const { radiusKm } = useLocation();

  return (
    <div className="reason-list">
      {SORT_OPTIONS.map((o) => (
        <label className="reason-item" key={o.key} onClick={() => onSelect(o.key)}>
          <input type="radio" name="sort" checked={value === o.key} readOnly />
          {o.key === 'newest' ? 'Newest first' : o.key === 'nearest' ? 'Nearest first' : 'Recently added'}
          {o.key === 'nearest' && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
              within {radiusKm.toFixed(1)} km
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
