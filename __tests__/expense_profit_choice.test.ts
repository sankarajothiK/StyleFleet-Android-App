import { translations, LanguageCode } from '../src/i18n/translations';
import { countsInProfit, splitExpenseTotals } from '../src/utils/expenseProfit';

const SHOP = '00000000-0000-4000-8000-0000000000d1';
const mockInserts: Record<string, unknown>[] = [];
const mockUpdates: Record<string, unknown>[] = [];
let mockInsertError: { message: string; code?: string } | null = null;
let mockUpdateError: { message: string; code?: string } | null = null;

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: (row: Record<string, unknown>) => {
        mockInserts.push(row);
        return {
          select: () => ({
            single: () =>
              Promise.resolve(
                mockInsertError ? { data: null, error: mockInsertError } : { data: { id: '00000000-0000-4000-8000-0000000000c1', ...row }, error: null }
              ),
          }),
        };
      },
      update: (row: Record<string, unknown>) => {
        mockUpdates.push(row);
        return {
          eq: () => ({
            eq: () => ({
              select: () => Promise.resolve({ data: mockUpdateError ? null : [{ id: 'x' }], error: mockUpdateError }),
            }),
          }),
        };
      },
    })),
  },
}));

// eslint-disable-next-line import/first
import { expenseRepository } from '../src/repositories/expenseRepository';
import { Expense } from '../src/types/domain';

const exp = (amount: number, include?: boolean, category = 'Rent'): Expense => ({
  id: `e${Math.random()}`,
  shop_id: 's',
  category_id: null,
  category_name: category,
  note: 'n',
  amount_minor: amount,
  payment_method: 'UPI',
  expense_date: 'Today',
  created_at: new Date().toISOString(),
  ...(include === undefined ? {} : { include_in_profit: include }),
});

beforeEach(() => {
  mockInserts.length = 0;
  mockUpdates.length = 0;
  mockInsertError = null;
  mockUpdateError = null;
});

describe('which expenses count in profit', () => {
  it('counts unless the owner turned it off, including old records without the field', () => {
    expect(countsInProfit(exp(100))).toBe(true);
    expect(countsInProfit(exp(100, true))).toBe(true);
    expect(countsInProfit(exp(100, false))).toBe(false);
    expect(countsInProfit({ include_in_profit: null })).toBe(true);
    expect(countsInProfit(null)).toBe(false);
  });

  it('splits totals into counted and not counted', () => {
    expect(splitExpenseTotals([exp(1000), exp(500, false), exp(250, true), exp(50, false)])).toEqual({
      countedMinor: 1250,
      countedCount: 2,
      excludedMinor: 550,
      excludedCount: 2,
    });
    expect(splitExpenseTotals([])).toEqual({ countedMinor: 0, countedCount: 0, excludedMinor: 0, excludedCount: 0 });
  });
});

describe('profit and loss (Accounts)', () => {
  const bills = [{ total_minor: 100000, status: 'paid', created_at: new Date().toISOString(), paid_amount_minor: 100000 }];

  it('subtracts only the expenses that count', () => {
    const pnl = expenseRepository.getPnLMetrics('Month', bills, [exp(20000), exp(30000, false)]);
    expect(pnl.income_minor).toBe(100000);
    expect(pnl.expense_minor).toBe(20000);
    expect(pnl.excluded_minor).toBe(30000);
    expect(pnl.net_minor).toBe(80000);
    expect(pnl.margin_pct).toBe(80);
  });

  it('behaves exactly as before when every expense counts', () => {
    const pnl = expenseRepository.getPnLMetrics('Month', bills, [exp(20000), exp(10000)]);
    expect(pnl.expense_minor).toBe(30000);
    expect(pnl.excluded_minor).toBe(0);
    expect(pnl.net_minor).toBe(70000);
  });

  it('still shows an uncounted expense under "where the money went", with shares of the total spent', () => {
    const pnl = expenseRepository.getPnLMetrics('Month', bills, [
      exp(30000, true, 'Rent'),
      exp(10000, false, 'Personal'),
    ]);
    const byLabel = Object.fromEntries(pnl.categories.map((c) => [c.label, c]));
    expect(byLabel.Personal.amt_minor).toBe(10000);
    expect(byLabel.Rent.pct).toBe(75);
    expect(byLabel.Personal.pct).toBe(25);
    expect(pnl.categories.reduce((s, c) => s + c.pct, 0)).toBe(100);
  });

  it('an expense that does not count leaves profit unchanged', () => {
    const base = expenseRepository.getPnLMetrics('Month', bills, [exp(20000)]);
    const withPersonal = expenseRepository.getPnLMetrics('Month', bills, [exp(20000), exp(99999, false)]);
    expect(withPersonal.net_minor).toBe(base.net_minor);
  });
});

describe('saving the choice', () => {
  it('does not send the column when the expense counts, so adding works before the database update', async () => {
    await expenseRepository.addExpense(SHOP, 'Rent', 100, 'note', 'UPI', true);
    expect(mockInserts[0]).not.toHaveProperty('include_in_profit');
  });

  it('sends include_in_profit false when the owner turns it off', async () => {
    const saved = await expenseRepository.addExpense(SHOP, 'Rent', 100, 'note', 'UPI', false);
    expect(mockInserts[0]).toMatchObject({ include_in_profit: false });
    expect(saved.include_in_profit).toBe(false);
  });

  it('defaults to counting', async () => {
    const saved = await expenseRepository.addExpense(SHOP, 'Rent', 100, 'note');
    expect(saved.include_in_profit).toBe(true);
  });

  it('explains a missing database column instead of a raw error', async () => {
    mockInsertError = { message: 'column "include_in_profit" of relation "expenses" does not exist' };
    await expect(expenseRepository.addExpense(SHOP, 'Rent', 100, 'note', 'UPI', false)).rejects.toThrow(
      /needs a database update/
    );
  });

  it('changing the choice on an existing expense is saved, leaving it alone is not', async () => {
    const saved = await expenseRepository.addExpense(SHOP, 'Rent', 100, 'note', 'UPI', true);

    await expenseRepository.updateExpense(SHOP, saved.id, { note: 'renamed' });
    expect(mockUpdates[0]).not.toHaveProperty('include_in_profit');

    const flipped = await expenseRepository.updateExpense(SHOP, saved.id, { includeInProfit: false });
    expect(mockUpdates[1]).toMatchObject({ include_in_profit: false });
    expect(flipped?.include_in_profit).toBe(false);

    await expenseRepository.updateExpense(SHOP, saved.id, { includeInProfit: false });
    expect(mockUpdates[2]).not.toHaveProperty('include_in_profit');

    const back = await expenseRepository.updateExpense(SHOP, saved.id, { includeInProfit: true });
    expect(mockUpdates[3]).toMatchObject({ include_in_profit: true });
    expect(back?.include_in_profit).toBe(true);
  });
});

describe('profit choice strings', () => {
  const LANGS: LanguageCode[] = ['en', 'ta', 'ml', 'te', 'hi', 'kn'];
  const keys = ['exCountProfit', 'exCountProfitOn', 'exCountProfitOff', 'exNotInProfit', 'exNotCounted'];
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const lang of LANGS) {
    it(`${lang} has every string with matching {placeholders}`, () => {
      expect(keys.filter((k) => !translations[lang][k])).toEqual([]);
      expect(keys.filter((k) => placeholders(translations[lang][k]) !== placeholders(translations.en[k]))).toEqual([]);
    });
  }
});
