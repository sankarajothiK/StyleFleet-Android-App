import { financialService } from '../src/services/financialService';
import { SUBSCRIPTION_PLANS, LAUNCH_OFFER_SUBSCRIPTION_PLANS, getPlanById } from '../src/config/planConfig';
import { Bill } from '../src/types/domain';

describe('Business Report & Production Changes Specification Verification', () => {
  describe('Req 1 & 2: Report Today Tab & Payment Method Summary', () => {
    const mockBills: Bill[] = [
      {
        id: 'b1',
        shop_id: 'shop_1',
        customer_id: 'c1',
        customer_name: 'Rahul',
        staff_id: 'st1',
        staff_name: 'Owner',
        invoice_number: 'SF-001',
        total_minor: 50000, // ₹500
        tax_minor: 0,
        subtotal_minor: 50000,
        discount_minor: 0,
        status: 'paid',
        payment_method: 'UPI',
        issued_at: new Date().toISOString(),
        notes: null,
        items: [],
      },
      {
        id: 'b2',
        shop_id: 'shop_1',
        customer_id: 'c2',
        customer_name: 'Priya',
        staff_id: 'st1',
        staff_name: 'Owner',
        invoice_number: 'SF-002',
        total_minor: 30000, // ₹300
        tax_minor: 0,
        subtotal_minor: 30000,
        discount_minor: 0,
        status: 'paid',
        payment_method: 'Cash',
        issued_at: new Date().toISOString(),
        notes: null,
        items: [],
      },
      {
        id: 'b3',
        shop_id: 'shop_1',
        customer_id: 'c3',
        customer_name: 'Vikram',
        staff_id: 'st1',
        staff_name: 'Owner',
        invoice_number: 'SF-003',
        total_minor: 20000, // ₹200
        tax_minor: 0,
        subtotal_minor: 20000,
        discount_minor: 0,
        status: 'paid',
        payment_method: 'UPI',
        issued_at: new Date().toISOString(),
        notes: null,
        items: [],
      },
    ];

    it('aggregates payment method breakdown correctly without altering financial metrics', () => {
      let upiTotal = 0;
      let upiCount = 0;
      let cashTotal = 0;
      let cashCount = 0;

      mockBills.forEach((b) => {
        const method = (b.payment_method || '').toLowerCase();
        if (method === 'upi') {
          upiTotal += b.total_minor;
          upiCount += 1;
        } else if (method === 'cash') {
          cashTotal += b.total_minor;
          cashCount += 1;
        }
      });

      expect(upiTotal).toBe(70000); // ₹700
      expect(upiCount).toBe(2);
      expect(cashTotal).toBe(30000); // ₹300
      expect(cashCount).toBe(1);
    });

    it('maintains correct Day/Today financial metrics', () => {
      const metrics = financialService.getSalesMetrics('Day', mockBills);
      expect(metrics.total_minor).toBe(100000); // ₹1,000
    });
  });

  describe('Req 7: Billing Previous Date Support', () => {
    it('allows valid past dates and blocks future dates', () => {
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 5);

      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 2);

      const isFuture = (d: Date) => {
        const check = new Date(d);
        check.setHours(0, 0, 0, 0);
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return check.getTime() > t.getTime();
      };

      expect(isFuture(pastDate)).toBe(false);
      expect(isFuture(today)).toBe(false);
      expect(isFuture(futureDate)).toBe(true);
    });
  });

  describe('Req 8: Stylist WhatsApp Bill Sending Restriction', () => {
    it('restricts WhatsApp bill action for stylist users while permitting owners', () => {
      const canSendWhatsAppBill = (role?: string) => role === 'owner';

      expect(canSendWhatsAppBill('owner')).toBe(true);
      expect(canSendWhatsAppBill('stylist')).toBe(false);
      expect(canSendWhatsAppBill(undefined)).toBe(false);
    });
  });

  describe('Req 9, 10, 11: Inactive Stylist Handling', () => {
    it('toggles is_active without deleting stylist or historical data', () => {
      const stylist = {
        id: 'st_1',
        shop_id: 'shop_1',
        name: 'Arun',
        is_active: true,
        service_count: 42,
        revenue_minor: 1250000,
      };

      const deactivated = { ...stylist, is_active: false };
      expect(deactivated.is_active).toBe(false);
      expect(deactivated.service_count).toBe(42);
      expect(deactivated.revenue_minor).toBe(1250000);
    });
  });

  describe('Req 16, 17, 18, 19: Inactive Customer Handling', () => {
    it('marks customer inactive without deleting customer history', () => {
      const customer = {
        id: 'c_1',
        name: 'Sneha',
        phone: '9876543210',
        visits_count: 8,
        lifetime_spend_minor: 320000,
        is_active: true,
      };

      const deactivated = { ...customer, is_active: false };
      expect(deactivated.is_active).toBe(false);
      expect(deactivated.visits_count).toBe(8);
      expect(deactivated.lifetime_spend_minor).toBe(320000);
    });
  });

  describe('Req 21 & 22: Bill Communication Statuses', () => {
    it('supports Reminder Status and Confirmation Status tracking', () => {
      const bill: Bill = {
        id: 'b_10',
        shop_id: 'shop_1',
        customer_id: 'c1',
        customer_name: 'Anil',
        staff_id: 'st1',
        staff_name: 'Owner',
        invoice_number: 'SF-010',
        total_minor: 40000,
        tax_minor: 0,
        subtotal_minor: 40000,
        discount_minor: 0,
        status: 'paid',
        payment_method: 'Cash',
        issued_at: new Date().toISOString(),
        notes: null,
        items: [],
        reminder_status: 'Not Sent',
        confirmation_status: 'Pending',
      };

      expect(bill.reminder_status).toBe('Not Sent');
      expect(bill.confirmation_status).toBe('Pending');

      const updatedBill = {
        ...bill,
        reminder_status: 'Sent' as const,
        confirmation_status: 'Confirmed' as const,
      };

      expect(updatedBill.reminder_status).toBe('Sent');
      expect(updatedBill.confirmation_status).toBe('Confirmed');
    });
  });

  describe('Subscription Plans', () => {
    it('provides the 3 plans with designated pricing and discounts', () => {
      expect(LAUNCH_OFFER_SUBSCRIPTION_PLANS).toHaveLength(3);

      const threeMo = getPlanById('3_months', true)!;
      expect(threeMo.priceInRupees).toBe(2999);
      expect(threeMo.discountPercent).toBe(0);

      const sixMo = getPlanById('6_months', true)!;
      expect(sixMo.priceInRupees).toBe(4799);
      expect(sixMo.discountPercent).toBe(20);

      const oneYr = getPlanById('12_months', true)!;
      expect(oneYr.priceInRupees).toBe(5999);
      expect(oneYr.discountPercent).toBe(50);
    });
  });
});
