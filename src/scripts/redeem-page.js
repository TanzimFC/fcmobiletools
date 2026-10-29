// FC Mobile redeem page — client runtime.
//
// The Worker injects today's snapshot into #rx-bootstrap, so the first render needs
// no network round trip. After that the page keeps itself live by polling
// /api/public/redeem-codes. Every dynamic string is escaped before it touches
// innerHTML.

import { createLocalStore, rankActive, pickTicket } from './redeem-local.js';

const API = '/api/public/redeem-codes';
const VOTE_API = `${API}/vote`;
const MINE_API = `${API}/my-votes`;
const EA_URL = 'https://redeem.fcm.ea.com/';
const POLL_MS = 120_000;
const PAGE_SIZE = 20;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const root = document.querySelector('[data-rx]');

// Translations for this page's language, rendered by the server (English fallback already applied).
const I18N = (() => {
  try { return JSON.parse(document.getElementById('rx-i18n')?.textContent || 'null'); } catch { return null; }
})();
const U = I18N?.ui;
const LOCALE = I18N?.htmlLang || 'en';
// Latin digits in every language so counts, dates and code values stay consistent.
const DATE_LOCALE = LOCALE === 'en' ? 'en-US' : `${LOCALE}-u-nu-latn`;
const fmt = (text, vars) => String(text).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
if (root) boot();

