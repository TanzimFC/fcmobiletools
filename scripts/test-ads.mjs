// Tests for the ads engine: shared rules, then the Worker routes on a real SQLite database.
import assert from 'node:assert/strict';
import {
  validateCreative, fillTokens, blockers, chooseCreative, learnedMultiplier, pageBudget, networkAllowed,
  normalizeSettings, defaultSettings, publicCreative, AdsError
} from '../src/lib/adsCore.js';
import { pageTypeFor, slotsForPageType } from '../src/config/adSlots.js';
import { adsPublicRoute, adsStudioRoute, runAdsMaintenance } from '../src/adsWorker.mjs';

let passed = 0;
const test = async (name, fn) => { await fn(); passed += 1; console.log('  ok  ' + name); };
const throwsAds = (fn, pattern) => assert.throws(fn, (e) => e instanceof AdsError && pattern.test(e.message));

const base = {
  name: 'Test', headline: 'A clear headline', body: 'Some text.', cta: 'Go', url: '/redeem-codes/',
  status: 'active', kind: 'house', action: { type: 'link' }
};

console.log('Shared rules');
await test('page types', () => {
  assert.equal(pageTypeFor('/'), 'home');
  assert.equal(pageTypeFor('/blog/some-post/'), 'article');
  assert.equal(pageTypeFor('/blog/category/news/'), 'list');
  assert.equal(pageTypeFor('/redeem-codes/'), 'list');
  assert.equal(pageTypeFor('/team-ovr'), 'tool');
  assert.equal(pageTypeFor('/player/playstyle-finder/'), 'tool');
  assert.equal(pageTypeFor('/player/playstyle/'), 'page');
  assert.equal(pageTypeFor('/leagues/'), 'list');
  assert.equal(pageTypeFor('/tournaments/'), 'page');
  assert.equal(pageTypeFor('/tournaments/samples/'), 'page');
  for (const p of ['/giveaways/x/', '/account', '/admin/', '/api/ads/config', '/fc-mobile-27/', '/unknown-page', '/advertise/', '/football-centre/rewards/', '/football-centre/settings/', '/football-centre/history/']) assert.equal(pageTypeFor(p), 'none', p);
  assert.ok(slotsForPageType('article').some((s) => s.id === 'article-mid'));
  assert.ok(slotsForPageType('page').some((s) => s.id === 'page-mid'));
  const sidebar = slotsForPageType('tool').find((s) => s.id === 'tool-sidebar');
  assert.ok(sidebar, 'tools have a desktop side-rail slot');
  assert.deepEqual(sidebar.devices, ['desktop']);
});
await test('copy rules reject em dashes, html, bad links, unknown tokens', () => {
  throwsAds(() => validateCreative({ ...base, headline: 'Big news \u2014 read it' }), /em dash/);
  throwsAds(() => validateCreative({ ...base, body: '<b>hi</b>' }), /HTML/);
  throwsAds(() => validateCreative({ ...base, url: 'javascript:alert(1)' }), /https/);
  throwsAds(() => validateCreative({ ...base, url: 'http://example.com' }), /https/);
  throwsAds(() => validateCreative({ ...base, imageUrl: 'https://evil.example/x.png' }), /Cloudinary/);
  throwsAds(() => validateCreative({ ...base, headline: 'Hello {user.name}' }), /unknown token/);
  throwsAds(() => validateCreative({ ...base, kind: 'sponsor' }), /Sponsor name/);
  throwsAds(() => validateCreative({ ...base, action: { type: 'push', topic: 'nope' } }), /alert topic/);
  throwsAds(() => validateCreative({ ...base, startsAt: '2026-11-02', endsAt: '2026-11-01' }), /after the start/);
  const ok = validateCreative({ ...base, headline: '{codes.active} codes live', kind: 'sponsor', sponsorName: 'Acme' });
  assert.equal(ok.badge, 'Sponsored');
});
await test('tokens fill or refuse', () => {
  assert.equal(fillTokens('{codes.active} live', { codes: { active: 4 } }), '4 live');
  assert.equal(fillTokens('{giveaway.title}', { codes: {} }), null);
  const row = { ...validateCreative({ ...base, headline: 'Giveaway: {giveaway.title}', targeting: { needs: 'giveaway' } }), id: 'ad_x' };
  assert.equal(publicCreative(row, {}), null);
  assert.equal(publicCreative(row, { giveaway: { title: 'Cup' } }).headline, 'Giveaway: Cup');
});

