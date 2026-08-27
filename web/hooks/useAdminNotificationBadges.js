'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminService } from '@/services/admin.service';
import { useInterval } from './useInterval';

const STORAGE_KEYS = {
  users: 'kitabx_admin_seen_users',
  reports: 'kitabx_admin_seen_reports',
  listings: 'kitabx_admin_seen_listings',
  deletionRequests: 'kitabx_admin_seen_deletion_requests',
  societies: 'kitabx_admin_seen_societies',
};

const POLL_MS = 30000;

/** "Since when has this admin last opened each of the 3 badged tabs" —
 * client-tracked so no server-side "seen" state is needed. First-ever visit
 * seeds "now" for all three so a fresh admin console doesn't show every
 * historical pending user/report as "new" on day one. */
function getSeenAt(key) {
  if (typeof window === 'undefined') return null;
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = new Date().toISOString();
    window.localStorage.setItem(key, value);
  }
  return value;
}

const TAB_COUNT_KEY = {
  users: 'newUsers',
  reports: 'newReports',
  listings: 'newModeration',
  deletionRequests: 'newDeletionRequests',
  societies: 'newLocationRequests',
};

/** Task 30 (+Task 41 for deletion requests, city/society requests) —
 * numbered badges for Users (new registrations), Reports (bug/support
 * requests), Book Moderation (listing + user reports), Account Deletion
 * Requests and Societies (pending city/society requests), clearing the
 * moment the admin opens that section. */
export function useAdminNotificationBadges(pathname) {
  const [counts, setCounts] = useState({
    newUsers: 0, newReports: 0, newModeration: 0, newDeletionRequests: 0, newLocationRequests: 0,
  });

  const refresh = useCallback(async () => {
    try {
      const result = await adminService.notificationCounts({
        usersSince: getSeenAt(STORAGE_KEYS.users),
        reportsSince: getSeenAt(STORAGE_KEYS.reports),
        moderationSince: getSeenAt(STORAGE_KEYS.listings),
        deletionRequestsSince: getSeenAt(STORAGE_KEYS.deletionRequests),
        locationRequestsSince: getSeenAt(STORAGE_KEYS.societies),
      });
      setCounts(result);
    } catch {
      // Badge counts are a nice-to-have — a failed poll just leaves the last known values.
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useInterval(refresh, POLL_MS);

  const markSeen = useCallback((tab) => {
    const key = STORAGE_KEYS[tab];
    const countKey = TAB_COUNT_KEY[tab];
    if (!key || !countKey) return;
    window.localStorage.setItem(key, new Date().toISOString());
    setCounts((c) => ({ ...c, [countKey]: 0 }));
  }, []);

  // Clear the badge for whichever section the admin just navigated into.
  useEffect(() => {
    if (pathname === '/admin/users') markSeen('users');
    else if (pathname === '/admin/reports') markSeen('reports');
    else if (pathname === '/admin/listings') markSeen('listings');
    else if (pathname === '/admin/deletion-requests') markSeen('deletionRequests');
    else if (pathname === '/admin/societies') markSeen('societies');
  }, [pathname, markSeen]);

  return counts;
}
