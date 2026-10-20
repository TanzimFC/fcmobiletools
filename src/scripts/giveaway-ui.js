// Shared browser helpers for the giveaway pages: API calls, toasts, countdowns, confetti.
import { accountAuth } from '../lib/account-client.js';
import { esc, money } from '../data/giveawayConfig.js';
import { emblem } from '../lib/giveawayArt.js';

export { esc, money, emblem };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const store = {
  get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  session(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } }
};

export async function token() {
  try { return (await accountAuth.auth.getSession()).data?.session?.access_token || ''; } catch { return ''; }
}
export async function signedIn() { return Boolean(await token()); }
export const signInUrl = (next) => '/account/?next=' + encodeURIComponent(next || location.pathname + location.search);

export async function api(path, options = {}) {
  const t = await token();
  const headers = new Headers(options.headers || {});
  if (t) headers.set('authorization', 'Bearer ' + t);
  if (options.body && !(options.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  let res;
  try { res = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: options.cache || 'no-store' }); }
  catch { const e = new Error('No connection. Check your internet and try again.'); e.status = 0; throw e; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(body.error || 'Something went wrong. Please try again.'); e.status = res.status; e.body = body; throw e; }
  return body;
}

export function toast(message, error = false) {
  let host = $('#gwToasts');
  if (!host) { host = document.createElement('div'); host.id = 'gwToasts'; host.className = 'gw-toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const n = document.createElement('div');
  n.className = 'gw-toast' + (error ? ' err' : '');
  n.textContent = message;
  host.appendChild(n);
  requestAnimationFrame(() => n.classList.add('show'));
  while (host.children.length > 3) host.firstChild.remove();
  setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 350); }, error ? 5500 : 3400);
}

export async function busy(btn, fn) {
  if (!btn || btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  try { return await fn(); } finally { btn.removeAttribute('aria-busy'); }
}

export function copyText(text) {
  const done = () => toast('Copied to clipboard.');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => toast('Could not copy. Select the text and copy it manually.', true));
  else toast('Select the text and copy it manually.', true);
}

// ───────────── time ─────────────
export const fmtDate = (iso) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
export function parts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
export function short(ms) {
  const p = parts(ms);
  if (p.d > 0) return p.d + 'd ' + p.h + 'h';
  if (p.h > 0) return p.h + 'h ' + p.m + 'm';
  return p.m + 'm';
}

