import AdminShell from '@/components/admin/AdminShell';

export const metadata = {
  title: 'Admin Console — KitabX',
};

/**
 * Super Admin shell. Route protection is enforced by NestJS on every request;
 * this layout only renders chrome (§19 — never trust frontend admin state).
 */
export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
