import { Bill } from '../src/types/domain';
import { calculateRebookPercent, billIsFor } from '../src/utils/stylistStats';

const ravi = { id: 'st1', name: 'Ravi' };

let n = 0;
const bill = (customer: string | null, day: number, extra: Partial<Bill> = {}): Bill =>
  ({
    id: `b${++n}`,
    shop_id: 's',
    customer_id: customer,
    customer_name: customer || 'Walk-in',
    staff_id: 'st1',
    staff_name: 'Ravi',
    invoice_number: `INV-${n}`,
    status: 'paid',
    total_minor: 10000,
    notes: null,
    items: [],
    created_at: new Date(2026, 9, day, 12).toISOString(),
    ...extra,
  }) as unknown as Bill;

describe('rebook rate: share of a stylist\'s customers who came back', () => {
  it('is empty (null) when the stylist has no customers yet, instead of an invented number', () => {
    expect(calculateRebookPercent([], ravi)).toBeNull();
    expect(calculateRebookPercent([bill(null, 1)], ravi)).toBeNull(); // walk-ins do not count
  });

  it('is 0% when everyone came only once', () => {
    expect(calculateRebookPercent([bill('a', 1), bill('b', 2), bill('c', 3)], ravi)).toBe(0);
  });

  it('is 100% when everyone came back on another day', () => {
    expect(calculateRebookPercent([bill('a', 1), bill('a', 5), bill('b', 2), bill('b', 9)], ravi)).toBe(100);
  });

  it('counts a customer once, however many bills', () => {
    // a: 3 visits, b: 1 visit, c: 1 visit, d: 1 visit  -> 1 of 4 came back
    const bills = [bill('a', 1), bill('a', 2), bill('a', 3), bill('b', 4), bill('c', 5), bill('d', 6)];
    expect(calculateRebookPercent(bills, ravi)).toBe(25);
  });

  it('two bills on the same day are one visit, not a rebooking', () => {
    expect(calculateRebookPercent([bill('a', 1), bill('a', 1)], ravi)).toBe(0);
  });

  it('only counts visits to this stylist', () => {
    const bills = [
      bill('a', 1),
      bill('a', 5, { staff_id: 'st2', staff_name: 'Meera' }), // came back, but to someone else
    ];
    expect(calculateRebookPercent(bills, ravi)).toBe(0);
  });

  it('leaves out deleted bills and opening-due entries', () => {
    const bills = [
      bill('a', 1),
      bill('a', 5, { status: 'deleted' }),
      bill('b', 1),
      bill('b', 6, { invoice_number: 'DUE-1001' }),
    ];
    expect(calculateRebookPercent(bills, ravi)).toBe(0);
  });

  it('counts shared bills ("Ravi & Priya") for each stylist named', () => {
    const shared = (c: string, d: number) => bill(c, d, { staff_id: 'st9', staff_name: 'Ravi & Priya' });
    expect(calculateRebookPercent([shared('a', 1), shared('a', 4)], ravi)).toBe(100);
  });

  it('matches by name when the bill has no stylist id', () => {
    const named = (c: string, d: number) => bill(c, d, { staff_id: null, staff_name: ' ravi ' });
    expect(billIsFor(named('a', 1), ravi)).toBe(true);
    expect(calculateRebookPercent([named('a', 1), named('a', 3)], ravi)).toBe(100);
  });

  it('ignores bills with an unreadable date', () => {
    expect(calculateRebookPercent([bill('a', 1), bill('a', 2, { created_at: 'nope' })], ravi)).toBe(0);
  });
});
