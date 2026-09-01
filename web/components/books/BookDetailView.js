'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import NoteBox, { SectionTitle } from '@/components/ui/NoteBox';
import EmptyState from '@/components/ui/EmptyState';
import WishlistButton from '@/components/wishlist/WishlistButton';
import { StarDisplay } from '@/components/ratings/StarRating';
import { BookCover, BookCoverDetail } from './BookCover';
import { useAppData } from '@/contexts/AppDataContext';
import { useAppSheets } from '@/hooks/useAppSheets';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Screen 05. Owner listings get edit/pause/remove; other members' listings get
 * request/message plus the reporting entry point. Credit reservation happens in
 * NestJS — `requestBook` here only reflects the result (§19).
 */
export default function BookDetailView({ bookKey }) {
  const router = useRouter();
  const showToast = useToast();
  const {
    books, requestedKeys, getOwnerProfile, ensureBookDetail,
    requestBook, cancelBookRequest, togglePauseListing, removeListing,
  } = useAppData();
  const { trustProfile, reportListing } = useAppSheets();

  const book = books[bookKey];
  const [owner, setOwner] = useState(null);

  // Whatever's cached for this key (from a discovery/my-books list) renders
  // immediately, but is never the complete record — this always fetches the
  // full detail on top of it. `checked` distinguishes "haven't heard back
  // yet" from "confirmed gone", so a fresh page load with nothing cached yet
  // doesn't flash the "no longer available" state before the fetch lands.
  const [checked, setChecked] = useState(!!book);
  useEffect(() => {
    let alive = true;
    setChecked(!!book);
    ensureBookDetail(bookKey).finally(() => { if (alive) setChecked(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey]);

  useEffect(() => {
    if (!book?.ownerId) return;
    getOwnerProfile(book.ownerId).then(setOwner).catch(() => {});
  }, [book?.ownerId, getOwnerProfile]);

  if (!book) {
    if (!checked) {
      return (
        <>
          <ScreenHeader back backHref="/home" right={<HeaderActions compact />} />
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
        <ScreenHeader back backHref="/home" right={<HeaderActions compact />} />
        <div className="app-scroll">
          <EmptyState
            icon="🔍"
            title="This listing is no longer available."
            hint="It may have been given away or removed by its owner."
            action={<button className="btn btn-primary" onClick={() => router.push('/home')}>Back to Discover</button>}
          />
        </div>
      </>
    );
  }

  const mine = !!book.mine;
  // A book already given away or received via a completed exchange is still
  // "mine" for My Shelf's tab-grouping purposes, but there's nothing left to
  // edit/pause/remove — the exchange is done. Only a still-active listing
  // I actually own should get the owner-management controls.
  const canManage = mine && book.status !== 'Given away' && book.status !== 'Received';
  const requested = requestedKeys.has(bookKey);

  const onRequest = async () => {
    const result = await requestBook(bookKey);
    if (!result.ok) {
      return showToast(
        result.reason === 'no-credit'
          ? 'You need at least 1 available credit to request a book'
          : (result.message || 'This book is no longer available'),
      );
    }
    showToast("Request sent — you'll be notified when it's accepted 🤝");
    router.push('/exchanges?tab=mine');
  };

  // Chat is switched off for now (see chat.module.js) — this used to open a
  // conversation with the owner from here. There's no "accepted" gate
  // available at this point in the flow (only after a request exists and is
  // accepted does the WhatsApp contact button appear, on the exchange detail
  // page instead — see ExchangePartnerCard.js), so nothing replaces it here.
  // const onMessage = async () => {
  //   const mineExchange = exchanges.find((e) => e.bookKey === bookKey && e.role === 'receiver');
  //   if (!mineExchange) return showToast('Chat opens once your request is sent');
  //   const threadId = await openThreadForExchange(mineExchange.id);
  //   if (!threadId) return showToast('Conversation not available yet');
  //   router.push(`/chat/${threadId}`);
  // };

  const onRemove = async () => {
    try {
      await removeListing(bookKey);
      showToast('Listing removed');
      router.push('/books');
    } catch (err) {
      showToast(err.message || 'Could not remove this listing');
    }
  };

  return (
    <>
      <ScreenHeader back right={<HeaderActions compact />} />

      <div className="app-scroll pad-nav" style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', gap: 18, marginBottom: 22, position: 'relative' }}>
          <BookCoverDetail book={book} style={{ width: 150, aspectRatio: 0.72, flexShrink: 0 }} />
          {!mine && (
            <WishlistButton
              bookId={book.bookId}
              size={17}
              style={{ position: 'absolute', top: 0, right: 0, width: 40, height: 40 }}
            />
          )}
          <div style={{ paddingTop: 6, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 700, lineHeight: 1.12 }}>
              {book.title}
            </div>
            {book.subtitle && (
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{book.subtitle}</div>
            )}
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 4 }}>{book.author}</div>
            {owner?.averageRating != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 10, flexWrap: 'wrap' }}>
                <StarDisplay value={owner.averageRating} />
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 4, whiteSpace: 'nowrap' }}>
                  {owner.averageRating} ({owner.ratingCount})
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
              {book.tags.map((t) => <span className="pill-tag lg" key={t}>{t}</span>)}
            </div>
          </div>
        </div>

        <div className="section-row" style={{ padding: '0 0 10px' }}>
          <SectionTitle size={14}>Book details</SectionTitle>
        </div>
        <MetaGrid
          fields={[
            { icon: 'tag', label: 'Condition', value: book.paused ? 'Paused' : book.cond },
            { icon: 'globe', label: 'Language', value: book.lang || 'English' },
            book.publisher && { icon: 'building', label: 'Publisher', value: book.publisher },
            book.pageCount && { icon: 'bookOpen', label: 'Pages', value: book.pageCount },
          ].filter(Boolean)}
        />

        {book.condDesc && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '-10px 0 20px', lineHeight: 1.5 }}>
            {book.condDesc}
          </div>
        )}

        {(book.isbn || book.year || book.edition) && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '-8px 0 20px' }}>
            {[
              book.isbn && `ISBN: ${book.isbn}`,
              book.year && `Published: ${book.year}`,
              book.edition && `Edition: ${book.edition}`,
            ].filter(Boolean).join(' · ')}
          </div>
        )}

        {book.description && (
          <>
            <div className="section-row" style={{ padding: '0 0 10px' }}>
              <SectionTitle size={14}>About this book</SectionTitle>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: '0 0 20px' }}>
              {book.description}
            </div>
          </>
        )}

        {book.pickup && (
          <NoteBox icon="mapPin" style={{ margin: '-4px 0 20px' }}>{book.pickup}</NoteBox>
        )}

        <div className="section-row" style={{ padding: '0 0 10px' }}>
          <SectionTitle size={14}>Listed by</SectionTitle>
        </div>
        <button
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: 'none' }}
          onClick={() => trustProfile(book.ownerId, book.owner, book.ownerName, book.title)}
        >
          <div className="avatar-md">{book.owner}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 5 }}>
              {book.ownerName}
              {owner?.verified && (
                <Icon name="checkCircle" style={{ width: 14, height: 14, color: 'var(--brand-2)' }} />
              )}
            </b>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Icon name="mapPin" style={{ width: 11, height: 11 }} />
              <span>{publicLocation(book.loc, mine)}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
              ★ {owner?.averageRating ?? '—'} · {owner?.completedExchanges ?? 0} exchanges
            </div>
          </div>
          <Icon name="chevronRight" style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        </button>

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 4px 22px',
            fontSize: 11.5, color: 'var(--text-muted)', borderTop: '1px solid var(--line)', marginTop: 12,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <Icon name="clock" style={{ width: 12, height: 12 }} />
            Listed {book.listedDaysAgo ? `${book.listedDaysAgo} days ago` : 'recently'}
          </span>
          {!mine && (
            <>
              <span style={{ width: 1, height: 12, background: 'var(--line)', flexShrink: 0 }} />
              <button
                className="link-green"
                style={{ color: 'var(--sindoor)' }}
                onClick={() => reportListing(book.key, book.title)}
              >
                <Icon name="flag" style={{ width: 12, height: 12 }} />Report this listing
              </button>
            </>
          )}
        </div>

        {canManage && (
          <>
            <NoteBox icon="gift" style={{ margin: '12px 0 22px' }}>
              <b>How credits work</b>
              <br />
              List a book → earn 1 credit. Use a credit to receive a book. Books are permanent gifts.
            </NoteBox>
            <div style={{ margin: '0 0 22px' }}>
              <button
                className="btn btn-outline"
                onClick={async () => {
                  try {
                    await togglePauseListing(bookKey);
                    showToast(book.paused
                      ? 'Listing reactivated — visible in Discover again'
                      : 'Listing paused — hidden from Discover');
                  } catch (err) {
                    showToast(err.message || 'Could not update this listing');
                  }
                }}
              >
                <Icon name={book.paused ? 'play' : 'pause'} style={{ width: 15, height: 15 }} />
                {book.paused ? 'Reactivate listing' : 'Pause listing'}
              </button>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                {book.paused
                  ? 'This listing is paused and hidden from Discover.'
                  : 'Paused listings are hidden from Discover until you reactivate them.'}
              </div>
            </div>
          </>
        )}

        {!mine && (
          <div style={{ marginTop: 20 }}>
            <div className="section-row" style={{ padding: '0 0 10px' }}>
              <SectionTitle size={14}>Condition photo — lender&apos;s actual copy</SectionTitle>
            </div>
            <ConditionPhotoGallery key={book.key} book={book} />
          </div>
        )}
      </div>

      {/* No action bar at all for a book already given away or received —
          the exchange is done, there's nothing left to manage or request. */}
      {(canManage || !mine) && (
        <div className="sticky-cta">
          {canManage ? (
            <>
              <button className="btn btn-outline" onClick={() => router.push(`/books/add/details?edit=${bookKey}`)}>
                <Icon name="edit" style={{ width: 15, height: 15 }} />Edit listing
              </button>
              <button className="btn btn-danger-solid" onClick={onRemove}>
                <Icon name="x" style={{ width: 15, height: 15 }} />Remove listing
              </button>
            </>
          ) : requested ? (
            <>
              {/* Message button on hold along with onMessage above — see the note there. */}
              <button
                className="btn btn-danger-solid"
                onClick={async () => {
                  try {
                    await cancelBookRequest(bookKey);
                    showToast('Request cancelled — credit released back to your balance');
                  } catch (err) {
                    showToast(err.message || 'Could not cancel this request');
                  }
                }}
              >
                <Icon name="x" style={{ width: 15, height: 15 }} />Cancel Request
              </button>
            </>
          ) : (
            <>
              {/* Message button on hold along with onMessage above — see the note there. */}
              <button className="btn btn-primary" onClick={onRequest}>🤝 Request this book</button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Cover (`photos[0]`) is already shown at the top of the page — this card
 * pages through the remaining condition photos (`photos[1]`, `photos[2]`)
 * with prev/next arrows and dots. Falls back to the cover itself, or the
 * generated placeholder, when there's nothing else to page through.
 */
function ConditionPhotoGallery({ book }) {
  const gallery = (book.photos || []).slice(1);
  const [index, setIndex] = useState(0);

  const hasGallery = gallery.length > 0;
  const activeUrl = hasGallery ? gallery[index] : book.photos?.[0];
  const dotCount = hasGallery ? gallery.length : 1;

  return (
    <div>
      <div className="condition-photo">
        <span className="cp-leaf">🌿</span>
        {activeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={activeUrl}
            src={activeUrl}
            alt={`${book.title} — actual condition`}
            style={{ width: '44%', aspectRatio: 0.7, transform: 'rotate(-3deg)', objectFit: 'cover', borderRadius: 8 }}
          />
        ) : (
          <BookCover book={book} style={{ width: '44%', aspectRatio: 0.7, transform: 'rotate(-3deg)' }} />
        )}
        {gallery.length > 1 && (
          <>
            <button
              type="button"
              className="circle-btn cp-nav cp-nav-prev"
              onClick={() => setIndex((i) => (i - 1 + gallery.length) % gallery.length)}
              aria-label="Previous photo"
            >
              <Icon name="arrowLeft" style={{ width: 14, height: 14 }} />
            </button>
            <button
              type="button"
              className="circle-btn cp-nav cp-nav-next"
              onClick={() => setIndex((i) => (i + 1) % gallery.length)}
              aria-label="Next photo"
            >
              <Icon name="arrowRight" style={{ width: 14, height: 14 }} />
            </button>
          </>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0 22px' }}>
        {Array.from({ length: dotCount }, (_, i) => (
          <i key={i} className={`cp-dot${i === index ? ' on' : ''}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Two-per-row grid of `MetaCell`s — however many `fields` are actually
 * present (some, like publisher/page count, only exist for books looked up
 * via Google Books). A right border separates the two cells in a row, a
 * bottom border separates rows, and both are dropped exactly where there's
 * no neighbouring cell for them to separate.
 */
function MetaGrid({ fields }) {
  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', padding: 0, overflow: 'hidden', marginBottom: 20,
      }}
      className="card"
    >
      {fields.map((f, i) => {
        const isLastInRow = i % 2 === 1 || i === fields.length - 1;
        const isLastRow = i >= fields.length - (fields.length % 2 === 0 ? 2 : 1);
        return (
          <MetaCell
            key={f.label}
            icon={f.icon}
            label={f.label}
            value={f.value}
            style={{
              flex: '1 1 50%', minWidth: '45%', boxSizing: 'border-box',
              borderRight: isLastInRow ? undefined : '1px solid var(--line)',
              borderBottom: isLastRow ? undefined : '1px solid var(--line)',
            }}
          />
        );
      })}
    </div>
  );
}

function MetaCell({ icon, label, value, style }) {
  return (
    <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <div className="stat-ic" style={{ margin: 0, width: 34, height: 34 }}>
        <Icon name={icon} style={{ width: 15, height: 15 }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
        <b style={{ fontSize: 13.5 }}>{value}</b>
      </div>
    </div>
  );
}

/**
 * Privacy rule from the source plan: the exact flat/unit must never be public.
 * Only the block/tower and society survive until a request is accepted.
 */
function publicLocation(loc, mine) {
  if (mine || !loc) return loc;
  const [unit, ...rest] = loc.split(',').map((p) => p.trim());
  const block = unit.split('-')[0];
  return [block ? `${block} block` : null, ...rest].filter(Boolean).join(', ');
}