// Flip-style countdown. Calls onEnd once at zero.
export function countdown(host, endIso, onEnd) {
  if (!host || !endIso) return () => {};
  const end = Date.parse(endIso);
  host.innerHTML = ['d', 'h', 'm', 's'].map((k) => '<div><strong data-k="' + k + '">00</strong><small>' + { d: 'Days', h: 'Hours', m: 'Min', s: 'Sec' }[k] + '</small></div>').join('');
  const els = Object.fromEntries($$('[data-k]', host).map((e) => [e.dataset.k, e]));
  let fired = false;
  const tick = () => {
    const left = end - Date.now();
    const p = parts(left);
    for (const k of ['d', 'h', 'm', 's']) {
      const v = String(p[k]).padStart(2, '0');
      if (els[k].textContent !== v) { els[k].textContent = v; if (!reduced()) { els[k].classList.remove('tick'); void els[k].offsetWidth; els[k].classList.add('tick'); } }
    }
    if (left <= 0 && !fired) { fired = true; onEnd?.(); }
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

export function countUp(el, to, { duration = 1100, prefix = '', suffix = '' } = {}) {
  if (!el) return;
  const end = Number(to) || 0;
  if (reduced() || end === 0) { el.textContent = prefix + end.toLocaleString() + suffix; return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    el.textContent = prefix + Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString() + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Reveal animation helper: fades children in with a stagger.
export function stagger(host) { $$(':scope > *', host).forEach((el, i) => el.style.setProperty('--i', i)); }

export function confetti({ power = 1 } = {}) {
  if (reduced()) return;
  const c = document.createElement('canvas');
  c.className = 'gw-confetti'; c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const g = c.getContext('2d');
  const colors = ['#f6c453', '#ffe7a6', '#4cc9ff', '#9a8cff', '#5cf0b4', '#ff7a9c', '#ffffff'];
  const bits = [];
  const shoot = (x, y, dir, n) => {
    for (let i = 0; i < n; i += 1) {
      const a = (dir === 0 ? -Math.PI / 2 : dir < 0 ? -Math.PI / 2 - 0.45 : -Math.PI / 2 + 0.45) + (Math.random() - .5) * .9;
      const v = (9 + Math.random() * 13) * power;
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 5 + 3, a: Math.random() * 6.28, va: (Math.random() - .5) * .45, col: colors[(Math.random() * colors.length) | 0], round: Math.random() < .28 });
    }
  };
  shoot(innerWidth * .08, innerHeight * .9, 1, Math.round(70 * power));
  shoot(innerWidth * .92, innerHeight * .9, -1, Math.round(70 * power));
  shoot(innerWidth * .5, innerHeight * .62, 0, Math.round(90 * power));
  const t0 = performance.now(); const life = 3400;
  const frame = (t) => {
    g.clearRect(0, 0, c.width, c.height);
    for (const b of bits) {
      b.vy += .42; b.x += b.vx; b.y += b.vy; b.a += b.va; b.vx *= .985;
      g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = b.col; g.globalAlpha = Math.max(0, 1 - Math.pow((t - t0) / life, 2));
      if (b.round) { g.beginPath(); g.arc(0, 0, b.r * .6, 0, 6.28); g.fill(); } else g.fillRect(-b.r, -b.r / 2, b.r * 2, b.r);
      g.restore();
    }
    if (t - t0 < life) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

// Soft light that follows the pointer across cards and panels (hover devices only).
export function spotlight() {
  if (reduced() || !matchMedia('(hover:hover)').matches || document.documentElement.dataset.gwSpot) return;
  document.documentElement.dataset.gwSpot = '1';
  let raf = 0;
  document.addEventListener('pointermove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = e.target.closest?.('.gw-card, .gw-panel, .gw-stat, .gw-trust-mini, .gw-th-ticket');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }, { passive: true });
}

// Types a value out of random symbols, locking left to right. Used for the claim code reveal.
export function scramble(el, finalText, ms = 900) {
  if (!el) return Promise.resolve();
  if (reduced()) { el.textContent = finalText; return Promise.resolve(); }
  const pool = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms); const lock = Math.floor(k * finalText.length);
      el.textContent = finalText.split('').map((ch, i) => (i < lock || ch === '-' ? ch : pool[(Math.random() * pool.length) | 0])).join('');
      if (k < 1) requestAnimationFrame(step); else { el.textContent = finalText; resolve(); }
    };
    requestAnimationFrame(step);
  });
}

// Calendar helpers: a Google Calendar link and a downloadable .ics file.
const icsStamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function calendarUrl({ title, start, end, details, url }) {
  const e = end || new Date(Date.parse(start) + 30 * 60000).toISOString();
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + icsStamp(start) + '/' + icsStamp(e) +
    '&details=' + encodeURIComponent((details || '') + (url ? '\n' + url : ''));
}
export function downloadIcs({ title, start, end, details, url }) {
  const e = end || new Date(Date.parse(start) + 30 * 60000).toISOString();
  const esc2 = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FCMobiletools//Giveaways//EN', 'BEGIN:VEVENT', 'UID:' + icsStamp(start) + '-' + (url || title).length + '@fcmobiletools.online',
    'DTSTAMP:' + icsStamp(new Date().toISOString()), 'DTSTART:' + icsStamp(start), 'DTEND:' + icsStamp(e), 'SUMMARY:' + esc2(title), 'DESCRIPTION:' + esc2((details || '') + (url ? '\n' + url : '')),
    url ? 'URL:' + url : '', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  a.download = (title || 'giveaway').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.ics';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const STATUS_LABEL = { upcoming: 'Opens soon', live: 'Live now', closed: 'Entries closed', drawn: 'Drawing', completed: 'Winners announced' };
export const ENTRY_LABEL = {
  provisional: ['In the draw, awaiting review', 'gold'], approved: ['Approved', 'paid'], needs_proof: ['Corrected proof needed', 'bad'],
  rejected: ['Rejected', 'bad'], disqualified: ['Disqualified', 'bad'], withdrawn: ['Withdrawn', '']
};

export function cardHtml(g, i = 0) {
  const live = g.status === 'live';
  const next = g.milestones.next;
  const p = next ? Math.min(100, Math.round((g.stats.entries / next.entries) * 100)) : 100;
  const msLine = next ? '<div class="gw-bar" aria-hidden="true"><i style="--p:' + p + '%"></i></div><div class="gw-note">' + g.stats.entries.toLocaleString() + ' / ' + next.entries.toLocaleString() + ' entries to unlock: ' + esc(next.label) + '</div>' : '';
  const cta = live ? 'Enter now' : g.status === 'completed' || g.status === 'drawn' ? 'See results' : g.status === 'upcoming' ? 'Get ready' : 'View details';
  const left = g.endsAt ? Date.parse(g.endsAt) - Date.now() : 0;
  return '<a class="gw-card' + (live ? ' live' : '') + '" style="--c:' + esc(g.accent) + ';--i:' + i + '" href="/giveaways/' + esc(g.slug) + '/">' +
    '<div class="gw-cover">' + (g.coverUrl ? '<img src="' + esc(g.coverUrl) + '" alt="" loading="lazy" decoding="async">' : emblem(g.kind)) +
    '<div class="gw-badges"><span class="gw-pill ' + (live ? 'live' : g.status === 'completed' ? 'gold' : '') + '">' + esc(STATUS_LABEL[g.status] || g.status) + '</span></div></div>' +
    '<div class="gw-card-b"><div><h3>' + esc(g.title) + '</h3><p>' + esc(g.tagline) + '</p></div>' +
    '<div class="gw-prize"><strong>' + esc(g.prize.display) + '</strong><span>' + esc(g.prize.label) + (g.winners.total > 1 ? ' x ' + g.winners.total + ' winners' : '') + '</span></div>' +
    '<div class="gw-meta"><span><b>' + g.stats.entries.toLocaleString() + '</b> entries</span><span>' + (live && left > 0 ? '<b>' + short(left) + '</b> left' : esc(STATUS_LABEL[g.status] || '')) + '</span></div>' +
    msLine + '<span class="gw-btn ' + (live ? 'gw-btn-gold' : '') + '">' + cta + '</span></div></a>';
}

export function winnersHtml(list) {
  if (!list?.length) return '';
  return '<div class="gw-wins">' + list.map((w, i) => '<div class="gw-win" style="--i:' + i + '"><span class="crown">' + (w.slot ? '#' + w.slot : '★') + '</span><div><strong>' + esc(w.name) + '</strong><small>' +
    (w.giveaway ? esc(w.giveaway) + ' · ' : '') + (w.status === 'paid' ? 'Reward delivered' : w.status === 'verified' ? 'Claim verified, delivery pending' : 'Claim in progress') + '</small></div>' +
    '<span class="gw-tag ' + (w.status === 'paid' ? 'paid' : '') + '">' + (w.status === 'paid' ? 'Delivered' : 'Pending') + '</span><span class="amt">' + esc(w.prize) + '</span></div>').join('') + '</div>';
}
