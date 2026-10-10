import { orderServicesForQuickPick } from '../src/services/servicePriority';

const mk = (names: string[]) => names.map((name, i) => ({ id: `s${i}`, name }));

describe('orderServicesForQuickPick', () => {
  it('puts Haircut, Trim, Shaving, Haircut + wash first', () => {
    const out = orderServicesForQuickPick(mk(['Skin fade', 'Haircut + wash', 'Beard trim', 'Trim', 'Shaving', 'Haircut', 'Hair spa']));
    expect(out.map((s) => s.name)).toEqual(['Haircut', 'Trim', 'Shaving', 'Haircut + wash', 'Skin fade', 'Beard trim', 'Hair spa']);
  });

  it('does not treat a beard trim as the Trim quick pick', () => {
    const out = orderServicesForQuickPick(mk(['Beard trim & shape', 'Haircut']));
    expect(out.map((s) => s.name)).toEqual(['Haircut', 'Beard trim & shape']);
  });

  it('falls back to a shave service and ignores Head shave when a better one exists', () => {
    const out = orderServicesForQuickPick(mk(['Head shave', 'Royal shave · hot towel', 'Haircut']));
    expect(out.map((s) => s.name).slice(0, 2)).toEqual(['Haircut', 'Royal shave · hot towel']);
  });

  it('skips missing ones and keeps the rest in order', () => {
    const out = orderServicesForQuickPick(mk(['Hair spa', 'Haircut']));
    expect(out.map((s) => s.name)).toEqual(['Haircut', 'Hair spa']);
    expect(orderServicesForQuickPick([])).toEqual([]);
  });
});
