'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import { useAppData } from '@/contexts/AppDataContext';
import { toggleNotifPanel, toggleCreditPanel } from '@/store/slices/uiSlice';
import { fetchNotifications, markAllRead, unreadCount } from '@/store/slices/notificationSlice';

/** The credit pill + bell + avatar cluster repeated in every main-app header. */
export default function HeaderActions({ avatarHref = '/profile', compact = false }) {
  const dispatch = useDispatch();
  const { credits } = useAppData();
  const unread = useSelector(unreadCount);
  const notifOpen = useSelector((s) => s.ui.isNotifOpen);
  const user = useSelector((s) => s.auth.user);

  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  // Opening the panel counts as seeing them, so the badge clears right away —
  // no need to tap into each notification.
  const openNotifications = () => {
    if (!notifOpen) dispatch(markAllRead());
    dispatch(toggleNotifPanel());
  };

  return (
    <div className="hdr-right">
      <button
        className="credit-pill"
        style={compact ? { padding: 3 } : undefined}
        onClick={() => dispatch(toggleCreditPanel())}
        title={`${credits.available} credits`}
      >
        <span className="credit-num">{credits.available}</span>
        {!compact && 'credits'}
      </button>
      <button
        className="circle-btn"
        onClick={openNotifications}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Icon name="bell" />
        {/* A number only when something is actually unread — no idle dot. */}
        {unread > 0 && <span className="hdr-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <Link href={avatarHref} className="avatar-chip">
        {user?.initials || 'PS'}
      </Link>
    </div>
  );
}
