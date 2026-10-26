// FCPush: the one place that knows how to turn alerts on for this browser.
//
// What it does for the rest of the site:
//   - FCPush.state()        best guess right now, no network
//   - FCPush.enable(...)    permission + subscribe + topic tags + registry, in one call
//   - FCPush.setTopic(...)  flips one topic and subscribes first if needed (one step, no "save" button)
//   - FCPush.pause()        stops alerts on this browser
//   - 'fcmt:push-state'     window event whenever the state or the topics change
//
// The OneSignal library is only downloaded when it is needed: when someone turns alerts on, or when this
// browser already has alerts on and needs its topics kept in sync. Nobody is asked for permission here.
import { ONESIGNAL_APP_ID } from '../config/siteNotifications.js';
import { TOPIC_KEYS, TOPICS, normalizeTopicState, topicStateToTags, shouldShowPrompt } from '../lib/pushCore.js';

const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
// Same worker path and scope the site has always used, so people who already subscribed keep working.
const SW_PATH = 'onesignal/OneSignalSDKWorker.js';
const SW_SCOPE = '/onesignal/';
const KEY = {
  prefs: 'fcmt:push-preferences:v2',
  prefsV1: 'fcmt:push-preferences:v1',
  active: 'fcmt:onesignal:active:v1',
  tags: 'fcmt:push:tags:v2',
  registered: 'fcmt:push:registered:v1',
  prompt: 'fcmt:push:prompt:v1',
  views: 'fcmt:push:views:v1',
  config: 'fcmt:push:config:v1',
};
const WEEK = 7 * 24 * 3600 * 1000;

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
  json(key, fallback = null) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } },
  setJson(key, value) { this.set(key, JSON.stringify(value)); },
};

const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = (() => {
  try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; }
})();
const hasApis = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

let sdkPromise = null;
let sdkBlocked = false;
let sdkState = null; // set after the SDK has reported what this browser really has
const listeners = new Set();

const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');
const locale = () => { const code = window.FCMT_I18N?.locale; return ['en', 'bn', 'pt-BR', 'id'].includes(code) ? code : 'en'; };

/* ------------------------------ preferences ------------------------------ */

function readPrefs() {
  const v2 = store.json(KEY.prefs);
  if (v2 && typeof v2 === 'object') return normalizeTopicState(v2);
  // People who chose topics on the old page keep their choices; new topics start at their defaults.
  const v1 = store.json(KEY.prefsV1);
  return normalizeTopicState(v1 && typeof v1 === 'object' ? v1 : null);
}
function writePrefs(prefs) { store.setJson(KEY.prefs, normalizeTopicState(prefs)); }
const anyTopic = (prefs) => TOPIC_KEYS.some((key) => prefs[key]);

/* ---------------------------------- state --------------------------------- */

function computeState() {
  if (isIOS && !isStandalone) return 'ios-install';
  if (!hasApis) return 'unsupported';
  if (sdkBlocked) return 'sdk-blocked';
  const perm = permission();
  if (perm === 'denied') return 'denied';
  if (perm === 'granted') {
    const flag = store.get(KEY.active);
    if (flag === '0') return 'paused';
    if (flag === '1') return 'enabled';
    return sdkState || 'can-resume';
  }
  return 'available';
}

let lastState = computeState();
function emit() {
  const state = computeState();
  lastState = state;
  window.dispatchEvent(new CustomEvent('fcmt:push-state', { detail: { state, prefs: readPrefs() } }));
  return state;
}

/* ---------------------------------- config -------------------------------- */

