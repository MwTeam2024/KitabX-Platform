'use client';

import Icon from '@/components/ui/Icon';

/** Interactive 5-star row used by the rating screen (§13). */
export default function StarRating({ value, onChange, max = 5 }) {
  return (
    <div className="stars">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Icon name="star" />
        </button>
      ))}
    </div>
  );
}

/** Read-only star display (book detail, trust profile). */
export function StarDisplay({ value = 5, size = 13 }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon
          key={i}
          name="star"
          style={{
            width: size,
            height: size,
            color: i < Math.round(value) ? 'var(--gold)' : 'var(--line)',
            flexShrink: 0,
          }}
        />
      ))}
    </>
  );
}
