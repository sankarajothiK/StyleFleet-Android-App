import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeSupabase, FakeCall, FakeResult } from './helpers/fakeSupabase';

let mockFrom: (table: string) => unknown = () => ({});
jest.mock('../src/lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

// eslint-disable-next-line import/first
import { billingRepository } from '../src/repositories/billingRepository';
// eslint-disable-next-line import/first
import { appointmentRepository } from '../src/repositories/appointmentRepository';
// eslint-disable-next-line import/first
import { staffRepository } from '../src/repositories/staffRepository';
// eslint-disable-next-line import/first
import { expenseRepository } from '../src/repositories/expenseRepository';
// eslint-disable-next-line import/first
import { Appointment, Bill, Expense, StaffMember } from '../src/types/domain';

const SHOP = '00000000-0000-4000-8000-0000000000f1';
const CUSTOMER = '00000000-0000-4000-8000-0000000000f2';
const STYLIST = '00000000-0000-4000-8000-0000000000f3';
const BILL = '00000000-0000-4000-8000-0000000000f4';
const ITEM_OLD = '00000000-0000-4000-8000-0000000000f5';
const APPT = '00000000-0000-4000-8000-0000000000f6';
const EXPENSE = '00000000-0000-4000-8000-0000000000f7';

const items = [{ name: 'Haircut', priceMinor: 30000 }];

function install(responder: (c: FakeCall) => FakeResult | undefined = () => undefined) {
  const fake = createFakeSupabase(responder);
  mockFrom = fake.from;
  return fake;
}

const failOn = (table: string, op: FakeCall['op'], message = 'boom', code?: string) =>
  (c: FakeCall): FakeResult | undefined =>
    c.table === table && c.op === op ? { error: { message, code } } : undefined;

const cached = async <T,>(key: string): Promise<T[]> => {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T[]) : [];
};

beforeEach(async () => {
  await AsyncStorage.clear();
  mockFrom = () => ({});
});