const DEFAULT_CONFIG = { promptEnabled: true, delaySeconds: 12, minPageViews: 2, bellEnabled: true, redeemCardEnabled: true };
let configPromise = null;
function getConfig() {
  if (configPromise) return configPromise;
  const cached = store.json(KEY.config);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return (configPromise = Promise.resolve({ ...DEFAULT_CONFIG, ...cached.value }));
  configPromise = fetch('/api/push/config', { headers: { accept: 'application/json' } })
    .then((response) => (response.ok ? response.json() : DEFAULT_CONFIG))
    .then((value) => { store.setJson(KEY.config, { at: Date.now(), value }); return { ...DEFAULT_CONFIG, ...value }; })
    .catch(() => DEFAULT_CONFIG);
  return configPromise;
}

/* ------------------------------ OneSignal SDK ----------------------------- */

function loadSdk() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({ appId: ONESIGNAL_APP_ID, serviceWorkerPath: SW_PATH, serviceWorkerParam: { scope: SW_SCOPE } });
        resolve(OneSignal);
      } catch (error) { reject(error); }
    });
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => reject(new Error('blocked'));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error('timeout')), 20000);
  }).catch((error) => {
    sdkPromise = null;
    sdkBlocked = true;
    emit();
    throw error;
  });
  return sdkPromise;
}

async function subscriptionId(OneSignal, waitMs = 8000) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const id = OneSignal.User?.PushSubscription?.id;
    if (id) return String(id);
    if (Date.now() > deadline) return '';
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

async function syncTags(OneSignal, prefs, force = false) {
  const tags = topicStateToTags(prefs);
  const signature = JSON.stringify(tags);
  if (!force && store.get(KEY.tags) === signature) return;
  await OneSignal.User.addTags(tags);
  store.set(KEY.tags, signature);
}

async function post(path, body) {
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
    return response.ok ? response.json().catch(() => ({})) : null;
  } catch { return null; }
}

/** Tells our own server this device exists, so the studio can count it and send it a test. */
async function register(OneSignal, { source = 'other', welcome = false, force = false } = {}) {
  const id = await subscriptionId(OneSignal);
  if (!id) return null;
  const prefs = readPrefs();
  const signature = TOPIC_KEYS.map((key) => (prefs[key] ? '1' : '0')).join('');
  const last = store.json(KEY.registered);
  if (!force && !welcome && last && last.id === id && last.signature === signature && Date.now() - last.at < WEEK) return id;
  const result = await post('/api/push/register', { subscriptionId: id, topics: prefs, locale: locale(), source, welcome });
  if (result) store.setJson(KEY.registered, { id, signature, at: Date.now() });
  return id;
}

/* -------------------------------- analytics -------------------------------- */

function track(event, source = 'other') { return post('/api/push/event', { event, source }); }

/* ---------------------------------- actions -------------------------------- */

/**
 * Turns alerts on. `topics` lists topics to switch on (others keep their saved value). Resolves with
 * { ok, state }. The browser permission box only appears here, because someone pressed a button.
 */
async function enable({ topics = {}, source = 'other', welcome = true } = {}) {
  const before = computeState();
  if (before === 'ios-install' || before === 'unsupported' || before === 'denied') return { ok: false, state: before };
  const prefs = readPrefs();
  for (const key of TOPIC_KEYS) if (topics[key] === true) prefs[key] = true;
  if (!anyTopic(prefs)) prefs.redeem_codes = true;
  writePrefs(prefs);
  track('accepted', source);
  let OneSignal;
  try { OneSignal = await loadSdk(); } catch { return { ok: false, state: 'sdk-blocked' }; }
  try {
    if (permission() !== 'granted') await OneSignal.Notifications.requestPermission();
    if (permission() === 'denied') { track('blocked', source); return { ok: false, state: emit() }; }
    if (permission() !== 'granted') return { ok: false, state: 'dismissed' };
    await OneSignal.User.PushSubscription.optIn();
    store.set(KEY.active, '1');
    await syncTags(OneSignal, prefs, true);
    await register(OneSignal, { source, welcome, force: true });
    sdkState = 'enabled';
    track('enabled', source);
    return { ok: true, state: emit() };
  } catch (error) {
    return { ok: false, state: 'error', message: String(error?.message || '') };
  }
}

