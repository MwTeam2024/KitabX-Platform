'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { BookCover } from '@/components/books/BookCover';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';

/** Book + partner summary with the chat shortcut required by §14. */
export default function ExchangePartnerCard({ exchange }) {
  const router = useRouter();
  const showToast = useToast();
  const { openThreadForExchange } = useAppData();

  const openChat = async () => {
    const threadId = await openThreadForExchange(exchange.id);
    if (!threadId) return showToast('Conversation not available yet');
    router.push(`/chat/${threadId}`);
  };

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
      <button
        className="circle-btn"
        style={{ background: 'var(--mint)', color: 'var(--brand-2)' }}
        onClick={openChat}
        aria-label={`Message ${exchange.name}`}
      >
        <Icon name="messageCircle" style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}