const ctx = { slot: 'page-end', pageType: 'list', path: '/events', locale: 'en', device: 'mobile', signedIn: false, pushOn: false, topics: {}, now: Date.now(), shownIds: [] };
const mk = (over = {}) => ({ ...validateCreative({ ...base, ...over }), id: over.id || 'ad_one', learned: 1 });
await test('eligibility explains itself', () => {
  assert.deepEqual(blockers(mk(), ctx, {}), []);
  assert.match(blockers(mk({ status: 'paused' }), ctx, {}).join(), /paused/);
  assert.match(blockers(mk({ targeting: { pageTypes: ['article'] } }), ctx, {}).join(), /list pages/);
  assert.match(blockers(mk({ targeting: { locales: ['id'] } }), ctx, {}).join(), /language/);
  assert.match(blockers(mk({ targeting: { pathsExclude: ['/events'] } }), ctx, {}).join(), /excluded/);
  assert.match(blockers(mk({ targeting: { hideIfSignedIn: true } }), { ...ctx, signedIn: true }, {}).join(), /signed in/);
  const push = mk({ action: { type: 'push', topic: 'redeem_codes' }, url: '' });
  assert.match(blockers(push, { ...ctx, pushOn: true, topics: { redeem_codes: true } }, {}).join(), /already/);
  assert.deepEqual(blockers(push, { ...ctx, pushOn: true, topics: { giveaways: true } }, {}), []);
  assert.match(blockers(mk(), ctx, { views: { ad_one: 3 } }).join(), /enough today/);
  assert.match(blockers(mk(), ctx, { clickedAt: { ad_one: Date.now() - 1000 } }).join(), /clicked/);
  assert.match(blockers(mk(), ctx, { dismissedAt: { ad_one: Date.now() - 1000 } }).join(), /hid/);
  assert.deepEqual(blockers(mk(), ctx, { dismissedAt: { ad_one: Date.now() - 9 * 86400000 } }), []);
  assert.match(blockers({ ...mk(), remaining: 0 }, ctx, {}).join(), /cap/);
  assert.match(blockers(mk({ startsAt: new Date(Date.now() + 86400000).toISOString() }), ctx, {}).join(), /dates/);
  assert.match(blockers(mk(), { ...ctx, shownIds: ['ad_one'] }, {}).join(), /Already shown/);
});
await test('sponsors outrank house ads and weights steer the pick', () => {
  const s = defaultSettings();
  const house = mk({ id: 'ad_house' });
  const sponsor = mk({ id: 'ad_spons', kind: 'sponsor', sponsorName: 'Acme' });
  for (let i = 0; i < 20; i += 1) assert.equal(chooseCreative([house, sponsor], ctx, {}, s).id, 'ad_spons');
  assert.equal(chooseCreative([], ctx, {}, s), null);
  const heavy = { ...mk({ id: 'ad_heavy', weight: 900 }), learned: 1 };
  const light = { ...mk({ id: 'ad_light', weight: 10 }), learned: 1 };
  let heavyWins = 0;
  for (let i = 0; i < 400; i += 1) if (chooseCreative([heavy, light], ctx, {}, { ...s, exploreRate: 0 }).id === 'ad_heavy') heavyWins += 1;
  assert.ok(heavyWins > 340, 'heavy won ' + heavyWins);
  const strong = { ...mk({ id: 'ad_strong', weight: 100 }), learned: 2 };
  const weak = { ...mk({ id: 'ad_weak', weight: 100 }), learned: 0.5 };
  let strongWins = 0;
  for (let i = 0; i < 400; i += 1) if (chooseCreative([strong, weak], ctx, {}, { ...s, exploreRate: 0 }).id === 'ad_strong') strongWins += 1;
  assert.ok(strongWins > 280, 'strong won ' + strongWins);
});
await test('learning needs evidence and stays bounded', () => {
  assert.equal(learnedMultiplier({ views: 50, clicks: 40 }), 1);
  assert.ok(learnedMultiplier({ views: 5000, clicks: 500 }, 0.02) <= 2);
  assert.ok(learnedMultiplier({ views: 5000, clicks: 0 }, 0.02) >= 0.5);
  assert.ok(learnedMultiplier({ views: 1000, clicks: 40 }, 0.02) > 1);
  assert.ok(learnedMultiplier({ views: 1000, clicks: 5 }, 0.02) < 1);
});
await test('page budget and network gate', () => {
  const s = defaultSettings();
  assert.equal(pageBudget(s, { pageType: 'list' }), 3);
  assert.equal(pageBudget(s, { pageType: 'article', words: 2000 }), 4);
  assert.equal(pageBudget({ ...s, enabled: false }, { pageType: 'list' }), 0);
  const migrated = normalizeSettings({ enabled: false, maxPerPage: 2, maxPerLongArticle: 3, adsense: { enabled: true } });
  assert.equal(migrated.enabled, true, 'the new sitewide promotion policy re-enables legacy-disabled ads');
  assert.equal(migrated.maxPerPage, 3);
  assert.equal(migrated.maxPerLongArticle, 4);
  assert.equal(migrated.policyVersion, 2);
  assert.equal(migrated.adsense.enabled, false, 'legacy third-party ads remain off during migration');
  const ownerTuned = normalizeSettings({ ...defaultSettings(), maxPerPage: 1, maxPerLongArticle: 2 });
  assert.equal(ownerTuned.maxPerPage, 1, 'post-migration settings remain owner-tunable');
  assert.equal(ownerTuned.maxPerLongArticle, 2);
  const on = normalizeSettings({ ...s, adsense: { enabled: true, publisherId: 'ca-pub-2527295119501596', share: 100 }, slots: { 'page-end': { enabled: true, unitId: '1234567890' } } });
  const gate = { slot: 'page-end', consent: true, words: 800, viewsThisSession: 2, adFree: false };
  assert.equal(networkAllowed(on, gate), true);
  assert.equal(networkAllowed(on, { ...gate, consent: false }), false);
  assert.equal(networkAllowed(on, { ...gate, words: 100 }), false);
  assert.equal(networkAllowed(on, { ...gate, viewsThisSession: 1 }), false);
  assert.equal(networkAllowed(on, { ...gate, slot: 'article-mid' }), false);
  assert.equal(networkAllowed(s, gate), false);
  assert.throws(() => normalizeSettings({ slots: { 'page-end': { unitId: 'abc' } } }), AdsError);
});

