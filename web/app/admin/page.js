'use client';

import { useEffect } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';

/** Basic totals for users, books and exchanges — the MVP admin dashboard. */
export default function AdminDashboardPage() {
  const { admin, loadAdminDashboard } = useAppData();

  useEffect(() => { loadAdminDashboard().catch(() => {}); }, [loadAdminDashboard]);

  const d = admin.dashboard;
  const maxCount = Math.max(1, ...(d?.exchangesLast7Days || []).map((b) => b.count));

  return (
    <>
      <AdminTopline title="Dashboard" />

      <div className="admin-cards">
        <Card value={(d?.totalUsers ?? 0).toLocaleString()} label="Total Users" />
        <Card value={(d?.totalListings ?? 0).toLocaleString()} label="Books Listed" />
        <Card value={(d?.completedExchanges ?? 0).toLocaleString()} label="Exchanges Completed" />
        <Card value={d?.openReports ?? 0} label="Open Reports" />
      </div>

      <div className="admin-panel">
        <h4>Exchanges Completed — Last 7 Days</h4>
        <div className="bar-chart">
          {(d?.exchangesLast7Days || []).map((b) => (
            <div key={b.day} style={{ height: `${Math.max(4, (b.count / maxCount) * 100)}%` }}><span>{b.day}</span></div>
          ))}
        </div>
      </div>
    </>
  );
}

function Card({ value, label }) {
  return (
    <div className="admin-card">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
