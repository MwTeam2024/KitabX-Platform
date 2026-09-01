'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScreenHeader from '@/components/ui/ScreenHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import BottomNav from '@/components/layout/BottomNav';
import SegTabs from '@/components/ui/SegTabs';
import EmptyState from '@/components/ui/EmptyState';
import { SectionTitle } from '@/components/ui/NoteBox';
import ExchangeCard from './ExchangeCard';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { isTerminal } from '@/lib/exchange';

const EMPTY = {
  forme: { icon: '📥', title: 'No incoming requests right now.', hint: 'List more books to get discovered by neighbours.' },
  mine: { icon: '🤝', title: "You haven't requested a book yet.", hint: 'Find one in Discover and use a credit to request it.' },
  done: { icon: '✅', title: 'No completed exchanges yet.', hint: 'Your finished handovers will appear here.' },
  cancelled: { icon: '↩️', title: 'No cancelled or declined exchanges.', hint: 'Anything declined, cancelled or expired shows up here.' },
};

export default function ExchangeList({ initialTab = 'forme' }) {
  const router = useRouter();
  const showToast = useToast();
  const { exchanges, acceptExchange, declineExchange, refreshExchanges } = useAppData();
  const [tab, setTab] = useState(initialTab);

  // The socket push + 45s poll (AppDataContext) keep this fresh in the
  // background, but neither fires the instant this screen is opened — fetch
  // once on mount so the very first view isn't waiting on either.
  useEffect(() => { refreshExchanges().catch(() => {}); }, [refreshExchanges]);

  const groups = useMemo(() => ({
    forme: exchanges.filter((e) => e.status === 'forme' && !isTerminal(e.stage)),
    mine: exchanges.filter((e) => e.status === 'mine' && !isTerminal(e.stage)),
    done: exchanges.filter((e) => e.status === 'done'),
    cancelled: exchanges.filter((e) => e.status === 'cancelled'),
  }), [exchanges]);

  const onAccept = async (exchange) => {
    try {
      await acceptExchange(exchange.id);
      showToast('Accepted — schedule a pickup next');
      router.push(`/exchanges/${exchange.id}`);
    } catch (err) {
      showToast(err.message || 'Could not accept this request');
    }
  };

  const onDecline = async (exchange) => {
    try {
      await declineExchange(exchange.id);
      showToast('Request declined — the requester’s credit was released');
    } catch (err) {
      showToast(err.message || 'Could not decline this request');
    }
  };

  const list = groups[tab];
  const pendingIncoming = groups.forme.filter((e) => e.stage === 'requested').length;

  return (
    <>
      <ScreenHeader right={<HeaderActions />} />

      <div className="app-scroll">
        <div style={{ padding: '16px 16px 4px' }}>
          <SectionTitle tick={false}>Exchange</SectionTitle>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage book requests and offers from other members
          </div>
        </div>

        <SegTabs
          style={{ marginTop: 14 }}
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'forme', label: 'For Me', count: groups.forme.length, danger: pendingIncoming > 0 },
            { key: 'mine', label: 'My Requests', count: groups.mine.length },
            { key: 'done', label: 'Completed', count: groups.done.length },
            { key: 'cancelled', label: 'Cancelled', count: groups.cancelled.length },
          ]}
        />

        <div className="pad-nav" style={{ marginTop: 16 }}>
          {list.length ? (
            list.map((e) => (
              <ExchangeCard key={e.id} exchange={e} onAccept={onAccept} onDecline={onDecline} />
            ))
          ) : (
            <EmptyState
              icon={EMPTY[tab].icon}
              title={EMPTY[tab].title}
              hint={EMPTY[tab].hint}
              action={
                tab === 'mine'
                  ? <button className="btn btn-primary" onClick={() => router.push('/home')}>Find a book</button>
                  : tab === 'forme'
                    ? <button className="btn btn-primary" onClick={() => router.push('/books/add')}>List a book</button>
                    : undefined
              }
            />
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
