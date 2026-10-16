'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import { useAppData } from '@/contexts/AppDataContext';
import { toggleNotifPanel, toggleCreditPanel } from '@/store/slices/uiSlice';
import { fetchNotifications, markAllRead, unreadCount } from '@/store/slices/notificationSlice';
import { useToast } from '@/components/ui/ToastProvider';
import { useSheet } from '@/components/ui/SheetProvider';
import { shareReferral } from '@/lib/shareReferral';

const INVITE_SEEN_KEY = 'kitabx.inviteHintSeen';

function inviteHintSeen() {
  try {
    return window.localStorage.getItem(INVITE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** A gold coin with an open book on it — on its own it reads as "book credits", so the pill needs no word. */
function CreditCoin() {
  return (
    <svg className="credit-coin" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11" fill="#F6C543" stroke="#C98E12" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#C98E12" strokeWidth="1" opacity=".55" />
      <path
        d="M7.2 8.6c1.7-.5 3.3-.3 4.8.8 1.5-1.1 3.1-1.3 4.8-.8v6.9c-1.7-.5-3.3-.3-4.8.8-1.5-1.1-3.1-1.3-4.8-.8z M12 9.4v6.9"
        fill="none"
        stroke="#8A5E0A"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** What inviting a friend is worth, before any share sheet opens. */
function InviteSheet({ onShare }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div className="menu-ic round" style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)', flexShrink: 0 }}>
          <Icon name="gift" />
        </div>
        <b style={{ fontSize: 15 }}>Get 1 free credit for every friend who joins!</b>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Share your invite link. When your friend signs up with it, you both get 1 free credit — enough to request a book from a neighbour.
      </p>
      <button className="btn btn-primary" onClick={onShare}>
        <Icon name="share" style={{ width: 14, height: 14 }} />Share my invite link
      </button>
    </>
  );
}

/** The credit pill + share + bell + avatar cluster repeated in every main-app header. */
export default function HeaderActions({ avatarHref = '/profile' }) {
  const dispatch = useDispatch();
  const { credits } = useAppData();
  const showToast = useToast();
  const { openSheet, closeSheet } = useSheet();
  const unread = useSelector(unreadCount);
  const notifOpen = useSelector((s) => s.ui.isNotifOpen);
  const user = useSelector((s) => s.auth.user);
  const [hintSeen, setHintSeen] = useState(inviteHintSeen);

  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  // Opening the panel counts as seeing them, so the badge clears right away —
  // no need to tap into each notification.
  const openNotifications = () => {
    if (!notifOpen) dispatch(markAllRead());
    dispatch(toggleNotifPanel());
  };

  const share = async () => {
    closeSheet();
    const result = await shareReferral(user?.referralCode);
    if (result === 'copied') showToast('Referral link copied — share it to earn 1 credit!');
    else if (result === 'failed') showToast('Could not share right now — try again');
  };

  // The share icon first explains what's in it for them; the tag above the
  // icon ("Earn +1") invites that look, and goes away once they've had it.
  const openInvite = () => {
    try {
      window.localStorage.setItem(INVITE_SEEN_KEY, '1');
    } catch {
      // Storage blocked — the tag just shows again next visit.
    }
    setHintSeen(true);
    openSheet('Invite a friend', <InviteSheet onShare={share} />);
  };

  return (
    <div className="hdr-right">
      <button
        className="credit-pill"
        data-tour="credits"
        onClick={() => dispatch(toggleCreditPanel())}
        aria-label={`${credits.available} credits`}
        title={`${credits.available} credits`}
      >
        <CreditCoin />
        <span className="credit-count">{credits.available}</span>
      </button>
      <div className="share-wrap" data-tour="share">
        <button className="circle-btn" onClick={openInvite} aria-label="Invite a friend — earn 1 credit">
          <Icon name="share" />
        </button>
        {!hintSeen && <span className="share-tag" aria-hidden="true">Earn +1</span>}
      </div>
      <button
        className="circle-btn"
        data-tour="notifications"
        onClick={openNotifications}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Icon name="bell" />
        {/* A number only when something is actually unread — no idle dot. */}
        {unread > 0 && <span className="hdr-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <Link href={avatarHref} className="avatar-chip" style={{ overflow: 'hidden', padding: 0 }}>
        {user?.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.profileImageUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          user?.initials || ''
        )}
      </Link>
    </div>
  );
}
