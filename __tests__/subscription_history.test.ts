import { subscriptionRepository } from '../src/repositories/subscriptionRepository';
import { supabase } from '../src/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Subscription History Repository & Audit', () => {
  const testShopId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('queries subscription history from Supabase subscriptions table', async () => {
    const mockDbRecords = [
      {
        id: 'sub_101',
        shop_id: testShopId,
        user_id: 'user_1',
        plan_id: '12_months',
        status: 'active',
        trial_start_date: null,
        trial_end_date: null,
        subscription_start_date: '2026-10-04T00:00:00.000Z',
        subscription_end_date: '2027-10-04T00:00:00.000Z',
        cashfree_order_id: 'ORD_SF_101',
        cashfree_payment_id: 'PAY_101',
        amount_minor: 599900,
        currency: 'INR',
        created_at: '2026-10-04T00:00:00.000Z',
        updated_at: '2026-10-04T00:00:00.000Z',
      },
      {
        id: 'sub_100',
        shop_id: testShopId,
        user_id: 'user_1',
        plan_id: '6_months',
        status: 'expired',
        trial_start_date: null,
        trial_end_date: null,
        subscription_start_date: '2026-04-04T00:00:00.000Z',
        subscription_end_date: '2026-10-04T00:00:00.000Z',
        cashfree_order_id: 'ORD_SF_100',
        cashfree_payment_id: 'PAY_100',
        amount_minor: 239900,
        currency: 'INR',
        created_at: '2026-04-04T00:00:00.000Z',
        updated_at: '2026-04-04T00:00:00.000Z',
      },
    ];

    const selectMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: mockDbRecords,
          error: null,
        }),
      }),
    });

    jest.spyOn(supabase, 'from').mockReturnValue({
      select: selectMock,
    } as any);

    const history = await subscriptionRepository.getSubscriptionHistory(testShopId);

    expect(history).toBeDefined();
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].id).toBe('sub_101');
    expect(history[0].plan_id).toBe('12_months');
    expect(history[0].amount_minor).toBe(599900);
    expect(history[1].id).toBe('sub_100');
    expect(history[1].status).toBe('expired');
  });

  it('handles empty history gracefully when no paid subscriptions exist', async () => {
    const selectMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    });

    jest.spyOn(supabase, 'from').mockReturnValue({
      select: selectMock,
    } as any);

    const history = await subscriptionRepository.getSubscriptionHistory('shop_empty_test');
    expect(history).toEqual([]);
  });
});
