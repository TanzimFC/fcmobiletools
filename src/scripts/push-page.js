// The alerts page. Same engine as the bell: flipping a topic on turns alerts on in the same step.
import './push-client.js';

const FC = window.FCPush;
const root = document.querySelector('[data-push-page]');
const T = (() => { try { return JSON.parse(document.getElementById('push-page-i18n')?.textContent || '{}'); } catch { return {}; } })();

if (FC && root && T.panel) {
  const $ = (id) => document.getElementById(id);
  const status = $('pushStatus');
  const note = $('pushNote');
  const list = $('pushTopics');
  const enable = $('pushEnable');
  const pause = $('pushPause');
  const flash = $('pushFlash');
  const inputs = [...document.querySelectorAll('[data-push-topic]')];
  let preparing = true;
  let prepareError = '';
  const NOTES = { 'ios-install': 'iosInstall', denied: 'denied', unsupported: 'unsupported', 'sdk-blocked': 'sdkBlocked' };

  const say = (message, tone = '') => { flash.textContent = message || ''; flash.dataset.tone = tone; };
  const explain = (result) => {
    if (result.ok) return say(result.state === 'enabled' ? T.states.enabled : T.panel.saved, 'good');
    if (result.message) return say(result.message, 'bad');
    if (result.state === 'dismissed') return say(T.states.dismissed);
    say(T.states[NOTES[result.state] || 'error'], 'bad');
  };

  function render() {
    const state = FC.state();
    const prefs = FC.prefs();
    const on = state === 'enabled';
    const blocked = Boolean(NOTES[state]);
    const hardBlocked = ['ios-install', 'denied', 'unsupported'].includes(state);
    status.dataset.state = on ? 'on' : state === 'paused' ? 'paused' : blocked ? 'blocked' : 'idle';
    status.querySelector('span').textContent = on ? T.panel.on : state === 'paused' ? T.panel.paused : T.panel.off;
    note.hidden = !blocked;
    note.textContent = blocked ? (state === 'sdk-blocked' && prepareError ? prepareError : T.states[NOTES[state]]) : '';
    list.dataset.pending = on || blocked ? 'false' : 'true';
    for (const input of inputs) { input.checked = Boolean(prefs[input.dataset.pushTopic]); input.disabled = blocked || preparing; }
    enable.hidden = on || hardBlocked;
    enable.disabled = preparing;
    enable.textContent = preparing ? T.panel.working : state === 'paused' ? T.panel.resume : T.panel.enable;
    pause.hidden = !on;
  }

  enable.addEventListener('click', async () => {
    enable.disabled = true; enable.textContent = T.panel.working;
    explain(await FC.enable({ source: 'notifications_page', welcome: FC.state() !== 'paused' }));
    enable.disabled = false; render();
  });
  pause.addEventListener('click', async () => { pause.disabled = true; explain(await FC.pause('notifications_page')); pause.disabled = false; render(); });
  list.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-push-topic]');
    if (!input) return;
    input.disabled = true;
    explain(await FC.setTopic(input.dataset.pushTopic, input.checked, 'notifications_page'));
    input.disabled = false; render();
  });
  window.addEventListener('fcmt:push-state', render);
  render();
  FC.prepare().then((result) => {
    preparing = false;
    prepareError = result.ok ? '' : (result.message || T.states.sdkBlocked);
    if (!result.ok) say(prepareError, 'bad');
    render();
  });
}
