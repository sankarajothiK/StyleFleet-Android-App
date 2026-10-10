import { toLocalDateStr } from '../src/utils/dateUtils';
import { generateTimeSlots, findBookedSlots } from '../src/services/bookingSlots';
import {
  getRecentCustomers,
  buildSuggestion,
  findNextFreeSlot,
} from '../src/services/quickBookService';
import { Appointment, Bill, Customer, Service, StaffMember } from '../src/types/domain';

const customer = (id: string, name: string, extra: Partial<Customer> = {}): Customer => ({
  id,
  shop_id: 's1',
  name,
  phone: '9845062110',
  notes: null,
  preferred_staff_id: null,
  is_starred: false,
  visits_count: 0,
  lifetime_spend_minor: 0,
  outstanding_due_minor: 0,
  last_visit_date: null,
  created_at: '2026-01-01T00:00:00.000Z',
  is_active: true,
  ...extra,
});

const service = (id: string, price: number, extra: Partial<Service> = {}): Service => ({
  id,
  shop_id: 's1',
  category_id: null,
  name: `svc-${id}`,
  price_minor: price * 100,
  duration_minutes: 30,
  is_active: true,
  ...extra,
});

const stylist = (id: string, name: string, active = true): StaffMember => ({
  id,
  shop_id: 's1',
  name,
  role: 'Stylist',
  phone: null,
  is_active: active,
  target_amount_minor: 0,
  revenue_minor: 0,
  service_count: 0,
  rebook_rate: '0%',
  rating: '5.0',
  chair_utilization: '0%',
});

const appt = (id: string, extra: Partial<Appointment>): Appointment => ({
  id,
  shop_id: 's1',
  customer_id: 'c1',
  customer_name: 'Priya',
  staff_id: 'st1',
  staff_name: 'Ravi',
  service_id: 'sv1',
  service_ids: ['sv1'],
  service_name: 'Haircut',
  starts_at: '2026-10-01 11:00 AM',
  duration_minutes: 45,
  status: 'Confirmed',
  notes: null,
  amount_minor: 30000,
  created_at: '2026-10-01T05:00:00.000Z',
  ...extra,
});

const bill = (id: string, extra: Partial<Bill>): Bill =>
  ({
    id,
    shop_id: 's1',
    customer_id: 'c1',
    customer_name: 'Priya',
    staff_id: 'st1',
    staff_name: 'Ravi',
    invoice_number: id,
    status: 'paid',
    subtotal_minor: 0,
    discount_minor: 0,
    tax_minor: 0,
    total_minor: 0,
    notes: null,
    items: [],
    created_at: '2026-10-02T05:00:00.000Z',
    ...extra,
  } as Bill);

