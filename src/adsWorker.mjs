// Ads engine for the Worker: schema, public config, event counters, advertiser inquiries,
// sponsor reports, the admin API and the hourly learning job.
//
// Public:  GET /api/ads/config   POST /api/ads/event   POST /api/ads/inquiry   GET /api/ads/report?t=TOKEN
// Admin:   /api/ads-studio/*     (owner session only)
import {
  AdsError, ACCENTS, EVENTS, KINDS, STATUSES, PUSH_TOPICS, LIMITS,
  validateCreative, normalizeSettings, defaultSettings, publicCreative, publicSettings,
  learnedMultiplier, blockers, timeLeftText, copyProblem, cleanUrl
} from './lib/adsCore.js';
import { SLOT_IDS, PAGE_TYPES } from './config/adSlots.js';
import { effectiveStatus } from './lib/giveawayPublic.js';
import { money } from './data/giveawayConfig.js';
import { publicPayload } from './lib/redeem.js';

const nowIso = () => new Date().toISOString();
const dayOf = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);
const ID_PATTERN = /^[a-z0-9_-]{3,40}$/;
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|monitor|uptime/i;

/* ------------------------------------------------------------------ */
/* Schema and starter ads                                              */
/* ------------------------------------------------------------------ */

let schemaPromise = null;

