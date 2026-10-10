import { FREE_SALES_LIMIT, getPlanStatus } from '../src/utils/subscriptionUtils';

describe('"Your plan" card: where the salon stands', () => {
  it('a new salon is free with nothing used', () => {
    expect(getPlanStatus(0, false)).toEqual({ state: 'free', used: 0, total: 100, progress: 0 });
  });

  it('shows how much of the free sales is used', () => {
    expect(getPlanStatus(43, false)).toEqual({ state: 'free', used: 43, total: 100, progress: 0.43 });
    expect(getPlanStatus(99, false).state).toBe('free');
  });

  it('is at the limit from the 100th sale', () => {
    expect(getPlanStatus(100, false)).toEqual({ state: 'limit', used: 100, total: 100, progress: 1 });
    expect(FREE_SALES_LIMIT).toBe(100);
  });

  it('never shows more than 100 used, or a bar longer than full, even if more were created', () => {
    const s = getPlanStatus(137, false);
    expect(s.state).toBe('limit');
    expect(s.used).toBe(100);
    expect(s.progress).toBe(1);
  });

  it('Pro is Pro whatever the sales count, with a full bar and no limit', () => {
    expect(getPlanStatus(0, true).state).toBe('pro');
    expect(getPlanStatus(500, true)).toEqual({ state: 'pro', used: 500, total: 100, progress: 1 });
  });

  it('copes with a missing or odd count', () => {
    expect(getPlanStatus(undefined as unknown as number, false).used).toBe(0);
    expect(getPlanStatus(-5, false).used).toBe(0);
    expect(getPlanStatus(12.9, false).used).toBe(12);
  });
});
