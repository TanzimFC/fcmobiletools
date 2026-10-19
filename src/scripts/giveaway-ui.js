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

export function confetti() {
  if (reduced()) return;
  const c = document.createElement('canvas');
  c.className = 'gw-confetti'; c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const g = c.getContext('2d');
  const colors = ['#f6c453', '#ffe7a6', '#4cc9ff', '#9a8cff', '#5cf0b4', '#ff7a9c'];
  const bits = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 180, y: innerHeight * .55, vx: (Math.random() - .5) * 16, vy: -Math.random() * 17 - 5,
    r: Math.random() * 6 + 3, a: Math.random() * 6.28, va: (Math.random() - .5) * .4, col: colors[(Math.random() * colors.length) | 0]
  }));
  const t0 = performance.now();
  const frame = (t) => {
    g.clearRect(0, 0, c.width, c.height);
    for (const b of bits) {
      b.vy += .45; b.x += b.vx; b.y += b.vy; b.a += b.va; b.vx *= .99;
      g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = b.col; g.globalAlpha = Math.max(0, 1 - (t - t0) / 2600);
      g.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); g.restore();
    }
    if (t - t0 < 2600) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
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
