'use client';

import ScreenHeader from '@/components/ui/ScreenHeader';
import EmptyState from '@/components/ui/EmptyState';
import Icon from '@/components/ui/Icon';
import { SectionTitle, StatusPill, toneForStatus } from '@/components/ui/NoteBox';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { timeAgo } from '@/lib/dates';

const RULES = [
  { title: '📖 List a book', body: <>You receive a <b>pending</b> credit as soon as you list a book.</> },
  { title: '✅ Give it away', body: <>Once the handover is verified, your pending credit becomes <b>available</b> to spend.</> },
  { title: '🤝 Request a book', body: <>Requesting another book <b>reserves</b> 1 credit from your available balance.</> },
  { title: '📥 Receive a book', body: <>Once that handover is verified, the reserved credit is permanently <b>deducted</b>.</> },
  { title: '↩️ Rejected, cancelled or expired', body: <>Any reserved credit tied to that request is <b>released</b> back to your available balance automatically.</> },
];

/**
 * Screen 19b — credit passbook (§10). Balances are rendered, never computed here;
 * backend transactions are the source of truth.
 */
export default function CreditsPage() {
  const { credits, creditHistory, deleteCreditTransaction, clearCreditHistory } = useAppData();
  const showToast = useToast();

  const onDelete = async (id) => {
    try {
      await deleteCreditTransaction(id);
    } catch (err) {
      showToast(err.message || 'Could not remove this entry');
    }
  };

  const onClearAll = async () => {
    try {
      await clearCreditHistory();
    } catch (err) {
      showToast(err.message || 'Could not clear history');
    }
  };

  return (
    <>
      <ScreenHeader back title="Credit System" subtitle="Your balance, activity & how it works" />

      <div className="app-scroll pad-nav" style={{ padding: 16 }}>
        <div className="card" style={{ display: 'flex', padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <Balance value={credits.available} label="Available" color="var(--brand-2)" divider />
          <Balance value={credits.pending} label="Pending" color="var(--gold-deep)" divider />
          <Balance value={credits.reserved} label="Reserved" color="var(--sindoor)" />
        </div>

        <div className="section-row" style={{ padding: '0 0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle size={15}>Transaction history</SectionTitle>
          {creditHistory.length > 0 && (
            <button className="link-green" style={{ fontSize: 12 }} onClick={onClearAll}>
              Clear all
            </button>
          )}
        </div>

        <div style={{ marginBottom: 22 }}>
          {creditHistory.length ? creditHistory.map((h) => (
            <div className="list-row" key={h.id} style={{ margin: '0 0 10px', width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13, display: 'block' }}>{h.desc}</b>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{timeAgo(h.time)}</div>
              </div>
              <StatusPill tone={toneForStatus(h.status)} style={{ flexShrink: 0, marginTop: 0 }}>
                {h.status}
              </StatusPill>
              <button
                className="circle-btn"
                style={{ width: 24, height: 24, flexShrink: 0, marginLeft: 8 }}
                onClick={() => onDelete(h.id)}
                aria-label="Remove this entry"
              >
                <Icon name="x" style={{ width: 11, height: 11 }} />
              </button>
            </div>
          )) : (
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
