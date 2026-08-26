'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAppData } from '@/contexts/AppDataContext';

const ITEMS = [
  { href: '/home', label: 'Discover', icon: 'bookOpen', cls: 'nav-discover' },
  { href: '/books', label: 'My Shelf', icon: 'layers', cls: 'nav-shelf' },
  { href: '/wishlist', label: 'Wishlist', icon: 'heart', cls: 'nav-wish' },
  { href: '/exchanges', label: 'Exchange', icon: 'exchange', cls: 'nav-exch' },
  { href: '/chat', label: 'Chat', icon: 'messageCircle', cls: 'nav-chat', showUnread: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { chatThreads } = useAppData();

  const chatUnread = chatThreads.reduce((total, t) => total + (t.unread || 0), 0);

  return (
    <nav className="bottomnav">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const count = item.showUnread ? chatUnread : 0;
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
