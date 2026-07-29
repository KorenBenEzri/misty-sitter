/** Returns a human-readable relative time string like "2 hours ago" or "1 day left". */
export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  const minutes = Math.floor(absDiff / 60_000);
  const hours = Math.floor(absDiff / 3_600_000);
  const days = Math.floor(absDiff / 86_400_000);

  let label: string;
  if (minutes < 1) {
    label = "just now";
    return label;
  } else if (minutes < 60) {
    label = `${minutes}m`;
  } else if (hours < 24) {
    label = `${hours}h`;
  } else if (days < 7) {
    label = `${days}d`;
  } else {
    label = date.toLocaleDateString();
    return isFuture ? `on ${label}` : label;
  }

  return isFuture ? `${label} left` : `${label} ago`;
}

/** Returns the start of today (midnight) in UTC-ish for Supabase queries. */
export function todayStart(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

/** Formats a date to a short readable time like "3:42 PM". */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
