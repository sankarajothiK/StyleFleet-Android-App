import { SubscriptionRecord, SubscriptionStateCategory } from '../types/domain';
import { getPlanById } from '../config/planConfig';

export interface TrialCalculationResult {
  state: SubscriptionStateCategory;
  isExpired: boolean;
  isExpiringSoon: boolean;
  totalDays: number;
  completedDays: number;
  remainingDays: number;
  progress: number; // 0.0 to 1.0
  displayTitle: string;
  displaySubtitle: string;
  actionButtonLabel: string;
}

export interface SubscriptionCalculationResult {
  state: SubscriptionStateCategory;
  planName: string;
  planId: string;
  startDateFormatted: string;
  endDateFormatted: string;
  totalDays: number;
  completedDays: number;
  remainingDays: number;
  progress: number; // 0.0 to 1.0
  isExpired: boolean;
}

export const TRIAL_TOTAL_DAYS = 30;
export const TRIAL_EXPIRING_THRESHOLD_DAYS = 5;

/**
 * Normalizes a date to UTC midnight for consistent day-count calculations
 * regardless of the user device's local timezone.
 */
export function normalizeDateToUtcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Calculates Free Trial status and progress from the authoritative registration date.
 * 
 * Convention:
 * - Day 1 (Registration Day, elapsed 0): Day 1 of 30, 30 days remaining.
 * - Day 2 to Day 30: elapsed days completed, (30 - elapsed) remaining.
 * - Day 31 onward (elapsed >= 31): Trial Expired.
 */
