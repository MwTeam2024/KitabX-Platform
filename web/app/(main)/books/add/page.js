'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader, { StepProgress } from '@/components/ui/ScreenHeader';

const METHODS = [
  {
    href: '/books/add/scan',
    icon: 'camera',
    title: 'Scan ISBN barcode',
    hint: 'Point camera at barcode — details fill automatically',
    badge: '⚡ Fastest',
  },
  {
    href: '/books/add/search',
    icon: 'search',
    title: 'Search by title or author',
    hint: 'We fetch cover and details automatically',
    iconStyle: { background: 'var(--blue-soft)', color: 'var(--blue)' },
  },
  {
    href: '/books/add/details',
    icon: 'edit',
    title: 'Enter details manually',
    hint: 'Type title, author and details yourself',
    iconStyle: { background: 'var(--orange-soft)', color: 'var(--orange)' },
  },
];

/** Screen 06 — the four ways to add a book (§6, §7). */
export default function AddBookMethodPage() {
  const router = useRouter();

  return (
    <>
      <ScreenHeader back backHref="/home">
        <StepProgress label="Step 1 of 3 — List your book" percent={33} />
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: '20px 16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, marginBottom: 4 }}>
          How would you like to add your book?
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Choose the fastest method for you
        </div>

        {METHODS.map((m) => (
          <button
            key={m.href}
            className="card"
            style={{ display: 'flex', gap: 14, marginBottom: 12, width: '100%', textAlign: 'left', border: 'none' }}
            onClick={() => router.push(m.href)}
          >
            <div className="stat-ic" style={{ margin: 0, width: 44, height: 44, flexShrink: 0, ...m.iconStyle }}>
              <Icon name={m.icon} style={{ width: 19, height: 19 }} />
            </div>
            <div>
              <b style={{ fontSize: 14 }}>{m.title}</b>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: m.badge ? '2px 0 6px' : '2px 0 0' }}>
                {m.hint}
              </div>
              {m.badge && <span className="status-pill st-avail">{m.badge}</span>}
            </div>
          </button>
        ))}

        <button
          className="card"
          style={{
            display: 'flex', gap: 14, width: '100%', textAlign: 'left', border: 'none',
            background: 'linear-gradient(160deg,#1B5E37,var(--brand-deep))',
          }}
          onClick={() => router.push('/books/add/bulk')}
        >
          <div
            className="stat-ic"
            style={{ margin: 0, width: 44, height: 44, flexShrink: 0, background: 'rgba(255,255,255,.16)', color: '#fff' }}
          >
            <Icon name="layers" style={{ width: 19, height: 19 }} />
          </div>
          <div>
            <b style={{ fontSize: 14, color: '#fff' }}>
              Single & Bulk Book Upload with AI
              <span className="new-pill" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>New</span>
            </b>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>
              Upload one book or multiple books — AI finds every title for you
            </div>
          </div>
        </button>
      </div>
    </>
  );
}
