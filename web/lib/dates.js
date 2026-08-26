/** "2h ago" / "3 days ago" style relative time for API timestamps. */
export function timeAgo(value) {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Pickup date options. Computed on the client only (see PickupScheduler) so the
 * server and browser can never disagree about "today".
 */
export function nextPickupDates(count = 3, from = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i + 1);
    return fmt.format(d);
  });
}
