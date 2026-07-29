/** Returns a human-readable relative time string in Hebrew. */
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
    return "עכשיו";
  } else if (minutes < 60) {
    label = `${minutes} דק׳`;
  } else if (hours < 24) {
    label = `${hours} שע׳`;
  } else if (days < 7) {
    label = `${days} ימים`;
  } else {
    label = date.toLocaleDateString("he-IL");
    return isFuture ? `ב-${label}` : label;
  }

  return isFuture ? `עוד ${label}` : `לפני ${label}`;
}

/** Returns the start of today (midnight) in UTC-ish for Supabase queries. */
export function todayStart(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

/** Formats a date to a short readable time like "15:42". */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("he-IL", {
    hour: "numeric",
    minute: "2-digit",
  });
}
