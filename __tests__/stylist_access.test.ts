import { DEFAULT_STYLIST_PERMISSIONS, ScreenName, StylistPermissions } from '../src/types/domain';
import {
  SCREEN_PERMISSION,
  PERMISSION_KEYS,
  MODULE_KEYS,
  ModuleKey,
  PERMISSION_GROUPS,
  canAccessScreen,
  canShareBills,
  expensesVisibleTo,
  resolvePermissions,
  countAllowed,
  samePermissions,
} from '../src/utils/stylistAccess';

const none = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as unknown as StylistPermissions;
const all = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true])) as unknown as StylistPermissions;

describe('stylist access rules', () => {
  it('every module controls at least one screen', () => {
    const used = new Set(Object.values(SCREEN_PERMISSION));
    expect(MODULE_KEYS.filter((k) => !used.has(k))).toEqual([]);
  });

  it('every stored key appears in exactly one group on the owner sheet', () => {
    const grouped = PERMISSION_GROUPS.flatMap((g) => g.keys);
    expect([...grouped].sort()).toEqual([...PERMISSION_KEYS].sort());
    expect([...PERMISSION_KEYS].sort()).toEqual(Object.keys(DEFAULT_STYLIST_PERMISSIONS).sort());
  });

  for (const [screen, key] of Object.entries(SCREEN_PERMISSION) as [ScreenName, ModuleKey][]) {
    it(`${screen}: blocked when "${key}" is off, open when it is on`, () => {
      expect(canAccessScreen(screen, true, { ...all, [key]: false })).toBe(false);
      expect(canAccessScreen(screen, true, { ...none, [key]: true })).toBe(true);
    });
  }

  it('turning one permission off does not block screens that need a different one', () => {
    expect(canAccessScreen('customers', true, { ...all, expenses: false })).toBe(true);
    expect(canAccessScreen('expenses', true, { ...all, customers: false })).toBe(true);
  });

  it('owners are never blocked', () => {
    for (const screen of Object.keys(SCREEN_PERMISSION) as ScreenName[]) {
      expect(canAccessScreen(screen, false, none)).toBe(true);
    }
  });

  it('screens without a permission stay open to stylists', () => {
    expect(canAccessScreen('home', true, none)).toBe(true);
    expect(canAccessScreen('accounts', true, none)).toBe(true);
    expect(canAccessScreen('pricing', true, none)).toBe(true);
  });

  it('missing or old stored permissions fall back to the defaults, not to allowed', () => {
    expect(canAccessScreen('expenses', true, null)).toBe(false);
    expect(canAccessScreen('reports', true, undefined)).toBe(false);
    expect(canAccessScreen('customers', true, null)).toBe(true);
    const partial = { customers: false } as Partial<StylistPermissions>;
    expect(resolvePermissions(partial)).toEqual({ ...DEFAULT_STYLIST_PERMISSIONS, customers: false });
    expect(canAccessScreen('customers', true, partial)).toBe(false);
    expect(canAccessScreen('profile', true, partial)).toBe(false);
  });

  it('counts modules only, and compares every key', () => {
    expect(countAllowed(all)).toBe(8);
    expect(countAllowed(none)).toBe(0);
    expect(countAllowed(DEFAULT_STYLIST_PERMISSIONS)).toBe(4);
    expect(samePermissions(all, { ...all })).toBe(true);
    expect(samePermissions(all, { ...all, team: false })).toBe(false);
    expect(samePermissions(all, { ...all, shareBills: false })).toBe(false);
    expect(samePermissions(all, { ...all, expensesHistory: false })).toBe(false);
  });
});

describe('sharing bills', () => {
  it('defaults to blocked for stylists, always allowed for owners', () => {
    expect(DEFAULT_STYLIST_PERMISSIONS.shareBills).toBe(false);
    expect(canShareBills(true, null)).toBe(false);
    expect(canShareBills(true, undefined)).toBe(false);
    expect(canShareBills(false, none)).toBe(true);
  });

  it('follows the owner switch, independent of the Sales module', () => {
    expect(canShareBills(true, { ...DEFAULT_STYLIST_PERMISSIONS, shareBills: true })).toBe(true);
    expect(canShareBills(true, { ...all, shareBills: false })).toBe(false);
    expect(canShareBills(true, { ...none, sales: true })).toBe(false);
  });

  it('an older stored record without the key stays blocked', () => {
    const old = { customers: true, sales: true } as Partial<StylistPermissions>;
    expect(canShareBills(true, old)).toBe(false);
  });
});

describe('expenses visible to a stylist', () => {
  const now = new Date(2026, 9, 7, 15, 30); // 7 Oct 2026, 3:30pm local
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();
  const list = [
    { id: 'today-am', created_at: at(2026, 9, 7, 0) },
    { id: 'today-late', created_at: at(2026, 9, 7, 23) },
    { id: 'yesterday', created_at: at(2026, 9, 6, 23) },
    { id: 'last-week', created_at: at(2026, 9, 1) },
    { id: 'last-month', created_at: at(2026, 8, 20) },
  ];
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('shows only today when the stylist has Expenses but not past expenses', () => {
    const perms = { ...DEFAULT_STYLIST_PERMISSIONS, expenses: true, expensesHistory: false };
    expect(ids(expensesVisibleTo(list, true, perms, now))).toEqual(['today-am', 'today-late']);
  });

  it('shows everything when past expenses are allowed', () => {
    const perms = { ...DEFAULT_STYLIST_PERMISSIONS, expenses: true, expensesHistory: true };
    expect(ids(expensesVisibleTo(list, true, perms, now))).toHaveLength(5);
  });

  it('shows nothing when the Expenses module is off, even with past expenses on', () => {
    const perms = { ...DEFAULT_STYLIST_PERMISSIONS, expenses: false, expensesHistory: true };
    expect(expensesVisibleTo(list, true, perms, now)).toEqual([]);
  });

  it('owners see every expense', () => {
    expect(expensesVisibleTo(list, false, none, now)).toHaveLength(5);
  });

  it('an old record that has Expenses on but no history key is limited to today', () => {
    const old = { expenses: true } as Partial<StylistPermissions>;
    expect(ids(expensesVisibleTo(list, true, old, now))).toEqual(['today-am', 'today-late']);
  });

  it('ignores entries with an unreadable date instead of leaking them', () => {
    const perms = { ...DEFAULT_STYLIST_PERMISSIONS, expenses: true };
    expect(expensesVisibleTo([{ created_at: 'not a date' }], true, perms, now)).toEqual([]);
  });
});
