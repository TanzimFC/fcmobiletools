// Push notification core: pure functions only (no network, no storage), so the Worker, the site
// scripts and the tests all share one definition of topics, templates and timing.

export const SITE_ORIGIN = 'https://fcmobiletools.online';

/**
 * Topics people can choose. `tag` is the OneSignal tag written on the device, kept identical to the
 * original tag names so people who already subscribed keep their choices.
 */
export const TOPICS = Object.freeze({
  redeem_codes: { tag: 'notify_redeem_codes', label: 'Redeem codes', blurb: 'New codes the moment they drop, and codes about to expire.', defaultOn: true, order: 1 },
  live_events: { tag: 'notify_live_events', label: 'Live events', blurb: 'New events, drafts going live and events about to end.', defaultOn: true, order: 2 },
  daily_reset: { tag: 'notify_daily_reset', label: 'Daily reset', blurb: 'A nudge when the daily reset lands so your rewards are not wasted.', defaultOn: false, order: 3 },
  division_rivals: { tag: 'notify_division_rivals', label: 'Division Rivals reset', blurb: 'A warning before the Division Rivals season resets.', defaultOn: false, order: 4 },
  giveaways: { tag: 'notify_giveaways', label: 'Giveaways', blurb: 'Giveaway openings and winner announcements.', defaultOn: true, order: 5 },
  site_updates: { tag: 'notify_site_updates', label: 'New tools and guides', blurb: 'Big new tools and guides worth your time.', defaultOn: false, order: 6 },
});

export const TOPIC_KEYS = Object.freeze(Object.keys(TOPICS));
export const TOPIC_TAGS = Object.freeze(Object.fromEntries(TOPIC_KEYS.map((key) => [key, TOPICS[key].tag])));
export const TAG_TO_TOPIC = Object.freeze(Object.fromEntries(TOPIC_KEYS.map((key) => [TOPICS[key].tag, key])));

/** Audiences the studio can send to: every topic, plus everyone who is subscribed. */
export const AUDIENCES = Object.freeze({
  all: { label: 'Everyone subscribed', tag: null, ownerOnly: true },
  ...Object.fromEntries(TOPIC_KEYS.map((key) => [key, { label: TOPICS[key].label + ' alerts', tag: TOPICS[key].tag, ownerOnly: false }])),
});

export function defaultTopicState() {
  return Object.fromEntries(TOPIC_KEYS.map((key) => [key, TOPICS[key].defaultOn]));
}

/** Accepts `{redeem_codes:true}` style objects or OneSignal tag objects (`notify_x: 'true'`). */
export function normalizeTopicState(input) {
  const out = defaultTopicState();
  if (!input || typeof input !== 'object') return out;
  for (const key of TOPIC_KEYS) {
    const raw = input[key] !== undefined ? input[key] : input[TOPICS[key].tag];
    if (raw === undefined) continue;
    out[key] = raw === true || raw === 'true' || raw === 1 || raw === '1';
  }
  return out;
}

export function topicStateToTags(state) {
  const normalized = normalizeTopicState(state);
  return Object.fromEntries(TOPIC_KEYS.map((key) => [TOPICS[key].tag, normalized[key] ? 'true' : 'false']));
}

export function topicsToBits(state) {
  const normalized = normalizeTopicState(state);
  return TOPIC_KEYS.reduce((bits, key, index) => (normalized[key] ? bits | (1 << index) : bits), 0);
}