/* ---------------------------- Worker on SQLite ---------------------------- */

console.log('\nArtwork');
const { existsSync, readFileSync } = await import('node:fs');
const root = new URL('..', import.meta.url).pathname;
await test('image paths: art sets and site assets pass, traversal fails', () => {
  const ok = validateCreative({ ...base, imageUrl: '/assets/ads/redeem-codes' });
  assert.equal(ok.imageUrl, '/assets/ads/redeem-codes');
  throwsAds(() => validateCreative({ ...base, imageUrl: '/assets/../secret' }), /not valid/);
  throwsAds(() => validateCreative({ ...base, imageUrl: '/assets/ads/a b' }), /not valid/);
  throwsAds(() => validateCreative({ ...base, imageUrl: '/etc/passwd' }), /Cloudinary/);
});
await test('every artwork set has wide, card and square files, with no text inside', () => {
  const sets = JSON.parse(readFileSync(root + 'public/assets/ads/index.json', 'utf8'));
  assert.ok(sets.length >= 14);
  for (const { slug } of sets) for (const size of ['wide', 'card', 'square']) {
    const file = root + 'public/assets/ads/' + slug + '-' + size + '.svg';
    assert.ok(existsSync(file), 'missing ' + file);
    const svg = readFileSync(file, 'utf8');
    assert.ok(!/<text|<script|<image|href=/i.test(svg), slug + '-' + size + ' must be pure shapes');
    assert.ok(svg.length < 40000, slug + '-' + size + ' is too heavy');
  }
});
await test('the studio preview stylesheet matches the site stylesheet', () => {
  assert.equal(readFileSync(root + 'public/assets/ads-preview.css', 'utf8'), readFileSync(root + 'src/styles/ads.css', 'utf8'),
    'run: cp src/styles/ads.css public/assets/ads-preview.css');
});

