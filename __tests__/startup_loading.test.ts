import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeSupabase, FakeCall, FakeResult } from './helpers/fakeSupabase';

let mockFrom: (table: string) => unknown = () => ({});
jest.mock('../src/lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

// eslint-disable-next-line import/first
import { billingRepository } from '../src/repositories/billingRepository';
// eslint-disable-next-line import/first
import { customerRepository } from '../src/repositories/customerRepository';
// eslint-disable-next-line import/first
import { staffRepository } from '../src/repositories/staffRepository';

const SHOP = '00000000-0000-4000-8000-0000000000b1';
const CUST = '00000000-0000-4000-8000-0000000000b2';
const NOW = new Date().toISOString();

const billRow = (id: string, over: Record<string, unknown>) => ({
  id,
  shop_id: SHOP,
  customer_id: CUST,
  staff_id: null,
  invoice_number: `INV-${id}`,
  status: 'paid',
  subtotal_minor: 0,
  discount_minor: 0,
  tax_minor: 0,
  total_minor: 0,
  notes: null,
  created_at: NOW,
  updated_at: NOW,
  customers: { name: 'Asha' },
  staff: null,
  bill_items: [],
  payments: [],
  ...over,
});

const ROWS = [
  billRow('p1', { status: 'paid', total_minor: 50000, payments: [{ id: 'pay1', amount_minor: 50000, method: 'UPI', paid_at: NOW }] }),
  billRow('d1', { status: 'pending', total_minor: 30000 }),
];

let billsRequests = 0;

function install(extra: (c: FakeCall) => FakeResult | undefined = () => undefined) {
  billsRequests = 0;
  const fake = createFakeSupabase((c) => {
    if (c.table === 'bills' && c.op === 'select') {
      billsRequests += 1; // one count per request really sent
      return { data: ROWS };
    }
    if (c.table === 'customers' && c.op === 'select') {
      return { data: [{ id: CUST, shop_id: SHOP, name: 'Asha', phone: '9876543210', notes: null, is_starred: false, created_at: NOW }] };
    }
    if (c.table === 'staff' && c.op === 'select') return { data: [] };
    return extra(c);
  });
  mockFrom = fake.from;
  return fake;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  // Start each test on a fresh tick: a request still pending from the previous test would be shared
  await new Promise((resolve) => setTimeout(resolve, 5));
});

describe('loading the shop at start-up', () => {
  it('downloads the bills once for the bills list, the customer totals and the staff list together', async () => {
    const fake = install();
    const [bills, customers] = await Promise.all([
      billingRepository.getBills(SHOP),
      customerRepository.getCustomers(SHOP),
      staffRepository.getStaff(SHOP),
    ]);

    expect(billsRequests).toBe(1);
    expect(fake.callsTo('bill_items', 'select')).toHaveLength(0);
    expect(bills).toHaveLength(2);
    expect(customers).toHaveLength(1);
  });

  it('gives the customer the same visits, spend and dues as before', async () => {
    install();
    const customers = await customerRepository.getCustomers(SHOP);
    const asha = customers[0];

    expect(asha.visits_count).toBe(1);
    expect(asha.lifetime_spend_minor).toBe(50000);
    expect(asha.outstanding_due_minor).toBe(30000);
  });

  it('never reuses old rows: a read that starts later goes back to the server', async () => {
    install();
    await billingRepository.getBills(SHOP);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await billingRepository.getBills(SHOP);

    expect(billsRequests).toBe(2);
  });

  it('keeps the bills list working when the bills cannot be downloaded', async () => {
    install();
    mockFrom = createFakeSupabase((c) =>
      c.table === 'bills' ? { error: { message: 'Network request failed' } } : undefined
    ).from;
    const bills = await billingRepository.getBills(SHOP);
    expect(bills).toEqual([]);
  });
});
