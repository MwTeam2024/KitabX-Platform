'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';

const ITEMS = [
  { href: '/home', label: 'Discover', icon: 'bookOpen', cls: 'nav-discover' },
  { href: '/books', label: 'My Shelf', icon: 'layers', cls: 'nav-shelf' },
  { href: '/wishlist', label: 'Wishlist', icon: 'heart', cls: 'nav-wish' },
  { href: '/exchanges', label: 'Exchange', icon: 'exchange', cls: 'nav-exch' },
  // Chat is switched off for now — see chat.module.js.
  // { href: '/chat', label: 'Chat', icon: 'messageCircle', cls: 'nav-chat', showUnread: true },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottomnav">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        // Was chat's unread count — no nav item sets `showUnread` while
        // chat's off, so this always resolves to 0 for now.
        const count = item.showUnread ? item.unreadCount || 0 : 0;
        return (
          <Link key={item.href} href={item.href} className={`nav-btn ${item.cls}${active ? ' on' : ''}`}>
            <span className="nico">
              <Icon name={item.icon} />
              {/* Only rendered when there is something unread — never an empty dot. */}
              {count > 0 && (
                <i className="nav-count" aria-label={`${count} unread`}>{count > 9 ? '9+' : count}</i>
              )}
            </span>
            {item.label}
            <div className="nunder" />
          </Link>
        );
      })}
    </nav>
  );
}