describe('saving a bill', () => {
  it('saves the stylist on the line items only when it is a real id (the lost-items bug)', async () => {
    const fake = install();
    await billingRepository.createBill(SHOP, 'Asha', CUSTOMER, 'Ravi', 'staff_1759800000000', items, 'UPI');

    const itemInsert = fake.callsTo('bill_items', 'insert')[0];
    expect(itemInsert).toBeDefined();
    const rows = itemInsert.payload as { staff_id: string | null }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].staff_id).toBeNull(); // not the invalid id, which would fail the whole insert

    const billInsert = fake.callsTo('bills', 'insert')[0];
    expect((billInsert.payload as { staff_id: string | null }).staff_id).toBeNull();
  });

  it('keeps a valid stylist id on both the bill and its items', async () => {
    const fake = install();
    await billingRepository.createBill(SHOP, 'Asha', CUSTOMER, 'Ravi', STYLIST, items, 'UPI');
    expect((fake.callsTo('bills', 'insert')[0].payload as { staff_id: string }).staff_id).toBe(STYLIST);
    expect((fake.callsTo('bill_items', 'insert')[0].payload as { staff_id: string }[])[0].staff_id).toBe(STYLIST);
  });

  it('saves the bill, its items and its payment', async () => {
    const fake = install();
    const bill = await billingRepository.createBill(SHOP, 'Asha', CUSTOMER, 'Ravi', STYLIST, items, 'UPI');
    expect(fake.callsTo('bills', 'insert')).toHaveLength(1);
    expect(fake.callsTo('bill_items', 'insert')).toHaveLength(1);
    expect(fake.callsTo('payments', 'insert')).toHaveLength(1);
    expect(fake.callsTo('bills', 'delete')).toHaveLength(0);
    expect(bill.total_minor).toBe(30000);
  });

  it('does not pretend: a failed bill insert throws and nothing is kept on the phone', async () => {
    const fake = install(failOn('bills', 'insert', 'Failed to fetch'));
    await expect(
      billingRepository.createBill(SHOP, 'Asha', CUSTOMER, 'Ravi', STYLIST, items, 'UPI')
    ).rejects.toThrow(/No internet connection/);

    expect(fake.callsTo('bill_items')).toHaveLength(0);
    expect(await cached<Bill>(`@salon_os_bills_cache_${SHOP}`)).toEqual([]);
    expect(await AsyncStorage.getItem(`@salon_os_total_sales_count_${SHOP}`)).not.toBe('1');
  });

  it('removes the bill again when its items cannot be saved, and reports it', async () => {
    const fake = install(failOn('bill_items', 'insert', 'insert or update violates foreign key constraint'));
    await expect(
      billingRepository.createBill(SHOP, 'Asha', CUSTOMER, 'Ravi', STYLIST, items, 'UPI')
    ).rejects.toThrow(/bill items could not be saved/i);

    expect(fake.callsTo('bills', 'delete')).toHaveLength(1);
    expect(await cached<Bill>(`@salon_os_bills_cache_${SHOP}`)).toEqual([]);
  });

  it('removes the bill again when its payment cannot be saved', async () => {
    const fake = install(failOn('payments', 'insert'));
    await expect(
      billingRepository.createBill(SHOP, 'Asha', CUSTOMER, 'Ravi', STYLIST, items, 'UPI')
    ).rejects.toThrow(/payment could not be saved/i);
    expect(fake.callsTo('bills', 'delete')).toHaveLength(1);
  });

  it('only changes the customer\'s dues after the bill is safely saved', async () => {
    const fake = install(failOn('bill_items', 'insert'));
    await expect(
      billingRepository.createBill(SHOP, 'Asha', CUSTOMER, 'Ravi', STYLIST, items, 'Fully Pending')
    ).rejects.toThrow();
    expect(fake.callsTo('customers', 'update')).toHaveLength(0);
  });

  it('removes the bill when the customer\'s dues cannot be updated', async () => {
    const fake = install(failOn('customers', 'update'));
    await expect(
      billingRepository.createBill(SHOP, 'Asha', CUSTOMER, 'Ravi', STYLIST, items, 'Fully Pending')
    ).rejects.toThrow(/dues could not be saved/i);
    expect(fake.callsTo('bills', 'delete')).toHaveLength(1);
  });

  it('a demo shop (not a real database id) stays on the phone and never calls the database', async () => {
    const fake = install(failOn('bills', 'insert'));
    const bill = await billingRepository.createBill('demo_shop', 'Asha', null, 'Ravi', null, items, 'UPI');
    expect(bill.total_minor).toBe(30000);
    expect(fake.callsTo('bills', 'insert')).toHaveLength(0);
  });
});

