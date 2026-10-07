'use client';

import Icon from '@/components/ui/Icon';

const FACETS = [
  { key: 'genre', label: 'Genre' },
  { key: 'language', label: 'Language' },
  { key: 'condition', label: 'Condition' },
];

/**
 * The Discover chip row: "All" (clears Genre/Language/Condition), one chip per
 * filter that opens its own pick-any list, and "Sort by". The full sheet
 * (all of these plus radius) opens from the filter icon in the search bar.
 */
export default function FilterChips({ selected, sortActive, onClearAll, onOpenFacet, onOpenSort }) {
  const none = FACETS.every((f) => !selected[f.key].length);

  return (
    <div className="chiprow">
      <button className={`chip${none ? ' on' : ''}`} onClick={onClearAll} aria-pressed={none}>
        All
      </button>
      {FACETS.map((f) => {
        const n = selected[f.key].length;
        return (
          <button key={f.key} className={`chip${n ? ' on' : ''}`} onClick={() => onOpenFacet(f.key)}>
            <span>{f.label}{n ? ` · ${n}` : ''}</span>
            <Icon name="chevronDown" style={{ width: 11, height: 11, marginLeft: 3 }} />
          </button>
        );
      })}
      <button className={`chip${sortActive ? ' on' : ''}`} onClick={onOpenSort}>
        <span>Sort by</span>
        <Icon name="chevronDown" style={{ width: 11, height: 11, marginLeft: 3 }} />
      </button>
    </div>
  );
}
