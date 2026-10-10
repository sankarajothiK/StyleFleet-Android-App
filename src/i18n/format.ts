import { LanguageCode } from './translations';

/** Fill {placeholders} in a translated string: fmt(t('rmOpen'), { n: 3 }) */
export const fmt = (text: string, vars: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));

const LOCALES: Record<LanguageCode, string> = {
  en: 'en-US',
  ta: 'ta-IN',
  ml: 'ml-IN',
  te: 'te-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
};

/** BCP-47 locale for dates (weekday / month names) in the selected app language */
export const localeFor = (language: LanguageCode): string => LOCALES[language] || 'en-US';
