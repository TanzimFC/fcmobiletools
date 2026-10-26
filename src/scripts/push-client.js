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
import { ONESIGNAL_APP_ID, ONESIGNAL_SAFARI_WEB_ID } from '../config/siteNotifications.js';
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
let sdkInstance = null;
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
    if (flag === '1') return sdkState || 'enabled';
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
    let settled = false;
    let timeout = null;
    const finish = (error, OneSignal) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (error) reject(error);
      else resolve(OneSignal);
    };
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          safari_web_id: ONESIGNAL_SAFARI_WEB_ID,
          serviceWorkerPath: SW_PATH,
          serviceWorkerParam: { scope: SW_SCOPE },
          notifyButton: { enable: true },
        });
        sdkBlocked = false;
        sdkState = null;
        sdkInstance = OneSignal;
        finish(null, OneSignal);
      } catch (error) { finish(error); }
    });
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onerror = () => finish(new Error('The OneSignal library could not load. Check your connection or content blocker and try again.'));
    document.head.appendChild(script);
    timeout = setTimeout(() => finish(new Error('OneSignal took too long to start. Check your connection and retry.')), 20000);
  }).catch((error) => {
    sdkPromise = null;
    sdkInstance = null;
    sdkBlocked = true;
    emit();
    throw error;
  });
  return sdkPromise;
}

async function subscriptionDiagnostic(OneSignal) {
  const subscription = OneSignal.User?.PushSubscription;
  const permissionState = permission();
  let registration = null;
  let browserSubscription = null;
  try {
    registration = await navigator.serviceWorker.getRegistration(new URL(SW_SCOPE, location.origin).href);
    if (registration) browserSubscription = await registration.pushManager?.getSubscription?.();
  } catch { /* diagnostic only */ }
  if (permissionState !== 'granted') return 'Browser notification permission is not granted.';
  if (!registration) return 'The browser cannot find the OneSignal service worker at /onesignal/. Reload once. If this keeps happening, the worker registration or site service-worker setup needs checking.';
  if (!browserSubscription) return 'The OneSignal service worker is registered, but the browser did not create a push token. This points to the browser push/VAPID setup or a service-worker conflict, not the permission switch.';
  if (subscription?.optedIn !== true) return 'The browser push token exists, but OneSignal still reports this browser as not opted in. The SDK subscription state needs checking.';
  return 'The browser push token exists, but OneSignal has not assigned a subscription ID yet. The SDK registration has not completed.';
}

async function subscriptionId(OneSignal, waitMs = 25000) {
  const subscription = OneSignal.User?.PushSubscription;
  if (!subscription) throw new Error('The OneSignal SDK did not expose its push subscription API.');
  const deadline = Date.now() + waitMs;
  while (Date.now() <= deadline) {
    const id = subscription.id;
    if (id && subscription.optedIn === true) return String(id);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(await subscriptionDiagnostic(OneSignal));
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
    const response = await fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
    return response.ok ? response.json().catch(() => ({})) : null;
  } catch { return null; }
}

async function postRequired(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body), keepalive: true,
    });
  } catch {
    throw new Error('Your browser allowed alerts, but FCMOBILETOOLS could not save this subscription. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `FCMOBILETOOLS could not save this subscription (HTTP ${response.status}). Please try again.`);
  }
  return data;
}

/** Tells our own server this device exists, so the studio can count it and send it a test. */
async function register(OneSignal, { source = 'other', welcome = false, force = false, confirmedId = '' } = {}) {
  const id = confirmedId || await subscriptionId(OneSignal);
  if (!id) throw new Error('OneSignal has not finished creating a push subscription for this browser. Your alerts are not confirmed yet. Please retry.');
  const prefs = readPrefs();
  const signature = TOPIC_KEYS.map((key) => (prefs[key] ? '1' : '0')).join('');
  const last = store.json(KEY.registered);
  if (!force && !welcome && last && last.id === id && last.signature === signature && Date.now() - last.at < WEEK) return id;
  const result = await postRequired('/api/push/register', { subscriptionId: id, topics: prefs, locale: locale(), source, welcome });
  if (result?.ok !== true) throw new Error('FCMOBILETOOLS did not confirm that your subscription was saved. Please retry.');
  store.setJson(KEY.registered, { id, signature, at: Date.now() });
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

  // The UI prepares OneSignal before enabling the native permission button. Do not
  // open a prompt after waiting for a network-loaded SDK: browsers may drop user activation.
  let OneSignal = sdkInstance;
  const hadReadySdk = Boolean(OneSignal);
  try { if (!OneSignal) OneSignal = await loadSdk(); } catch (error) {
    return { ok: false, state: 'sdk-blocked', message: String(error?.message || 'OneSignal could not start.') };
  }
  if (permission() !== 'granted' && !hadReadySdk) {
    return { ok: false, state: 'preparing', message: 'OneSignal has finished starting. Tap Enable alerts once more to open the browser permission prompt.' };
  }
  try {
    if (permission() !== 'granted') await OneSignal.Notifications.requestPermission();
    if (permission() === 'denied') { track('blocked', source); return { ok: false, state: emit() }; }
    if (permission() !== 'granted') { sdkState = null; return { ok: false, state: 'dismissed' }; }

    await OneSignal.User.PushSubscription.optIn();
    const id = await subscriptionId(OneSignal);
    await syncTags(OneSignal, prefs, true);
    await register(OneSignal, { source, welcome, force: true, confirmedId: id });

    // Do not show “enabled” until both OneSignal and our registry confirm the subscription.
    store.set(KEY.active, '1');
    sdkState = 'enabled';
    track('enabled', source);
    return { ok: true, state: emit() };
  } catch (error) {
    sdkState = 'error';
    emit();
    return { ok: false, state: 'error', message: String(error?.message || 'The subscription could not be confirmed. Please retry.') };
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
    sdkState = 'enabled';
    emit();
    return { ok: true, state: 'enabled' };
  } catch (error) {
    sdkState = 'error';
    emit();
    return { ok: false, state: 'error', message: String(error?.message || 'Could not update alert preferences. Please retry.') };
  }
}

/** Brings this browser back in line: re-attaches a lost subscription and syncs topics. Never prompts. */
async function reconcile(source = 'other') {
  if (!hasApis || permission() !== 'granted' || store.get(KEY.active) !== '1') return computeState();
  try {
    const OneSignal = await loadSdk();
    if (!OneSignal.User.PushSubscription.optedIn) await OneSignal.User.PushSubscription.optIn();
    const id = await subscriptionId(OneSignal);
    if (!id) throw new Error('OneSignal has not confirmed a push subscription ID for this browser.');
    const prefs = readPrefs();
    await syncTags(OneSignal, prefs);
    await register(OneSignal, { source, confirmedId: id });
    sdkState = 'enabled';
    OneSignal.User.PushSubscription.addEventListener?.('change', (event) => {
      if (event?.current?.optedIn && event?.current?.id) register(OneSignal, { source, force: true, confirmedId: String(event.current.id) }).catch((error) => {
        sdkState = 'error'; emit(); console.warn('[FCPush] Subscription refresh failed:', error?.message || error);
      });
    });
  } catch (error) {
    sdkState = 'error';
    console.warn('[FCPush] Subscription reconciliation failed:', error?.message || error);
  }
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
  prepare: async () => { try { await loadSdk(); return { ok: true, state: 'ready' }; } catch (error) { return { ok: false, state: 'sdk-blocked', message: String(error?.message || 'OneSignal could not start.') }; } },
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
