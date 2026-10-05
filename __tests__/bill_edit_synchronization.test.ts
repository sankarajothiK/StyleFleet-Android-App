import { billingRepository } from '../src/repositories/billingRepository';
import { financialService } from '../src/services/financialService';
import { Bill } from '../src/types/domain';

describe('Bill Edit Amount Synchronization Suite', () => {
  const shopId = 'test_shop_sync_123';
  const now = new Date();
  const todayIso = now.toISOString();

  const createSampleBill = (id: string, inv: string, totalPaise: number, items: { name: string; priceMinor: number }[]): Bill => ({
    id,
    shop_id: shopId,
    customer_id: 'cust_1',
    customer_name: 'Test Customer',
    staff_id: 'staff_1',
    staff_name: 'Stylist Priya',
    invoice_number: inv,
    status: 'paid',
    subtotal_minor: totalPaise,
    discount_minor: 0,
    tax_minor: 0,
    total_minor: totalPaise,
    paid_amount_minor: totalPaise,
    due_amount_minor: 0,
    notes: `due:0;paid:${totalPaise}`,
    issued_at: '10:00 am',
    created_at: todayIso,
    payment_method: 'UPI',
    items: items.map((it) => ({
      service_id: null,
      service_name_snapshot: it.name,
      quantity: 1,
      unit_price_minor: it.priceMinor,
      discount_minor: 0,
      tax_minor: 0,
      line_total_minor: it.priceMinor,
      staff_id: null,
    })),
    payments: [
      {
        id: `pay_${id}`,
        amount_minor: totalPaise,
        method: 'UPI',
        paid_at: todayIso,
      },
    ],
  });

  it('correctly decreases sales and reports by ₹100 when a ₹600 bill is edited to ₹500', async () => {
    // Other baseline bill: ₹4,400 + ₹600 = ₹5,000 baseline
    const baselineBill = createSampleBill('b_base', 'INV-001', 440000, [{ name: 'Bridal Makeover', priceMinor: 440000 }]);
    const originalBill = createSampleBill('b_edit_1', 'INV-002', 60000, [
      { name: 'Haircut', priceMinor: 30000 },
      { name: 'Facial', priceMinor: 30000 },
    ]);

    let billsList: Bill[] = [originalBill, baselineBill];

    // Initial metrics: Total sales = ₹5,000 (500000 paise)
    const initialMetrics = financialService.getSalesMetrics('Day', billsList);
    expect(initialMetrics.total_minor).toBe(500000);

    // User edits the bill: ₹600 -> ₹500
    const updated = await billingRepository.updateBill(
      shopId,
      originalBill.id,
      {
        items: [
          { name: 'Haircut', priceMinor: 30000 },
          { name: 'Facial', priceMinor: 20000 },
        ],
        discountMinor: 0,
        paidAmountMinor: 50000,
        dueAmountMinor: 0,
      },
      originalBill
    );

    expect(updated).not.toBeNull();
    expect(updated!.total_minor).toBe(50000);
    expect(updated!.paid_amount_minor).toBe(50000);
    expect(updated!.payments?.[0]?.amount_minor).toBe(50000);

    // Replace in-place
    billsList = billsList.map((b) => (b.id === originalBill.id ? updated! : b));

    // Must be exactly 2 bills, no duplicates
    expect(billsList.length).toBe(2);

    // Sales metrics must decrease by ₹100 -> ₹4,900 (490000 paise)
    const newMetrics = financialService.getSalesMetrics('Day', billsList);
    expect(newMetrics.total_minor).toBe(490000);
    expect(initialMetrics.total_minor - newMetrics.total_minor).toBe(10000);
  });

  it('correctly increases sales and reports by ₹150 when a ₹600 bill is edited to ₹750', async () => {
    const baselineBill = createSampleBill('b_base_2', 'INV-003', 440000, [{ name: 'Bridal Makeover', priceMinor: 440000 }]);
    const originalBill = createSampleBill('b_edit_2', 'INV-004', 60000, [
      { name: 'Haircut', priceMinor: 30000 },
      { name: 'Facial', priceMinor: 30000 },
    ]);

    let billsList: Bill[] = [originalBill, baselineBill];

    const initialMetrics = financialService.getSalesMetrics('Day', billsList);
    expect(initialMetrics.total_minor).toBe(500000);

    // User edits the bill: ₹600 -> ₹750
    const updated = await billingRepository.updateBill(
      shopId,
      originalBill.id,
      {
        items: [
          { name: 'Haircut', priceMinor: 35000 },
          { name: 'Facial & Beard', priceMinor: 40000 },
        ],
        discountMinor: 0,
        paidAmountMinor: 75000,
        dueAmountMinor: 0,
      },
      originalBill
    );

    expect(updated!.total_minor).toBe(75000);
    expect(updated!.paid_amount_minor).toBe(75000);

    billsList = billsList.map((b) => (b.id === originalBill.id ? updated! : b));

    // Sales metrics must increase by ₹150 -> ₹5,150 (515000 paise)
    const newMetrics = financialService.getSalesMetrics('Day', billsList);
    expect(newMetrics.total_minor).toBe(515000);
    expect(newMetrics.total_minor - initialMetrics.total_minor).toBe(15000);
  });

  it('handles multiple edits on the same bill without cumulative error: ₹600 → ₹500 → ₹700 → ₹450', async () => {
    const originalBill = createSampleBill('b_multi', 'INV-005', 60000, [{ name: 'Haircut', priceMinor: 60000 }]);
    let billsList: Bill[] = [originalBill];

    expect(financialService.getSalesMetrics('Day', billsList).total_minor).toBe(60000);

    // Edit 1: 600 -> 500
    const edit1 = await billingRepository.updateBill(
      shopId,
      originalBill.id,
      { items: [{ name: 'Haircut', priceMinor: 50000 }], paidAmountMinor: 50000, dueAmountMinor: 0 },
      billsList[0]
    );
    billsList = billsList.map((b) => (b.id === originalBill.id ? edit1! : b));
    expect(financialService.getSalesMetrics('Day', billsList).total_minor).toBe(50000);

    // Edit 2: 500 -> 700
    const edit2 = await billingRepository.updateBill(
      shopId,
      originalBill.id,
      { items: [{ name: 'Haircut + Styling', priceMinor: 70000 }], paidAmountMinor: 70000, dueAmountMinor: 0 },
      billsList[0]
    );
    billsList = billsList.map((b) => (b.id === originalBill.id ? edit2! : b));
    expect(financialService.getSalesMetrics('Day', billsList).total_minor).toBe(70000);

    // Edit 3: 700 -> 450
    const edit3 = await billingRepository.updateBill(
      shopId,
      originalBill.id,
      { items: [{ name: 'Basic Cut', priceMinor: 45000 }], paidAmountMinor: 45000, dueAmountMinor: 0 },
      billsList[0]
    );
    billsList = billsList.map((b) => (b.id === originalBill.id ? edit3! : b));

    expect(billsList.length).toBe(1);
    expect(billsList[0].total_minor).toBe(45000);
    expect(billsList[0].paid_amount_minor).toBe(45000);
    expect(financialService.getSalesMetrics('Day', billsList).total_minor).toBe(45000);
  });

  it('synchronizes partial payments and dues when editing bills', async () => {
    const originalBill = createSampleBill('b_partial', 'INV-006', 60000, [{ name: 'Spa', priceMinor: 60000 }]);
    let billsList: Bill[] = [originalBill];

    // Edit: Total ₹500, Paid ₹300, Due ₹200
    const partialEdit = await billingRepository.updateBill(
      shopId,
      originalBill.id,
      {
        items: [{ name: 'Spa Express', priceMinor: 50000 }],
        paymentMethod: 'Partial Pay (Cash)',
        paidAmountMinor: 30000,
        dueAmountMinor: 20000,
      },
      originalBill
    );

    expect(partialEdit!.total_minor).toBe(50000);
    expect(partialEdit!.paid_amount_minor).toBe(30000);
    expect(partialEdit!.due_amount_minor).toBe(20000);
    expect(partialEdit!.status).toBe('partially_paid');

    billsList = [partialEdit!];
    // Financial metrics counts actual collected revenue (₹300)
    const metrics = financialService.getSalesMetrics('Day', billsList);
    expect(metrics.total_minor).toBe(30000);
  });

  it('retains edited amount if the bill is later soft deleted into Recently Deleted', async () => {
    const originalBill = createSampleBill('b_del_test', 'INV-007', 60000, [{ name: 'Keratin', priceMinor: 60000 }]);

    // Edit to ₹500
    const edited = await billingRepository.updateBill(
      shopId,
      originalBill.id,
      { items: [{ name: 'Keratin Express', priceMinor: 50000 }], paidAmountMinor: 50000, dueAmountMinor: 0 },
      originalBill
    );
    expect(edited!.total_minor).toBe(50000);

    // Delete bill
    await billingRepository.deleteBill(shopId, edited!.id, 'Owner', 'owner');
    const recentDel = billingRepository.getRecentlyDeletedBills([{
      ...edited!,
      status: 'deleted',
      deleted_at: new Date().toISOString(),
    }]);

    expect(recentDel.length).toBe(1);
    expect(recentDel[0].total_minor).toBe(50000);
    expect(recentDel[0].items?.[0]?.service_name_snapshot).toBe('Keratin Express');
  });
});
