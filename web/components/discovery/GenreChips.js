'use client';

import Icon from '@/components/ui/Icon';
import { GENRES } from '@/lib/mockData';

/** Genre filter row + sort and filter entry points. */
export default function GenreChips({ genre, onGenre, sortLabel, onSort, onFilters }) {
  return (
    <div className="chiprow">
      {['All', ...GENRES].map((g) => (
        <button
          key={g}
          className={`chip${genre === g ? ' on' : ''}`}
          onClick={() => onGenre(g)}
          aria-pressed={genre === g}
        >
          {g}
        </button>
      ))}
      <button className="chip" onClick={onSort}>
        <span>Sort: {sortLabel}</span>
        <Icon name="chevronDown" style={{ width: 11, height: 11, marginLeft: 3 }} />
      </button>
      <button className="chip circ" onClick={onFilters} aria-label="Filters">
        <Icon name="sliders" />
      </button>
    </div>
  );
}
