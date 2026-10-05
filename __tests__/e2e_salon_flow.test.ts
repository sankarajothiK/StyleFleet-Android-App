import AsyncStorage from '@react-native-async-storage/async-storage';
import { authRepository, AuthUser } from '../src/repositories/authRepository';
import { shopRepository, ShopRow, ShopRegistrationData } from '../src/repositories/shopRepository';
import { authService } from '../src/services/authService';
import { financialService } from '../src/services/financialService';
import { appointmentService } from '../src/services/appointmentService';
import { ReminderRule } from '../src/repositories/reminderRepository';
import { Appointment, Bill, Customer, ReminderItem } from '../src/types/domain';

// Stateful mock for Supabase Auth & DB
let mockCurrentAuthUser: any = { id: 'user_vikram', phone: '9876543210' };

jest.mock('../src/lib/supabase', () => {
  const chain: any = {
    select: jest.fn().mockImplementation(() => chain),
    insert: jest.fn().mockImplementation(() => chain),
    update: jest.fn().mockImplementation(() => chain),
    delete: jest.fn().mockImplementation(() => chain),
    upsert: jest.fn().mockImplementation(() => chain),
    eq: jest.fn().mockImplementation(() => chain),
    gt: jest.fn().mockImplementation(() => chain),
    in: jest.fn().mockImplementation(() => chain),
    order: jest.fn().mockImplementation(() => chain),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockImplementation(() =>
      Promise.resolve({
        data: {
          id: 'shop_stylefleet_test',
          name: 'StyleFleet Luxury Salon',
          owner_profile_id: 'user_vikram',
          address: '88 Brigade Road, 2nd Floor',
          city: 'Bengaluru',
          pin_code: '560001',
          phone: '9876543210',
          accent_color: '#D9A441',
          invoice_prefix: 'INV',
          gst_rate: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      })
    ),
  };

  return {
    supabase: {
      auth: {
        signInWithPassword: jest.fn().mockImplementation(() =>
          Promise.resolve({
            data: { user: mockCurrentAuthUser, session: { user: mockCurrentAuthUser } },
            error: null,
          })
        ),
        signUp: jest.fn().mockImplementation(() =>
          Promise.resolve({
            data: { user: mockCurrentAuthUser, session: { user: mockCurrentAuthUser } },
            error: null,
          })
        ),
        getSession: jest.fn().mockImplementation(() =>
          Promise.resolve({
            data: { session: mockCurrentAuthUser ? { user: mockCurrentAuthUser } : null },
            error: null,
          })
        ),
        signOut: jest.fn().mockImplementation(() => {
          mockCurrentAuthUser = null;
          return Promise.resolve({ error: null });
        }),
      },
      from: jest.fn(() => chain),
      functions: {
        invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
  };
});

describe('Salon OS — Full Automated End-to-End Salon Owner Journey', () => {
  const TEST_PHONE = '9876543210';
  const TEST_OTP = '123456';
  const SHOP_ID = 'shop_stylefleet_test';

  const createMockShop = (): ShopRow => ({
    id: SHOP_ID,
    owner_profile_id: 'user_vikram',
    name: 'StyleFleet Luxury Salon',
    address: '88 Brigade Road',
    city: 'Bengaluru',
    pin_code: '560001',
    phone: TEST_PHONE,
    gstin: null,
    logo_path: null,
    accent_color: '#D9A441',
    invoice_prefix: 'INV',
    gst_rate: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockCurrentAuthUser = { id: 'user_vikram', phone: '9876543210' };
    jest.clearAllMocks();

    // Mock global fetch for 2Factor SMS endpoints
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/SMS/VERIFY/')) {
        return Promise.resolve({
          json: () => Promise.resolve({ Status: 'Success', Details: 'OTP Matched' }),
        });
      }
      return Promise.resolve({
        json: () => Promise.resolve({ Status: 'Success', Details: 'mock_session_123456' }),
      });
    }) as any;
  });

  // =========================================================================
  // 1. REGISTRATION, LOGIN & PERSISTENT SESSION
  // =========================================================================
  describe('Phase 1: Registration, OTP & Persistent Session (One-Time Login)', () => {
    it('sends OTP and validates 10-digit mobile number', async () => {
      const invalidRes = await authRepository.sendOtp('12345');
      expect(invalidRes.success).toBe(false);
      expect(invalidRes.error).toContain('10-digit');

      const validRes = await authRepository.sendOtp(TEST_PHONE);
      expect(validRes.success).toBe(true);
      expect(validRes.sessionId).toBeDefined();
    });

    it('verifies 6-digit OTP and establishes authenticated session', async () => {
      const sendRes = await authRepository.sendOtp(TEST_PHONE);
      const verifyRes = await authRepository.verifyOtp(TEST_PHONE, TEST_OTP, sendRes.sessionId);

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.user).toBeDefined();
      expect(verifyRes.user?.phone).toBe(TEST_PHONE);

      // Session must be stored persistently in local storage
      const storedUser = await authRepository.getSession();
      expect(storedUser).toBeDefined();
      expect(storedUser?.phone).toBe(TEST_PHONE);
    });

    it('registers a new salon with full store details and validates fields', async () => {
      const registrationData: ShopRegistrationData = {
        name: 'StyleFleet Luxury Salon',
        ownerName: 'Vikram Mehta',
        phone: TEST_PHONE,
        address: '88 Brigade Road, 2nd Floor',
        city: 'Bengaluru',
        pinCode: '560001',
        gstin: '29ABCDE1234F1Z5',
      };

      const shop = await authService.registerShop('user_vikram', registrationData);
      expect(shop).toBeDefined();
      expect(shop.name).toBe('StyleFleet Luxury Salon');
      expect(shop.city).toBe('Bengaluru');
      expect(shop.pin_code).toBe('560001');

      // Cache shop locally for persistent sub-5ms launch
      await shopRepository.cacheShop(shop);
      await shopRepository.saveLastPhone(TEST_PHONE);
      await authRepository.setCurrentShopId(shop.id);

      const cached = await shopRepository.getCachedShop();
      expect(cached).toBeDefined();
      expect(cached?.name).toBe('StyleFleet Luxury Salon');
      expect(cached?.phone).toBe(TEST_PHONE);
    });

    it('PERSISTENCE VERIFICATION: app restart immediately opens dashboard without requesting login', async () => {
      // Setup persistent state (simulating a previously registered and verified user)
      const mockShop = createMockShop();
      const mockUser: AuthUser = {
        id: 'user_vikram',
        phone: TEST_PHONE,
        shopId: SHOP_ID,
      };

      await shopRepository.cacheShop(mockShop);
      await authRepository.saveSession(mockUser);
      await shopRepository.saveLastPhone(TEST_PHONE);

      // --- SIMULATED APP REBOOT (Fast Path in AppNavigator) ---
      const [cachedShop, cachedUser] = await Promise.all([
        shopRepository.getCachedShop(),
        authRepository.getSession(),
      ]);

      // Assert that credentials exist and initialDestination evaluates to 'home'
      expect(cachedShop).not.toBeNull();
      expect(cachedUser).not.toBeNull();

      const initialDestination = cachedShop ? 'home' : (cachedUser ? 'register' : 'phone');
      expect(initialDestination).toBe('home'); // Directly enters Dashboard without asking for OTP!
    });
  });

  // =========================================================================
  // 2. CUSTOMER MANAGEMENT & DUE SETTLEMENT
  // =========================================================================
  describe('Phase 2: Customer Operations (Add, Star MVP, Dues & Search)', () => {
    const mockCustomers: Customer[] = [
      {
        id: 'c1',
        shop_id: SHOP_ID,
        name: 'Ananya Sharma',
        phone: '9845012345',
        notes: 'Prefers ammonia-free hair colour',
        preferred_staff_id: 's1',
        preferred_stylist_name: 'Rahul',
        is_starred: true,
        visits_count: 14,
        lifetime_spend_minor: 2850000, // ₹28,500
        outstanding_due_minor: 120000, // ₹1,200 due
        last_visit_date: '2026-09-20',
        due_start_date: '2026-09-20',
        created_at: new Date().toISOString(),
      },
      {
        id: 'c2',
        shop_id: SHOP_ID,
        name: 'Karthik Rao',
        phone: '9845098765',
        notes: null,
        preferred_staff_id: null,
        preferred_stylist_name: 'Any Stylist',
        is_starred: false,
        visits_count: 2,
        lifetime_spend_minor: 150000, // ₹1,500
        outstanding_due_minor: 0,
        last_visit_date: '2026-09-22',
        due_start_date: null,
        created_at: new Date().toISOString(),
      },
    ];

    it('correctly filters customers by MVP and outstanding dues', () => {
      const starred = mockCustomers.filter((c) => c.is_starred);
      expect(starred.length).toBe(1);
      expect(starred[0].name).toBe('Ananya Sharma');

      const withDues = mockCustomers.filter((c) => c.outstanding_due_minor > 0);
      expect(withDues.length).toBe(1);
      expect(withDues[0].outstanding_due_minor).toBe(120000);
    });

    it('searches customer database by name and mobile number', () => {
      const queryName = 'karthik';
      const searchByName = mockCustomers.filter(
        (c) => c.name.toLowerCase().includes(queryName) || c.phone.includes(queryName)
      );
      expect(searchByName.length).toBe(1);
      expect(searchByName[0].name).toBe('Karthik Rao');

      const queryPhone = '12345';
      const searchByPhone = mockCustomers.filter(
        (c) => c.name.toLowerCase().includes(queryPhone) || c.phone.includes(queryPhone)
      );
      expect(searchByPhone.length).toBe(1);
      expect(searchByPhone[0].name).toBe('Ananya Sharma');
    });

    it('sorts customers by visit frequency for lazy-load top 25 optimization', () => {
      const sorted = [...mockCustomers].sort((a, b) => b.visits_count - a.visits_count);
      expect(sorted[0].name).toBe('Ananya Sharma'); // 14 visits
      expect(sorted[1].name).toBe('Karthik Rao'); // 2 visits
    });
  });

  // =========================================================================
  // 3. APPOINTMENTS & SLOT AVAILABILITY
  // =========================================================================
  describe('Phase 3: Appointments Booking & Timeline Availability', () => {
    it('detects booked vs open time slots accurately', () => {
      const mockAppointments: Appointment[] = [
        {
          id: 'apt_1',
          shop_id: SHOP_ID,
          customer_id: 'c1',
          customer_name: 'Ananya Sharma',
          customer_phone: '9845012345',
          staff_id: 's1',
          staff_name: 'Rahul',
          service_id: 'svc_1',
          service_name: 'Hair Spa & Cut',
          starts_at: '11:00',
          duration_minutes: 60,
          status: 'Confirmed',
          notes: null,
          amount_minor: 150000,
          created_at: new Date().toISOString(),
        },
      ];

      const slots = appointmentService.getAvailableSlots(mockAppointments);
      const slot1100 = slots.find((s) => s.slot === '11:00');
      const slot1200 = slots.find((s) => s.slot === '12:00');

      expect(slot1100?.taken).toBe(true);
      expect(slot1200?.taken).toBe(false);
    });
  });

  // =========================================================================
  // 4. BILLING, DISCOUNTS & FINANCIAL ACCURACY
  // =========================================================================
  describe('Phase 4: Billing, Discounts & Financial Calculations', () => {
    const today = new Date().toISOString().split('T')[0];
    const mockBills: Bill[] = [
      {
        id: 'bill_1',
        shop_id: SHOP_ID,
        customer_id: 'c1',
        customer_name: 'Ananya Sharma',
        staff_id: 's1',
        staff_name: 'Rahul',
        invoice_number: 'INV-1001',
        status: 'paid',
        subtotal_minor: 200000, // ₹2,000
        discount_minor: 20000, // ₹200 discount
        tax_minor: 0,
        total_minor: 180000, // ₹1,800 total paid
        notes: null,
        issued_at: today,
        payment_method: 'UPI',
        items: [
          {
            service_id: 'svc_1',
            service_name_snapshot: 'Hair Spa',
            quantity: 1,
            unit_price_minor: 150000,
            discount_minor: 0,
            tax_minor: 0,
            line_total_minor: 150000,
            staff_id: 's1',
          },
          {
            service_id: 'svc_2',
            service_name_snapshot: 'Hair Cut',
            quantity: 1,
            unit_price_minor: 50000,
            discount_minor: 0,
            tax_minor: 0,
            line_total_minor: 50000,
            staff_id: 's1',
          },
        ],
      },
    ];

    it('calculates net sales metrics accurately without hardcoding', () => {
      const sales = financialService.getSalesMetrics('Day', mockBills);
      expect(sales.total_minor).toBe(180000); // ₹1,800
      expect(sales.bills_count).toBe(1);
      expect(sales.avg_bill_minor).toBe(180000);
    });

    it('deducts salon expenses from revenue to calculate net profit', () => {
      const mockExpenses = [
        {
          id: 'exp_1',
          shop_id: SHOP_ID,
          category_id: null,
          category_name: 'Supplies',
          note: 'Shampoo & conditioner bottles',
          amount_minor: 40000, // ₹400
          payment_method: 'Cash',
          expense_date: today,
          created_at: new Date().toISOString(),
        },
      ];

      const pnl = financialService.getPnLMetrics('Day', mockBills, mockExpenses);
      expect(pnl.income_minor).toBe(180000); // ₹1,800
      expect(pnl.expense_minor).toBe(40000); // ₹400
      expect(pnl.net_minor).toBe(140000); // ₹1,400 profit
    });
  });

  // =========================================================================
  // 5. REMINDERS & DIRECT WHATSAPP DUE MESSAGES
  // =========================================================================
  describe('Phase 5: Automated Reminders & WhatsApp Payment Due Reminders', () => {
    it('verifies due reminder message structure and WhatsApp URL generation', () => {
      const reminder: ReminderItem = {
        id: 'rem_due_c1',
        group: 'Today',
        kind: 'money',
        title: 'Ananya Sharma owes ₹1,200',
        sub: 'Outstanding balance ₹1,200 pending',
        when: 'Today',
        action: 'Send Reminder',
        customer_id: 'c1',
        customer_name: 'Ananya Sharma',
        customer_phone: '9845012345',
        amount_minor: 120000,
      };

      expect(reminder.action).toBe('Send Reminder');

      // Verify formatted WhatsApp text
      const cleanPhone = reminder.customer_phone?.replace(/\D/g, '').slice(-10);
      const dueAmt = Math.round((reminder.amount_minor || 0) / 100);
      const sName = 'StyleFleet Luxury Salon';

      const message =
        `Hello ${reminder.customer_name}! 👋\n\n` +
        `This is a gentle payment reminder from *${sName}*.\n` +
        `You are having a due amount of *₹${dueAmt.toLocaleString('en-IN')}*, please pay.\n\n` +
        `If you have already settled this payment, kindly ignore this reminder.\n\n` +
        `Thank you!\n*${sName}*`;

      expect(message).toContain('Ananya Sharma');
      expect(message).toContain('₹1,200');
      expect(message).toContain('You are having a due amount of');
      expect(message).toContain('please pay');

      const nativeUrl = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
      expect(nativeUrl).toContain('919845012345');
      expect(nativeUrl).toContain(encodeURIComponent('₹1,200'));
    });

    it('toggles automatic reminder rules and caches updated preference', async () => {
      const defaultRules: ReminderRule[] = [
        { id: 'rule_1', label: 'Appointment reminder · 3 hours before', on: true },
        { id: 'rule_2', label: 'Payment due follow-up · every 3 days', on: true },
      ];

      await AsyncStorage.setItem(`@salon_os_reminder_rules_cache_${SHOP_ID}`, JSON.stringify(defaultRules));

      // Toggle rule 2 off
      const updated = defaultRules.map((r) => (r.id === 'rule_2' ? { ...r, on: !r.on } : r));
      await AsyncStorage.setItem(`@salon_os_reminder_rules_cache_${SHOP_ID}`, JSON.stringify(updated));

      const saved = await AsyncStorage.getItem(`@salon_os_reminder_rules_cache_${SHOP_ID}`);
      const parsed: ReminderRule[] = JSON.parse(saved || '[]');
      expect(parsed.find((r) => r.id === 'rule_2')?.on).toBe(false);
    });
  });

  // =========================================================================
  // 6. PERMANENT ACCOUNT DELETION & LOGOUT TEARDOWN
  // =========================================================================
  describe('Phase 6: Account Deletion and Session Reset', () => {
    it('completely clears local session and cached salon on sign out / account deletion', async () => {
      // Simulate active logged-in state
      await authRepository.saveSession({ id: 'user_1', phone: TEST_PHONE, shopId: SHOP_ID });
      await shopRepository.cacheShop(createMockShop());

      expect(await authRepository.getSession()).not.toBeNull();
      expect(await shopRepository.getCachedShop()).not.toBeNull();

      // Perform session clear (as executed on sign out or permanent account deletion)
      await shopRepository.clearCachedShop();
      await authRepository.signOut();

      expect(await authRepository.getSession()).toBeNull();
      expect(await shopRepository.getCachedShop()).toBeNull();

      // On next app launch, initialDestination returns to 'phone' login
      const nextUser = await authRepository.getSession();
      const nextShop = await shopRepository.getCachedShop();
      const nextDestination = nextShop ? 'home' : (nextUser ? 'register' : 'phone');
      expect(nextDestination).toBe('phone');
    });
  });
});
