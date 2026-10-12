'use client';

import { useState } from 'react';

/**
 * Pick where Discover looks: the member's own society, or wherever they are
 * right now. "Current location" asks for GPS, so the row shows a short wait
 * and any failure stays in the sheet (with the reason) instead of vanishing.
 */
export default function PlaceSheet({ value, societyName, onChoose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (next) => {
    if (busy) return;
    setError('');
    // Picking "Current location" again re-reads the GPS (the member may have
    // moved since); only "Home society" is a no-op when already chosen.
    if (next === 'home' && value === 'home') { onDone(); return; }
    setBusy(true);
    try {
      await onChoose(next);
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const options = [
    { key: 'home', title: 'Home society', sub: societyName || 'Your society' },
    { key: 'current', title: 'Current location', sub: busy ? 'Finding where you are…' : 'Books near where you are right now' },
  ];

  return (
    <>
      <div className="reason-list">
        {options.map((o) => (
          <label className="reason-item" key={o.key} onClick={(e) => { e.preventDefault(); pick(o.key); }}>
            <input type="radio" name="place" checked={value === o.key} readOnly />
            <span>
              <b style={{ display: 'block' }}>{o.title}</b>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.sub}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--sindoor)', margin: '0 0 12px' }}>{error}</p>
      )}
    </>
  );
}