function boot() {
  const $ = (sel, scope = root) => scope.querySelector(sel);
  const $$ = (sel, scope = root) => [...scope.querySelectorAll(sel)];

  const el = {
    ticket: $('[data-rx-ticket]'),
    active: $('[data-rx-active]'),
    activeCount: $('[data-rx-active-count]'),
    upcoming: $('[data-rx-upcoming]'),
    upcomingList: $('[data-rx-upcoming-list]'),
    list: $('[data-rx-list]'),
    more: $('[data-rx-more]'),
    count: $('[data-rx-count]'),
    search: $('[data-rx-search]'),
    clear: $('[data-rx-clear]'),
    statusTabs: $('[data-rx-status]'),
    types: $('[data-rx-types]'),
    sort: $('[data-rx-sort]'),
    syncDot: $('[data-rx-sync-dot]'),
    syncText: $('[data-rx-sync-text]'),
    toast: $('[data-rx-toast]'),
    strip: $('[data-rx-strip]'),
  };

  // What this device remembers: ticks, last-seen codes, my votes. Never throws (see redeem-local.js).
  let storage = null;
  try { storage = window.localStorage; } catch { /* blocked: the store falls back to memory */ }
  const local = createLocalStore(storage);
  const pageStart = Date.now();

  /* ------------------------------ utilities ------------------------------ */

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const dayNumber = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86_400_000;
  };
  const fmtDate = (iso, withYear = true) => iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(DATE_LOCALE, { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    : '—';

  let refreshInFlight = null;

  const state = {
    codes: [],
    serverDate: new Date().toISOString().slice(0, 10),
    updatedAt: null,
    q: '',
    status: 'all',
    type: 'all',
    sort: 'new',
    shown: PAGE_SIZE,
    lastSync: 0,
    online: true,
    firstRender: true,
    etag: null,
    fresh: new Set(), // codes that are new for THIS player (not in what they saw last visit)
    baselineChecked: false,
    stripDismissed: false,
  };

  const age = (iso) => {
    const d = dayNumber(state.serverDate) - dayNumber(iso);
    if (d <= 0) return U.age.today;
    if (d === 1) return U.age.yesterday;
    if (d < 14) return fmt(U.age.daysAgo, { n: d });
    return fmtDate(iso);
  };

  /* ------------------------------ community + memory helpers ------------------------------ */

  const EMPTY_COMMUNITY = { state: 'ok', confirmed: false, lastAt: null, resetAt: null };
  const community = (c) => c.community || EMPTY_COMMUNITY;
  const myVote = (c) => local.votes.get(c.code, community(c).resetAt);
  const isRedeemed = (code) => local.redeemed.has(code);

  const whenAgo = (iso) => {
    const ms = Date.now() - Date.parse(iso);
    if (!(ms >= 0)) return U.vote.justNow;
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 2) return U.vote.justNow;
    if (minutes < 60) return fmt(U.vote.minAgo, { n: minutes });
    const hours = Math.floor(minutes / 60);
    return hours < 48 ? fmt(U.vote.hourAgo, { n: hours }) : age(String(iso).slice(0, 10));
  };

  const authToken = () => {
    try {
      const raw = localStorage.getItem('fcmobiletools-auth-v1');
      const auth = raw ? JSON.parse(raw) : null;
      return auth?.access_token || auth?.session?.access_token || auth?.currentSession?.access_token || '';
    } catch { return ''; }
  };

  /* ------------------------------ reward model ------------------------------ */

  const KINDS = {
    gems: { label: U.kinds.gems, icon: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 18 3-18"/>' },
    coins: { label: U.kinds.coins, icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>' },
    rankup: { label: U.kinds.rankup, icon: '<path d="M6 11l6-6 6 6M6 19l6-6 6 6"/>' },
    shards: { label: U.kinds.shards, icon: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8L12 3z"/>' },
    voucher: { label: U.kinds.voucher, icon: '<path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>' },
    player: { label: U.kinds.player, icon: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>' },
    pack: { label: U.kinds.pack, icon: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>' },
    kit: { label: U.kinds.kit, icon: '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 01-8 0z"/>' },
    other: { label: U.kinds.other, icon: '<path d="M20 12v8H4v-8M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 110-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 100-5C13 2 12 7 12 7z"/>' },
  };

  const kindOf = (text) => {
    if (/\bgems?\b/i.test(text)) return 'gems';
    if (/\bcoins?\b/i.test(text)) return 'coins';
    if (/rank[\s-]?up|\bRU\b/i.test(text)) return 'rankup';
    if (/shards?/i.test(text)) return 'shards';
    if (/voucher/i.test(text)) return 'voucher';
    if (/\bovr\b|player|icons?\b/i.test(text)) return 'player';
    if (/pack|bundle|gift/i.test(text)) return 'pack';
    if (/kit|logo|emote/i.test(text)) return 'kit';
    return 'other';
  };

  const parts = (reward) => String(reward).split(/\s+\+\s+/).map((s) => s.trim()).filter(Boolean);
  const kindsOf = (c) => [...new Set(parts(c.reward).map(kindOf))];

  const icon = (path, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const I = {
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    out: '<path d="M7 17L17 7M9 7h8v8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gift: KINDS.other.icon,
  };

  const chips = (reward, limit = 99) => {
    const list = parts(reward);
    const shown = list.slice(0, limit);
    const more = list.length - shown.length;
    return shown.map((p) => `<span class="rx-chip rx-chip-${kindOf(p)}">${icon(KINDS[kindOf(p)].icon, 14)}<span>${esc(p)}</span></span>`).join('')
      + (more > 0 ? `<span class="rx-chip rx-chip-more">+${more}</span>` : '');
  };

  /* ------------------------------ status helpers ------------------------------ */

  const STATUS_LABEL = { active: U.status.active, scheduled: U.status.scheduled, expired: U.status.expired };
  const pill = (status) => `<span class="rx-pill rx-pill-${esc(status)}"><i></i>${STATUS_LABEL[status] || U.status.unknown}</span>`;

  const expiry = (c) => {
    if (!c.expiryDate) return { text: U.expiry.none, tone: 'calm' };
    const left = dayNumber(c.expiryDate) - dayNumber(state.serverDate);
    if (left < 0) return { text: fmt(U.expiry.ended, { date: fmtDate(c.expiryDate, false) }), tone: 'calm' };
    if (left === 0) return { text: U.expiry.lastDay, tone: 'urgent' };
    if (left === 1) return { text: U.expiry.tomorrow, tone: 'urgent' };
    if (left <= 7) return { text: fmt(U.expiry.inDays, { n: left }), tone: 'soon' };
    return { text: fmt(U.expiry.on, { date: fmtDate(c.expiryDate, false) }), tone: 'calm' };
  };

  const isNew = (c) => dayNumber(state.serverDate) - dayNumber(c.releaseDate) <= 2;
  const eaLink = (code, region) => /vietnam/i.test(String(region || ''))
    ? 'https://redeem.fcmobile.garena.vn/'
    : `${EA_URL}?redeemCode=${encodeURIComponent(code)}`;

  /* ------------------------------ renderers ------------------------------ */

  const activeCodes = () => state.codes.filter((c) => c.status === 'active');
  const upcomingCodes = () => state.codes.filter((c) => c.status === 'scheduled');

  function barcode(code) {
    let x = 0;
    const bars = [];
    for (let i = 0; i < 34; i += 1) {
      const n = code.charCodeAt(i % code.length) + i * 7;
      const w = 1 + (n % 3);
      if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="26" rx=".4"/>`);
      x += w + 1.4;
    }
    return `<svg viewBox="0 0 ${Math.ceil(x)} 26" preserveAspectRatio="none" aria-hidden="true" fill="currentColor">${bars.join('')}</svg>`;
  }

  function renderTicket() {
    if (!el.ticket) return;
    // Never advertise a code players report as dead while a healthier one exists.
    const latest = pickTicket(activeCodes());
    if (latest) {
      const ex = expiry(latest);
      el.ticket.innerHTML = `
        <div class="rx-ticket-top">
          <span class="rx-ticket-brand">${icon(I.gift, 16)} ${esc(U.ticket.brand)}</span>
          <span class="rx-ticket-live"><i></i>${esc(U.ticket.live)}</span>
        </div>
        <div class="rx-ticket-label">${esc(isNew(latest) ? U.ticket.newest : U.ticket.latest)}</div>
        <button type="button" class="rx-ticket-code" data-copy="${esc(latest.code)}" style="--len:${latest.code.length}" aria-label="${esc(fmt(U.ticket.copyAria, { code: latest.code }))}">
          <span>${esc(latest.code)}</span>
        </button>
        <div class="rx-ticket-rewards">${chips(latest.reward, 3)}</div>
        <div class="rx-ticket-perf" aria-hidden="true"></div>
        <div class="rx-ticket-foot">
          <div><small>${esc(U.ticket.added)}</small><b>${esc(fmtDate(latest.releaseDate, false))}</b></div>
          <div><small>${esc(U.ticket.status)}</small><b class="rx-tone-${ex.tone}">${esc(ex.text)}</b></div>
          <div class="rx-ticket-bars">${barcode(latest.code)}</div>
        </div>
        <button type="button" class="rx-ticket-tap" data-copy="${esc(latest.code)}">${icon(I.copy, 15)}<span>${esc(U.ticket.tapToCopy)}</span></button>`;
      el.ticket.dataset.state = 'live';
      return;
    }
    const last = state.codes.find((c) => c.status === 'expired');
    el.ticket.innerHTML = `
      <div class="rx-ticket-top">
        <span class="rx-ticket-brand">${icon(I.gift, 16)} ${esc(U.ticket.brand)}</span>
        <span class="rx-ticket-live rx-ticket-idle"><i></i>${esc(U.ticket.waiting)}</span>
      </div>
      <div class="rx-ticket-label">${esc(U.ticket.none)}</div>
      <div class="rx-ticket-code rx-ticket-code-ghost" style="--len:8"><span>${last ? esc(last.code) : '— — — —'}</span></div>
      <div class="rx-ticket-rewards"><span class="rx-chip">${last ? esc(fmt(U.expiry.ended, { date: fmtDate(last.expiryDate || last.lastVerified, false) })) : esc(U.ticket.checkBack)}</span></div>
      <div class="rx-ticket-perf" aria-hidden="true"></div>
      <div class="rx-ticket-foot rx-ticket-foot-idle"><p>${esc(U.ticket.idleNote)}</p></div>`;
    el.ticket.dataset.state = 'idle';
  }

  const checkSvg = icon(I.check, 14);
  const sparkSvg = icon('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>', 15);

  function feedback(c) {
    const com = community(c);
    const mine = myVote(c);
    const done = isRedeemed(c.code);
    // Plain words only: no counts. The admin's own re-check is shown first because it outranks players.
    const bits = [];
    if (com.resetAt && Date.now() - Date.parse(com.resetAt) < 86_400_000) bits.push(fmt(U.vote.adminChecked, { when: whenAgo(com.resetAt) }));
    if (com.lastAt) bits.push(fmt(U.vote.last, { when: whenAgo(com.lastAt) }));
    else if (!bits.length) bits.push(U.vote.none);
    return `
        <div class="rx-feedback" data-fb="${esc(c.code)}" data-mine="${mine ? mine.v : 'none'}">
          <div class="rx-fb-head">
            <span class="rx-fb-q">${esc(U.vote.q)}</span>
            <button type="button" class="rx-tick${done ? ' is-on' : ''}" data-tick="${esc(c.code)}" aria-pressed="${done}" aria-label="${esc(fmt(done ? U.mine.unmarkAria : U.mine.markAria, { code: c.code }))}">
              <span class="rx-tick-box">${checkSvg}</span><span class="rx-tick-text">${esc(done ? U.mine.redeemed : U.mine.mark)}</span>
            </button>
          </div>
          <div class="rx-vote-btns">
            <button type="button" class="rx-vbtn rx-vbtn-ok" data-vote="worked" aria-pressed="${mine?.v === 'worked'}" aria-label="${esc(fmt(U.vote.workedAria, { code: c.code }))}">
              ${icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 17)}<span>${esc(U.vote.worked)}</span>
            </button>
            <button type="button" class="rx-vbtn rx-vbtn-bad" data-vote="failed" aria-pressed="${mine?.v === 'failed'}" aria-label="${esc(fmt(U.vote.failedAria, { code: c.code }))}">
              ${icon('<path d="M6 6l12 12M18 6L6 18"/>', 17)}<span>${esc(U.vote.failed)}</span>
            </button>
          </div>
          ${mine?.v === 'failed' ? `<div class="rx-vfix"><span>${esc(U.vote.fixQ)}</span><button type="button" data-vote-fix="used">${esc(U.vote.used)}</button><button type="button" data-vote-fix="region">${esc(U.vote.region)}</button></div>` : ''}
          ${com.state === 'review' ? `<p class="rx-fb-warn">${esc(U.vote.review)}</p>` : ''}
          <p class="rx-fb-note">${esc(bits.join(' · '))}</p>
        </div>`;
  }

  function activeCard(c, index) {
    const ex = expiry(c);
    const fresh = isNew(c);
    const com = community(c);
    const dead = com.state === 'possibly_expired';
    const done = isRedeemed(c.code);
    const forYou = state.fresh.has(c.code);
    const classes = ['rx-card', fresh && 'rx-card-new', done && 'is-done', dead && 'rx-card-flag'].filter(Boolean).join(' ');
    return `
      <article class="${classes}" data-code="${esc(c.code)}" style="--i:${index}">
        <div class="rx-card-top">
          <span class="rx-card-tags">
            ${forYou ? `<span class="rx-tag rx-tag-foryou">${esc(U.fresh.tag)}</span>` : fresh ? `<span class="rx-tag rx-tag-new">${esc(U.card.isNew)}</span>` : ''}
            <span class="rx-tag rx-tag-region">${esc(c.region || U.card.global)}</span>
            ${com.confirmed ? `<span class="rx-tag rx-tag-ok">${checkSvg}${esc(U.vote.confirmed)}</span>` : ''}
          </span>
          ${dead ? `<span class="rx-pill rx-pill-warn"><i></i>${esc(U.vote.possibly)}</span>` : pill('active')}
        </div>
        ${dead ? `<div class="rx-banner" role="note"><b>${esc(U.vote.expired)}</b><span>${esc(U.vote.expiredHint)}</span></div>` : ''}
        <button type="button" class="rx-coupon" data-copy="${esc(c.code)}" style="--len:${c.code.length}" aria-label="${esc(fmt(U.ticket.copyAria, { code: c.code }))}">
          <span class="rx-coupon-code">${esc(c.code)}</span>
          <span class="rx-coupon-icon">${icon(I.copy, 18)}</span>
        </button>
        <div class="rx-card-rewards">${chips(c.reward)}</div>
        ${c.notes ? `<p class="rx-card-note">${esc(c.notes)}</p>` : ''}
        <div class="rx-card-meta">
          <span class="rx-meta rx-tone-${ex.tone}">${icon(I.clock, 14)}${esc(ex.text)}</span>
          <span class="rx-meta">${esc(fmt(U.card.verified, { when: age(c.lastVerified || c.releaseDate) }))}</span>
        </div>
        ${feedback(c)}
        <div class="rx-card-actions">
          <button type="button" class="rx-btn rx-btn-soft" data-copy="${esc(c.code)}">${icon(I.copy, 16)}<span>${esc(U.card.copy)}</span></button>
          <a class="rx-btn rx-btn-primary" href="${esc(eaLink(c.code, c.region))}" target="_blank" rel="noopener noreferrer" data-redeem="${esc(c.code)}"><span>${esc(U.card.redeem)}</span>${icon(I.out, 16)}</a>
        </div>
      </article>`;
  }

  function renderActive() {
    const list = rankActive(activeCodes(), { isRedeemed });
    if (el.activeCount) el.activeCount.textContent = fmt(list.length === 1 ? I18N.activePillOne : I18N.activePill, { n: list.length });
    if (!el.active) return;
    if (!list.length) {
      const last = state.codes.find((c) => c.status === 'expired');
      el.active.innerHTML = `
        <div class="rx-empty">
          <div class="rx-empty-ico">${icon(I.gift, 26)}</div>
          <h3>${esc(U.empty.title)}</h3>
          <p>${esc(U.empty.text)}${last ? fmt(U.empty.mostRecent, { code: esc(last.code) }) : ''}</p>
          <a class="rx-btn rx-btn-soft" href="#archive"><span>${esc(U.empty.browse)}</span></a>
        </div>`;
      return;
    }
    el.active.innerHTML = list.map(activeCard).join('');
  }

  function renderUpcoming() {
    if (!el.upcoming) return;
    const list = upcomingCodes();
    el.upcoming.hidden = !list.length;
    if (!list.length || !el.upcomingList) return;
    el.upcomingList.innerHTML = list.map((c) => `
      <div class="rx-soon">
        <span class="rx-soon-code" aria-label="${esc(U.soon.hiddenAria)}">${esc(c.code)}</span>
        <div class="rx-soon-rewards">${chips(c.reward, 3)}</div>
        <span class="rx-soon-date">${icon(I.clock, 14)} ${esc(fmt(U.soon.drops, { date: fmtDate(c.releaseDate, false) }))}</span>
      </div>`).join('');
  }

  function renderStats() {
    const set = (name, value) => $$(`[data-rx-stat="${name}"]`).forEach((n) => countTo(n, value));
    set('active', activeCodes().length);
    set('upcoming', upcomingCodes().length);
    set('total', state.codes.length);
  }

  function countTo(node, target) {
    const from = Number(node.dataset.value ?? 0);
    node.dataset.value = String(target);
    if (reduceMotion || from === target) { node.textContent = String(target); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / 700, 1);
      node.textContent = String(Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ------------------------------ archive ------------------------------ */

  const haystack = (c) => `${c.code} ${c.reward} ${c.region} ${c.notes} ${kindsOf(c).map((k) => KINDS[k].label).join(' ')} ${STATUS_LABEL[c.status] || ''}`.toLowerCase();

  function filtered() {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let out = state.codes.filter((c) => {
      if (state.status !== 'all' && c.status !== state.status) return false;
      if (state.type !== 'all' && !kindsOf(c).includes(state.type)) return false;
      if (!words.length) return true;
      const hay = haystack(c);
      return words.every((w) => hay.includes(w));
    });
    if (state.sort === 'old') out = [...out].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    else if (state.sort === 'az') out = [...out].sort((a, b) => a.code.localeCompare(b.code));
    return out;
  }

  function row(c) {
    const masked = Boolean(c.masked);
    const done = c.status === 'active' && isRedeemed(c.code);
    return `
      <article class="rx-row${done ? ' is-done' : ''}" data-status="${esc(c.status)}" data-code="${esc(c.code)}">
        <div class="rx-row-code">
          <code>${esc(c.code)}</code>
          ${masked ? '' : `<button type="button" class="rx-mini" data-copy="${esc(c.code)}" aria-label="${esc(fmt(U.archive.copyAria, { code: c.code }))}">${icon(I.copy, 15)}</button>`}
          ${c.status === 'active' && !masked ? `<button type="button" class="rx-mini rx-mini-tick${done ? ' is-on' : ''}" data-tick="${esc(c.code)}" aria-pressed="${done}" aria-label="${esc(fmt(done ? U.mine.unmarkAria : U.mine.markAria, { code: c.code }))}">${checkSvg}</button>` : ''}
        </div>
        <div class="rx-row-reward">${chips(c.reward, 2)}</div>
        <div class="rx-row-date"><small>${esc(U.archive.added)}</small><span>${esc(fmtDate(c.releaseDate))}</span></div>
        <div class="rx-row-status">${pill(c.status)}</div>
        <div class="rx-row-act">${c.status === 'active'
          ? `<a class="rx-link" href="${esc(eaLink(c.code, c.region))}" target="_blank" rel="noopener noreferrer" data-redeem="${esc(c.code)}">${esc(U.archive.redeem)} ${icon(I.out, 14)}</a>`
          : ''}</div>
      </article>`;
  }

  function renderArchive() {
    if (!el.list) return;
    const all = filtered();
    const page = all.slice(0, state.shown);
    el.list.innerHTML = page.length ? page.map(row).join('') : `
      <div class="rx-empty rx-empty-sm">
        <h3>${esc(U.archive.noMatchTitle)}</h3>
        <p>${esc(U.archive.noMatchText)}</p>
        <button type="button" class="rx-btn rx-btn-soft" data-rx-reset><span>${esc(U.archive.reset)}</span></button>
      </div>`;
    if (el.count) el.count.textContent = fmt(U.archive.showing, { shown: page.length, total: all.length }) + (all.length === state.codes.length ? '' : fmt(U.archive.filteredFrom, { total: state.codes.length }));
    if (el.more) {
      const left = all.length - page.length;
      el.more.hidden = left <= 0;
      el.more.querySelector('span').textContent = fmt(U.archive.showMore, { n: Math.min(PAGE_SIZE, left) });
    }
    if (el.clear) el.clear.hidden = !state.q;
  }

  function renderFilters() {
    if (el.statusTabs) {
      const count = (s) => (s === 'all' ? state.codes.length : state.codes.filter((c) => c.status === s).length);
      el.statusTabs.innerHTML = [['all', U.status.all], ['active', U.status.active], ['scheduled', U.status.scheduled], ['expired', U.status.expired]]
        .map(([key, label]) => `<button type="button" role="tab" aria-selected="${state.status === key}" class="rx-tab${state.status === key ? ' is-on' : ''}" data-status="${key}">${label}<em>${count(key)}</em></button>`)
        .join('');
    }
    if (el.types) {
      const counts = {};
      state.codes.forEach((c) => kindsOf(c).forEach((k) => { counts[k] = (counts[k] || 0) + 1; }));
      const keys = Object.keys(KINDS).filter((k) => counts[k]);
      el.types.innerHTML = `<button type="button" class="rx-type${state.type === 'all' ? ' is-on' : ''}" data-type="all">${esc(U.allRewards)}</button>`
        + keys.map((k) => `<button type="button" class="rx-type${state.type === k ? ' is-on' : ''}" data-type="${k}">${icon(KINDS[k].icon, 14)}${KINDS[k].label}<em>${counts[k]}</em></button>`).join('');
    }
  }

  /* ------------------------------ "new for you" + progress strip ------------------------------ */

  function renderStrip() {
    if (!el.strip) return;
    const active = activeCodes();
    const done = local.redeemed.count(active.map((c) => c.code));
    const fresh = state.stripDismissed ? [] : active.filter((c) => state.fresh.has(c.code));
    const out = [];
    if (fresh.length) {
      out.push(`<div class="rx-strip-row"><button type="button" class="rx-strip-new" data-strip-jump>${sparkSvg}<span>${esc(fmt(fresh.length === 1 ? U.fresh.one : U.fresh.many, { n: fresh.length }))}</span><em>${esc(U.fresh.jump)}</em></button><button type="button" class="rx-strip-x" data-strip-x aria-label="${esc(U.fresh.dismiss)}">×</button></div>`);
    }
    if (active.length && done) {
      const pct = Math.round((done / active.length) * 100);
      out.push(`<div class="rx-strip-prog"><span class="rx-strip-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span>${esc(fmt(U.mine.progress, { done, total: active.length }))}</span>${done < active.length ? `<small>${esc(fmt(U.mine.left, { n: active.length - done }))}</small>` : ''}<button type="button" data-strip-reset>${esc(U.mine.reset)}</button></div>`);
    }
    el.strip.hidden = !out.length;
    el.strip.innerHTML = out.join('');
  }

  /** Which codes are new for THIS player: not in the set they saw at their last visit. */
  function trackFresh(previousActive, hadData) {
    const active = activeCodes().map((c) => c.code);
    if (!state.baselineChecked) {
      state.baselineChecked = true;
      state.fresh = new Set(local.seen.diff(active).fresh);
    } else if (hadData) {
      for (const code of active) if (!previousActive.has(code) && !isRedeemed(code)) state.fresh.add(code);
    }
    for (const code of [...state.fresh]) if (!active.includes(code)) state.fresh.delete(code);
  }

  // The baseline only moves once the player has actually SEEN the list (visible for a moment),
  // so opening the page and bouncing does not use up the "new" badge.
  let listVisible = false;
  let commitTimer = 0;
  let committedKey = '';
  function commitSeen() {
    const codes = activeCodes().map((c) => c.code);
    const key = codes.join('|');
    if (!state.codes.length || key === committedKey) return;
    committedKey = key;
    local.seen.commit(codes);
  }
  function armCommit() {
    clearTimeout(commitTimer);
    if (listVisible && document.visibilityState === 'visible') commitTimer = setTimeout(commitSeen, 2200);
  }
  if (el.active && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { listVisible = entries.some((e) => e.isIntersecting); armCommit(); }, { threshold: 0.25 }).observe(el.active);
  } else { listVisible = true; }
  document.addEventListener('visibilitychange', armCommit);

  function renderAll() {
    renderStats();
    renderTicket();
    renderActive();
    renderStrip();
    renderUpcoming();
    renderFilters();
    renderArchive();
    root.dataset.ready = 'true';
    state.firstRender = false;
    // The alert card reads real numbers (codes added lately, newest release date) from here.
    window.dispatchEvent(new CustomEvent('fcmt:redeem-data', { detail: { codes: state.codes, serverDate: state.serverDate } }));
  }

  /* ------------------------------ url state ------------------------------ */

  function readUrl() {
    const p = new URLSearchParams(location.search);
    state.q = (p.get('q') || '').slice(0, 80);
    state.status = ['all', 'active', 'scheduled', 'expired'].includes(p.get('status')) ? p.get('status') : 'all';
    state.type = Object.keys(KINDS).includes(p.get('type')) ? p.get('type') : 'all';
    state.sort = ['new', 'old', 'az'].includes(p.get('sort')) ? p.get('sort') : 'new';
    if (el.search) el.search.value = state.q;
    if (el.sort) el.sort.value = state.sort;
  }

  function writeUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.status !== 'all') p.set('status', state.status);
    if (state.type !== 'all') p.set('type', state.type);
    if (state.sort !== 'new') p.set('sort', state.sort);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }

  /* ------------------------------ data ------------------------------ */

  function apply(payload, { announce = false } = {}) {
    const previousActive = new Set(activeCodes().map((c) => c.code));
    const hadData = state.codes.length > 0;
    state.codes = Array.isArray(payload.codes) ? payload.codes : [];
    state.serverDate = payload.serverDate || state.serverDate;
    state.updatedAt = payload.updatedAt || state.updatedAt;
    state.lastSync = Date.now();
    local.redeemed.prune(state.codes.map((c) => c.code));
    trackFresh(previousActive, hadData);
    renderAll();
    armCommit();

    if (announce && hadData) {
      const fresh = activeCodes().filter((c) => !previousActive.has(c.code));
      fresh.forEach((c) => {
        const card = $(`.rx-card[data-code="${CSS.escape(c.code)}"]`);
        card?.classList.add('rx-flash');
      });
      if (fresh.length) toast(fmt(U.toast.newCode, { code: fresh[0].code }) + (fresh.length > 1 ? fmt(U.toast.newMore, { n: fresh.length - 1 }) : ''), 'good');
    }
    setSync(true);
  }

  async function refresh({ announce = true } = {}) {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const headers = { accept: 'application/json' };
        if (state.etag) headers['if-none-match'] = state.etag;

        const response = await fetch(API, { headers, cache: 'no-store' });

        if (response.status === 304) {
          state.lastSync = Date.now();
          setSync(true);
          return true;
        }
        if (!response.ok) throw new Error(String(response.status));

        state.etag = response.headers.get('etag') || state.etag;
        apply(await response.json(), { announce });
        return true;
      } catch {
        setSync(false);
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  function readBootstrap() {
    for (const id of ['rx-bootstrap', 'rx-fallback']) {
      const node = document.getElementById(id);
      if (!node) continue;
      try {
        const data = JSON.parse(node.textContent || 'null');
        if (data && Array.isArray(data.codes)) return { data, live: id === 'rx-bootstrap' };
      } catch { /* try next */ }
    }
    return null;
  }

  /* ------------------------------ sync indicator ------------------------------ */

  function setSync(ok) {
    state.online = ok;
    if (el.syncDot) el.syncDot.dataset.state = ok ? 'live' : 'off';
    paintSync();
  }

  function paintSync() {
    if (!el.syncText) return;
    if (!state.online) { el.syncText.textContent = U.sync.offline; return; }
    const s = Math.round((Date.now() - state.lastSync) / 1000);
    el.syncText.textContent = s < 10 ? U.sync.justNow : s < 60 ? fmt(U.sync.seconds, { n: s }) : fmt(U.sync.minutes, { n: Math.round(s / 60) });
  }

  /* ------------------------------ copy / toast ------------------------------ */

  let toastTimer = 0;
  function toast(message, tone = 'info') {
    if (!el.toast) return;
    el.toast.innerHTML = `${icon(tone === 'good' ? I.check : I.copy, 16)}<span>${esc(message)}</span>`;
    el.toast.dataset.tone = tone;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 2600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      return ok;
    }
  }


  function trackActivity(eventType, code) {
    const accessToken = authToken();
    if (!accessToken) return;
    fetch('/api/account/activity', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({
        eventType,
        entityType: 'redeem_code',
        entityId: String(code || '').trim().toUpperCase(),
        durationMs: 0,
        idempotencyKey: crypto.randomUUID()
      })
    }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json().catch(() => ({}));
      if (result.questCompleted) {
        toast(fmt(U.toast.quest, { n: Number(result.tokenReward || 0) }), 'good');
        window.dispatchEvent(new CustomEvent('fcmobiletools:quest-status-changed'));
      }
    }).catch(() => {});
  }
  const trackRedeemCodeCopy = (code) => trackActivity('redeem_code_copy', code);

  /* ------------------------------ ticks, votes, prompts ------------------------------ */

  const sameCode = (node, code) => node.dataset.code === code || node.dataset.tick === code;

  function paintTick(code) {
    const on = isRedeemed(code);
    $$('[data-tick]').filter((b) => b.dataset.tick === code).forEach((b) => {
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', fmt(on ? U.mine.unmarkAria : U.mine.markAria, { code }));
      const text = b.querySelector('.rx-tick-text');
      if (text) text.textContent = on ? U.mine.redeemed : U.mine.mark;
    });
    $$('.rx-card[data-code], .rx-row[data-code]').filter((n) => sameCode(n, code)).forEach((n) => {
      if (n.classList.contains('rx-row') && n.dataset.status !== 'active') return;
      n.classList.toggle('is-done', on);
    });
    renderStrip();
  }

  function setTick(code, on) {
    local.redeemed.set(code, on);
    paintTick(code);
  }

  function repaintCard(code) {
    const old = $$('.rx-card').find((n) => n.dataset.code === code);
    const c = state.codes.find((x) => x.code === code);
    if (!old || !c) return;
    const next = document.createElement('div');
    next.innerHTML = activeCard(c, Number(old.style.getPropertyValue('--i')) || 0).trim();
    const card = next.firstElementChild;
    card.classList.add('is-static');
    if (old.classList.contains('rx-flash')) card.classList.add('rx-flash');
    old.replaceWith(card);
  }

  const VOTE_ERRORS = { rate_limited: 'limit', locked: 'locked', network_limit: 'network', inactive: 'inactive' };
  const voting = new Set();

  /** Sends Worked / Didn't work / retract. Returns true when the server accepted it. */
  async function sendVote(code, verdict, { quiet = false } = {}) {
    const c = state.codes.find((x) => x.code === code);
    if (!c || voting.has(code)) return false;
    voting.add(code);
    const box = $$('[data-fb]').find((n) => n.dataset.fb === code);
    const before = box?.dataset.mine;
    if (box) { box.dataset.mine = verdict === 'clear' ? 'none' : verdict; box.classList.add('is-busy'); }
    try {
      const token = authToken();
      const response = await fetch(VOTE_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ code, verdict, device: local.device.id(() => crypto.randomUUID()) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw Object.assign(new Error(data.error || 'failed'), { reason: data.code });

      const stateBefore = community(c).state;
      c.community = data.community || c.community;
      local.votes.set(code, data.vote || 'clear', Date.parse(data.at) || Date.now());
      local.attempts.asked(code);
      if (data.vote === 'worked') local.redeemed.set(code, true); // it worked, so it is redeemed
      repaintCard(code);
      paintTick(code);
      if (community(c).state !== stateBefore) renderTicket();
      if (!quiet) toast(data.vote ? U.vote.thanks : U.vote.removed, 'good');
      if (data.vote && data.account) trackActivity('redeem_code_vote', code);
      return true;
    } catch (error) {
      if (box) { box.dataset.mine = before || 'none'; }
      toast(U.vote[VOTE_ERRORS[error.reason]] || U.vote.error);
      return false;
    } finally {
      voting.delete(code);
      $$('[data-fb]').filter((n) => n.dataset.fb === code).forEach((n) => n.classList.remove('is-busy'));
    }
  }

  // "How did it go?": players copy a code, switch to the game, then come back. Ask once, then.
  let askNode = null;
  let hiddenAt = 0;
  const hideAsk = () => { askNode?.remove(); askNode = null; };

  function maybeAsk(reason) {
    if (askNode || !state.codes.length) return;
    const pending = local.attempts.pending();
    if (!pending) return;
    const c = activeCodes().find((x) => x.code === pending.code);
    if (!c || isRedeemed(c.code) || myVote(c)) { local.attempts.asked(pending.code); return; }
    const away = reason === 'load' ? pending.at < pageStart : hiddenAt > pending.at && Date.now() - hiddenAt >= 8000;
    if (!away) return;
    askNode = document.createElement('div');
    askNode.className = 'rx-ask';
    askNode.setAttribute('role', 'group');
    askNode.setAttribute('aria-label', fmt(U.vote.askTitle, { code: c.code }));
    askNode.dataset.ask = c.code;
    askNode.innerHTML = `
      <p class="rx-ask-t"><b>${esc(fmt(U.vote.askTitle, { code: c.code }))}</b></p>
      <div class="rx-ask-btns">
        <button type="button" class="rx-vbtn rx-vbtn-ok" data-ask-vote="worked">${icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 17)}<span>${esc(U.vote.worked)}</span></button>
        <button type="button" class="rx-vbtn rx-vbtn-bad" data-ask-vote="failed">${icon('<path d="M6 6l12 12M18 6L6 18"/>', 17)}<span>${esc(U.vote.failed)}</span></button>
      </div>
      <button type="button" class="rx-ask-skip" data-ask-skip>${esc(U.vote.askSkip)}</button>`;
    root.appendChild(askNode);
  }

  function flashCopied(button) {
    button.classList.add('is-copied');
    const label = button.matches('.rx-btn') ? button.querySelector('span') : null;
    const original = label?.textContent;
    if (label) label.textContent = U.toast.copiedButton;
    setTimeout(() => {
      button.classList.remove('is-copied');
      if (label && original) label.textContent = original;
    }, 1400);
  }

  /* ------------------------------ events ------------------------------ */

  const markAttempt = (code) => {
    if (activeCodes().some((c) => c.code === code) && !isRedeemed(code)) local.attempts.mark(code);
  };

  root.addEventListener('click', async (event) => {
    const tick = event.target.closest('[data-tick]');
    if (tick) { setTick(tick.dataset.tick, !isRedeemed(tick.dataset.tick)); navigator.vibrate?.(8); return; }

    const voteBtn = event.target.closest('[data-vote]');
    if (voteBtn) {
      const code = voteBtn.closest('[data-fb]')?.dataset.fb;
      const c = state.codes.find((x) => x.code === code);
      if (!c) return;
      // Pressing the verdict you already gave takes it back.
      const same = myVote(c)?.v === voteBtn.dataset.vote;
      await sendVote(code, same ? 'clear' : voteBtn.dataset.vote);
      return;
    }

    const fix = event.target.closest('[data-vote-fix]');
    if (fix) {
      const code = fix.closest('[data-fb]')?.dataset.fb;
      if (await sendVote(code, 'clear', { quiet: true })) {
        if (fix.dataset.voteFix === 'used') { setTick(code, true); toast(U.vote.usedDone, 'good'); } else toast(U.vote.regionDone, 'good');
      }
      return;
    }

    const askVote = event.target.closest('[data-ask-vote]');
    if (askVote && askNode) { const code = askNode.dataset.ask; hideAsk(); await sendVote(code, askVote.dataset.askVote); return; }
    if (event.target.closest('[data-ask-skip]') && askNode) { local.attempts.asked(askNode.dataset.ask); hideAsk(); return; }

    if (event.target.closest('[data-strip-x]')) { state.stripDismissed = true; commitSeen(); renderStrip(); renderActive(); return; }
    if (event.target.closest('[data-strip-reset]')) {
      local.redeemed.clear(activeCodes().map((c) => c.code));
      renderActive(); renderArchive(); renderStrip(); toast(U.mine.resetDone);
      return;
    }
    if (event.target.closest('[data-strip-jump]')) {
      const target = $$('.rx-card').find((n) => state.fresh.has(n.dataset.code));
      if (target) {
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        target.classList.remove('rx-flash'); void target.offsetWidth; target.classList.add('rx-flash');
      }
      return;
    }

    const copyBtn = event.target.closest('[data-copy]');
    if (copyBtn) {
      const ok = await copyText(copyBtn.dataset.copy);
      if (ok) {
        flashCopied(copyBtn);
        markAttempt(copyBtn.dataset.copy);
        trackRedeemCodeCopy(copyBtn.dataset.copy);
        toast(fmt(U.toast.copied, { code: copyBtn.dataset.copy }), 'good');
        navigator.vibrate?.(12);
        window.dispatchEvent(new CustomEvent('fcmt:code-copied'));
      } else {
        toast(U.toast.copyBlocked);
      }
      return;
    }

    // Redeem opens EA in a new tab; copy first so the code is ready to paste.
    const redeem = event.target.closest('[data-redeem]');
    if (redeem) {
      markAttempt(redeem.dataset.redeem);
      copyText(redeem.dataset.redeem).then((ok) => {
        if (!ok) return;
        trackRedeemCodeCopy(redeem.dataset.redeem);
        toast(fmt(U.toast.redeemCopied, { code: redeem.dataset.redeem }), 'good');
      });
      return;
    }

    const status = event.target.closest('[data-status]');
    if (status && el.statusTabs?.contains(status)) { state.status = status.dataset.status; state.shown = PAGE_SIZE; renderFilters(); renderArchive(); writeUrl(); return; }

    const type = event.target.closest('[data-type]');
    if (type && el.types?.contains(type)) { state.type = state.type === type.dataset.type ? 'all' : type.dataset.type; state.shown = PAGE_SIZE; renderFilters(); renderArchive(); writeUrl(); return; }

    if (event.target.closest('[data-rx-more]')) { state.shown += PAGE_SIZE; renderArchive(); return; }

    if (event.target.closest('[data-rx-reset]')) {
      state.q = ''; state.status = 'all'; state.type = 'all'; state.shown = PAGE_SIZE;
      if (el.search) el.search.value = '';
      renderFilters(); renderArchive(); writeUrl();
    }
  });

  let searchTimer = 0;
  el.search?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = el.search.value.trim(); state.shown = PAGE_SIZE; renderArchive(); writeUrl(); }, 110);
    if (el.clear) el.clear.hidden = !el.search.value;
  });
  el.search?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { el.search.value = ''; state.q = ''; renderArchive(); writeUrl(); }
  });
  el.clear?.addEventListener('click', () => { el.search.value = ''; state.q = ''; state.shown = PAGE_SIZE; renderArchive(); writeUrl(); el.search.focus(); });
  el.sort?.addEventListener('change', () => { state.sort = el.sort.value; state.shown = PAGE_SIZE; renderArchive(); writeUrl(); });

  /* ------------------------------ ticket tilt ------------------------------ */

  const stage = $('[data-rx-stage]');
  if (stage && el.ticket && !reduceMotion && window.matchMedia('(hover: hover)').matches) {
    let frame = 0;
    stage.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        stage.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
        stage.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
        stage.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
      });
    });
    stage.addEventListener('pointerleave', () => {
      stage.style.setProperty('--ry', '0deg');
      stage.style.setProperty('--rx', '0deg');
      stage.style.setProperty('--mx', '50%');
    });
  }

  /* ------------------------------ start ------------------------------ */

  readUrl();
  const initial = readBootstrap();
  if (initial) {
    apply(initial.data);
    if (!initial.live) refresh({ announce: false });
  } else {
    refresh({ announce: false }).then((ok) => {
      if (!ok && el.active) {
        el.active.innerHTML = `
          <div class="rx-empty">
            <h3>${esc(U.error.title)}</h3>
            <p>${esc(U.error.text)}</p>
            <button type="button" class="rx-btn rx-btn-primary" data-rx-retry><span>${esc(U.error.retry)}</span></button>
          </div>`;
        el.active.querySelector('[data-rx-retry]')?.addEventListener('click', () => location.reload());
      }
    });
  }

  // Signed-in players: pull my votes so a second device shows the same pressed buttons.
  const token = authToken();
  if (token) {
    fetch(MINE_API, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.votes && Object.keys(data.votes).length) { local.votes.merge(data.votes); renderActive(); } })
      .catch(() => {});
  }

  // Ticks made in another tab show up here at once.
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('fcmt:rx:')) { renderActive(); renderArchive(); renderStrip(); }
  });

  setTimeout(() => maybeAsk('load'), 2500);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    setTimeout(() => maybeAsk('return'), 600);
  });

  setInterval(paintSync, 30_000);
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.lastSync > 90_000) refresh();
  });
  window.addEventListener('online', () => {
    if (Date.now() - state.lastSync > 90_000) refresh();
  });
}
