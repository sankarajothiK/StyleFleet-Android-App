import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeSupabase, FakeCall, FakeResult } from './helpers/fakeSupabase';

let mockFrom: (table: string) => unknown = () => ({});
jest.mock('../src/lib/supabase', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

// eslint-disable-next-line import/first
import { serviceRepository } from '../src/repositories/serviceRepository';
// eslint-disable-next-line import/first
import { Service } from '../src/types/domain';

const SHOP = '00000000-0000-4000-8000-0000000000a1';
const SVC = '00000000-0000-4000-8000-0000000000a2';
const OTHER = '00000000-0000-4000-8000-0000000000a3';
const KEY = `@salon_os_services_cache_${SHOP}`;

const svc = (id: string, name: string, price_minor: number): Service => ({
  id,
  shop_id: SHOP,
  category_id: null,
  category_name: 'Hair',
  name,
  price_minor,
  duration_minutes: 30,
  is_active: true,
});

function install(responder: (c: FakeCall) => FakeResult | undefined = () => undefined) {
  const fake = createFakeSupabase(responder);
  mockFrom = fake.from;
  return fake;
}

const cachedServices = async (): Promise<Service[]> => JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');

beforeEach(async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem(KEY, JSON.stringify([svc(SVC, 'Haircut', 30000), svc(OTHER, 'Shave', 20000)]));
});

describe('changing a price', () => {
  it('saves to the server first, then returns the list re-sorted by price without reloading it', async () => {
    const fake = install();
    const list = await serviceRepository.updateService(SHOP, SVC, { priceRupees: 150 });

    expect(fake.callsTo('services', 'update')).toHaveLength(1);
    expect(fake.callsTo('services', 'select')).toHaveLength(0); // no full reload
    expect(list.map((s) => [s.name, s.price_minor])).toEqual([['Haircut', 15000], ['Shave', 20000]]);
    expect((await cachedServices()).find((s) => s.id === SVC)?.price_minor).toBe(15000);
  });

  it('throws and leaves the saved price alone when the server rejects the save', async () => {
    install((c) => (c.table === 'services' && c.op === 'update' ? { error: { message: 'Network request failed' } } : undefined));

    await expect(serviceRepository.updateService(SHOP, SVC, { priceRupees: 150 })).rejects.toThrow(/not saved/i);
    expect((await cachedServices()).find((s) => s.id === SVC)?.price_minor).toBe(30000);
  });

  it('throws when the server matched no service to update', async () => {
    install((c) => (c.table === 'services' && c.op === 'update' ? { data: [] } : undefined));

    await expect(serviceRepository.updateService(SHOP, SVC, { priceRupees: 150 })).rejects.toThrow(/not found/i);
    expect((await cachedServices()).find((s) => s.id === SVC)?.price_minor).toBe(30000);
  });
});

describe('removing a service', () => {
  it('throws and keeps the service when the server rejects the removal', async () => {
    install((c) => (c.table === 'services' && c.op === 'update' ? { error: { message: 'Network request failed' } } : undefined));

    await expect(serviceRepository.removeService(SHOP, SVC)).rejects.toThrow(/not saved/i);
    expect((await cachedServices()).map((s) => s.id)).toContain(SVC);
  });

  it('removes it from the saved list once the server accepts', async () => {
    install();
    await serviceRepository.removeService(SHOP, SVC);
    expect((await cachedServices()).map((s) => s.id)).toEqual([OTHER]);
  });
});