describe('toLocalDateStr', () => {
  it('returns the local calendar date, not the UTC date', () => {
    // Local midnight. toISOString() would give the previous day in any timezone ahead of UTC.
    expect(toLocalDateStr(new Date(2026, 9, 6))).toBe('2026-10-06');
    expect(toLocalDateStr(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01');
    expect(toLocalDateStr(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('getRecentCustomers', () => {
  const customers = [customer('c1', 'Priya'), customer('c2', 'Anita'), customer('c3', 'Karan')];

  it('orders by latest visit, skips customers with no visits and inactive ones', () => {
    const appts = [appt('a1', { customer_id: 'c1', created_at: '2026-10-01T05:00:00.000Z' })];
    const bills = [bill('b1', { customer_id: 'c2', created_at: '2026-10-04T05:00:00.000Z' })];
    const list = getRecentCustomers(
      [...customers, customer('c4', 'Gone', { is_active: false })],
      appts,
      bills
    );
    expect(list.map((c) => c.id)).toEqual(['c2', 'c1']);
  });

  it('ignores deleted bills and cancelled or deleted appointments', () => {
    const appts = [
      appt('a1', { customer_id: 'c1', status: 'Cancelled' }),
      appt('a2', { customer_id: 'c2', is_deleted: true }),
    ];
    const bills = [bill('b1', { customer_id: 'c3', status: 'deleted' })];
    expect(getRecentCustomers(customers, appts, bills)).toEqual([]);
  });

  it('respects the limit', () => {
    const bills = customers.map((c, i) =>
      bill(`b${i}`, { customer_id: c.id, created_at: `2026-10-0${i + 1}T05:00:00.000Z` })
    );
    expect(getRecentCustomers(customers, [], bills, 2)).toHaveLength(2);
  });
});

describe('findNextFreeSlot and findBookedSlots', () => {
  const slots = generateTimeSlots('10:00 AM', '12:00 PM'); // 10:00, 10:30, 11:00, 11:30, 12:00
  const ravi = stylist('st1', 'Ravi');

  it('skips slots that already passed today', () => {
    const now = new Date(2026, 9, 6, 10, 15);
    const free = findNextFreeSlot([], [ravi], slots, now);
    expect(free).toEqual({ dateStr: '2026-10-06', slot: '10:30 AM', dayOffset: 0 });
  });

  it('skips slots the stylist already has', () => {
    const now = new Date(2026, 9, 6, 9, 0);
    const booked = [appt('a1', { starts_at: '2026-10-06 10:00 AM' })];
    const free = findNextFreeSlot(booked, [ravi], slots, now);
    expect(free?.slot).toBe('10:30 AM');
  });

  it('rolls to tomorrow when today has no free slots left', () => {
    const now = new Date(2026, 9, 6, 13, 0);
    const free = findNextFreeSlot([], [ravi], slots, now);
    expect(free).toEqual({ dateStr: '2026-10-07', slot: '10:00 AM', dayOffset: 1 });
  });

  it('does not treat cancelled or other stylists appointments as blocking', () => {
    const map = findBookedSlots(
      [
        appt('a1', { starts_at: '2026-10-06 10:00 AM', status: 'Cancelled' }),
        appt('a2', { starts_at: '2026-10-06 10:30 AM', staff_id: 'other', staff_name: 'Meera' }),
      ],
      [ravi],
      '2026-10-06',
      slots
    );
    expect(map.size).toBe(0);
  });
});

describe('buildSuggestion', () => {
  const slots = generateTimeSlots('10:00 AM', '12:00 PM');
  const base = {
    customer: customer('c1', 'Priya'),
    appointments: [] as Appointment[],
    bills: [] as Bill[],
    services: [service('sv1', 300), service('sv2', 150)],
    staff: [stylist('st1', 'Ravi'), stylist('st2', 'Meera')],
    ownerName: 'Owner',
    timeSlots: slots,
    now: new Date(2026, 9, 6, 9, 0),
  };

  it('suggests the last services and stylist at the next free slot', () => {
    const s = buildSuggestion({
      ...base,
      appointments: [appt('a1', { service_ids: ['sv1', 'sv2'] })],
    });
    expect(s).not.toBeNull();
    expect(s!.services.map((x) => x.id)).toEqual(['sv1', 'sv2']);
    expect(s!.stylist).toEqual({ id: 'st1', name: 'Ravi', isOwner: false });
    expect(s!.amountRupees).toBe(450);
    expect(s!.slot).toBe('10:00 AM');
    expect(s!.dateStr).toBe('2026-10-06');
  });

  it('uses bill items when the bill is the most recent visit', () => {
    const s = buildSuggestion({
      ...base,
      appointments: [appt('a1', { created_at: '2026-09-01T05:00:00.000Z' })],
      bills: [
        bill('b1', {
          staff_id: 'st2',
          staff_name: 'Meera',
          items: [
            { service_id: 'sv2', service_name_snapshot: 'x', quantity: 1, unit_price_minor: 15000, discount_minor: 0, tax_minor: 0, line_total_minor: 15000, staff_id: 'st2' },
          ],
        }),
      ],
    });
    expect(s!.services.map((x) => x.id)).toEqual(['sv2']);
    expect(s!.stylist.name).toBe('Meera');
  });

  it('falls back to another active stylist when the last one left', () => {
    const s = buildSuggestion({
      ...base,
      staff: [stylist('st1', 'Ravi', false), stylist('st2', 'Meera')],
      appointments: [appt('a1', {})],
    });
    expect(s!.stylist.id).toBe('st2');
  });

  it('falls back to the owner when there is no active staff', () => {
    const s = buildSuggestion({ ...base, staff: [], appointments: [appt('a1', {})] });
    expect(s!.stylist).toEqual({ id: null, name: 'Owner', isOwner: true });
  });

  it('books for the logged-in stylist, not for whoever served the customer last time', () => {
    const s = buildSuggestion({
      ...base,
      preferredStaffId: 'st2',
      appointments: [appt('a1', { staff_id: 'st1', staff_name: 'Ravi' })],
    });
    expect(s!.stylist).toEqual({ id: 'st2', name: 'Meera', isOwner: false });
  });

  it('keeps the usual stylist for an owner (no logged-in stylist)', () => {
    const s = buildSuggestion({
      ...base,
      preferredStaffId: null,
      appointments: [appt('a1', { staff_id: 'st1', staff_name: 'Ravi' })],
    });
    expect(s!.stylist.id).toBe('st1');
  });

  it('ignores a logged-in stylist who is no longer active or not in the team', () => {
    const inactive = buildSuggestion({
      ...base,
      staff: [stylist('st1', 'Ravi'), stylist('st2', 'Meera', false)],
      preferredStaffId: 'st2',
      appointments: [appt('a1', {})],
    });
    expect(inactive!.stylist.id).toBe('st1');

    const unknown = buildSuggestion({ ...base, preferredStaffId: 'ghost', appointments: [appt('a1', {})] });
    expect(unknown!.stylist.id).toBe('st1');
  });

  it('returns null when no past service can be resolved', () => {
    expect(buildSuggestion({ ...base, appointments: [] })).toBeNull();
    expect(
      buildSuggestion({
        ...base,
        services: [service('sv1', 300, { is_active: false })],
        appointments: [appt('a1', {})],
      })
    ).toBeNull();
  });
});
