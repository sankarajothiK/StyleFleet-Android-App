import { translations, LanguageCode } from '../src/i18n/translations';
import { PERMISSION_GROUPS, PERMISSION_KEYS } from '../src/utils/stylistAccess';

const LANGS: LanguageCode[] = ['en', 'ta', 'ml', 'te', 'hi', 'kn'];
const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');

const cap = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
const keys = [
  ...Object.keys(translations.en).filter((k) => /^sp[A-Z]/.test(k)),
];

describe('stylist permissions sheet strings', () => {
  it('has a label and a description for every permission, and the group titles', () => {
    for (const k of PERMISSION_KEYS) {
      expect(translations.en[`sp${cap(k)}`]).toBeTruthy();
      expect(translations.en[`sp${cap(k)}Sub`]).toBeTruthy();
    }
    for (const g of PERMISSION_GROUPS) expect(translations.en[g.titleKey]).toBeTruthy();
  });

  for (const lang of LANGS) {
    it(`${lang} has every key with matching {placeholders}`, () => {
      expect(keys.length).toBeGreaterThan(30);
      expect(keys.filter((k) => !translations[lang][k])).toEqual([]);
      expect(keys.filter((k) => placeholders(translations[lang][k]) !== placeholders(translations.en[k]))).toEqual([]);
    });
  }
});
