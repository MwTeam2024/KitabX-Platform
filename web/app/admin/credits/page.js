'use client';

import { useEffect, useState } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';

/** Credit ledger + manual correction with a mandatory reason (Simple Super Admin). */
export default function AdminCreditsPage() {
  const showToast = useToast();
  const { admin, loadAdminUsers, loadAdminCreditsLedger, submitAdminCreditCorrection } = useAppData();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: '', amount: '+1', reason: '' });

  useEffect(() => {
    loadAdminUsers();
    loadAdminCreditsLedger();
  }, [loadAdminUsers, loadAdminCreditsLedger]);

  useEffect(() => {
    if (!form.userId && admin.users.length) setForm((f) => ({ ...f, userId: admin.users[0].id }));
  }, [admin.users, form.userId]);

  const selectedUser = admin.users.find((u) => u.id === form.userId);
  const creditsByUserId = new Map(admin.users.map((u) => [u.id, u.credits ?? 0]));

  const apply = async () => {
    const amount = parseInt(form.amount, 10);
    if (!amount) return showToast('Enter a valid non-zero amount, e.g. +1 or -1');
    if (!form.reason.trim()) return showToast('A reason is required for manual corrections');
    const user = admin.users.find((u) => u.id === form.userId);
    try {
      await submitAdminCreditCorrection(form.userId, amount, form.reason.trim());
      setForm((f) => ({ ...f, amount: '+1', reason: '' }));
      setShowForm(false);
      showToast(`Credit correction applied to ${user?.name || 'user'}`);
    } catch (err) {
      showToast(err.message || 'Could not apply this correction');
    }
  };

  return (
    <>
      <AdminTopline title="Credits Ledger">
        <button className="ghost-btn" onClick={() => setShowForm((v) => !v)}>+ Add Correction</button>
      </AdminTopline>

      {showForm && (
        <div className="admin-panel" style={{ marginBottom: 16, maxWidth: 520 }}>
          <h4>Manual Credit Correction</h4>
          <div className="field">
            <label htmlFor="cc-user">User</label>
            <select id="cc-user" value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}>
              {admin.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {selectedUser && (
              <div style={{ fontSize: 12.5, color: 'var(--outer-muted)', marginTop: 4 }}>
                Current balance: <b style={{ color: 'var(--brand-2)' }}>{selectedUser.credits ?? 0} credits</b>
              </div>
            )}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="cc-amount">Change (use − for deduction)</label>
              <input
                id="cc-amount" placeholder="e.g. +1 or -1"
                value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="cc-reason">Reason</label>
              <input
                id="cc-reason" placeholder="e.g. Goodwill credit"
                value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 22px' }} onClick={apply}>
            Apply Correction
          </button>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>User</th><th>Change</th><th>Reason</th><th>Current Balance</th></tr>
          </thead>
          <tbody>
            {admin.creditsLedger.map((row, i) => (
              <tr key={`${row.user}-${i}`}>
                <td>{row.user}</td>
                <td style={{ color: row.positive ? 'var(--brand-2)' : 'var(--sindoor)' }}>{row.change}</td>
                <td>{row.reason}</td>
                <td>{creditsByUserId.has(row.userId) ? `${creditsByUserId.get(row.userId)} credits` : '—'}</td>
              </tr>
            ))}
            {!admin.creditsLedger.length && (
              <tr><td colSpan={4} style={{ color: 'var(--outer-muted)' }}>No manual corrections yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
