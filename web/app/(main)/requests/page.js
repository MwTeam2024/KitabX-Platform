'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ScreenHeader from '@/components/ui/ScreenHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import BottomNav from '@/components/layout/BottomNav';
import EmptyState from '@/components/ui/EmptyState';
import NoteBox, { SectionTitle } from '@/components/ui/NoteBox';
import ExchangeCard from '@/components/exchange/ExchangeCard';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Incoming book requests (§11 / Module 7) — the decision queue on its own route,
 * so a push notification can deep-link straight to it.
 */
export default function RequestsPage() {
  const router = useRouter();
  const showToast = useToast();
  const { exchanges, acceptExchange, declineExchange } = useAppData();

  const incoming = useMemo(
    () => exchanges.filter((e) => e.status === 'forme' && e.stage === 'requested'),
    [exchanges],
  );

  return (
    <>
      <ScreenHeader right={<HeaderActions />} />

      <div className="app-scroll">
        <div style={{ padding: '16px 16px 4px' }}>
          <SectionTitle tick={false}>Book requests</SectionTitle>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Members waiting on your decision
          </div>
        </div>

        <NoteBox icon="info" style={{ margin: '12px 16px' }}>
          Accepting reserves the book and closes any other pending request for it.
        </NoteBox>

        <div className="pad-nav" style={{ marginTop: 4 }}>
          {incoming.length ? incoming.map((e) => (
            <ExchangeCard
              key={e.id}
              exchange={e}
              onAccept={async (ex) => {
                try {
                  await acceptExchange(ex.id);
                  showToast('Accepted — schedule a pickup next');
                  router.push(`/exchanges/${ex.id}`);
                } catch (err) {
                  showToast(err.message || 'Could not accept this request');
                }
              }}
              onDecline={async (ex) => {
                try {
                  await declineExchange(ex.id);
                  showToast('Request declined — the requester’s credit was released');
                } catch (err) {
                  showToast(err.message || 'Could not decline this request');
                }
              }}
            />
          )) : (
            <EmptyState
              icon="📥"
              title="No requests waiting on you."
              hint="You'll be notified the moment a neighbour asks for one of your books."
              action={
                <button className="btn btn-primary" onClick={() => router.push('/exchanges')}>
                  View all exchanges
                </button>
              }
            />
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
