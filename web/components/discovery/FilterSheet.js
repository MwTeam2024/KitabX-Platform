'use client';

import { useState } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { useFacets } from '@/hooks/useFacets';
import CheckboxList from '@/components/ui/CheckboxList';
import { CONDITIONS } from '@/lib/mockData';

const CONDITION_LABELS = CONDITIONS.map((c) => c.label);

export const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'nearest', label: 'Nearest' },
  { key: 'recent', label: 'Recently added' },
];

const TITLES = { genre: 'Genre', language: 'Language' };

/**
 * Everything that narrows or orders Discover in one sheet: genre, language
 * and condition (pick any number of each), sort, and the radius stepper.
 * Genre and language lists can be long, so each shows only its most-used few
 * as chips with a "View all" that swaps the sheet to the full checklist
 * (the choices made so far are kept). Nothing applies until "Apply filters".
 */
export default function FilterSheet({ genre, language, condition, sort, onApply, onClose }) {
  const { radiusKm, adjustRadius } = useLocation();
  const facets = useFacets();
  const [pending, setPending] = useState({ genre, language, condition, sort: sort || 'newest' });
  const [viewAll, setViewAll] = useState(null); // 'genre' | 'language' | null

  const toggle = (key, value) =>
    setPending((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((x) => x !== value) : [...s[key], value],
    }));

  if (viewAll) {
    const options = viewAll === 'genre' ? facets.genres : facets.languages;
    return (
      <>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '-6px 0 8px' }}>
          {TITLES[viewAll]}{pending[viewAll].length ? ` · ${pending[viewAll].length} selected` : ''}
        </div>
        <CheckboxList options={options} selected={pending[viewAll]} onToggle={(v) => toggle(viewAll, v)} />
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setViewAll(null)}>
          Done
        </button>
      </>
    );
  }

  // The few most-used options, plus anything already chosen so a selection
  // made in "View all" never disappears from the chips.
  const chipsFor = (key, popular) => [...new Set([...popular, ...pending[key]])];

  const group = (label, key, options, withViewAll) => (
    <div className="field">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <label>{label}</label>
        {withViewAll && (
          <button type="button" className="link-green" style={{ fontSize: 12, marginBottom: 6 }} onClick={() => setViewAll(key)}>
            View all
          </button>
        )}
      </div>
      <div className="chip-wrap">
        {options.map((o) => (
          <button
            key={o}
            className={`chip${pending[key].includes(o) ? ' on' : ''}`}
            onClick={() => toggle(key, o)}
            aria-pressed={pending[key].includes(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {group('Genre', 'genre', chipsFor('genre', facets.popularGenres), true)}
      {group('Language', 'language', chipsFor('language', facets.popularLanguages), true)}
      {group('Condition', 'condition', CONDITION_LABELS, false)}

      <div className="field">
        <label>Sort by</label>
        <div className="chip-wrap">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              className={`chip${pending.sort === o.key ? ' on' : ''}`}
              onClick={() => setPending((s) => ({ ...s, sort: o.key }))}
              aria-pressed={pending.sort === o.key}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filt-group">
        <span className="filt-group-h">Discovery radius</span>
        <div className="stepper">
          <button className="step-circ" onClick={() => adjustRadius(-1)} aria-label="Decrease radius">−</button>
          <span className="step-val">{radiusKm.toFixed(1)} km</span>
          <button className="step-circ" onClick={() => adjustRadius(1)} aria-label="Increase radius">+</button>
        </div>
      </div>

      <button
        className="link-green"
        style={{ marginBottom: 12 }}
        onClick={() => setPending({ genre: [], language: [], condition: [], sort: 'newest' })}
      >
        Clear all
      </button>
      <button
        className="btn btn-primary"
        onClick={() => {
          onApply?.(pending);
          onClose?.();
        }}
      >
        Apply filters
      </button>
    </>
  );
}
