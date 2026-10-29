// Shared ads logic. Pure functions only, so the Worker, the browser and the tests all use the same rules.
import { AD_SLOTS, SLOT_IDS, PAGE_TYPES } from '../config/adSlots.js';

export class AdsError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const KINDS = ['house', 'sponsor'];
export const STATUSES = ['draft', 'active', 'paused', 'ended'];
export const ACCENTS = { cyan: '#4cc9ff', gold: '#f5c451', green: '#47d16c', violet: '#9a8cff', red: '#ff7070' };
export const LOCALES = ['en', 'bn', 'pt-BR', 'id'];
export const DEVICES = ['mobile', 'desktop'];
export const PUSH_TOPICS = ['redeem_codes', 'live_events', 'daily_reset', 'division_rivals', 'giveaways', 'site_updates'];
export const NEEDS = ['', 'giveaway', 'codes'];
export const EVENTS = ['view', 'click', 'dismiss', 'conv', 'nreq', 'nfill', 'nempty'];
export const TOKENS = ['codes.active', 'codes.expiringSoon', 'giveaway.title', 'giveaway.prize', 'giveaway.timeLeft'];
export const IMAGE_HOSTS = ['res.cloudinary.com', 'fcmobiletools.online'];

export const LIMITS = { name: 80, headline: 70, body: 170, cta: 26, badge: 28, sponsor: 60, url: 400 };

const DAY = 86400000;

/* ------------------------------------------------------------------ */
/* Text and URL cleaning                                               */
/* ------------------------------------------------------------------ */

const flat = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Owner rule for all site copy: no em dashes. */
export function copyProblem(text) {
  if (/\u2014/.test(text)) return 'Use a comma, a colon or a full stop instead of an em dash.';
  if (/<[a-z!/][^>]*>/i.test(text)) return 'Plain text only. Remove the HTML tags.';
  return '';
}

function copyField(label, value, max, { required = false } = {}) {
  const text = flat(value, max + 1);
  if (required && !text) throw new AdsError(label + ' is required.');
  if (text.length > max) throw new AdsError(label + ' must be ' + max + ' characters or fewer.');
  const problem = copyProblem(text);
  if (problem) throw new AdsError(label + ': ' + problem);
  for (const token of text.match(/\{[^}]*\}/g) || []) {
    if (!TOKENS.includes(token.slice(1, -1))) throw new AdsError(label + ' has an unknown token ' + token + '. Allowed: ' + TOKENS.map((t) => '{' + t + '}').join(', ') + '.');
  }
  return text;
}

export function cleanUrl(value, label = 'Link') {
  const text = flat(value, LIMITS.url + 1);
  if (!text) return '';
  if (text.length > LIMITS.url) throw new AdsError(label + ' is too long.');
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  let parsed;
  try { parsed = new URL(text); } catch { throw new AdsError(label + ' must start with https:// or be a path on this site such as /redeem-codes.'); }
  if (parsed.protocol !== 'https:') throw new AdsError(label + ' must use https.');
  if (parsed.username || parsed.password) throw new AdsError(label + ' cannot contain a username or password.');
  return parsed.toString();
}

export function cleanImage(value) {
  const text = flat(value, LIMITS.url + 1);
  if (!text) return '';
  if (text.startsWith('/assets/')) {
    if (!/^\/assets\/[a-z0-9/_.-]+$/i.test(text) || text.includes('..') || text.includes('//')) throw new AdsError('That image path is not valid.');
    return text;
  }
  let parsed;
  try { parsed = new URL(text); } catch { throw new AdsError('Image must be an https link from Cloudinary or this site.'); }
  if (parsed.protocol !== 'https:' || !IMAGE_HOSTS.includes(parsed.hostname)) throw new AdsError('Image must be hosted on Cloudinary or fcmobiletools.online.');
  return parsed.toString();
}

