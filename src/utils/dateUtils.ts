/**
 * Local calendar date as YYYY-MM-DD.
 * Never use `toISOString().split('T')[0]` for this: it converts to UTC first, which
 * shifts the date back by one day in any timezone ahead of UTC (e.g. India, UTC+5:30).
 */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
