'use client';

/** Route error boundary with the retry affordance §18 requires. */
export default function Error({ error, reset }) {
  return (
    <div className="app-frame">
      <div className="app-scroll" style={{ justifyContent: 'center' }}>
        <div className="empty-state" style={{ padding: '40px 24px' }}>
          <div className="ico" style={{ fontSize: 44 }}>⚠️</div>
          <div
            style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}
          >
            Something went wrong
          </div>
          <p style={{ marginBottom: 20 }}>
            We couldn&apos;t load this screen. Please try again.
            {error?.digest && (
              <>
                <br />
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Reference: {error.digest}</span>
              </>
            )}
          </p>
          <button className="btn btn-primary" onClick={reset}>Try again</button>
        </div>
      </div>
    </div>
  );
}
