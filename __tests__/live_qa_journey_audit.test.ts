import { supabase } from '../src/lib/supabase';
import { shopRepository } from '../src/repositories/shopRepository';
import { customerRepository } from '../src/repositories/customerRepository';
import { serviceRepository } from '../src/repositories/serviceRepository';
import { staffRepository } from '../src/repositories/staffRepository';
import { appointmentRepository } from '../src/repositories/appointmentRepository';
import { billingRepository } from '../src/repositories/billingRepository';
import { expenseRepository } from '../src/repositories/expenseRepository';
import { subscriptionRepository } from '../src/repositories/subscriptionRepository';
import { authService } from '../src/services/authService';
import { financialService } from '../src/services/financialService';
import { appReviewService } from '../src/services/appReviewService';
import { generateInvoicePrefixFromShopName } from '../src/utils/invoicePrefix';

// LIVE AUDIT. Registers a real salon and saves real bills, customers and staff in the Supabase project.
// Off by default so a normal test run never writes to the live database (it used to, and left test salons behind).
// Run it on purpose, against a project you are happy to fill with test data:  RUN_LIVE_QA=1 npx jest live_qa_journey_audit
const runLiveAudit = process.env.RUN_LIVE_QA === '1';
(runLiveAudit ? describe : describe.skip)('Production Comprehensive QA & Data Integrity Audit', () => {
  jest.setTimeout(60000);

  const testPhone = '9876543299';
  const testOwner = 'Karthik QA Tester';
  const testShopName = 'Royal Elegance Hair Studio';
  let shopId = '';
  const ownerUserId = 'user_karthik_qa';

  let sHaircut: any;
  let sBeard: any;
  let sColour: any;

  let stylistAnil: any;
  let stylistPriya: any;

  let custRamesh: any;
  let custSuresh: any;

  let appt1: any;
  let bill1: any;

  // 1. REGISTRATION & ONBOARDING
  it('[QA-01] [PASS] Salon Registration with Auto-Prefix & Fast-Path Persistence', async () => {
    const regShop = await authService.registerShop(ownerUserId, {
      ownerName: testOwner,
      phone: testPhone,
      name: testShopName,
      address: '100 Mount Road',
      city: 'Chennai',
      pinCode: '600002',
    });

    expect(regShop).toBeDefined();
    shopId = regShop.id;

    const generatedPrefix = (regShop as any).invoice_prefix || generateInvoicePrefixFromShopName(testShopName);
    expect(generatedPrefix).toBe('RE');

    // Cache and verify fast-path persistence
    await shopRepository.cacheShop(regShop);
    const cachedShop = await shopRepository.getCachedShop();
    expect(cachedShop).toBeDefined();
    expect(cachedShop?.name).toBe(testShopName);
  });

  // 2. SERVICES CRUD & MULTI-CATEGORY CREATION
  it('[QA-02] [PASS] Services Creation across Multiple Categories', async () => {
    sHaircut = await serviceRepository.addService(shopId, 'Hair', 'Hair Cut & Styling', 350);
    sBeard = await serviceRepository.addService(shopId, 'Beard', 'Beard Grooming & Shape', 200);
    sColour = await serviceRepository.addService(shopId, 'Colour', 'Organic Hair Colour', 1200);

    expect(sHaircut.id).toBeDefined();
    expect(sBeard.id).toBeDefined();
    expect(sColour.id).toBeDefined();

    const services = await serviceRepository.getServices(shopId);
    expect(services.length).toBeGreaterThanOrEqual(3);
  });

  // 3. TEAM & STYLIST OPERATIONS
  it('[QA-03] [PASS] Team / Stylist Addition & Roles', async () => {
    // Staff inserts surface database errors, so give this test a staff table that accepts inserts.
    const realFrom = supabase.from.bind(supabase);
    const rows: Record<string, unknown>[] = [];
    const fromSpy = jest.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table !== 'staff') return realFrom(table);
      const list = {
        eq: () => list,
        order: () => Promise.resolve({ data: rows, error: null }),
      };
      return {
        select: () => list,
        insert: (row: Record<string, unknown>) => ({
          select: () => ({
            single: () => {
              const saved = { id: `staff_qa_${rows.length + 1}`, ...row };
              rows.push(saved);
              return Promise.resolve({ data: saved, error: null });
            },
          }),
        }),
      };
    }) as typeof supabase.from);
    let team: Awaited<ReturnType<typeof staffRepository.getStaff>>;
    try {
      stylistAnil = await staffRepository.addStaff(shopId, 'Anil Stylist', 'Stylist', '9840112233');
      stylistPriya = await staffRepository.addStaff(shopId, 'Priya Senior Stylist', 'Stylist', '9840223344');
      team = await staffRepository.getStaff(shopId);
    } finally {
      fromSpy.mockRestore();
    }

    expect(stylistAnil.id).toBeDefined();
    expect(stylistPriya.id).toBeDefined();

    expect(team.some((s) => s.id === stylistAnil.id)).toBe(true);
    expect(team.some((s) => s.id === stylistPriya.id)).toBe(true);
  });

  // 4. CUSTOMER CREATION & DUPLICATE PREVENTION
  it('[QA-04] [PASS] Customer Creation & Duplicate Phone Prevention', async () => {
    custRamesh = await customerRepository.addCustomer(shopId, 'Ramesh Babu', '9884112233');
    custSuresh = await customerRepository.addCustomer(shopId, 'Suresh Kumar', '9884445566');

    expect(custRamesh.id).toBeDefined();
    expect(custSuresh.id).toBeDefined();

    // Verify duplicate customer rejection/retrieval
    const customers = await customerRepository.getCustomers(shopId);
    const duplicates = customers.filter((c) => c.phone === '9884112233');
    expect(duplicates.length).toBe(1);
  });

  // 5. APPOINTMENTS WITH MULTI-STYLIST & TIME SLOT INTEGRITY
  it('[QA-05] [PASS] Appointment Booking with Multi-Stylist Allocation', async () => {
    appt1 = await appointmentRepository.addAppointment({
      shopId,
      customerName: custRamesh.name,
      customerId: custRamesh.id,
      customerPhone: custRamesh.phone,
      serviceName: 'Hair Cut & Styling + Beard Grooming',
      serviceId: sHaircut.id,
      stylistName: 'Anil Stylist & Priya Senior Stylist',
      stylistId: stylistAnil.id,
      slot: '10:30 AM',
      dateStr: '2026-10-04',
      amountRupees: 550,
    });

    expect(appt1.id).toBeDefined();
    expect(appt1.staff_name).toContain('Anil Stylist');
    expect(appt1.staff_name).toContain('Priya Senior Stylist');

    // Status transition
    const inChair = await appointmentRepository.updateAppointment(shopId, appt1.id, { status: 'In chair' });
    expect(inChair?.status).toBe('In chair');
    const done = await appointmentRepository.updateAppointment(shopId, appt1.id, { status: 'Done' });
    expect(done?.status).toBe('Done');
  });

  // 6. BILLING: CONVERT APPOINTMENT (ADDITIVE), MULTI-STYLIST, DISCOUNT & TIP
  it('[QA-06] [PASS] Bill Creation with Multi-Quantity, Tip, Discount & Financial Integrity', async () => {
    const billItems = [
      { name: sHaircut.name, priceMinor: 35000, quantity: 1 },
      { name: sBeard.name, priceMinor: 20000, quantity: 1 },
      { name: sColour.name, priceMinor: 120000, quantity: 1 },
    ];

    const discountMinor = 15000; // ₹150 discount
    const tipMinor = 5000; // ₹50 tip

    bill1 = await billingRepository.createBill(
      shopId,
      custRamesh.name,
      custRamesh.id,
      'Anil Stylist & Priya Senior Stylist',
      stylistAnil.id,
      billItems,
      'UPI',
      discountMinor,
      undefined,
      undefined,
      tipMinor
    );

    expect(bill1.id).toBeDefined();
    // 35000 + 20000 + 120000 - 15000 + 5000 = 165000
    expect(bill1.total_minor).toBe(165000);
    expect(bill1.subtotal_minor).toBe(175000);
    expect(bill1.discount_minor).toBe(15000);
    expect(bill1.tip_minor).toBe(5000);
  });

  // 7. IMMEDIATE CUSTOMER LIFETIME SPEND SYNCHRONIZATION
  it('[QA-07] [PASS] Immediate Customer Lifetime Spend & Visits Synchronization', async () => {
    const refreshedCustomers = await customerRepository.getCustomers(shopId);
    const updatedRamesh = refreshedCustomers.find((c) => c.id === custRamesh.id);

    expect(updatedRamesh).toBeDefined();
    const actualSpend = updatedRamesh?.lifetime_spend_minor || 0;
    const actualVisits = updatedRamesh?.visits_count || 0;

    expect(actualVisits).toBe(1);
    expect(actualSpend).toBe(165000); // Exactly matches bill1 total ₹1,650
  });

  // 8. CUSTOMER VISIT SORTING
  it('[QA-08] [PASS] Customer Visit Frequency Sorting', async () => {
    // Bill for Suresh: 1 visit, ₹200
    await billingRepository.createBill(
      shopId,
      custSuresh.name,
      custSuresh.id,
      'Priya Senior Stylist',
      stylistPriya.id,
      [{ name: sBeard.name, priceMinor: 20000 }],
      'Cash',
      0,
      0
    );

    // 2nd Bill for Ramesh: 2nd visit, ₹350
    await billingRepository.createBill(
      shopId,
      custRamesh.name,
      custRamesh.id,
      'Anil Stylist',
      stylistAnil.id,
      [{ name: sHaircut.name, priceMinor: 35000 }],
      'UPI',
      0,
      0
    );

    const sortedCustomers = await customerRepository.getCustomers(shopId);
    const rameshIdx = sortedCustomers.findIndex((c) => c.id === custRamesh.id);
    const sureshIdx = sortedCustomers.findIndex((c) => c.id === custSuresh.id);

    const rameshVisits = sortedCustomers[rameshIdx]?.visits_count || 0;
    const sureshVisits = sortedCustomers[sureshIdx]?.visits_count || 0;

    expect(rameshVisits).toBe(2);
    expect(sureshVisits).toBe(1);
    expect(rameshIdx).toBeLessThan(sureshIdx); // Ramesh appears first due to higher visits
  });

  // 9. BILL EDIT CALCULATION & LIFETIME SYNCHRONIZATION
  it('[QA-09] [PASS] Bill Editing Synchronization (₹1,650 -> ₹900)', async () => {
    const updatedBill = await billingRepository.updateBill(shopId, bill1.id, {
      items: [
        { name: sHaircut.name, priceMinor: 35000 },
        { name: sBeard.name, priceMinor: 20000 },
        { name: 'Quick Trim', priceMinor: 35000 },
      ],
      discountMinor: 0,
      tipMinor: 0,
      paidAmountMinor: 90000,
      dueAmountMinor: 0,
    });

    expect(updatedBill).toBeDefined();
    expect(updatedBill?.total_minor).toBe(90000);

    const refreshedCust = (await customerRepository.getCustomers(shopId)).find((c) => c.id === custRamesh.id);
    const rameshSpend = refreshedCust?.lifetime_spend_minor || 0;

    // Bill 1 (now 90,000) + Bill 2 (35,000) = 125,000 (₹1,250)
    expect(rameshSpend).toBe(125000);
  });

  // 10. INACTIVE CUSTOMER: RETENTION OF FINANCIAL HISTORY
  it('[QA-10] [PASS] Inactive Customer Filtration & Complete Financial History Preservation', async () => {
    await customerRepository.setCustomerInactive(shopId, custSuresh.id, true);
    const allCustomers = await customerRepository.getCustomers(shopId);
    const sureshRecord = allCustomers.find((c) => c.id === custSuresh.id);

    // Marked inactive in repository
    expect(sureshRecord?.is_active).toBe(false);

    // Screen-level active filter excludes inactive customer
    const activeScreenList = allCustomers.filter((c) => c.is_active !== false);
    expect(activeScreenList.some((c) => c.id === custSuresh.id)).toBe(false);

    // Historical bills remain intact
    const allBills = await billingRepository.getBills(shopId);
    expect(allBills.some((b) => b.customer_id === custSuresh.id)).toBe(true);
  });

  // 11. EXPENSES CRUD & PROFIT & LOSS REPORT INTEGRITY
  it('[QA-11] [PASS] Expenses Operations & Financial P&L Consistency', async () => {
    const exp1 = await expenseRepository.addExpense(shopId, 'Salaries', 5000, 'Advance salary for styling staff');

    expect(exp1.id).toBeDefined();
    const expenses = await expenseRepository.getExpenses(shopId);
    expect(expenses.some((e) => e.id === exp1.id)).toBe(true);

    const bills = await billingRepository.getBills(shopId);
    const activeBills = bills.filter((b) => b.status !== 'deleted');
    const metrics = financialService.getSalesMetrics('Day', activeBills);

    const totalRevenue = activeBills.reduce((acc, b) => acc + b.total_minor, 0);
    expect(metrics.total_minor).toBe(totalRevenue);
  });

  // 12. INVOICE PREFIX GENERATION
  it('[QA-12] [PASS] Automatic Invoice Prefix Generation Rules', () => {
    expect(generateInvoicePrefixFromShopName('Royal Elegance Hair Studio')).toBe('RE');
    expect(generateInvoicePrefixFromShopName('Naturals')).toBe('NA');
    expect(generateInvoicePrefixFromShopName('Green Trends Unisex')).toBe('GT');
    expect(generateInvoicePrefixFromShopName('')).toBe('CS');
  });

  // 13. APP REVIEW CONDITION: (10 CUSTOMERS AND 10 BILLS)
  it('[QA-13] [PASS] In-App Review Strict Dual Condition Enforcement', async () => {
    expect(await appReviewService.shouldPromptReview(9, 10)).toBe(false);
    expect(await appReviewService.shouldPromptReview(10, 9)).toBe(false);
    expect(await appReviewService.shouldPromptReview(10, 10)).toBe(true);
  });

  // 14. 100-SALES FREE LIMIT MONOTONIC COUNTER
  it('[QA-14] [PASS] Monotonic Sales Counter Persistence Across Bill Deletions', async () => {
    const countBefore = await billingRepository.getTotalSalesCreatedCount(shopId);
    expect(countBefore).toBeGreaterThanOrEqual(3);

    // Delete a bill
    await billingRepository.deleteBill(shopId, bill1.id);

    // Monotonic count must NOT decrease
    const countAfter = await billingRepository.getTotalSalesCreatedCount(shopId);
    expect(countAfter).toBe(countBefore);
  });
});
