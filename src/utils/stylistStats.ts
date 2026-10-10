import { Bill } from '../types/domain';
import { isOpeningDueBill } from '../services/billingService';

type StaffRef = { id: string; name: string };

const localDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

/** Does this bill belong to the stylist? By id, or by name (including "Ravi & Priya" shared bills). */
export function billIsFor(bill: Bill, staff: StaffRef): boolean {
  if (bill.staff_id && bill.staff_id === staff.id) return true;
  const wanted = staff.name.trim().toLowerCase();
  if (!wanted) return false;
  return (bill.staff_name || '')
    .split('&')
    .map((n) => n.trim().toLowerCase())
    .includes(wanted);
}

/**
 * Rebook rate: of the customers this stylist has served, the share who came back to them on a
 * different day at least once. Only real sales to known customers count (no walk-ins, deleted
 * bills or opening-due entries). Returns null when the stylist has no customers yet.
 */
export function calculateRebookPercent(bills: Bill[], staff: StaffRef): number | null {
  const visitDays = new Map<string, Set<string>>();

  for (const b of bills || []) {
    if (!b || b.status === 'deleted' || isOpeningDueBill(b)) continue;
    if (!b.customer_id || !b.created_at) continue;
    if (isNaN(new Date(b.created_at).getTime())) continue;
    if (!billIsFor(b, staff)) continue;
    const days = visitDays.get(b.customer_id) || new Set<string>();
    days.add(localDay(b.created_at));
    visitDays.set(b.customer_id, days);
  }

  if (visitDays.size === 0) return null;
  let returning = 0;
  visitDays.forEach((days) => {
    if (days.size >= 2) returning += 1;
  });
  return Math.round((returning / visitDays.size) * 100);
}
