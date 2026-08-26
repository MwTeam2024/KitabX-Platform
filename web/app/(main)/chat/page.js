'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import BottomNav from '@/components/layout/BottomNav';
import EmptyState from '@/components/ui/EmptyState';
import { SectionTitle } from '@/components/ui/NoteBox';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { useSheet } from '@/components/ui/SheetProvider';
import { timeAgo } from '@/lib/dates';

/** Screen 18 — request-linked conversations with unread counts (§14). */
export default function ChatListPage() {
  const router = useRouter();
  const showToast = useToast();
  const { chatThreads, refreshChatThreads, deleteThread } = useAppData();
  const { openSheet, closeSheet } = useSheet();
  const [newestFirst, setNewestFirst] = useState(true);

  const confirmDelete = (thread) => {
    openSheet('Delete conversation', (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
          This removes the conversation with {thread.name} from your Messages. {thread.name} will still see their
          side of it, and it reappears here if they send you a new message.
        </p>
        <button
          className="btn btn-outline danger"
          onClick={async () => {
            try {
              await deleteThread(thread.id);
              closeSheet();
            } catch (err) {
              showToast(err.message || 'Could not delete this conversation');
            }
          }}
        >
          <Icon name="trash" style={{ width: 15, height: 15 }} />Delete conversation
        </button>
      </>
    ));
  };

  useEffect(() => { refreshChatThreads().catch(() => {}); }, [refreshChatThreads]);

  const threads = useMemo(
    () => (newestFirst ? chatThreads : [...chatThreads].reverse()),
    [chatThreads, newestFirst],
  );

  return (
    <>
      <ScreenHeader right={<HeaderActions />} />

      <div className="app-scroll">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '16px 16px 4px' }}>
          <div>
            <SectionTitle tick={false}>Messages</SectionTitle>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
              Your conversations and updates
            </div>
          </div>
          <button
            className="btn btn-white btn-sm"
            style={{ boxShadow: 'var(--shadow-sm)' }}
            onClick={() => {
              setNewestFirst((v) => !v);
              showToast(`Sorted by ${newestFirst ? 'oldest' : 'newest'} first`);
            }}
          >
            <Icon name="sliders" style={{ width: 12, height: 12 }} />
            {newestFirst ? 'Newest' : 'Oldest'}
          </button>
        </div>

        <div className="pad-nav" style={{ marginTop: 14 }}>
          {threads.length ? threads.map((t) => {
            return (
              <div
                key={t.id}
                className="list-row"
                role="button"
                tabIndex={0}
                style={{ opacity: t.disabled ? 0.7 : 1, cursor: 'pointer' }}
                onClick={() => router.push(`/chat/${t.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && router.push(`/chat/${t.id}`)}
              >
                <div className="avatar-sm">{t.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13.5 }}>{t.name}</b>
                  <div
                    style={{
                      fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    Re: {t.bookTitle}{t.lastMessage ? ` — ${t.lastMessage}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: t.unread ? 'var(--brand-2)' : 'var(--text-faint)',
                      fontWeight: t.unread ? 600 : 400,
                    }}
                  >
                    {timeAgo(t.time)}
                  </div>
                  {t.unread > 0 && (
                    <div
                      style={{
                        width: 20, height: 20, borderRadius: '50%', background: 'var(--brand)', color: '#fff',
                        fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '4px 0 0 auto',
                      }}
                    >
                      {t.unread}
                    </div>
                  )}
                </div>
                <button
                  className="circle-btn"
                  style={{ width: 28, height: 28, flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); confirmDelete(t); }}
                  aria-label={`Delete conversation with ${t.name}`}
                >
                  <Icon name="trash" style={{ width: 13, height: 13 }} />
                </button>
              </div>
            );
          }) : (
            <EmptyState
              icon="💬"
              title="No conversations yet."
              hint="Chat opens automatically when you request a book."
              action={<button className="btn btn-primary" onClick={() => router.push('/home')}>Find a book</button>}
            />
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
