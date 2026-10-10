import { findDuplicateService, normalizeServiceName } from '../src/utils/serviceName';
import type { Service } from '../src/types/domain';

const svc = (id: string, name: string, cat = 'Hair'): Service =>
  ({ id, shop_id: 's', category_id: null, category_name: cat, name, price_minor: 20000, duration_minutes: 30, is_active: true } as Service);

describe('duplicate service detection', () => {
  const list = [svc('1', 'Haircut - Men'), svc('2', 'Facial', 'Skin')];

  it('ignores case, outer spaces and repeated spaces', () => {
    expect(normalizeServiceName('  HAIRCUT   -  men ')).toBe('haircut - men');
    expect(findDuplicateService(list, '  haircut -   MEN ')?.id).toBe('1');
  });

  it('matches across categories', () => {
    expect(findDuplicateService(list, 'facial')?.id).toBe('2');
  });

  it('does not match different names or empty input', () => {
    expect(findDuplicateService(list, 'Haircut - Women')).toBeUndefined();
    expect(findDuplicateService(list, '   ')).toBeUndefined();
  });

  it('lets a service keep its own name when editing', () => {
    expect(findDuplicateService(list, 'Facial', '2')).toBeUndefined();
    expect(findDuplicateService(list, 'Facial', '1')?.id).toBe('2');
  });
});