const sqliteModule = await import('node:sqlite').catch(() => null);
if (!sqliteModule) {
  console.log('\nWorker route tests skipped: this Node version has no node:sqlite (needs Node 22.5 or newer).');
  console.log(passed + ' ads tests passed');
  process.exit(0);
}
const { DatabaseSync } = sqliteModule;
console.log('Worker routes');
function makeD1() {
  const sqlite = new DatabaseSync(':memory:');
  const wrap = (sql, params = []) => ({
    bind: (...values) => wrap(sql, values),
    run: async () => { const r = sqlite.prepare(sql).run(...params); return { meta: { changes: Number(r.changes) } }; },
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    exec: () => sqlite.prepare(sql).run(...params)
  });
  return {
    prepare: (sql) => wrap(sql),
    batch: async (list) => { for (const s of list) await s.run(); return []; }
  };
}
const db = makeD1();
const env = { DB: db };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const d1 = async () => db;
let owner = true;
const authenticated = async () => owner;
const origin = 'https://fcmobiletools.online';
const call = (route, method, path, body, extra = {}) => route({
  request: new Request(origin + path, { method, headers: { 'content-type': 'application/json', origin, 'user-agent': 'Mozilla/5.0', 'cf-connecting-ip': extra.ip || '1.2.3.4' }, body: body === undefined ? undefined : JSON.stringify(body) }),
  env, url: new URL(origin + path), ctx: { waitUntil() {} }, json, d1, authenticated, supabaseRest: async () => []
});
const pub = (m, p, b, e) => call(adsPublicRoute, m, p, b, e);
const adm = (m, p, b) => call(adsStudioRoute, m, p, b);

