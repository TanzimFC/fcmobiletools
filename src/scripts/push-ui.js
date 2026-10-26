// Alert panel (opened from the bell) and the soft prompt. Both talk to window.FCPush and never
// request browser permission themselves; permission only appears after someone presses a button.
import './push-client.js';
import { TOPIC_KEYS } from '../lib/pushCore.js';

const dataEl = document.getElementById('fcPushI18n');
const T = (() => { try { return JSON.parse(dataEl?.textContent || '{}'); } catch { return {}; } })();
const FC = window.FCPush;
const $ = (id) => document.getElementById(id);
const panel = $('fcPushPanel');
const sheet = $('fcPushSheet');
const bell = $('fcPushBell');
const backdrop = $('fcPushBackdrop');
if (!FC || !panel || !sheet) throw new Error('push ui not available');

const englishPath = () => (window.FCMT_I18N ? window.FCMT_I18N.englishPath() : location.pathname);
const NEVER_PROMPT = /^\/(admin|account|creator|profile|notifications|giveaways\/claim|trivia\/play|tournament\/|match-center|missions|settings)/i;

/* ------------------------------ panel ------------------------------ */

let panelOpen = false;
let returnFocus = null;

function stateNote(state) {
  if (state === 'ios-install') return T.states.iosInstall;
  if (state === 'denied') return T.states.denied;
  if (state === 'unsupported') return T.states.unsupported;
  if (state === 'sdk-blocked') return T.states.sdkBlocked;
  return '';
}

function renderPanel() {
  const state = FC.state();
  const prefs = FC.prefs();
  const on = state === 'enabled';
  const blocked = ['ios-install', 'denied', 'unsupported', 'sdk-blocked'].includes(state);
  const pill = $('fcPushPill');
  pill.dataset.state = on ? 'on' : state === 'paused' ? 'paused' : blocked ? 'blocked' : 'off';
  pill.querySelector('span').textContent = on ? T.panel.on : state === 'paused' ? T.panel.paused : T.panel.off;
  const note = $('fcPushNote');
  const text = stateNote(state);
  note.hidden = !text;
  note.textContent = text;
  panel.dataset.state = state;
  for (const input of panel.querySelectorAll('[data-topic]')) {
    input.checked = Boolean(prefs[input.dataset.topic]);
    input.disabled = blocked;
  }
  panel.querySelector('.fcp-topics').dataset.pending = on || blocked ? 'false' : 'true';
  const enable = $('fcPushEnable');
  enable.hidden = on || blocked;
  enable.textContent = state === 'paused' ? T.panel.resume : T.panel.enable;
  $('fcPushPause').hidden = !on;
}

function renderBell() {
  if (!bell) return;
  const state = FC.state();
  const invite = state === 'available' || state === 'can-resume';
  bell.dataset.state = state === 'enabled' ? 'on' : invite ? 'invite' : 'idle';
  if (state === 'unsupported') bell.hidden = true;
}

function flash(message, tone = 'good') {
  const el = $('fcPushFlash');
  el.textContent = message;
  el.dataset.tone = tone;
  el.classList.add('is-on');
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => el.classList.remove('is-on'), 2400);
}

function openPanel() {
  if (panelOpen) return;
  hideSheet();
  panelOpen = true;
  returnFocus = document.activeElement;
  renderPanel();
  panel.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => { panel.classList.add('is-open'); backdrop.classList.add('is-open'); });
  bell?.setAttribute('aria-expanded', 'true');
  setTimeout(() => (panel.querySelector('#fcPushEnable:not([hidden])') || panel.querySelector('input:not([disabled])') || $('fcPushClose')).focus({ preventScroll: true }), 60);
}
function closePanel() {
  if (!panelOpen) return;
  panelOpen = false;
  panel.classList.remove('is-open');
  backdrop.classList.remove('is-open');
  bell?.setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!panelOpen) { panel.hidden = true; backdrop.hidden = true; } }, 220);
  if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
}

function reportResult(result) {
  if (!result) return;
  if (result.ok) { flash(result.state === 'enabled' ? T.states.enabled : T.panel.saved); return; }
  if (result.message) { flash(result.message, 'bad'); return; }
  if (result.state === 'dismissed') flash(T.states.dismissed, 'info');
  else if (result.state === 'denied') flash(T.states.denied, 'bad');
  else if (result.state === 'sdk-blocked') flash(T.states.sdkBlocked, 'bad');
  else flash(T.states.error, 'bad');
}

bell?.addEventListener('click', () => (panelOpen ? closePanel() : openPanel()));
$('fcPushClose').addEventListener('click', closePanel);
backdrop.addEventListener('click', closePanel);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { if (panelOpen) closePanel(); else if (!sheet.hidden) dismissSheet(false); }
});
document.addEventListener('click', (event) => {
  if (!panelOpen) return;
  if (panel.contains(event.target) || bell?.contains(event.target)) return;
  closePanel();
});

