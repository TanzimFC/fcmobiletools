// Shared live redeem-code summary used by the homepage and Events hub.
// The full Redeem Codes page and these small panels read the same public D1-backed endpoint.
const API = '/api/public/redeem-codes?view=summary';
const BOOTSTRAP_ID = 'fcmt-current-redeem-bootstrap';
const POLL_MS = 120_000;

const readBootstrap = () => {
  try {
    const raw = document.getElementById(BOOTSTRAP_ID)?.textContent || 'null';
    const value = JSON.parse(raw);
    return value?.version === 1 ? value : null;
  } catch {
    return null;
  }
};

const escapeText = (value) => String(value ?? '');
const formatDate = (value) => {
  if (!value) return 'date unavailable';
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00Z');
  return Number.isNaN(date.valueOf())
    ? 'date unavailable'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
const formatSync = (value) => {
  const source = value?.generatedAt || value?.updatedAt;
  if (!source) return 'time unavailable';
  const date = new Date(source);
  return Number.isNaN(date.valueOf())
    ? 'time unavailable'
    : date.toLocaleString(undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
};
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = escapeText(text);
  return element;
};
const setText = (selector, value) => {
  document.querySelectorAll(selector).forEach((element) => { element.textContent = escapeText(value); });
};
const replace = (element, children) => {
  if (element) element.replaceChildren(...children);
};

function renderUnavailable() {
  const card = document.querySelector('[data-fcmt-current-code]');
  if (card) {
    card.classList.remove('is-active', 'is-expired');
    card.classList.add('is-none');
    delete card.dataset.hxExpires;
    const status = card.querySelector('[data-fcmt-code-status]');
    if (status) status.textContent = 'Live data unavailable';
    const body = card.querySelector('[data-fcmt-code-body]');
    const message = node('p', 'hx-code__none', 'Current code status is unavailable.');
    const detail = node('p', 'hx-code__reward', 'Use the full list to check current codes, regions and expiry dates.');
    const link = node('a', 'hx-textlink', 'Open full code list →');
    link.href = '/redeem-codes/';
    replace(body, [message, detail, link]);
    const foot = card.querySelector('[data-fcmt-code-foot]');
    if (foot) foot.textContent = 'Live code data could not be loaded.';
  }

  const recent = document.querySelector('[data-fcmt-code-recent]');
  if (recent) {
    const line = node('span', 'hx-recent__row');
    line.append(node('b', '', 'Current codes'), node('i', '', 'Open the live list'), node('em', '', 'View all'));
    replace(recent, [line]);
  }
  setText('[data-fcmt-code-total]', '—');
  setText('[data-fcmt-code-active]', '—');
  setText('[data-fcmt-code-sync-value]', '—');
  setText('[data-fcmt-code-proof]', 'Live code status unavailable');
  setText('[data-fcmt-code-count]', 'Live status unavailable');
  setText('[data-fcmt-code-latest]', 'Open the full code list →');
}

function renderSummary(summary) {
  if (!summary || summary.version !== 1) {
    renderUnavailable();
    return;
  }

  const synced = formatSync(summary);
  setText('[data-fcmt-code-total]', summary.total ?? 0);
  setText('[data-fcmt-code-active]', summary.activeCount ?? 0);
  setText('[data-fcmt-code-sync-value]', synced);
  setText('[data-fcmt-code-proof]', 'Codes data synced ' + synced);

  const card = document.querySelector('[data-fcmt-current-code]');
  const active = summary.newestActive;
  if (card) {
    const status = card.querySelector('[data-fcmt-code-status]');
    const body = card.querySelector('[data-fcmt-code-body]');
    const foot = card.querySelector('[data-fcmt-code-foot]');
    card.classList.remove('is-expired');

    if (active?.code) {
      card.classList.remove('is-none');
      card.classList.add('is-active');
      if (active.expiryDate) card.dataset.hxExpires = String(Date.parse(active.expiryDate + 'T23:59:59Z'));
      else delete card.dataset.hxExpires;
      if (status) status.textContent = 'Active';

      const button = node('button', 'hx-copy');
      button.type = 'button';
      button.dataset.hxCopy = active.code;
      button.dataset.fcmtLiveCopy = 'true';
      button.setAttribute('aria-label', 'Copy code ' + active.code);
      button.append(node('strong', '', active.code));
      const action = node('span', 'hx-copy__act');
      action.append(node('em', '', 'Copy'));
      button.append(action);
      const reward = node('p', 'hx-code__reward', active.reward || 'Reward details unavailable.');
      replace(body, [button, reward]);

      const verified = active.lastVerified ? 'verified ' + formatDate(active.lastVerified) : 'verification date unavailable';
      const region = active.region || 'Global';
      if (foot) foot.textContent = region + ' · ' + verified + ' · synced ' + synced;
    } else {
      card.classList.remove('is-active');
      card.classList.add('is-none');
      delete card.dataset.hxExpires;
      if (status) status.textContent = 'None active';
      const message = node('p', 'hx-code__none', 'No active code right now');
      const detail = node('p', 'hx-code__reward', 'Check the full list for the newest releases and their status.');
      const link = node('a', 'hx-textlink', 'Open full code list →');
      link.href = '/redeem-codes/';
      replace(body, [message, detail, link]);
      if (foot) foot.textContent = 'Data synced ' + synced;
    }
  }

  const recent = document.querySelector('[data-fcmt-code-recent]');
  if (recent) {
    const rows = (Array.isArray(summary.recentCodes) ? summary.recentCodes : []).map((code) => {
      const row = node('span', 'hx-recent__row' + (code.status === 'active' ? ' is-live' : ''));
      row.append(
        node('b', '', code.code || 'Code unavailable'),
        node('i', '', code.reward || 'Reward details unavailable'),
        node('em', '', code.status === 'active' ? 'Active' : code.status === 'scheduled' ? 'Scheduled' : 'Expired')
      );
      return row;
    });
    if (rows.length) replace(recent, rows);
    else {
      const row = node('span', 'hx-recent__row');
      row.append(node('b', '', 'Current codes'), node('i', '', 'Open the live list'), node('em', '', 'View all'));
      replace(recent, [row]);
    }
  }

  const eventCount = document.querySelector('[data-fcmt-code-count]');
  if (eventCount) eventCount.textContent = String(summary.activeCount ?? 0) + ' active';
  const eventLatest = document.querySelector('[data-fcmt-code-latest]');
  if (eventLatest) {
    eventLatest.textContent = active?.code
      ? 'Newest active: ' + active.code + ' · synced ' + synced + ' →'
      : 'No active codes · View full list →';
  }
}

let currentSummary = readBootstrap();
if (currentSummary?.developmentFallback) {
  renderSummary(currentSummary);
} else {
  let refreshInFlight = null;
  renderSummary(currentSummary);
  refresh();

  async function refresh() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const response = await fetch(API, {
          method: 'GET',
          headers: { accept: 'application/json' },
          cache: 'no-store',
          credentials: 'same-origin'
        });
        if (!response.ok) throw new Error('Live code summary unavailable.');
        const payload = await response.json();
        if (payload?.version !== 1) throw new Error('Unexpected live code summary.');
        currentSummary = payload;
        renderSummary(currentSummary);
      } catch {
        currentSummary = null;
        renderUnavailable();
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  window.setInterval(() => {
    if (document.visibilityState === 'visible') refresh();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('online', refresh);
}

// Use delegated handling because the current-code button is rebuilt when live data refreshes.
document.addEventListener('click', async (event) => {
  const button = event.target?.closest?.('[data-fcmt-live-copy]');
  if (!button) return;
  const value = button.dataset.hxCopy || '';
  const label = button.querySelector('[data-hx-copy-label]') || button.querySelector('em');
  let copied = false;
  try {
    await navigator.clipboard.writeText(value);
    copied = true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(area);
      area.select();
      copied = document.execCommand('copy');
      area.remove();
    } catch {}
  }
  if (label) {
    label.textContent = copied ? 'Copied' : 'Copy failed';
    window.setTimeout(() => { if (label.isConnected) label.textContent = 'Copy'; }, 1600);
  }
});