await test('first request creates tables and starter ads', async () => {
  const res = await pub('GET', '/api/ads/config');
  const config = await res.json();
  assert.equal(config.v, 1);
  const names = config.creatives.map((c) => c.headline);
  assert.ok(names.some((n) => /redeem codes, the moment/i.test(n)));
  assert.ok(!names.some((n) => /Giveaway live/.test(n)), 'giveaway ad needs a live giveaway');
  assert.ok(!names.some((n) => /Premium is on the way/.test(n)), 'premium starts as a draft');
  assert.ok(config.creatives.every((c) => !JSON.stringify(c).includes('\u2014')));
  assert.equal(config.settings.adsense.enabled, false);
});
await test('events count, ignore junk, ignore bots', async () => {
  const config = await (await pub('GET', '/api/ads/config')).json();
  const id = config.creatives[0].id;
  const r1 = await pub('POST', '/api/ads/event', { e: [{ c: id, s: 'page-end', p: 'list', t: 'view' }, { c: id, s: 'page-end', p: 'list', t: 'click' }, { c: 'nope_nope', s: 'page-end', p: 'list', t: 'view' }, { c: id, s: 'bad-slot', p: 'list', t: 'view' }] });
  assert.equal(r1.status, 204);
  const rows = await db.prepare('SELECT event, SUM(count) n FROM ads_stats GROUP BY event').all();
  const got = Object.fromEntries(rows.results.map((r) => [r.event, r.n]));
  assert.equal(got.view, 1); assert.equal(got.click, 1);
  const bot = await call(adsPublicRoute, 'POST', '/api/ads/event', { e: [{ c: id, s: 'page-end', p: 'list', t: 'view' }] });
  assert.equal(bot.status, 204);
});
await test('advertiser inquiries validate, trap bots and rate limit', async () => {
  const good = { brand: 'Acme Gaming', contactMethod: 'discord', contactValue: 'acme#0001', category: 'creator', message: 'We run an FC Mobile channel and want a month of placement.', elapsed: 9000 };
  assert.equal((await pub('POST', '/api/ads/inquiry', { ...good, brand: '' })).status, 400);
  assert.equal((await pub('POST', '/api/ads/inquiry', { ...good, message: 'short' })).status, 400);
  assert.equal((await pub('POST', '/api/ads/inquiry', { ...good, contactMethod: 'email', contactValue: 'nope' })).status, 400);
  const trapped = await (await pub('POST', '/api/ads/inquiry', { ...good, company_site: 'x' })).json();
  assert.equal(trapped.ok, true);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM ads_inquiries').first()).n, 0);
  assert.equal((await pub('POST', '/api/ads/inquiry', { ...good, elapsed: 100 })).status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM ads_inquiries').first()).n, 0);
  assert.equal((await pub('POST', '/api/ads/inquiry', good, { ip: '9.9.9.9' })).status, 200);
  await pub('POST', '/api/ads/inquiry', good, { ip: '9.9.9.9' });
  await pub('POST', '/api/ads/inquiry', good, { ip: '9.9.9.9' });
  assert.equal((await pub('POST', '/api/ads/inquiry', good, { ip: '9.9.9.9' })).status, 429);
});
await test('cross origin posts are refused', async () => {
  const res = await adsPublicRoute({ request: new Request(origin + '/api/ads/event', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }), env, url: new URL(origin + '/api/ads/event'), ctx: {}, json, d1 });
  assert.equal(res.status, 403);
});
await test('admin routes need the owner', async () => {
  owner = false;
  assert.equal((await adm('GET', '/api/ads-studio/overview')).status, 401);
  owner = true;
  const overview = await (await adm('GET', '/api/ads-studio/overview?days=7')).json();
  assert.equal(overview.days, 7);
  assert.ok(overview.creatives.length >= 8);
  assert.equal(overview.inquiries.length, 3);
  assert.ok(Array.isArray(overview.insights));
});
let sponsorId; let token;
await test('sponsor lifecycle: create, switch on, serve, report', async () => {
  const created = await adm('POST', '/api/ads-studio/creatives', {
    ...base, kind: 'sponsor', sponsorName: 'Acme Gaming', name: 'Acme November', headline: 'Acme Gaming: new season', url: 'https://example.com/?ref=fcmt',
    status: 'draft', caps: { dailyImpressions: 2 }
  });
  assert.equal(created.status, 201);
  sponsorId = (await created.json()).id;
  assert.equal((await adm('POST', `/api/ads-studio/creatives/${sponsorId}/status`, { status: 'bogus' })).status, 400);
  assert.equal((await adm('POST', `/api/ads-studio/creatives/${sponsorId}/status`, { status: 'active' })).status, 200);
  const config = await (await pub('GET', '/api/ads/config')).json();
  const served = config.creatives.find((c) => c.id === sponsorId);
  assert.equal(served.kind, 'sponsor'); assert.equal(served.remaining, 2);
  await pub('POST', '/api/ads/event', { e: [{ c: sponsorId, s: 'page-end', p: 'list', t: 'view' }, { c: sponsorId, s: 'page-end', p: 'list', t: 'view' }, { c: sponsorId, s: 'page-end', p: 'list', t: 'click' }] });
  const after = await (await pub('GET', '/api/ads/config')).json();
  assert.equal(after.creatives.find((c) => c.id === sponsorId).remaining, 0, 'daily cap is reported');
  token = (await db.prepare('SELECT report_token t FROM ads_creatives WHERE id = ?1').bind(sponsorId).first()).t;
  assert.ok(token && token.length >= 20);
  const report = await (await pub('GET', '/api/ads/report?t=' + token)).json();
  assert.equal(report.totals.views, 2); assert.equal(report.totals.clicks, 1);
  assert.equal((await pub('GET', '/api/ads/report?t=wrongwrongwrongwrongwrong')).status, 404);
  assert.equal((await adm('DELETE', `/api/ads-studio/creatives/${sponsorId}`)).status, 409, 'cannot delete a live ad');
});
await test('explain says why an ad is not showing', async () => {
  const res = await (await adm('POST', '/api/ads-studio/explain', { id: sponsorId, slot: 'page-end', pageType: 'list', path: '/events', locale: 'id' })).json();
  assert.equal(res.eligible, true);
  const paused = await adm('POST', `/api/ads-studio/creatives/${sponsorId}/status`, { status: 'paused' });
  assert.equal(paused.status, 200);
  const again = await (await adm('POST', '/api/ads-studio/explain', { id: sponsorId, slot: 'page-end', pageType: 'list', path: '/events' })).json();
  assert.equal(again.eligible, false);
  assert.match(again.reasons.join(), /paused/);
});
await test('inquiry becomes a draft sponsor campaign', async () => {
  const list = await (await adm('GET', '/api/ads-studio/inquiries')).json();
  const id = list.inquiries[0].id;
  const res = await adm('POST', `/api/ads-studio/inquiries/${id}/campaign`);
  assert.equal(res.status, 201);
  const row = await db.prepare('SELECT * FROM ads_creatives WHERE id = ?1').bind((await res.json()).id).first();
  assert.equal(row.status, 'draft'); assert.equal(row.kind, 'sponsor');
});
await test('settings validate and save', async () => {
  assert.equal((await adm('PUT', '/api/ads-studio/settings', { adsense: { enabled: true, publisherId: 'bad' } })).status, 400);
  const ok = await adm('PUT', '/api/ads-studio/settings', { ...defaultSettings(), maxPerPage: 1, adsense: { enabled: false, publisherId: 'ca-pub-2527295119501596', share: 60 } });
  assert.equal(ok.status, 200);
  assert.equal((await (await adm('GET', '/api/ads-studio/settings')).json()).settings.maxPerPage, 1);
});
await test('hourly job ends finished campaigns and learns from clicks', async () => {
  const past = validateCreative({ ...base, name: 'Old', status: 'active', endsAt: new Date(Date.now() + 1000).toISOString() });
  const res = await adm('POST', '/api/ads-studio/creatives', { ...past, endsAt: new Date(Date.now() + 1000).toISOString() });
  const id = (await res.json()).id;
  const day = new Date().toISOString().slice(0, 10);
  await db.prepare('INSERT INTO ads_stats VALUES (?1,?2,?3,?4,?5,?6)').bind(day, id, 'page-end', 'list', 'view', 1000).run();
  await db.prepare('INSERT INTO ads_stats VALUES (?1,?2,?3,?4,?5,?6)').bind(day, id, 'page-end', 'list', 'click', 80).run();
  // A second ad with a weak click rate sets the average the first one is measured against.
  const dull = (await (await adm('POST', '/api/ads-studio/creatives', { ...base, name: 'Dull' })).json()).id;
  await db.prepare('INSERT INTO ads_stats VALUES (?1,?2,?3,?4,?5,?6)').bind(day, dull, 'page-end', 'list', 'view', 1000).run();
  await db.prepare('INSERT INTO ads_stats VALUES (?1,?2,?3,?4,?5,?6)').bind(day, dull, 'page-end', 'list', 'click', 5).run();
  const out = await runAdsMaintenance(env, { db, now: new Date(Date.now() + 5000) });
  assert.ok(out.ended >= 1);
  const row = await db.prepare('SELECT status, learned FROM ads_creatives WHERE id = ?1').bind(id).first();
  assert.equal(row.status, 'ended');
  assert.ok(row.learned > 1, 'a strong click rate raises the weight, got ' + row.learned);
  assert.ok((await db.prepare('SELECT learned FROM ads_creatives WHERE id = ?1').bind(dull).first()).learned < 1, 'a weak one is turned down');
});