const pick = (list, allowed) => [...new Set((Array.isArray(list) ? list : []).filter((item) => allowed.includes(item)))];
const pathList = (list) => [...new Set((Array.isArray(list) ? list : String(list || '').split(/[\n,]+/))
  .map((item) => flat(item, 120)).filter((item) => item.startsWith('/')))].slice(0, 12);
const intOrNull = (value, min, max) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
};
const isoOrNull = (value, label) => {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new AdsError(label + ' is not a valid date.');
  return new Date(ms).toISOString();
};

/* ------------------------------------------------------------------ */
/* Creative validation                                                 */
/* ------------------------------------------------------------------ */

export function validateCreative(input = {}) {
  const kind = KINDS.includes(input.kind) ? input.kind : 'house';
  const status = STATUSES.includes(input.status) ? input.status : 'draft';
  const action = input.action?.type === 'push' ? 'push' : 'link';
  const topic = action === 'push' ? String(input.action?.topic || '') : '';
  if (action === 'push' && !PUSH_TOPICS.includes(topic)) throw new AdsError('Choose which alert topic this button turns on.');
  const url = cleanUrl(input.url);
  if (action === 'link' && !url) throw new AdsError('Add the link this ad opens.');
  const t = input.targeting || {};
  const startsAt = isoOrNull(input.startsAt, 'Start date');
  const endsAt = isoOrNull(input.endsAt, 'End date');
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new AdsError('The end date must be after the start date.');
  if (kind === 'sponsor' && !flat(input.sponsorName, LIMITS.sponsor)) throw new AdsError('Sponsor name is required for sponsor ads.');
  const caps = input.caps || {};
  const out = {
    kind,
    status,
    name: copyField('Internal name', input.name, LIMITS.name, { required: true }),
    headline: copyField('Headline', input.headline, LIMITS.headline, { required: true }),
    body: copyField('Text', input.body, LIMITS.body),
    cta: copyField('Button label', input.cta, LIMITS.cta, { required: true }),
    badge: copyField('Label', input.badge || (kind === 'sponsor' ? 'Sponsored' : 'From FC Mobile Tools'), LIMITS.badge),
    sponsorName: copyField('Sponsor name', input.sponsorName, LIMITS.sponsor),
    url,
    imageUrl: cleanImage(input.imageUrl),
    accent: Object.keys(ACCENTS).includes(input.accent) ? input.accent : 'cyan',
    action: { type: action, topic },
    slots: pick(input.slots, SLOT_IDS),
    targeting: {
      pageTypes: pick(t.pageTypes, PAGE_TYPES),
      locales: pick(t.locales, LOCALES),
      devices: pick(t.devices, DEVICES),
      pathsInclude: pathList(t.pathsInclude),
      pathsExclude: pathList(t.pathsExclude),
      hideIfPush: t.hideIfPush === true,
      hideIfSignedIn: t.hideIfSignedIn === true,
      needs: NEEDS.includes(t.needs) ? t.needs : ''
    },
    weight: intOrNull(input.weight, 1, 1000) ?? 100,
    caps: {
      perUserDay: intOrNull(caps.perUserDay, 1, 20) ?? 3,
      dailyImpressions: intOrNull(caps.dailyImpressions, 1, 10000000),
      totalImpressions: intOrNull(caps.totalImpressions, 1, 1000000000)
    },
    startsAt,
    endsAt,
    note: flat(input.note, 300)
  };
  const noteProblem = copyProblem(out.note);
  if (noteProblem) throw new AdsError('Note: ' + noteProblem);
  return out;
}

/* ------------------------------------------------------------------ */
/* Live tokens                                                         */
/* ------------------------------------------------------------------ */

export function timeLeftText(endsAt, now = Date.now()) {
  const ms = Date.parse(endsAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'less than an hour left';
  if (hours < 48) return hours + (hours === 1 ? ' hour left' : ' hours left');
  return Math.floor(hours / 24) + ' days left';
}

/** Returns the text with live values filled in, or null when a value is not available right now. */
export function fillTokens(text, live = {}) {
  let missing = false;
  const out = String(text || '').replace(/\{([^}]+)\}/g, (_, key) => {
    const value = key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), live);
    if (value === undefined || value === null || value === '') { missing = true; return ''; }
    return String(value);
  });
  return missing ? null : out;
}

