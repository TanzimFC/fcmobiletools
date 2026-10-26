// Drives the real browser script (src/scripts/push-client.js) with fake browser pieces and a fake OneSignal.
import assert from 'node:assert/strict';

let run = 0;
async function boot({ ua = 'Mozilla/5.0 (Linux; Android 14)', permission = 'default', answer = 'granted', storage = {}, standalone = false, noPush = false, sdkFails = false, registerFails = false } = {}) {
  run += 1;
  const calls = { posts: [], tags: [], optIn: 0, optOut: 0, permissionAsks: 0, sdkLoads: 0, initOptions: null };
  const store = new Map(Object.entries(storage));
  const bus = new EventTarget();
  const OS = {
    Notifications: { requestPermission: async () => { calls.permissionAsks += 1; calls.sdkLoadsWhenPermissionRequested = calls.sdkLoads; Notification.permission = answer; return answer === 'granted'; } },
    User: { PushSubscription: { id: undefined, optedIn: false,
      optIn: async () => { calls.optIn += 1; OS.User.PushSubscription.optedIn = true; OS.User.PushSubscription.id = '33333333-3333-4333-8333-333333333333'; },
      optOut: async () => { calls.optOut += 1; OS.User.PushSubscription.optedIn = false; },
      addEventListener() {} }, addTags: async (tags) => { calls.tags.push(tags); } },
    init: async () => {},
  };
  class FakeNotification {
    static permission = permission;
    static requestPermission = async () => {
      calls.permissionAsks += 1;
      calls.sdkLoadsWhenPermissionRequested = calls.sdkLoads;
      FakeNotification.permission = answer;
      return answer;
    };
  }
  const win = globalThis;
  win.window = win;
  win.addEventListener = bus.addEventListener.bind(bus);
  win.dispatchEvent = bus.dispatchEvent.bind(bus);
  win.matchMedia = () => ({ matches: standalone });
  win.requestIdleCallback = undefined;
  win.OneSignalDeferred = [];
  win.FCMT_I18N = { locale: 'pt-BR' };
  win.FCPush = undefined;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ua, platform: 'Linux', maxTouchPoints: 0, serviceWorker: noPush ? undefined : {}, standalone }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) }, configurable: true, writable: true });
  if (noPush) { delete win.PushManager; delete win.Notification; } else { win.PushManager = class {}; win.Notification = FakeNotification; }
  if (!noPush && Object.keys(navigator.serviceWorker).length === 0) navigator.serviceWorker = {};
  win.document = { head: { appendChild: (script) => { calls.sdkLoads += 1; setTimeout(() => { if (sdkFails) script.onerror?.(); else for (const fn of win.OneSignalDeferred.splice(0)) fn(OS); }, 0); } }, createElement: () => ({}), getElementById: () => null };
  win.fetch = async (url, init) => {
    calls.posts.push({ url, body: JSON.parse(init.body) });
    if (registerFails && url === '/api/push/register') return { ok: false, status: 503, json: async () => ({ error: 'Subscription registry temporarily unavailable.' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  await import('../src/scripts/push-client.js?run=' + run);
  return { FC: win.FCPush, calls, store, OS, bus };
}
const posted = (calls, path) => calls.posts.filter((p) => p.url === path);
let n = 0; const step = async (name, fn) => { try { await fn(); n += 1; } catch (e) { console.error('FAILED:', name); throw e; } };

await step('first visit: nothing is requested, nothing is downloaded', async () => {
  const { FC, calls } = await boot();
  assert.equal(FC.state(), 'available');
  assert.equal(calls.permissionAsks, 0); assert.equal(calls.sdkLoads, 0); assert.equal(calls.posts.length, 0);
});

await step('enable: permission, subscribe, tags, registry, welcome, funnel', async () => {
  const { FC, calls, store } = await boot();
  await FC.prepare();
  const result = await FC.enable({ topics: { redeem_codes: true }, source: 'redeem_page' });
  assert.deepEqual([result.ok, result.state], [true, 'enabled']);
  assert.equal(calls.permissionAsks, 1); assert.equal(calls.optIn, 1);
  assert.equal(calls.sdkLoadsWhenPermissionRequested, 1, 'OneSignal must initialize before the permission prompt');
  assert.equal(calls.tags.at(-1).notify_redeem_codes, 'true');
  assert.equal(calls.tags.at(-1).notify_daily_reset, 'false');
  const reg = posted(calls, '/api/push/register')[0].body;
  assert.equal(reg.subscriptionId, '33333333-3333-4333-8333-333333333333');
  assert.equal(reg.welcome, true); assert.equal(reg.source, 'redeem_page'); assert.equal(reg.locale, 'pt-BR');
  assert.deepEqual(posted(calls, '/api/push/event').map((p) => p.body.event), ['accepted', 'enabled']);
  assert.equal(store.get('fcmt:onesignal:active:v1'), '1');
  assert.equal(FC.state(), 'enabled');
});

await step('a failed server registration is never reported as subscribed', async () => {
  const { FC, calls, store } = await boot({ registerFails: true });
  await FC.prepare();
  const result = await FC.enable({ topics: { redeem_codes: true }, source: 'redeem_page' });
  assert.equal(result.ok, false);
  assert.equal(result.state, 'error');
  assert.match(result.message, /registry temporarily unavailable/i);
  assert.notEqual(store.get('fcmt:onesignal:active:v1'), '1');
  assert.equal(posted(calls, '/api/push/register').length, 1);
});

await step('flipping a topic on while alerts are off subscribes in the same step', async () => {
  const { FC, calls } = await boot();
  await FC.prepare();
  const result = await FC.setTopic('giveaways', true, 'notifications_page');
  assert.equal(result.state, 'enabled'); assert.equal(calls.optIn, 1);
  assert.equal(calls.tags.at(-1).notify_giveaways, 'true');
});

await step('turning every topic off pauses alerts and tells the server', async () => {
  const { FC, calls } = await boot();
  await FC.prepare();
  await FC.enable({ topics: { redeem_codes: true }, source: 'bell' });
  for (const key of FC.topics) await FC.setTopic(key, false, 'bell');
  assert.equal(FC.state(), 'paused'); assert.equal(calls.optOut, 1);
  assert.equal(posted(calls, '/api/push/unregister').length, 1);
});

await step('blocked browser: the prompt answer is respected and reported', async () => {
  const denied = await boot({ answer: 'denied' });
  await denied.FC.prepare();
  const result = await denied.FC.enable({ source: 'sheet' });
  assert.equal(result.ok, false); assert.equal(result.state, 'denied');
  assert.ok(posted(denied.calls, '/api/push/event').some((p) => p.body.event === 'blocked'));
  const closed = await boot({ answer: 'default' });
  await closed.FC.prepare();
  assert.equal((await closed.FC.enable({ source: 'sheet' })).state, 'dismissed');
  const already = await boot({ permission: 'denied' });
  assert.equal(already.FC.state(), 'denied');
  assert.equal((await already.FC.enable({})).ok, false); assert.equal(already.calls.permissionAsks, 0);
});

await step('iPhone in Safari needs the Home Screen first, installed app works', async () => {
  const tab = await boot({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', noPush: true });
  assert.equal(tab.FC.state(), 'ios-install');
  assert.equal((await tab.FC.enable({})).state, 'ios-install');
  const app = await boot({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone: true });
  assert.equal(app.FC.state(), 'available');
});

await step('unsupported browsers and blocked libraries are named, not hidden', async () => {
  assert.equal((await boot({ noPush: true })).FC.state(), 'unsupported');
  const blocked = await boot({ sdkFails: true });
  const result = await blocked.FC.enable({ source: 'bell' });
  assert.equal(result.state, 'sdk-blocked'); assert.equal(blocked.FC.state(), 'sdk-blocked');
});

await step('existing subscribers: topics are re-synced and the device is registered on a normal visit', async () => {
  const { FC, calls, OS } = await boot({ permission: 'granted', storage: { 'fcmt:onesignal:active:v1': '1', 'fcmt:push-preferences:v1': JSON.stringify({ notify_redeem_codes: true, notify_live_events: false, notify_giveaways: false, notify_site_updates: false }) } });
  assert.equal(FC.state(), 'enabled');
  await FC.reconcile('other');
  assert.equal(calls.optIn, 1, 'a lost subscription is re-attached without any prompt');
  assert.equal(calls.permissionAsks, 0);
  const tags = calls.tags.at(-1);
  assert.equal(tags.notify_redeem_codes, 'true'); assert.equal(tags.notify_live_events, 'false', 'their old choice is kept');
  assert.equal(tags.notify_daily_reset, 'false', 'new topics start at their defaults');
  assert.equal(posted(calls, '/api/push/register').length, 1);
  assert.equal(posted(calls, '/api/push/register')[0].body.welcome, false);
  await FC.reconcile('other');
  assert.equal(posted(calls, '/api/push/register').length, 1, 'no repeat registration inside a week');
});

await step('people who paused stay paused; granted but never opted in get the one tap path', async () => {
  const paused = await boot({ permission: 'granted', storage: { 'fcmt:onesignal:active:v1': '0' } });
  assert.equal(paused.FC.state(), 'paused');
  await paused.FC.reconcile('other');
  assert.equal(paused.calls.optIn, 0);
  const legacy = await boot({ permission: 'granted' });
  assert.equal(legacy.FC.state(), 'can-resume');
  assert.equal(legacy.calls.sdkLoads, 0, 'nothing is subscribed silently');
  assert.equal(legacy.FC.mayAsk(0), true);
});

await step('soft prompt memory: dismiss backs off, no thanks is permanent', async () => {
  const { FC } = await boot({ storage: { 'fcmt:push:views:v1': '5' } });
  assert.equal(FC.mayAsk(2), true);
  FC.rememberDismiss(false);
  assert.equal(FC.mayAsk(2), false);
  const never = await boot({ storage: { 'fcmt:push:views:v1': '5', 'fcmt:push:prompt:v1': JSON.stringify({ dismissals: 1, lastDismissedAt: 0, never: true }) } });
  assert.equal(never.FC.mayAsk(2), false);
});

console.log(`Push client checks passed: ${n} scenarios.`);
