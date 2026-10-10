import { generateTimeSlots, findBlockedSlots, formatDuration } from '../src/services/bookingSlots';
import { Appointment } from '../src/types/domain';

const slots = generateTimeSlots('10:00 AM', '01:00 PM');
const appt = (o: Partial<Appointment>): Appointment => ({
  id: 'a', shop_id: 's', customer_id: null, customer_name: 'C', staff_id: 'st1', staff_name: 'Ravi',
  service_id: null, service_name: 'Cut', starts_at: '2026-10-06 10:30 AM', duration_minutes: 45,
  status: 'Confirmed', notes: null, amount_minor: 0, created_at: '2026-10-06T00:00:00Z', ...o,
});

describe('findBlockedSlots', () => {
  const ravi = [{ id: 'st1', name: 'Ravi' }];

  it('blocks every slot an existing appointment covers', () => {
    const m = findBlockedSlots([appt({})], ravi, '2026-10-06', slots, 30);
    expect(m.get('10:30 AM')?.reason).toBe('booked');
    expect(m.get('11:00 AM')?.reason).toBe('booked'); // 10:30 + 45 min covers 11:00
    expect(m.has('11:30 AM')).toBe(false);
  });

  it('blocks a start that would run into the next booking', () => {
    const m = findBlockedSlots([appt({})], ravi, '2026-10-06', slots, 60);
    expect(m.get('10:00 AM')?.reason).toBe('overlap');
    expect(findBlockedSlots([appt({})], ravi, '2026-10-06', slots, 30).has('10:00 AM')).toBe(false);
  });

  it('ignores other days, cancelled appointments and other people', () => {
    expect(findBlockedSlots([appt({})], ravi, '2026-10-07', slots, 30).size).toBe(0);
    expect(findBlockedSlots([appt({ status: 'Cancelled' })], ravi, '2026-10-06', slots, 30).size).toBe(0);
    expect(findBlockedSlots([appt({ staff_id: 'x', staff_name: 'Meera' })], ravi, '2026-10-06', slots, 30).size).toBe(0);
  });

  it('checks the owner by name', () => {
    const m = findBlockedSlots([appt({ staff_id: null, staff_name: 'Raj' })], [{ id: null, name: 'Raj' }], '2026-10-06', slots, 30);
    expect(m.get('10:30 AM')?.reason).toBe('booked');
  });
});

it('formats durations', () => {
  expect(formatDuration(45)).toBe('45 min');
  expect(formatDuration(120)).toBe('2 hr');
  expect(formatDuration(95)).toBe('1 hr 35 min');
});

describe('findBlockedSlots false "busy" cases', () => {
  const slots2 = generateTimeSlots('10:00 AM', '01:00 PM');
  const base = (o: Partial<Appointment>): Appointment => ({
    id: 'a', shop_id: 's', customer_id: null, customer_name: 'C', staff_id: 'st1', staff_name: 'Ravi',
    service_id: null, service_name: 'Cut', starts_at: '2026-10-06 10:30 AM', duration_minutes: 30,
    status: 'Confirmed', notes: null, amount_minor: 0, created_at: '2026-10-06T00:00:00Z', ...o,
  });

  it('ignores deleted appointments', () => {
    const m = findBlockedSlots([base({ is_deleted: true })], [{ id: 'st1', name: 'Ravi' }], '2026-10-06', slots2, 30);
    expect(m.size).toBe(0);
  });

  it('does not match a different stylist whose name contains this name', () => {
    const m = findBlockedSlots(
      [base({ staff_id: 'st9', staff_name: 'Ramesh' })],
      [{ id: 'st2', name: 'Ram' }],
      '2026-10-06', slots2, 30
    );
    expect(m.size).toBe(0);
  });

  it('still matches one stylist inside a two-stylist booking', () => {
    const m = findBlockedSlots(
      [base({ staff_id: 'st1', staff_name: 'Ravi & Meera' })],
      [{ id: 'st2', name: 'Meera' }],
      '2026-10-06', slots2, 30
    );
    expect(m.get('10:30 AM')?.reason).toBe('booked');
  });
});

it('does not split a name that contains "and"', () => {
  const a: Appointment = {
    id: 'a', shop_id: 's', customer_id: null, customer_name: 'C', staff_id: null, staff_name: 'Anand',
    service_id: null, service_name: 'Cut', starts_at: '2026-10-06 10:30 AM', duration_minutes: 30,
    status: 'Confirmed', notes: null, amount_minor: 0, created_at: '2026-10-06T00:00:00Z',
  };
  const slotsA = generateTimeSlots('10:00 AM', '01:00 PM');
  expect(findBlockedSlots([a], [{ id: null, name: 'Anand' }], '2026-10-06', slotsA, 30).get('10:30 AM')?.reason).toBe('booked');
  expect(findBlockedSlots([a], [{ id: null, name: 'An' }], '2026-10-06', slotsA, 30).size).toBe(0);
});
