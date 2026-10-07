'use client';

import { SORT_OPTIONS } from './FilterSheet';

/** Pick one ordering; applies straight away. */
export default function SortSheet({ value, onSelect }) {
  return (
    <div className="reason-list">
      {SORT_OPTIONS.map((o) => (
        <label className="reason-item" key={o.key} onClick={() => onSelect(o.key)}>
          <input type="radio" name="sort" checked={value === o.key} readOnly />
          {o.label}
        </label>
      ))}
    </div>
  );
}
