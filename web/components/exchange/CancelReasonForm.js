'use client';

import { useState } from 'react';

/**
 * PDF Module 8 step 9 — cancelling an already-accepted exchange requires a
 * reason (Task 61: from either party, only once accepted — a still-pending
 * request's cancel button skips this entirely). The two roles cancel for
 * different reasons in practice, and a generic shared list read oddly for
 * whichever side didn't match ("Book no longer available" makes no sense
 * coming from the requester) — so `role` (the exchange DTO's own `'giver'`/
 * `'receiver'`, see exchanges.service.js#_otherParty) picks which list shows.
 * Shared by PickupScheduler.js and ExchangeDetailView.js, the two screens
 * that can cancel a post-acceptance exchange.
 */
export const CANCEL_REASONS_BY_ROLE = {
  giver: [
    'Book no longer available',
    'Unable to contact the requester',
    "Timing issue — can't do the pickup",
    'Changed my mind',
  ],
  receiver: [
    'No longer need the book',
    'Found it elsewhere',
    'Unable to contact the owner',
    'Pickup location too far / inconvenient',
    "Timing issue — can't do the pickup",
    'Request made by mistake',
  ],
};

export default function CancelReasonForm({ role, onSubmit }) {
  const [reason, setReason] = useState(null);
  const reasons = CANCEL_REASONS_BY_ROLE[role] || CANCEL_REASONS_BY_ROLE.receiver;
  return (
    <>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-8px 0 14px' }}>
        Reason — any reserved credit is returned automatically.
      </div>
      <div className="reason-list">
        {reasons.map((r) => (
          <label className="reason-item" key={r}>
            <input type="radio" name="cancel-reason" checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <button className="btn btn-primary" disabled={!reason} onClick={() => onSubmit(reason)}>Cancel exchange</button>
    </>
  );
}
