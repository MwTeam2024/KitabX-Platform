import Icon from './Icon';

/** Mint informational callout (`.note-box`) used for rules, privacy and next steps. */
export default function NoteBox({ icon = 'info', children, style, className = '' }) {
  return (
    <div className={`note-box ${className}`} style={style}>
      <Icon name={icon} />
      <span>{children}</span>
    </div>
  );
}

/** Serif section heading with the short green underline tick. */
export function SectionTitle({ children, size, tick = true, style }) {
  return (
    <span className={`section-h${tick ? ' tick' : ''}`} style={{ fontSize: size, ...style }}>
      {children}
    </span>
  );
}

/** Status chip; `tone` maps to the prototype's st-* classes. */
export function StatusPill({ tone = 'avail', children, style }) {
  return <span className={`status-pill st-${tone}`} style={style}>{children}</span>;
}

/** Maps a listing/credit status string onto a pill tone. */
export function toneForStatus(status) {
  switch (status) {
    case 'Available':
    case 'Received':
    case 'Released':
      return 'avail';
    case 'Requested':
    case 'Pending':
    case 'Reserved':
      return 'req';
    default:
      return 'given';
  }
}
