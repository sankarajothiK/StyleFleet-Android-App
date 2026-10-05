import {
  SUBSCRIPTION_PLANS,
  STANDARD_SUBSCRIPTION_PLANS,
  LAUNCH_OFFER_SUBSCRIPTION_PLANS,
  getPlanById,
  calculateSavingsRupees,
  calculateSavingsPercent,
  formatPriceInRupees,
} from '../src/config/planConfig';
import {
  calculateTrialStatus,
  calculateSubscriptionStatus,
  normalizeDateToUtcMidnight,
  TRIAL_TOTAL_DAYS,
  TRIAL_EXPIRING_THRESHOLD_DAYS,
} from '../src/utils/subscriptionUtils';
import { SubscriptionRecord } from '../src/types/domain';

describe('Manage Plans & Subscription Tier Configuration', () => {
  it('contains exactly 3 centralized subscription plans with correct pricing', () => {
    expect(LAUNCH_OFFER_SUBSCRIPTION_PLANS).toHaveLength(3);
    expect(STANDARD_SUBSCRIPTION_PLANS).toHaveLength(3);

    const [threeMonths, sixMonths, twelveMonths] = LAUNCH_OFFER_SUBSCRIPTION_PLANS;

    // 3 Months @ ₹1,499
    expect(threeMonths.id).toBe('3_months');
    expect(threeMonths.priceInRupees).toBe(1499);
    expect(threeMonths.durationMonths).toBe(3);
    expect(threeMonths.durationDays).toBe(90);

    // 6 Months @ ₹2,399 (20% OFF)
    expect(sixMonths.id).toBe('6_months');
    expect(sixMonths.priceInRupees).toBe(2399);
    expect(sixMonths.durationMonths).toBe(6);
    expect(sixMonths.durationDays).toBe(180);
    expect(sixMonths.badge).toBe('20% OFF');
    expect(sixMonths.discountPercent).toBe(20);

    // 12 Months @ ₹5,999 (50% OFF - Strongest Promo)
    expect(twelveMonths.id).toBe('12_months');
    expect(twelveMonths.priceInRupees).toBe(5999);
    expect(twelveMonths.durationMonths).toBe(12);
    expect(twelveMonths.durationDays).toBe(365);
    expect(twelveMonths.badge).toBe('50% OFF');
    expect(twelveMonths.discountPercent).toBe(50);
  });

  it('calculates savings and discount percentages accurately based on duration plans', () => {
    const sixMonths = getPlanById('6_months', true)!;
    const twelveMonths = getPlanById('12_months', true)!;

    // 6 Months: 2999 - 2399 = 600 (20%)
    expect(calculateSavingsRupees(sixMonths)).toBe(600);
    expect(calculateSavingsPercent(sixMonths)).toBe(20);

    // 12 Months: 11998 - 5999 = 5999 (50%)
    expect(calculateSavingsRupees(twelveMonths)).toBe(5999);
    expect(calculateSavingsPercent(twelveMonths)).toBe(50);
  });

  it('formats currency correctly with Indian Rupee symbol', () => {
    expect(formatPriceInRupees(1499)).toBe('₹1,499');
    expect(formatPriceInRupees(2399)).toBe('₹2,399');
    expect(formatPriceInRupees(5999)).toBe('₹5,999');
  });
});

