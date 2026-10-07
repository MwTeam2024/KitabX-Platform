'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

/**
 * A dropdown that shows ten options at a time and scrolls for the rest — a
 * native <select> opens as tall as the screen allows, which with a few dozen
 * genres is one very long list. `wide` stretches the list to twice the field's
 * width (for a field that sits in half of a two-column row), growing toward
 * the row's middle from `align`'s side, so long names stay on one line.
 */
export default function ListSelect({ id, value, options, placeholder = 'Select', onChange, align = 'left', wide = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="list-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`list-select-btn${value ? '' : ' empty'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value || placeholder}</span>
        <Icon name="chevronDown" style={{ width: 14, height: 14, flexShrink: 0 }} />
      </button>
      {open && (
        <div className={`list-select-panel${wide ? ' wide' : ''}${align === 'right' ? ' right' : ''}`} role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o}
              role="option"
              aria-selected={o === value}
              ref={o === value ? selectedRef : undefined}
              className={`list-select-opt${o === value ? ' on' : ''}`}
              onClick={() => { onChange(o); setOpen(false); }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
