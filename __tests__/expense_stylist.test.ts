import { translations, LanguageCode } from '../src/i18n/translations';
import { stylistNameFor, stylistOptions } from '../src/utils/expenseStylist';

const SHOP = '00000000-0000-4000-8000-0000000000d1';
const mockInserts: Record<string, unknown>[] = [];
const mockUpdates: Record<string, unknown>[] = [];
let mockInsertError: { message: string; code?: string } | null = null;

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
        return { eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: 'x' }], error: null }) }) }) };
      },
    })),
  },
}));

// eslint-disable-next-line import/first
import { expenseRepository } from '../src/repositories/expenseRepository';

const team = [
  { id: 'a', name: 'Asha', is_active: true },
  { id: 'b', name: 'Ravi', is_active: true },
  { id: 'c', name: 'Old Timer', is_active: false },
];

beforeEach(() => {
  mockInserts.length = 0;
  mockUpdates.length = 0;
  mockInsertError = null;
});

describe('who an expense can be linked to', () => {
  it('lists active team members only', () => {
    expect(stylistOptions(team).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('keeps an already-linked member in the list even after they became inactive', () => {
    expect(stylistOptions(team, 'c').map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('copes with no team', () => {
    expect(stylistOptions([])).toEqual([]);
    expect(stylistOptions(undefined as unknown as typeof team)).toEqual([]);
  });

  it('finds the name for a link, and nothing for a shop expense or a removed member', () => {
    expect(stylistNameFor(team, 'b')).toBe('Ravi');
    expect(stylistNameFor(team, 'c')).toBe('Old Timer');
    expect(stylistNameFor(team, null)).toBeNull();
    expect(stylistNameFor(team, undefined)).toBeNull();
    expect(stylistNameFor(team, 'gone')).toBeNull();
  });
});

describe('saving the link', () => {
  it('does not send staff_id for an ordinary shop expense, so adding works before the database update', async () => {
    const saved = await expenseRepository.addExpense(SHOP, 'Rent', 100, 'note', 'UPI', true, null);
    expect(mockInserts[0]).not.toHaveProperty('staff_id');
    expect(saved.staff_id).toBeNull();
  });

  it('sends staff_id when a team member is chosen', async () => {
    const saved = await expenseRepository.addExpense(SHOP, 'Salaries', 5000, 'Advance', 'UPI', true, 'a');
    expect(mockInserts[0]).toMatchObject({ staff_id: 'a' });
    expect(saved.staff_id).toBe('a');
  });

  it('explains a missing database column instead of a raw error', async () => {
    mockInsertError = { message: 'column "staff_id" of relation "expenses" does not exist' };
    await expect(expenseRepository.addExpense(SHOP, 'Salaries', 5000, 'x', 'UPI', true, 'a')).rejects.toThrow(
      /Linking an expense to a stylist needs a database update/
    );
  });

  it('changes the link only when it changed; null clears it', async () => {
    const saved = await expenseRepository.addExpense(SHOP, 'Salaries', 5000, 'x', 'UPI', true, 'a');

    await expenseRepository.updateExpense(SHOP, saved.id, { note: 'renamed' });
    expect(mockUpdates[0]).not.toHaveProperty('staff_id');

    await expenseRepository.updateExpense(SHOP, saved.id, { staffId: 'a' });
    expect(mockUpdates[1]).not.toHaveProperty('staff_id');

    const moved = await expenseRepository.updateExpense(SHOP, saved.id, { staffId: 'b' });
    expect(mockUpdates[2]).toMatchObject({ staff_id: 'b' });
    expect(moved?.staff_id).toBe('b');

    const cleared = await expenseRepository.updateExpense(SHOP, saved.id, { staffId: null });
    expect(mockUpdates[3]).toMatchObject({ staff_id: null });
    expect(cleared?.staff_id).toBeNull();
  });
});

describe('stylist dropdown strings', () => {
  const LANGS: LanguageCode[] = ['en', 'ta', 'ml', 'te', 'hi', 'kn'];
  const keys = ['exStylist', 'exStylistNone', 'exStylistHint', 'exStylistInactive'];
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const lang of LANGS) {
    it(`${lang} has every string with matching {placeholders}`, () => {
      expect(keys.filter((k) => !translations[lang][k])).toEqual([]);
      expect(keys.filter((k) => placeholders(translations[lang][k]) !== placeholders(translations.en[k]))).toEqual([]);
    });
  }
});
