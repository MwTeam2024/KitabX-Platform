/**
 * Maps a backend exchange `stage` onto the timeline and the "next required
 * action" the source plan asks for on every exchange (§11, Module 10).
 * Purely presentational — the authoritative status transition happens in NestJS.
 */

import { EXCHANGE_STAGES, EXCHANGE_TERMINAL_STAGES } from './constants';

export const STAGE_LABELS = {
  requested: 'Requested',
  accepted: 'Accepted',
  'pickup-proposed': 'Pickup proposed',
  'pickup-confirmed': 'Pickup scheduled',
  'handover-verified': 'Handover verified',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
  disputed: 'Disputed',
};

export function isTerminal(stage) {
  return EXCHANGE_TERMINAL_STAGES.includes(stage);
}

function rank(stage) {
  const i = EXCHANGE_STAGES.indexOf(stage);
  return i === -1 ? 0 : i;
}

/** True once `viewerId` has proposed the pending pickup — they're the one waiting, not the one who owes a response. */
function amProposer(exchange, viewerId) {
  return !!viewerId && exchange?.pickup?.proposedById === viewerId;
}

/** Five timeline rows with done/current state, matching the prototype's `.tl`. */
export function buildTimeline(exchange, viewerId) {
  const stage = exchange?.stage || 'requested';
  const r = rank(stage);
  const terminal = isTerminal(stage);

  const step = (label, atLeast, currentAt, sub) => ({
    label,
    sub,
    done: !terminal && r >= atLeast,
    current: !terminal && currentAt.includes(stage),
  });

  return [
    step('Requested', 0, [], exchange?.requestedAt || 'Today, 9:14 AM'),
    step('Accepted', 1, ['requested'], r >= 1 ? 'Today, 9:20 AM' : 'Waiting on the owner'),
    step('Pickup scheduling', 3, ['accepted', 'pickup-proposed'],
      stage === 'pickup-proposed'
        ? (amProposer(exchange, viewerId) ? `Waiting for ${firstName(exchange)} to confirm` : 'Your turn to respond')
        : r >= 3 ? 'Confirmed' : r >= 1 ? 'Waiting on you' : 'Not started'),
    step('Handover verified', 4, ['pickup-confirmed'], r >= 4 ? 'Verified' : r >= 3 ? 'Waiting on you' : 'Not started'),
    step('Completed & rated', 5, ['handover-verified'], r >= 5 ? 'Done' : 'Not started'),
  ];
}

/** The single call-to-action for the current stage — viewer-relative for pickup-proposed. */
export function nextAction(exchange, viewerId) {
  const stage = exchange?.stage || 'requested';
  if (isTerminal(stage)) {
    return { note: `This exchange was ${STAGE_LABELS[stage].toLowerCase()}.`, label: null };
  }
  switch (stage) {
    case 'requested':
      return exchange.role === 'receiver'
        ? { note: 'Waiting for the owner to accept your request.', label: null }
        : { note: 'Accept or decline this request to continue.', label: null };
    case 'accepted':
      return { note: 'Propose a pickup time & place.', label: 'Schedule pickup', href: 'pickup' };
    case 'pickup-proposed':
      return amProposer(exchange, viewerId)
        ? { note: `Waiting for ${firstName(exchange)} to confirm the schedule.`, label: 'View schedule', href: 'pickup' }
        : { note: `${firstName(exchange)} suggested a pickup time — confirm it or suggest another.`, label: 'Review schedule', href: 'pickup' };
    case 'pickup-confirmed':
      return { note: 'Verify the handover once you meet.', label: 'Verify handover', href: 'handover' };
    case 'handover-verified':
      return { note: 'Rate this exchange to finish up.', label: 'Rate this exchange', href: 'rate' };
    case 'completed':
      return exchange.rated
        ? { note: 'This exchange is complete.', label: null }
        : { note: 'Rate this exchange to finish up.', label: 'Rate this exchange', href: 'rate' };
    default:
      return { note: 'This exchange is complete.', label: null };
  }
}

export function firstName(exchange) {
  return (exchange?.name || '').split(' ')[0] || 'them';
}
