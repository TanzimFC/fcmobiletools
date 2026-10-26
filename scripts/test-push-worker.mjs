// Runs the real push Worker module against an in-memory SQLite database shaped like D1,
// with OneSignal replaced by a recorder. Catches SQL mistakes and flow bugs without deploying.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { pushPublicRoute, notificationStudioRoute, autoRedeemPush, runPushAutomations } from '../src/pushWorker.mjs';
import { FOOTBALL_CENTRE_CONTENT } from '../src/data/footballCentre.js';
import { saveCode } from '../src/lib/redeem.js';

function makeD1() {
  const sqlite = new DatabaseSync(':memory:');
  return {
    prepare(sql) {
      const make = (args) => ({
        run: async () => { const r = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
        first: async () => sqlite.prepare(sql).get(...args) ?? null,
        all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
      });
      return { ...make([]), bind: (...args) => make(args) };
    },
    batch: async (statements) => { const out = []; for (const statement of statements) out.push(await statement.all()); return out; },
  };
}

const db = makeD1();
const sent = [];
let oneSignalStatus = 200;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const body = init.body ? JSON.parse(init.body) : null;
  sent.push({ method: init.method, path: u.pathname, query: Object.fromEntries(u.searchParams), body, auth: init.headers?.authorization });
  if (oneSignalStatus !== 200) return new Response(JSON.stringify({ errors: ['bad'] }), { status: oneSignalStatus });
  if (init.method === 'POST') return new Response(JSON.stringify({ id: 'n-' + sent.length }), { status: 200 });
  if (init.method === 'DELETE') return new Response('{}', { status: 200 });
  return new Response(JSON.stringify({ successful: 9, failed: 1, errored: 0, converted: 3, remaining: 0, completed_at: 1 }), { status: 200 });
};

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
const d1 = async () => db;
const env = { ONESIGNAL_REST_API_KEY: 'os_v2_app_testkey' };
const ctx = { waitUntil: (p) => p };
const ORIGIN = 'https://fcmobiletools.online';
const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
let passed = 0;
const step = async (name, fn) => { try { await fn(); passed += 1; } catch (error) { console.error('FAILED:', name); throw error; } };

