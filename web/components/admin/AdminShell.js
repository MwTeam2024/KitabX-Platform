'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import Icon from '@/components/ui/Icon';
import AdminSidebar from './AdminSidebar';
import { toggleAdminSidebar } from '@/store/slices/uiSlice';
import { adminService } from '@/services/admin.service';

/**
 * Sidebar + scrolling main pane. The login route renders bare. Route
 * protection is enforced by NestJS on every request (AdminAuthGuard); this
 * layout only renders chrome — but it does check `/admin/auth/me` once per
 * navigation so an invalid/expired session bounces to login instead of
 * silently rendering an empty console (every admin page's data fetch used
 * to fail invisibly with no redirect and no visible error).
 */
export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    if (pathname === '/admin/login') return;
    adminService.me().catch(() => router.replace('/admin/login'));
  }, [pathname, router]);

  if (pathname === '/admin/login') return children;

  return (
    <div className="admin-shell">
      <AdminSidebar />
      <main className="admin-main">
        <button
          className="ghost-btn admin-menu-btn"
          style={{ marginBottom: 16 }}
          onClick={() => dispatch(toggleAdminSidebar())}
          aria-label="Toggle navigation"
        >
          <Icon name="menu" />Menu
        </button>
        {children}
      </main>
    </div>
  );
}

/** Page title row shared by every admin view. */
export function AdminTopline({ title, children }) {
  return (
    <div className="admin-topline">
      <h1 className="admin-h1">{title}</h1>
      {children}
    </div>
  );
}
