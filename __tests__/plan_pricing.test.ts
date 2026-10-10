import {
  BASELINE_MONTHLY_PRICE,
  LAUNCH_OFFER_SUBSCRIPTION_PLANS,
  STANDARD_SUBSCRIPTION_PLANS,
  calculatePlanPricing,
  calculateSavingsPercent,
  calculateSavingsRupees,
  getPlanById,
  getSubscriptionPlans,
} from '../src/config/planConfig';
import {
  getLaunchOfferEndDate,
  getRemainingLaunchOfferDays,
  isWithinFirst30DaysOfRegistration,
} from '../src/utils/subscriptionUtils';
import { translations, LanguageCode } from '../src/i18n/translations';
import { subscriptionRepository } from '../src/repositories/subscriptionRepository';

const launch = (id: string) => getPlanById(id, true)!;
const regular = (id: string) => getPlanById(id, false)!;

describe('plan prices: regular ₹2,999 / ₹5,999 / ₹11,999, offer on 6 and 12 months', () => {
  it('the reference price of one month is ₹999', () => {
    expect(BASELINE_MONTHLY_PRICE).toBe(999);
  });

  it('3 months: ₹2,999, no offer', () => {
    const p = launch('3_months');
    expect(p.price).toBe(2999);
    expect(p.originalPrice).toBe(2999);
    expect(calculateSavingsRupees(p)).toBe(0);
    expect(p.discountPercent).toBe(0);
    expect(p.badge).toBeUndefined();
    expect(Math.round(p.price / p.durationMonths)).toBe(1000);
  });

  it('6 months: 20% offer, the salon saves ₹1,200', () => {
    const p = launch('6_months');
    expect(p.price).toBe(4799);
    expect(p.originalPrice).toBe(5999);
    expect(calculateSavingsRupees(p)).toBe(1200);
    expect(calculateSavingsPercent(p)).toBe(20);
    expect(Math.round(p.price / p.durationMonths)).toBe(800);
  });

  it('12 months: 50% offer, the salon saves ₹6,000', () => {
    const p = launch('12_months');
    expect(p.price).toBe(5999);
    expect(p.originalPrice).toBe(11999);
    expect(calculateSavingsRupees(p)).toBe(6000);
    expect(calculateSavingsPercent(p)).toBe(50);
    expect(Math.round(p.price / p.durationMonths)).toBe(500);
  });

  it('the saving is always the regular price minus what is paid, never more', () => {
    for (const p of LAUNCH_OFFER_SUBSCRIPTION_PLANS) {
      expect(calculateSavingsRupees(p)).toBe(p.originalPrice - p.price);
      expect(p.price).toBeLessThanOrEqual(p.originalPrice);
    }
  });

  it('the regular prices are ₹2,999, ₹5,999 and ₹11,999', () => {
    expect(regular('3_months').price).toBe(2999);
    expect(regular('6_months').price).toBe(5999);
    expect(regular('12_months').price).toBe(11999);
  });

  it("the strike-through price on an offer card is that plan's regular price", () => {
    for (const p of LAUNCH_OFFER_SUBSCRIPTION_PLANS) {
      expect(p.originalPrice).toBe(regular(p.id).price);
    }
  });

  it('after the offer every plan is at its regular price with no saving and no badge', () => {
    expect(STANDARD_SUBSCRIPTION_PLANS.map((p) => p.price)).toEqual([2999, 5999, 11999]);
    for (const p of STANDARD_SUBSCRIPTION_PLANS) {
      expect(calculateSavingsRupees(p)).toBe(0);
      expect(p.discountPercent).toBe(0);
      expect(p.badge).toBeUndefined();
      expect(p.isBestValue).toBeUndefined();
    }
  });

  it('the offer is never deeper than the advertised 20% / 50%, apart from ₹2 of rounding', () => {
    // The saving shown to salons is the round ₹1,200 and ₹6,000, which is within ₹2 of an exact 20% and 50%.
    for (const p of LAUNCH_OFFER_SUBSCRIPTION_PLANS) {
      const advertised = (p.discountPercent / 100) * p.originalPrice;
      expect(calculateSavingsRupees(p) - advertised).toBeLessThanOrEqual(2);
    }
  });

  it('both lists keep the same plans, lengths and ids, so a plan id always resolves', () => {
    expect(LAUNCH_OFFER_SUBSCRIPTION_PLANS.map((p) => [p.id, p.durationMonths, p.durationDays])).toEqual(
      STANDARD_SUBSCRIPTION_PLANS.map((p) => [p.id, p.durationMonths, p.durationDays])
    );
    expect(LAUNCH_OFFER_SUBSCRIPTION_PLANS.map((p) => p.id)).toEqual(['3_months', '6_months', '12_months']);
  });

  it('the 12 month plan is the best value', () => {
    expect(LAUNCH_OFFER_SUBSCRIPTION_PLANS.filter((p) => p.isBestValue).map((p) => p.id)).toEqual(['12_months']);
  });

  it('reports the monthly price, saving and formatted amounts for the card', () => {
    const c = calculatePlanPricing(launch('6_months'));
    expect(c.effectiveMonthlyPrice).toBe(800);
    expect(c.savings).toBe(1200);
    expect(c.formattedPrice).toBe('₹4,799');
    expect(c.formattedOriginalPrice).toBe('₹5,999');
    expect(c.formattedSavings).toBe('₹1,200');
  });
});

