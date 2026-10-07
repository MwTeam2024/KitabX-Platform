'use client';

/** Checkbox list that shows ten rows at a time and scrolls for the rest. */
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
