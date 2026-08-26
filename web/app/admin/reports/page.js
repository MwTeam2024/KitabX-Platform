'use client';

import { useEffect } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { timeAgo } from '@/lib/dates';

const TYPE_LABELS = {
  TECHNICAL_BUG: 'Bug',
  SUPPORT: 'Support',
  ACCOUNT: 'Account',
  OTHER: 'Other',
};

const TYPE_STYLE = {
  TECHNICAL_BUG: { background: 'var(--purple-soft)', color: 'var(--purple)' },
  SUPPORT: { background: 'var(--mint)', color: 'var(--brand-2)' },
  ACCOUNT: { background: 'var(--orange-soft)', color: 'var(--orange)' },
  OTHER: { background: 'var(--line-outer)', color: 'var(--outer-text)' },
};

/**
 * Webapp/bug reports only (§14/§19 — Task 25) — submitted via the in-app
 * "Report a bug" field, backed by `SupportRequest`. Reports against a user
 * or a listing live in Book Moderation instead (Task 24).
 */
export default function AdminReportsPage() {
  const showToast = useToast();
  const { admin, loadAdminReports, resolveAdminReport } = useAppData();

  useEffect(() => { loadAdminReports(); }, [loadAdminReports]);

  return (
    <>
      <AdminTopline title="Reports" />

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reported By</th><th>Type</th><th>Screen / Subject</th><th>Message</th>
              <th>Status</th><th>When</th><th />
            </tr>
          </thead>
          <tbody>
            {admin.reports.map((r) => (
              <tr key={r.id}>
                <td>{r.user}</td>
                <td><span className="pill-tag" style={TYPE_STYLE[r.type] || TYPE_STYLE.OTHER}>{TYPE_LABELS[r.type] || r.type}</span></td>
                <td>{r.subject || '—'}</td>
                <td style={{ maxWidth: 260, whiteSpace: 'normal' }}>{r.description}</td>
                <td>
                  {r.status === 'OPEN' ? (
                    <span className="status-pill" style={{ background: 'var(--sindoor-soft)', color: 'var(--sindoor)' }}>
                      Open
                    </span>
                  ) : (
                    <span className="status-pill st-avail">Resolved</span>
                  )}
                </td>
                <td>{timeAgo(r.createdAt)}</td>
                <td>
                  {r.status === 'OPEN' ? (
                    <button
                      className="ghost-btn sm"
                      onClick={async () => {
                        try {
                          await resolveAdminReport(r.id);
                          showToast('Report marked as resolved');
                        } catch (err) {
                          showToast(err.message || 'Could not resolve this report');
                        }
                      }}
                    >Resolve</button>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {!admin.reports.length && (
              <tr><td colSpan={7} style={{ color: 'var(--outer-muted)' }}>No reports filed.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
