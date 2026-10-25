// Locale definitions. English is the default and lives at the existing, unprefixed URLs.
// Every other locale lives under its own URL prefix (/bn/, /pt-br/, /id/).
export const DEFAULT_LOCALE = 'en';

export const LOCALES = {
  en: { code: 'en', htmlLang: 'en', hreflang: 'en', prefix: '', native: 'English', english: 'English', badge: 'EN', short: 'EN', ogLocale: 'en_US', script: 'latin' },
  bn: { code: 'bn', htmlLang: 'bn', hreflang: 'bn', prefix: 'bn', native: 'বাংলা', english: 'Bengali', badge: 'বা', short: 'বাং', ogLocale: 'bn_BD', script: 'bengali' },
  'pt-BR': { code: 'pt-BR', htmlLang: 'pt-BR', hreflang: 'pt-BR', prefix: 'pt-br', native: 'Português (Brasil)', english: 'Portuguese (Brazil)', badge: 'PT', short: 'PT', ogLocale: 'pt_BR', script: 'latin' },
  id: { code: 'id', htmlLang: 'id', hreflang: 'id', prefix: 'id', native: 'Bahasa Indonesia', english: 'Indonesian', badge: 'ID', short: 'ID', ogLocale: 'id_ID', script: 'latin' }
};

export const LOCALE_CODES = Object.keys(LOCALES);
export const NON_DEFAULT_LOCALES = LOCALE_CODES.filter((code) => code !== DEFAULT_LOCALE);

// URL prefix -> locale code (lowercase prefix, so /pt-br/ maps to pt-BR).
export const PREFIX_TO_LOCALE = Object.fromEntries(
  NON_DEFAULT_LOCALES.map((code) => [LOCALES[code].prefix, code])
);

export const LANGUAGE_STORAGE_KEY = 'fcmt:lang:v1';

export function isLocale(code) {
  return Object.prototype.hasOwnProperty.call(LOCALES, code);
}