export function calculateTrialStatus(
  registrationDateIso: string,
  currentDate: Date = new Date()
): TrialCalculationResult {
  let regDate = new Date(registrationDateIso);
  if (isNaN(regDate.getTime())) {
    regDate = new Date(); // fallback safe
  }

  const regUtc = normalizeDateToUtcMidnight(regDate);
  const curUtc = normalizeDateToUtcMidnight(currentDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.max(0, Math.floor((curUtc - regUtc) / msPerDay));

  // Day 31 onward = Expired
  if (daysElapsed >= 31) {
    return {
      state: 'TRIAL_EXPIRED',
      isExpired: true,
      isExpiringSoon: false,
      totalDays: TRIAL_TOTAL_DAYS,
      completedDays: TRIAL_TOTAL_DAYS,
      remainingDays: 0,
      progress: 1,
      displayTitle: 'Free Trial Expired',
      displaySubtitle: 'Your 30-day free trial has ended. Subscribe to continue using StyleFleet.',
      actionButtonLabel: 'View Plans',
    };
  }

  // Active or near expiration trial
  // Day 1: registered today (daysElapsed === 0)
  const isDayOne = daysElapsed === 0;
  const completedDays = isDayOne ? 0 : Math.min(TRIAL_TOTAL_DAYS, daysElapsed);
  const remainingDays = isDayOne ? TRIAL_TOTAL_DAYS : Math.max(0, TRIAL_TOTAL_DAYS - daysElapsed);
  const progress = Math.min(1, Math.max(0.03, completedDays / TRIAL_TOTAL_DAYS));

  const isExpiringSoon = remainingDays <= TRIAL_EXPIRING_THRESHOLD_DAYS && remainingDays > 0;

  const state: SubscriptionStateCategory = isExpiringSoon
    ? 'TRIAL_EXPIRING_SOON'
    : 'TRIAL_ACTIVE';

  const subtitle = isDayOne
    ? `Day 1 of ${TRIAL_TOTAL_DAYS} · ${remainingDays} days remaining`
    : `${completedDays} / ${TRIAL_TOTAL_DAYS} days completed · ${remainingDays} days remaining`;

  return {
    state,
    isExpired: false,
    isExpiringSoon,
    totalDays: TRIAL_TOTAL_DAYS,
    completedDays,
    remainingDays,
    progress,
    displayTitle: 'Free Trial',
    displaySubtitle: subtitle,
    actionButtonLabel: isExpiringSoon ? 'Subscribe Now' : 'View Plans',
  };
}

/**
 * Calculates active subscription status, remaining days, and renewal date.
 */
export function calculateSubscriptionStatus(
  subscription: SubscriptionRecord,
  currentDate: Date = new Date()
): SubscriptionCalculationResult {
  const plan = getPlanById(subscription.plan_id);
  const planName = plan ? `${plan.name} Premium` : 'Premium Plan';

  const start = subscription.subscription_start_date
    ? new Date(subscription.subscription_start_date)
    : new Date();
  const end = subscription.subscription_end_date
    ? new Date(subscription.subscription_end_date)
    : new Date(start.getTime() + (plan?.durationDays || 30) * 86400000);

  const startUtc = normalizeDateToUtcMidnight(start);
  const endUtc = normalizeDateToUtcMidnight(end);
  const curUtc = normalizeDateToUtcMidnight(currentDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((endUtc - startUtc) / msPerDay));
  const remainingDays = Math.max(0, Math.ceil((endUtc - curUtc) / msPerDay));
  const completedDays = Math.max(0, totalDays - remainingDays);
  const progress = Math.min(1, Math.max(0.05, completedDays / totalDays));
  const isExpired = curUtc > endUtc || subscription.status === 'expired';

  return {
    state: isExpired ? 'TRIAL_EXPIRED' : 'ACTIVE_SUBSCRIPTION',
    planName,
    planId: subscription.plan_id,
    startDateFormatted: formatDate(start),
    endDateFormatted: formatDate(end),
    totalDays,
    completedDays,
    remainingDays,
    progress,
    isExpired,
  };
}

export function formatDate(date: Date): string {
  try {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Determines whether a given registration date is within the first 30 days.
 * Registration Day (Day 0) through Day 30 is within the first 30 days (age <= 30 days).
 * Day 31 onward (age > 30 days) has expired and is NOT eligible for launch offer pricing.
 */
export function isWithinFirst30DaysOfRegistration(
  registrationDateIso?: string | null,
  currentDate: Date = new Date()
): boolean {
  if (!registrationDateIso) return false;
  const regDate = new Date(registrationDateIso);
  if (isNaN(regDate.getTime())) return false;

  const regUtc = normalizeDateToUtcMidnight(regDate);
  const curUtc = normalizeDateToUtcMidnight(currentDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysElapsed = Math.floor((curUtc - regUtc) / msPerDay);

  // Negative days (clock skew) treated as day 0
  if (daysElapsed < 0) return true;

  return daysElapsed <= 30;
}

/**
 * Calculates the number of full days elapsed since registration date.
 */
export function getRegistrationDaysElapsed(
  registrationDateIso?: string | null,
  currentDate: Date = new Date()
): number {
  if (!registrationDateIso) return 999;
  const regDate = new Date(registrationDateIso);
  if (isNaN(regDate.getTime())) return 999;

  const regUtc = normalizeDateToUtcMidnight(regDate);
  const curUtc = normalizeDateToUtcMidnight(currentDate);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.floor((curUtc - regUtc) / msPerDay));
}

/**
 * Returns the exact remaining days of the Launch Offer (30 down to 0).
 */
export function getRemainingLaunchOfferDays(
  registrationDateIso?: string | null,
  currentDate: Date = new Date()
): number {
  if (!registrationDateIso) return 0;
  const daysElapsed = getRegistrationDaysElapsed(registrationDateIso, currentDate);
  if (daysElapsed > 30) return 0;
  return Math.max(0, 30 - daysElapsed);
}


/** Sales allowed on the free plan before booking, billing and reports need Pro. */
export const FREE_SALES_LIMIT = 100;
/** The gentle warning on Home starts at this many sales (for the default limit). */
export const FREE_SALES_WARN_AT = 80;

/** The free-sales limit for a salon: its own override (shops.free_sales_limit) or the default. */
export function resolveFreeSalesLimit(override?: number | null): number {
  return typeof override === 'number' && Number.isFinite(override) && override >= 1
    ? Math.floor(override)
    : FREE_SALES_LIMIT;
}

export type FreeLimitNudge =
  | { level: 'none' }
  | { level: 'warn'; left: number }
  | { level: 'limit' };

/** What, if anything, Home should say about the free-plan sales limit. */
export function getFreeLimitNudge(
  totalSalesCount: number,
  isPro: boolean,
  limit: number = FREE_SALES_LIMIT
): FreeLimitNudge {
  if (isPro) return { level: 'none' };
  if (totalSalesCount >= limit) return { level: 'limit' };
  const warnAt = Math.max(1, limit - (FREE_SALES_LIMIT - FREE_SALES_WARN_AT));
  if (totalSalesCount >= warnAt) {
    return { level: 'warn', left: limit - totalSalesCount };
  }
  return { level: 'none' };
}

/**
 * The last day of the launch offer: 30 days after the registration date (same day-counting as
 * isWithinFirst30DaysOfRegistration). Null when the registration date is unknown.
 */
export function getLaunchOfferEndDate(registrationDateIso?: string | null): Date | null {
  if (!registrationDateIso) return null;
  const regDate = new Date(registrationDateIso);
  if (isNaN(regDate.getTime())) return null;
  const regUtc = normalizeDateToUtcMidnight(regDate);
  return new Date(regUtc + 30 * 24 * 60 * 60 * 1000);
}

export interface PlanStatus {
  state: 'pro' | 'free' | 'limit';
  used: number;
  total: number;
  /** 0 to 1, how much of the free sales are used (1 for Pro) */
  progress: number;
}

/** Where a salon stands: Pro, free with sales left, or free and out of sales. */
export function getPlanStatus(
  totalSalesCount: number,
  isPro: boolean,
  limit: number = FREE_SALES_LIMIT
): PlanStatus {
  const used = Math.max(0, Math.floor(totalSalesCount || 0));
  if (isPro) return { state: 'pro', used, total: limit, progress: 1 };
  const shown = Math.min(used, limit);
  return {
    state: used >= limit ? 'limit' : 'free',
    used: shown,
    total: limit,
    progress: shown / limit,
  };
}
