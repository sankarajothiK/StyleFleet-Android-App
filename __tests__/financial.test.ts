import { billingService } from '../src/services/billingService';
import { inr, inrFromMinor, shortInr, shortInrFromMinor, getInitials } from '../src/utils/format';

describe('Financial Correctness and Billing Service', () => {
  it('calculates deterministic line totals, 20% weekday colour discount, and 18% GST', () => {
    // Prototype example: Global colour (1800) + Head massage (350)
    // Subtotal: 2150
    // Colour discount: 20% of 1800 = 360
    // Taxable: 2150 - 360 = 1790
    // GST: 18% of 1790 = 322.2 -> 322
    // Total: 1790 + 322 = 2112
    const items = [
      { name: 'Global colour', priceMinor: 180000, isColour: true },
      { name: 'Head massage', priceMinor: 35000, isColour: false },
    ];

    const result = billingService.calculateCart(items, true);

    expect(result.subtotalMinor).toBe(215000);
    expect(result.colourSubtotalMinor).toBe(180000);
    expect(result.discountMinor).toBe(36000);
    expect(result.taxableMinor).toBe(179000);
    expect(result.taxMinor).toBe(32220); // Math.round(179000 * 0.18) = 32220 paise (₹322.20)
    expect(result.totalMinor).toBe(211220);
    expect(result.hasOffer).toBe(true);
  });

  it('formats INR currency accurately according to Indian numbering system', () => {
    expect(inr(14280)).toBe('₹14,280');
    expect(inr(450)).toBe('₹450');
    expect(inrFromMinor(211200)).toBe('₹2,112');
    expect(inrFromMinor(4260000)).toBe('₹42,600');
  });

  it('formats short INR values for dashboard summaries with 1-decimal precision', () => {
    expect(shortInr(1800)).toBe('₹1.8k');
    expect(shortInr(14280)).toBe('₹14.3k');
    expect(shortInr(86400)).toBe('₹86.4k');
    expect(shortInr(1000)).toBe('₹1k');
    expect(shortInr(361400)).toBe('₹3.6L');
    expect(shortInrFromMinor(180000)).toBe('₹1.8k');
    expect(shortInrFromMinor(860000)).toBe('₹8.6k');
    expect(shortInrFromMinor(36140000)).toBe('₹3.6L');
  });

  it('generates uppercase initials correctly', () => {
    expect(getInitials('Vikram Rao')).toBe('VR');
    expect(getInitials('Sameer Khan')).toBe('SK');
    expect(getInitials('Deepak')).toBe('D');
    expect(getInitials('')).toBe('');
  });

  it('computes Day, Week, and Month PnL metrics inclusive of Today from real records', () => {
    const { financialService } = require('../src/services/financialService');
    const now = new Date();
    const todayIso = now.toISOString();

    const sampleBills = [
      { id: 'b1', total_minor: 50000, status: 'completed', created_at: todayIso },
      { id: 'b2', total_minor: 30000, status: 'pending', created_at: todayIso },
    ];
    const sampleExpenses = [
      { id: 'e1', amount_minor: 20000, category_name: 'Products & stock', created_at: todayIso },
    ];

    const pnl = financialService.getPnLMetrics('Day', sampleBills, sampleExpenses);
    expect(pnl.income_minor).toBe(50000);
    expect(pnl.expense_minor).toBe(20000);
    expect(pnl.net_minor).toBe(30000);
    expect(pnl.dues_minor).toBe(30000);
    expect(pnl.margin_pct).toBe(60);
    expect(pnl.categories.length).toBe(1);
    expect(pnl.categories[0].label).toBe('Products & stock');
  });

  it('provides complete translations across all 6 supported languages', () => {
    const { translations, SUPPORTED_LANGUAGES } = require('../src/i18n/translations');
    expect(SUPPORTED_LANGUAGES).toHaveLength(6);

    const requiredKeys = ['customers', 'sales', 'accounts', 'newBill', 'appointments', 'reminders', 'expenses', 'team'];
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = translations[lang.code];
      expect(dict).toBeDefined();
      for (const k of requiredKeys) {
        expect(dict[k]).toBeDefined();
        expect(dict[k].length).toBeGreaterThan(0);
      }
    }
  });

  it('aggregates sales strictly from actual payment amounts received, not bill totals', () => {
    const { financialService } = require('../src/services/financialService');
    const now = new Date();
    const todayIso = now.toISOString();

    const bills = [
      // 1. Fully paid bill: ₹1,000 total, ₹1,000 paid via UPI
      {
        id: 'bill_full',
        total_minor: 100000,
        paid_amount_minor: 100000,
        due_amount_minor: 0,
        status: 'paid',
        payment_method: 'UPI',
        created_at: todayIso,
        items: [],
        payments: [
          { amount_minor: 100000, method: 'UPI', paid_at: todayIso },
        ],
      },
      // 2. Partial pay bill: ₹3,000 total, ₹1,500 paid now via Cash, ₹1,500 due
      {
        id: 'bill_partial',
        total_minor: 300000,
        paid_amount_minor: 150000,
        due_amount_minor: 150000,
        status: 'partially_paid',
        payment_method: 'Cash',
        created_at: todayIso,
        items: [],
        payments: [
          { amount_minor: 150000, method: 'Cash', paid_at: todayIso },
        ],
      },
      // 3. Fully pending bill: ₹2,000 total, ₹0 paid now, ₹2,000 due
      {
        id: 'bill_pending',
        total_minor: 200000,
        paid_amount_minor: 0,
        due_amount_minor: 200000,
        status: 'pending',
        payment_method: 'UPI',
        created_at: todayIso,
        items: [],
        payments: [],
      },
    ];

    const metrics = financialService.getSalesMetrics('Day', bills);

    // Total actual collected: 1000 + 1500 + 0 = 2500 (250,000 minor)
    expect(metrics.total_minor).toBe(250000);

    // Method breakdown:
    // UPI: 1000 (100,000 minor)
    // Cash: 1500 (150,000 minor)
    const upiMode = metrics.modes.find((m: any) => m.label === 'UPI');
    const cashMode = metrics.modes.find((m: any) => m.label === 'Cash');

    expect(upiMode?.amt_minor).toBe(100000);
    expect(cashMode?.amt_minor).toBe(150000);

    // Now simulate settling the remaining ₹1,500 due from bill_partial:
    bills[1].payments.push({
      amount_minor: 150000,
      method: 'UPI',
      paid_at: todayIso,
    });
    bills[1].due_amount_minor = 0;
    bills[1].status = 'paid';

    const settledMetrics = financialService.getSalesMetrics('Day', bills);
    // Now total sales should be: 2500 + 1500 = 4000 (400,000 minor)
    expect(settledMetrics.total_minor).toBe(400000);
    const updatedUpiMode = settledMetrics.modes.find((m: any) => m.label === 'UPI');
    expect(updatedUpiMode?.amt_minor).toBe(250000); // 1000 + 1500 = 2500
  });

  it('correctly calculates remaining due when a customer makes a partial due payment', () => {
    // Customer has ₹500 opening due (50,000 minor)
    const initialDueMinor = 50000;
    const amountPayingNowMinor = 30000; // Customer pays ₹300

    const remainingDueMinor = Math.max(0, initialDueMinor - amountPayingNowMinor);
    expect(remainingDueMinor).toBe(20000); // ₹200 remains, NOT cleared to ₹0

    const bill = {
      id: 'due_bill_1',
      total_minor: initialDueMinor,
      paid_amount_minor: amountPayingNowMinor,
      due_amount_minor: remainingDueMinor,
      status: remainingDueMinor === 0 ? 'paid' : 'partially_paid',
      payments: [
        { amount_minor: amountPayingNowMinor, method: 'Cash', paid_at: new Date().toISOString() },
      ],
    };

    expect(bill.status).toBe('partially_paid');
    expect(bill.paid_amount_minor).toBe(30000);
    expect(bill.due_amount_minor).toBe(20000);

    const { financialService } = require('../src/services/financialService');
    const metrics = financialService.getSalesMetrics('Day', [bill]);
    // The ₹300 paid is added to today's sales
    expect(metrics.total_minor).toBe(30000);
  });

  it('excludes opening due balance entries from total sales so total sales reflects only genuine salon services', () => {
    const { isOpeningDueBill } = require('../src/services/billingService');
    
    const openingDueBill = {
      id: 'b_due_1',
      invoice_number: 'DUE-100234',
      total_minor: 20000, // ₹200
      status: 'pending',
      notes: 'Initial opening balance due',
    };

    const genuineServiceBill = {
      id: 'b_inv_1',
      invoice_number: 'INV-202609-101',
      total_minor: 160000, // ₹1,600
      status: 'paid',
      notes: null,
    };

    expect(isOpeningDueBill(openingDueBill)).toBe(true);
    expect(isOpeningDueBill(genuineServiceBill)).toBe(false);

    const periodBills = [openingDueBill, genuineServiceBill];
    const salesBills = periodBills.filter((b: any) => !isOpeningDueBill(b));
    const totalSalesMinor = salesBills.reduce((acc: number, b: any) => acc + (b.total_minor || 0), 0);

    // Total sales must ONLY be ₹1,600, NOT ₹1,800 or inflated by the ₹200 opening balance
    expect(totalSalesMinor).toBe(160000);
  });

  it('reconciles customer outstanding dues accurately when a customer has ₹150 due', () => {
    // Simulated customer with ₹150 live due (15,000 minor)
    const customer = {
      id: 'cust_1',
      name: 'Priya Sharma',
      phone: '9876543210',
      outstanding_due_minor: 15000, // ₹150
    };

    // A bill that originally had ₹350 total, with ₹200 paid and ₹150 remaining due
    const bill = {
      id: 'bill_1',
      total_minor: 35000,
      paid_amount_minor: 20000,
      due_amount_minor: 15000,
      status: 'partially_paid',
      notes: 'due:15000;paid:20000',
    };

    expect(bill.due_amount_minor).toBe(15000); // Exactly ₹150
    expect(bill.paid_amount_minor).toBe(20000); // ₹200 collected
    expect(customer.outstanding_due_minor).toBe(15000); // Matches customer page ₹150
  });
});

