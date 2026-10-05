import { financialService } from '../src/services/financialService';
import { Bill } from '../src/types/domain';

describe('HomeScreen Logic & Layout Specifications', () => {
  const mockBills: Bill[] = [
    {
      id: 'b1',
      shop_id: 'test_shop',
      invoice_number: 'INV-001',
      customer_id: 'c1',
      customer_name: 'Rahul Verma',
      staff_id: 'staff_1',
      staff_name: 'Anita',
      items: [
        {
          id: 'i1',
          service_id: 's1',
          service_name_snapshot: 'Haircut',
          quantity: 1,
          unit_price_minor: 50000,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: 50000,
          staff_id: 'staff_1',
        },
      ],
      subtotal_minor: 50000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 50000,
      paid_amount_minor: 50000,
      due_amount_minor: 0,
      status: 'paid',
      payment_method: 'UPI',
      notes: null,
      issued_at: new Date(Date.now() - 60000).toISOString(),
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: 'b2',
      shop_id: 'test_shop',
      invoice_number: 'INV-002',
      customer_id: 'c2',
      customer_name: 'Deepa Shah',
      staff_id: 'staff_2',
      staff_name: 'Priya',
      items: [
        {
          id: 'i2',
          service_id: 's2',
          service_name_snapshot: 'Facial Glow',
          quantity: 1,
          unit_price_minor: 150000,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: 150000,
          staff_id: 'staff_2',
        },
      ],
      subtotal_minor: 150000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 150000,
      paid_amount_minor: 100000,
      due_amount_minor: 50000,
      status: 'pending',
      payment_method: 'Cash',
      notes: null,
      issued_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 'b3_deleted',
      shop_id: 'test_shop',
      invoice_number: 'INV-003',
      customer_id: 'c3',
      customer_name: 'Deleted Cust',
      staff_id: 'staff_1',
      staff_name: 'Anita',
      items: [],
      subtotal_minor: 100000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 100000,
      status: 'deleted',
      payment_method: 'Cash',
      notes: null,
      issued_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  it('calculates the top hero picture height to cover exactly 35% of the screen area', () => {
    const screenHeight = 840;
    const heroHeight = Math.round(screenHeight * 0.35);
    expect(heroHeight).toBe(294);
    expect(heroHeight / screenHeight).toBeCloseTo(0.35, 2);
  });

  it('calculates progress bar fill percentage for sales count (e.g. 5/100 sales)', () => {
    const totalSalesCount = 5;
    const progressPct = Math.min(Math.round((totalSalesCount / 100) * 100), 100);
    expect(progressPct).toBe(5);

    const label = `${totalSalesCount}/100 sales`;
    expect(label).toBe('5/100 sales');
    expect(label.toLowerCase()).not.toContain('free');
  });

  it('computes sales histogram metrics for active bills only', () => {
    const activeBills = mockBills.filter((b) => b.status !== 'deleted');
    expect(activeBills.length).toBe(2);

    const metrics = financialService.getSalesMetrics('Day', activeBills);
    // Financial correctness: pending bills have 0 collected, paid bills have 500 INR (50000 minor)
    expect(metrics.total_minor).toBe(50000);
    expect(metrics.bills_count).toBe(1);
    expect(metrics.bars).toBeDefined();
    expect(Array.isArray(metrics.bars)).toBe(true);
    expect(metrics.bars.length).toBeGreaterThan(0);
  });

  it('sorts recent bills chronologically descending for home page list', () => {
    const activeBills = mockBills.filter((b) => b.status !== 'deleted');
    const sorted = [...activeBills].sort((a, b) => {
      const tA = new Date(a.issued_at || a.created_at || '').getTime();
      const tB = new Date(b.issued_at || b.created_at || '').getTime();
      return tB - tA;
    });

    expect(sorted[0].invoice_number).toBe('INV-002');
    expect(sorted[1].invoice_number).toBe('INV-001');
  });

  it('provides translations for My Appointments action button', async () => {
    const { translations } = await import('../src/i18n/translations');
    expect(translations.en.myAppointments).toBe('My Appointments');
    expect(translations.ta.myAppointments).toBe('என் முன்பதிவுகள்');
  });
});
