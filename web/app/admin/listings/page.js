'use client';

import { useEffect, useState } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { timeAgo } from '@/lib/dates';

const REASON_LABELS = {
  FAKE_DUPLICATE_LISTING: 'Fake or duplicate listing',
  INCORRECT_CONDITION: 'Incorrect condition',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  HARASSMENT: 'Harassment',
  NO_RESPONSE_NO_SHOW: 'No response or no-show',
  CREDIT_PROBLEM: 'Credit problem',
  OTHER: 'Other',
};

/**
 * Book Moderation (§14/§19) — every report against a listing or a member,
 * consolidated here instead of scattered across the general Reports section
 * (which is bug/support-request only, per Task 25). Two tabs since the two
 * report shapes need different columns (a book vs. a reported member).
 */
export default function AdminListingsPage() {
  const showToast = useToast();
  const { admin, loadAdminFlaggedListings, removeFlaggedListing, loadAdminFlaggedUsers, resolveFlaggedUser } = useAppData();
  const [tab, setTab] = useState('listings'); // 'listings' | 'users'

  useEffect(() => { loadAdminFlaggedListings(); loadAdminFlaggedUsers(); }, [loadAdminFlaggedListings, loadAdminFlaggedUsers]);

  return (
    <>
      <AdminTopline title="Book Moderation" />

      <div className="admin-tabs" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          className={tab === 'listings' ? 'ghost-btn sm active' : 'ghost-btn sm'}
          onClick={() => setTab('listings')}
        >
          Listing Reports ({admin.flaggedListings.length})
        </button>
        <button
          className={tab === 'users' ? 'ghost-btn sm active' : 'ghost-btn sm'}
          onClick={() => setTab('users')}
        >
          User Reports ({admin.flaggedUsers.length})
        </button>
      </div>

      {tab === 'listings' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Book</th><th>Owner</th><th>Reported By</th><th>Reason</th><th>Message</th><th>When</th><th /></tr>
            </thead>
            <tbody>
              {admin.flaggedListings.map((b) => (
                <tr key={b.reportId}>
                  <td>{b.title}</td>
                  <td>{b.owner}</td>
                  <td>{b.reporter}</td>
                  <td>{REASON_LABELS[b.reason] || b.reason}</td>
                  <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>{b.message || '—'}</td>
                  <td>{timeAgo(b.createdAt)}</td>
                  <td>
                    <button
                      className="ghost-btn sm"
                      onClick={async () => {
                        try {
                          await removeFlaggedListing(b.listingId);
                          showToast(`"${b.title}" removed — taken down from Discover and every shelf`);
                        } catch (err) {
                          showToast(err.message || 'Could not remove this listing');
                        }
                      }}
                    >Remove</button>
                  </td>
                </tr>
              ))}
              {!admin.flaggedListings.length && (
                <tr><td colSpan={7} style={{ color: 'var(--outer-muted)' }}>No flagged listings. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Reported</th><th>Reported By</th><th>Reason</th><th>Message</th><th>When</th><th /></tr>
            </thead>
            <tbody>
              {admin.flaggedUsers.map((r) => (
                <tr key={r.reportId}>
                  <td>{r.reportedUser}</td>
                  <td>{r.reporter}</td>
                  <td>{REASON_LABELS[r.reason] || r.reason}</td>
                  <td style={{ maxWidth: 220, whiteSpace: 'normal' }}>{r.message || '—'}</td>
                  <td>{timeAgo(r.createdAt)}</td>
                  <td>
                    <button
                      className="ghost-btn sm"
                      onClick={async () => {
                        try {
                          await resolveFlaggedUser(r.reportId);
                          showToast('Report marked as resolved');
                        } catch (err) {
                          showToast(err.message || 'Could not resolve this report');
                        }
                      }}
                    >Resolve</button>
                  </td>
                </tr>
              ))}
              {!admin.flaggedUsers.length && (
                <tr><td colSpan={6} style={{ color: 'var(--outer-muted)' }}>No reports against members. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
