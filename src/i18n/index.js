// Lightweight static translation helpers. No runtime APIs, no dependencies.
//
// Dictionaries are plain nested objects under src/i18n/messages/. English is the source of
// truth. Any key that is missing or empty in another language falls back to English, so the
// interface can never show a raw key or a blank label.
import en from './messages/en.js';
import bn from './messages/bn.js';
import ptBR from './messages/pt-br.js';
import id from './messages/id.js';
import { DEFAULT_LOCALE, LOCALES, isLocale } from './locales.js';

export * from './locales.js';
export * from './routes.js';

const DICTIONARIES = { en, bn, 'pt-BR': ptBR, id };

function lookup(source, path) {
  let node = source;
  for (const part of path.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] == null ? match : String(vars[name])));
}

export function normalizeLocale(locale) {
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** Translate a dotted key, for example t('pt-BR', 'nav.items.events.label'). */
export function t(locale, key, vars) {
  const code = normalizeLocale(locale);
  const own = lookup(DICTIONARIES[code], key);
  const value = typeof own === 'string' && own.trim() !== '' ? own : lookup(DICTIONARIES[DEFAULT_LOCALE], key);
  if (typeof value !== 'string') return '';
  return interpolate(value, vars);
}

/** Bind a locale once: const tr = translator(locale); tr('common.login'). */
export function translator(locale) {
  const code = normalizeLocale(locale);
  const tr = (key, vars) => t(code, key, vars);
  tr.locale = code;
  return tr;
}

function mergeWithFallback(base, own) {
  if (typeof base === 'string') return typeof own === 'string' && own.trim() !== '' ? own : base;
  if (Array.isArray(base)) return Array.isArray(own) && own.length === base.length ? own.map((item, i) => mergeWithFallback(base[i], item)) : base;
  if (base && typeof base === 'object') {
    const out = {};
    for (const key of Object.keys(base)) out[key] = mergeWithFallback(base[key], own?.[key]);
    return out;
  }
  return base;
}

/**
 * A whole namespace as a plain object with English fallback applied, for handing to client
 * scripts: <script type="application/json" set:html={JSON.stringify(namespace(locale, 'redeem'))}>.
 */
export function namespace(locale, name) {
  const base = DICTIONARIES[DEFAULT_LOCALE][name];
  const own = DICTIONARIES[normalizeLocale(locale)][name];
  return mergeWithFallback(base, own);
}

export function localeInfo(locale) {
  return LOCALES[normalizeLocale(locale)];
}

/** Flatten a dictionary to dotted keys. Used by the translation coverage test. */
export function flattenKeys(object, prefix = '') {
  return Object.entries(object || {}).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') return flattenKeys(value, path);
    return [[path, value]];
  });
}

export const dictionaries = DICTIONARIES;
