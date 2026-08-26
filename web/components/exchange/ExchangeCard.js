'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { BookCover } from '@/components/books/BookCover';
import { StatusPill } from '@/components/ui/NoteBox';
import { STAGE_LABELS } from '@/lib/exchange';
import { useAppSheets } from '@/hooks/useAppSheets';
import { timeAgo } from '@/lib/dates';

/**
 * Screen 13 cards. Incoming requests get accept/decline plus the requester's
 * trust summary (§11); outgoing and completed exchanges open the timeline.
 */
export default function ExchangeCard({ exchange, onAccept, onDecline }) {
  const router = useRouter();
  const { trustProfile } = useAppSheets();
  const book = { title: exchange.bookTitle, author: exchange.bookAuthor, cov: exchange.cov, photos: exchange.photos };

  if (exchange.status === 'forme' && exchange.stage === 'requested') {
    return (
      <div className="exch-card">
        <div className="exch-top">
          <div className="avatar-sm">{exchange.initials}</div>
          <b style={{ fontSize: 14, flex: 1 }}>{exchange.name} wants your book</b>
          {exchange.isNew && <span className="new-pill">New</span>}
        </div>

        <div className="exch-mini">
          <BookCover book={book} titleSize={8} />
          <div>
            <b style={{ fontSize: 13.5, display: 'block' }}>{exchange.bookTitle}</b>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{exchange.bookAuthor}</div>
            <MiniMeta icon="mapPin">{exchange.loc}</MiniMeta>
            <MiniMeta icon="clock">{timeAgo(exchange.when)}</MiniMeta>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-accept btn-sm" onClick={() => onAccept(exchange)}>Accept</button>
          <button className="btn btn-decline btn-sm" onClick={() => onDecline(exchange)}>Decline</button>
          <button
            className="link-green"
            style={{ marginLeft: 'auto' }}
            onClick={() => trustProfile(exchange.otherUserId, exchange.initials, exchange.name, exchange.bookTitle)}
          >
            View Profile<Icon name="chevronRight" style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>
    );
  }

  const accepted = exchange.status === 'forme' && exchange.stage;
  const done = exchange.status === 'done';

  return (
    <button className="exch-card" onClick={() => router.push(`/exchanges/${exchange.id}`)}>
      <div className="exch-top">
        <div className="avatar-sm">{exchange.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 14, display: 'block' }}>
            {done
              ? `${exchange.bookTitle} with ${exchange.name}`
              : accepted
                ? `${exchange.name}'s request — accepted`
                : exchange.role === 'giver'
                  ? `${exchange.name}'s request to you`
                  : `Your request to ${exchange.name}`}
          </b>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {done ? `Completed ${timeAgo(exchange.when)}` : exchange.bookTitle}
          </span>
        </div>
        {done ? (
          <StatusPill tone="avail" style={{ marginTop: 0 }}>
            {exchange.rating ? `✓ Rated ${exchange.rating}★` : '✓ Completed'}
          </StatusPill>
        ) : (
          <StatusPill tone={exchange.stage === 'requested' ? 'req' : 'avail'} style={{ marginTop: 0 }}>
            {exchange.stage === 'requested' && exchange.role === 'receiver'
              ? 'Pending'
              : STAGE_LABELS[exchange.stage] || 'Pending'}
          </StatusPill>
        )}
      </div>
    </button>
  );
}

function MiniMeta({ icon, children }) {
  if (!children) return null;
  return (
    <div
      style={{
        fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <Icon name={icon} style={{ width: 11, height: 11 }} />
      {children}
    </div>
  );
}