export function ensureAdsSchema(db) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const run = (sql) => db.prepare(sql).run();
      await run(`CREATE TABLE IF NOT EXISTS ads_creatives (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL, name TEXT NOT NULL,
        headline TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', cta TEXT NOT NULL, badge TEXT NOT NULL DEFAULT '',
        sponsor_name TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
        accent TEXT NOT NULL DEFAULT 'cyan', action TEXT NOT NULL DEFAULT '{}', slots TEXT NOT NULL DEFAULT '[]',
        targeting TEXT NOT NULL DEFAULT '{}', caps TEXT NOT NULL DEFAULT '{}', weight INTEGER NOT NULL DEFAULT 100,
        learned REAL NOT NULL DEFAULT 1, starts_at TEXT, ends_at TEXT, note TEXT NOT NULL DEFAULT '',
        report_token TEXT, inquiry_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      await run('CREATE INDEX IF NOT EXISTS idx_ads_creatives_status ON ads_creatives(status)');
      await run(`CREATE TABLE IF NOT EXISTS ads_stats (
        day TEXT NOT NULL, creative_id TEXT NOT NULL, slot TEXT NOT NULL, page_type TEXT NOT NULL, event TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, creative_id, slot, page_type, event))`);
      await run('CREATE INDEX IF NOT EXISTS idx_ads_stats_creative ON ads_stats(creative_id, day)');
      await run('CREATE TABLE IF NOT EXISTS ads_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
      await run('CREATE TABLE IF NOT EXISTS ads_rate (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)');
      await run(`CREATE TABLE IF NOT EXISTS ads_inquiries (
        id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'new', brand TEXT NOT NULL, contact_name TEXT NOT NULL DEFAULT '',
        contact_method TEXT NOT NULL, contact_value TEXT NOT NULL, website TEXT NOT NULL DEFAULT '', category TEXT NOT NULL,
        message TEXT NOT NULL, budget TEXT NOT NULL DEFAULT '', start_pref TEXT NOT NULL DEFAULT '', owner_note TEXT NOT NULL DEFAULT '',
        creative_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      await run('CREATE INDEX IF NOT EXISTS idx_ads_inquiries_status ON ads_inquiries(status, created_at)');
      await seedStarterAds(db);
    })().catch((error) => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

const STARTERS = [
  {
    name: 'Redeem alerts, version A', status: 'active', kind: 'house', accent: 'gold', weight: 100,
    headline: 'New redeem codes, the moment they drop',
    body: 'Turn on redeem alerts and your phone tells you when a code goes live or is about to expire. No account needed.',
    cta: 'Turn on alerts', action: { type: 'push', topic: 'redeem_codes' },
    targeting: { hideIfPush: true, pathsExclude: ['/redeem-codes'] }
  },
  {
    name: 'Redeem alerts, version B', status: 'active', kind: 'house', accent: 'cyan', weight: 100,
    headline: 'Codes expire fast. Get told before they do.',
    body: 'Redeem alerts ping you when a new code lands and again when one is about to run out. It takes one tap.',
    cta: 'Alert me', action: { type: 'push', topic: 'redeem_codes' },
    targeting: { hideIfPush: true, pathsExclude: ['/redeem-codes'] }
  },
  {
    name: 'Live code count', status: 'active', kind: 'house', accent: 'green', weight: 80,
    headline: '{codes.active} redeem codes working right now',
    body: 'Copy them from the live list, then turn on alerts so you see the next one first.',
    cta: 'See the codes', url: '/redeem-codes/', action: { type: 'link' },
    targeting: { needs: 'codes', pathsExclude: ['/redeem-codes'] }
  },
  {
    name: 'Giveaway live', status: 'active', kind: 'house', accent: 'gold', weight: 120,
    headline: 'Giveaway live: {giveaway.title}',
    body: 'Prize: {giveaway.prize}. {giveaway.timeLeft}. Read the rules on the giveaway page before you enter.',
    cta: 'See the giveaway', url: '/giveaways/', action: { type: 'link' },
    targeting: { needs: 'giveaway' }
  },
  {
    name: 'Giveaway alerts', status: 'active', kind: 'house', accent: 'violet', weight: 70,
    headline: 'Hear about giveaways first',
    body: 'One alert when a giveaway opens and one when the winner is announced. Nothing else.',
    cta: 'Turn on giveaway alerts', action: { type: 'push', topic: 'giveaways' },
    targeting: { hideIfPush: true }
  },
  {
    name: 'Advertise here', status: 'active', kind: 'house', accent: 'violet', weight: 30,
    badge: 'This space is open',
    headline: 'Advertise on FC Mobile Tools',
    body: 'Reach FC Mobile players while they check codes, events and guides. Simple placements and honest numbers.',
    cta: 'See how it works', url: '/advertise/', action: { type: 'link' },
    slots: ['page-end', 'list-mid', 'article-end'], targeting: {}
  },
  {
    name: 'Redeem alerts, Bahasa Indonesia', status: 'active', kind: 'house', accent: 'gold', weight: 100,
    headline: 'Kode redeem baru, begitu rilis',
    body: 'Aktifkan notifikasi kode redeem. Ponsel Anda memberi tahu saat kode baru aktif atau hampir kedaluwarsa. Tanpa akun.',
    cta: 'Aktifkan notifikasi', action: { type: 'push', topic: 'redeem_codes' },
    targeting: { hideIfPush: true, locales: ['id'], pathsExclude: ['/redeem-codes'] }
  },
  {
    name: 'Redeem alerts, Portugues (BR)', status: 'active', kind: 'house', accent: 'gold', weight: 100,
    headline: 'Códigos novos assim que saem',
    body: 'Ative os alertas de códigos e seu celular avisa quando um código sai ou está perto de expirar. Sem precisar de conta.',
    cta: 'Ativar alertas', action: { type: 'push', topic: 'redeem_codes' },
    targeting: { hideIfPush: true, locales: ['pt-BR'], pathsExclude: ['/redeem-codes'] }
  },
  {
    name: 'Redeem alerts, Bangla', status: 'active', kind: 'house', accent: 'gold', weight: 100,
    headline: 'নতুন রিডিম কোড আসামাত্রই জানুন',
    body: 'রিডিম কোডের অ্যালার্ট চালু করুন। নতুন কোড এলে বা কোড শেষ হওয়ার আগে আপনার ফোনে জানানো হবে। অ্যাকাউন্ট লাগবে না।',
    cta: 'অ্যালার্ট চালু করুন', action: { type: 'push', topic: 'redeem_codes' },
    targeting: { hideIfPush: true, locales: ['bn'], pathsExclude: ['/redeem-codes'] }
  },
  {
    name: 'Premium', status: 'draft', kind: 'house', accent: 'gold', weight: 60,
    headline: 'Premium is on the way',
    body: 'Tell us what you would want from a premium plan and be first in line when it opens.',
    cta: 'Find out more', url: '/premium/', action: { type: 'link' },
    note: 'Draft. Point the link at your real premium page, then switch this ad on.', targeting: {}
  }
];

async function seedStarterAds(db) {
  const done = await db.prepare("SELECT value FROM ads_settings WHERE key = 'seeded'").first();
  if (done) return;
  const count = await db.prepare('SELECT COUNT(*) AS n FROM ads_creatives').first();
  if (!count?.n) {
    for (const item of STARTERS) {
      const targeting = { ...(item.targeting || {}) };
      if (!targeting.locales) targeting.locales = ['en'];
      await insertCreative(db, validateCreative({ ...item, targeting }));
    }
  }
  await db.prepare("INSERT OR REPLACE INTO ads_settings (key, value, updated_at) VALUES ('seeded', '1', ?1)").bind(nowIso()).run();
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

const newId = (prefix = 'ad') => prefix + '_' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const newToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const parse = (text, fallback) => { try { return JSON.parse(text); } catch { return fallback; } };

function rowToCreative(row, { admin = false } = {}) {
  const out = {
    id: row.id, kind: row.kind, status: row.status, name: row.name, headline: row.headline, body: row.body, cta: row.cta,
    badge: row.badge, sponsorName: row.sponsor_name, url: row.url, imageUrl: row.image_url, accent: row.accent,
    action: parse(row.action, { type: 'link' }), slots: parse(row.slots, []), targeting: parse(row.targeting, {}),
    caps: parse(row.caps, {}), weight: row.weight, learned: row.learned, startsAt: row.starts_at, endsAt: row.ends_at,
    note: row.note, inquiryId: row.inquiry_id, createdAt: row.created_at, updatedAt: row.updated_at
  };
  if (admin) out.reportToken = row.report_token || '';
  return out;
}

async function insertCreative(db, c, extra = {}) {
  const id = extra.id || newId();
  const stamp = nowIso();
  await db.prepare(`INSERT INTO ads_creatives (id, kind, status, name, headline, body, cta, badge, sponsor_name, url, image_url, accent,
      action, slots, targeting, caps, weight, learned, starts_at, ends_at, note, report_token, inquiry_id, created_at, updated_at)
    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,1,?18,?19,?20,?21,?22,?23,?23)`)
    .bind(id, c.kind, c.status, c.name, c.headline, c.body, c.cta, c.badge, c.sponsorName, c.url, c.imageUrl, c.accent,
      JSON.stringify(c.action), JSON.stringify(c.slots), JSON.stringify(c.targeting), JSON.stringify(c.caps), c.weight,
      c.startsAt, c.endsAt, c.note, c.kind === 'sponsor' ? newToken() : null, extra.inquiryId || null, stamp).run();
  return id;
}

async function updateCreative(db, id, c) {
  const result = await db.prepare(`UPDATE ads_creatives SET kind=?2, status=?3, name=?4, headline=?5, body=?6, cta=?7, badge=?8,
      sponsor_name=?9, url=?10, image_url=?11, accent=?12, action=?13, slots=?14, targeting=?15, caps=?16, weight=?17,
      starts_at=?18, ends_at=?19, note=?20, updated_at=?21,
      report_token = CASE WHEN ?2 = 'sponsor' AND report_token IS NULL THEN ?22 ELSE report_token END
    WHERE id = ?1`)
    .bind(id, c.kind, c.status, c.name, c.headline, c.body, c.cta, c.badge, c.sponsorName, c.url, c.imageUrl, c.accent,
      JSON.stringify(c.action), JSON.stringify(c.slots), JSON.stringify(c.targeting), JSON.stringify(c.caps), c.weight,
      c.startsAt, c.endsAt, c.note, nowIso(), newToken()).run();
  return Boolean(result.meta?.changes);
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

async function loadSettings(db) {
  const row = await db.prepare("SELECT value FROM ads_settings WHERE key = 'engine'").first();
  try { return normalizeSettings(row ? JSON.parse(row.value) : defaultSettings()); } catch { return defaultSettings(); }
}

async function saveSettings(db, input) {
  const settings = normalizeSettings(input);
  await db.prepare("INSERT INTO ads_settings (key, value, updated_at) VALUES ('engine', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(JSON.stringify(settings), nowIso()).run();
  return settings;
}

/* ------------------------------------------------------------------ */
/* Live facts for the ad text                                          */
/* ------------------------------------------------------------------ */

async function liveFacts(env, db, supabaseRest) {
  const live = {};
  try {
    const codes = await publicPayload(db);
    live.codes = { active: codes.stats.active, expiringSoon: codes.stats.expiringSoon };
  } catch { /* the ad that needs this simply does not run */ }
  if (supabaseRest) {
    try {
      const rows = await supabaseRest(env, 'giveaways?status=eq.live&select=slug,title,prize_label,prize_cents,currency,starts_at,ends_at,status&order=ends_at.asc&limit=5');
      const row = (rows || []).find((r) => effectiveStatus(r) === 'live');
      if (row) {
        const prize = Number(row.prize_cents || 0) > 0 ? money(row.prize_cents, row.currency) : String(row.prize_label || 'In-game reward').split(' · ')[0];
        const plain = (text) => String(text || '').replace(/\u2014/g, '-');
        live.giveaway = {
          title: plain(row.title).slice(0, 60), prize: plain(prize),
          timeLeft: row.ends_at ? (timeLeftText(row.ends_at) || 'Ending soon') : 'Open now'
        };
      }
    } catch { /* same */ }
  }
  return live;
}

/* ------------------------------------------------------------------ */
/* Public config                                                       */
/* ------------------------------------------------------------------ */

async function buildPublicConfig(env, db, supabaseRest) {
  const [settings, rows, live] = await Promise.all([
    loadSettings(db),
    db.prepare("SELECT * FROM ads_creatives WHERE status = 'active' ORDER BY created_at LIMIT 120").all(),
    liveFacts(env, db, supabaseRest)
  ]);
  const creatives = (rows.results || []).map((row) => rowToCreative(row));
  const capped = creatives.filter((c) => c.caps?.dailyImpressions || c.caps?.totalImpressions).map((c) => c.id);
  const today = {}; const total = {};
  if (capped.length) {
    const withDay = capped.map((_, i) => '?' + (i + 2)).join(',');
    const idsOnly = capped.map((_, i) => '?' + (i + 1)).join(',');
    const [t, a] = await Promise.all([
      db.prepare(`SELECT creative_id, SUM(count) AS n FROM ads_stats WHERE event = 'view' AND day = ?1 AND creative_id IN (${withDay}) GROUP BY creative_id`).bind(dayOf(), ...capped).all(),
      db.prepare(`SELECT creative_id, SUM(count) AS n FROM ads_stats WHERE event = 'view' AND creative_id IN (${idsOnly}) GROUP BY creative_id`).bind(...capped).all()
    ]);
    for (const r of t.results || []) today[r.creative_id] = r.n;
    for (const r of a.results || []) total[r.creative_id] = r.n;
  }
  const now = Date.now();
  const list = creatives
    .map((c) => publicCreative({ ...c, todayViews: today[c.id] || 0, totalViews: total[c.id] || 0 }, live, now))
    .filter(Boolean);
  return { v: 1, generatedAt: nowIso(), settings: publicSettings(settings), creatives: list };
}

async function cachedConfig(env, db, ctx, url, supabaseRest) {
  const key = new Request(url.origin + '/api/ads/config', { method: 'GET' });
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }
  const body = await buildPublicConfig(env, db, supabaseRest);
  const response = new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' }
  });
  if (cache) {
    const put = cache.put(key, response.clone());
    if (ctx?.waitUntil) ctx.waitUntil(put); else await put;
  }
  return response;
}

async function dropConfigCache(url) {
  try { await caches.default.delete(new Request(url.origin + '/api/ads/config', { method: 'GET' })); } catch { /* best effort */ }
}

/* ------------------------------------------------------------------ */
/* Rate limit                                                          */
/* ------------------------------------------------------------------ */

async function bucketFor(request, label) {
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ads:' + label + ':' + ip));
  return label + ':' + Array.from(new Uint8Array(bytes).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function underRateLimit(db, bucket, limit, windowSeconds) {
  const now = Date.now();
  const row = await db.prepare('SELECT count, window_start FROM ads_rate WHERE bucket = ?1').bind(bucket).first();
  if (!row || now - row.window_start > windowSeconds * 1000) {
    await db.prepare('INSERT INTO ads_rate (bucket, count, window_start) VALUES (?1, 1, ?2) ON CONFLICT(bucket) DO UPDATE SET count = 1, window_start = ?2').bind(bucket, now).run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare('UPDATE ads_rate SET count = count + 1 WHERE bucket = ?1').bind(bucket).run();
  return true;
}

async function readJson(request, max = 8192) {
  const text = await request.text();
  if (text.length > max) throw new AdsError('That request is too large.', 413);
  try { return text ? JSON.parse(text) : {}; } catch { throw new AdsError('Send valid JSON.'); }
}

/* ------------------------------------------------------------------ */
/* Advertiser inquiries                                                */
/* ------------------------------------------------------------------ */

export const INQUIRY_CATEGORIES = ['creator', 'community', 'app-or-tool', 'merch', 'esports', 'other'];
const CONTACT_METHODS = ['discord', 'email', 'instagram', 'youtube', 'other'];

function cleanInquiry(body) {
  const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const brand = text(body.brand, 80);
  const contactValue = text(body.contactValue, 120);
  const message = text(body.message, 1200);
  if (!brand) throw new AdsError('Tell us the name of your brand or channel.');
  if (!contactValue) throw new AdsError('Add a way for us to reach you.');
  if (message.length < 20) throw new AdsError('Write a few lines about what you want to promote.');
  const contactMethod = CONTACT_METHODS.includes(body.contactMethod) ? body.contactMethod : 'other';
  if (contactMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)) throw new AdsError('That email address does not look right.');
  let website = text(body.website, 300);
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = 'https://' + website;
    website = cleanUrl(website.replace(/^http:\/\//i, 'https://'), 'Website');
  }
  return {
    brand, contactValue, contactMethod, website, message,
    contactName: text(body.contactName, 80),
    category: INQUIRY_CATEGORIES.includes(body.category) ? body.category : 'other',
    budget: text(body.budget, 40),
    startPref: text(body.startPref, 40)
  };
}

/* ------------------------------------------------------------------ */
/* Public route                                                        */
/* ------------------------------------------------------------------ */

export async function adsPublicRoute({ request, env, url, ctx, json, d1, supabaseRest }) {
  const sub = url.pathname.replace(/^\/api\/ads/, '').replace(/\/$/, '') || '/';
  const db = await d1(env);
  await ensureAdsSchema(db);
  try {
    if (sub === '/config' && request.method === 'GET') return await cachedConfig(env, db, ctx, url, supabaseRest);

    if (sub === '/report' && request.method === 'GET') {
      const token = String(url.searchParams.get('t') || '');
      if (token.length < 16 || token.length > 64) return json({ error: 'Report not found.' }, 404);
      const row = await db.prepare("SELECT * FROM ads_creatives WHERE report_token = ?1 AND kind = 'sponsor'").bind(token).first();
      if (!row) return json({ error: 'Report not found.' }, 404);
      const since = dayOf(Date.now() - 89 * 86400000);
      const { results } = await db.prepare("SELECT day, event, SUM(count) AS n FROM ads_stats WHERE creative_id = ?1 AND day >= ?2 AND event IN ('view','click','dismiss') GROUP BY day, event ORDER BY day").bind(row.id, since).all();
      const days = new Map();
      for (const r of results || []) {
        const d = days.get(r.day) || { day: r.day, views: 0, clicks: 0, dismissals: 0 };
        if (r.event === 'view') d.views = r.n; else if (r.event === 'click') d.clicks = r.n; else d.dismissals = r.n;
        days.set(r.day, d);
      }
      const series = [...days.values()];
      const views = series.reduce((s, d) => s + d.views, 0);
      const clicks = series.reduce((s, d) => s + d.clicks, 0);
      return json({
        campaign: { name: row.sponsor_name || row.name, headline: row.headline, status: row.status, startsAt: row.starts_at, endsAt: row.ends_at },
        totals: { views, clicks, ctr: views ? clicks / views : 0 }, days: series, generatedAt: nowIso()
      }, 200, { 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST' });
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'Request origin rejected.' }, 403);

    if (sub === '/event') {
      if (BOT.test(request.headers.get('user-agent') || '')) return new Response(null, { status: 204 });
      if (!(await underRateLimit(db, await bucketFor(request, 'ev'), 400, 3600))) return new Response(null, { status: 204 });
      const body = await readJson(request, 4096);
      const list = (Array.isArray(body.e) ? body.e : []).slice(0, 12);
      const clean = [];
      for (const item of list) {
        const id = String(item.c || '');
        const slot = String(item.s || '');
        const page = String(item.p || '');
        const event = String(item.t || '');
        if (!(ID_PATTERN.test(id) || id === 'adsense') || !SLOT_IDS.includes(slot) || !PAGE_TYPES.includes(page) || !EVENTS.includes(event)) continue;
        clean.push({ id, slot, page, event });
      }
      if (!clean.length) return new Response(null, { status: 204 });
      const ids = [...new Set(clean.filter((x) => x.id !== 'adsense').map((x) => x.id))];
      let known = new Set(['adsense']);
      if (ids.length) {
        const marks = ids.map((_, i) => '?' + (i + 1)).join(',');
        const rows = await db.prepare(`SELECT id FROM ads_creatives WHERE id IN (${marks})`).bind(...ids).all();
        known = new Set([...known, ...(rows.results || []).map((r) => r.id)]);
      }
      const day = dayOf();
      const statements = clean.filter((x) => known.has(x.id)).map((x) => db.prepare(
        'INSERT INTO ads_stats (day, creative_id, slot, page_type, event, count) VALUES (?1,?2,?3,?4,?5,1) ON CONFLICT(day, creative_id, slot, page_type, event) DO UPDATE SET count = count + 1'
      ).bind(day, x.id, x.slot, x.page, x.event));
      if (statements.length) await db.batch(statements);
      return new Response(null, { status: 204 });
    }

    if (sub === '/inquiry') {
      const body = await readJson(request, 6000);
      // A hidden field and a minimum fill time catch most form bots. They get a normal looking reply.
      if (String(body.company_site || '').trim() || Number(body.elapsed) < 2500) return json({ ok: true, ref: 'received' });
      if (!(await underRateLimit(db, await bucketFor(request, 'inq'), 3, 3600))) return json({ error: 'You have sent a few already. Please try again in an hour.' }, 429);
      const input = cleanInquiry(body);
      const id = newId('inq');
      const stamp = nowIso();
      await db.prepare(`INSERT INTO ads_inquiries (id, brand, contact_name, contact_method, contact_value, website, category, message, budget, start_pref, created_at, updated_at)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)`)
        .bind(id, input.brand, input.contactName, input.contactMethod, input.contactValue, input.website, input.category, input.message, input.budget, input.startPref, stamp).run();
      return json({ ok: true, ref: id.slice(-6).toUpperCase() });
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (error instanceof AdsError) return json({ error: error.message }, error.status);
    console.error('[ADS_PUBLIC]', error?.message || error);
    return json({ error: 'Something went wrong. Try again in a moment.' }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* Admin route                                                         */
/* ------------------------------------------------------------------ */

async function statsFor(db, days) {
  const since = dayOf(Date.now() - (days - 1) * 86400000);
  const [daily, byCreative, bySlot, byPage, total] = await Promise.all([
    db.prepare("SELECT day, event, SUM(count) AS n FROM ads_stats WHERE day >= ?1 AND event IN ('view','click') GROUP BY day, event ORDER BY day").bind(since).all(),
    db.prepare('SELECT creative_id, event, SUM(count) AS n FROM ads_stats WHERE day >= ?1 GROUP BY creative_id, event').bind(since).all(),
    db.prepare('SELECT slot, event, SUM(count) AS n FROM ads_stats WHERE day >= ?1 GROUP BY slot, event').bind(since).all(),
    db.prepare('SELECT page_type, event, SUM(count) AS n FROM ads_stats WHERE day >= ?1 GROUP BY page_type, event').bind(since).all(),
    db.prepare('SELECT event, SUM(count) AS n FROM ads_stats WHERE day >= ?1 GROUP BY event').bind(since).all()
  ]);
  const fold = (rows, key) => {
    const map = new Map();
    for (const r of rows.results || []) {
      const entry = map.get(r[key]) || { key: r[key], view: 0, click: 0, dismiss: 0, conv: 0, nreq: 0, nfill: 0, nempty: 0 };
      entry[r.event] = r.n;
      map.set(r[key], entry);
    }
    return [...map.values()];
  };
  const dayMap = new Map();
  for (let i = days - 1; i >= 0; i -= 1) dayMap.set(dayOf(Date.now() - i * 86400000), { day: dayOf(Date.now() - i * 86400000), views: 0, clicks: 0 });
  for (const r of daily.results || []) {
    const d = dayMap.get(r.day);
    if (d) { if (r.event === 'view') d.views = r.n; else d.clicks = r.n; }
  }
  const totals = Object.fromEntries((total.results || []).map((r) => [r.event, r.n]));
  return { days: [...dayMap.values()], byCreative: fold(byCreative, 'creative_id'), bySlot: fold(bySlot, 'slot'), byPage: fold(byPage, 'page_type'), totals };
}

function insights({ stats, creatives, settings, inquiries }) {
  const out = [];
  const byId = new Map(creatives.map((c) => [c.id, c]));
  const ranked = stats.byCreative.filter((r) => r.key !== 'adsense' && r.view >= 100)
    .map((r) => ({ ...r, ctr: r.click / r.view })).sort((a, b) => b.ctr - a.ctr);
  if (ranked.length) {
    const best = ranked[0];
    out.push({ tone: 'good', text: (byId.get(best.key)?.name || best.key) + ' is your best ad so far: ' + (best.ctr * 100).toFixed(1) + '% of viewers clicked, from ' + best.view + ' views.' });
  }
  const weak = ranked.filter((r) => r.view >= 1000 && r.ctr < 0.001);
  for (const r of weak.slice(0, 2)) out.push({ tone: 'warn', text: (byId.get(r.key)?.name || r.key) + ' has ' + r.view + ' views and almost no clicks. Rewrite its headline or pause it.' });
  const silent = SLOT_IDS.filter((id) => settings.slots[id]?.enabled && !stats.bySlot.some((r) => r.key === id && r.view > 0));
  if (stats.totals.view > 200 && silent.length) out.push({ tone: 'info', text: 'No ad has run in ' + silent.join(', ') + ' during this period. The page may not have enough content for that slot, or no ad matches it.' });
  const soon = creatives.filter((c) => c.kind === 'sponsor' && c.status === 'active' && c.endsAt && Date.parse(c.endsAt) - Date.now() < 5 * 86400000 && Date.parse(c.endsAt) > Date.now());
  for (const c of soon) out.push({ tone: 'warn', text: 'Sponsor campaign ' + c.name + ' ends on ' + c.endsAt.slice(0, 10) + '. Send the report link and ask about renewing.' });
  const unread = inquiries.filter((i) => i.status === 'new').length;
  if (unread) out.push({ tone: 'info', text: unread + (unread === 1 ? ' advertiser is' : ' advertisers are') + ' waiting for a reply in the Advertisers tab.' });
  const convs = stats.byCreative.reduce((sum, r) => sum + (r.conv || 0), 0);
  if (convs) out.push({ tone: 'good', text: convs + ' people turned on alerts straight from an ad in this period.' });
  if (!settings.adsense.enabled) out.push({ tone: 'info', text: 'AdSense is off, so house ads and sponsors fill every slot. Switch it on in the AdSense tab after approval.' });
  return out;
}

export async function adsStudioRoute({ request, env, url, ctx, json, d1, authenticated, supabaseRest }) {
  if (!(await authenticated(request, env))) return json({ error: 'Owner sign in required.' }, 401);
  const sub = url.pathname.replace(/^\/api\/ads-studio/, '').replace(/\/$/, '') || '/';
  const method = request.method;
  const db = await d1(env);
  try {
    await ensureAdsSchema(db);
    if (method !== 'GET' && (request.headers.get('origin') || url.origin) !== url.origin) return json({ error: 'Request origin rejected.' }, 403);

    if (method === 'GET' && sub === '/overview') {
      const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days')) || 14));
      const [settings, rows, stats, inq, live] = await Promise.all([
        loadSettings(db),
        db.prepare('SELECT * FROM ads_creatives ORDER BY created_at DESC').all(),
        statsFor(db, days),
        db.prepare('SELECT * FROM ads_inquiries ORDER BY created_at DESC LIMIT 100').all(),
        liveFacts(env, db, supabaseRest)
      ]);
      const creatives = (rows.results || []).map((r) => rowToCreative(r, { admin: true }));
      const inquiries = (inq.results || []).map(inquiryView);
      const house = stats.byCreative.filter((r) => creatives.find((c) => c.id === r.key)?.kind === 'house');
      const sponsor = stats.byCreative.filter((r) => creatives.find((c) => c.id === r.key)?.kind === 'sponsor');
      const sum = (list, field) => list.reduce((s, r) => s + (r[field] || 0), 0);
      return json({
        days, settings, creatives, inquiries, live, stats,
        mix: { house: sum(house, 'view'), sponsor: sum(sponsor, 'view'), network: stats.totals.nfill || 0 },
        insights: insights({ stats, creatives, settings, inquiries }),
        slots: SLOT_IDS, accents: Object.keys(ACCENTS), topics: PUSH_TOPICS, limits: LIMITS
      });
    }

    if (method === 'GET' && sub === '/settings') return json({ settings: await loadSettings(db) });
    if (method === 'PUT' && sub === '/settings') {
      const settings = await saveSettings(db, await readJson(request, 12000));
      await dropConfigCache(url);
      return json({ ok: true, settings });
    }

    if (sub === '/creatives' && method === 'POST') {
      const body = await readJson(request, 8000);
      const id = await insertCreative(db, validateCreative(body));
      await dropConfigCache(url);
      return json({ ok: true, id }, 201);
    }
    const match = sub.match(/^\/creatives\/([a-z0-9_-]{3,40})(?:\/(status|duplicate))?$/);
    if (match) {
      const id = match[1];
      const row = await db.prepare('SELECT * FROM ads_creatives WHERE id = ?1').bind(id).first();
      if (!row) return json({ error: 'Ad not found.' }, 404);
      if (method === 'PUT' && !match[2]) {
        await updateCreative(db, id, validateCreative(await readJson(request, 8000)));
        await dropConfigCache(url);
        return json({ ok: true });
      }
      if (method === 'POST' && match[2] === 'status') {
        const body = await readJson(request, 400);
        if (!STATUSES.includes(body.status)) throw new AdsError('Choose a valid status.');
        await db.prepare('UPDATE ads_creatives SET status = ?2, updated_at = ?3 WHERE id = ?1').bind(id, body.status, nowIso()).run();
        await dropConfigCache(url);
        return json({ ok: true });
      }
      if (method === 'POST' && match[2] === 'duplicate') {
        const source = rowToCreative(row);
        const copy = validateCreative({ ...source, name: (source.name + ' copy').slice(0, LIMITS.name), status: 'draft' });
        return json({ ok: true, id: await insertCreative(db, copy) }, 201);
      }
      if (method === 'DELETE' && !match[2]) {
        if (row.status === 'active') throw new AdsError('Pause the ad before deleting it.', 409);
        await db.prepare('DELETE FROM ads_creatives WHERE id = ?1').bind(id).run();
        await db.prepare('DELETE FROM ads_stats WHERE creative_id = ?1').bind(id).run();
        await dropConfigCache(url);
        return json({ ok: true });
      }
    }

    if (method === 'POST' && sub === '/explain') {
      const body = await readJson(request, 2000);
      const row = await db.prepare('SELECT * FROM ads_creatives WHERE id = ?1').bind(String(body.id || '')).first();
      if (!row) return json({ error: 'Ad not found.' }, 404);
      const settings = await loadSettings(db);
      const c = rowToCreative(row);
      const ctx2 = {
        slot: SLOT_IDS.includes(body.slot) ? body.slot : SLOT_IDS[0],
        pageType: PAGE_TYPES.includes(body.pageType) ? body.pageType : 'home',
        path: String(body.path || '/'), locale: String(body.locale || 'en'), device: body.device === 'mobile' ? 'mobile' : 'desktop',
        signedIn: body.signedIn === true, pushOn: body.pushOn === true, topics: body.pushOn ? { [c.action?.topic]: true } : {}, now: Date.now()
      };
      const reasons = blockers(c, ctx2, {}, settings);
      const live = await liveFacts(env, db, supabaseRest);
      const pub = publicCreative({ ...c }, live);
      if (!pub && c.status === 'active') reasons.push('Its text needs live data that is not available right now (for example no giveaway is running)');
      return json({ eligible: reasons.length === 0, reasons });
    }

    if (method === 'GET' && sub === '/inquiries') {
      const { results } = await db.prepare('SELECT * FROM ads_inquiries ORDER BY created_at DESC LIMIT 200').all();
      return json({ inquiries: (results || []).map(inquiryView) });
    }
    const inq = sub.match(/^\/inquiries\/(inq_[a-z0-9]{8})(?:\/(campaign))?$/);
    if (inq) {
      const row = await db.prepare('SELECT * FROM ads_inquiries WHERE id = ?1').bind(inq[1]).first();
      if (!row) return json({ error: 'Inquiry not found.' }, 404);
      if (method === 'POST' && !inq[2]) {
        const body = await readJson(request, 1500);
        const status = ['new', 'contacted', 'accepted', 'declined', 'spam'].includes(body.status) ? body.status : row.status;
        const note = String(body.note ?? row.owner_note).slice(0, 600);
        await db.prepare('UPDATE ads_inquiries SET status = ?2, owner_note = ?3, updated_at = ?4 WHERE id = ?1').bind(row.id, status, note, nowIso()).run();
        return json({ ok: true });
      }
      if (method === 'POST' && inq[2] === 'campaign') {
        const draft = validateCreative({
          kind: 'sponsor', status: 'draft', name: 'Sponsor: ' + row.brand, sponsorName: row.brand,
          headline: row.brand.slice(0, LIMITS.headline), body: '', cta: 'Visit', url: row.website || '/', action: { type: 'link' },
          note: 'From an advertiser inquiry. Write the real headline and text with them, add their link, then switch it on.'
        });
        const id = await insertCreative(db, draft, { inquiryId: row.id });
        await db.prepare("UPDATE ads_inquiries SET status = 'accepted', creative_id = ?2, updated_at = ?3 WHERE id = ?1").bind(row.id, id, nowIso()).run();
        return json({ ok: true, id }, 201);
      }
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (error instanceof AdsError) return json({ error: error.message }, error.status);
    console.error('[ADS_STUDIO]', error?.message || error);
    return json({ error: 'The ads studio hit a problem: ' + String(error?.message || 'unknown').slice(0, 160) }, 500);
  }
}

function inquiryView(r) {
  return {
    id: r.id, status: r.status, brand: r.brand, contactName: r.contact_name, contactMethod: r.contact_method, contactValue: r.contact_value,
    website: r.website, category: r.category, message: r.message, budget: r.budget, startPref: r.start_pref,
    ownerNote: r.owner_note, creativeId: r.creative_id, createdAt: r.created_at
  };
}

/* ------------------------------------------------------------------ */
/* Hourly job                                                          */
/* ------------------------------------------------------------------ */

export async function runAdsMaintenance(env, { db, now = new Date() } = {}) {
  await ensureAdsSchema(db);
  const stamp = now.toISOString();
  const ended = await db.prepare("UPDATE ads_creatives SET status = 'ended', updated_at = ?1 WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= ?1").bind(stamp).run();
  const since = dayOf(now.getTime() - 13 * 86400000);
  const { results } = await db.prepare("SELECT creative_id, event, SUM(count) AS n FROM ads_stats WHERE day >= ?1 AND event IN ('view','click') AND creative_id != 'adsense' GROUP BY creative_id, event").bind(since).all();
  const per = new Map();
  for (const r of results || []) {
    const e = per.get(r.creative_id) || { views: 0, clicks: 0 };
    if (r.event === 'view') e.views = r.n; else e.clicks = r.n;
    per.set(r.creative_id, e);
  }
  const totalViews = [...per.values()].reduce((s, e) => s + e.views, 0);
  const totalClicks = [...per.values()].reduce((s, e) => s + e.clicks, 0);
  const baseline = totalViews >= 500 ? Math.max(0.005, totalClicks / totalViews) : 0.02;
  const updates = [];
  for (const [id, e] of per) {
    updates.push(db.prepare('UPDATE ads_creatives SET learned = ?2 WHERE id = ?1').bind(id, learnedMultiplier(e, baseline)));
  }
  if (updates.length) await db.batch(updates);
  await db.prepare('DELETE FROM ads_stats WHERE day < ?1').bind(dayOf(now.getTime() - 400 * 86400000)).run();
  await db.prepare('DELETE FROM ads_rate WHERE window_start < ?1').bind(now.getTime() - 86400000).run();
  return { ended: ended.meta?.changes || 0, learned: updates.length, baseline: Math.round(baseline * 10000) / 10000 };
}

export { KINDS };
