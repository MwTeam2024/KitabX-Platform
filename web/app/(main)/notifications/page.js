'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import BottomNav from '@/components/layout/BottomNav';
import EmptyState from '@/components/ui/EmptyState';
import NoteBox, { SectionTitle } from '@/components/ui/NoteBox';
import {
  fetchNotifications, markRead, setPushPermission,
  deleteNotification, clearAllNotifications,
} from '@/store/slices/notificationSlice';
import { useToast } from '@/components/ui/ToastProvider';
import { requestPushPermission } from '@/lib/firebase';
import { timeAgo } from '@/lib/dates';

/**
 * Notification centre (§15). The database record is the history; FCM only
 * delivers the push, so read/unread state lives here rather than in the push.
 */
export default function NotificationsPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const showToast = useToast();
  const { items, pushPermission } = useSelector((s) => s.notification);

  useEffect(() => { dispatch(fetchNotifications()); }, [dispatch]);

  const enablePush = async () => {
    const result = await requestPushPermission().catch(() => 'denied');
    dispatch(setPushPermission(result));
    showToast(
      result === 'granted'
        ? 'Push notifications enabled'
        : 'Push permission denied — you can still see everything here',
    );
  };

  const open = (n) => {
    dispatch(markRead(n.id));
    if (n.href) router.push(n.href);
  };

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <>
      <ScreenHeader
        back
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You’re all caught up'}
        right={
          items.length ? (
            <button
              className="link-green"
              style={{ fontSize: 12 }}
              onClick={() => dispatch(clearAllNotifications())}
            >
              Clear all
            </button>
          ) : null
        }
      />

      <div className="app-scroll">
        {pushPermission !== 'granted' && (
          <NoteBox icon="bell" style={{ margin: '14px 16px' }}>
            <b>Turn on push notifications</b>
            <br />
            Get told the moment a request arrives or a pickup changes.{' '}
            <button className="link-green" style={{ fontSize: 12 }} onClick={enablePush}>
              {pushPermission === 'denied' ? 'Try again' : 'Enable'}
            </button>
          </NoteBox>
        )}

        <div className="section-row">
          <SectionTitle size={16}>Recent activity</SectionTitle>
        </div>

        <div className="pad-nav" style={{ marginTop: 8 }}>
          {items.length ? items.map((n) => (
            <div
              key={n.id}
              className={`notif-item${n.gold ? ' gold' : ''}`}
              role="button"
              tabIndex={0}
              style={{ opacity: n.isRead ? 0.62 : 1, cursor: 'pointer' }}
              onClick={() => open(n)}
              onKeyDown={(e) => e.key === 'Enter' && open(n)}
            >
              <span className="nem">{n.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{n.title}</b>
                {n.body && (
                  <div style={{ fontSize: 12, color: 'var(--text)', margin: '2px 0 3px', lineHeight: 1.4 }}>
                    {n.body}
                  </div>
                )}
                <span>{timeAgo(n.time)}{n.href ? ' · Tap to view ›' : ''}</span>
              </div>
              <button
                className="circle-btn"
                style={{ width: 24, height: 24, flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); dispatch(deleteNotification(n.id)); }}
                aria-label="Delete this notification"
              >
                <Icon name="x" style={{ width: 11, height: 11 }} />
              </button>
            </div>
          )) : (
            <EmptyState icon="🔔" title="Nothing new yet." hint="Requests, pickups and wishlist matches show up here." />
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
