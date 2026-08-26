'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import BottomNav from '@/components/layout/BottomNav';
import SegTabs from '@/components/ui/SegTabs';
import NoteBox, { SectionTitle } from '@/components/ui/NoteBox';
import EmptyState from '@/components/ui/EmptyState';
import ShelfRow from '@/components/books/ShelfRow';
import { useAppData } from '@/contexts/AppDataContext';

const GIVEN = 'Given away';
const RECEIVED = 'Received';

/** Screen 11 — My Shelf: active/reserved/completed books plus the credit summary (§7). */
export default function MyShelfPage() {
  const router = useRouter();
  const { books, credits } = useAppData();
  const [tab, setTab] = useState('mybooks');

  const groups = useMemo(() => {
    const mine = Object.values(books).filter((b) => b.mine);
    return {
      mybooks: mine.filter((b) => b.status !== GIVEN && b.status !== RECEIVED),
      received: mine.filter((b) => b.status === RECEIVED),
      given: mine.filter((b) => b.status === GIVEN),
    };
  }, [books]);

  const list = groups[tab];
  const headings = { mybooks: 'My Books', received: 'Books I received', given: 'Books I gave away' };

  return (
    <>
      <ScreenHeader right={<HeaderActions />} />

      <div className="app-scroll">
        <div style={{ padding: '16px 16px 0' }}>
          <SectionTitle tick={false}>My Shelf</SectionTitle>
        </div>

        <NoteBox icon="gift" style={{ margin: '12px 16px' }}>
          Every book listed is a permanent gift and earns <b>1 credit</b>.
        </NoteBox>

        <SegTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'mybooks', label: 'My Books', count: groups.mybooks.length },
            { key: 'received', label: 'Received', count: groups.received.length },
            { key: 'given', label: 'Given', count: groups.given.length },
          ]}
        />

        <button className="credits-banner" onClick={() => router.push('/credits')}>
          <div className="credits-ring">{credits.available}</div>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 14.5, display: 'block', marginBottom: 2 }}>Exchange credits</b>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {groups.mybooks.length} listed · {groups.received.length} received · {credits.available} credits
            </span>
          </div>
          <Icon name="chevronRight" className="ic arrow" />
        </button>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '6px 16px 8px' }}>
          <SectionTitle tick={false} size={16}>{headings[tab]}</SectionTitle>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/books/add')}>
            <Icon name="plus" style={{ width: 12, height: 12 }} />List book
          </button>
        </div>

        {tab === 'mybooks' && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', padding: '0 16px 10px' }}>
            Tap &apos;View&apos; to edit or manage your listing.
          </div>
        )}

        <div className="pad-nav">
          {list.length ? (
            list.map((b) => <ShelfRow key={b.key} book={b} />)
          ) : (
            <EmptyState
              icon={tab === 'mybooks' ? '📚' : tab === 'received' ? '📥' : '🎁'}
              title={
                tab === 'mybooks'
                  ? 'No active listings yet.'
                  : tab === 'received'
                    ? "You haven't received a book yet."
                    : "You haven't given a book away yet."
              }
              hint={tab === 'mybooks' ? 'List your first book to earn a credit.' : undefined}
              action={
                tab === 'mybooks' ? (
                  <button className="btn btn-primary" onClick={() => router.push('/books/add')}>
                    <Icon name="plus" style={{ width: 14, height: 14 }} />List a book
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