export function bitsToTopics(bits) {
  const value = Number(bits) || 0;
  return Object.fromEntries(TOPIC_KEYS.map((key, index) => [key, Boolean(value & (1 << index))]));
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const SUBSCRIPTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isSubscriptionId = (value) => typeof value === 'string' && SUBSCRIPTION_ID.test(value.trim());

export const SOURCES = Object.freeze(['redeem_page', 'redeem_copy', 'bell', 'sheet', 'notifications_page', 'events_page', 'article', 'studio', 'other']);
export const normalizeSource = (value) => (SOURCES.includes(value) ? value : 'other');

export const FUNNEL_EVENTS = Object.freeze(['shown', 'accepted', 'dismissed', 'blocked', 'enabled', 'paused']);
export const normalizeFunnelEvent = (value) => (FUNNEL_EVENTS.includes(value) ? value : '');

export const LOCALE_CODES = Object.freeze(['en', 'bn', 'pt-BR', 'id']);
export const normalizeLocaleCode = (value) => (LOCALE_CODES.includes(value) ? value : 'en');

/** Coarse device label from a User-Agent. Never stores the raw string. */
export function platformFromUserAgent(ua = '') {
  const text = String(ua);
  if (/iPhone|iPad|iPod/i.test(text)) return 'ios';
  if (/Android/i.test(text)) return 'android';
  if (/Windows/i.test(text)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(text)) return 'mac';
  if (/Linux|CrOS/i.test(text)) return 'linux';
  return 'other';
}

/** Only https links on this site, always rewritten to the bare production host. */
export function safeSiteUrl(value, fallback = '/redeem-codes/') {
  const raw = String(value || fallback).trim();
  let target;
  try { target = new URL(raw, SITE_ORIGIN); } catch { throw new Error('Enter a valid link on fcmobiletools.online.'); }
  const host = target.hostname.toLowerCase();
  if (target.protocol !== 'https:' || !['fcmobiletools.online', 'www.fcmobiletools.online'].includes(host)) {
    throw new Error('Links must point to fcmobiletools.online.');
  }
  target.hostname = 'fcmobiletools.online';
  return target.toString();
}

/** Optional notification image: https only, from this site or our image host. */
export function safeImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let target;
  try { target = new URL(raw); } catch { throw new Error('The image link is not valid.'); }
  const host = target.hostname.toLowerCase();
  const allowed = host === 'fcmobiletools.online' || host === 'www.fcmobiletools.online' || host === 'res.cloudinary.com';
  if (target.protocol !== 'https:' || !allowed) throw new Error('Images must be hosted on fcmobiletools.online or our Cloudinary account.');
  return target.toString();
}

export const LIMITS = Object.freeze({ title: [3, 65], message: [8, 178], label: 80 });

export function validateCopy({ title, message }) {
  const t = String(title || '').trim();
  const m = String(message || '').trim();
  if (t.length < LIMITS.title[0] || t.length > LIMITS.title[1]) throw new Error(`Title must be ${LIMITS.title[0]} to ${LIMITS.title[1]} characters.`);
  if (m.length < LIMITS.message[0] || m.length > LIMITS.message[1]) throw new Error(`Message must be ${LIMITS.message[0]} to ${LIMITS.message[1]} characters.`);
  if (/\u2014/.test(t + m)) throw new Error('Remove the em dash. Use a comma, a colon or a full stop instead.');
  return { title: t, message: m };
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

/** Replaces {name} placeholders. Unknown placeholders are left out rather than shown raw. */
export function renderTemplate(text, vars = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined || vars[name] === null ? '' : String(vars[name])))
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?:])/g, '$1')
    .trim();
}

export const plural = (n, one, many) => (Number(n) === 1 ? one : many);

export function clip(text, max) {
  const value = String(text ?? '').trim();
  if (value.length <= max) return value;
  return value.slice(0, Math.max(1, max - 1)).trimEnd() + '\u2026';
}