describe('editing a bill', () => {
  const existing = {
    id: BILL,
    shop_id: SHOP,
    customer_id: CUSTOMER,
    customer_name: 'Asha',
    staff_id: STYLIST,
    staff_name: 'Ravi',
    invoice_number: 'INV-1',
    status: 'paid',
    subtotal_minor: 30000,
    discount_minor: 0,
    tax_minor: 0,
    total_minor: 30000,
    paid_amount_minor: 30000,
    due_amount_minor: 0,
    notes: null,
    issued_at: '10:00 am',
    created_at: new Date().toISOString(),
    payment_method: 'UPI',
    items: [],
    payments: [],
  } as unknown as Bill;

  const edit = { items: [{ name: 'Facial', priceMinor: 50000 }], staffId: 'owner' };

  it('adds the new items before removing the old ones, and uses only a valid stylist id', async () => {
    const fake = install((c) =>
      c.table === 'bill_items' && c.op === 'select' ? { data: [{ id: ITEM_OLD }] } : undefined
    );
    await billingRepository.updateBill(SHOP, BILL, edit, existing);

    const ops = fake.callsTo('bill_items').map((c) => c.op);
    expect(ops).toEqual(['select', 'insert', 'delete']);
    const inserted = fake.callsTo('bill_items', 'insert')[0].payload as { staff_id: string | null }[];
    expect(inserted[0].staff_id).toBeNull();
    expect(fake.callsTo('bill_items', 'delete')[0].filters).toContainEqual(['in', 'id', [ITEM_OLD]]);
  });

  it('keeps the old items if the new ones cannot be saved', async () => {
    const fake = install((c) => {
      if (c.table === 'bill_items' && c.op === 'select') return { data: [{ id: ITEM_OLD }] };
      return failOn('bill_items', 'insert', 'boom')(c);
    });
    await expect(billingRepository.updateBill(SHOP, BILL, edit, existing)).rejects.toThrow(/bill items could not be saved/i);
    expect(fake.callsTo('bill_items', 'delete')).toHaveLength(0);
    expect(await cached<Bill>(`@salon_os_bills_cache_${SHOP}`)).toEqual([]);
  });

  it('keeps only one set of items if the old ones cannot be removed', async () => {
    const fake = install((c) => {
      if (c.table === 'bill_items' && c.op === 'select') return { data: [{ id: ITEM_OLD }] };
      if (c.table === 'bill_items' && c.op === 'insert') return { data: [{ id: 'new-1' }] };
      return failOn('bill_items', 'delete')(c);
    });
    await expect(billingRepository.updateBill(SHOP, BILL, edit, existing)).rejects.toThrow();
    const deletes = fake.callsTo('bill_items', 'delete');
    expect(deletes).toHaveLength(2); // the failed one, then the clean-up of the new rows
    expect(deletes[1].filters).toContainEqual(['in', 'id', ['new-1']]);
  });

  it('says so when the bill is not on the server, instead of pretending it was changed', async () => {
    install((c) =>
      c.table === 'bills' && c.op === 'update' ? { data: [] } : c.table === 'bill_items' && c.op === 'select' ? { data: [] } : undefined
    );
    await expect(billingRepository.updateBill(SHOP, BILL, edit, existing)).rejects.toThrow(/not found on the server/i);
    expect(await cached<Bill>(`@salon_os_bills_cache_${SHOP}`)).toEqual([]);
  });

  it('reports a payment that could not be saved and leaves the phone\'s copy alone', async () => {
    install((c) => (c.table === 'payments' && c.op === 'delete' ? { error: { message: 'boom' } } : undefined));
    await expect(
      billingRepository.updateBill(SHOP, BILL, { paidAmountMinor: 0, dueAmountMinor: 30000 }, existing)
    ).rejects.toThrow(/payment could not be saved/i);
    expect(await cached<Bill>(`@salon_os_bills_cache_${SHOP}`)).toEqual([]);
  });
});

describe('deleting and restoring a bill', () => {
  it('a failed delete throws and the bill is not marked deleted on the phone', async () => {
    install(failOn('bills', 'update', 'Failed to fetch'));
    await AsyncStorage.setItem(`@salon_os_bills_cache_${SHOP}`, JSON.stringify([{ id: BILL, status: 'paid' }]));
    await expect(billingRepository.deleteBill(SHOP, BILL, 'Owner', 'owner')).rejects.toThrow(/No internet/);
    const bills = await cached<{ status: string }>(`@salon_os_bills_cache_${SHOP}`);
    expect(bills[0].status).toBe('paid');
  });

  it('a failed restore throws', async () => {
    install((c) => (c.table === 'bills' && c.op === 'select' ? { data: { notes: '', total_minor: 1 } } : failOn('bills', 'update')(c)));
    await expect(billingRepository.restoreBill(SHOP, BILL)).rejects.toThrow(/restore could not be saved/i);
  });

  it('restoring a bill that is not on the server says so', async () => {
    install((c) => (c.table === 'bills' && c.op === 'select' ? { data: null } : undefined));
    await expect(billingRepository.restoreBill(SHOP, BILL)).rejects.toThrow(/not found on the server/i);
  });
});

