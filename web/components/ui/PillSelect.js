'use client';

import { useState } from 'react';

/**
 * Single-choice pill row — pickup date/slot/point selectors.
 *
 * `allowOther` appends an "Others" pill that swaps in a free-text (or, with
 * `otherType="date"`, a native date) input for any value outside the preset
 * list. The raw input is kept in local state so a date input can render
 * correctly (native date inputs need `YYYY-MM-DD`) while `onChange` receives
 * whatever `formatOther` turns it into (or the raw value, with no `formatOther`).
 */
export default function PillSelect({
  options,
  value,
  onChange,
  allowOther = false,
  otherType = 'text',
  otherPlaceholder = 'Type your own',
  otherMin,
  formatOther,
}) {
  const isCustomValue = allowOther && !!value && !options.includes(value);
  const [customMode, setCustomMode] = useState(isCustomValue);
  const [rawOther, setRawOther] = useState('');

  const showCustom = allowOther && (customMode || isCustomValue);

  const handleOtherChange = (raw) => {
    setRawOther(raw);
    onChange(formatOther ? formatOther(raw) : raw);
  };

  return (
    <div>
      <div className="pill-select">
        {options.map((opt) => (
          <button
            key={opt}
            className={!showCustom && value === opt ? 'on' : ''}
            onClick={() => { setCustomMode(false); onChange(opt); }}
            aria-pressed={!showCustom && value === opt}
          >
            {opt}
          </button>
        ))}
        {allowOther && (
          <button
            className={showCustom ? 'on' : ''}
            onClick={() => { setCustomMode(true); onChange(''); }}
            aria-pressed={showCustom}
          >
            Others
          </button>
        )}
      </div>
      {showCustom && (
        <input
          type={otherType}
          placeholder={otherPlaceholder}
          min={otherMin}
          value={otherType === 'date' ? rawOther : value}
          onChange={(e) => handleOtherChange(e.target.value)}
          style={{ marginTop: 8 }}
        />
      )}
    </div>
  );
}

/** Four-up condition grid with emoji, used in the add-book form. */
export function ConditionGrid({ options, value, onChange }) {
  return (
    <div className="cond-grid">
      {options.map((opt) => (
        <button
          key={opt.label}
          className={value === opt.label ? 'on' : ''}
          onClick={() => onChange(opt.label)}
          aria-pressed={value === opt.label}
        >
          <span className="em">{opt.em}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