/* ------------------------------------------------------------------ */
/* Engine settings                                                     */
/* ------------------------------------------------------------------ */

export function defaultSettings() {
  return {
    enabled: true,
    houseAds: true,
    sponsorAds: true,
    policyVersion: 2,
    maxPerPage: 3,
    maxPerLongArticle: 4,
    minParagraphsForMid: 6,
    dismissDays: 7,
    clickQuietDays: 14,
    exploreRate: 0.1,
    adFreeForPremium: true,
    graceViews: 1,
    minWords: 300,
    slots: Object.fromEntries(SLOT_IDS.map((id) => [id, { enabled: true, unitId: '' }])),
    adsense: { enabled: false, publisherId: 'ca-pub-2527295119501596', share: 100 }
  };
}

export function normalizeSettings(input = {}) {
  const base = defaultSettings();
  const num = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  const needsDensityMigration = Number(input.policyVersion || 0) < 2;
  const out = {
    enabled: needsDensityMigration ? true : input.enabled !== false,
    houseAds: input.houseAds !== false,
    sponsorAds: input.sponsorAds !== false,
    policyVersion: 2,
    maxPerPage: Math.max(needsDensityMigration ? 3 : 0, Math.round(num(input.maxPerPage, 0, 4, base.maxPerPage))),
    maxPerLongArticle: Math.max(needsDensityMigration ? 4 : 0, Math.round(num(input.maxPerLongArticle, 0, 5, base.maxPerLongArticle))),
    minParagraphsForMid: Math.round(num(input.minParagraphsForMid, 4, 30, base.minParagraphsForMid)),
    dismissDays: Math.round(num(input.dismissDays, 1, 90, base.dismissDays)),
    clickQuietDays: Math.round(num(input.clickQuietDays, 1, 90, base.clickQuietDays)),
    exploreRate: num(input.exploreRate, 0, 0.5, base.exploreRate),
    adFreeForPremium: input.adFreeForPremium !== false,
    graceViews: Math.round(num(input.graceViews, 0, 5, base.graceViews)),
    minWords: Math.round(num(input.minWords, 0, 3000, base.minWords)),
    slots: {},
    adsense: { enabled: false, publisherId: base.adsense.publisherId, share: 100 }
  };
  for (const id of SLOT_IDS) {
    const row = input.slots?.[id] || {};
    const unitId = flat(row.unitId, 20);
    if (unitId && !/^\d{6,15}$/.test(unitId)) throw new AdsError('The AdSense ad unit ID for ' + id + ' should be digits only.');
    out.slots[id] = { enabled: row.enabled !== false, unitId };
  }
  const a = input.adsense || {};
  const publisherId = flat(a.publisherId || base.adsense.publisherId, 40);
  if (!/^ca-pub-\d{10,20}$/.test(publisherId)) throw new AdsError('The AdSense publisher ID looks like ca-pub-1234567890123456.');
  out.adsense = { enabled: a.enabled === true, publisherId, share: Math.round(num(a.share, 0, 100, 100)) };
  return out;
}

/* ------------------------------------------------------------------ */
/* Eligibility                                                         */
/* ------------------------------------------------------------------ */

export function inSchedule(creative, now = Date.now()) {
  if (creative.startsAt && Date.parse(creative.startsAt) > now) return false;
  if (creative.endsAt && Date.parse(creative.endsAt) <= now) return false;
  return true;
}

const pathMatches = (path, prefixes) => prefixes.some((prefix) => path === prefix || path.startsWith(prefix.replace(/\/+$/, '') + '/'));

