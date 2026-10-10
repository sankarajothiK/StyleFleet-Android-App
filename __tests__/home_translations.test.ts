import { translations } from '../src/i18n/translations';

const HOME_KEYS = [
  'newBooking',
  'bookAgain',
  'sameAsLast',
  'yesBook',
  'changeBooking',
  'moreCustomers',
  'tomorrow',
  'booking',
  'bookedTitle',
  'noBookAgainYet',
  'freeSalesLeft',
  'freeLimitReached',
  'upgrade',
];

describe('Home screen wording in English, Hindi and Tamil', () => {
  for (const lang of ['en', 'hi', 'ta'] as const) {
    it(`has every Home key in ${lang}`, () => {
      const dict = translations[lang] as Record<string, string>;
      for (const key of HOME_KEYS) {
        expect(typeof dict[key]).toBe('string');
        expect(dict[key].trim().length).toBeGreaterThan(0);
      }
    });
  }

  it('uses a different script for Hindi and Tamil than English', () => {
    const en = translations.en as Record<string, string>;
    const hi = translations.hi as Record<string, string>;
    const ta = translations.ta as Record<string, string>;
    expect(hi.newBooking).not.toBe(en.newBooking);
    expect(ta.newBooking).not.toBe(en.newBooking);
    expect(/[ऀ-ॿ]/.test(hi.newBooking)).toBe(true); // Devanagari
    expect(/[஀-௿]/.test(ta.newBooking)).toBe(true); // Tamil
  });
});
