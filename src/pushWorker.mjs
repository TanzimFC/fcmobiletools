// Push notifications on the Worker: device registry, opt-in funnel, the Notification Studio API and
// the automatic alerts. Delivery is OneSignal; everything else lives in D1 so admins can see it.
import { FOOTBALL_CENTRE_CONTENT } from './data/footballCentre.js';
import { ONESIGNAL_APP_ID } from './config/siteNotifications.js';
import { listAdminCodes } from './lib/redeem.js';
import {
  TOPICS, TOPIC_KEYS, AUDIENCES, AUTOMATION_KEYS, AUTOMATIONS, SAMPLE_VARS, LIMITS,
  STAFF_SENDS_PER_HOUR, DUPLICATE_WINDOW_MS, COMPOSE_TEMPLATES,
  isSubscriptionId, normalizeSource, normalizeFunnelEvent, normalizeLocaleCode, normalizeTopicState,
  topicsToBits, bitsToTopics, platformFromUserAgent, safeSiteUrl, safeImageUrl, validateCopy,
  renderTemplate, clip, plural, resolveAutomation, authHeaderFor, buildOneSignalPayload,
  idempotencyKey, explainSendError, isoDay, whenText, expiryWhenText, dueThisHour, dailyResetDue,
  rivalsReminderDue, eventsStartingNow, eventsEndingSoon, timelineMomentsNow, codesExpiringSoon,
} from './lib/pushCore.js';

const API = 'https://api.onesignal.com';
const DAY_MS = 24 * 3600 * 1000;
const DEFAULT_SETTINGS = Object.freeze({ promptEnabled: true, delaySeconds: 12, minPageViews: 2, bellEnabled: true, redeemCardEnabled: true, welcomeEnabled: true });

class PushError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

let schemaPromise = null;

