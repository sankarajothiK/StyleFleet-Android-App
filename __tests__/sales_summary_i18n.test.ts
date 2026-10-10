import { translations, LanguageCode } from '../src/i18n/translations';

const LANGS: LanguageCode[] = ['en', 'ta', 'ml', 'te', 'hi', 'kn'];
const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
const keys = Object.keys(translations.en).filter((k) => /^sm[A-Z]/.test(k));

describe('sales summary strings', () => {
  it('found the summary keys', () => {
    expect(keys).toEqual(
      expect.arrayContaining(['smTabReport', 'smTabSummary', 'smBills', 'smBill', 'smNoSales', 'smDayTotal', 'smClose'])
    );
  });

  for (const lang of LANGS) {
    it(`${lang} has every key with matching {placeholders}`, () => {
      expect(keys.filter((k) => !translations[lang][k])).toEqual([]);
      expect(keys.filter((k) => placeholders(translations[lang][k]) !== placeholders(translations.en[k]))).toEqual([]);
    });
  }
});
