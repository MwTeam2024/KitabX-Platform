'use client';

import { useEffect } from 'react';
import ScreenHeader from '@/components/ui/ScreenHeader';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { SectionTitle, StatusPill, toneForStatus } from '@/components/ui/NoteBox';
import { useAppData } from '@/contexts/AppDataContext';
import { timeAgo } from '@/lib/dates';

// Same three palettes as .st-avail/.st-req/.st-given (globals.css) — the
// leading icon circle reuses the status pill's own colors instead of
// inventing a fourth scheme.
const ICON_BY_STATUS = {
  Available: { icon: 'plus', bg: 'var(--mint)', color: 'var(--brand-2)' },
  Released: { icon: 'arrowLeft', bg: 'var(--mint)', color: 'var(--brand-2)' },
  Reserved: { icon: 'fileText', bg: '#DDEAE0', color: 'var(--brand)' },
  Pending: { icon: 'clock', bg: '#DDEAE0', color: 'var(--brand)' },
  Withdrawn: { icon: 'trash', bg: 'var(--orange-soft)', color: 'var(--orange)' },
  Deducted: { icon: 'minus', bg: 'var(--orange-soft)', color: 'var(--orange)' },
};
const DEFAULT_ICON = { icon: 'coin', bg: 'var(--orange-soft)', color: 'var(--orange)' };

const RULES = [
  { title: '📖 List a book', body: <>You receive 1 <b>available</b> credit the instant you list a book — spendable right away.</> },
  { title: '🤝 Request a book', body: <>Requesting another book <b>reserves</b> 1 credit from your available balance.</> },
  { title: '📥 Receive a book', body: <>Once that handover is verified, the reserved credit is permanently <b>deducted</b>.</> },
  { title: '↩️ Rejected, cancelled or expired', body: <>Any reserved credit tied to that request is <b>released</b> back to your available balance automatically.</> },
  { title: '🗑️ Removing your own listing', body: <>Withdraws the credit it granted — but only while it's still unspent. If you've already used it (or more) requesting books, you can't remove that many listings until those exchanges are completed.</> },
];

/**
 * Screen 19b — credit passbook (§10). Balances are rendered, never computed here;
 * backend transactions are the source of truth.
 */
export default function CreditsPage() {
  const { credits, creditHistory, refreshCredits } = useAppData();

  useEffect(() => { refreshCredits().catch(() => {}); }, [refreshCredits]);

  return (
    <>
      <ScreenHeader back title="Credit System" subtitle="Your balance, activity & how it works" />

      <div className="app-scroll pad-nav" style={{ padding: 16 }}>
        <div className="card" style={{ display: 'flex', padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <Balance value={credits.available} label="Available" color="var(--brand-2)" divider />
          <Balance value={credits.reserved} label="Reserved" color="var(--sindoor)" />
        </div>

        <div className="section-row" style={{ padding: '0 0 10px' }}>
          <SectionTitle size={15}>Transaction history</SectionTitle>
        </div>

        <div style={{ marginBottom: 22 }}>
          {creditHistory.length ? creditHistory.map((h) => {
            const iconInfo = ICON_BY_STATUS[h.status] || DEFAULT_ICON;
            return (
              <div
                className="list-row"
                key={h.id}
                style={{ margin: '0 0 8px', width: '100%', padding: '10px 12px', gap: 10, alignItems: 'flex-start' }}
              >
                <div
                  style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: iconInfo.bg, color: iconInfo.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name={iconInfo.icon} style={{ width: 15, height: 15 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {/* No nowrap/ellipsis here — a longer description (book title +
                        owner name) was being silently cut off with no way to read
                        the rest, which is worse on narrow mobile widths where less
                        of it fit before truncating. Wrapping keeps it fully readable. */}
                    <b style={{ fontSize: 12.5, lineHeight: 1.35, flex: 1, minWidth: 0 }}>{h.desc}</b>
                    <b
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 15,
                        flexShrink: 0,
                        color: h.amount > 0 ? 'var(--brand-2)' : 'var(--sindoor)',
                      }}
                    >
                      {/* A reservation only holds a credit, it doesn't spend it —
                          showing it with the same "-1" as a final deduction made
                          the two look like two separate losses for one credit.
                          Dropping the sign here (color still shows it moved out
                          of the available balance) leaves the minus for the
                          actual, permanent deduction. */}
                      {h.type === 'REQUEST_RESERVED' ? Math.abs(h.amount) : (h.amount > 0 ? `+${h.amount}` : h.amount)}
                    </b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <StatusPill tone={toneForStatus(h.status)} style={{ marginTop: 0, flexShrink: 0 }}>
                      {h.status}
                    </StatusPill>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(h.time)}</span>
                  </div>
                </div>
              </div>
            );
          }) : (
            <EmptyState icon="🪙" title="No credit activity yet." />
          )}
        </div>

        <SectionTitle size={15} style={{ marginBottom: 10 }}>How credits work</SectionTitle>
        <div className="card" style={{ marginBottom: 20 }}>
          {RULES.map((r, i) => (
            <div className="faq-item" key={r.title} style={i === RULES.length - 1 ? { marginBottom: 0 } : undefined}>
              <b>{r.title}</b>
              <p>{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Balance({ value, label, color, divider }) {
  return (
    <div
      style={{
        flex: 1, padding: '16px 8px', textAlign: 'center',
        borderRight: divider ? '1px solid var(--line)' : undefined,
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
