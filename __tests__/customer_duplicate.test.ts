import { customerRepository } from '../src/repositories/customerRepository';
import { Customer } from '../src/types/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock Supabase client
jest.mock('../src/lib/supabase', () => {
  let dbCustomers: any[] = [];
  return {
    supabase: {
      from: jest.fn((table: string) => {
        if (table === 'customers') {
          return {
            select: jest.fn((cols: string) => ({
              eq: jest.fn((col1: string, val1: any) => ({
                eq: jest.fn((col2: string, val2: any) => {
                  const matches = dbCustomers.filter(
                    (c) => c[col1] === val1 && c[col2] === val2
                  );
                  return Promise.resolve({ data: matches, error: null });
                }),
                order: jest.fn(() => Promise.resolve({ data: dbCustomers, error: null })),
              })),
            })),
            insert: jest.fn((rows: any) => {
              const toInsert = Array.isArray(rows) ? rows : [rows];
              const created = toInsert.map((r, i) => ({
                id: `db_cust_${Date.now()}_${i}`,
                ...r,
                created_at: new Date().toISOString(),
              }));
              dbCustomers.push(...created);
              return {
                select: jest.fn(() => ({
                  single: jest.fn(() => Promise.resolve({ data: created[0], error: null })),
                  then: (cb: any) => cb({ data: created, error: null }),
                })),
              };
            }),
          };
        }
        if (table === 'bills') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: { id: 'b_1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'bill_items') {
          return {
            insert: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: { id: 'bi_1' }, error: null })),
              })),
            })),
          };
        }
        return {};
      }),
    },
  };
});

describe('Customer Phone Duplicate Prevention', () => {
  const testShopId = 'test_shop_dup_123';

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('allows adding a new client with a unique phone number', async () => {
    const cust1 = await customerRepository.addCustomer(
      testShopId,
      'Priya Sharma',
      '9876543210',
      0,
      false
    );

    expect(cust1).toBeDefined();
    expect(cust1.name).toBe('Priya Sharma');
    expect(cust1.phone).toBe('9876543210');
  });

  it('strictly rejects adding a duplicate client with the exact same phone number', async () => {
    await expect(
      customerRepository.addCustomer(
        testShopId,
        'Priya Another',
        '9876543210',
        0,
        false
      )
    ).rejects.toThrow(/already exists/i);
  });

  it('detects duplicate even with country code and formatting (+91 98765-43210)', async () => {
    await expect(
      customerRepository.addCustomer(
        testShopId,
        'Priya Formatted',
        '+91 98765-43210',
        0,
        false
      )
    ).rejects.toThrow(/already exists/i);
  });

  it('filters out already existing phone numbers during bulk contact import', async () => {
    // 9876543210 already exists from previous test
    // 9876543211 is new
    // 9876543210 is duplicate
    const importPayload = [
      { name: 'Kavitha New', phone: '9876543211' },
      { name: 'Duplicate Priya', phone: '9876543210' },
      { name: 'Deepa New', phone: '9876543212' },
    ];

    const imported = await customerRepository.importContacts(testShopId, importPayload);

    // Only the 2 new contacts should be imported; duplicate 9876543210 must be ignored
    expect(imported).toHaveLength(2);
    expect(imported.map((c) => c.phone)).toEqual(['9876543211', '9876543212']);
  });
});
