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
import Lightbox from '@/components/ui/Lightbox';
import ImageMagnifier from '@/components/ui/ImageMagnifier';
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
    books, requestedKeys, getOwnerProfile, ensureBookDetail, credits,
    requestBook, cancelBookRequest, togglePauseListing, removeListing,
  } = useAppData();
  const { trustProfile, reportListing } = useAppSheets();

  const book = books[bookKey];
  const [owner, setOwner] = useState(null);
  const [zoomSrc, setZoomSrc] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [batchRequesting, setBatchRequesting] = useState(false);
  const [otherListingsOpen, setOtherListingsOpen] = useState(false);

  useEffect(() => { setSelectedKeys([]); }, [bookKey]);

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
  // Whatever's already loaded into the shared cache from this owner (Discover,
  // search, ...) — same source `sellerListings` (useAppSheets) already reads,
  // just rendered inline here instead of behind an extra sheet. Books that are
  // genuinely un-requestable (paused, already given away/received) are left
  // out entirely rather than shown greyed-out — only "already requested"
  // stays visible, since that's still useful context.
  const otherListings = mine ? [] : Object.values(books).filter((b) => (
    b.ownerId === book.ownerId && b.key !== book.key
    && !b.paused && b.status !== 'Given away' && b.status !== 'Received'
  ));
  // Selecting is capped at the current available-credit balance — each
  // selected book still reserves its own credit one at a time exactly like
  // a single request (see requestKeys below), so trying to select more than
  // you can actually afford is stopped up front instead of silently only
  // partly going through after the fact.
  //
  // While the book this whole page is about is still requestable, it's
  // folded into the same one combined "Request N books" action as these
  // checkboxes (see onRequestAll) rather than being a separate button with
  // its own separate credit — so it still needs its own slot reserved out of
  // the same budget these checkboxes are capped against.
  const mainBookNeedsCreditSlot = !mine && !requested;
  const otherBooksCreditCap = Math.max(0, credits.available - (mainBookNeedsCreditSlot ? 1 : 0));
  const toggleSelected = (key) => {
    const isSelected = selectedKeys.includes(key);
    if (!isSelected && selectedKeys.length >= otherBooksCreditCap) {
      showToast(
        otherBooksCreditCap > 0
          ? `You can only select ${otherBooksCreditCap} book${otherBooksCreditCap === 1 ? '' : 's'} at a time with your current credits`
          : mainBookNeedsCreditSlot
            ? 'Your only credit is reserved for the book on this page'
            : "You don't have any credits available right now",
      );
      return;
    }
    setSelectedKeys((s) => (isSelected ? s.filter((k) => k !== key) : [...s, key]));
  };

  // The single source of truth for sending requests, whether it's just the
  // book on this page, just the ticked "More from" ones, or both together —
  // one call per key, same server-side credit check every time (§19), so
  // there's exactly one code path and no way for a "batch" click to silently
  // only cover part of what was actually selected.
  const requestKeys = async (keys) => {
    if (!keys.length) return;
    setBatchRequesting(true);
    let sent = 0;
    let noCredit = false;
    for (const key of keys) {
      // eslint-disable-next-line no-await-in-loop
      const result = await requestBook(key);
      if (result.ok) sent += 1;
      else if (result.reason === 'no-credit') noCredit = true;
    }
    setBatchRequesting(false);
    setSelectedKeys([]);
    if (sent && noCredit) {
      showToast(`${sent} request${sent === 1 ? '' : 's'} sent — ran out of credits for the rest`);
    } else if (sent) {
      showToast(sent === 1 ? "Request sent — you'll be notified when it's accepted 🤝" : `${sent} requests sent — you'll be notified as each is accepted 🤝`);
    } else if (noCredit) {
      showToast('You need at least 1 available credit to request a book');
    } else {
      showToast('Could not send those requests — try again');
    }
    if (sent) router.push('/exchanges?tab=mine');
  };

  // While the book on this page can still be requested, it and the ticked
  // "More from" books are one combined action (see the sticky button below)
  // — no separate "did I actually submit the others too" second click.
  // Once it's already requested (or it's your own listing), there's nothing
  // left to fold it into, so the checkboxes get their own button instead.
  const onRequestAll = () => requestKeys(mainBookNeedsCreditSlot ? [bookKey, ...selectedKeys] : selectedKeys);

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
          <button
            type="button"
            style={{ width: 150, aspectRatio: 0.72, flexShrink: 0, padding: 0, border: 'none', background: 'none' }}
            onClick={() => book.photos?.[0] && setZoomSrc(book.photos[0])}
            aria-label={book.photos?.[0] ? 'View cover full size' : undefined}
          >
            {book.photos?.[0] ? (
              <ImageMagnifier src={book.photos[0]} alt={`${book.title} cover`} style={{ borderRadius: 12, overflow: 'hidden' }} />
            ) : (
              <BookCoverDetail book={book} style={{ width: 150, aspectRatio: 0.72, flexShrink: 0 }} />
            )}
          </button>
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

        {mine && (
          <div style={{ margin: '20px 0 0' }}>
            <div className="section-row" style={{ padding: '0 0 10px' }}>
              <SectionTitle size={14}>Your uploaded photos</SectionTitle>
            </div>
            <ConditionPhotoGallery key={book.key} book={book} onZoom={setZoomSrc} />
          </div>
        )}

        {otherListings.length > 0 && (
          <div style={{ margin: '14px 0 0' }}>
            <button
              type="button"
              onClick={() => setOtherListingsOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                padding: '0 0 10px', border: 'none', background: 'none', textAlign: 'left',
              }}
              aria-expanded={otherListingsOpen}
            >
              <SectionTitle size={14}>
                More from {book.ownerName} ({otherListings.length})
                {!otherListingsOpen && selectedKeys.length > 0 && ` — ${selectedKeys.length} selected`}
              </SectionTitle>
              <Icon
                name="chevronDown"
                style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0, transform: otherListingsOpen ? 'rotate(180deg)' : 'none' }}
              />
            </button>
            {otherListingsOpen && (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-6px 0 10px' }}>
                  {mainBookNeedsCreditSlot
                    ? 'Tick to add these to your request below'
                    : 'Tick the books you want — request them all at once'}
                </div>
                {otherListings.map((b) => {
                  const alreadyRequested = requestedKeys.has(b.key);
                  const checked = selectedKeys.includes(b.key);
                  return (
                    <div
                      key={b.key}
                      className="card"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, marginBottom: 10, opacity: alreadyRequested ? 0.6 : 1 }}
                    >
                      <input
                        type="checkbox"
                        style={{ width: 17, height: 17, flexShrink: 0, accentColor: 'var(--brand-2)' }}
                        checked={checked}
                        disabled={alreadyRequested}
                        onChange={() => toggleSelected(b.key)}
                        aria-label={`Select ${b.title} to request`}
                      />
                      <button
                        type="button"
                        onClick={() => router.push(`/books/${b.key}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                          border: 'none', background: 'none', textAlign: 'left', padding: 0,
                        }}
                      >
                        <BookCover book={b} style={{ width: 40, aspectRatio: '2/3', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: 13, display: 'block' }}>{b.title}</b>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.author}</div>
                        </div>
                      </button>
                      {alreadyRequested && (
                        <span className="status-pill st-given" style={{ flexShrink: 0 }}>Requested</span>
                      )}
                    </div>
                  );
                })}
                {/* When the book on this page is still requestable, its checkbox-less
                    request is already folded into these selections — see the one
                    combined button in the sticky bar below instead of a second one
                    here. Only once it's no longer part of that (already requested,
                    or this is your own listing) do these need their own button. */}
                {!mainBookNeedsCreditSlot && selectedKeys.length > 0 && (
                  <button className="btn btn-primary" style={{ marginTop: 4 }} disabled={batchRequesting} onClick={() => requestKeys(selectedKeys)}>
                    {batchRequesting
                      ? 'Sending…'
                      : `🤝 Request ${selectedKeys.length} selected book${selectedKeys.length === 1 ? '' : 's'}`}
                  </button>
                )}
              </>
            )}
          </div>
        )}

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
            <ConditionPhotoGallery key={book.key} book={book} onZoom={setZoomSrc} />
          </div>
        )}
      </div>

      <Lightbox src={zoomSrc} onClose={() => setZoomSrc('')} />

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
              {/* Message button on hold along with onMessage above — see the note there.
                  This one button covers the book on this page plus whatever's ticked in
                  "More from" above — see onRequestAll and mainBookNeedsCreditSlot. */}
              <button className="btn btn-primary" disabled={batchRequesting} onClick={onRequestAll}>
                {batchRequesting
                  ? 'Sending…'
                  : selectedKeys.length
                    ? `🤝 Request ${1 + selectedKeys.length} books`
                    : '🤝 Request this book'}
              </button>
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
function ConditionPhotoGallery({ book, onZoom }) {
  const gallery = (book.photos || []).slice(1);
  const [index, setIndex] = useState(0);

  const hasGallery = gallery.length > 0;
  const activeUrl = hasGallery ? gallery[index] : book.photos?.[0];
  const dotCount = hasGallery ? gallery.length : 1;

  // A real uploaded photo is shown exactly as uploaded — no added card
  // background, no white frame, no rotation. Capped at maxHeight rather than
  // stretched to the full card width — a tall portrait photo otherwise ends
  // up taller than the screen — with width following automatically from that,
  // so the photo still scales down whole (nothing cropped off any edge) and
  // just ends up narrower instead of spilling past a fixed height. The
  // stylised gradient card is only ever a placeholder for when there's no
  // real photo to show.
  return (
    <div>
      <div style={{ position: 'relative' }}>
        {activeUrl ? (
          <button
            type="button"
            onClick={() => onZoom(activeUrl)}
            aria-label="View photo full size"
            style={{ display: 'flex', justifyContent: 'center', width: '100%', padding: 0, border: 'none', background: 'none' }}
          >
            <ImageMagnifier
              key={activeUrl}
              src={activeUrl}
              alt={`${book.title} — actual condition`}
              maxHeight={380}
              imgStyle={{ borderRadius: 12 }}
            />
          </button>
        ) : (
          <div className="condition-photo">
            <span className="cp-leaf">🌿</span>
            <BookCover book={book} style={{ width: '44%', aspectRatio: 0.7, transform: 'rotate(-3deg)' }} />
          </div>
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
