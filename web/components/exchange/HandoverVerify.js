'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import EmptyState from '@/components/ui/EmptyState';
import OtpInput from '@/components/auth/OtpInput';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { firstName } from '@/lib/exchange';

/**
 * Screen 16. The receiver reads out a one-time code; the owner enters it and
 * NestJS validates it — only then do credits move and rating unlocks (§13, §19).
 * Handover/rating are scoped to the real Exchange row id (`exchange.exchangeId`),
 * a different id space from the request id this screen is routed with.
 */
export default function HandoverVerify({ exchangeId }) {
  const router = useRouter();
  const showToast = useToast();
  const { getExchange, ensureExchange, getHandoverCode, verifyHandover } = useAppData();

  const exchange = getExchange(exchangeId);
  const [code, setCode] = useState('');
  const [myCode, setMyCode] = useState(null);
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!exchange) ensureExchange(exchangeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeId, exchange]);

  useEffect(() => {
    if (exchange?.role === 'receiver' && exchange.exchangeId) {
      getHandoverCode(exchange.exchangeId).then((res) => setMyCode(res.code)).catch(() => {});
    }
  }, [exchange?.role, exchange?.exchangeId, getHandoverCode]);

  if (!exchange) {
    return (
      <>
        <ScreenHeader back backHref="/exchanges" title="Verify handover" />
        <div className="app-scroll">
          <EmptyState icon="🔍" title="This exchange is no longer available." />
        </div>
      </>
    );
  }

  const partner = firstName(exchange);
  const alreadyDone = exchange.stage === 'handover-verified' || exchange.stage === 'completed';

  const submit = async () => {
    if (code.length < 6) return showToast('Enter the full 6-digit code');
    setChecking(true);
    try {
      await verifyHandover(exchange.exchangeId, exchange.id, code);
      setVerified(true);
    } catch (err) {
      showToast(err.message || 'Incorrect code');
    } finally {
      setChecking(false);
    }
  };

  const showSuccess = verified || alreadyDone;

  return (
    <>
      <ScreenHeader back backHref={`/exchanges/${exchange.id}`} title="Verify handover" />

      <div className="app-scroll pad-nav">
        {showSuccess ? (
          <div style={{ padding: '30px 16px', textAlign: 'center' }}>
            <div className="success-badge animate"><Icon name="check" /></div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginTop: 18 }}>
              Handover verified!
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0 4px' }}>
              {exchange.role === 'giver'
                ? `1 credit is now available in your passbook.`
                : `1 credit has moved to ${partner}'s passbook.`}
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={() => router.push(`/exchanges/${exchange.id}/rate`)}
            >
              Rate this exchange
            </button>
          </div>
        ) : exchange.role === 'receiver' ? (
          <div style={{ padding: '20px 16px' }}>
            <div className="card" style={{ textAlign: 'center', padding: '28px 16px' }}>
              <div
                style={{
                  fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.04em',
                  textTransform: 'uppercase', marginBottom: 12,
                }}
              >
                Share this code with {partner}
              </div>
              <div className="otp-code">{myCode || '······'}</div>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6 }}>
                Only share once you have the physical book in hand — this confirms the handover really happened.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 16px' }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
              Enter the 6-digit code the receiver shares with you at handover.
            </p>
            <OtpInput value={code} onChange={setCode} />
            <button className="btn btn-primary" onClick={submit} disabled={checking || code.length < 6}>
              {checking ? 'Verifying…' : 'Verify code'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
