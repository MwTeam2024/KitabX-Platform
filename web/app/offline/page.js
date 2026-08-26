import Link from 'next/link';

export const metadata = { title: 'Offline — KitabX' };

/** Offline fallback served by the service worker when a navigation fails (§17). */
export default function OfflinePage() {
  return (
    <div className="app-frame">
      <div className="app-scroll" style={{ justifyContent: 'center' }}>
        <div className="empty-state" style={{ padding: '40px 24px' }}>
          <div className="ico" style={{ fontSize: 44 }}>📡</div>
          <div
            style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}
          >
            You&apos;re offline
          </div>
          <p style={{ marginBottom: 20 }}>
            KitabX needs a connection to load new books.
            <br />
            Your recently viewed pages still work.
          </p>
          <Link className="btn btn-primary" href="/home">Try again</Link>
        </div>
      </div>
    </div>
  );
}
