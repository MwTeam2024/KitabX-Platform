'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/ui/EmptyState';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useAppData } from '@/contexts/AppDataContext';
import { useAppSheets } from '@/hooks/useAppSheets';
import { useToast } from '@/components/ui/ToastProvider';
import { useSheet } from '@/components/ui/SheetProvider';
import { containsPhoneNumber, redactPhoneNumbers } from '@/lib/privacy';
import { getSocket } from '@/lib/socket';

const QUICK_REPLIES = [
  'Is it still available?',
  'I can pick it up today 👍',
  'Let’s meet at the gate',
  'Thanks!',
];

/**
 * Request-linked chat (§14). Quick replies, exchange system messages and the
 * pickup shortcut all come from the source plan; phone numbers are redacted.
 */
export default function ChatThread({ threadId }) {
  const router = useRouter();
  const showToast = useToast();
  const { chatThreads, exchanges, refreshChatThreads, loadThreadMessages, sendMessage, appendMessage, deleteThread } = useAppData();
  const { reportUser } = useAppSheets();
  const { openSheet, closeSheet } = useSheet();
  const sessionUser = useSelector((s) => s.auth.user);
  const [text, setText] = useState('');
  const bodyRef = useRef(null);

  const thread = chatThreads.find((t) => t.id === threadId);
  const exchange = useMemo(
    () => exchanges.find((e) => e.id === thread?.requestId),
    [exchanges, thread?.requestId],
  );

  useEffect(() => {
    if (!chatThreads.length) refreshChatThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (thread && thread.messages === null) loadThreadMessages(thread.id);
  }, [thread, loadThreadMessages]);

  // Live delivery over the self-hosted Socket.IO gateway; REST above only
  // covers history + the fallback send path.
  useEffect(() => {
    if (!thread) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    if (!socket.connected) socket.connect();

    const onNew = (msg) => {
      if (msg.conversationId !== thread.id || msg.senderId === sessionUser?.id) return;
      appendMessage(thread.id, { id: msg.id, from: 'them', text: msg.text, createdAt: msg.createdAt });
    };
    socket.emit('thread:join', thread.id);
    socket.on('message:new', onNew);
    return () => {
      socket.emit('thread:leave', thread.id);
      socket.off('message:new', onNew);
    };
  }, [thread?.id, appendMessage, sessionUser?.id]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [thread?.messages?.length]);

  if (!thread) {
    return (
      <>
        <ScreenHeader back backHref="/chat" title="Chat" />
        <div className="app-scroll">
          <EmptyState
            icon="💬"
            title="This conversation is no longer available."
            action={<button className="btn btn-primary" onClick={() => router.push('/chat')}>Back to Messages</button>}
          />
        </div>
      </>
    );
  }

  const send = async (value) => {
    const message = (value ?? text).trim();
    if (!message) return;
    if (containsPhoneNumber(message)) {
      showToast('Phone numbers are hidden in chat — arrange pickup here instead');
    }
    setText('');
    try {
      await sendMessage(thread.id, redactPhoneNumbers(message));
    } catch (err) {
      showToast(err.message || 'Message could not be sent');
    }
  };

  const confirmDelete = () => {
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
              router.push('/chat');
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

  return (
    <div className="thread-overlay">
      <header className="hdr" style={{ borderRadius: 0, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="circle-btn" onClick={() => router.push('/chat')} aria-label="Back to messages">
            <Icon name="arrowLeft" />
          </button>
          <div className="avatar-sm" style={{ background: 'var(--mint)', color: 'var(--brand-2)' }}>
            {thread.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ color: 'var(--text)', fontSize: 14, display: 'block' }}>
              {thread.name} — Re: {thread.bookTitle}
            </b>
          </div>
          <button
            className="circle-btn"
            onClick={confirmDelete}
            aria-label="Delete this conversation"
          >
            <Icon name="trash" style={{ width: 15, height: 15 }} />
          </button>
          <button
            className="circle-btn"
            onClick={() => reportUser(thread.otherUserId, thread.name, thread.bookTitle)}
            aria-label={`Block or report ${thread.name}`}
          >
            <Icon name="flag" style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </header>

      <div className="thread-body" ref={bodyRef}>
        <div className="datepill">Today</div>

        {exchange && (
          <div className="datepill" style={{ maxWidth: '90%', textAlign: 'center', lineHeight: 1.5 }}>
            Exchange update: {exchange.bookTitle} — {exchange.stage || 'requested'}
          </div>
        )}

        {thread.messages === null ? (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', padding: 20 }}>Loading messages…</div>
        ) : thread.messages.map((m) => (
          <div className={`bubble ${m.from === 'me' ? 'sent' : 'recv'}`} key={m.id}>
            {redactPhoneNumbers(m.text)}
            {m.from === 'me' && m.createdAt && (
              <div className="bmeta">{new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ✓✓</div>
            )}
          </div>
        ))}
      </div>

      {/* Quick replies are always available; the pickup shortcut needs a live exchange. */}
      <div className="chiprow" style={{ padding: '10px 14px 0', flexShrink: 0 }}>
        {exchange && (
          <button className="chip" onClick={() => router.push(`/exchanges/${exchange.id}/pickup`)}>
            <Icon name="clock" style={{ width: 12, height: 12, marginRight: 4 }} />Schedule pickup
          </button>
        )}
        {QUICK_REPLIES.map((q) => (
          <button className="chip" key={q} onClick={() => send(q)}>{q}</button>
        ))}
      </div>

      <div className="thread-input">
        <button className="clip" onClick={() => showToast('Photo sharing is coming soon')} aria-label="Attach a photo">
          <Icon name="paperclip" />
        </button>
        <input
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          aria-label="Message"
        />
        <button className="thread-send" onClick={() => send()} aria-label="Send message">
          <Icon name="send" />
        </button>
      </div>
    </div>
  );
}
