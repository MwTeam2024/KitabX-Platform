'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import { toggleAdminSidebar } from '@/store/slices/uiSlice';
import { useToast } from '@/components/ui/ToastProvider';
import { adminService } from '@/services/admin.service';
import { useAdminNotificationBadges } from '@/hooks/useAdminNotificationBadges';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'grid' },
  { href: '/admin/users', label: 'Users', icon: 'users', badgeKey: 'newUsers' },
  { href: '/admin/deletion-requests', label: 'Account Deletions', icon: 'trash', badgeKey: 'newDeletionRequests' },
  { href: '/admin/societies', label: 'Societies', icon: 'building' },
  { href: '/admin/listings', label: 'Book Moderation', icon: 'bookOpen', badgeKey: 'newModeration' },
  { href: '/admin/exchanges', label: 'Listings & Exchanges', icon: 'layers' },
  { href: '/admin/credits', label: 'Credits', icon: 'coin' },
  { href: '/admin/reports', label: 'Reports', icon: 'flag', badgeKey: 'newReports' },
  { href: '/admin/profile', label: 'My Profile', icon: 'user' },
  { href: '/admin/settings', label: 'Settings', icon: 'settings' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const showToast = useToast();
  const isOpen = useSelector((s) => s.ui.isAdminSidebarOpen);
  const badgeCounts = useAdminNotificationBadges(pathname);

  const logout = async () => {
    try {
      await adminService.logout();
    } catch {
      // Cookie clear failed server-side (e.g. already expired) — still send
      // the admin to login below, there's nothing else useful to do here.
    }
    showToast('Logged out of Admin Console');
    router.push('/admin/login');
  };

  return (
    <>
      <div
        className={`admin-drawer-backdrop${isOpen ? ' open' : ''}`}
        onClick={() => dispatch(toggleAdminSidebar())}
      />
      <aside className={`admin-sidebar${isOpen ? ' open' : ''}`}>
        <div className="admin-brand">
          KitabX<span>Admin Console</span>
        </div>

        {NAV.map((item) => {
          const badge = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-item${pathname === item.href ? ' on' : ''}`}
              onClick={() => isOpen && dispatch(toggleAdminSidebar())}
              style={{ justifyContent: 'space-between' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name={item.icon} />{item.label}
              </span>
              {badge > 0 && <span className="admin-nav-badge">{badge}</span>}
            </Link>
          );
        })}

        <Link
          href="/home"
          className="admin-nav-item"
          style={{ marginTop: 'auto' }}
          onClick={() => isOpen && dispatch(toggleAdminSidebar())}
        >
          <Icon name="bookOpen" />View member app
        </Link>

        <button
          className="admin-nav-item"
          style={{ color: 'var(--sindoor)' }}
          onClick={logout}
        >
          <Icon name="logout" />Log Out
        </button>
      </aside>
    </>
  );
}
