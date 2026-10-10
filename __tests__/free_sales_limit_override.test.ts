import {
  FREE_SALES_LIMIT,
  getFreeLimitNudge,
  getPlanStatus,
  resolveFreeSalesLimit,
} from '../src/utils/subscriptionUtils';

describe('per-salon free sales limit', () => {
  it('falls back to the default when there is no override', () => {
    expect(resolveFreeSalesLimit(null)).toBe(FREE_SALES_LIMIT);
    expect(resolveFreeSalesLimit(undefined)).toBe(FREE_SALES_LIMIT);
    expect(resolveFreeSalesLimit(0)).toBe(FREE_SALES_LIMIT);
    expect(resolveFreeSalesLimit(-5)).toBe(FREE_SALES_LIMIT);
    expect(resolveFreeSalesLimit(NaN)).toBe(FREE_SALES_LIMIT);
  });

  it('uses a valid override', () => {
    expect(resolveFreeSalesLimit(500)).toBe(500);
    expect(resolveFreeSalesLimit(250.9)).toBe(250);
  });

  it('plan status follows the override', () => {
    expect(getPlanStatus(150, false, 500)).toEqual({ state: 'free', used: 150, total: 500, progress: 0.3 });
    expect(getPlanStatus(500, false, 500).state).toBe('limit');
  });

  it('nudge follows the override and keeps default behaviour', () => {
    expect(getFreeLimitNudge(150, false, 500)).toEqual({ level: 'none' });
    expect(getFreeLimitNudge(480, false, 500)).toEqual({ level: 'warn', left: 20 });
    expect(getFreeLimitNudge(500, false, 500)).toEqual({ level: 'limit' });
    expect(getFreeLimitNudge(80, false)).toEqual({ level: 'warn', left: 20 });
  });
});
