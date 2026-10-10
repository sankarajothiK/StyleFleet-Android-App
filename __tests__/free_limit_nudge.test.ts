import { getFreeLimitNudge, FREE_SALES_LIMIT, FREE_SALES_WARN_AT } from '../src/utils/subscriptionUtils';

describe('getFreeLimitNudge', () => {
  it('stays quiet below the warning threshold', () => {
    expect(getFreeLimitNudge(0, false)).toEqual({ level: 'none' });
    expect(getFreeLimitNudge(FREE_SALES_WARN_AT - 1, false)).toEqual({ level: 'none' });
  });

  it('warns with the number of sales left from the threshold up to the limit', () => {
    expect(getFreeLimitNudge(FREE_SALES_WARN_AT, false)).toEqual({ level: 'warn', left: 20 });
    expect(getFreeLimitNudge(99, false)).toEqual({ level: 'warn', left: 1 });
  });

  it('reports the limit once it is reached or passed', () => {
    expect(getFreeLimitNudge(FREE_SALES_LIMIT, false)).toEqual({ level: 'limit' });
    expect(getFreeLimitNudge(150, false)).toEqual({ level: 'limit' });
  });

  it('never nags Pro users', () => {
    expect(getFreeLimitNudge(0, true)).toEqual({ level: 'none' });
    expect(getFreeLimitNudge(95, true)).toEqual({ level: 'none' });
    expect(getFreeLimitNudge(500, true)).toEqual({ level: 'none' });
  });
});