describe('appointments', () => {
  const booking = {
    shopId: SHOP,
    customerName: 'Asha',
    customerId: CUSTOMER,
    serviceName: 'Haircut',
    stylistName: 'Ravi',
    stylistId: STYLIST,
    slot: '11:00 AM',
    dateStr: '2026-10-08',
    amountRupees: 300,
  };
  const appt = { id: APPT, shop_id: SHOP, status: 'Confirmed', customer_name: 'Asha' } as unknown as Appointment;

  it('a failed booking throws and is not kept on the phone', async () => {
    install(failOn('appointments', 'insert', 'Failed to fetch'));
    await expect(appointmentRepository.addAppointment(booking)).rejects.toThrow(/No internet/);
    expect(await cached<Appointment>(`@salon_os_appts_cache_${SHOP}`)).toEqual([]);
  });

  it('a saved booking takes the database id', async () => {
    install();
    const saved = await appointmentRepository.addAppointment(booking);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a failed status change throws and the phone still shows the old status', async () => {
    install(failOn('appointments', 'update'));
    await AsyncStorage.setItem(`@salon_os_appts_cache_${SHOP}`, JSON.stringify([appt]));
    await expect(appointmentRepository.updateStatus(SHOP, APPT, 'In chair')).rejects.toThrow();
    const list = await cached<Appointment>(`@salon_os_appts_cache_${SHOP}`);
    expect(list[0].status).toBe('Confirmed');
  });

  it('a status change on an appointment that is not on the server says so', async () => {
    install((c) => (c.table === 'appointments' && c.op === 'update' ? { data: [] } : undefined));
    await expect(appointmentRepository.updateStatus(SHOP, APPT, 'Done')).rejects.toThrow(/not found on the server/i);
  });

  it('a status change is saved first, then shown', async () => {
    const fake = install();
    await AsyncStorage.setItem(`@salon_os_appts_cache_${SHOP}`, JSON.stringify([appt]));
    await appointmentRepository.updateStatus(SHOP, APPT, 'In chair');
    expect(fake.callsTo('appointments', 'update')).toHaveLength(1);
    expect((await cached<Appointment>(`@salon_os_appts_cache_${SHOP}`))[0].status).toBe('In chair');
  });

  it('a failed edit throws and leaves the phone\'s copy unchanged', async () => {
    install(failOn('appointments', 'update'));
    await AsyncStorage.setItem(`@salon_os_appts_cache_${SHOP}`, JSON.stringify([{ ...appt, starts_at: 'old' }]));
    await expect(appointmentRepository.updateAppointment(SHOP, APPT, { starts_at: 'new' })).rejects.toThrow();
    expect((await cached<Appointment>(`@salon_os_appts_cache_${SHOP}`))[0].starts_at).toBe('old');
  });

  it('a failed cancellation throws and the appointment stays in the list', async () => {
    install(failOn('appointments', 'update'));
    await AsyncStorage.setItem(`@salon_os_appts_cache_${SHOP}`, JSON.stringify([appt]));
    await expect(appointmentRepository.deleteAppointment(SHOP, APPT, { role: 'owner', name: 'Owner' })).rejects.toThrow();
    expect(await cached<Appointment>(`@salon_os_appts_cache_${SHOP}`)).toHaveLength(1);
  });

  it('a demo shop stays on the phone', async () => {
    const fake = install(failOn('appointments', 'insert'));
    const saved = await appointmentRepository.addAppointment({ ...booking, shopId: 'demo_shop' });
    expect(saved.id).toMatch(/^appt_/);
    expect(fake.callsTo('appointments')).toHaveLength(0);
  });
});

