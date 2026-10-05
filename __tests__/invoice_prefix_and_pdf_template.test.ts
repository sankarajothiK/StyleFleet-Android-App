import { generateInvoicePrefixFromShopName, sanitizeInvoicePrefix } from '../src/utils/invoicePrefix';
import { generateInvoiceHtml } from '../src/utils/invoicePdf';
import { shopRepository } from '../src/repositories/shopRepository';
import { billingRepository } from '../src/repositories/billingRepository';
import { Bill } from '../src/types/domain';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) || null),
    setItem: jest.fn(async (key: string, val: string) => {
      store.set(key, val);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
  };
});

// Mock Supabase
jest.mock('../src/lib/supabase', () => {
  return {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
      })),
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn().mockResolvedValue({ data: { path: 'logos/logo.jpg' }, error: null }),
          getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://supabase.co/logos/logo.jpg' } }),
        })),
      },
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      },
    },
  };
});

describe('Invoice Number Prefix & PDF Bill Template End-to-End', () => {
  describe('1. Automatic Invoice Prefix Generation from Salon Name', () => {
    test('Two words: takes first letter of each word', () => {
      expect(generateInvoicePrefixFromShopName('Cappuccino Salon')).toBe('CS');
      expect(generateInvoicePrefixFromShopName('Beauty Studio')).toBe('BS');
      expect(generateInvoicePrefixFromShopName('Royal Cuts')).toBe('RC');
    });

    test('Single word: takes first two letters', () => {
      expect(generateInvoicePrefixFromShopName('Naturals')).toBe('NA');
      expect(generateInvoicePrefixFromShopName('Cappuccino')).toBe('CA');
      expect(generateInvoicePrefixFromShopName('Nirvana')).toBe('NI');
      expect(generateInvoicePrefixFromShopName('Glow')).toBe('GL');
    });

    test('Three or more words: takes first letter of the first two words', () => {
      expect(generateInvoicePrefixFromShopName('Green Trends Unisex')).toBe('GT');
      expect(generateInvoicePrefixFromShopName('Royal Elegance Hair Studio')).toBe('RE');
      expect(generateInvoicePrefixFromShopName('Cappuccino Hair Studio')).toBe('CH');
      expect(generateInvoicePrefixFromShopName('The Luxury Hair Lounge')).toBe('TL');
    });

    test('Numbers and symbols ignored', () => {
      expect(generateInvoicePrefixFromShopName('123 Naturals!')).toBe('NA');
      expect(generateInvoicePrefixFromShopName('Green & Trends')).toBe('GT');
    });

    test('Sanitization and formatting of owner-edited prefix', () => {
      expect(sanitizeInvoicePrefix('cs')).toBe('CS');
      expect(sanitizeInvoicePrefix('csal')).toBe('CSAL');
      expect(sanitizeInvoicePrefix('cap')).toBe('CAP');
      expect(sanitizeInvoicePrefix('cs26')).toBe('CS26');
      expect(sanitizeInvoicePrefix('  cs-26  ')).toBe('CS-26');
      expect(sanitizeInvoicePrefix('!@#$%^&*()_+')).toBe('CS'); // fallback when stripped to empty
      expect(sanitizeInvoicePrefix('invalid!@#$%^&*()_+')).toBe('INVALID');
    });
  });

  describe('2. Shop Profile & Supabase Prefix Persistence', () => {
    test('Can save and retrieve custom invoice prefix', async () => {
      const shopId = 'shop_test_123';
      
      // Initially auto-generates from name
      const initial = await shopRepository.getInvoicePrefix(shopId, 'Cappuccino Salon');
      expect(initial).toBe('CS');

      // Owner manually edits prefix to CAP
      const saved = await shopRepository.setInvoicePrefix(shopId, 'CAP');
      expect(saved).toBe('CAP');

      // Subsequent retrieval returns saved prefix CAP (persisted across restarts)
      const retrieved = await shopRepository.getInvoicePrefix(shopId, 'Cappuccino Salon');
      expect(retrieved).toBe('CAP');
    });
  });

  describe('3. Invoice Number Generation & Sequence Continuity', () => {
    test('Generates invoice number with configured prefix and increments sequence', async () => {
      const shopId = 'shop_invoice_test';
      await shopRepository.setInvoicePrefix(shopId, 'CS');
      await shopRepository.setInvoiceNumberingMode(shopId, 'yearly');

      // Seed cached bills
      jest.spyOn(billingRepository as any, 'getCachedBills').mockResolvedValueOnce([
        { id: 'b1', invoice_number: 'CS-2026-0001' } as any,
      ]);

      const nextInv = await billingRepository.generateNextInvoiceNumber(shopId, new Date(2026, 9, 2));
      expect(nextInv).toBe('CS-2026-0002');
    });

    test('Changing prefix preserves sequence and does NOT alter old invoice numbers', async () => {
      const shopId = 'shop_prefix_change_test';
      // Old bill was created with CS
      const oldBill: Bill = {
        id: 'bill_042',
        shop_id: shopId,
        customer_id: 'cust_1',
        customer_name: 'John Doe',
        staff_id: 'staff_1',
        staff_name: 'Alex',
        invoice_number: 'CS-2026-0042',
        status: 'paid',
        subtotal_minor: 60000,
        discount_minor: 0,
        tax_minor: 0,
        total_minor: 60000,
        paid_amount_minor: 60000,
        due_amount_minor: 0,
        notes: null,
        issued_at: '2026-10-02T10:00:00Z',
        payment_method: 'upi',
        items: [{ service_id: null, service_name_snapshot: 'Haircut', quantity: 1, unit_price_minor: 60000, discount_minor: 0, tax_minor: 0, line_total_minor: 60000, staff_id: null }],
      };

      // Owner changes prefix to CAP
      await shopRepository.setInvoicePrefix(shopId, 'CAP');
      await shopRepository.setInvoiceNumberingMode(shopId, 'yearly');

      jest.spyOn(billingRepository as any, 'getCachedBills').mockResolvedValueOnce([oldBill]);

      // Next new invoice uses CAP and increments from 0042 -> 0043
      const nextInv = await billingRepository.generateNextInvoiceNumber(shopId, new Date(2026, 9, 2));
      expect(nextInv).toBe('CAP-2026-0043');

      // Editing the old bill preserves CS-2026-0042
      jest.spyOn(billingRepository as any, 'getCachedBills').mockResolvedValueOnce([oldBill]);
      const updatedBill = await billingRepository.updateBill(
        shopId,
        oldBill.id,
        {
          items: [{ name: 'Haircut', priceMinor: 50000 }],
        },
        oldBill
      );

      expect(updatedBill).not.toBeNull();
      expect(updatedBill?.invoice_number).toBe('CS-2026-0042'); // MUST retain original invoice number
      expect(updatedBill?.total_minor).toBe(50000);
    });
  });

  describe('4. PDF Bill Template & Visual Reference Fidelity', () => {
    test('Generates HTML matching template specifications with dynamic salon data', () => {
      const bill: Bill = {
        id: 'bill_pdf_test',
        shop_id: 'shop_1',
        customer_id: 'cust_1',
        customer_name: 'Priya Sharma',
        staff_id: 'staff_1',
        staff_name: 'Karan Stylist',
        invoice_number: 'CS-2026-0001',
        status: 'paid',
        subtotal_minor: 170000, // ₹1,700
        discount_minor: 10000,  // ₹100
        tax_minor: 0,
        total_minor: 160000,    // ₹1,600
        paid_amount_minor: 160000,
        due_amount_minor: 0,
        notes: null,
        issued_at: '2026-10-02T14:30:00Z',
        payment_method: 'upi',
        items: [
          { service_id: null, service_name_snapshot: 'Hair Cut', quantity: 1, unit_price_minor: 30000, discount_minor: 0, tax_minor: 0, line_total_minor: 30000, staff_id: null },
          { service_id: null, service_name_snapshot: 'Hair Spa', quantity: 1, unit_price_minor: 80000, discount_minor: 0, tax_minor: 0, line_total_minor: 80000, staff_id: null },
          { service_id: null, service_name_snapshot: 'Facial', quantity: 1, unit_price_minor: 60000, discount_minor: 0, tax_minor: 0, line_total_minor: 60000, staff_id: null },
        ],
      };

      const html = generateInvoiceHtml({
        bill,
        shopName: 'Cappuccino Salon',
        shopAddress: '123 Luxury Road, Chennai - 600001',
        shopPhone: '9876543210',
        shopEmail: 'hello@cappuccinosalon.com',
        customerPhone: '9123456780',
      });

      // Template styling checks
      expect(html).toContain('#0B132B'); // Midnight Navy Header Banner
      expect(html).toContain('#C5A059'); // Luxury Gold Accent
      expect(html).toContain('INVOICE');
      expect(html).toContain('CS-2026-0001'); // Configured Invoice Number
      expect(html).toContain('Cappuccino Salon');
      expect(html).toContain('123 Luxury Road, Chennai - 600001');
      expect(html).toContain('Priya Sharma');
      expect(html).toContain('+91 91234 56780'); // Formatted customer phone

      // Service table checks
      expect(html).toContain('Hair Cut');
      expect(html).toContain('Hair Spa');
      expect(html).toContain('Facial');
      expect(html).toContain('Karan Stylist');
      expect(html).toContain('TOTAL AMOUNT');
      expect(html).toContain('₹1,600');
      expect(html).toContain('– ₹100'); // Discount
      expect(html).toContain('[PAID]');
      expect(html).toContain('via UPI');

      // Verify colors: bright white table headers, white on navy, dark black text in table
      expect(html).toContain('.total-amount-val {\n      font-size: 22px;\n      font-weight: 800;\n      color: #FFFFFF;');
      expect(html).toContain('thead th {\n      color: #FFFFFF !important;');
      expect(html).toContain('tbody td.col-service {\n      font-weight: 600;\n      color: #000000;');
      expect(html).toContain('tbody td.col-staff {\n      font-weight: 500;\n      color: #000000;');
      expect(html).toContain('STYLIST');

      // Footer card & StyleFleet branding
      expect(html).toContain('Thank you for visiting');
      expect(html).toContain('We look forward to serving you again!');
      expect(html).toContain('POWERED BY STYLEFLEET · CAPPUCCINO SALON');
    });

    test('Partially paid bill displays PARTIAL badge and accurate balance due', () => {
      const bill: Bill = {
        id: 'bill_partial_test',
        shop_id: 'shop_1',
        customer_id: 'cust_1',
        customer_name: 'Rahul V',
        staff_id: 'staff_1',
        staff_name: 'Sneha',
        invoice_number: 'CS-2026-0002',
        status: 'partially_paid',
        subtotal_minor: 200000, // ₹2,000
        discount_minor: 0,
        tax_minor: 0,
        total_minor: 200000,
        paid_amount_minor: 120000, // ₹1,200 paid
        due_amount_minor: 80000,   // ₹800 due
        notes: 'due:80000;paid:120000;',
        issued_at: '2026-10-02T15:00:00Z',
        payment_method: 'cash',
        items: [
          { service_id: null, service_name_snapshot: 'Keratin Treatment', quantity: 1, unit_price_minor: 200000, discount_minor: 0, tax_minor: 0, line_total_minor: 200000, staff_id: null },
        ],
      };

      const html = generateInvoiceHtml({
        bill,
        shopName: 'Cappuccino Salon',
      });

      expect(html).toContain('[PARTIAL]');
      expect(html).toContain('via CASH');
      expect(html).toContain('₹1,200'); // Paid
      expect(html).toContain('₹800');   // Due
    });
  });
});