const pub = (path, body, extra = {}) => pushPublicRoute({
  request: new Request(ORIGIN + path, { method: body ? 'POST' : 'GET', headers: { origin: ORIGIN, 'user-agent': 'Mozilla/5.0 (Linux; Android 14)', 'cf-connecting-ip': '1.2.3.4', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
  env, url: new URL(ORIGIN + path), ctx, json, d1, ...extra,
});
const studio = (path, body, role = 'owner') => notificationStudioRoute({
  request: new Request(ORIGIN + '/api/notification-studio' + path, { method: body ? 'POST' : 'GET', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
  env, url: new URL(ORIGIN + '/api/notification-studio' + path), ctx, json, d1,
  authenticated: async () => role === 'owner', workerAuthenticated: async () => role === 'staff', staffAllowed: true,
});
const read = async (res) => ({ status: res.status, data: await res.json() });

await step('public config has safe defaults', async () => {
  const { status, data } = await read(await pub('/api/push/config'));
  assert.equal(status, 200);
  assert.equal(data.promptEnabled, true);
  assert.equal(data.delaySeconds, 12);
});

await step('register stores the device, sends one welcome, never a second', async () => {
  let r = await read(await pub('/api/push/register', { subscriptionId: ID1, topics: { redeem_codes: true, live_events: false }, locale: 'bn', source: 'redeem_page', welcome: true }));
  assert.equal(r.status, 200); assert.equal(r.data.welcomed, true);
  const welcome = sent.filter((c) => c.method === 'POST' && c.body?.include_subscription_ids);
  assert.equal(welcome.length, 1);
  assert.deepEqual(welcome[0].body.include_subscription_ids, [ID1]);
  assert.equal(welcome[0].auth, 'Key os_v2_app_testkey');
  r = await read(await pub('/api/push/register', { subscriptionId: ID1, topics: { redeem_codes: true, live_events: false }, locale: 'bn', source: 'bell', welcome: true }));
  assert.equal(r.data.welcomed, false);
  assert.equal(sent.filter((c) => c.method === 'POST').length, 1);
  assert.equal((await read(await pub('/api/push/register', { subscriptionId: 'nope' }))).status, 400);
});

await step('cross origin posts are rejected', async () => {
  const res = await pushPublicRoute({ request: new Request(ORIGIN + '/api/push/event', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }), env, url: new URL(ORIGIN + '/api/push/event'), ctx, json, d1 });
  assert.equal(res.status, 403);
});

await step('funnel events count by source', async () => {
  for (const event of ['shown', 'shown', 'accepted', 'enabled']) await pub('/api/push/event', { event, source: 'redeem_page' });
  assert.equal((await read(await pub('/api/push/event', { event: 'hack' }))).status, 400);
  await pub('/api/push/register', { subscriptionId: ID2, topics: { redeem_codes: true, live_events: false, daily_reset: true }, locale: 'en', source: 'sheet' });
  const { data } = await read(await studio('/overview'));
  assert.equal(data.funnel.bySource.redeem_page.shown, 2);
  assert.equal(data.funnel.totals.enabled, 1);
  assert.equal(data.subscribers.active, 2);
  assert.equal(data.subscribers.byTopic.redeem_codes, 2);
  assert.equal(data.subscribers.byTopic.daily_reset, 1);
  assert.equal(data.subscribers.byTopic.live_events, 0);
  assert.equal(data.subscribers.byPlatform.android, 2);
});

await step('studio needs a signed in admin', async () => {
  const res = await notificationStudioRoute({ request: new Request(ORIGIN + '/api/notification-studio/overview'), env, url: new URL(ORIGIN + '/api/notification-studio/overview'), ctx, json, d1, authenticated: async () => false, workerAuthenticated: async () => false, staffAllowed: true });
  assert.equal(res.status, 401);
});

await step('owner sends to a topic with a tag filter, duplicates are caught', async () => {
  const body = { title: 'New code is live', message: 'Claim 2 vouchers before they expire.', topic: 'redeem_codes', url: '/redeem-codes/', ttlHours: 6 };
  const before = sent.length;
  const r = await read(await studio('/send', body));
  assert.equal(r.status, 200); assert.equal(r.data.ok, true); assert.equal(r.data.estimate, 2);
  const call = sent[before];
  assert.equal(call.path, '/notifications'); assert.equal(call.query.c, 'push');
  assert.deepEqual(call.body.filters, [{ field: 'tag', key: 'notify_redeem_codes', relation: '=', value: 'true' }]);
  assert.equal(call.body.url, 'https://fcmobiletools.online/redeem-codes/');
  const dup = await read(await studio('/send', body));
  assert.equal(dup.status, 409); assert.equal(dup.data.code, 'duplicate');
  assert.equal((await read(await studio('/send', { ...body, confirmDuplicate: true }))).status, 200);
});

await step('copy and link rules are enforced on the server', async () => {
  const base = { title: 'Fine title', message: 'A long enough message.', topic: 'redeem_codes', url: '/' };
  assert.equal((await read(await studio('/send', { ...base, title: 'x' }))).status, 400);
  assert.equal((await read(await studio('/send', { ...base, url: 'https://evil.example/' }))).status, 400);
  assert.equal((await read(await studio('/send', { ...base, message: 'Has an em dash \u2014 inside it' }))).status, 400);
  assert.equal((await read(await studio('/send', { ...base, topic: 'nope' }))).status, 400);
  assert.equal((await read(await studio('/send', { ...base, scheduleAt: new Date(Date.now() - 1000).toISOString() }))).status, 400);
});

await step('scheduled sends carry send_after and can be cancelled', async () => {
  const at = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  const before = sent.length;
  const r = await read(await studio('/send', { title: 'Later alert', message: 'This one goes out later today.', topic: 'live_events', url: '/events/', scheduleAt: at }));
  assert.equal(r.data.scheduled, true);
  assert.match(sent[before].body.send_after, /GMT\+0000$/);
  const list = (await read(await studio('/campaigns'))).data.campaigns;
  const scheduled = list.find((c) => c.title === 'Later alert');
  assert.equal(scheduled.status, 'scheduled');
  assert.equal((await read(await studio('/cancel', { id: scheduled.id }))).status, 200);
  assert.equal(sent.at(-1).method, 'DELETE');
  assert.equal((await read(await studio('/campaigns'))).data.campaigns.find((c) => c.title === 'Later alert').status, 'cancelled');
});

await step('staff cannot broadcast to everyone and are capped per hour', async () => {
  const base = { title: 'Staff alert', message: 'A staff written message.', url: '/' };
  assert.equal((await read(await studio('/send', { ...base, topic: 'all' }, 'staff'))).status, 403);
  let last;
  for (let i = 0; i < 7; i += 1) last = await read(await studio('/send', { ...base, message: 'A staff written message ' + i + '.', topic: 'giveaways' }, 'staff'));
  assert.equal(last.status, 429); assert.equal(last.data.code, 'staff-limit');
  assert.equal((await read(await studio('/automations', null, 'staff'))).status, 403);
  assert.equal((await read(await studio('/settings', { promptEnabled: false }, 'staff'))).status, 403);
});

await step('tests need a device, then go to it by id', async () => {
  const base = { title: 'Test title', message: 'Testing the alert.', topic: 'redeem_codes', url: '/' };
  const none = await read(await studio('/test', base));
  assert.equal(none.status, 400); assert.equal(none.data.code, 'no-test-device');
  assert.equal((await read(await studio('/register-device', { subscriptionId: ID1, label: 'My laptop' }))).status, 200);
  const before = sent.length;
  const ok = await read(await studio('/test', base));
  assert.equal(ok.status, 200); assert.equal(ok.data.devices, 1);
  assert.deepEqual(sent[before].body.include_subscription_ids, [ID1]);
  const overview = (await read(await studio('/overview'))).data;
  assert.equal(overview.subscribers.testDevices, 1);
  assert.equal(overview.subscribers.active, 1, 'test devices are not counted as audience');
});

await step('failed sends are recorded with a plain explanation', async () => {
  oneSignalStatus = 401;
  const r = await read(await studio('/send', { title: 'Will fail', message: 'This send will be rejected.', topic: 'redeem_codes', url: '/' }));
  oneSignalStatus = 200;
  assert.equal(r.status, 502);
  assert.match(r.data.error, /REST API Key/);
  const failed = (await read(await studio('/campaigns'))).data.campaigns.find((c) => c.title === 'Will fail');
  assert.equal(failed.status, 'failed'); assert.match(failed.error, /REST API Key/);
});

await step('a missing key is explained, not hidden', async () => {
  const bare = {};
  const res = await notificationStudioRoute({ request: new Request(ORIGIN + '/api/notification-studio/send', { method: 'POST', headers: { origin: ORIGIN }, body: JSON.stringify({ title: 'No key here', message: 'Nothing can send now.', topic: 'redeem_codes', url: '/' }) }), env: bare, url: new URL(ORIGIN + '/api/notification-studio/send'), ctx, json, d1, authenticated: async () => true, workerAuthenticated: async () => false, staffAllowed: true });
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /ONESIGNAL_REST_API_KEY/);
});

await step('delivery numbers refresh from OneSignal', async () => {
  const r = await read(await studio('/refresh-stats', {}));
  assert.ok(r.data.updated >= 1);
  const c = (await read(await studio('/campaigns'))).data.campaigns.find((x) => x.stats);
  assert.equal(c.stats.delivered, 9); assert.equal(c.stats.clicked, 3);
});

await step('health check reports key, connection, devices and the hourly run', async () => {
  const { data } = await read(await studio('/health'));
  const byId = Object.fromEntries(data.checks.map((c) => [c.id, c]));
  assert.equal(byId.key.ok, true); assert.equal(byId.onesignal.ok, true); assert.equal(byId.database.ok, true); assert.equal(byId.devices.ok, true);
});

await step('automations: edit, validate, and reject bad copy', async () => {
  const list = (await read(await studio('/automations'))).data.automations;
  assert.equal(list.length, 7);
  assert.equal((await read(await studio('/automations', { key: 'daily_reset', enabled: true, title: 'Reset is live', message: 'Grab your daily rewards now.', url: '/events/', topic: 'daily_reset', config: { hoursBefore: 0 } }))).status, 200);
  assert.equal((await read(await studio('/automations', { key: 'daily_reset', enabled: true, title: 'Bad \u2014 title', message: 'Grab your daily rewards now.' }))).status, 400);
  assert.equal((await read(await studio('/automations', { key: 'nope' }))).status, 400);
});

await step('daily reset sends once in the reset hour and not again', async () => {
  const hour = Number(/^(\d+)/.exec(FOOTBALL_CENTRE_CONTENT.schedule.dailyResetUtc)[1]);
  const at = new Date(Date.UTC(2026, 9, 27, hour, 0, 20));
  const before = sent.filter((c) => c.method === 'POST').length;
  const first = await runPushAutomations(env, { db, now: at });
  assert.ok(first.some((r) => r.key === 'daily_reset' && r.sent), JSON.stringify(first));
  const second = await runPushAutomations(env, { db, now: at });
  assert.ok(second.some((r) => r.key === 'daily_reset' && r.skipped === 'already-sent'));
  const payload = sent.filter((c) => c.method === 'POST')[before].body;
  assert.equal(payload.filters[0].key, 'notify_daily_reset');
  assert.equal(payload.web_push_topic, 'daily-reset');
  assert.ok(payload.idempotency_key);
  const other = await runPushAutomations(env, { db, now: new Date(Date.UTC(2026, 9, 27, (hour + 5) % 24, 0, 20)) });
  assert.ok(!other.some((r) => r.key === 'daily_reset'));
});

await step('events going live trigger once from the real calendar', async () => {
  const event = FOOTBALL_CENTRE_CONTENT.eventsCatalog.find((e) => e.startUtc && e.title);
  const at = new Date(new Date(event.startUtc).getTime() + 30000);
  const results = await runPushAutomations(env, { db, now: at });
  const hit = results.find((r) => r.key === 'event_live');
  assert.ok(hit && hit.sent, JSON.stringify(results));
  const again = await runPushAutomations(env, { db, now: at });
  assert.ok(again.filter((r) => r.key === 'event_live').every((r) => r.skipped === 'already-sent'));
});

await step('new code alerts: single, bulk, and no repeat for the same code', async () => {
  const before = sent.filter((c) => c.method === 'POST').length;
  const one = await autoRedeemPush(env, db, { kind: 'redeem_code', dedupe: 'CODE123', reward: '2 FC Draft Vouchers', count: 1 });
  assert.ok(one.sent);
  assert.equal(await autoRedeemPush(env, db, { kind: 'redeem_code', dedupe: 'CODE123', reward: 'x', count: 1 }).then((r) => r.skipped), 'already-sent');
  const bulk = await autoRedeemPush(env, db, { kind: 'redeem_bulk', dedupe: 'bulk:abc', reward: 'Rewards', count: 4 });
  assert.ok(bulk.sent);
  const posts = sent.filter((c) => c.method === 'POST').slice(before);
  assert.match(posts[0].body.headings.en, /New FC Mobile redeem code/);
  assert.match(posts[1].body.headings.en, /4 new FC Mobile codes/);
  assert.match(posts[0].body.contents.en, /2 FC Draft Vouchers/);
});

await step('a failed automation is retried instead of being lost', async () => {
  oneSignalStatus = 500;
  const failed = await autoRedeemPush(env, db, { kind: 'redeem_code', dedupe: 'RETRY1', reward: 'Gems', count: 1 });
  oneSignalStatus = 200;
  assert.ok(failed.error);
  db.prepare("UPDATE notification_campaigns SET created_at = '2020-01-01T00:00:00.000Z' WHERE dedupe_key = 'redeem:RETRY1'");
  await db.prepare("UPDATE notification_campaigns SET created_at = '2020-01-01T00:00:00.000Z' WHERE dedupe_key = 'redeem:RETRY1'").run();
  const retry = await autoRedeemPush(env, db, { kind: 'redeem_code', dedupe: 'RETRY1', reward: 'Gems', count: 1 });
  assert.ok(retry.sent, JSON.stringify(retry));
});

await step('hourly sweep: codes released by schedule and codes about to expire', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await saveCode(db, { code: 'SCHEDULED1', reward: '3 Gems', status: 'active', releaseDate: today, expiryDate: '', region: 'Global' }, 'test');
  await saveCode(db, { code: 'SAMEDAY1', reward: '1 Gem', status: 'active', releaseDate: today, expiryDate: today, region: 'Global' }, 'test');
  await db.prepare("UPDATE redeem_codes SET created_at = ?1 WHERE code = 'SCHEDULED1'").bind(yesterday + 'T10:00:00.000Z').run();
  const now = new Date(today + 'T00:00:30Z');
  const before = sent.filter((c) => c.method === 'POST').length;
  const results = await runPushAutomations(env, { db, now });
  const released = results.filter((r) => r.key === 'redeem_new');
  assert.equal(released.length, 1, 'only the code created on an earlier day is announced by the sweep');
  const posts = sent.filter((c) => c.method === 'POST').slice(before).map((c) => c.body.headings.en + ' | ' + c.body.contents.en);
  assert.ok(posts.some((p) => /3 Gems/.test(p)), posts.join('\n'));
  const expiring = results.find((r) => r.key === 'redeem_expiring');
  assert.ok(expiring && expiring.sent, 'expiring code today is announced: ' + JSON.stringify(results));
  assert.ok(posts.some((p) => /expiring soon/.test(p) && /1 Gem/.test(p) && /today/.test(p)), posts.join('\n'));
  const again = await runPushAutomations(env, { db, now });
  assert.ok(again.filter((r) => r.key === 'redeem_new' || r.key === 'redeem_expiring').every((r) => r.skipped === 'already-sent'));
});

await step('opt-in settings save for the owner and reach the public config', async () => {
  assert.equal((await read(await studio('/settings', { promptEnabled: false, delaySeconds: 30, minPageViews: 3 }))).status, 200);
  const { data } = await read(await pub('/api/push/config'));
  assert.equal(data.promptEnabled, false); assert.equal(data.delaySeconds, 30); assert.equal(data.minPageViews, 3);
});

await step('leaving removes a device from the audience', async () => {
  await pub('/api/push/unregister', { subscriptionId: ID2 });
  const { data } = await read(await studio('/overview'));
  assert.equal(data.subscribers.active, 0);
  assert.equal(data.subscribers.paused, 1);
});

console.log(`Push worker checks passed: ${passed} flows.`);
