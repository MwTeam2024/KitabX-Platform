'use client';

import Icon from './Icon';

/**
 * Owner trust card shown in a sheet (§13): rating, completed exchanges,
 * member-since and completion rate. Never shows the exact flat number.
 */
export default function TrustProfile({ owner, isSelf = false, onViewListings, onReport, reviews = [] }) {
  const written = reviews.filter((r) => r.review?.trim());
  return (
    <>
      <div style={{ margin: '-6px 0 16px' }}>
        {owner.verified ? (
          <span className="pbadge" style={{ background: 'var(--mint)', color: 'var(--brand-2)' }}>
            <Icon name="shieldCheck" />Verified resident
          </span>
        ) : (
          <span className="pbadge" style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)' }}>
            <Icon name="shieldCheck" />Not yet verified
          </span>
        )}
      </div>

      <div className="card" style={{ display: 'flex', padding: 0, overflow: 'hidden', marginBottom: 12 }}>
        <Cell big={`★ ${owner.avgRating}`} label="Average rating" divider />
        <Cell big={owner.completed} label="Completed exchanges" />
      </div>
      <div className="card" style={{ display: 'flex', padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <Cell big={owner.memberSince} label="Member since" size={15} divider />
        <Cell big={`${owner.completionRate}%`} label="Completion rate" />
      </div>

      <button className="btn btn-outline" onClick={onViewListings}>
        {isSelf ? 'View your listings' : 'View their listings'}
      </button>

      {/* You can't report yourself — the action only exists for other members. */}
      {!isSelf && (
        <button className="btn btn-outline danger" style={{ marginTop: 10 }} onClick={onReport}>
          <Icon name="flag" style={{ width: 14, height: 14 }} />Report {owner.name}
        </button>
      )}

      {written.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>What neighbours say</div>
          {written.map((r) => (
            <div className="card" key={r.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{r.rater?.name || 'A neighbour'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{r.review}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Cell({ big, label, size = 20, divider }) {
  return (
    <div
      style={{
        flex: 1,
        padding: 14,
        textAlign: 'center',
        borderRight: divider ? '1px solid var(--line)' : undefined,
      }}
    >
      <div className="font-display" style={{ fontFamily: 'var(--font-display)', fontSize: size, fontWeight: 700 }}>
        {big}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
