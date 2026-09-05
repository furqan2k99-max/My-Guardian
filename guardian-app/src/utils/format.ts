/** Truncate a phone-number hash for display (never show the full hash). */
export function shortenHash(hash: string, keep = 8): string {
  if (hash.length <= keep) return hash;
  return `${hash.slice(0, keep)}…`;
}

/** Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Backend risk reasons arrive as kebab tokens (e.g. "sms-known-scam"). */
export function formatRiskReason(reason: string): string {
  return reason
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function formatEventType(eventType: string): string {
  return eventType.toUpperCase();
}

export function formatElderAction(action: string): string {
  switch (action) {
    case 'blocked':
      return 'Elder blocked the sender';
    case 'dismissed':
      return 'Elder dismissed this alert';
    default:
      return '';
  }
}