// Route registry: the single source of truth for which pages exist in which language.
//
// A localized URL is generated, linked from the language switcher, listed in the sitemap and
// advertised through hreflang ONLY when its English path appears here for that locale. A page
// is added to a locale's list once its interface is fully translated, so half-translated pages
// can never become indexable.
import { DEFAULT_LOCALE, LOCALES, NON_DEFAULT_LOCALES, PREFIX_TO_LOCALE } from './locales.js';

// English path (trailing slash) -> locales that have a complete translation.
export const LOCALIZED_PAGES = {
  // Filled in page by page as translations are completed, for example:
  '/redeem-codes/': ['bn', 'pt-BR', 'id'],
  '/investment-calculator/': ['bn', 'pt-BR', 'id'],
  '/shards-counter/': ['bn', 'pt-BR', 'id']
};

// Paths that must never be localized (admin, API, assets, blog and guide content, legacy apps).
const NEVER_LOCALIZE = [
  /^\/admin(\/|$)/,
  /^\/api(\/|$)/,
  /^\/assets(\/|$)/,
  /^\/_astro(\/|$)/,
  /^\/_legacy(\/|$)/,
  /^\/blog(\/|$)/,
  /^\/creator(\/|$)/,
  /^\/trivia(\/|$)/,
  /^\/a-nations-story(\/|$)/
];

export function withTrailingSlash(pathname) {
  if (!pathname) return '/';
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return clean.endsWith('/') ? clean : `${clean}/`;
}

/** Split "/bn/redeem-codes/" into { locale: 'bn', path: '/redeem-codes/' }. English stays as is. */
export function splitLocalePath(pathname) {
  const path = withTrailingSlash(pathname || '/');
  const first = path.split('/')[1]?.toLowerCase();
  const locale = first && PREFIX_TO_LOCALE[first];
  if (!locale) return { locale: DEFAULT_LOCALE, path };
  const rest = path.slice(first.length + 1);
  return { locale, path: withTrailingSlash(rest || '/') };
}

export function getLocaleFromPath(pathname) {
  return splitLocalePath(pathname).locale;
}

export function stripLocale(pathname) {
  return splitLocalePath(pathname).path;
}

export function hasLocalizedPage(englishPath, locale) {
  if (locale === DEFAULT_LOCALE) return true;
  return Boolean(LOCALIZED_PAGES[withTrailingSlash(englishPath)]?.includes(locale));
}

/** URL path for a page in a locale, without checking that the translation exists. */
export function pathForLocale(englishPath, locale) {
  const path = withTrailingSlash(englishPath);
  if (locale === DEFAULT_LOCALE) return path;
  const prefix = LOCALES[locale].prefix;
  return path === '/' ? `/${prefix}/` : `/${prefix}${path}`;
}

/**
 * Locale-aware internal link. Keeps the visitor in their language when a translated page
 * exists and otherwise returns the unchanged English URL, so links never 404.
 * Query strings and hashes are preserved. External, hash-only and non-page links pass through.
 */
export function localizeHref(href, locale) {
  if (!href || locale === DEFAULT_LOCALE) return href;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href) || !href.startsWith('/')) return href;
  const match = href.match(/^([^?#]*)(.*)$/);
  const rawPath = match[1];
  const suffix = match[2] || '';
  if (NEVER_LOCALIZE.some((re) => re.test(rawPath))) return href;
  const englishPath = withTrailingSlash(rawPath);
  if (!hasLocalizedPage(englishPath, locale)) return href;
  return pathForLocale(englishPath, locale) + suffix;
}

/** Locales (including English) that have a real page for this English path. */
export function availableLocales(englishPath) {
  const path = withTrailingSlash(englishPath);
  if (NEVER_LOCALIZE.some((re) => re.test(path))) return [DEFAULT_LOCALE];
  return [DEFAULT_LOCALE, ...NON_DEFAULT_LOCALES.filter((code) => hasLocalizedPage(path, code))];
}

/** hreflang alternates for a page, or an empty list when only English exists. */
export function alternatesFor(englishPath, origin) {
  const path = withTrailingSlash(englishPath);
  const locales = availableLocales(path);
  if (locales.length < 2) return [];
  const entries = locales.map((code) => ({
    hreflang: LOCALES[code].hreflang,
    href: new URL(pathForLocale(path, code), origin).toString()
  }));
  entries.push({ hreflang: 'x-default', href: new URL(pathForLocale(path, DEFAULT_LOCALE), origin).toString() });
  return entries;
}

/** Static paths for a page's localized wrapper route: src/pages/[locale]/<page>.astro */
export function localizedStaticPaths(englishPath) {
  const path = withTrailingSlash(englishPath);
  return NON_DEFAULT_LOCALES.filter((code) => hasLocalizedPage(path, code)).map((code) => ({
    params: { locale: LOCALES[code].prefix }
  }));
}

/** Every localized URL that should appear in the sitemap. */
export function localizedSitemapPaths() {
  return Object.entries(LOCALIZED_PAGES).flatMap(([path, locales]) =>
    locales.map((code) => pathForLocale(path, code))
  );
}

/** English paths that have a complete page in this locale (for client-side link localization). */
export function localizedPagesFor(locale) {
  if (locale === DEFAULT_LOCALE) return [];
  return Object.keys(LOCALIZED_PAGES).filter((path) => hasLocalizedPage(path, locale));
}


// Dictionary namespaces a page needs. Before a page is added to LOCALIZED_PAGES for a locale,
// every key in these namespaces must be translated there (scripts/test-i18n.mjs enforces it).
export const PAGE_NAMESPACES = {
  '/redeem-codes/': ['redeem'],
  '/investment-calculator/': ['investment'],
  '/shards-counter/': ['shards']
};

// Namespaces every localized page shares (navbar, footer, switcher).
export const SHARED_NAMESPACES = ['common', 'nav', 'footer', 'switcher', 'consent'];

/** False for admin, API, blog, guides and other areas that are intentionally English only. */
export function isLocalizablePath(englishPath) {
  const path = withTrailingSlash(englishPath);
  return !NEVER_LOCALIZE.some((re) => re.test(path));
}