/**
 * Returns the list of reasons this creative cannot show right now. Empty list means it can.
 * ctx:   { slot, pageType, path, locale, device, signedIn, pushOn, topics, now, shownIds }
 * state: { views: {id: n today}, clickedAt: {id: ms}, dismissedAt: {id: ms} }
 * Creatives from the public config carry short keys (see publicCreative); admin previews pass full ones.
 */
export function blockers(c, ctx, state = {}, settings = defaultSettings()) {
  const why = [];
  const now = ctx.now ?? Date.now();
  if (c.status && c.status !== 'active') why.push('Status is ' + c.status);
  if (!inSchedule(c, now)) why.push('Outside its start and end dates');
  if (c.kind === 'house' && !settings.houseAds) why.push('House ads are switched off');
  if (c.kind === 'sponsor' && !settings.sponsorAds) why.push('Sponsor ads are switched off');
  if (c.slots?.length && !c.slots.includes(ctx.slot)) why.push('Not assigned to the ' + ctx.slot + ' slot');
  const t = c.targeting || {};
  if (t.pageTypes?.length && !t.pageTypes.includes(ctx.pageType)) why.push('Not targeted at ' + ctx.pageType + ' pages');
  if (t.locales?.length && !t.locales.includes(ctx.locale)) why.push('Not targeted at the ' + ctx.locale + ' language');
  if (t.devices?.length && !t.devices.includes(ctx.device)) why.push('Not targeted at ' + ctx.device);
  if (t.pathsInclude?.length && !pathMatches(ctx.path, t.pathsInclude)) why.push('This page is not in its page list');
  if (t.pathsExclude?.length && pathMatches(ctx.path, t.pathsExclude)) why.push('This page is excluded');
  if (t.hideIfSignedIn && ctx.signedIn) why.push('Hidden for signed in visitors');
  if (t.hideIfPush) {
    const topic = c.action?.type === 'push' ? c.action.topic : '';
    if (topic ? (ctx.pushOn && ctx.topics?.[topic]) : ctx.pushOn) why.push('Visitor already has alerts on');
  }
  if (c.action?.type === 'push' && ctx.pushOn && ctx.topics?.[c.action.topic]) why.push('Visitor already has this alert on');
  if (c.remaining !== undefined && c.remaining !== null && c.remaining <= 0) why.push('Daily or total impression cap reached');
  const id = c.id;
  const seen = state.views?.[id] || 0;
  if (seen >= (c.caps?.perUserDay ?? 3)) why.push('This visitor has seen it enough today');
  const quietClick = (settings.clickQuietDays || 14) * DAY;
  if (state.clickedAt?.[id] && now - state.clickedAt[id] < quietClick) why.push('Visitor clicked it recently');
  const quietDismiss = (settings.dismissDays || 7) * DAY;
  if (state.dismissedAt?.[id] && now - state.dismissedAt[id] < quietDismiss) why.push('Visitor hid it recently');
  if (ctx.shownIds?.includes(id)) why.push('Already shown on this page');
  return why;
}

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

function specificity(c, ctx) {
  const t = c.targeting || {};
  let score = 1;
  if (t.pathsInclude?.length) score += 0.6;
  if (t.pageTypes?.length) score += 0.2;
  if (c.slots?.length && c.slots.includes(ctx.slot)) score += 0.2;
  return score;
}

/**
 * Chooses one creative for a slot. Sponsors always outrank house ads.
 * Inside a tier the pick is weighted random. Learned CTR multipliers apply except on exploration picks,
 * so new and unproven ads keep getting a fair look.
 */