export function ensurePushSchema(db) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const run = (sql) => db.prepare(sql).run();
      await run("CREATE TABLE IF NOT EXISTS notification_campaigns (id TEXT PRIMARY KEY, onesignal_id TEXT, label TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, message TEXT NOT NULL, launch_url TEXT NOT NULL, topic TEXT NOT NULL, status TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'manual', created_by TEXT NOT NULL DEFAULT 'admin', created_at TEXT NOT NULL, error TEXT, dedupe_key TEXT UNIQUE)");
      const existing = await db.prepare('PRAGMA table_info(notification_campaigns)').all();
      const have = new Set((existing.results || []).map((column) => column.name));
      for (const [name, type] of [['scheduled_for', 'TEXT'], ['image_url', 'TEXT'], ['recipients', 'INTEGER'], ['stats_json', 'TEXT'], ['stats_at', 'TEXT']]) {
        if (!have.has(name)) await run(`ALTER TABLE notification_campaigns ADD COLUMN ${name} ${type}`);
      }
      await run('CREATE INDEX IF NOT EXISTS idx_notification_campaigns_created ON notification_campaigns(created_at)');
      await run("CREATE TABLE IF NOT EXISTS push_subscribers (subscription_id TEXT PRIMARY KEY, topics INTEGER NOT NULL DEFAULT 0, locale TEXT NOT NULL DEFAULT 'en', platform TEXT NOT NULL DEFAULT 'other', source TEXT NOT NULL DEFAULT 'other', opted_in INTEGER NOT NULL DEFAULT 1, is_test INTEGER NOT NULL DEFAULT 0, label TEXT, welcomed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_seen_at TEXT NOT NULL)");
      await run('CREATE INDEX IF NOT EXISTS idx_push_subscribers_state ON push_subscribers(opted_in, is_test)');
      await run('CREATE TABLE IF NOT EXISTS push_funnel (day TEXT NOT NULL, source TEXT NOT NULL, event TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, source, event))');
      await run('CREATE TABLE IF NOT EXISTS notification_automations (key TEXT PRIMARY KEY, enabled INTEGER, config TEXT, title TEXT, message TEXT, bulk_title TEXT, bulk_message TEXT, url TEXT, topic TEXT, updated_at TEXT, updated_by TEXT, last_run_at TEXT, last_status TEXT)');
      await run('CREATE TABLE IF NOT EXISTS push_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
      await run('CREATE TABLE IF NOT EXISTS push_rate (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)');
    })().catch((error) => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

const nowIso = () => new Date().toISOString();

/** Copy problems are the admin's to fix, so they surface as 400s with the exact reason. */
function checkedCopy(copy) {
  try { return validateCopy(copy); } catch (error) { throw new PushError(400, error.message); }
}

async function readJson(request, maxBytes = 8192) {
  const text = await request.text();
  if (text.length > maxBytes) throw new PushError(413, 'That request is too large.');
  try { const data = JSON.parse(text || '{}'); return data && typeof data === 'object' ? data : {}; } catch { throw new PushError(400, 'Send valid JSON.'); }
}

async function hashText(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Fixed-window counter in D1. Returns true while the caller is under the limit. */
async function underRateLimit(db, bucket, limit, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  const row = await db.prepare('INSERT INTO push_rate (bucket, count, window_start) VALUES (?1, 1, ?2) ON CONFLICT(bucket) DO UPDATE SET count = CASE WHEN push_rate.window_start < ?3 THEN 1 ELSE push_rate.count + 1 END, window_start = CASE WHEN push_rate.window_start < ?3 THEN ?2 ELSE push_rate.window_start END RETURNING count')
    .bind(bucket, now, windowStart).first();
  return Number(row?.count || 1) <= limit;
}

/* ------------------------------------------------------------------ */
/* OneSignal                                                           */
/* ------------------------------------------------------------------ */

function apiKey(env) { return String(env.ONESIGNAL_REST_API_KEY || '').trim(); }

async function oneSignal(env, method, path, { body, query } = {}) {
  const key = apiKey(env);
  if (!key) throw new PushError(0, explainSendError(0, 'not configured'));
  const url = new URL(API + path);
  for (const [name, value] of Object.entries(query || {})) url.searchParams.set(name, value);
  const attempt = (scheme) => fetch(url, {
    method,
    headers: { authorization: authHeaderFor(key, scheme), 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let response;
  try { response = await attempt(); } catch { throw new PushError(502, 'OneSignal did not answer in time. Try again in a moment.'); }
  if (response.status === 401 || response.status === 403) {
    // A key can be valid with the other scheme. Try once before reporting a bad key.
    const other = authHeaderFor(key).startsWith('Key') ? 'Basic' : 'Key';
    try { const retry = await attempt(other); if (retry.status !== response.status) response = retry; } catch { /* keep the first answer */ }
  }
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function errorDetail(data) {
  const errors = data?.errors;
  if (Array.isArray(errors)) return errors.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('; ');
  if (errors && typeof errors === 'object') return JSON.stringify(errors);
  return String(errors || '');
}

async function sendPush(env, campaign, options = {}) {
  const payload = buildOneSignalPayload(ONESIGNAL_APP_ID, campaign, options);
  const { ok, status, data } = await oneSignal(env, 'POST', '/notifications', { body: payload, query: { c: 'push' } });
  const detail = errorDetail(data);
  if (!ok || (detail && !data?.id)) throw new PushError(status || 502, explainSendError(status, detail));
  return { id: data.id || null, recipients: Number(data.recipients || 0) };
}

/* ------------------------------------------------------------------ */
/* Campaign history                                                    */
/* ------------------------------------------------------------------ */

const CAMPAIGN_COLUMNS = 'id, onesignal_id, label, title, message, launch_url, topic, status, kind, created_by, created_at, error, scheduled_for, image_url, recipients, stats_json, stats_at';

function campaignView(row) {
  let stats = null;
  try { stats = row.stats_json ? JSON.parse(row.stats_json) : null; } catch { stats = null; }
  return {
    id: row.id, onesignalId: row.onesignal_id, label: row.label, title: row.title, message: row.message, url: row.launch_url,
    topic: row.topic, topicLabel: AUDIENCES[row.topic]?.label || row.topic, status: row.status, kind: row.kind, createdBy: row.created_by,
    createdAt: row.created_at, error: row.error, scheduledFor: row.scheduled_for, imageUrl: row.image_url, recipients: row.recipients, stats, statsAt: row.stats_at,
  };
}

async function saveCampaign(db, c, result, errorText, status) {
  const finalStatus = status || (result ? (c.scheduleAt ? 'scheduled' : 'sent') : 'failed');
  await db.prepare(`INSERT INTO notification_campaigns (id, onesignal_id, label, title, message, launch_url, topic, status, kind, created_by, created_at, error, dedupe_key, scheduled_for, image_url, recipients)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
    ON CONFLICT(dedupe_key) DO UPDATE SET onesignal_id = excluded.onesignal_id, status = excluded.status, error = excluded.error, created_at = excluded.created_at, recipients = excluded.recipients`)
    .bind(crypto.randomUUID(), result?.id || null, String(c.label || '').slice(0, LIMITS.label), c.title, c.message, c.launchUrl, c.topic, finalStatus, c.kind || 'manual',
      c.createdBy || 'owner', nowIso(), errorText || null, c.dedupeKey || null, c.scheduleAt ? new Date(c.scheduleAt).toISOString() : null, c.imageUrl || null, result?.recipients ?? null).run();
}

/** Reserve an automation slot so two overlapping runs can never both send the same alert. */
async function claimAutomation(db, c) {
  const inserted = await db.prepare(`INSERT OR IGNORE INTO notification_campaigns (id, label, title, message, launch_url, topic, status, kind, created_by, created_at, dedupe_key)
    VALUES (?1,?2,?3,?4,?5,?6,'sending','automation','automation',?7,?8)`).bind(crypto.randomUUID(), c.label || '', c.title, c.message, c.launchUrl, c.topic, nowIso(), c.dedupeKey).run();
  if (inserted.meta?.changes) return true;
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const retried = await db.prepare("UPDATE notification_campaigns SET status = 'sending', error = NULL, created_at = ?1 WHERE dedupe_key = ?2 AND status IN ('failed','sending') AND created_at < ?3")
    .bind(nowIso(), c.dedupeKey, staleBefore).run();
  return Boolean(retried.meta?.changes);
}

/* ------------------------------------------------------------------ */
/* Settings and automations                                            */
/* ------------------------------------------------------------------ */

export async function loadSettings(db) {
  const row = await db.prepare("SELECT value FROM push_settings WHERE key = 'prompt'").first();
  let stored = {};
  try { stored = row?.value ? JSON.parse(row.value) : {}; } catch { stored = {}; }
  const out = { ...DEFAULT_SETTINGS };
  for (const key of ['promptEnabled', 'bellEnabled', 'redeemCardEnabled', 'welcomeEnabled']) if (typeof stored[key] === 'boolean') out[key] = stored[key];
  if (Number.isFinite(Number(stored.delaySeconds))) out.delaySeconds = Math.min(120, Math.max(3, Math.round(Number(stored.delaySeconds))));
  if (Number.isFinite(Number(stored.minPageViews))) out.minPageViews = Math.min(6, Math.max(1, Math.round(Number(stored.minPageViews))));
  return out;
}

async function loadAutomations(db) {
  const { results } = await db.prepare('SELECT * FROM notification_automations').all();
  const rows = new Map((results || []).map((row) => [row.key, row]));
  return AUTOMATION_KEYS.map((key) => {
    const row = rows.get(key);
    let config = {};
    try { config = row?.config ? JSON.parse(row.config) : {}; } catch { config = {}; }
    const resolved = resolveAutomation(key, row ? {
      enabled: row.enabled === null || row.enabled === undefined ? undefined : Boolean(row.enabled), config, title: row.title, message: row.message,
      bulkTitle: row.bulk_title, bulkMessage: row.bulk_message, url: row.url, topic: row.topic,
    } : null);
    return { ...resolved, lastRunAt: row?.last_run_at || null, lastStatus: row?.last_status || null, updatedAt: row?.updated_at || null, updatedBy: row?.updated_by || null };
  });
}

async function noteAutomationRun(db, key, status) {
  await db.prepare('INSERT INTO notification_automations (key, last_run_at, last_status) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET last_run_at = excluded.last_run_at, last_status = excluded.last_status')
    .bind(key, nowIso(), String(status).slice(0, 160)).run();
}

async function saveAutomation(db, input, actor) {
  const key = String(input.key || '');
  if (!AUTOMATIONS[key]) throw new PushError(400, 'Unknown automation.');
  const next = resolveAutomation(key, input);
  const sample = { ...SAMPLE_VARS };
  checkedCopy({ title: renderTemplate(next.title, sample), message: renderTemplate(next.message, sample) });
  if (next.bulkTitle) checkedCopy({ title: renderTemplate(next.bulkTitle, sample), message: renderTemplate(next.bulkMessage, sample) });
  try { next.url = safeSiteUrl(next.url, AUTOMATIONS[key].url); } catch (error) { throw new PushError(400, error.message); }
  await db.prepare(`INSERT INTO notification_automations (key, enabled, config, title, message, bulk_title, bulk_message, url, topic, updated_at, updated_by)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)
    ON CONFLICT(key) DO UPDATE SET enabled = excluded.enabled, config = excluded.config, title = excluded.title, message = excluded.message, bulk_title = excluded.bulk_title, bulk_message = excluded.bulk_message, url = excluded.url, topic = excluded.topic, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(key, next.enabled ? 1 : 0, JSON.stringify(next.config), next.title, next.message, next.bulkTitle || null, next.bulkMessage || null, next.url, next.topic, nowIso(), actor).run();
}

/* ------------------------------------------------------------------ */
/* Automations: firing                                                 */
/* ------------------------------------------------------------------ */

function automationCampaign(auto, vars, dedupeKey, options = {}) {
  const bulk = Boolean(options.bulk && auto.bulkTitle);
  return {
    label: auto.label,
    title: clip(renderTemplate(bulk ? auto.bulkTitle : auto.title, vars), LIMITS.title[1]),
    message: clip(renderTemplate(bulk ? auto.bulkMessage : auto.message, vars), LIMITS.message[1]),
    launchUrl: safeSiteUrl(auto.url, AUTOMATIONS[auto.key].url),
    topic: auto.topic, kind: 'automation', createdBy: 'automation', dedupeKey,
    ttlHours: options.ttlHours || 12, collapseId: options.collapseId || '',
  };
}

/** Sends one automatic alert at most once per dedupe key. Never throws. */
async function fireAutomation(env, db, auto, vars, dedupeKey, options = {}) {
  if (!auto?.enabled) return { key: auto?.key, skipped: 'disabled' };
  if (!apiKey(env)) { await noteAutomationRun(db, auto.key, 'Skipped: OneSignal key missing'); return { key: auto.key, skipped: 'no-key' }; }
  let campaign;
  try { campaign = automationCampaign(auto, vars, dedupeKey, options); } catch (error) { return { key: auto.key, error: error.message }; }
  const claimed = await claimAutomation(db, campaign);
  if (!claimed) return { key: auto.key, skipped: 'already-sent' };
  try {
    const sent = await sendPush(env, campaign, { idempotencyKey: await idempotencyKey(dedupeKey) });
    await saveCampaign(db, campaign, sent, null);
    await noteAutomationRun(db, auto.key, 'Sent ' + isoDay(Date.now()));
    return { key: auto.key, sent: true, id: sent.id };
  } catch (error) {
    const message = String(error?.message || 'Send failed.').slice(0, 300);
    try { await saveCampaign(db, campaign, null, message); await noteAutomationRun(db, auto.key, 'Failed: ' + message.slice(0, 120)); } catch { /* history is best effort */ }
    console.error('[PUSH_AUTOMATION]', auto.key, message);
    return { key: auto.key, error: message };
  }
}

/** Called by the redeem admin API right after a code (or a batch) is created. */
export async function autoRedeemPush(env, db, info) {
  try {
    await ensurePushSchema(db);
    const auto = (await loadAutomations(db)).find((item) => item.key === 'redeem_new');
    const bulk = info.kind === 'redeem_bulk';
    const count = Math.max(1, Number(info.count) || 1);
    const reward = clip(String(info.reward || 'FC Mobile rewards').replace(/\s+/g, ' '), 70);
    return await fireAutomation(env, db, auto, { reward, count }, 'redeem:' + String(info.dedupe || '').slice(0, 120), { bulk: bulk && count > 1, collapseId: 'redeem-codes' });
  } catch (error) {
    console.error('[PUSH_REDEEM_AUTO]', error?.message);
    return { error: error?.message };
  }
}

/** Hourly: reset reminders, events, expiring codes, and codes released by schedule. */
export async function runPushAutomations(env, { db, now = new Date() } = {}) {
  if (!db) return [];
  await ensurePushSchema(db);
  await db.prepare("INSERT INTO push_settings (key, value, updated_at) VALUES ('cron_heartbeat', ?1, ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(nowIso()).run();
  await db.prepare('DELETE FROM push_rate WHERE window_start < ?').bind(Math.floor(Date.now() / 1000) - 7200).run();
  const automations = new Map((await loadAutomations(db)).map((item) => [item.key, item]));
  const content = FOOTBALL_CENTRE_CONTENT || {};
  const results = [];
  const day = isoDay(now);

  const reset = automations.get('daily_reset');
  if (reset.enabled && dailyResetDue(now, content.schedule, reset.config.hoursBefore)) {
    results.push(await fireAutomation(env, db, reset, {}, `daily_reset:${day}:${reset.config.hoursBefore}`, { collapseId: 'daily-reset', ttlHours: 8 }));
  }

  const rivals = automations.get('rivals_reset');
  const nextRivals = rivals.enabled ? rivalsReminderDue(content.divisionRivalsReset, now, rivals.config.hoursBefore) : null;
  if (nextRivals) results.push(await fireAutomation(env, db, rivals, { when: whenText(nextRivals, now) }, `rivals:${nextRivals.toISOString()}:${rivals.config.hoursBefore}`, { ttlHours: 24 }));

  const live = automations.get('event_live');
  if (live.enabled) {
    for (const event of eventsStartingNow(content.eventsCatalog, now)) {
      const summary = clip(String(event.summary || '').replace(/\s+/g, ' ') || 'The event just started. See the rewards and the schedule.', 150);
      results.push(await fireAutomation(env, db, live, { event: event.title, summary }, `event_live:${event.id}:${event.startUtc}`, { ttlHours: 24 }));
    }
  }
  const ending = automations.get('event_ending');
  if (ending.enabled) {
    for (const event of eventsEndingSoon(content.eventsCatalog, now, ending.config.hoursBefore)) {
      results.push(await fireAutomation(env, db, ending, { event: event.title, when: whenText(event.endUtc, now) }, `event_end:${event.id}:${event.endUtc}:${ending.config.hoursBefore}`, { ttlHours: 24 }));
    }
  }
  const moments = automations.get('timeline_moment');
  if (moments.enabled) {
    for (const item of timelineMomentsNow(content.eventsTimeline, now)) {
      results.push(await fireAutomation(env, db, moments, { label: item.label, detail: clip(item.detail || 'Open the events page for the details.', 150) }, `moment:${item.event}:${item.utc}:${await hashText(item.label)}`, { ttlHours: 12 }));
    }
  }

  const codes = automations.get('redeem_expiring');
  const newCode = automations.get('redeem_new');
  if ((codes.enabled || newCode.enabled)) {
    try {
      const { codes: allCodes } = await listAdminCodes(db);
      if (codes.enabled) {
        const expiring = codesExpiringSoon(allCodes, now, codes.config.hoursAhead);
        if (expiring.length) {
          const first = expiring[0];
          const reward = clip(String(first.reward || 'A code').replace(/\s+/g, ' '), 60) + (expiring.length > 1 ? ` and ${expiring.length - 1} more` : '');
          const vars = { count: expiring.length, codeWord: plural(expiring.length, 'code', 'codes'), reward, when: expiryWhenText(first.expiryDate, now) };
          results.push(await fireAutomation(env, db, codes, vars, `redeem_expiring:${day}:${await hashText(expiring.map((c) => c.code).join(','))}`, { ttlHours: 12, collapseId: 'codes-expiring' }));
        }
      }
      if (newCode.enabled) {
        // Codes scheduled in advance go live on their release date without anyone pressing a button.
        // Only codes created on an earlier day qualify: same-day codes were announced when they were saved.
        const released = allCodes.filter((code) => code.status === 'active' && code.releaseDate === day && String(code.createdAt || '').slice(0, 10) < day);
        for (const code of released) {
          results.push(await fireAutomation(env, db, newCode, { reward: clip(String(code.reward || 'FC Mobile rewards').replace(/\s+/g, ' '), 70), count: 1 }, 'redeem:' + code.code, { collapseId: 'redeem-codes' }));
        }
      }
    } catch (error) { console.error('[PUSH_REDEEM_SWEEP]', error?.message); }
  }
  return results.filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Public API: /api/push/*                                             */
/* ------------------------------------------------------------------ */

async function clientBucket(request, prefix) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  return prefix + ':' + await hashText(ip);
}

async function sendWelcome(env, db, subscriptionId, topics) {
  const wantsCodes = topics.redeem_codes;
  const campaign = {
    label: 'Welcome', title: '\uD83D\uDD14 Alerts are on',
    message: wantsCodes ? 'We will alert you the moment a new redeem code drops. Manage your alerts any time from the bell.' : 'You will get the alerts you picked. Manage them any time from the bell.',
    launchUrl: safeSiteUrl(wantsCodes ? '/redeem-codes/' : '/'), topic: 'all', kind: 'welcome', ttlHours: 1,
  };
  try { await sendPush(env, campaign, { subscriptionIds: [subscriptionId] }); } catch (error) { console.warn('[PUSH_WELCOME]', error?.message); }
}

export async function pushPublicRoute({ request, env, url, ctx, json, d1 }) {
  const sub = url.pathname.replace(/^\/api\/push/, '').replace(/\/$/, '') || '/';
  const db = await d1(env);
  await ensurePushSchema(db);

  if (sub === '/config' && request.method === 'GET') {
    const settings = await loadSettings(db);
    return json({ appId: ONESIGNAL_APP_ID, ...settings }, 200, { 'cache-control': 'public, max-age=300, stale-while-revalidate=600' });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST' });
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'Request origin rejected.' }, 403);

  try {
    if (sub === '/register') {
      if (!(await underRateLimit(db, await clientBucket(request, 'reg'), 40, 3600))) return json({ error: 'Slow down for a moment.' }, 429);
      const body = await readJson(request);
      const id = String(body.subscriptionId || '').trim().toLowerCase();
      if (!isSubscriptionId(id)) return json({ error: 'Invalid subscription.' }, 400);
      const topics = normalizeTopicState(body.topics);
      const stamp = nowIso();
      await db.prepare(`INSERT INTO push_subscribers (subscription_id, topics, locale, platform, source, opted_in, is_test, created_at, updated_at, last_seen_at)
        VALUES (?1,?2,?3,?4,?5,1,0,?6,?6,?6)
        ON CONFLICT(subscription_id) DO UPDATE SET topics = excluded.topics, locale = excluded.locale, platform = excluded.platform, opted_in = 1, updated_at = excluded.updated_at, last_seen_at = excluded.last_seen_at`)
        .bind(id, topicsToBits(topics), normalizeLocaleCode(body.locale), platformFromUserAgent(request.headers.get('user-agent')), normalizeSource(body.source), stamp).run();
      let welcomed = false;
      if (body.welcome === true && (await loadSettings(db)).welcomeEnabled && apiKey(env)) {
        const claimed = await db.prepare('UPDATE push_subscribers SET welcomed_at = ?1 WHERE subscription_id = ?2 AND welcomed_at IS NULL AND is_test = 0').bind(stamp, id).run();
        if (claimed.meta?.changes && await underRateLimit(db, await clientBucket(request, 'welcome'), 5, 3600)) {
          welcomed = true;
          const task = sendWelcome(env, db, id, topics);
          if (ctx?.waitUntil) ctx.waitUntil(task); else await task;
        }
      }
      return json({ ok: true, welcomed });
    }
    if (sub === '/unregister') {
      if (!(await underRateLimit(db, await clientBucket(request, 'unreg'), 40, 3600))) return json({ error: 'Slow down for a moment.' }, 429);
      const body = await readJson(request);
      const id = String(body.subscriptionId || '').trim().toLowerCase();
      if (!isSubscriptionId(id)) return json({ error: 'Invalid subscription.' }, 400);
      await db.prepare('UPDATE push_subscribers SET opted_in = 0, updated_at = ?1 WHERE subscription_id = ?2 AND is_test = 0').bind(nowIso(), id).run();
      return json({ ok: true });
    }
    if (sub === '/event') {
      if (!(await underRateLimit(db, await clientBucket(request, 'evt'), 120, 3600))) return json({ ok: true });
      const body = await readJson(request, 1024);
      const event = normalizeFunnelEvent(body.event);
      if (!event) return json({ error: 'Unknown event.' }, 400);
      await db.prepare('INSERT INTO push_funnel (day, source, event, count) VALUES (?1,?2,?3,1) ON CONFLICT(day, source, event) DO UPDATE SET count = count + 1')
        .bind(isoDay(Date.now()), normalizeSource(body.source), event).run();
      return json({ ok: true });
    }
  } catch (error) {
    if (error instanceof PushError) return json({ error: error.message }, error.status);
    console.error('[PUSH_PUBLIC]', error?.message);
    return json({ error: 'Could not save that right now.' }, 503);
  }
  return json({ error: 'Not found.' }, 404);
}

/* ------------------------------------------------------------------ */
/* Studio API: /api/notification-studio/*                              */
/* ------------------------------------------------------------------ */

async function subscriberStats(db) {
  const totals = await db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(opted_in), 0) AS active FROM push_subscribers WHERE is_test = 0').first();
  const groups = await db.prepare('SELECT topics, COUNT(*) AS n FROM push_subscribers WHERE opted_in = 1 AND is_test = 0 GROUP BY topics').all();
  const byTopic = Object.fromEntries(TOPIC_KEYS.map((key) => [key, 0]));
  for (const row of groups.results || []) {
    const enabled = bitsToTopics(row.topics);
    for (const key of TOPIC_KEYS) if (enabled[key]) byTopic[key] += Number(row.n);
  }
  const platforms = await db.prepare('SELECT platform, COUNT(*) AS n FROM push_subscribers WHERE opted_in = 1 AND is_test = 0 GROUP BY platform').all();
  const locales = await db.prepare('SELECT locale, COUNT(*) AS n FROM push_subscribers WHERE opted_in = 1 AND is_test = 0 GROUP BY locale').all();
  const since = new Date(Date.now() - 29 * DAY_MS).toISOString().slice(0, 10);
  const daily = await db.prepare('SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM push_subscribers WHERE is_test = 0 AND substr(created_at, 1, 10) >= ?1 GROUP BY day ORDER BY day').bind(since).all();
  const byDay = new Map((daily.results || []).map((row) => [row.day, Number(row.n)]));
  const series = Array.from({ length: 30 }, (_, i) => { const day = new Date(Date.now() - (29 - i) * DAY_MS).toISOString().slice(0, 10); return { day, n: byDay.get(day) || 0 }; });
  const tests = await db.prepare('SELECT COUNT(*) AS n FROM push_subscribers WHERE is_test = 1 AND opted_in = 1').first();
  return {
    total: Number(totals?.total || 0), active: Number(totals?.active || 0), paused: Number(totals?.total || 0) - Number(totals?.active || 0),
    byTopic, byPlatform: Object.fromEntries((platforms.results || []).map((row) => [row.platform, Number(row.n)])),
    byLocale: Object.fromEntries((locales.results || []).map((row) => [row.locale, Number(row.n)])),
    series, new7d: series.slice(-7).reduce((sum, item) => sum + item.n, 0), new30d: series.reduce((sum, item) => sum + item.n, 0), testDevices: Number(tests?.n || 0),
  };
}

async function funnelStats(db) {
  const since = new Date(Date.now() - 13 * DAY_MS).toISOString().slice(0, 10);
  const { results } = await db.prepare('SELECT source, event, SUM(count) AS n FROM push_funnel WHERE day >= ?1 GROUP BY source, event').bind(since).all();
  const bySource = {};
  const totals = {};
  for (const row of results || []) {
    bySource[row.source] ||= {};
    bySource[row.source][row.event] = Number(row.n);
    totals[row.event] = (totals[row.event] || 0) + Number(row.n);
  }
  return { days: 14, bySource, totals };
}

async function identify({ request, env, authenticated, workerAuthenticated, staffAllowed }) {
  if (await authenticated(request, env)) return 'owner';
  if (staffAllowed && await workerAuthenticated(request, env)) return 'staff';
  return null;
}

async function healthChecks(env, db) {
  const checks = [];
  const key = apiKey(env);
  checks.push({ id: 'key', label: 'OneSignal key', ok: Boolean(key), detail: key ? 'Key is saved on the server.' : explainSendError(0, 'not configured') });
  if (key) {
    try {
      const { ok, status } = await oneSignal(env, 'GET', '/notifications', { query: { app_id: ONESIGNAL_APP_ID, limit: '1' } });
      checks.push({ id: 'onesignal', label: 'OneSignal connection', ok, detail: ok ? 'OneSignal accepted the key.' : explainSendError(status, '') });
    } catch (error) { checks.push({ id: 'onesignal', label: 'OneSignal connection', ok: false, detail: error.message }); }
  } else {
    checks.push({ id: 'onesignal', label: 'OneSignal connection', ok: false, detail: 'Add the key first.' });
  }
  try { await db.prepare('SELECT 1').first(); checks.push({ id: 'database', label: 'Database', ok: true, detail: 'Campaign history and devices are saving.' }); }
  catch (error) { checks.push({ id: 'database', label: 'Database', ok: false, detail: error.message }); }
  const counts = await db.prepare('SELECT COUNT(*) AS n FROM push_subscribers WHERE opted_in = 1 AND is_test = 0').first();
  const n = Number(counts?.n || 0);
  checks.push({ id: 'devices', label: 'Registered devices', ok: n > 0, detail: n > 0 ? `${n.toLocaleString('en-US')} ${plural(n, 'device', 'devices')} can receive alerts.` : 'No devices registered yet. People who turned alerts on earlier are added the next time they visit the site.' });
  const beat = await db.prepare("SELECT value FROM push_settings WHERE key = 'cron_heartbeat'").first();
  const age = beat?.value ? Date.now() - new Date(beat.value).getTime() : Infinity;
  checks.push({ id: 'cron', label: 'Automatic alerts', ok: age < 3 * 3600 * 1000, detail: Number.isFinite(age) ? (age < 3 * 3600 * 1000 ? 'The hourly check ran recently.' : 'The hourly check has not run for over 3 hours.') : 'The hourly check has not run yet. It starts after the next deploy.' });
  return checks;
}

async function audienceEstimate(db, topic) {
  if (topic === 'all') {
    const row = await db.prepare('SELECT COUNT(*) AS n FROM push_subscribers WHERE opted_in = 1 AND is_test = 0').first();
    return Number(row?.n || 0);
  }
  const index = TOPIC_KEYS.indexOf(topic);
  if (index < 0) return 0;
  const row = await db.prepare('SELECT COUNT(*) AS n FROM push_subscribers WHERE opted_in = 1 AND is_test = 0 AND (topics & ?1) != 0').bind(1 << index).first();
  return Number(row?.n || 0);
}

async function testDeviceIds(db) {
  const { results } = await db.prepare('SELECT subscription_id FROM push_subscribers WHERE is_test = 1 AND opted_in = 1 ORDER BY updated_at DESC LIMIT 20').all();
  return (results || []).map((row) => row.subscription_id);
}

function readCampaignInput(input, role) {
  const { title, message } = checkedCopy(input);
  const topic = String(input.topic || '');
  const audience = AUDIENCES[topic];
  if (!audience) throw new PushError(400, 'Choose who should get this.');
  if (audience.ownerOnly && role !== 'owner') throw new PushError(403, 'Only the owner can send to everyone. Pick a topic audience.');
  let launchUrl; let imageUrl;
  try { launchUrl = safeSiteUrl(input.url); imageUrl = safeImageUrl(input.imageUrl); } catch (error) { throw new PushError(400, error.message); }
  let scheduleAt = '';
  if (input.scheduleAt) {
    const when = new Date(input.scheduleAt);
    if (Number.isNaN(when.getTime())) throw new PushError(400, 'Pick a valid date and time to schedule.');
    if (when.getTime() < Date.now() + 2 * 60 * 1000) throw new PushError(400, 'Schedule at least a few minutes ahead, or send now.');
    if (when.getTime() > Date.now() + 30 * DAY_MS) throw new PushError(400, 'Schedule within the next 30 days.');
    scheduleAt = when.toISOString();
  }
  const ttlHours = Math.min(168, Math.max(1, Number(input.ttlHours) || 24));
  return { label: String(input.label || '').trim().slice(0, LIMITS.label), title, message, launchUrl, imageUrl, topic, scheduleAt, ttlHours, kind: 'manual', createdBy: role };
}

export async function notificationStudioRoute({ request, env, url, ctx, json, d1, authenticated, workerAuthenticated, staffAllowed = true }) {
  const role = await identify({ request, env, authenticated, workerAuthenticated, staffAllowed });
  if (!role) return json({ error: 'Admin sign in required.' }, 401);
  const sub = url.pathname.replace(/^\/api\/notification-studio/, '').replace(/\/$/, '') || '/';
  const method = request.method;
  const db = await d1(env);
  try {
    await ensurePushSchema(db);

    if (method === 'GET') {
      if (sub === '/' || sub === '/campaigns') {
        const { results } = await db.prepare(`SELECT ${CAMPAIGN_COLUMNS} FROM notification_campaigns WHERE kind != 'marker' ORDER BY created_at DESC LIMIT 60`).all();
        return json({ campaigns: (results || []).map(campaignView), role });
      }
      if (sub === '/overview') {
        const [subscribers, funnel, campaigns, automations, settings] = await Promise.all([
          subscriberStats(db), funnelStats(db),
          db.prepare(`SELECT ${CAMPAIGN_COLUMNS} FROM notification_campaigns WHERE kind != 'marker' ORDER BY created_at DESC LIMIT 60`).all(),
          loadAutomations(db), loadSettings(db),
        ]);
        return json({
          role, appId: ONESIGNAL_APP_ID, keyConfigured: Boolean(apiKey(env)), subscribers, funnel, settings,
          campaigns: (campaigns.results || []).map(campaignView),
          automations: role === 'owner' ? automations : automations.map(({ key, label, group, enabled, lastRunAt, lastStatus }) => ({ key, label, group, enabled, lastRunAt, lastStatus })),
          templates: COMPOSE_TEMPLATES, audiences: Object.fromEntries(Object.entries(AUDIENCES).filter(([, a]) => role === 'owner' || !a.ownerOnly).map(([key, a]) => [key, a.label])),
          topics: Object.fromEntries(TOPIC_KEYS.map((key) => [key, { label: TOPICS[key].label, blurb: TOPICS[key].blurb }])),
          limits: { title: LIMITS.title[1], message: LIMITS.message[1], staffSendsPerHour: STAFF_SENDS_PER_HOUR },
        });
      }
      if (sub === '/health') return json({ checks: await healthChecks(env, db) });
      if (sub === '/estimate') {
        const topic = url.searchParams.get('topic') || '';
        if (!AUDIENCES[topic]) return json({ error: 'Choose a valid audience.' }, 400);
        return json({ topic, estimate: await audienceEstimate(db, topic) });
      }
      if (sub === '/devices') {
        const { results } = await db.prepare('SELECT subscription_id, label, platform, updated_at FROM push_subscribers WHERE is_test = 1 AND opted_in = 1 ORDER BY updated_at DESC LIMIT 20').all();
        return json({ devices: (results || []).map((row) => ({ id: row.subscription_id, label: row.label || 'Test device', platform: row.platform, updatedAt: row.updated_at })) });
      }
      if (sub === '/automations') {
        if (role !== 'owner') return json({ error: 'Only the owner can edit automatic alerts.' }, 403);
        return json({ automations: await loadAutomations(db), sampleVars: SAMPLE_VARS });
      }
      return json({ error: 'Not found.' }, 404);
    }

    if (method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST' });
    if ((request.headers.get('origin') || url.origin) !== url.origin) return json({ error: 'Request origin rejected.' }, 403);
    const input = await readJson(request, 16384);

    if (sub === '/' || sub === '/send' || sub === '/test') {
      const action = sub === '/test' || input.action === 'test' ? 'test' : 'send';
      const campaign = readCampaignInput(input, role);
      if (action === 'test') {
        campaign.kind = 'test'; campaign.scheduleAt = '';
        let ids = await testDeviceIds(db);
        const pasted = String(input.subscriptionId || '').trim();
        if (pasted) ids = [pasted];
        if (!ids.length) return json({ error: 'No test device yet. Press "Turn on alerts on this device" in the studio, then test again.', code: 'no-test-device' }, 400);
        try {
          const sent = await sendPush(env, { ...campaign, topic: 'all' }, { subscriptionIds: ids });
          await saveCampaign(db, campaign, sent, null, 'test');
          return json({ ok: true, id: sent.id, devices: ids.length });
        } catch (error) {
          await saveCampaign(db, campaign, null, error.message, 'failed').catch(() => {});
          return json({ error: error.message }, error instanceof PushError && error.status >= 400 && error.status < 600 ? (error.status || 502) : 502);
        }
      }
      const recent = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
      const duplicate = await db.prepare("SELECT id FROM notification_campaigns WHERE title = ?1 AND message = ?2 AND topic = ?3 AND kind = 'manual' AND status IN ('sent','scheduled') AND created_at > ?4 LIMIT 1").bind(campaign.title, campaign.message, campaign.topic, recent).first();
      if (duplicate && !input.confirmDuplicate) return json({ error: 'This exact message was sent in the last 10 minutes. Send it again only if you are sure.', code: 'duplicate' }, 409);
      if (role === 'staff') {
        const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
        const count = await db.prepare("SELECT COUNT(*) AS n FROM notification_campaigns WHERE kind = 'manual' AND created_by = 'staff' AND created_at > ?1").bind(hourAgo).first();
        if (Number(count?.n || 0) >= STAFF_SENDS_PER_HOUR) return json({ error: `Staff accounts can send ${STAFF_SENDS_PER_HOUR} alerts per hour. Ask the owner to send this one.`, code: 'staff-limit' }, 429);
      }
      try {
        const sent = await sendPush(env, campaign, {});
        await saveCampaign(db, campaign, sent, null);
        return json({ ok: true, id: sent.id, scheduled: Boolean(campaign.scheduleAt), estimate: await audienceEstimate(db, campaign.topic) });
      } catch (error) {
        await saveCampaign(db, campaign, null, error.message).catch(() => {});
        return json({ error: error.message }, 502);
      }
    }

    if (sub === '/cancel') {
      const row = await db.prepare("SELECT id, onesignal_id, status FROM notification_campaigns WHERE id = ?1").bind(String(input.id || '')).first();
      if (!row || row.status !== 'scheduled' || !row.onesignal_id) return json({ error: 'Only scheduled alerts can be cancelled.' }, 400);
      const { ok, status } = await oneSignal(env, 'DELETE', '/notifications/' + encodeURIComponent(row.onesignal_id), { query: { app_id: ONESIGNAL_APP_ID } });
      if (!ok && status !== 404) return json({ error: explainSendError(status, '') }, 502);
      await db.prepare("UPDATE notification_campaigns SET status = 'cancelled' WHERE id = ?1").bind(row.id).run();
      return json({ ok: true });
    }

    if (sub === '/refresh-stats') {
      const { results } = await db.prepare("SELECT id, onesignal_id, status FROM notification_campaigns WHERE onesignal_id IS NOT NULL AND status IN ('sent','scheduled','test') ORDER BY created_at DESC LIMIT 12").all();
      let updated = 0;
      await Promise.all((results || []).map(async (row) => {
        try {
          const { ok, data } = await oneSignal(env, 'GET', '/notifications/' + encodeURIComponent(row.onesignal_id), { query: { app_id: ONESIGNAL_APP_ID } });
          if (!ok) return;
          const stats = { delivered: Number(data.successful || 0), failed: Number(data.failed || 0) + Number(data.errored || 0), clicked: Number(data.converted || 0), remaining: Number(data.remaining || 0) };
          const nextStatus = data.canceled ? 'cancelled' : (row.status === 'scheduled' && data.completed_at ? 'sent' : row.status);
          await db.prepare('UPDATE notification_campaigns SET stats_json = ?1, stats_at = ?2, status = ?3, recipients = ?4 WHERE id = ?5').bind(JSON.stringify(stats), nowIso(), nextStatus, stats.delivered + stats.failed, row.id).run();
          updated += 1;
        } catch { /* one campaign failing must not block the rest */ }
      }));
      return json({ ok: true, updated });
    }

    if (sub === '/register-device') {
      const id = String(input.subscriptionId || '').trim().toLowerCase();
      if (!isSubscriptionId(id)) return json({ error: 'That device could not be registered.' }, 400);
      const stamp = nowIso();
      const platform = platformFromUserAgent(request.headers.get('user-agent'));
      await db.prepare(`INSERT INTO push_subscribers (subscription_id, topics, locale, platform, source, opted_in, is_test, label, created_at, updated_at, last_seen_at)
        VALUES (?1, 0, 'en', ?2, 'studio', 1, 1, ?3, ?4, ?4, ?4)
        ON CONFLICT(subscription_id) DO UPDATE SET is_test = 1, opted_in = 1, label = excluded.label, updated_at = excluded.updated_at, last_seen_at = excluded.last_seen_at`)
        .bind(id, platform, String(input.label || `${role === 'owner' ? 'Owner' : 'Staff'} ${platform}`).slice(0, 60), stamp).run();
      return json({ ok: true });
    }
    if (sub === '/remove-device') {
      await db.prepare('DELETE FROM push_subscribers WHERE subscription_id = ?1 AND is_test = 1').bind(String(input.id || '').toLowerCase()).run();
      return json({ ok: true });
    }

    if (sub === '/automations') {
      if (role !== 'owner') return json({ error: 'Only the owner can edit automatic alerts.' }, 403);
      await saveAutomation(db, input, role);
      return json({ ok: true, automations: await loadAutomations(db) });
    }
    if (sub === '/automations/test') {
      const auto = (await loadAutomations(db)).find((item) => item.key === String(input.key || ''));
      if (!auto) return json({ error: 'Unknown automation.' }, 400);
      const ids = await testDeviceIds(db);
      if (!ids.length) return json({ error: 'No test device yet. Press "Turn on alerts on this device" in the studio first.', code: 'no-test-device' }, 400);
      const campaign = automationCampaign(auto, SAMPLE_VARS, null, {});
      campaign.kind = 'test'; campaign.label = 'Test: ' + auto.label; campaign.createdBy = role;
      try {
        const sent = await sendPush(env, { ...campaign, topic: 'all' }, { subscriptionIds: ids });
        await saveCampaign(db, campaign, sent, null, 'test');
        return json({ ok: true, devices: ids.length });
      } catch (error) { return json({ error: error.message }, 502); }
    }
    if (sub === '/settings') {
      if (role !== 'owner') return json({ error: 'Only the owner can change opt-in settings.' }, 403);
      const next = { ...(await loadSettings(db)) };
      for (const key of ['promptEnabled', 'bellEnabled', 'redeemCardEnabled', 'welcomeEnabled']) if (typeof input[key] === 'boolean') next[key] = input[key];
      if (Number.isFinite(Number(input.delaySeconds))) next.delaySeconds = Math.min(120, Math.max(3, Math.round(Number(input.delaySeconds))));
      if (Number.isFinite(Number(input.minPageViews))) next.minPageViews = Math.min(6, Math.max(1, Math.round(Number(input.minPageViews))));
      await db.prepare("INSERT INTO push_settings (key, value, updated_at) VALUES ('prompt', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(JSON.stringify(next), nowIso()).run();
      return json({ ok: true, settings: next });
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (error instanceof PushError) return json({ error: error.message }, error.status || 400);
    console.error('[PUSH_STUDIO]', error?.message);
    return json({ error: error?.message || 'The studio hit a problem. Try again.' }, 500);
  }
}
