// Where ads are allowed to appear on fcmobiletools.online.
//
// Rules of the house:
//   1. Pages are blocked by default. A page only gets ads when it matches a rule below.
//   2. Nothing is ever placed above the fold, over content, or in a popup.
//   3. Pages where people sign in, enter giveaways, claim prizes or submit data never show ads.
//
// The engine reads this file in the browser and in the Worker, so keep it plain data.

export const AD_SLOTS = [
  { id: 'home-mid', label: 'Home page, between sections', pageTypes: ['home'], devices: ['mobile', 'desktop'], adsense: 'fluid', note: 'Placed after roughly the middle of the home page.' },
  { id: 'list-mid', label: 'Lists, inside the feed', pageTypes: ['list'], devices: ['mobile', 'desktop'], adsense: 'fluid', note: 'Blog index, redeem codes and events pages. Placed after the fourth item or at mid page.' },
  { id: 'article-early', label: 'Article, early read', pageTypes: ['article'], devices: ['mobile', 'desktop'], adsense: 'fluid', note: 'An additional in-read card on long articles with enough paragraphs.' },
  { id: 'article-mid', label: 'Article, mid read', pageTypes: ['article'], devices: ['mobile', 'desktop'], adsense: 'fluid', note: 'Placed between paragraphs, only in articles with at least six paragraphs.' },
  { id: 'article-end', label: 'Article, after the last paragraph', pageTypes: ['article'], devices: ['mobile', 'desktop'], adsense: 'auto', note: 'Placed right after the article body.' },
  { id: 'page-mid', label: 'Pages, between sections', pageTypes: ['page'], devices: ['mobile', 'desktop'], adsense: 'fluid', note: 'Placed around the middle of a long public information page.' },
  { id: 'tool-sidebar', label: 'Tools, desktop side rail', pageTypes: ['tool'], devices: ['desktop'], adsense: 'auto', note: 'A compact promotion in the desktop side rail. Hidden on narrow screens.' },
  { id: 'tool-result', label: 'Tools, under the results', pageTypes: ['tool'], devices: ['mobile', 'desktop'], adsense: 'fluid', note: 'Placed under tool results when available, otherwise after the main tool.' },
  { id: 'page-end', label: 'Page end, above the footer', pageTypes: ['home', 'list', 'article', 'tool', 'page'], devices: ['mobile', 'desktop'], adsense: 'auto', note: 'Placed at the very end of the content, above the footer.' }
];

export const SLOT_IDS = AD_SLOTS.map((slot) => slot.id);
export const PAGE_TYPES = ['home', 'list', 'article', 'tool', 'page'];

// Paths that never show ads, whatever else matches. Prefix match on the English path.
export const NEVER_PREFIXES = [
  '/admin', '/api', '/account', '/profile', '/settings', '/creator', '/giveaways', '/rewards',
  '/missions', '/achievements', '/leaderboard', '/surveys', '/legal', '/notifications',
  '/advertise', '/trivia', '/fc-mobile-27', '/host-a-tournament', '/match-center',
  '/football-centre/rewards', '/football-centre/settings', '/football-centre/history'
];

const TOOL_PATHS = [
  '/training-calculator', '/rank-up-calculator', '/team-ovr', '/investment-calculator',
  '/shards-counter', '/gauntlet-planner', '/captain-tracker', '/player/playstyle-finder'
];
const LIST_PATHS = ['/redeem-codes', '/events', '/blog', '/leagues'];
const PAGE_PATHS = ['/player/playstyle', '/tournaments', '/tournaments/samples'];

const clean = (path) => {
  const text = String(path || '/').split('?')[0].split('#')[0];
  const trimmed = text.replace(/\/+$/, '');
  return trimmed || '/';
};

/** Returns 'home', 'list', 'article', 'tool', 'page' or 'none' for an English path. */
export function pageTypeFor(path) {
  const p = clean(path);
  if (NEVER_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'))) return 'none';
  if (p === '/') return 'home';
  if (TOOL_PATHS.includes(p)) return 'tool';
  if (p.startsWith('/blog/')) {
    if (/^\/blog\/(category|author|series)(\/|$)/.test(p)) return 'list';
    return 'article';
  }
  if (LIST_PATHS.includes(p)) return 'list';
  if (PAGE_PATHS.includes(p) || p === '/football-centre' || p.startsWith('/football-centre/')) return 'page';
  return 'none';
}

export function slotsForPageType(pageType) {
  return AD_SLOTS.filter((slot) => slot.pageTypes.includes(pageType));
}
