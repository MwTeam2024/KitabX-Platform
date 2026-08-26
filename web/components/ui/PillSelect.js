'use client';

/** Single-choice pill row — pickup date/slot/point selectors. */
export default function PillSelect({ options, value, onChange }) {
  return (
    <div className="pill-select">
      {options.map((opt) => (
        <button
          key={opt}
          className={value === opt ? 'on' : ''}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
        >
          {opt}
        </button>
      ))}
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
