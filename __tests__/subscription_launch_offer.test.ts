import {
  isWithinFirst30DaysOfRegistration,
  getRemainingLaunchOfferDays,
  getRegistrationDaysElapsed,
} from '../src/utils/subscriptionUtils';
import {
  getSubscriptionPlans,
  getPlanById,
  STANDARD_SUBSCRIPTION_PLANS,
  LAUNCH_OFFER_SUBSCRIPTION_PLANS,
} from '../src/config/planConfig';

describe('Subscription Plan – First 30 Days Launch Offer Logic', () => {
  describe('1. First 30 Days – Launch Offer Pricing & Duration', () => {
    it('shows launch offer pricing when registration age is <= 30 days', () => {
      const regDate = '2026-10-04T08:00:00Z';
      const day0 = new Date('2026-10-04T12:00:00Z'); // Registered today

      expect(isWithinFirst30DaysOfRegistration(regDate, day0)).toBe(true);
      expect(getRemainingLaunchOfferDays(regDate, day0)).toBe(30);

      const plans = getSubscriptionPlans(isWithinFirst30DaysOfRegistration(regDate, day0));

      const threeMonths = plans.find((p) => p.id === '3_months')!;
      expect(threeMonths.priceInRupees).toBe(2999);
      expect(threeMonths.discountPercent).toBe(0);

      const sixMonths = plans.find((p) => p.id === '6_months')!;
      expect(sixMonths.priceInRupees).toBe(4799);
      expect(sixMonths.badge).toBe('20% OFF');
      expect(sixMonths.discountPercent).toBe(20);

      const oneYear = plans.find((p) => p.id === '12_months')!;
      expect(oneYear.priceInRupees).toBe(5999);
      expect(oneYear.badge).toBe('50% OFF');
      expect(oneYear.discountPercent).toBe(50);
    });

    it('accurately tracks days remaining across the first 30 days', () => {
      const regDate = '2026-10-04T00:00:00Z';

      // Day 1 (0 days elapsed) -> 30 days left
      const d0 = new Date('2026-10-04T10:00:00Z');
      expect(getRemainingLaunchOfferDays(regDate, d0)).toBe(30);

      // Day 10 (9 days elapsed) -> 21 days left
      const d10 = new Date('2026-10-13T10:00:00Z');
      expect(getRemainingLaunchOfferDays(regDate, d10)).toBe(21);

      // Day 30 (29 days elapsed) -> 1 day left
      const d30 = new Date('2026-11-02T10:00:00Z');
      expect(getRemainingLaunchOfferDays(regDate, d30)).toBe(1);

      // Day 31 (30 days elapsed) -> 0 days left (still within 30-day window)
      const d31 = new Date('2026-11-03T10:00:00Z');
      expect(isWithinFirst30DaysOfRegistration(regDate, d31)).toBe(true);
      expect(getRemainingLaunchOfferDays(regDate, d31)).toBe(0);
    });
  });

  describe('2. After First 30 Days – Reverts to Standard/Existing Plans', () => {
    it('disqualifies user on Day 32+ (31+ days elapsed) and reverts to standard pricing', () => {
      const regDate = '2026-10-04T00:00:00Z';
      const day32 = new Date('2026-11-04T10:00:00Z'); // 31 days elapsed

      expect(isWithinFirst30DaysOfRegistration(regDate, day32)).toBe(false);
      expect(getRemainingLaunchOfferDays(regDate, day32)).toBe(0);

      const plans = getSubscriptionPlans(isWithinFirst30DaysOfRegistration(regDate, day32));

      // 3 Months Standard
      const threeMonths = plans.find((p) => p.id === '3_months')!;
      expect(threeMonths.priceInRupees).toBe(2999);
      expect(threeMonths.discountPercent).toBe(0);

      // 6 Months regular price: 6 x ₹999, no offer
      const sixMonths = plans.find((p) => p.id === '6_months')!;
      expect(sixMonths.priceInRupees).toBe(5999);
      expect(sixMonths.badge).toBeUndefined();
      expect(sixMonths.discountPercent).toBe(0);

      // 12 Months regular price: ₹11,999, no offer
      const oneYear = plans.find((p) => p.id === '12_months')!;
      expect(oneYear.priceInRupees).toBe(11999);
      expect(oneYear.badge).toBeUndefined();
      expect(oneYear.discountPercent).toBe(0);
    });

    it('does not reset or restart the 30-day period on subsequent days', () => {
      const regDate = '2026-10-04T00:00:00Z';
      const day45 = new Date('2026-11-18T10:00:00Z');
      const day90 = new Date('2027-01-02T10:00:00Z');

      expect(isWithinFirst30DaysOfRegistration(regDate, day45)).toBe(false);
      expect(isWithinFirst30DaysOfRegistration(regDate, day90)).toBe(false);

      expect(getRemainingLaunchOfferDays(regDate, day45)).toBe(0);
      expect(getRemainingLaunchOfferDays(regDate, day90)).toBe(0);
    });
  });

  describe('3. Per-User Independence', () => {
    it('evaluates launch offer independently per user based on individual registration date', () => {
      const evaluationDate = new Date('2026-10-25T12:00:00Z');

      // User A registered on Sept 10, 2026 (45 days ago) -> Expired
      const userA_reg = '2026-09-10T00:00:00Z';
      expect(isWithinFirst30DaysOfRegistration(userA_reg, evaluationDate)).toBe(false);
      const userAPlans = getSubscriptionPlans(isWithinFirst30DaysOfRegistration(userA_reg, evaluationDate));
      expect(userAPlans.find((p) => p.id === '6_months')!.priceInRupees).toBe(5999);
      expect(userAPlans.find((p) => p.id === '12_months')!.priceInRupees).toBe(11999);

      // User B registered on Oct 4, 2026 (21 days ago) -> Active Launch Offer
      const userB_reg = '2026-10-04T00:00:00Z';
      expect(isWithinFirst30DaysOfRegistration(userB_reg, evaluationDate)).toBe(true);
      expect(getRemainingLaunchOfferDays(userB_reg, evaluationDate)).toBe(9);
      const userBPlans = getSubscriptionPlans(isWithinFirst30DaysOfRegistration(userB_reg, evaluationDate));
      expect(userBPlans.find((p) => p.id === '6_months')!.priceInRupees).toBe(4799);
      expect(userBPlans.find((p) => p.id === '12_months')!.priceInRupees).toBe(5999);

      // User C registered today on Oct 25, 2026 (0 days ago) -> Active Launch Offer with full 30 days
      const userC_reg = '2026-10-25T08:00:00Z';
      expect(isWithinFirst30DaysOfRegistration(userC_reg, evaluationDate)).toBe(true);
      expect(getRemainingLaunchOfferDays(userC_reg, evaluationDate)).toBe(30);
      const userCPlans = getSubscriptionPlans(isWithinFirst30DaysOfRegistration(userC_reg, evaluationDate));
      expect(userCPlans.find((p) => p.id === '6_months')!.priceInRupees).toBe(4799);
      expect(userCPlans.find((p) => p.id === '12_months')!.priceInRupees).toBe(5999);
    });
  });

  describe('4. Existing Users Who Already Crossed 30 Days', () => {
    it('always shows existing/current plan pricing without replacement', () => {
      // Salon registered in August 2026
      const existingUserReg = '2026-08-15T00:00:00Z';
      const today = new Date('2026-10-04T12:00:00Z');

      expect(isWithinFirst30DaysOfRegistration(existingUserReg, today)).toBe(false);

      const plans = getSubscriptionPlans(false);
      expect(plans).toEqual(STANDARD_SUBSCRIPTION_PLANS);
      expect(plans.map((p) => ({ id: p.id, price: p.priceInRupees }))).toEqual([
        { id: '3_months', price: 2999 },
        { id: '6_months', price: 5999 },
        { id: '12_months', price: 11999 },
      ]);
    });
  });

  describe('5. getPlanById Compatibility', () => {
    it('resolves correct plan price based on isLaunchOffer parameter', () => {
      // When isLaunchOffer = true
      expect(getPlanById('6_months', true)?.priceInRupees).toBe(4799);
      expect(getPlanById('12_months', true)?.priceInRupees).toBe(5999);

      // When isLaunchOffer = false
      expect(getPlanById('6_months', false)?.priceInRupees).toBe(5999);
      expect(getPlanById('12_months', false)?.priceInRupees).toBe(11999);

      // 3 Months is identical in both
      expect(getPlanById('3_months', true)?.priceInRupees).toBe(2999);
      expect(getPlanById('3_months', false)?.priceInRupees).toBe(2999);
    });
  });
});
