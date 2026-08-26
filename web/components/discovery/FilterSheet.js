'use client';

import { useState } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { GENRES, LANGUAGES } from '@/lib/mockData';

const CONDITION_FILTERS = ['New', 'Like New', 'Good', 'Fair'];

/**
 * Multi-select genre/language/condition filters plus the radius stepper (§8).
 * The real filtering is a backend query; this only collects the criteria.
 */
export default function FilterSheet({ totalBooks = 24, onApply, onClose }) {
  const { radiusKm, adjustRadius } = useLocation();
  const [selected, setSelected] = useState({ genre: [], lang: [], cond: [] });

  const toggle = (group, value) =>
    setSelected((s) => ({
      ...s,
      [group]: s[group].includes(value) ? s[group].filter((v) => v !== value) : [...s[group], value],
    }));

  const activeCount = selected.genre.length + selected.lang.length + selected.cond.length;
  const radiusSteps = Math.round((radiusKm - 0.5) / 0.5);
  const resultCount = Math.max(2, totalBooks - activeCount * 4 - radiusSteps);

  const group = (key, options) => (
    <div className="chiprow" style={{ margin: 0 }}>
      {options.map((o) => (
        <button
          key={o}
          className={`chip${selected[key].includes(o) ? ' on' : ''}`}
          onClick={() => toggle(key, o)}
          aria-pressed={selected[key].includes(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="field"><label>Genre</label>{group('genre', GENRES)}</div>
      <div className="field"><label>Language</label>{group('lang', [...LANGUAGES, 'Marathi'])}</div>
      <div className="field"><label>Condition</label>{group('cond', CONDITION_FILTERS)}</div>

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
        onClick={() => setSelected({ genre: [], lang: [], cond: [] })}
      >
        Clear all
      </button>
      <button
        className="btn btn-primary"
        onClick={() => {
          onApply?.({ ...selected, resultCount });
          onClose?.();
        }}
      >
        Show <span>{resultCount}</span> books
      </button>
    </>
  );
}