/** Hand-written starting points shown as cards in the studio. */
export const COMPOSE_TEMPLATES = Object.freeze([
  { id: 'code', label: 'New redeem code', topic: 'redeem_codes', title: '\u26BD New FC Mobile redeem code', message: 'A new FC Mobile code is live. Check its reward, region and expiry, then claim it before it expires.', url: '/redeem-codes/' },
  { id: 'expiring', label: 'Codes expiring', topic: 'redeem_codes', title: '\u23F3 Redeem codes expiring soon', message: 'Some codes end soon. Check which ones are still active and claim them today.', url: '/redeem-codes/' },
  { id: 'event', label: 'Event is live', topic: 'live_events', title: '\uD83D\uDD25 A new FC Mobile event is live', message: 'The event is live. Check its rewards, schedule and token offers before you start.', url: '/events/' },
  { id: 'ending', label: 'Event ending', topic: 'live_events', title: '\u23F0 FC Mobile event ends soon', message: 'Spend your tokens and finish your objectives before the reset.', url: '/events/' },
  { id: 'reset', label: 'Daily reset', topic: 'daily_reset', title: '\uD83D\uDD04 Daily reset is live', message: 'Your daily rewards, objectives and Division Rivals matches are ready. Do not waste them.', url: '/events/' },
  { id: 'giveaway', label: 'Giveaway open', topic: 'giveaways', title: '\uD83C\uDF81 A giveaway is open', message: 'Entries are open. Check the rules and the closing time, then enter.', url: '/giveaways/' },
  { id: 'winner', label: 'Winner announced', topic: 'giveaways', title: '\uD83C\uDFC6 Giveaway winner announced', message: 'The draw is done. See whether your entry won.', url: '/giveaways/' },
  { id: 'guide', label: 'New guide', topic: 'site_updates', title: '\uD83D\uDCD8 New FC Mobile guide', message: 'A new guide is up. Read it before your next session.', url: '/blog/' },
  { id: 'tool', label: 'New tool', topic: 'site_updates', title: '\uD83D\uDEE0\uFE0F New tool on FCMOBILETOOLS', message: 'A new tool just launched. Try it and tell us what you think.', url: '/' },
  { id: 'custom', label: 'Blank message', topic: 'site_updates', title: 'FCMOBILETOOLS update', message: 'Write your message here.', url: '/' },
]);

/* ------------------------------------------------------------------ */
/* Automations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Every automatic alert. The studio stores an enabled flag and the editable copy per key;
 * anything missing falls back to these defaults, so a fresh database already behaves well.
 */
export const AUTOMATIONS = Object.freeze({
  redeem_new: {
    label: 'New redeem code', group: 'Redeem codes', trigger: 'Fires when an active code is added in the redeem admin.',
    topic: 'redeem_codes', url: '/redeem-codes/', enabled: true,
    title: '\u26BD New FC Mobile redeem code', message: 'A new code is live for {reward}. Claim it before it expires.',
    bulkTitle: '\uD83C\uDF81 {count} new FC Mobile codes', bulkMessage: '{count} new codes were added. Check the rewards and claim yours.',
    vars: ['reward', 'count'], config: {},
  },
  redeem_expiring: {
    label: 'Codes expiring soon', group: 'Redeem codes', trigger: 'Checks hourly. Sends once a day when active codes end within the window.',
    topic: 'redeem_codes', url: '/redeem-codes/', enabled: true,
    title: '\u23F3 {count} {codeWord} expiring soon', message: '{reward} ends {when}. Claim it while it still works.',
    vars: ['count', 'codeWord', 'reward', 'when'], config: { hoursAhead: 24 },
  },
  daily_reset: {
    label: 'Daily reset', group: 'Resets', trigger: 'Fires once a day at the reset time from the Football Centre settings.',
    topic: 'daily_reset', url: '/events/', enabled: false,
    title: '\uD83D\uDD04 Daily reset is live', message: 'Fresh daily rewards and objectives are ready. Log in and grab them.',
    vars: [], config: { hoursBefore: 0 },
  },
  rivals_reset: {
    label: 'Division Rivals reset', group: 'Resets', trigger: 'Fires before each 28 day Division Rivals reset.',
    topic: 'division_rivals', url: '/events/', enabled: false,
    title: '\u2694\uFE0F Division Rivals resets {when}', message: 'Finish your matches and claim your rewards before the new season starts.',
    vars: ['when'], config: { hoursBefore: 24 },
  },
  event_live: {
    label: 'Event goes live', group: 'Events', trigger: 'Fires when an event in the Football Centre calendar reaches its start time.',
    topic: 'live_events', url: '/events/', enabled: true,
    title: '\uD83D\uDD25 {event} is live', message: '{summary}',
    vars: ['event', 'summary'], config: {},
  },
  event_ending: {
    label: 'Event ending soon', group: 'Events', trigger: 'Fires ahead of an event end time.',
    topic: 'live_events', url: '/events/', enabled: true,
    title: '\u23F0 {event} ends {when}', message: 'Spend your tokens and finish your objectives before the reset.',
    vars: ['event', 'when'], config: { hoursBefore: 24 },
  },
  timeline_moment: {
    label: 'Draft and drop moments', group: 'Events', trigger: 'Fires for each entry on the events timeline (drafts, drops) when it goes live.',
    topic: 'live_events', url: '/events/', enabled: false,
    title: '\u26A1 {label}', message: '{detail}',
    vars: ['label', 'detail'], config: {},
  },
});

