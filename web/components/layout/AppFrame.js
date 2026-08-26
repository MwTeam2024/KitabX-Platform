'use client';

import NotifDropdown from '@/components/ui/NotifDropdown';
import CreditDropdown from '@/components/ui/CreditDropdown';

/** Mobile-width column every non-admin route renders inside, matching the Figma frame. */
export default function AppFrame({ children }) {
  return (
    <div className="app-frame">
      {children}
      <NotifDropdown />
      <CreditDropdown />
    </div>
  );
}
