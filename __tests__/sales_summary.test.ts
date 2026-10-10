import { Bill } from '../src/types/domain';
import {
  getSummaryYears,
  getSummaryMonths,
  getSummaryDays,
  getSummaryDayBills,
  dateKeyOf,
} from '../src/utils/salesSummary';

let seq = 0;
const bill = (
  y: number,
  m: number, // 1-12
  d: number,
  total: number,
  customer: string,
  items: { name: string; qty?: number }[] = [],
  extra: Partial<Bill> = {}
): Bill =>
  ({
    id: `b${++seq}`,
    shop_id: 's',
    customer_id: null,
    customer_name: customer,
    staff_id: null,
    staff_name: '',
    invoice_number: `INV-${seq}`,
    status: 'paid',
    subtotal_minor: total,
    discount_minor: 0,
    tax_minor: 0,
    total_minor: total,
    notes: null,
    issued_at: new Date(y, m - 1, d, 12).toISOString(),
    created_at: new Date(y, m - 1, d, 12 + (seq % 5)).toISOString(),
    payment_method: 'UPI',
    items: items.map((i) => ({
      service_id: null,
      service_name_snapshot: i.name,
      quantity: i.qty ?? 1,
      unit_price_minor: 0,
      discount_minor: 0,
      tax_minor: 0,
      line_total_minor: 0,
      staff_id: null,
    })),
    ...extra,
  }) as Bill;

const bills: Bill[] = [
  bill(2026, 10, 7, 50000, 'Asha', [{ name: 'Haircut' }, { name: 'Beard', qty: 2 }]),
  bill(2026, 10, 7, 30000, 'Ravi', [{ name: 'Facial' }]),
  bill(2026, 10, 2, 20000, 'Meena', [{ name: 'Spa' }]),
  bill(2026, 3, 15, 10000, 'Kumar', [{ name: 'Colour' }]),
  bill(2025, 12, 31, 40000, 'Late', [{ name: 'Haircut' }]),
  bill(2025, 1, 1, 5000, 'Early', [{ name: 'Wax' }]),
];

describe('sales summary: year → month → day', () => {
  it('lists years with sales, newest first, with totals', () => {
    expect(getSummaryYears(bills)).toEqual([
      { year: 2026, billsCount: 4, salesMinor: 110000 },
      { year: 2025, billsCount: 2, salesMinor: 45000 },
    ]);
  });

  it('lists the months of a year, newest first', () => {
    expect(getSummaryMonths(bills, 2026)).toEqual([
      { month: 9, billsCount: 3, salesMinor: 100000 }, // October
      { month: 2, billsCount: 1, salesMinor: 10000 }, // March
    ]);
    expect(getSummaryMonths(bills, 2025).map((m) => m.month)).toEqual([11, 0]);
    expect(getSummaryMonths(bills, 2024)).toEqual([]);
  });

  it('lists the days of a month, newest first', () => {
    const days = getSummaryDays(bills, 2026, 9);
    expect(days.map((d) => [d.day, d.billsCount, d.salesMinor])).toEqual([
      [7, 2, 80000],
      [2, 1, 20000],
    ]);
    expect(days[0].dateKey).toBe('2026-10-07');
  });

  it('year, month and day totals agree with each other', () => {
    const year = getSummaryYears(bills).find((y) => y.year === 2026)!;
    const months = getSummaryMonths(bills, 2026);
    expect(months.reduce((s, m) => s + m.salesMinor, 0)).toBe(year.salesMinor);
    const oct = getSummaryDays(bills, 2026, 9);
    expect(oct.reduce((s, d) => s + d.salesMinor, 0)).toBe(months.find((m) => m.month === 9)!.salesMinor);
  });

  it('shows customer, services and price for each bill on a day', () => {
    const lines = getSummaryDayBills(bills, '2026-10-07');
    expect(lines).toHaveLength(2);
    const asha = lines.find((l) => l.customerName === 'Asha')!;
    expect(asha.services).toEqual(['Haircut', 'Beard ×2']);
    expect(asha.priceMinor).toBe(50000);
    expect(lines.find((l) => l.customerName === 'Ravi')!.services).toEqual(['Facial']);
  });

  it('a bill with no line items has no services instead of crashing', () => {
    const lines = getSummaryDayBills([bill(2026, 5, 5, 700, 'NoItems', [])], '2026-05-05');
    expect(lines[0].services).toEqual([]);
    expect(lines[0].priceMinor).toBe(700);
  });

  it('leaves out deleted bills and opening-due entries', () => {
    const mixed = [
      bill(2026, 6, 1, 1000, 'Real'),
      bill(2026, 6, 1, 9999, 'Gone', [], { status: 'deleted' }),
      bill(2026, 6, 1, 8888, 'Opening', [], { invoice_number: 'DUE-001' }),
      bill(2026, 6, 1, 7777, 'Opening2', [], { notes: 'Customer opening due balance' }),
    ];
    expect(getSummaryYears(mixed)).toEqual([{ year: 2026, billsCount: 1, salesMinor: 1000 }]);
    expect(getSummaryDayBills(mixed, '2026-06-01').map((l) => l.customerName)).toEqual(['Real']);
  });

  it('ignores bills whose date cannot be read', () => {
    const broken = [bill(2026, 6, 1, 500, 'Ok'), bill(2026, 6, 1, 500, 'Bad', [], { created_at: 'x', issued_at: 'y' })];
    expect(getSummaryYears(broken)[0].billsCount).toBe(1);
  });

  it('handles an empty or missing list', () => {
    expect(getSummaryYears([])).toEqual([]);
    expect(getSummaryYears(undefined as unknown as Bill[])).toEqual([]);
  });

  it('builds the date key in local time', () => {
    expect(dateKeyOf(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});
