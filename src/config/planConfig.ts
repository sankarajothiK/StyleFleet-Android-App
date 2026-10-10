/**
 * StyleFleet Centralized Subscription Plan Configuration
 * All pricing, durations and savings come from this one file.
 *
 * Price list (INR).
 *   Plan        Regular price     Offer price (first 30 days only)
 *   3 months    ₹2,999            ₹2,999   no offer
 *   6 months    ₹5,999            ₹4,799   saves ₹1,200 (20%)
 *   12 months   ₹11,999           ₹5,999   saves ₹6,000 (50%)
 *
 * The 6 and 12 month offer is only for the first 30 days after the salon registered.
 * After that every plan is at its regular price (see isWithinFirst30DaysOfRegistration).
 */

export type PlanId =
  | '1_month'
  | '3_months'
  | '6_months'
  | '12_months'
  | 'sf_plan_1m'
  | 'sf_plan_3m'
  | 'sf_plan_6m'
  | 'sf_plan_12m';

export interface SubscriptionPlanConfig {
  id: PlanId;
  name: string;
  durationMonths: number;
  durationDays: number;
  price: number; // in INR, what the salon pays
  priceInRupees: number; // alias for compatibility
  originalPrice: number; // in INR, the regular price of this plan (what it costs without the offer)
  perDayAmount: number;
  perDayDisplay: string;
  isPopular?: boolean;
  isBestValue?: boolean;
  badge?: string;
  discountPercent: number;
  effectiveMonthlyRateMinor: number;
  features: string[];
}

export type SubscriptionPlan = SubscriptionPlanConfig;

export interface PlanPricingCalculation {
  plan: SubscriptionPlanConfig;
  savings: number;
  discountPercentage: number;
  effectiveMonthlyPrice: number;
  formattedPrice: string;
  formattedOriginalPrice: string;
  formattedSavings: string;
}

/** Reference price of one month, in INR. Plan prices are set per plan below; this is only for display and tests. */
export const BASELINE_MONTHLY_PRICE = 999;

/** Days after registration that the launch offer lasts */
export const LAUNCH_OFFER_DAYS = 30;

const PLAN_FEATURES = [
  'Unlimited bill generation',
  'Unlimited report downloads (PDF & Excel)',
  'Team management & stylist commissions',
];

interface PlanSpec {
  id: PlanId;
  months: number;
  days: number;
  /** INR paid after the launch offer (the regular price) */
  regularPrice: number;
  /** INR paid on the launch offer */
  launchPrice: number;
  launchBadge?: string;
  isPopular?: boolean;
  isBestValue?: boolean;
}

const PLAN_SPECS: PlanSpec[] = [
  { id: '3_months', months: 3, days: 90, regularPrice: 2999, launchPrice: 2999 },
  { id: '6_months', months: 6, days: 180, regularPrice: 5999, launchPrice: 4799, launchBadge: '20% OFF', isPopular: true },
  { id: '12_months', months: 12, days: 365, regularPrice: 11999, launchPrice: 5999, launchBadge: '50% OFF', isBestValue: true },
];

function buildPlan(spec: PlanSpec, onLaunchOffer: boolean): SubscriptionPlanConfig {
  const originalPrice = spec.regularPrice;
  const price = onLaunchOffer ? spec.launchPrice : spec.regularPrice;
  const monthlyRate = price / spec.months;
  const perDay = price / spec.days;

  return {
    id: spec.id,
    name: `${spec.months} Months`,
    durationMonths: spec.months,
    durationDays: spec.days,
    price,
    priceInRupees: price,
    originalPrice,
    perDayAmount: Math.round(perDay * 10) / 10,
    perDayDisplay: `₹${perDay.toFixed(1)} / day`,
    isPopular: onLaunchOffer ? spec.isPopular : undefined,
    isBestValue: onLaunchOffer ? spec.isBestValue : undefined,
    badge: onLaunchOffer ? spec.launchBadge : undefined,
    discountPercent: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
    effectiveMonthlyRateMinor: Math.round(monthlyRate * 100),
    features: PLAN_FEATURES,
  };
}

// Regular plans: shown once the salon is more than 30 days past registration. No discounts.
export const STANDARD_SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = PLAN_SPECS.map((s) => buildPlan(s, false));

// Launch offer plans: available only during the first 30 days after registration.
export const LAUNCH_OFFER_SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = PLAN_SPECS.map((s) => buildPlan(s, true));

// Default baseline plans export (backwards compatibility)
export const SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = STANDARD_SUBSCRIPTION_PLANS;

/**
 * Returns the active subscription plans based on whether the user is eligible for the First 30 Days Launch Offer
 */
export function getSubscriptionPlans(isLaunchOffer: boolean = false): SubscriptionPlanConfig[] {
  return isLaunchOffer ? LAUNCH_OFFER_SUBSCRIPTION_PLANS : STANDARD_SUBSCRIPTION_PLANS;
}

/**
 * Formats a number to Indian Rupee representation (e.g. ₹1,299)
 */
export function formatPriceInRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Calculates raw savings in Rupees for a given plan
 */
export function calculateSavingsRupees(plan: SubscriptionPlanConfig): number {
  return Math.max(0, plan.originalPrice - plan.price);
}

/**
 * Calculates discount percentage for a given plan
 */
export function calculateSavingsPercent(plan: SubscriptionPlanConfig): number {
  if (plan.originalPrice <= plan.price) return 0;
  return Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100);
}

/**
 * Calculates mathematical discounts, savings, and effective monthly prices for a plan
 */
export function calculatePlanPricing(plan: SubscriptionPlanConfig): PlanPricingCalculation {
  const savings = calculateSavingsRupees(plan);
  const discountPercentage = calculateSavingsPercent(plan);
  const effectiveMonthlyPrice = Math.round(plan.price / plan.durationMonths);

  return {
    plan,
    savings,
    discountPercentage,
    effectiveMonthlyPrice,
    formattedPrice: formatPriceInRupees(plan.price),
    formattedOriginalPrice: formatPriceInRupees(plan.originalPrice),
    formattedSavings: formatPriceInRupees(savings),
  };
}

/**
 * Find plan by its unique plan ID (supporting both launch offer and standard pools)
 */
export function getPlanById(
  planId: string,
  isLaunchOffer: boolean = false
): SubscriptionPlanConfig | undefined {
  const normalizedId = planId
    .replace('sf_plan_', '')
    .replace('1m', '1_month')
    .replace('3m', '3_months')
    .replace('6m', '6_months')
    .replace('12m', '12_months');

  const primaryPool = isLaunchOffer ? LAUNCH_OFFER_SUBSCRIPTION_PLANS : STANDARD_SUBSCRIPTION_PLANS;
  const secondaryPool = isLaunchOffer ? STANDARD_SUBSCRIPTION_PLANS : LAUNCH_OFFER_SUBSCRIPTION_PLANS;

  return (
    primaryPool.find((p) => p.id === planId || p.id === normalizedId) ||
    secondaryPool.find((p) => p.id === planId || p.id === normalizedId)
  );
}