export const AUTOMATION_KEYS = Object.freeze(Object.keys(AUTOMATIONS));

/** Merge a stored row over the defaults. Unknown keys and bad config are ignored. */
export function resolveAutomation(key, stored) {
  const base = AUTOMATIONS[key];
  if (!base) return null;
  const row = stored && typeof stored === 'object' ? stored : {};
  const config = { ...base.config };
  const rawConfig = row.config && typeof row.config === 'object' ? row.config : {};
  for (const name of Object.keys(base.config)) {
    const value = Number(rawConfig[name]);
    if (Number.isFinite(value)) config[name] = Math.min(168, Math.max(0, Math.round(value)));
  }
  const pick = (name) => (typeof row[name] === 'string' && row[name].trim() ? row[name].trim() : base[name]);
  return {
    key, label: base.label, group: base.group, trigger: base.trigger, vars: base.vars,
    topic: TOPICS[row.topic] ? row.topic : base.topic,
    url: pick('url'),
    enabled: row.enabled === undefined || row.enabled === null ? base.enabled : Boolean(row.enabled),
    title: pick('title'), message: pick('message'),
    bulkTitle: base.bulkTitle ? pick('bulkTitle') : undefined,
    bulkMessage: base.bulkMessage ? pick('bulkMessage') : undefined,
    config,
  };
}

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const isoDay = (date) => new Date(date).toISOString().slice(0, 10);

/** "01:00" -> 1. Falls back to the game's real reset hour. */
export function resetHourUtc(schedule) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(schedule?.dailyResetUtc || ''));
  const hour = match ? Number(match[1]) : 1;
  return hour >= 0 && hour <= 23 ? hour : 1;
}