describe('team members', () => {
  const member = (extra: Partial<StaffMember> = {}) =>
    ({ id: STYLIST, shop_id: SHOP, name: 'Ravi', role: 'Stylist', phone: '9876543210', is_active: true, rating: '5.0', ...extra }) as StaffMember;

  const seed = (list: StaffMember[]) => AsyncStorage.setItem(`@salon_os_staff_cache_${SHOP}`, JSON.stringify(list));
  const stored = () => cached<StaffMember>(`@salon_os_staff_cache_${SHOP}`);

  it('a failed edit throws and the name does not change on the phone', async () => {
    install(failOn('staff', 'update'));
    await seed([member()]);
    await expect(staffRepository.updateStaff(SHOP, STYLIST, { name: 'Renamed' })).rejects.toThrow(/stylist could not be saved/i);
    expect((await stored())[0].name).toBe('Ravi');
  });

  it('a saved edit shows on the phone', async () => {
    install();
    await seed([member()]);
    const updated = await staffRepository.updateStaff(SHOP, STYLIST, { name: 'Renamed' });
    expect(updated?.name).toBe('Renamed');
    expect((await stored())[0].name).toBe('Renamed');
  });

  it('an edit for a stylist missing on the server says so', async () => {
    install((c) => (c.table === 'staff' && c.op === 'update' ? { data: [] } : undefined));
    await seed([member()]);
    await expect(staffRepository.updateStaff(SHOP, STYLIST, { name: 'X' })).rejects.toThrow(/not found on the server/i);
  });

  it('a failed rating throws and the rating does not change', async () => {
    install(failOn('staff', 'update'));
    await seed([member()]);
    await expect(staffRepository.updateStaffRating(SHOP, STYLIST, '3.0')).rejects.toThrow();
    expect((await stored())[0].rating).toBe('5.0');
  });

  it('a failed active/inactive switch throws and the status does not change', async () => {
    install(failOn('staff', 'update'));
    await seed([member()]);
    await expect(staffRepository.toggleStaffStatus(SHOP, STYLIST)).rejects.toThrow();
    expect((await stored())[0].is_active).toBe(true);
  });

  it('turning a stylist back on past the limit explains how to get more', async () => {
    install(failOn('staff', 'update', 'STYLIST_LIMIT_REACHED: Maximum 3 stylists allowed.'));
    await seed([member({ is_active: false })]);
    await expect(staffRepository.toggleStaffStatus(SHOP, STYLIST)).rejects.toThrow(/Contact StyleFleet support/);
    expect((await stored())[0].is_active).toBe(false);
  });

  it('a failed removal throws and the stylist stays', async () => {
    install(failOn('staff', 'delete'));
    await seed([member()]);
    await expect(staffRepository.deleteStaff(SHOP, STYLIST)).rejects.toThrow();
    expect(await stored()).toHaveLength(1);
  });
});

describe('expenses', () => {
  const expense = {
    id: EXPENSE,
    shop_id: SHOP,
    category_id: null,
    category_name: 'Rent',
    note: 'Rent',
    amount_minor: 100000,
    payment_method: 'UPI',
    expense_date: 'Today',
    created_at: new Date().toISOString(),
  } as Expense;

  it('a failed add throws and is not kept on the phone', async () => {
    install(failOn('expenses', 'insert', 'Failed to fetch'));
    await expect(expenseRepository.addExpense(SHOP, 'Rent', 100, 'Rent')).rejects.toThrow(/No internet/);
    expect(await cached<Expense>(`@salon_os_expenses_cache_${SHOP}`)).toEqual([]);
  });

  it('a demo shop stays on the phone', async () => {
    const fake = install(failOn('expenses', 'insert'));
    const saved = await expenseRepository.addExpense('demo_shop', 'Rent', 100, 'Rent');
    expect(saved.amount_minor).toBe(10000);
    expect(fake.callsTo('expenses')).toHaveLength(0);
  });

  it('an edit that finds no row on the server throws', async () => {
    install((c) => (c.table === 'expenses' && c.op === 'update' ? { data: [] } : undefined));
    await AsyncStorage.setItem(`@salon_os_expenses_cache_${SHOP}`, JSON.stringify([expense]));
    await expect(expenseRepository.updateExpense(SHOP, EXPENSE, { note: 'x' })).rejects.toThrow(/not found on the server/i);
    expect((await cached<Expense>(`@salon_os_expenses_cache_${SHOP}`))[0].note).toBe('Rent');
  });

  it('a failed delete throws and the expense stays', async () => {
    install(failOn('expenses', 'delete'));
    await AsyncStorage.setItem(`@salon_os_expenses_cache_${SHOP}`, JSON.stringify([expense]));
    await expect(expenseRepository.deleteExpense(SHOP, EXPENSE)).rejects.toThrow();
    expect(await cached<Expense>(`@salon_os_expenses_cache_${SHOP}`)).toHaveLength(1);
  });
});
