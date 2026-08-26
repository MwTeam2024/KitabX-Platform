'use client';

import { useEffect } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { timeAgo } from '@/lib/dates';

/**
 * Account Deletion Requests (§14/§19 — Task 26) — a member's own "Request
 * account deletion" (Profile Settings) only ever set `User.deletionRequestedAt`
 * with no admin-facing view anywhere; this is that view.
 */
export default function AdminDeletionRequestsPage() {
  const showToast = useToast();
  const { admin, loadAdminDeletionRequests, actionAdminDeletionRequest, rejectAdminDeletionRequest } = useAppData();

  useEffect(() => { loadAdminDeletionRequests(); }, [loadAdminDeletionRequests]);

  return (
    <>
      <AdminTopline title="Account Deletion Requests" />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Member</th><th>Phone</th><th>Member ID</th><th>Requested</th><th /></tr>
          </thead>
          <tbody>
            {admin.deletionRequests.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.phone}</td>
                <td>{r.memberId}</td>
                <td>{timeAgo(r.requestedAt)}</td>
                <td>
                  <div className="admin-actions">
                    <button
                      className="ghost-btn sm"
                      style={{ color: 'var(--sindoor)' }}
                      onClick={async () => {
                        try {
                          await actionAdminDeletionRequest(r.id);
                          showToast(`${r.name}'s account has been deleted`);
                        } catch (err) {
                          showToast(err.message || 'Could not delete this account');
                        }
                      }}
                    >Delete</button>
                    <button
                      className="ghost-btn sm"
                      onClick={async () => {
                        try {
                          await rejectAdminDeletionRequest(r.id);
                          showToast(`${r.name}'s deletion request was declined`);
                        } catch (err) {
                          showToast(err.message || 'Could not reject this request');
                        }
                      }}
                    >Reject</button>
                  </div>
                </td>
              </tr>
            ))}
            {!admin.deletionRequests.length && (
              <tr><td colSpan={5} style={{ color: 'var(--outer-muted)' }}>No pending deletion requests. 🎉</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
