'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';

/** Four society-level counters below the discovery header. */
export default function StatTiles({ tiles }) {
  const router = useRouter();

  return (
    <div className="stat-row">
      {tiles.map((t) => (
        <button
          key={t.label}
          className="stat-tile"
          onClick={t.href ? () => router.push(t.href) : undefined}
          style={{ cursor: t.href ? 'pointer' : 'default' }}
          disabled={!t.href}
        >
          <div className="stat-ic"><Icon name={t.icon} /></div>
          <div className="stat-num">{t.value}</div>
          <div className="stat-lbl">{t.label}</div>
        </button>
      ))}
    </div>
  );
}
