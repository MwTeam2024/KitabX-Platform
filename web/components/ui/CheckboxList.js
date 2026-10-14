'use client';

/** Checkbox list that shows eight rows at a time and scrolls for the rest (see .check-list). */
export default function CheckboxList({ options, selected, onToggle }) {
  return (
    <div className="check-list">
      {options.map((o) => (
        <label className="check-row" key={o}>
          <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}
