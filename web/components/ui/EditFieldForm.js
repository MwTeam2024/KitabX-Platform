'use client';

import { useState } from 'react';

/** Single-field edit sheet used across Profile Settings. */
export default function EditFieldForm({ label, initialValue = '', onSave }) {
  const [value, setValue] = useState(initialValue);

  return (
    <>
      <div className="field">
        <label htmlFor="edit-field">{label}</label>
        <input id="edit-field" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={() => onSave(value)}>Save</button>
    </>
  );
}
