'use client';

import { useState } from 'react';

/**
 * PDF Module 8 step 9 — cancelling an already-accepted exchange offers a
 * reason (Task 61: from either party, only once accepted — a still-pending
 * request's cancel button skips this entirely). Optional, not required —
 * none is pre-selected, and submitting with none picked cancels with no
 * reason. Shared by PickupScheduler.js and ExchangeDetailView.js, the two
 * screens that can cancel a post-acceptance exchange.
 */
export const CANCEL_REASONS = [
  'Timing issue',
  'Book no longer available',
  'Request made by mistake',
  'Unable to contact the other user',
];

export default function CancelReasonForm({ onSubmit }) {
  const [reason, setReason] = useState(null);
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-8px 0 14px' }}>
        Reason (optional) — any reserved credit is returned automatically.
      </div>
      <div className="reason-list">
        {CANCEL_REASONS.map((r) => (
          <label className="reason-item" key={r}>
            <input type="radio" name="cancel-reason" checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => onSubmit(reason)}>Cancel exchange</button>
    </>
  );
}
