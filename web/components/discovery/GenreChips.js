'use client';

import Icon from '@/components/ui/Icon';
import { GENRES } from '@/lib/mockData';

/** Genre filter row + the filter entry point (sort and the rest live in the filter sheet). */
export default function GenreChips({ genre, onGenre, onFilters, filterCount = 0 }) {
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
      <button
        className={`chip circ${filterCount ? ' active' : ''}`}
        onClick={onFilters}
        aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'}
      >
        <Icon name="sliders" />
        {filterCount > 0 && <span className="hdr-count">{filterCount}</span>}
      </button>
    </div>
  );
}
