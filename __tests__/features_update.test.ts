import AsyncStorage from '@react-native-async-storage/async-storage';
import { billingRepository } from '../src/repositories/billingRepository';
import { staffRepository } from '../src/repositories/staffRepository';
import { expenseRepository } from '../src/repositories/expenseRepository';
import { Bill, StaffMember } from '../src/types/domain';

describe('StyleFleet Features & Logic Updates Test Suite', () => {
  const shopId = 'test_shop_123';

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('100-Sales Free Tier Limit & Monotonic Counter', () => {
    it('should increment total sales count monotonically and persist across deletions', async () => {
      // Set initial count
      await AsyncStorage.setItem(`@salon_os_total_sales_count_${shopId}`, '98');
      const count1 = await billingRepository.getTotalSalesCreatedCount(shopId);
      expect(count1).toBe(98);

      // Create a sale
      const bill = await billingRepository.createBill(
        shopId,
        'Anita Sharma',
        null,
        'Owner',
        null,
        [{ name: 'Hair Spa', priceMinor: 150000 }],
        'UPI',
        0
      );
      expect(bill).toBeDefined();
      expect(bill.status).toBe('paid');

      const count2 = await billingRepository.getTotalSalesCreatedCount(shopId);
      expect(count2).toBe(99);

      // Soft delete the bill
      const deleted = await billingRepository.deleteBill(shopId, bill.id);
      expect(deleted).toBe(true);

      // Total sales created count must NOT decrease when a bill is deleted
      const count3 = await billingRepository.getTotalSalesCreatedCount(shopId);
      expect(count3).toBe(99);
    }, 15000);

    it('should block 101st sale creation on free tier', async () => {
      await AsyncStorage.setItem(`@salon_os_total_sales_count_${shopId}`, '100');

      await expect(
        billingRepository.createBill(
          shopId,
          'Test Client',
          'cust_2',
          'Owner',
          null,
          [{ name: 'Facial', priceMinor: 200000 }],
          'UPI',
          0
        )
      ).rejects.toThrow('SALES_LIMIT_REACHED');
    });
  });

  describe('30-Day Recently Deleted Bills', () => {
    it('should retrieve bills deleted within 30 days and exclude older ones', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();

      const bills: Bill[] = [
        {
          id: 'b1',
          shop_id: shopId,
          customer_id: 'c1',
          customer_name: 'Client 1',
          staff_id: null,
          staff_name: 'Owner',
          invoice_number: 'INV-001',
          status: 'deleted',
          payment_method: 'UPI',
          items: [],
          subtotal_minor: 50000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 50000,
          notes: null,
          issued_at: tenDaysAgo,
          deleted_at: tenDaysAgo,
        },
        {
          id: 'b2',
          shop_id: shopId,
          customer_id: 'c2',
          customer_name: 'Client 2',
          staff_id: null,
          staff_name: 'Owner',
          invoice_number: 'INV-002',
          status: 'deleted',
          payment_method: 'UPI',
          items: [],
          subtotal_minor: 75000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 75000,
          notes: null,
          issued_at: fortyDaysAgo,
          deleted_at: fortyDaysAgo,
        },
        {
          id: 'b3',
          shop_id: shopId,
          customer_id: 'c3',
          customer_name: 'Client 3',
          staff_id: null,
          staff_name: 'Owner',
          invoice_number: 'INV-003',
          status: 'paid',
          payment_method: 'UPI',
          items: [],
          subtotal_minor: 100000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 100000,
          notes: null,
          issued_at: now.toISOString(),
        },
      ];

      const recentlyDeleted = billingRepository.getRecentlyDeletedBills(bills);
      expect(recentlyDeleted.length).toBe(1);
      expect(recentlyDeleted[0].id).toBe('b1');
    });
  });

  describe('Stylist Rules: 10-Digit Phone & Max 3 Members', () => {
    it('should require a valid 10-digit phone number when adding a stylist', async () => {
      await expect(
        staffRepository.addStaff(shopId, 'Pooja', 'Stylist', '12345')
      ).rejects.toThrow('Valid 10-digit mobile number is required');
    });

    it('should enforce maximum 3 stylists per account', async () => {
      const existing: StaffMember[] = [
        {
          id: 's1',
          shop_id: shopId,
          name: 'Stylist 1',
          role: 'Hair Stylist',
          phone: '9876543210',
          is_active: true,
          target_amount_minor: 5000000,
          revenue_minor: 0,
          service_count: 0,
          rebook_rate: '80%',
          rating: '4.8',
          chair_utilization: '75%',
        },
        {
          id: 's2',
          shop_id: shopId,
          name: 'Stylist 2',
          role: 'Colorist',
          phone: '9876543211',
          is_active: true,
          target_amount_minor: 5000000,
          revenue_minor: 0,
          service_count: 0,
          rebook_rate: '80%',
          rating: '4.8',
          chair_utilization: '75%',
        },
        {
          id: 's3',
          shop_id: shopId,
          name: 'Stylist 3',
          role: 'Barber',
          phone: '9876543212',
          is_active: true,
          target_amount_minor: 5000000,
          revenue_minor: 0,
          service_count: 0,
          rebook_rate: '80%',
          rating: '4.8',
          chair_utilization: '75%',
        },
      ];

      await AsyncStorage.setItem(
        `@salon_os_staff_cache_${shopId}`,
        JSON.stringify(existing)
      );

      await expect(
        staffRepository.addStaff(shopId, 'Stylist 4', 'Stylist', '9876543213')
      ).rejects.toThrow('STYLIST_LIMIT_REACHED');
    });
  });

  describe('Expenses Edit and Delete', () => {
    it('should edit an expense correctly', async () => {
      const exp = await expenseRepository.addExpense(
        shopId,
        'Rent & Utilities',
        15000,
        'Studio electricity bill',
        'UPI'
      );
      expect(exp.amount_minor).toBe(1500000);

      const updated = await expenseRepository.updateExpense(shopId, exp.id, {
        amountRupees: 18000,
        note: 'Updated electricity bill',
      });

      expect(updated).toBeDefined();
      expect(updated?.amount_minor).toBe(1800000);
      expect(updated?.note).toBe('Updated electricity bill');
    });

    it('should delete an expense correctly', async () => {
      const exp = await expenseRepository.addExpense(
        shopId,
        'Snacks & Tea',
        500,
        'Coffee supplies',
        'Cash'
      );

      const deleted = await expenseRepository.deleteExpense(shopId, exp.id);
      expect(deleted).toBe(true);

      const expenses = await expenseRepository.getExpenses(shopId);
      expect(expenses.find((e) => e.id === exp.id)).toBeUndefined();
    });
  });
});
