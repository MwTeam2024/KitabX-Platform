'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import BottomNav from '@/components/layout/BottomNav';
import EmptyState from '@/components/ui/EmptyState';
import { SectionTitle, StatusPill } from '@/components/ui/NoteBox';
import { BookSpine } from '@/components/books/BookCover';
import { coverForDraft } from '@/contexts/BookDraftContext';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Screen 12 — saved books with availability/requested state and the wishlist
 * alert banner. Availability comes from the API, never from client state (§9).
 */
export default function WishlistPage() {
  const router = useRouter();
  const showToast = useToast();
  const { wishlist, toggleWishlist } = useAppData();

  const saved = useMemo(
    () => wishlist.map((w) => ({ ...w, ...coverForDraft({ title: w.title, author: w.author, genre: w.genre }) })),
    [wishlist],
  );

  // A saved title that just became available near the member and isn't already requested (§9, §15).
  const alertBook = saved.find((b) => b.available && !b.requested);

  const remove = async (bookId, title) => {
    try {
      await toggleWishlist(bookId);
      showToast(`Removed “${title}” from wishlist`);
    } catch (err) {
      showToast(err.message || 'Could not update your wishlist');
    }
  };

  return (
    <>
      <ScreenHeader right={<HeaderActions />} />

      <div className="app-scroll">
        <div style={{ padding: '16px 16px 4px' }}>
          <SectionTitle tick={false}>Wishlist</SectionTitle>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
            Save books &amp; get alerts when they&apos;re available near you
          </div>
        </div>

        {alertBook && (
          <div className="alert-banner">
            <span className="abk"><Icon name="bell" />Wishlist alert</span>
            <h4>{alertBook.title} is available near you!</h4>
            <p>Listed by {alertBook.ownerName}</p>
            <button className="btn btn-white btn-sm" onClick={() => router.push(`/books/${alertBook.key}`)}>
              Request this book<Icon name="arrowRight" style={{ width: 12, height: 12 }} />
            </button>
          </div>
        )}

        <div className="section-row">
          <SectionTitle size={16}>Saved books</SectionTitle>
          <span className="section-sub">{saved.length} book{saved.length !== 1 ? 's' : ''} saved</span>
        </div>

        {saved.length ? (
          <div className="pad-nav" style={{ marginTop: 8 }}>
            {saved.map((b) => {
              const unavailable = !b.available;
              return (
                <div className="shelf-row" key={b.bookId} style={{ opacity: unavailable ? 0.6 : 1 }}>
                  <button
                    onClick={() => b.available && router.push(`/books/${b.key}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
                      background: 'none', border: 'none', padding: 0, textAlign: 'left',
                    }}
                  >
                    <div className="shelf-cov"><BookSpine book={b} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {b.requested && <StatusPill tone="req" style={{ margin: '0 0 5px' }}>Requested</StatusPill>}
                      {unavailable && <StatusPill tone="given" style={{ margin: '0 0 5px' }}>No longer available</StatusPill>}
                      <b style={{ fontSize: 13.5, display: 'block' }}>{b.title}</b>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{b.author}</div>
                      <span className="pill-tag" style={{ marginTop: 5 }}>{b.genre}</span>
                    </div>
                  </button>
                  <button
                    className="circle-btn"
                    style={{ background: 'var(--surface-soft)', flexShrink: 0 }}
                    title="Remove from wishlist"
                    aria-label={`Remove ${b.title} from wishlist`}
                    onClick={() => remove(b.bookId, b.title)}
                  >
                    <Icon name="x" style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="💛"
            title="No books in your wishlist yet."
            hint="Tap the heart on any book to save it here."
            action={<button className="btn btn-primary" onClick={() => router.push('/home')}>Browse books</button>}
          />
        )}
      </div>

      <BottomNav />
    </>
  );
}
