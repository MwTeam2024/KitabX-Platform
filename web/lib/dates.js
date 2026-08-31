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

const PICKUP_DATE_FORMAT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Pickup date options. Computed on the client only (see PickupScheduler) so the
 * server and browser can never disagree about "today".
 */
export function nextPickupDates(count = 3, from = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i + 1);
    return PICKUP_DATE_FORMAT.format(d);
  });
}

/** Tomorrow's date as `YYYY-MM-DD`, for the "Others" date input's `min` — pickup
 * dates never include today, matching `nextPickupDates` starting at `i + 1`. */
export function tomorrowIsoDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Formats a raw `YYYY-MM-DD` (from an `<input type="date">`) into the same
 * display string the preset pickup dates use ("Tue 2 Sep"), so a custom-picked
 * date reads consistently everywhere it's shown or sent in a notification. */
export function formatPickupDate(isoDateStr) {
  if (!isoDateStr) return '';
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return PICKUP_DATE_FORMAT.format(new Date(y, m - 1, d));
}
