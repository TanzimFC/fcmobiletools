import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  dictionaries, flattenKeys, t, namespace, LOCALES, NON_DEFAULT_LOCALES, DEFAULT_LOCALE,
  LOCALIZED_PAGES, PAGE_NAMESPACES, SHARED_NAMESPACES, localizeHref, splitLocalePath, pathForLocale,
  alternatesFor, availableLocales, hasLocalizedPage, fallbackPageFor, localizedSitemapPaths
} from '../src/i18n/index.js';

const root = process.cwd();
const failures = [];
const fail = (message) => failures.push(message);
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const en = flattenKeys(dictionaries.en);
const enMap = new Map(en);

// 1. English is complete and clean, other languages have no stray keys and matching placeholders.
for (const [key, value] of en) {
  if (typeof value !== 'string' || value.trim() === '') fail(`en.${key} must be a non-empty string`);
}
for (const code of NON_DEFAULT_LOCALES) {
  for (const [key, value] of flattenKeys(dictionaries[code])) {
    if (!enMap.has(key)) { fail(`${code}.${key} has no English source key`); continue; }
    if (typeof value === 'string' && value.trim() !== '' && placeholders(value) !== placeholders(enMap.get(key))) {
      fail(`${code}.${key} placeholders differ from English ({${placeholders(value)}} vs {${placeholders(enMap.get(key))}})`);
    }
  }
}

// 2. Copy rules for the site: no em dashes in any translation. English is kept verbatim from the
// original pages, so it is exempt to avoid changing existing English copy.
for (const code of NON_DEFAULT_LOCALES) {
  for (const [key, value] of flattenKeys(dictionaries[code])) {
    if (typeof value === 'string' && value.includes('\u2014')) fail(`${code}.${key} contains an em dash`);
  }
}

// 3. Shared interface (navbar, footer, switcher) is fully translated for every language we ship.
const ownKeys = (code) => new Map(flattenKeys(dictionaries[code]));
function requireNamespaces(code, namespaces, reason) {
  const own = ownKeys(code);
  for (const [key] of en) {
    if (!namespaces.includes(key.split('.')[0])) continue;
    const value = own.get(key);
    if (typeof value !== 'string' || value.trim() === '') fail(`${code}.${key} is not translated (${reason})`);
  }
}
for (const code of NON_DEFAULT_LOCALES) requireNamespaces(code, SHARED_NAMESPACES, 'shared interface');

// 4. Every registered localized page is fully translated and has a route file.
const pagesDir = path.join(root, 'src/pages/[locale]');
const registeredFiles = new Set();
for (const [englishPath, locales] of Object.entries(LOCALIZED_PAGES)) {
  assert.ok(englishPath.startsWith('/') && englishPath.endsWith('/'), `registry path ${englishPath} needs leading and trailing slash`);
  for (const code of locales) {
    if (!LOCALES[code] || code === DEFAULT_LOCALE) fail(`registry lists unknown locale ${code} for ${englishPath}`);
    requireNamespaces(code, PAGE_NAMESPACES[englishPath] || [], `page ${englishPath}`);
  }
  const name = englishPath === '/' ? 'index' : englishPath.slice(1, -1);
  const candidates = [path.join(pagesDir, `${name}.astro`), path.join(pagesDir, name, 'index.astro')];
  const found = candidates.find((file) => fs.existsSync(file));
  if (!found) fail(`registered page ${englishPath} has no route file in src/pages/[locale]/`);
  else registeredFiles.add(found);
}
if (fs.existsSync(pagesDir)) {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const file of walk(pagesDir)) if (!registeredFiles.has(file)) fail(`${path.relative(root, file)} is not registered in LOCALIZED_PAGES (unregistered pages must not be built)`);
}

// 5. Fallback behavior never exposes a key or a blank label.
assert.equal(t('bn', 'definitely.missing.key'), '', 'missing keys return an empty string for callers to guard');
assert.equal(t('xx', 'common.home'), 'Home', 'unknown locale falls back to English');
assert.equal(t('pt-BR', 'common.levelShort', { n: 7 }), 'Nv. 7');
const merged = namespace('id', 'common');
for (const [key, value] of flattenKeys(merged)) if (typeof value !== 'string' || !value.trim()) fail(`namespace(common).${key} is blank after fallback`);

// 6. URL helpers.
assert.deepEqual(splitLocalePath('/pt-br/redeem-codes'), { locale: 'pt-BR', path: '/redeem-codes/' });
assert.deepEqual(splitLocalePath('/redeem-codes'), { locale: 'en', path: '/redeem-codes/' });
assert.deepEqual(splitLocalePath('/id/'), { locale: 'id', path: '/' });
assert.equal(splitLocalePath('/identity/').locale, 'en', 'prefix must match a whole path segment');
assert.equal(pathForLocale('/', 'bn'), '/bn/');
assert.equal(pathForLocale('/events', 'pt-BR'), '/pt-br/events/');
assert.equal(pathForLocale('/events/', 'en'), '/events/');

// 7. Link localization only rewrites pages that are registered, and never admin, API, blog or external links.
const sample = Object.keys(LOCALIZED_PAGES)[0];
for (const code of NON_DEFAULT_LOCALES) {
  for (const never of ['/admin/', '/api/account/me', '/blog', '/blog/some-article/', '/assets/images/logo.png', 'https://example.com/', '#top', '//cdn.example.com/x.js', 'mailto:a@b.c']) {
    assert.equal(localizeHref(never, code), never, `${never} must not be localized`);
  }
  assert.equal(localizeHref('/definitely-not-registered', code), '/definitely-not-registered', 'unregistered pages keep the English URL');
  if (sample && hasLocalizedPage(sample, code)) {
    assert.equal(localizeHref(`${sample.slice(0, -1)}?x=1#y`, code), `${pathForLocale(sample, code)}?x=1#y`, 'query and hash survive');
  }
}
assert.equal(localizeHref('/events', 'en'), '/events', 'English links are untouched');

// 8. hreflang only lists pages that exist and always carries x-default.
for (const [englishPath, locales] of Object.entries(LOCALIZED_PAGES)) {
  const alternates = alternatesFor(englishPath, 'https://fcmobiletools.online');
  const langs = alternates.map((a) => a.hreflang);
  assert.ok(langs.includes('x-default') && langs.includes('en'), `${englishPath} needs en and x-default`);
  assert.equal(alternates.find((a) => a.hreflang === 'x-default').href, new URL(englishPath, 'https://fcmobiletools.online').toString());
  for (const code of NON_DEFAULT_LOCALES) assert.equal(langs.includes(LOCALES[code].hreflang), locales.includes(code), `${englishPath} hreflang for ${code}`);
}
assert.deepEqual(alternatesFor('/blog/anything/', 'https://fcmobiletools.online'), [], 'blog never gets alternates');
assert.deepEqual(availableLocales('/blog/'), ['en']);
for (const code of NON_DEFAULT_LOCALES) {
  const fallback = fallbackPageFor(code);
  if (fallback) assert.ok(hasLocalizedPage(fallback, code), `fallback page for ${code} must exist`);
}
assert.equal(localizedSitemapPaths().length, Object.values(LOCALIZED_PAGES).flat().length);

if (failures.length) {
  console.error(`i18n checks failed (${failures.length}):`);
  for (const message of failures) console.error(` - ${message}`);
  process.exit(1);
}
console.log(`i18n checks passed: ${en.length} English keys, ${NON_DEFAULT_LOCALES.length} locales, ${Object.keys(LOCALIZED_PAGES).length} localized page(s) registered.`);
