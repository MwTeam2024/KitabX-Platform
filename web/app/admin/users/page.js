'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { useDebounce } from '@/hooks/useDebounce';

const STATUS_STYLE = {
  active: { color: 'var(--brand-2)', label: 'Active' },
  pending: { color: 'var(--gold-deep)', label: 'Pending approval' },
  suspended: { color: 'var(--sindoor)', label: 'Suspended' },
  rejected: { color: 'var(--text-muted)', label: 'Rejected' },
};

/** View/search users, approve, suspend or reactivate — the MVP admin controls. */
export default function AdminUsersPage() {
  const showToast = useToast();
  const { admin, loadAdminUsers, setUserVerification, setUserSuspension, approveAdminUser, rejectAdminUser } = useAppData();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => { loadAdminUsers(debouncedQuery).catch(() => {}); }, [debouncedQuery, loadAdminUsers]);

  const rows = useMemo(() => admin.users, [admin.users]);

  return (
    <>
      <AdminTopline title="Users">
        <button className="ghost-btn" onClick={() => showToast('Exporting users.csv…')}>Export CSV</button>
      </AdminTopline>

      <div className="field" style={{ maxWidth: 320, marginBottom: 14 }}>
        <input
          placeholder="Search users by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search users"
        />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Email</th><th>Member ID</th><th>Society</th><th>Rating</th>
              <th>Verification</th><th>Account</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const status = STATUS_STYLE[u.status] || STATUS_STYLE.active;
              return (
                <tr key={u.id} style={{ opacity: u.status === 'rejected' ? 0.45 : 1 }}>
                  <td>{u.name}</td>
                  <td>{u.phone}</td>
                  <td>{u.email || '—'}</td>
                  <td>{u.memberId}</td>
                  <td>{u.society?.name || '—'}</td>
                  <td>{u.rating != null ? `${u.rating}★` : '—'}</td>
                  <td>{u.verified ? 'Verified' : 'Not verified'}</td>
                  <td style={{ color: status.color, fontWeight: 600 }}>{status.label}</td>
                  <td>
                    <div className="admin-actions">
                      {u.status === 'pending' ? (
                        <>
                          <button
                            className="ghost-btn sm"
                            onClick={async () => {
                              try { await approveAdminUser(u.id); showToast(`${u.name} approved`); }
                              catch (err) { showToast(err.message || 'Could not approve this user'); }
                            }}
                          >Approve</button>
                          <button
                            className="ghost-btn sm"
                            style={{ color: 'var(--sindoor)' }}
                            onClick={async () => {
                              try { await rejectAdminUser(u.id); showToast(`${u.name}'s signup was rejected`); }
                              catch (err) { showToast(err.message || 'Could not reject this user'); }
                            }}
                          >Reject</button>
                        </>
                      ) : u.status === 'rejected' ? (
                        <span style={{ fontSize: 11, color: 'var(--outer-muted)' }}>Rejected</span>
                      ) : (
                        <>
                          <button
                            className="ghost-btn sm"
                            onClick={async () => {
                              try {
                                await setUserVerification(u.id, !u.verified);
                                showToast(`${u.name} has been ${u.verified ? 'un-verified' : 'verified'}`);
                              } catch (err) { showToast(err.message || 'Could not update verification'); }
                            }}
                          >{u.verified ? 'Unverify' : 'Verify'}</button>
                          <button
                            className="ghost-btn sm"
                            onClick={async () => {
                              const suspended = u.status !== 'suspended';
                              try {
                                await setUserSuspension(u.id, suspended);
                                showToast(`${u.name} ${suspended ? 'suspended' : 'reactivated'}`);
                              } catch (err) { showToast(err.message || 'Could not update this account'); }
                            }}
                          >{u.status === 'suspended' ? 'Reactivate' : 'Suspend'}</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={8} style={{ color: 'var(--outer-muted)' }}>No users match “{query}”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
