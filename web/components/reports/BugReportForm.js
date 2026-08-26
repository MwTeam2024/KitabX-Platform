'use client';

import { useState } from 'react';

const SCREENS = ['Discover', 'My Shelf', 'Exchange', 'Chat', 'Other'];

/** "Report a technical bug" form — feeds the admin Reports table (§14). */
export default function BugReportForm({ onSubmit, onInvalid }) {
  const [description, setDescription] = useState('');
  const [screen, setScreen] = useState('');

  const submit = () => {
    if (!description.trim()) return onInvalid?.();
    onSubmit({ description: description.trim(), screen });
  };

  return (
    <>
      <div className="field">
        <label htmlFor="bug-desc">What happened?</label>
        <textarea
          id="bug-desc"
          placeholder="Describe the bug…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="bug-screen">Which screen?</label>
        <select id="bug-screen" value={screen} onChange={(e) => setScreen(e.target.value)}>
          <option value="">— Select screen —</option>
          {SCREENS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <button className="btn btn-primary" onClick={submit}>Submit report</button>
    </>
  );
}
