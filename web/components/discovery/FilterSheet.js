'use client';

import { useState } from 'react';
import { useLocation } from '@/hooks/useLocation';
import { GENRES, LANGUAGES, CONDITIONS } from '@/lib/mockData';

const CONDITION_LABELS = CONDITIONS.map((c) => c.label);

/**
 * Single-select genre/language/condition filters plus the radius stepper
 * (§8). Task 67: this used to keep its own disconnected local state and a
 * made-up `resultCount` estimate that never reflected a real query — the
 * parent never even read the selections it emitted, so nothing here ever
 * actually filtered anything. Now controlled by the parent's real
 * genre/language/condition state (the same state `searchBooks` uses),
 * single-select per group since that's what the backend filter — and the
 * genre chips already on the page — actually support, and the condition
 * options match real stored values (the old list included "New"/"Fair",
 * neither of which any listing has ever actually been saved as).
 */
export default function FilterSheet({ genre, language, condition, onApply, onClose }) {
  const { radiusKm, adjustRadius } = useLocation();
  const [pending, setPending] = useState({
    genre: genre && genre !== 'All' ? genre : null,
    language: language || null,
    condition: condition || null,
  });

  const pick = (group, value) =>
    setPending((s) => ({ ...s, [group]: s[group] === value ? null : value }));

  const group = (key, options) => (
    <div className="chiprow" style={{ margin: 0 }}>
      {options.map((o) => (
        <button
          key={o}
          className={`chip${pending[key] === o ? ' on' : ''}`}
          onClick={() => pick(key, o)}
          aria-pressed={pending[key] === o}
        >
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="field"><label>Genre</label>{group('genre', GENRES)}</div>
      <div className="field"><label>Language</label>{group('language', LANGUAGES)}</div>
      <div className="field"><label>Condition</label>{group('condition', CONDITION_LABELS)}</div>

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
        onClick={() => setPending({ genre: null, language: null, condition: null })}
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
