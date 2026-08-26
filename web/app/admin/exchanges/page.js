'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';
import { timeAgo } from '@/lib/dates';

/** §40 — exactly these 4 tabs, no "All": Active (any currently listed,
 * available book), In Process (pickup scheduled/confirmed), Cancelled
 * (specifically after a pickup had already been scheduled), Completed
 * (final handover done). */
const TABS = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'IN_PROCESS', label: 'In Process' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'COMPLETED', label: 'Completed' },
];

/** Listing + exchange activity across the platform (read-only in the MVP). */
export default function AdminExchangesPage() {
  const { admin, loadAdminExchanges } = useAppData();
  const [tab, setTab] = useState('ACTIVE');

  useEffect(() => { loadAdminExchanges(); }, [loadAdminExchanges]);

  const rows = useMemo(
    () => admin.exchanges.filter((e) => e.stage === tab),
    [admin.exchanges, tab],
  );

  return (
    <>
      <AdminTopline title="Listings & Exchanges" />

      <div className="admin-tabs" style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'ghost-btn sm active' : 'ghost-btn sm'}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({admin.exchanges.filter((e) => e.stage === t.key).length})
          </button>
        ))}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Book</th><th>Author</th><th>Genre</th><th>Condition</th><th>Listed By</th>
              <th>From → To</th><th>Status</th><th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{e.book}</td>
                <td>{e.author || '—'}</td>
                <td>{e.genre || '—'}</td>
                <td>{e.condition || '—'}</td>
                <td>{e.listedBy}</td>
                <td>{e.from} → {e.to}</td>
                <td>{e.status}</td>
                <td>{timeAgo(e.when)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={8} style={{ color: 'var(--outer-muted)' }}>No listings/exchanges in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
