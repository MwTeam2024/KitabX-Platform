'use client';

import Icon from '@/components/ui/Icon';
import { BookCover } from '@/components/books/BookCover';

/**
 * Book + partner summary. Chat (§14) is switched off for now — see
 * chat.module.js — so this shows a WhatsApp deep-link instead once the
 * owner has accepted the request (`exchange.otherPhone` is only ever
 * populated by the backend from that point on, same gating as the exact
 * address elsewhere). Not commented out: `openThreadForExchange` is still
 * exported from AppDataContext for when chat comes back — this component's
 * old chat-button version is what actually used it.
 */
export default function ExchangePartnerCard({ exchange }) {
  const waLink = exchange.otherPhone
    ? `https://wa.me/${exchange.otherPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, about "${exchange.bookTitle}" on KitabX`)}`
    : null;

  return (
    <div className="exch-mini" style={{ marginBottom: 16 }}>
      <BookCover
        book={{ title: exchange.bookTitle, cov: exchange.cov, photos: exchange.photos }}
        titleSize={8}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 14, display: 'block' }}>{exchange.bookTitle}</b>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{exchange.bookAuthor}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <div className="avatar-sm" style={{ width: 22, height: 22, fontSize: 9 }}>{exchange.initials}</div>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{exchange.name}</span>
        </div>
      </div>
      {waLink && (
        <a
          className="circle-btn"
          style={{ background: 'var(--mint)', color: 'var(--brand-2)' }}
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${exchange.name}`}
        >
          <Icon name="whatsapp" style={{ width: 16, height: 16 }} />
        </a>
      )}
    </div>
  );
}
