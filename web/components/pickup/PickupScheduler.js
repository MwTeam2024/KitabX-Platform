'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NoteBox from '@/components/ui/NoteBox';
import EmptyState from '@/components/ui/EmptyState';
import PillSelect from '@/components/ui/PillSelect';
import CancelReasonForm from '@/components/exchange/CancelReasonForm';
import { useAppData } from '@/contexts/AppDataContext';
import { useSheet } from '@/components/ui/SheetProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { useAuth } from '@/hooks/useAuth';
import { useInterval } from '@/hooks/useInterval';
import { nextPickupDates, formatPickupDate, tomorrowIsoDate } from '@/lib/dates';
import { useIsClient } from '@/hooks/useClientOnly';
import { PICKUP_POINTS, PICKUP_TIME_SLOTS } from '@/lib/constants';
import { firstName } from '@/lib/exchange';

/**
 * Screen 15. Fixed slots + predefined society pickup points, one reschedule,
 * and the schedule only counts as agreed once the other member confirms.
 * The exact flat number is never shared — only the pickup point.
 */
export default function PickupScheduler({ exchangeId }) {
  const router = useRouter();
  const showToast = useToast();
  const { openSheet, closeSheet } = useSheet();
  const { user } = useAuth();
  const { getExchange, ensureExchange, refreshExchangeDetail, proposePickup, confirmPickup, cancelExchange } = useAppData();

  const exchange = getExchange(exchangeId);

  // Distinguishes "haven't resolved this id yet" from "resolved and it's
  // genuinely gone" — without this, every render in between (including the
  // brief window on first mount before ensureExchange's fetch lands) shows
  // the hard "no longer available" empty state, which is what was being
  // reported as the screen "going blank" mid-flow.
  const [checked, setChecked] = useState(!!exchange);
  useEffect(() => {
    if (exchange) { setChecked(true); return; }
    let alive = true;
    setChecked(false);
    ensureExchange(exchangeId).then(() => { if (alive) setChecked(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeId, exchange]);

  // §16/§35: a confirm/counter-proposal from the other party already arrives
  // near-instantly via the Socket.IO push in AppDataContext (the other
  // party's action creates a notification, which now emits `notification:new`
  // back to this user, which re-fetches the shared exchanges list — same row
  // this screen reads). This interval is just the safety net for a dropped
  // socket, so it can be much slower than the original 8s.
  useInterval(() => {
    refreshExchangeDetail(exchangeId).catch(() => {});
  }, 25000, { enabled: exchange?.stage === 'pickup-proposed' });

  // "Today" only exists in the browser, so the date options are gated behind
  // useIsClient — otherwise SSR and the client could disagree across midnight.
  const isClient = useIsClient();
  const dates = useMemo(() => (isClient ? nextPickupDates(3) : []), [isClient]);

  const [pickedDate, setPickedDate] = useState('');
  const [slot, setSlot] = useState(PICKUP_TIME_SLOTS[0]);
  const [point, setPoint] = useState(PICKUP_POINTS[0]);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const date = pickedDate || dates[0] || '';

  if (!exchange) {
    if (!checked) {
      return (
        <>
          <ScreenHeader back backHref="/exchanges" title="Schedule pickup" />
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
        <ScreenHeader back backHref="/exchanges" title="Schedule pickup" />
        <div className="app-scroll">
          <EmptyState icon="🔍" title="This exchange is no longer available." />
        </div>
      </>
    );
  }

  const proposed = exchange.stage === 'pickup-proposed';
  const confirmed = exchange.stage === 'pickup-confirmed' || exchange.stage === 'handover-verified';
  const partner = firstName(exchange);
  // Whoever's still-pending proposal this is — never the viewer who can confirm
  // it, only the one waiting on the other party (the backend rejects a
  // proposer trying to confirm their own proposal).
  const amProposer = !!user?.id && exchange.pickup?.proposedById === user.id;

  const propose = async () => {
    if (!date) return showToast('Pick a date first');
    setSaving(true);
    try {
      await proposePickup(exchange.id, { date, timeSlot: slot, customLocation: point, instructions });
      showToast(`Schedule sent — waiting for ${partner} to confirm`);
    } catch (err) {
      showToast(err.message || 'Could not propose this pickup time');
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    setSaving(true);
    try {
      await confirmPickup(exchange.id);
      showToast(`Pickup confirmed ✓ — reminder set for ${exchange.pickup?.date || date}`);
      router.push(`/exchanges/${exchange.id}`);
    } catch (err) {
      showToast(err.message || 'Could not confirm this pickup');
    } finally {
      setSaving(false);
    }
  };

  const openSuggestSheet = () => {
    openSheet('Suggest a different time', (
      <SuggestTimeForm
        dates={dates}
        pickup={exchange.pickup}
        onSubmit={async (values) => {
          try {
            await proposePickup(exchange.id, values);
            closeSheet();
            showToast(`New time proposed — waiting for ${partner} to confirm`);
          } catch (err) {
            showToast(err.message || 'Could not suggest this time');
          }
        }}
      />
    ));
  };

  const openCancelSheet = () => {
    openSheet('Cancel this exchange', (
      <CancelReasonForm
        role={exchange.role}
        onSubmit={async (reason) => {
          try {
            await cancelExchange(exchange.id, reason);
            closeSheet();
            showToast(`Cancelled — ${reason.toLowerCase()}. Reserved credit released.`);
            router.push('/exchanges');
          } catch (err) {
            showToast(err.message || 'Could not cancel this exchange');
          }
        }}
      />
    ));
  };

  const summary = exchange.pickup
    ? [exchange.pickup.date, exchange.pickup.slot, exchange.pickup.point].filter(Boolean).join(' · ')
    : [date, slot, point].filter(Boolean).join(' · ');

  return (
    <>
      <ScreenHeader back backHref={`/exchanges/${exchange.id}`} title="Schedule pickup" />

      <div className="app-scroll">
        {confirmed ? (
          <div className="pad-nav" style={{ padding: '30px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <b style={{ fontSize: 15 }}>Pickup scheduled</b>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '8px 0 20px' }}>{summary}</p>
            <NoteBox icon="clock" style={{ textAlign: 'left', marginBottom: 14 }}>
              We&apos;ll remind you both a few hours before the pickup window opens.
            </NoteBox>
            <button
              className="btn btn-primary"
              onClick={() => router.push(`/exchanges/${exchange.id}/handover`)}
            >
              Verify handover
            </button>
          </div>
        ) : proposed ? (
          <div className="pad-nav" style={{ padding: '30px 16px', textAlign: 'center' }}>
            {amProposer ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                <b style={{ fontSize: 15 }}>Waiting for {partner} to confirm</b>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '8px 0 20px' }}>{summary}</p>

                <NoteBox icon="info" style={{ textAlign: 'left', marginBottom: 14 }}>
                  The pickup is only scheduled once {partner} agrees. You can suggest a different time while you wait.
                </NoteBox>

                <button className="btn btn-outline" style={{ marginBottom: 10 }} onClick={openSuggestSheet} disabled={saving}>
                  Suggest a different time
                </button>
                <button className="btn btn-outline danger" onClick={openCancelSheet}>Cancel exchange</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
                <b style={{ fontSize: 15 }}>{partner} suggested a pickup time</b>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '8px 0 20px' }}>{summary}</p>

                <NoteBox icon="info" style={{ textAlign: 'left', marginBottom: 14 }}>
                  Confirm if this works for you, or suggest a different time instead.
                </NoteBox>

                <button className="btn btn-primary" style={{ marginBottom: 10 }} onClick={confirm} disabled={saving}>
                  <Icon name="check" style={{ width: 14, height: 14 }} />Confirm this time
                </button>
                <button className="btn btn-outline" style={{ marginBottom: 10 }} onClick={openSuggestSheet} disabled={saving}>
                  Suggest a different time
                </button>
                <button className="btn btn-outline danger" onClick={openCancelSheet}>Cancel exchange</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="pad-nav" style={{ padding: '18px 16px' }}>
              <div className="field">
                <label>Date</label>
                {dates.length
                  ? (
                    <PillSelect
                      options={dates}
                      value={date}
                      onChange={setPickedDate}
                      allowOther
                      otherType="date"
                      otherMin={tomorrowIsoDate()}
                      formatOther={formatPickupDate}
                    />
                  )
                  : <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading dates…</div>}
              </div>
              <div className="field">
                <label>Time slot</label>
                <PillSelect
                  options={PICKUP_TIME_SLOTS}
                  value={slot}
                  onChange={setSlot}
                  allowOther
                  otherPlaceholder="e.g. 5–6 PM"
                />
              </div>
              <div className="field">
                <label>Pickup point</label>
                <PillSelect
                  options={PICKUP_POINTS}
                  value={point}
                  onChange={setPoint}
                  allowOther
                  otherPlaceholder="e.g. Basement parking"
                />
              </div>
              <div className="field">
                <label htmlFor="pickup-note">
                  Pickup instructions <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  id="pickup-note"
                  placeholder="e.g. Please call through the intercom when you reach the main gate."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
              <NoteBox icon="lock">
                Only this pickup point is shared — your exact flat number stays private.
              </NoteBox>
            </div>

            <div className="sticky-cta">
              <button className="btn btn-primary" onClick={propose} disabled={saving}>
                {saving ? 'Sending…' : 'Propose schedule'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Counter-proposal sheet — reuses the same picker fields as the initial propose
 * form, pre-filled from the pending pickup so the user only edits what's changing. */
function SuggestTimeForm({ dates, pickup, onSubmit }) {
  const [pickedDate, setPickedDate] = useState(pickup?.date && dates.includes(pickup.date) ? pickup.date : (dates[0] || ''));
  const [slot, setSlot] = useState(pickup?.slot || PICKUP_TIME_SLOTS[0]);
  const [point, setPoint] = useState(pickup?.point || PICKUP_POINTS[0]);
  const [instructions, setInstructions] = useState(pickup?.instructions || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit({ date: pickedDate, timeSlot: slot, customLocation: point, instructions });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="field">
        <label>Date</label>
        {dates.length
          ? (
            <PillSelect
              options={dates}
              value={pickedDate}
              onChange={setPickedDate}
              allowOther
              otherType="date"
              otherMin={tomorrowIsoDate()}
              formatOther={formatPickupDate}
            />
          )
          : <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading dates…</div>}
      </div>
      <div className="field">
        <label>Time slot</label>
        <PillSelect
          options={PICKUP_TIME_SLOTS}
          value={slot}
          onChange={setSlot}
          allowOther
          otherPlaceholder="e.g. 5–6 PM"
        />
      </div>
      <div className="field">
        <label>Pickup point</label>
        <PillSelect
          options={PICKUP_POINTS}
          value={point}
          onChange={setPoint}
          allowOther
          otherPlaceholder="e.g. Basement parking"
        />
      </div>
      <div className="field">
        <label htmlFor="suggest-note">
          Pickup instructions <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          id="suggest-note"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={saving || !pickedDate}>
        {saving ? 'Sending…' : 'Send new time'}
      </button>
    </>
  );
}
