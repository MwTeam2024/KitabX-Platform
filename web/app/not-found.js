import Link from 'next/link';

export const metadata = { title: 'Page not found — KitabX' };

export default function NotFound() {
  return (
    <div className="app-frame">
      <div className="app-scroll" style={{ justifyContent: 'center' }}>
        <div className="empty-state" style={{ padding: '40px 24px' }}>
          <div className="ico" style={{ fontSize: 44 }}>🔍</div>
          <div
            style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}
          >
            Page not found
          </div>
          <p style={{ marginBottom: 20 }}>
            That shelf is empty. Let&apos;s get you back to the books.
          </p>
          <Link className="btn btn-primary" href="/home">Back to Discover</Link>
        </div>
      </div>
    </div>
  );
}