$('fcPushEnable').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true; button.textContent = T.panel.working;
  reportResult(await FC.enable({ source: 'bell', welcome: FC.state() !== 'paused' }));
  button.disabled = false; renderPanel(); renderBell();
});
$('fcPushPause').addEventListener('click', async (event) => {
  event.currentTarget.disabled = true;
  reportResult(await FC.pause('bell'));
  event.currentTarget.disabled = false; renderPanel(); renderBell();
});
panel.addEventListener('change', async (event) => {
  const input = event.target.closest('[data-topic]');
  if (!input) return;
  input.disabled = true;
  const result = await FC.setTopic(input.dataset.topic, input.checked, 'bell');
  input.disabled = false;
  reportResult(result);
  renderPanel(); renderBell();
});

/* ---------------------------- soft prompt ---------------------------- */

const VARIANTS = {
  redeem: { title: 'redeemTitle', body: 'redeemBody', topics: ['redeem_codes'] },
  events: { title: 'eventsTitle', body: 'eventsBody', topics: ['live_events', 'daily_reset'] },
  article: { title: 'articleTitle', body: 'articleBody', topics: ['redeem_codes'] },
  default: { title: 'defaultTitle', body: 'defaultBody', topics: ['redeem_codes', 'live_events'] },
};
let variant = 'default';
let sheetShown = false;

function variantForPage() {
  const path = englishPath();
  if (path.startsWith('/redeem-codes')) return 'redeem';
  if (path.startsWith('/events')) return 'events';
  if (path.startsWith('/blog/')) return 'article';
  return 'default';
}
function hideSheet() { sheet.classList.remove('is-open'); setTimeout(() => { if (!sheet.classList.contains('is-open')) sheet.hidden = true; }, 220); }
function consentOpen() {
  const banner = document.getElementById('fcmtConsent');
  const modal = document.getElementById('fcmtConsentModal');
  return Boolean((banner && !banner.hidden) || (modal && !modal.hidden));
}

function showSheet(which = variantForPage(), source = 'sheet') {
  if (sheetShown || panelOpen || consentOpen() || document.visibilityState !== 'visible') return false;
  if (!(FC.state() === 'available' || FC.state() === 'can-resume')) return false;
  variant = which;
  const copy = VARIANTS[which] || VARIANTS.default;
  $('fcPushSheetTitle').textContent = T.sheet[copy.title];
  $('fcPushSheetBody').textContent = T.sheet[copy.body];
  sheet.dataset.source = source;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  sheetShown = true;
  FC.track('shown', source);
  return true;
}
function dismissSheet(forever) {
  FC.rememberDismiss(forever);
  FC.track('dismissed', sheet.dataset.source || 'sheet');
  hideSheet();
}

$('fcPushSheetYes').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const copy = VARIANTS[variant] || VARIANTS.default;
  button.disabled = true;
  const source = sheet.dataset.source || 'sheet';
  const result = await FC.enable({ topics: Object.fromEntries(copy.topics.map((key) => [key, true])), source });
  button.disabled = false;
  hideSheet();
  reportResult(result);
  renderBell();
});
$('fcPushSheetLater').addEventListener('click', () => dismissSheet(false));
$('fcPushSheetNever').addEventListener('click', () => dismissSheet(true));
$('fcPushSheetChoose').addEventListener('click', () => { hideSheet(); openPanel(); });

/* ------------------------------ boot ------------------------------ */

window.addEventListener('fcmt:push-state', () => { renderBell(); if (panelOpen) renderPanel(); });
window.addEventListener('fcmt:push-open', openPanel);
// A copied code is the moment someone cares most about the next one.
window.addEventListener('fcmt:code-copied', () => {
  FC.config().then((config) => {
    if (!config.promptEnabled || !FC.mayAsk(0)) return;
    setTimeout(() => showSheet('redeem', 'redeem_copy'), 1400);
  });
});
window.FCPushUI = { openPanel, closePanel, showSheet };

FC.config().then((config) => {
  if (bell && config.bellEnabled === false) bell.hidden = true;
  renderBell();
  const path = englishPath();
  // The redeem page has its own alert card, so the timed prompt stays away from it.
  if (!config.promptEnabled || NEVER_PROMPT.test(path) || path.startsWith('/redeem-codes')) return;
  if (!FC.mayAsk(config.minPageViews)) return;
  let engaged = false;
  const markEngaged = () => { engaged = true; };
  for (const name of ['scroll', 'pointerdown', 'keydown', 'touchstart']) window.addEventListener(name, markEngaged, { once: true, passive: true });
  const attempt = (tries = 0) => {
    if (sheetShown || tries > 40) return;
    if (!engaged || consentOpen()) return setTimeout(() => attempt(tries + 1), 1500);
    showSheet(variantForPage(), 'sheet');
  };
  setTimeout(() => attempt(), Math.max(3, config.delaySeconds) * 1000);
});
renderBell();