async function pause(source = 'other') {
  try {
    const OneSignal = await loadSdk();
    const id = OneSignal.User?.PushSubscription?.id;
    await OneSignal.User.PushSubscription.optOut();
    store.set(KEY.active, '0');
    if (id) post('/api/push/unregister', { subscriptionId: String(id) });
    track('paused', source);
    return { ok: true, state: emit() };
  } catch (error) { return { ok: false, state: computeState(), message: String(error?.message || '') }; }
}

/**
 * Flips one topic. Turning a topic on while alerts are off subscribes in the same step, so a switch never
 * looks "on" while nothing is actually enabled. Turning every topic off pauses alerts.
 */
async function setTopic(key, on, source = 'other') {
  if (!TOPICS[key]) return { ok: false, state: computeState() };
  const state = computeState();
  const prefs = readPrefs();
  prefs[key] = Boolean(on);
  if (state !== 'enabled') {
    writePrefs(prefs);
    if (on) return enable({ topics: { [key]: true }, source });
    emit();
    return { ok: true, state: computeState() };
  }
  if (!anyTopic(prefs)) { writePrefs(prefs); return pause(source); }
  writePrefs(prefs);
  try {
    const OneSignal = await loadSdk();
    await syncTags(OneSignal, prefs, true);
    await register(OneSignal, { source, force: true });
    emit();
    return { ok: true, state: 'enabled' };
  } catch (error) { return { ok: false, state: computeState(), message: String(error?.message || '') }; }
}

/** Brings this browser back in line: re-attaches a lost subscription and syncs topics. Never prompts. */
async function reconcile(source = 'other') {
  if (!hasApis || permission() !== 'granted' || store.get(KEY.active) !== '1') return computeState();
  try {
    const OneSignal = await loadSdk();
    if (!OneSignal.User.PushSubscription.optedIn) await OneSignal.User.PushSubscription.optIn();
    const prefs = readPrefs();
    await syncTags(OneSignal, prefs);
    await register(OneSignal, { source });
    OneSignal.User.PushSubscription.addEventListener?.('change', (event) => {
      if (event?.current?.optedIn) register(OneSignal, { source, force: true });
    });
  } catch { /* the page keeps working; the next visit tries again */ }
  return emit();
}

/* ----------------------------- soft prompt memory ---------------------------- */

const promptMemory = () => store.json(KEY.prompt, { dismissals: 0, lastDismissedAt: 0, never: false });
function rememberDismiss(forever = false) {
  const memory = promptMemory();
  store.setJson(KEY.prompt, { dismissals: memory.dismissals + 1, lastDismissedAt: Date.now(), never: forever || memory.never });
}
function pageViews() { return Number(store.get(KEY.views)) || 0; }
function countPageView() { const next = Math.min(50, pageViews() + 1); store.set(KEY.views, String(next)); return next; }

function mayAsk(minPageViews = 2) {
  const memory = promptMemory();
  return shouldShowPrompt({
    state: computeState(), dismissals: memory.dismissals, lastDismissedAt: memory.lastDismissedAt,
    optedOutForever: memory.never, pageViews: pageViews(), minPageViews,
  });
}

/* ----------------------------------- boot ---------------------------------- */

countPageView();
const idle = window.requestIdleCallback ? (fn) => window.requestIdleCallback(fn, { timeout: 4000 }) : (fn) => setTimeout(fn, 2500);
if (hasApis && permission() === 'granted' && store.get(KEY.active) === '1') idle(() => reconcile('other'));

window.FCPush = {
  state: computeState,
  prefs: readPrefs,
  topics: TOPIC_KEYS,
  config: getConfig,
  enable,
  pause,
  setTopic,
  reconcile,
  track,
  mayAsk,
  rememberDismiss,
  pageViews,
  platform: { isIOS, isStandalone },
  get lastState() { return lastState; },
};
window.dispatchEvent(new CustomEvent('fcmt:push-ready'));
