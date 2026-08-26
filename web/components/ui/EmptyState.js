/** Shared empty/loading/error placeholder — §18 requires one on every network screen. */
export default function EmptyState({ icon = '📭', title, hint, action }) {
  return (
    <div className="empty-state">
      <div className="ico">{icon}</div>
      <p>
        {title}
        {hint && (<><br />{hint}</>)}
      </p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