export function chooseCreative(creatives, ctx, state, settings, rand = Math.random) {
  const eligible = creatives.filter((c) => blockers(c, ctx, state, settings).length === 0);
  if (!eligible.length) return null;
  const sponsors = eligible.filter((c) => c.kind === 'sponsor');
  const pool = sponsors.length ? sponsors : eligible;
  const explore = rand() < (settings.exploreRate ?? 0.1);
  const weights = pool.map((c) => Math.max(0.0001, (c.weight ?? 100) * (explore ? 1 : (c.learned ?? 1)) * specificity(c, ctx)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** How many ads this page may carry, given the page type and its length. */
export function pageBudget(settings, { pageType, paragraphs = 0, words = 0 }) {
  if (!settings.enabled) return 0;
  if (pageType === 'article' && (words >= 1500 || paragraphs >= 18)) return settings.maxPerLongArticle;
  return settings.maxPerPage;
}

/** Whether the network (AdSense) may serve on this page and slot right now. */
export function networkAllowed(settings, { slot, consent, words, viewsThisSession, adFree }) {
  if (!settings.enabled || !settings.adsense?.enabled || adFree) return false;
  if (!consent) return false;
  if (!settings.slots?.[slot]?.unitId) return false;
  if (words < settings.minWords) return false;
  if (viewsThisSession <= settings.graceViews) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Learning                                                            */
/* ------------------------------------------------------------------ */

/**
 * Turns click data into a weight multiplier between 0.5 and 2. The prior pulls small samples toward the
 * average click rate so a lucky first day cannot crown a winner. Under 200 views the multiplier stays at 1.
 */
export function learnedMultiplier({ views = 0, clicks = 0 }, baselineCtr = 0.02) {
  if (views < 200) return 1;
  const base = Math.max(0.001, Math.min(0.5, baselineCtr));
  const strength = 150;
  const posterior = (clicks + base * strength) / (views + strength);
  return Math.round(Math.max(0.5, Math.min(2, posterior / base)) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Public config (what the browser downloads)                          */
/* ------------------------------------------------------------------ */

/** Smallest useful shape. Text is already filled with live values; creatives that cannot fill are dropped. */
export function publicCreative(row, live, now = Date.now()) {
  if (row.status !== 'active' || !inSchedule(row, now)) return null;
  const headline = fillTokens(row.headline, live);
  const body = fillTokens(row.body, live);
  const cta = fillTokens(row.cta, live);
  if (headline === null || body === null || cta === null) return null;
  const needs = row.targeting?.needs;
  if (needs === 'giveaway' && !live?.giveaway) return null;
  if (needs === 'codes' && !(live?.codes?.active > 0)) return null;
  let remaining = null;
  if (row.caps?.dailyImpressions) remaining = row.caps.dailyImpressions - (row.todayViews || 0);
  if (row.caps?.totalImpressions) {
    const left = row.caps.totalImpressions - (row.totalViews || 0);
    remaining = remaining === null ? left : Math.min(remaining, left);
  }
  return {
    id: row.id,
    kind: row.kind,
    status: 'active',
    headline,
    body,
    cta,
    badge: row.badge,
    sponsor: row.kind === 'sponsor' ? row.sponsorName : '',
    url: row.url,
    img: row.imageUrl,
    accent: row.accent,
    action: row.action,
    slots: row.slots,
    targeting: row.targeting,
    caps: row.caps,
    weight: row.weight,
    learned: row.learned ?? 1,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    remaining
  };
}

export function publicSettings(settings) {
  return {
    enabled: settings.enabled,
    houseAds: settings.houseAds,
    sponsorAds: settings.sponsorAds,
    maxPerPage: settings.maxPerPage,
    maxPerLongArticle: settings.maxPerLongArticle,
    minParagraphsForMid: settings.minParagraphsForMid,
    dismissDays: settings.dismissDays,
    clickQuietDays: settings.clickQuietDays,
    exploreRate: settings.exploreRate,
    adFreeForPremium: settings.adFreeForPremium,
    graceViews: settings.graceViews,
    minWords: settings.minWords,
    slots: settings.slots,
    adsense: { enabled: settings.adsense.enabled, publisherId: settings.adsense.publisherId, share: settings.adsense.share }
  };
}

export { AD_SLOTS, SLOT_IDS, PAGE_TYPES };
