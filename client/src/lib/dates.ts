/** Format a Date as YYYY-MM-DD using local time. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string to a local Date (midnight). */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Inclusive day difference (end - start) + 1. Assumes same TZ. */
export function dayCountInclusive(startISO: string, endISO: string): number {
  const start = fromISODate(startISO).getTime();
  const end = fromISODate(endISO).getTime();
  return Math.round((end - start) / 86400000) + 1;
}

/** Today at local midnight as ISO date. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Add n days to an ISO date string. */
export function addDaysISO(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Human readable formatted date like "May 5, 2026". */
export function formatHuman(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
