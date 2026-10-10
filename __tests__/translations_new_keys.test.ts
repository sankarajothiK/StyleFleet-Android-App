import { translations, LanguageCode } from '../src/i18n/translations';
import { fmt, localeFor } from '../src/i18n/format';

const LANGS: LanguageCode[] = ['en', 'ta', 'ml', 'te', 'hi', 'kn'];
// keys added for the booking, customers, sales, appointments and reminders screens
const NEW = /^(bk[A-Z]|cu[A-Z]|sl[A-Z]|ap[A-Z]|rm[A-Z]|status[A-Z]|unit[A-Z]|delete$|restore$|history$|date$|yesterday$|serviceTapHint$|noClientHint$)/;
const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');

describe('new UI strings exist in every language with the same placeholders', () => {
  const keys = Object.keys(translations.en).filter((k) => NEW.test(k));

  it('found the new keys', () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  for (const lang of LANGS) {
    it(`${lang} has every new key and matching {placeholders}`, () => {
      const missing = keys.filter((k) => !translations[lang][k]);
      expect(missing).toEqual([]);
      const mismatched = keys.filter((k) => placeholders(translations[lang][k]) !== placeholders(translations.en[k]));
      expect(mismatched).toEqual([]);
    });
  }
});

it('fmt fills placeholders and localeFor maps every language', () => {
  expect(fmt('{n} open', { n: 3 })).toBe('3 open');
  expect(fmt(translations.ta.cuVisits, { n: 4 })).toContain('4');
  expect(LANGS.map(localeFor)).toEqual(['en-US', 'ta-IN', 'ml-IN', 'te-IN', 'hi-IN', 'kn-IN']);
});
