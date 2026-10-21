const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD (the key used everywhere in the database). */
export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** The last `n` day keys ending today, oldest first. */
export function lastNDays(n: number, today: string = dateKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((parseKey(toKey).getTime() - parseKey(fromKey).getTime()) / 86_400_000);
}

export function formatDay(key: string): string {
  return parseKey(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Fraction of the local day that has elapsed (0–1). */
export function dayFraction(now: Date = new Date()): number {
  return (now.getTime() - startOfDay(now).getTime()) / 86_400_000;
}
