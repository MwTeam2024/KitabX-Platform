'use client';

import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import Icon from './Icon';
import { closePanels } from '@/store/slices/uiSlice';
import { markRead, deleteNotification, clearAllNotifications } from '@/store/slices/notificationSlice';
import { timeAgo } from '@/lib/dates';

export default function NotifDropdown() {
  const dispatch = useDispatch();
  const router = useRouter();
  const isOpen = useSelector((s) => s.ui.isNotifOpen);
  const items = useSelector((s) => s.notification.items);

  if (!isOpen) return null;

  const goTo = (n) => {
    dispatch(markRead(n.id));
    dispatch(closePanels());
    if (n.href) router.push(n.href);
  };

  return (
    <div className="notif-dropdown open">
      <div className="notif-backdrop" onClick={() => dispatch(closePanels())} />
      <div className="notif-panel">
        <div className="notif-panel-head">
          <h3>Notifications</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {items.length > 0 && (
              <button
                className="link-green"
                style={{ fontSize: 12 }}
                onClick={() => dispatch(clearAllNotifications())}
              >
                Clear all
              </button>
            )}
            <button className="sheet-x" onClick={() => dispatch(closePanels())} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
        </div>
        {items.map((n) => (
          <div
            key={n.id}
            className={`notif-item${n.gold ? ' gold' : ''}`}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={() => goTo(n)}
            onKeyDown={(e) => e.key === 'Enter' && goTo(n)}
          >
            <span className="nem">{n.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{n.title}</b>
              <span>{timeAgo(n.time)} · Tap to view ›</span>
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
        ))}
      </div>
    </div>
  );
}
