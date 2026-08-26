'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScreenHeader from '@/components/ui/ScreenHeader';
import EmptyState from '@/components/ui/EmptyState';
import StarRating from './StarRating';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';

const CRITERIA = [
  { key: 'conditionAccuracy', label: 'Book-condition accuracy' },
  { key: 'communication', label: 'Communication' },
  { key: 'reliability', label: 'Reliability' },
];

/** One rating per completed exchange — the backend enforces that rule (§13). */
export default function RateExchange({ exchangeId }) {
  const router = useRouter();
  const showToast = useToast();
  const { getExchange, ensureExchange, submitRating } = useAppData();

  const exchange = getExchange(exchangeId);
  const [scores, setScores] = useState({ conditionAccuracy: 0, communication: 0, reliability: 0 });
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!exchange) ensureExchange(exchangeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeId, exchange]);

  if (!exchange) {
    return (
      <>
        <ScreenHeader back backHref="/exchanges" title="Rate this exchange" />
        <div className="app-scroll">
          <EmptyState icon="🔍" title="This exchange is no longer available." />
        </div>
      </>
    );
  }

  if (exchange.rated) {
    return (
      <>
        <ScreenHeader back backHref="/exchanges" title={`Rate ${exchange.name}`} />
        <div className="app-scroll">
          <EmptyState
            icon="⭐"
            title={`You've already rated this exchange.`}
            hint="Only one rating is allowed per completed exchange."
            action={<button className="btn btn-primary" onClick={() => router.push('/exchanges?tab=done')}>View completed</button>}
          />
        </div>
      </>
    );
  }

  const allRated = CRITERIA.every((c) => scores[c.key] > 0);

  const submit = async () => {
    if (!allRated) return;
    setSaving(true);
    try {
      await submitRating(exchange.exchangeId, exchange.id, { ...scores, review });
      showToast(`Thanks for rating ${exchange.name}! ⭐`);
      router.push('/exchanges?tab=done');
    } catch (err) {
      showToast(err.message || 'Could not submit this rating');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScreenHeader title={`Rate ${exchange.name}`} back backHref={`/exchanges/${exchange.id}`} />

      <div className="app-scroll pad-nav" style={{ padding: '18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div className="avatar-md">{exchange.initials}</div>
          <div>
            <b style={{ fontSize: 14.5 }}>{exchange.name}</b>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Exchange for &ldquo;{exchange.bookTitle}&rdquo;
            </div>
          </div>
        </div>

        {CRITERIA.map((c, i) => (
          <div className="card" key={c.key} style={{ marginBottom: i === CRITERIA.length - 1 ? 16 : 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 9 }}>{c.label}</div>
            <StarRating
              value={scores[c.key]}
              onChange={(v) => setScores((s) => ({ ...s, [c.key]: v }))}
            />
          </div>
        ))}

        <div className="field">
          <label htmlFor="review">Written review (optional)</label>
          <textarea
            id="review"
            placeholder="Share a bit about the exchange…"
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
        </div>
      </div>

      <div className="sticky-cta">
        <button className="btn btn-primary" onClick={submit} disabled={saving || !allRated}>
          {saving ? 'Submitting…' : allRated ? 'Submit rating' : 'Rate all three to continue'}
        </button>
      </div>
    </>
  );
}
