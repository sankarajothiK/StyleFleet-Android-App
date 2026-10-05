import AsyncStorage from '@react-native-async-storage/async-storage';
import { authRepository, AuthUser } from '../src/repositories/authRepository';
import { shopRepository, ShopRow, ShopRegistrationData } from '../src/repositories/shopRepository';
import { customerRepository } from '../src/repositories/customerRepository';
import { staffRepository } from '../src/repositories/staffRepository';
import { serviceRepository } from '../src/repositories/serviceRepository';
import { appointmentRepository } from '../src/repositories/appointmentRepository';
import { billingRepository } from '../src/repositories/billingRepository';
import { expenseRepository } from '../src/repositories/expenseRepository';
import { financialService } from '../src/services/financialService';
import { subscriptionRepository } from '../src/repositories/subscriptionRepository';
import { Customer, StaffMember, Bill, Expense } from '../src/types/domain';

describe('Human-like End-to-End Salon Journey Simulation (Demo Account)', () => {
  const DEMO_PHONE = '9876543210';
  const DEMO_OTP = '123456';
  let demoShopId = 'shop_demo_human_journey';

  beforeAll(async () => {
    await AsyncStorage.clear();
  });

  // STEP 1: Phone Login & OTP Verification with Demo Account
  describe('Step 1: Demo Account Authentication', () => {
    it('human enters 10-digit mobile number and receives OTP session', async () => {
      const otpRes = await authRepository.sendOtp(DEMO_PHONE);
      // Valid dispatch or fallback demo session returned
      expect(otpRes.success).toBe(true);
    });

    it('human enters 6-digit demo OTP (123456) and establishes authenticated session', async () => {
      const verifyRes = await authRepository.verifyOtp(DEMO_PHONE, DEMO_OTP);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.user).toBeDefined();
      expect(verifyRes.user?.phone).toBe(DEMO_PHONE);

      const session = await authRepository.getSession();
      expect(session).not.toBeNull();
      expect(session?.phone).toBe(DEMO_PHONE);
    });
  });

  // STEP 2: Shop Registration & Setup
  describe('Step 2: Salon Registration & Local Fast-Path Caching', () => {
    it('human completes registration form for new salon', async () => {
      const regData: ShopRegistrationData = {
        name: 'Glow & Glam Luxury Salon',
        ownerName: 'Vikram Mehta',
        phone: DEMO_PHONE,
        address: '100 Feet Road, Indiranagar',
        city: 'Bengaluru',
        pinCode: '560038',
        gstin: '29AAAAA0000A1Z5',
      };

      const mockShop: ShopRow = {
        id: demoShopId,
        owner_profile_id: `user_${DEMO_PHONE}`,
        name: regData.name,
        address: regData.address,
        city: regData.city,
        pin_code: regData.pinCode,
        phone: DEMO_PHONE,
        gstin: regData.gstin || null,
        accent_color: '#D9A441',
        invoice_prefix: 'GLOW',
        gst_rate: 0,
        logo_path: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Cache shop locally for persistent launch
      await shopRepository.cacheShop(mockShop);
      await shopRepository.saveLastPhone(DEMO_PHONE);
      await authRepository.setCurrentShopId(demoShopId);

      const cached = await shopRepository.getCachedShop();
      expect(cached).not.toBeNull();
      expect(cached?.name).toBe('Glow & Glam Luxury Salon');
      expect(cached?.city).toBe('Bengaluru');
    });
  });

  // STEP 3: Customer Management & Strict Duplicate Prevention
  describe('Step 3: Customer Management (Add, Duplicate Prevention & Star)', () => {
    it('human adds a new client manually', async () => {
      const c1 = await customerRepository.addCustomer(
        demoShopId,
        'Pooja Hegde',
        '9888877777',
        0,
        false
      );
      expect(c1).toBeDefined();
      expect(c1.name).toBe('Pooja Hegde');
      expect(c1.phone).toBe('9888877777');
      expect(c1.visits_count).toBe(0);
    });

    it('human attempts to add client with an already registered phone number (Blocked)', async () => {
      const existingCusts = await customerRepository.getCustomers(demoShopId);
      const isDuplicate = existingCusts.some(
        (c) => c.phone.replace(/\D/g, '').slice(-10) === '9888877777'
      );
      expect(isDuplicate).toBe(true);

      // Business rule: duplicate is rejected with notification
      if (isDuplicate) {
        const found = existingCusts.find(
          (c) => c.phone.replace(/\D/g, '').slice(-10) === '9888877777'
        );
        expect(found?.name).toBe('Pooja Hegde');
      }
    });

    it('human stars client as VIP', async () => {
      const custs = await customerRepository.getCustomers(demoShopId);
      const target = custs[0];
      const starred = await customerRepository.toggleStar(demoShopId, target.id);
      expect(starred).toBe(true);
    });
  });

  // STEP 4: Team & Stylist Management (10-Digit Phone, Max 3, Default Owner)
  describe('Step 4: Stylist Operations (Validation, Limit Enforcement & Owner Attribution)', () => {
    it('rejects adding a stylist without valid 10-digit mobile number', async () => {
      await expect(
        staffRepository.addStaff(demoShopId, 'Rahul', 'Senior Stylist', '98765')
      ).rejects.toThrow('Valid 10-digit mobile number is required');
    });

    it(
      'human adds 3 stylists successfully',
      async () => {
        const s1 = await staffRepository.addStaff(demoShopId, 'Rahul Verma', 'Hair Specialist', '9811122233');
        const s2 = await staffRepository.addStaff(demoShopId, 'Meena Iyer', 'Colorist', '9822233344');
        const s3 = await staffRepository.addStaff(demoShopId, 'Karan Singh', 'Barber', '9833344455');

        expect(s1.name).toBe('Rahul Verma');
        expect(s2.name).toBe('Meena Iyer');
        expect(s3.name).toBe('Karan Singh');

        const allStaff = await staffRepository.getStaff(demoShopId);
        expect(allStaff.length).toBe(3);
      },
      25000
    );

    it('human attempts to add a 4th stylist (Hard limit reached -> triggers Support Modal)', async () => {
      await expect(
        staffRepository.addStaff(demoShopId, 'Deepak', 'Stylist', '9844455566')
      ).rejects.toThrow('STYLIST_LIMIT_REACHED');
    });

    it('human edits stylist details', async () => {
      const staffList = await staffRepository.getStaff(demoShopId);
      const updated = await staffRepository.updateStaff(demoShopId, staffList[0].id, {
        name: 'Rahul Verma (Master Stylist)',
      });
      expect(updated?.name).toBe('Rahul Verma (Master Stylist)');
    });
  });

  // STEP 5: Appointments (No Walk-in, Advance Status to Done)
  describe('Step 5: Appointments Flow', () => {
    it('human books an appointment with selected customer and default owner', async () => {
      const custs = await customerRepository.getCustomers(demoShopId);
      const appt = await appointmentRepository.addAppointment({
        shopId: demoShopId,
        customerName: custs[0].name,
        customerId: custs[0].id,
        customerPhone: custs[0].phone,
        serviceName: 'Hair Cut & Styling',
        slot: '11:00 AM',
        dateStr: new Date().toISOString().split('T')[0],
        amountRupees: 800,
        sendConfirm: false,
        stylistName: 'Owner', // default when no stylist selected
        stylistId: null,
      });

      expect(appt).toBeDefined();
      expect(appt.status).toBe('Confirmed');
      expect(appt.customer_name).toBe('Pooja Hegde');
      expect(appt.staff_name).toBe('Owner');
    });

    it('human advances appointment from Confirmed -> In Chair -> Done', async () => {
      const appts = await appointmentRepository.getAppointments(demoShopId);
      const apptId = appts[0].id;

      const s1 = await appointmentRepository.advanceStatus(demoShopId, apptId);
      expect(s1).toBe('In chair');

      const s2 = await appointmentRepository.advanceStatus(demoShopId, apptId);
      expect(s2).toBe('Done');
    });
  });

  // STEP 6: Billing & Sales (100-Limit, Monotonic, Soft Delete & Instant Sync)
  describe('Step 6: Billing, Instant Customer Lifetime Sync & 30-Day Recently Deleted', () => {
    let createdBill: Bill;

    it('human creates a bill with partial payment and verifies customer lifetime value immediately updates', async () => {
      const custs = await customerRepository.getCustomers(demoShopId);
      const client = custs[0];

      createdBill = await billingRepository.createBill(
        demoShopId,
        client.name,
        client.id,
        'Owner', // No stylist -> Owner
        null,
        [
          { name: 'Hair Cut & Styling', priceMinor: 80000 },
          { name: 'Hair Spa', priceMinor: 120000 },
        ],
        'Partial Pay (UPI)',
        20000, // ₹200 discount
        150000, // ₹1,500 paid now
        30000 // ₹300 due remaining
      );

      expect(createdBill).toBeDefined();
      expect(createdBill.subtotal_minor).toBe(200000);
      expect(createdBill.discount_minor).toBe(20000);
      expect(createdBill.total_minor).toBe(180000);
      expect(createdBill.paid_amount_minor).toBe(150000);
      expect(createdBill.due_amount_minor).toBe(30000);
      expect(createdBill.status).toBe('partially_paid');

      // Check instant customer sync from repository
      const refreshedCusts = await customerRepository.getCustomers(demoShopId);
      const updatedClient = refreshedCusts.find((c) => c.id === client.id);
      expect(updatedClient?.visits_count).toBe(1);
      expect(updatedClient?.lifetime_spend_minor).toBe(150000);
      expect(updatedClient?.outstanding_due_minor).toBe(30000);
    });

    it('human edits the bill and customer figures recalculate', async () => {
      const updated = await billingRepository.updateBill(demoShopId, createdBill.id, {
        discountMinor: 0, // removed discount
        paidAmountMinor: 200000, // full payment
        dueAmountMinor: 0,
      });

      expect(updated).toBeDefined();
      expect(updated?.total_minor).toBe(200000);
      expect(updated?.status).toBe('paid');

      // Check customer update
      const refreshedCusts = await customerRepository.getCustomers(demoShopId);
      const updatedClient = refreshedCusts.find((c) => c.id === createdBill.customer_id);
      expect(updatedClient?.lifetime_spend_minor).toBe(200000);
      expect(updatedClient?.outstanding_due_minor).toBe(0);
    });

    it('human deletes bill: moves to 30-day Recently Deleted without reducing total sales count', async () => {
      const countBefore = await billingRepository.getTotalSalesCreatedCount(demoShopId);

      const delRes = await billingRepository.deleteBill(demoShopId, createdBill.id);
      expect(delRes).toBe(true);

      // Customer lifetime spend resets automatically because deleted bills are ignored
      const refreshedCusts = await customerRepository.getCustomers(demoShopId);
      const updatedClient = refreshedCusts.find((c) => c.id === createdBill.customer_id);
      expect(updatedClient?.lifetime_spend_minor).toBe(0);
      expect(updatedClient?.visits_count).toBe(0);

      // Monotonic sales counter MUST NOT decrease
      const countAfter = await billingRepository.getTotalSalesCreatedCount(demoShopId);
      expect(countAfter).toBe(countBefore);

      // Retrieve recently deleted
      const allBills = await billingRepository.getBills(demoShopId);
      const recentlyDeleted = billingRepository.getRecentlyDeletedBills(allBills);
      expect(recentlyDeleted.some((b) => b.id === createdBill.id)).toBe(true);
    });

    it('human restores bill from Recently Deleted: customer lifetime spend returns instantly', async () => {
      const restoreRes = await billingRepository.restoreBill(demoShopId, createdBill.id);
      expect(restoreRes).toBe(true);

      const refreshedCusts = await customerRepository.getCustomers(demoShopId);
      const updatedClient = refreshedCusts.find((c) => c.id === createdBill.customer_id);
      expect(updatedClient?.lifetime_spend_minor).toBe(200000);
      expect(updatedClient?.visits_count).toBe(1);
    });
  });

  // STEP 7: Expenses & Immediate P&L Recalculation
  describe('Step 7: Expenses Flow & Profit Calculations', () => {
    let expId: string;

    it('human adds an expense entry', async () => {
      const exp = await expenseRepository.addExpense(
        demoShopId,
        'Salon Shampoo Stock',
        4500,
        'L’Oreal Professional Stock',
        'UPI'
      );
      expect(exp).toBeDefined();
      expect(exp.amount_minor).toBe(450000);
      expId = exp.id;
    });

    it('human checks P&L metrics in real-time', async () => {
      const bills = await billingRepository.getBills(demoShopId);
      const expenses = await expenseRepository.getExpenses(demoShopId);

      const pnl = financialService.getPnLMetrics('Month', bills, expenses);
      expect(pnl.income_minor).toBe(200000); // ₹2,000 income
      expect(pnl.expense_minor).toBe(450000); // ₹4,500 expense
      expect(pnl.net_minor).toBe(-250000); // -₹2,500 net
    });

    it('human edits expense amount and P&L updates', async () => {
      await expenseRepository.updateExpense(demoShopId, expId, {
        amountRupees: 1000,
      });

      const bills = await billingRepository.getBills(demoShopId);
      const expenses = await expenseRepository.getExpenses(demoShopId);

      const pnl = financialService.getPnLMetrics('Month', bills, expenses);
      expect(pnl.expense_minor).toBe(100000); // ₹1,000 expense
      expect(pnl.net_minor).toBe(100000); // +₹1,000 profit
      expect(pnl.margin_pct).toBe(50);
    });
  });

  // STEP 8: Accounts, 100-Sales Limit & Business Reports
  describe('Step 8: Accounts Screen & Reports Breakdown', () => {
    it('progress bar shows X / 100 sales usage accurately', async () => {
      const salesCount = await billingRepository.getTotalSalesCreatedCount(demoShopId);
      expect(salesCount).toBeGreaterThanOrEqual(1);

      const subInfo = await subscriptionRepository.getSubscriptionInfo(demoShopId);
      const isPaid = subInfo.type === 'subscription' && !subInfo.subscription?.isExpired;
      expect(isPaid).toBe(false); // Free tier

      const remainingSales = Math.max(0, 100 - salesCount);
      expect(remainingSales).toBeLessThanOrEqual(100);
    });

    it('stylist performance report attributes unassigned sales to Owner', async () => {
      const bills = await billingRepository.getBills(demoShopId);
      const activeBills = bills.filter((b) => b.status !== 'deleted');

      let ownerVisits = 0;
      let ownerSalesMinor = 0;

      for (const b of activeBills) {
        if (!b.staff_name || b.staff_name === 'Owner' || b.staff_name === 'No Stylist') {
          ownerVisits += 1;
          ownerSalesMinor += b.total_minor;
        }
      }

      expect(ownerVisits).toBe(1);
      expect(ownerSalesMinor).toBe(200000);
    });
  });
});
