'use client';

import { useState } from 'react';
import CheckboxList from '@/components/ui/CheckboxList';

/** One filter (Genre / Language / Condition) as a pick-any list, opened from its chip. */
export default function FacetSheet({ options, selected, onApply, onClose }) {
  const [pending, setPending] = useState(selected);
  const toggle = (o) => setPending((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));

  return (
    <>
      <CheckboxList options={options} selected={pending} onToggle={toggle} />
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setPending([])} disabled={!pending.length}>
          Clear
        </button>
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { onApply(pending); onClose?.(); }}>
          {pending.length ? `Apply (${pending.length})` : 'Apply'}
        </button>
      </div>
    </>
  );
}