/** Hours until `target` from `now`, rounded to the hour, as friendly text. */
export function whenText(target, now) {
  const hours = Math.round((new Date(target).getTime() - new Date(now).getTime()) / HOUR);
  if (hours <= 0) return 'now';
  if (hours < 2) return 'in 1 hour';
  if (hours < 24) return `in ${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

/** The cron runs at the top of each hour. A moment is "due" when it falls inside the last hour. */
export function dueThisHour(moment, now, lookbackMinutes = 62) {
  const at = new Date(moment).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(at) || !Number.isFinite(current)) return false;
  return at <= current && current - at < lookbackMinutes * 60 * 1000;
}

export function dailyResetDue(now, schedule, hoursBefore = 0) {
  const when = new Date(now);
  const target = (resetHourUtc(schedule) - Math.max(0, Number(hoursBefore) || 0) + 24 * 7) % 24;
  return when.getUTCHours() === target;
}

/** Next Division Rivals reset strictly after `now`, from the anchor and cycle length. */
export function nextRivalsReset(rivals, now) {
  const anchor = new Date(rivals?.anchorUtc || '').getTime();
  const cycle = Math.max(1, Number(rivals?.cycleDays) || 28) * DAY;
  const current = new Date(now).getTime();
  if (!Number.isFinite(anchor) || !Number.isFinite(current)) return null;
  if (current < anchor) return new Date(anchor);
  const steps = Math.floor((current - anchor) / cycle) + 1;
  return new Date(anchor + steps * cycle);
}

/** True when the next rivals reset is between `hoursBefore - 1` and `hoursBefore` hours away. */
export function rivalsReminderDue(rivals, now, hoursBefore = 24) {
  if (!rivals || rivals.enabled === false) return null;
  const next = nextRivalsReset(rivals, now);
  if (!next) return null;
  const remaining = next.getTime() - new Date(now).getTime();
  const window = Math.max(1, hoursBefore) * HOUR;
  return remaining <= window && remaining > window - HOUR ? next : null;
}

/** Events whose start time just passed. */
export function eventsStartingNow(catalog, now) {
  return (Array.isArray(catalog) ? catalog : []).filter((event) => event?.id && event.title && dueThisHour(event.startUtc, now));
}

/** Events whose end is `hoursBefore` hours away (inside the one hour window). */
export function eventsEndingSoon(catalog, now, hoursBefore = 24) {
  const current = new Date(now).getTime();
  const window = Math.max(1, hoursBefore) * HOUR;
  return (Array.isArray(catalog) ? catalog : []).filter((event) => {
    if (!event?.id || !event.title || !event.endUtc) return false;
    const remaining = new Date(event.endUtc).getTime() - current;
    return Number.isFinite(remaining) && remaining <= window && remaining > window - HOUR;
  });
}

export function timelineMomentsNow(timeline, now) {
  return (Array.isArray(timeline) ? timeline : []).filter((item) => item?.label && dueThisHour(item.utc, now));
}

/**
 * Active codes that end inside the window. Codes with no expiry date never qualify.
 * Expiry dates are calendar days: a code "expires 2026-10-19" works through the end of that day UTC.
 */
export function codesExpiringSoon(codes, now, hoursAhead = 24) {
  const current = new Date(now).getTime();
  const horizon = current + Math.max(1, hoursAhead) * HOUR;
  return (Array.isArray(codes) ? codes : []).filter((code) => {
    if (!code?.expiryDate || (code.status && code.status !== 'active')) return false;
    const end = new Date(String(code.expiryDate).slice(0, 10) + 'T23:59:59Z').getTime();
    return Number.isFinite(end) && end > current && end <= horizon;
  }).sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
}

/* ------------------------------------------------------------------ */
/* Sending helpers                                                     */
/* ------------------------------------------------------------------ */

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Same title+message+audience inside this window is treated as an accidental double send. */
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
export const STAFF_SENDS_PER_HOUR = 6;

/** Explains a OneSignal failure in words an admin can act on. */
export function explainSendError(status, detail = '') {
  const text = String(detail || '');
  if (/not configured/i.test(text)) return 'The OneSignal REST API key is missing. Add it as the Cloudflare secret ONESIGNAL_REST_API_KEY, then try again.';
  if (status === 401 || status === 403) return 'OneSignal rejected the key. Copy the REST API Key from OneSignal under Settings, Keys and IDs, then save it again as ONESIGNAL_REST_API_KEY.';
  if (status === 404) return 'OneSignal could not find this app. Check that the App ID in the site matches your OneSignal app.';
  if (status === 429) return 'OneSignal is rate limiting sends. Wait a minute and try again.';
  if (/no (included )?(recipients|players|subscribers)|not subscribed/i.test(text)) return 'Nobody in this audience can receive alerts yet. Try the Everyone audience, or wait until more people turn alerts on.';
  if (status >= 500) return 'OneSignal had a problem on their side. Try again in a few minutes.';
  return text.slice(0, 280) || 'OneSignal did not accept this message.';
}

/* ------------------------------------------------------------------ */
/* Soft prompt rules (shared by the browser script and the tests)      */
/* ------------------------------------------------------------------ */

/**
 * After a dismissal we wait longer each time and stop after the person says no thanks, so the prompt
 * never becomes the annoying part of the site.
 */
export function promptCooldownMs(dismissals) {
  const count = Math.max(0, Number(dismissals) || 0);
  if (count <= 0) return 0;
  if (count === 1) return 3 * DAY;
  if (count === 2) return 14 * DAY;
  return 60 * DAY;
}

export function shouldShowPrompt({ state, dismissals = 0, lastDismissedAt = 0, optedOutForever = false, pageViews = 0, now = Date.now(), minPageViews = 1 }) {
  if (optedOutForever) return false;
  if (state !== 'available' && state !== 'can-resume') return false;
  if (pageViews < minPageViews) return false;
  return !lastDismissedAt || now - lastDismissedAt >= promptCooldownMs(dismissals);
}

/* ------------------------------------------------------------------ */
/* OneSignal request building                                          */
/* ------------------------------------------------------------------ */

export const SITE_ICON = SITE_ORIGIN + '/assets/images/favicon.png';

/**
 * OneSignal has two key styles. New keys (os_v2_...) use "Key", older REST keys use "Basic".
 * Sending the wrong scheme returns 401, which looks like a broken studio, so pick by prefix.
 */
export function authHeaderFor(apiKey, forceScheme) {
  const key = String(apiKey || '').trim();
  const scheme = forceScheme || (/^os_/i.test(key) ? 'Key' : 'Basic');
  return `${scheme} ${key}`;
}

/** "2026-10-26 09:30:00 GMT+0000", the format OneSignal documents for send_after. */
export function formatSendAfter(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Pick a valid date and time to schedule.');
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT+0000`;
}