await test('starter ads and tool promos carry artwork that exists, and run once', async () => {
  const config = await (await pub('GET', '/api/ads/config')).json();
  const withArt = config.creatives.filter((c) => c.img);
  assert.ok(withArt.length >= 15, 'expected art on starters and tool promos, got ' + withArt.length);
  for (const c of withArt) {
    const name = c.img.replace('/assets/ads/', '');
    for (const size of ['wide', 'card', 'square']) assert.ok(existsSync(root + 'public/assets/ads/' + name + '-' + size + '.svg'), c.headline + ' points at missing art ' + name);
  }
  const tools = config.creatives.filter((c) => /Team OVR|Training|Rank Up|Gauntlet|Star Shards/i.test(c.headline + ' ' + c.cta));
  assert.ok(tools.length >= 4);
  assert.ok(tools.every((c) => c.targeting.pathsExclude.length === 1 && c.targeting.locales.includes('en')));
  const names = await db.prepare('SELECT name, COUNT(*) n FROM ads_creatives GROUP BY name HAVING n > 1').all();
  assert.equal(names.results.length, 0, 'no ad is created twice');
});
await test('a tool promo never shows on its own tool page', async () => {
  const config = await (await pub('GET', '/api/ads/config')).json();
  const team = config.creatives.find((c) => /Team OVR/.test(c.cta));
  const here = { slot: 'tool-result', pageType: 'tool', path: '/team-ovr', locale: 'en', device: 'mobile', signedIn: false, pushOn: false, topics: {}, now: Date.now(), shownIds: [] };
  assert.match(blockers({ ...team, learned: 1 }, here, {}).join(), /excluded/);
  assert.deepEqual(blockers({ ...team, learned: 1 }, { ...here, path: '/training-calculator' }, {}), []);
});

console.log('\n' + passed + ' ads tests passed');