describe('the offer lasts 30 days from the registration date', () => {
  const reg = '2026-10-04T08:00:00Z';
  const at = (iso: string) => new Date(iso);

  it('is on from the registration day and shows the offer prices', () => {
    expect(isWithinFirst30DaysOfRegistration(reg, at('2026-10-04T12:00:00Z'))).toBe(true);
    expect(getSubscriptionPlans(true).find((p) => p.id === '12_months')!.price).toBe(5999);
  });

  it('is still on up to the last day, and counts the days down', () => {
    expect(getRemainingLaunchOfferDays(reg, at('2026-10-04T12:00:00Z'))).toBe(30);
    expect(getRemainingLaunchOfferDays(reg, at('2026-10-14T12:00:00Z'))).toBe(20);
    expect(isWithinFirst30DaysOfRegistration(reg, at('2026-11-02T12:00:00Z'))).toBe(true);
    expect(getRemainingLaunchOfferDays(reg, at('2026-11-02T12:00:00Z'))).toBe(1);
  });

  it('is over after that and cannot come back', () => {
    expect(isWithinFirst30DaysOfRegistration(reg, at('2026-11-05T12:00:00Z'))).toBe(false);
    expect(isWithinFirst30DaysOfRegistration(reg, at('2027-03-01T12:00:00Z'))).toBe(false);
    expect(getRemainingLaunchOfferDays(reg, at('2026-11-05T12:00:00Z'))).toBe(0);
  });

  it('is not given when the registration date is unknown', () => {
    expect(isWithinFirst30DaysOfRegistration(null, at('2026-10-04T12:00:00Z'))).toBe(false);
    expect(isWithinFirst30DaysOfRegistration('not a date', at('2026-10-04T12:00:00Z'))).toBe(false);
  });

  it('tells the salon the date the offer ends: registration date plus 30 days', () => {
    const end = getLaunchOfferEndDate(reg)!;
    expect(end.toISOString().slice(0, 10)).toBe('2026-11-03');
    expect(getLaunchOfferEndDate(null)).toBeNull();
    expect(getLaunchOfferEndDate('garbage')).toBeNull();
  });

  it('the end date is the last day the offer is still given', () => {
    const end = getLaunchOfferEndDate(reg)!;
    const lastDay = new Date(end.getTime() + 12 * 3600 * 1000);
    const nextDay = new Date(end.getTime() + 36 * 3600 * 1000);
    expect(isWithinFirst30DaysOfRegistration(reg, lastDay)).toBe(true);
    expect(isWithinFirst30DaysOfRegistration(reg, nextDay)).toBe(false);
  });
});

describe('what a payment records', () => {
  const record = (extra: Record<string, unknown>) =>
    subscriptionRepository.recordSubscription({ shopId: 'demo_shop', userId: '', planId: '6_months', ...extra } as never);

  it('records the offer price when the offer was paid', async () => {
    expect((await record({ isLaunchOffer: true }))!.amount_minor).toBe(479900);
  });

  it('records the regular price when the offer was not available', async () => {
    expect((await record({ isLaunchOffer: false }))!.amount_minor).toBe(599900);
  });

  it('records what the payment gateway says was really paid, whatever the list price is', async () => {
    expect((await record({ isLaunchOffer: true, amountMinor: 123400 }))!.amount_minor).toBe(123400);
  });

  it('gives the access length of the plan', async () => {
    const r = (await record({ isLaunchOffer: true }))!;
    const days = Math.round((new Date(r.subscription_end_date!).getTime() - new Date(r.subscription_start_date!).getTime()) / 86400000);
    expect(days).toBe(180);
  });
});

describe('plan card text exists in every language', () => {
  const LANGS: LanguageCode[] = ['en', 'ta', 'ml', 'te', 'hi', 'kn'];
  const keys = Object.keys(translations.en).filter((k) => /^pl[A-Z]/.test(k));
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');

  it('has the card keys', () => {
    expect(keys).toEqual(
      expect.arrayContaining(['plLaunchTitle', 'plMonths', 'plPerMonth', 'plSaveAmount', 'plNoOffer', 'plOfferEndsOn', 'plYouSaveTotal'])
    );
  });

  for (const lang of LANGS) {
    it(`${lang} has every key with matching {placeholders}`, () => {
      expect(keys.filter((k) => !translations[lang][k])).toEqual([]);
      expect(keys.filter((k) => placeholders(translations[lang][k]) !== placeholders(translations.en[k]))).toEqual([]);
    });
  }
});
