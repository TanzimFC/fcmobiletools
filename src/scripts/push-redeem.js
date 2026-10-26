// The redeem page alert card: one switch, real numbers, and a floating prompt once the card scrolls away.
import './push-client.js';

const root = document.querySelector('[data-rx-alert]');
const FC = window.FCPush;
const dataEl = document.getElementById('rx-alert-i18n');
const T = (() => { try { return JSON.parse(dataEl?.textContent || '{}'); } catch { return {}; } })();

if (root && FC && T.card) {
  const R = T.card;
  const $ = (selector) => root.querySelector(selector);
  const toggle = $('[data-rx-alert-toggle]');
  const cta = $('[data-rx-alert-cta]');
  const status = $('[data-rx-alert-status]');
  const manage = $('[data-rx-alert-manage]');
  const facts = $('[data-rx-alert-facts]');
  const sticky = document.querySelector('[data-rx-alert-sticky]');
  const SOURCE = 'redeem_page';
  const BLOCKED = { 'ios-install': 'iosInstall', denied: 'denied', unsupported: 'unsupported', 'sdk-blocked': 'sdkBlocked' };
  let cardAbove = false;
  let busy = false;

  const dayNumber = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000); };
  const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (_, key) => (vars[key] === undefined ? '' : vars[key]));

  function say(message, tone = '') { status.textContent = message || ''; status.dataset.tone = tone; }

  function render() {
    const state = FC.state();
    const prefs = FC.prefs();
    const blockedKey = BLOCKED[state];
    const on = state === 'enabled' && prefs.redeem_codes;
    root.dataset.state = blockedKey ? 'blocked' : on ? 'on' : 'off';
    toggle.checked = on;
    toggle.disabled = busy || Boolean(blockedKey);
    cta.hidden = on || Boolean(blockedKey);
    cta.disabled = busy;
    manage.hidden = !on;
    if (blockedKey) say(T.states[blockedKey], 'bad');
    else if (on) say(R.statusOn, 'good');
    else if (!busy) say('');
    sticky?.classList.toggle('is-on', !on && !blockedKey && cardAbove && state !== 'paused');
    renderResetOffer(on, prefs);
  }

  let resetBtn = null;
  function renderResetOffer(on, prefs) {
    if (!on || prefs.daily_reset) { resetBtn?.remove(); resetBtn = null; return; }
    if (resetBtn) return;
    resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'rx-alert-manage';
    resetBtn.textContent = '+ ' + R.reset;
    resetBtn.addEventListener('click', async () => { resetBtn.disabled = true; await FC.setTopic('daily_reset', true, SOURCE); });
    manage.before(resetBtn);
  }

  async function turnOn() {
    if (busy) return;
    busy = true; render(); say(T.panel.working);
    const result = await FC.enable({ topics: { redeem_codes: true }, source: SOURCE });
    busy = false;
    if (!result.ok) {
      const key = result.state === 'dismissed' ? 'dismissed' : BLOCKED[result.state] || 'error';
      render(); say(T.states[key], result.state === 'dismissed' ? '' : 'bad');
      return;
    }
    render(); say(R.enabledToast, 'good');
  }
  async function turnOff() {
    busy = true; render();
    await FC.setTopic('redeem_codes', false, SOURCE);
    busy = false; render();
  }

  toggle.addEventListener('change', () => (toggle.checked ? turnOn() : turnOff()));
  cta.addEventListener('click', turnOn);
  manage.addEventListener('click', () => window.dispatchEvent(new CustomEvent('fcmt:push-open')));
  sticky?.addEventListener('click', turnOn);
  window.addEventListener('fcmt:push-state', render);

  // Real numbers from the live code list, never invented ones.
  window.addEventListener('fcmt:redeem-data', (event) => {
    const { codes = [], serverDate } = event.detail || {};
    const today = dayNumber(serverDate);
    const released = codes.filter((code) => code.status !== 'scheduled' && code.releaseDate && today - dayNumber(code.releaseDate) >= 0);
    const recent = released.filter((code) => today - dayNumber(code.releaseDate) <= 30);
    facts.textContent = '';
    const add = (text) => { const li = document.createElement('li'); li.textContent = text; facts.appendChild(li); };
    if (recent.length) add(recent.length === 1 ? R.addedOne : fill(R.addedMany, { n: recent.length }));
    const newest = released.map((code) => code.releaseDate).sort().pop();
    if (newest) {
      const days = today - dayNumber(newest);
      add(fill(R.latest, { when: days <= 0 ? R.today : days === 1 ? R.yesterday : fill(R.daysAgo, { n: days }) }));
    }
  });

  FC.config().then((config) => {
    if (config.redeemCardEnabled === false) { root.hidden = true; if (sticky) sticky.hidden = true; return; }
    if (sticky) sticky.hidden = false;
    render();
    if ('IntersectionObserver' in window) {
      let reported = false;
      new IntersectionObserver((entries) => {
        for (const entry of entries) {
          cardAbove = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          if (entry.isIntersecting && !reported && (FC.state() === 'available' || FC.state() === 'can-resume')) { reported = true; FC.track('shown', SOURCE); }
        }
        render();
      }, { threshold: [0, 0.4] }).observe(root);
    }
  });
}
