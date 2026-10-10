import { Appointment, Bill, Customer, Service, StaffMember } from '../types/domain';
import { TimeSlot, findBookedSlots } from './bookingSlots';
import { toLocalDateStr } from '../utils/dateUtils';

export interface QuickBookStylist {
  id: string | null;
  name: string;
  isOwner: boolean;
}

export interface QuickBookSuggestion {
  customer: Customer;
  services: Service[];
  stylist: QuickBookStylist;
  dateStr: string;
  /** Slot label exactly as the booking screen uses it, e.g. "11:00 AM" */
  slot: string;
  /** 0 = today, 1 = tomorrow, ... */
  dayOffset: number;
  /** Local weekday short name for dayOffset >= 2, e.g. "Wed" */
  weekdayLabel: string;
  amountRupees: number;
}

interface LastVisit {
  at: number;
  serviceIds: string[];
  staffId: string | null;
  staffName: string;
}

const timeOf = (iso?: string | null): number => {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const isLiveAppointment = (a: Appointment) =>
  !a.is_deleted && a.status !== 'Cancelled';

const isLiveBill = (b: Bill) => b.status !== 'deleted' && !b.deleted_at;

/** Most recent live appointment or bill for a customer, with what was done. */
export function getLastVisit(
  customerId: string,
  appointments: Appointment[],
  bills: Bill[]
): LastVisit | null {
  let best: LastVisit | null = null;

  for (const a of appointments) {
    if (a.customer_id !== customerId || !isLiveAppointment(a)) continue;
    const at = timeOf(a.created_at);
    if (best && at <= best.at) continue;
    const ids =
      a.service_ids && a.service_ids.length > 0
        ? a.service_ids
        : a.service_id
        ? [a.service_id]
        : [];
    best = { at, serviceIds: ids, staffId: a.staff_id, staffName: a.staff_name || '' };
  }

  for (const b of bills) {
    if (b.customer_id !== customerId || !isLiveBill(b)) continue;
    const at = timeOf(b.issued_at) || timeOf(b.created_at);
    if (best && at <= best.at) continue;
    const ids = (b.items || [])
      .map((it) => it.service_id)
      .filter((id): id is string => Boolean(id));
    best = { at, serviceIds: ids, staffId: b.staff_id, staffName: b.staff_name || '' };
  }

  return best;
}

/** Active customers ordered by most recent visit, newest first. */
export function getRecentCustomers(
  customers: Customer[],
  appointments: Appointment[],
  bills: Bill[],
  limit = 3
): Customer[] {
  return customers
    .filter((c) => c.is_active !== false)
    .map((c) => ({ c, visit: getLastVisit(c.id, appointments, bills) }))
    .filter((x): x is { c: Customer; visit: LastVisit } => x.visit !== null)
    .sort((a, b) => b.visit.at - a.visit.at)
    .slice(0, limit)
    .map((x) => x.c);
}

/** First free slot for the stylist(s), today (future slots only) then the following days. */
export function findNextFreeSlot(
  appointments: Appointment[],
  stylists: StaffMember[],
  timeSlots: TimeSlot[],
  now: Date,
  daysAhead = 7
): { dateStr: string; slot: string; dayOffset: number } | null {
  for (let offset = 0; offset < daysAhead; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dateStr = toLocalDateStr(day);
    const booked = findBookedSlots(appointments, stylists, dateStr, timeSlots);
    for (const sl of timeSlots) {
      if (offset === 0) {
        const passed =
          sl.hour < now.getHours() || (sl.hour === now.getHours() && sl.min <= now.getMinutes());
        if (passed) continue;
      }
      if (!booked.has(sl.label)) {
        return { dateStr, slot: sl.label, dayOffset: offset };
      }
    }
  }
  return null;
}

function resolveStylist(
  visit: LastVisit,
  staff: StaffMember[],
  ownerName: string,
  preferredStaffId?: string | null
): { stylist: QuickBookStylist; member: StaffMember | null } {
  const active = staff.filter((s) => s.is_active);
  // A stylist who is logged in books for themselves, not for whoever served the customer last time
  const preferred = preferredStaffId ? active.find((s) => s.id === preferredStaffId) : undefined;
  if (preferred) {
    return { stylist: { id: preferred.id, name: preferred.name, isOwner: false }, member: preferred };
  }
  const byId = visit.staffId ? active.find((s) => s.id === visit.staffId) : undefined;
  const byName =
    !byId && visit.staffName
      ? active.find((s) => visit.staffName.toLowerCase().includes(s.name.trim().toLowerCase()))
      : undefined;
  const member = byId || byName || active[0] || null;
  if (member) {
    return { stylist: { id: member.id, name: member.name, isOwner: false }, member };
  }
  return { stylist: { id: null, name: ownerName || 'Owner', isOwner: true }, member: null };
}

/**
 * "Same as last time" suggestion: the customer's last services and stylist, at the next free slot.
 * Returns null when there is nothing reliable to suggest (no past services, services since removed,
 * or no free slot), so the caller can fall back to the full booking screen.
 */
export function buildSuggestion(params: {
  customer: Customer;
  appointments: Appointment[];
  bills: Bill[];
  services: Service[];
  staff: StaffMember[];
  ownerName: string;
  /** The logged-in stylist's id. When set, they are the suggested stylist. */
  preferredStaffId?: string | null;
  timeSlots: TimeSlot[];
  now: Date;
}): QuickBookSuggestion | null {
  const { customer, appointments, bills, services, staff, ownerName, preferredStaffId, timeSlots, now } = params;

  const visit = getLastVisit(customer.id, appointments, bills);
  if (!visit) return null;

  const wanted = Array.from(new Set(visit.serviceIds));
  const resolved = wanted
    .map((id) => services.find((s) => s.id === id && s.is_active))
    .filter((s): s is Service => Boolean(s));
  if (resolved.length === 0) return null;

  const { stylist, member } = resolveStylist(visit, staff, ownerName, preferredStaffId);
  const free = findNextFreeSlot(appointments, member ? [member] : [], timeSlots, now);
  if (!free) return null;

  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + free.dayOffset);
  return {
    customer,
    services: resolved,
    stylist,
    dateStr: free.dateStr,
    slot: free.slot,
    dayOffset: free.dayOffset,
    weekdayLabel: day.toLocaleDateString('en-US', { weekday: 'short' }),
    amountRupees: resolved.reduce((sum, s) => sum + Math.round(s.price_minor / 100), 0),
  };
}