describe('30-Day Free Trial Calculation Logic', () => {
  const msPerDay = 1000 * 60 * 60 * 24;

  it('evaluates Day 1 (same day registration) as 30 days remaining and Active Trial', () => {
    const today = new Date('2026-09-28T10:00:00Z');
    const registrationDate = '2026-09-28T04:00:00Z'; // Registered earlier today

    const result = calculateTrialStatus(registrationDate, today);

    expect(result.state).toBe('TRIAL_ACTIVE');
    expect(result.isExpired).toBe(false);
    expect(result.isExpiringSoon).toBe(false);
    expect(result.totalDays).toBe(TRIAL_TOTAL_DAYS);
    expect(result.completedDays).toBe(0);
    expect(result.remainingDays).toBe(30);
    expect(result.actionButtonLabel).toBe('View Plans');
  });

  it('evaluates Day 10 (10 days elapsed) with 20 days remaining and Active Trial', () => {
    const today = new Date('2026-09-28T12:00:00Z');
    const registrationDate = new Date(today.getTime() - 10 * msPerDay).toISOString();

    const result = calculateTrialStatus(registrationDate, today);

    expect(result.state).toBe('TRIAL_ACTIVE');
    expect(result.isExpired).toBe(false);
    expect(result.isExpiringSoon).toBe(false);
    expect(result.completedDays).toBe(10);
    expect(result.remainingDays).toBe(20);
  });

  it('evaluates Day 26 (4 days remaining) as Expiring Soon threshold', () => {
    const today = new Date('2026-09-28T12:00:00Z');
    const registrationDate = new Date(today.getTime() - 26 * msPerDay).toISOString();

    const result = calculateTrialStatus(registrationDate, today);

    expect(result.state).toBe('TRIAL_EXPIRING_SOON');
    expect(result.isExpired).toBe(false);
    expect(result.isExpiringSoon).toBe(true);
    expect(result.remainingDays).toBe(4);
    expect(result.actionButtonLabel).toBe('Subscribe Now');
  });

  it('evaluates Day 30 as final day of Free Trial', () => {
    const today = new Date('2026-09-28T12:00:00Z');
    const registrationDate = new Date(today.getTime() - 30 * msPerDay).toISOString();

    const result = calculateTrialStatus(registrationDate, today);

    expect(result.isExpired).toBe(false);
    expect(result.remainingDays).toBe(0);
  });

  it('evaluates Day 31 onward as Expired without allowing local tampering', () => {
    const today = new Date('2026-09-28T12:00:00Z');
    const registrationDate = new Date(today.getTime() - 31 * msPerDay).toISOString();

    const result = calculateTrialStatus(registrationDate, today);

    expect(result.state).toBe('TRIAL_EXPIRED');
    expect(result.isExpired).toBe(true);
    expect(result.remainingDays).toBe(0);
    expect(result.completedDays).toBe(30);
    expect(result.progress).toBe(1);
    expect(result.actionButtonLabel).toBe('View Plans');
  });

  it('evaluates Day 60 as Expired', () => {
    const today = new Date('2026-09-28T12:00:00Z');
    const registrationDate = new Date(today.getTime() - 60 * msPerDay).toISOString();

    const result = calculateTrialStatus(registrationDate, today);

    expect(result.state).toBe('TRIAL_EXPIRED');
    expect(result.isExpired).toBe(true);
  });
});

describe('Active Subscription Calculations', () => {
  it('correctly calculates remaining days and expiration for an active 6-Month subscription', () => {
    const now = new Date('2026-09-28T12:00:00Z');
    const startDate = new Date('2026-09-01T00:00:00Z').toISOString();
    const endDate = new Date('2027-03-01T00:00:00Z').toISOString();

    const record: SubscriptionRecord = {
      id: 'sub_test_1',
      user_id: 'user_1',
      shop_id: 'shop_1',
      plan_id: '6_months',
      status: 'active',
      trial_start_date: null,
      trial_end_date: null,
      subscription_start_date: startDate,
      subscription_end_date: endDate,
      cashfree_order_id: 'cf_order_123',
      cashfree_payment_id: 'cf_pay_456',
      amount_minor: 239900,
      currency: 'INR',
      created_at: startDate,
      updated_at: startDate,
    };

    const status = calculateSubscriptionStatus(record, now);

    expect(status.state).toBe('ACTIVE_SUBSCRIPTION');
    expect(status.isExpired).toBe(false);
    expect(status.planId).toBe('6_months');
    expect(status.remainingDays).toBeGreaterThan(150);
  });

  it('marks an overdue subscription as expired', () => {
    const now = new Date('2026-09-28T12:00:00Z');
    const startDate = new Date('2026-01-01T00:00:00Z').toISOString();
    const endDate = new Date('2026-02-01T00:00:00Z').toISOString(); // Expired months ago

    const record: SubscriptionRecord = {
      id: 'sub_test_expired',
      user_id: 'user_1',
      shop_id: 'shop_1',
      plan_id: '1_month',
      status: 'active',
      trial_start_date: null,
      trial_end_date: null,
      subscription_start_date: startDate,
      subscription_end_date: endDate,
      cashfree_order_id: 'cf_order_123',
      cashfree_payment_id: 'cf_pay_456',
      amount_minor: 49900,
      currency: 'INR',
      created_at: startDate,
      updated_at: startDate,
    };

    const status = calculateSubscriptionStatus(record, now);

    expect(status.state).toBe('TRIAL_EXPIRED');
    expect(status.isExpired).toBe(true);
    expect(status.remainingDays).toBe(0);
  });
});
