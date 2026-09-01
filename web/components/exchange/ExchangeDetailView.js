'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NoteBox from '@/components/ui/NoteBox';
import EmptyState from '@/components/ui/EmptyState';
import ExchangeTimeline from './ExchangeTimeline';
import ExchangePartnerCard from './ExchangePartnerCard';
import CancelReasonForm from './CancelReasonForm';
import { useAppData } from '@/contexts/AppDataContext';
import { useAppSheets } from '@/hooks/useAppSheets';
import { useSheet } from '@/components/ui/SheetProvider';
import { useAuth } from '@/hooks/useAuth';
import { useInterval } from '@/hooks/useInterval';
import { useToast } from '@/components/ui/ToastProvider';
import { buildTimeline, isTerminal, nextAction } from '@/lib/exchange';

export default function ExchangeDetailView({ exchangeId }) {
  const router = useRouter();
  const showToast = useToast();
  const { getExchange, ensureExchange, refreshExchangeDetail, cancelExchange } = useAppData();
  const { reportUser } = useAppSheets();
  const { openSheet, closeSheet } = useSheet();
  const { user } = useAuth();

  const exchange = getExchange(exchangeId);

  // Same fix as PickupScheduler.js: distinguishes "haven't resolved this id
  // yet" from "resolved and it's genuinely gone", so a brief fetch-in-flight
  // window never renders the hard "no longer available" empty state.
  const [checked, setChecked] = useState(!!exchange);
  useEffect(() => {
    if (exchange) { setChecked(true); return; }
    let alive = true;
    setChecked(false);
    ensureExchange(exchangeId).then(() => { if (alive) setChecked(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeId, exchange]);

  // §16/§35: same reasoning as PickupScheduler.js — the other party's action
  // already pushes a near-instant update via Socket.IO (see AppDataContext),
  // so this is just the safety net for a dropped connection now, not the
  // primary delivery path. Still stops once the exchange reaches a closed/
  // terminal state.
  const closedForPolling = exchange && (isTerminal(exchange.stage) || exchange.stage === 'completed');
  useInterval(() => {
    refreshExchangeDetail(exchangeId).catch(() => {});
  }, 25000, { enabled: !closedForPolling });

  if (!exchange) {
    if (!checked) {
      return (
        <>
          <ScreenHeader back backHref="/exchanges" title="Exchange" />
          <div className="app-scroll" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="bulk-spinner" />
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <ScreenHeader back backHref="/exchanges" title="Exchange" />
        <div className="app-scroll">
          <EmptyState
            icon="🔍"
            title="This exchange is no longer available."
            action={<button className="btn btn-primary" onClick={() => router.push('/exchanges')}>Back to Exchange</button>}
          />
        </div>
      </>
    );
  }

  const steps = buildTimeline(exchange, user?.id);
  const action = nextAction(exchange, user?.id);
  const closed = isTerminal(exchange.stage) || (exchange.stage === 'completed' && exchange.rated);

  const doCancel = async (reason) => {
    try {
      await cancelExchange(exchange.id, reason);
      closeSheet();
      showToast(
        exchange.role === 'receiver'
          ? 'Exchange cancelled — your reserved credit was released'
          : 'Exchange cancelled',
      );
      router.push('/exchanges');
    } catch (err) {
      showToast(err.message || 'Could not cancel this exchange');
    }
  };

  // Task 61 — a reason is only required once the owner has accepted; a
  // still-pending request needs no explanation, so that path keeps the
  // original one-tap cancel with no prompt.
  const onCancel = () => {
    if (exchange.stage === 'requested') return doCancel();
    openSheet('Cancel this exchange', <CancelReasonForm role={exchange.role} onSubmit={doCancel} />);
  };

  return (
    <>
      <ScreenHeader
        back
        backHref="/exchanges"
        title={`Exchange with ${exchange.name}`}
        right={
          <button
            className="circle-btn"
            onClick={() => reportUser(exchange.otherUserId, exchange.name, exchange.bookTitle)}
            aria-label={`Report ${exchange.name}`}
          >
            <Icon name="flag" style={{ width: 15, height: 15 }} />
          </button>
        }
      />

      <div className="app-scroll pad-nav" style={{ padding: 16 }}>
        <ExchangePartnerCard exchange={exchange} />

        <NoteBox icon="gift" style={{ marginBottom: 6 }}>
          <b>Next step:</b>&nbsp;{action.note}
        </NoteBox>

        <ExchangeTimeline steps={steps} />

        {exchange.pickup && (
          <div className="card" style={{ marginTop: 4 }}>
            <b style={{ fontSize: 13.5, display: 'block', marginBottom: 6 }}>Scheduled pickup</b>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {[exchange.pickup.date, exchange.pickup.slot, exchange.pickup.point].filter(Boolean).join(' · ')}
            </div>
            {exchange.pickup.instructions && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                “{exchange.pickup.instructions}”
              </div>
            )}
          </div>
        )}
      </div>

      {!closed && (
        <div className="sticky-cta">
          {exchange.stage !== 'completed' && (
            <button className="btn btn-outline danger" onClick={onCancel}>Cancel</button>
          )}
          {action.label && (
            <button
              className="btn btn-primary"
              onClick={() => router.push(`/exchanges/${exchange.id}/${action.href}`)}
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}
