import { calculateTrialStatus } from '../src/utils/subscriptionUtils';
import { SUBSCRIPTION_PLANS, getPlanById } from '../src/config/planConfig';

describe('First 30 Days Trial Subscription Experience', () => {
  it('correctly qualifies salon for the first 30-day promotional card during trial', () => {
    const today = new Date('2026-10-03T12:00:00Z');

    // Day 1: Registered today
    const regDay1 = '2026-10-03T02:00:00Z';
    const trialDay1 = calculateTrialStatus(regDay1, today);
    expect(trialDay1.isExpired).toBe(false);
    expect(trialDay1.remainingDays).toBe(30);

    // Day 15: Registered 14 days ago
    const regDay15 = '2026-09-19T12:00:00Z';
    const trialDay15 = calculateTrialStatus(regDay15, today);
    expect(trialDay15.isExpired).toBe(false);
    expect(trialDay15.remainingDays).toBe(16);

    // Day 30: Final day of trial
    const regDay30 = '2026-09-04T12:00:00Z';
    const trialDay30 = calculateTrialStatus(regDay30, today);
    expect(trialDay30.isExpired).toBe(false);
    expect(trialDay30.remainingDays).toBe(1);
  });

  it('strictly disqualifies salon from first 30-day promo card after trial expires or when pro active', () => {
    const today = new Date('2026-10-03T12:00:00Z');

    // Day 32: Expired trial
    const regDay32 = '2026-09-01T12:00:00Z';
    const trialDay32 = calculateTrialStatus(regDay32, today);
    expect(trialDay32.isExpired).toBe(true);
    expect(trialDay32.remainingDays).toBe(0);

    // Visibility predicate: isFirst30DaysTrial
    const isFirst30DaysTrial = (isPro: boolean, trial: typeof trialDay32) => {
      if (isPro) return false;
      return !trial.isExpired && trial.remainingDays > 0;
    };

    expect(isFirst30DaysTrial(false, trialDay32)).toBe(false);

    // If salon has already upgraded to paid Pro subscription
    const regDay1 = '2026-10-03T02:00:00Z';
    const trialDay1 = calculateTrialStatus(regDay1, today);
    expect(isFirst30DaysTrial(true, trialDay1)).toBe(false);
  });

  it('has exact pricing matching specification for the 3 launch offer plans', () => {
    // 3 Months Launch Offer
    const threeMo = getPlanById('3_months', true)!;
    expect(threeMo.priceInRupees).toBe(2999);
    expect(threeMo.discountPercent).toBe(0);

    // 6 Months Launch Offer (20% OFF)
    const sixMo = getPlanById('6_months', true)!;
    expect(sixMo.priceInRupees).toBe(4799);
    expect(sixMo.badge).toBe('20% OFF');
    expect(sixMo.discountPercent).toBe(20);

    // 1 Year Launch Offer (50% OFF - Strongest Promotional Offer)
    const oneYr = getPlanById('12_months', true)!;
    expect(oneYr.priceInRupees).toBe(5999);
    expect(oneYr.badge).toBe('50% OFF');
    expect(oneYr.discountPercent).toBe(50);
  });

  it('has exact pricing matching specification for standard plans (after 30 days)', () => {
    // 3 Months Standard
    const threeMo = getPlanById('3_months', false)!;
    expect(threeMo.priceInRupees).toBe(2999);
    expect(threeMo.discountPercent).toBe(0);

    // 6 Months Standard
    const sixMo = getPlanById('6_months', false)!;
    expect(sixMo.priceInRupees).toBe(5999);
    expect(sixMo.badge).toBeUndefined();
    expect(sixMo.discountPercent).toBe(0);

    // 1 Year Standard
    const oneYr = getPlanById('12_months', false)!;
    expect(oneYr.priceInRupees).toBe(11999);
    expect(oneYr.badge).toBeUndefined();
    expect(oneYr.discountPercent).toBe(0);
  });
});