export async function idempotencyKey(text) {
  const bytes = new TextEncoder().encode(String(text));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * The exact body sent to OneSignal. Targeting is one of: explicit subscription ids (tests, welcome),
 * a topic tag filter, or the built in Subscribed Users segment.
 */
export function buildOneSignalPayload(appId, campaign, options = {}) {
  const audience = AUDIENCES[campaign.topic];
  if (!audience) throw new Error('Choose a valid audience.');
  const payload = {
    app_id: appId,
    target_channel: 'push',
    headings: { en: campaign.title },
    contents: { en: campaign.message },
    url: campaign.launchUrl,
    ttl: Math.min(2419200, Math.max(300, Math.round((campaign.ttlHours || 24) * 3600))),
    chrome_web_icon: SITE_ICON,
    firefox_icon: SITE_ICON,
  };
  if (campaign.label) payload.name = String(campaign.label).slice(0, 80);
  if (campaign.imageUrl) payload.chrome_web_image = campaign.imageUrl;
  if (campaign.collapseId) payload.web_push_topic = String(campaign.collapseId).slice(0, 32);
  if (campaign.scheduleAt) payload.send_after = formatSendAfter(campaign.scheduleAt);
  if (options.idempotencyKey) payload.idempotency_key = options.idempotencyKey;
  if (Array.isArray(options.subscriptionIds) && options.subscriptionIds.length) {
    const ids = options.subscriptionIds.map((id) => String(id).trim().toLowerCase());
    if (ids.some((id) => !isSubscriptionId(id))) throw new Error('That subscription ID does not look valid.');
    payload.include_subscription_ids = ids.slice(0, 2000);
  } else if (audience.tag) {
    payload.filters = [{ field: 'tag', key: audience.tag, relation: '=', value: 'true' }];
  } else {
    payload.included_segments = ['Subscribed Users'];
  }
  return payload;
}

/** "today", "tomorrow" or "on Oct 29" for a calendar-day expiry. */
export function expiryWhenText(expiryDate, now) {
  const day = String(expiryDate || '').slice(0, 10);
  const today = isoDay(now);
  const tomorrow = isoDay(new Date(new Date(now).getTime() + DAY));
  if (day === today) return 'today';
  if (day === tomorrow) return 'tomorrow';
  const date = new Date(day + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return 'soon';
  return 'on ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Sample values used for studio previews and automation tests. */
export const SAMPLE_VARS = Object.freeze({
  reward: '2 FC Draft Vouchers and 100M Coins', count: 3, codeWord: 'codes', when: 'tomorrow',
  event: 'Ballon d\u2019Or', summary: 'Four weeks of nominee challenges and 124 OVR Drafts.',
  label: 'Ballon d\u2019Or Draft B', detail: '124 CB Beckenbauer, 123 ST Haaland, 122 CDM Rice',
});
