// Editorial Studio — shared state and helpers.
import { icon, ICONS } from './editor.js';

Object.assign(ICONS, {
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  library: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  review: '<path d="m5 12 4.5 4.5L19 7"/>', inbox: '<path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5M16 5a3.2 3.2 0 0 1 0 6M17.5 14.7c2.2.5 3.5 2.4 3.5 5.3"/>',
  guide: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>', history: '<path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5M4 4v4.5h4.5M12 8v4.5l3 2"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/>', send: '<path d="m21 3-9.5 18-2.5-7.5L1.5 11zM9 13.5 21 3"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="m6 6 12 12M18 6 6 18"/>', more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  back: '<path d="M15 5 8 12l7 7"/>', external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  list2: '<path d="M4 6h16M4 12h16M4 18h10"/>', flag: '<path d="M5 21V4M5 5h12l-2 4 2 4H5"/>', user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>', bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>'
});
export { icon };

export const S = { seq: 0, me: null, base: '/api/admin/editorial', list: [], listLoaded: false, stamp: '', unread: 0, queue: 0 };

export const STATUS_LABEL = { draft: 'Draft', in_review: 'In review', changes_requested: 'Changes requested', approved: 'Approved', scheduled: 'Scheduled', published: 'Published', archived: 'Unpublished', trash: 'Trash' };
export const TYPE_LABEL = { news: 'News', guide: 'Guide', 'player-review': 'Player review', ranking: 'Ranking', analysis: 'Analysis', 'event-guide': 'Event guide', explanation: 'Explainer', opinion: 'Opinion', leaks: 'Leaks' };
export const FACT_LABEL = { verified: 'Verified', 'partially-verified': 'Partially verified', 'community-reported': 'Unconfirmed' };
export const CATEGORIES = ['News', 'Guides', 'Leaks', 'Events', 'Players', 'Analysis', 'Opinion', 'Rankings', 'Explainers'];

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ago(value) {
  const t = Date.parse(value); if (!t) return '';
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 45) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.round(s / 86400) + ' d ago';
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
export const fmtDateTime = (v) => (v ? new Date(v).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
export const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || '?';

/* --------------------------------------------------------------------- API */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(S.base + path, {
    method, credentials: 'same-origin', signal,
    headers: { 'x-editorial': '1', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Request failed (' + res.status + ')'); e.status = res.status; e.data = data; throw e; }
  return data;
}

export async function loadList(force = false) {
  if (S.listLoaded && !force) return S.list;
  const out = await api('/articles');
  S.list = out.articles || []; S.listLoaded = true; return S.list;
}
export async function pulse() {
  try {
    const p = await api('/pulse');
    S.unread = p.unread || 0; S.queue = p.queue || 0;
    const changed = p.stamp && p.stamp !== S.stamp; S.stamp = p.stamp || S.stamp;
    paintBadges();
    return changed;
  } catch { return false; }
}
export function paintBadges() {
  const set = (id, n) => { const el = document.getElementById(id); if (el) { el.textContent = n > 99 ? '99+' : n; el.hidden = !n; } };
  set('badge-inbox', S.unread); set('badge-review', S.queue);
}
export const isStaff = () => !!S.me?.staff;
export const go = (hash) => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };

/* ------------------------------------------------------------------- toast */
export function toast(message, kind = 'info', ms = 4200) {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + (kind === 'success' ? 'ok' : kind); t.innerHTML = '<i></i><div>' + esc(message) + '</div>';
  box.appendChild(t); setTimeout(() => t.remove(), ms);
}

/* ------------------------------------------------------------------ dialogs */
export function dialog({ title, body = '', actions = [{ label: 'Close', value: null }], wide = false, onMount, cls = '' }) {
  return new Promise((resolve) => {
    const scrim = document.createElement('div'); scrim.className = 'scrim';
    const prevFocus = document.activeElement;
    scrim.innerHTML = '<div class="dialog ' + (wide ? 'wide ' : '') + cls + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><header><h2>' + esc(title) + '</h2><button class="icon-btn" data-close aria-label="Close">' + icon('x') + '</button></header><div class="body"></div><footer></footer></div>';
    const bodyEl = $('.body', scrim); if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
    const foot = $('footer', scrim); if (!actions.length) foot.remove();
    const close = (v) => { scrim.remove(); document.removeEventListener('keydown', onKey, true); prevFocus?.focus?.(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
    document.addEventListener('keydown', onKey, true);
    for (const a of actions) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.kind || ''); b.textContent = a.label;
      b.onclick = async () => { if (a.validate) { b.setAttribute('aria-busy', 'true'); const ok = await a.validate(scrim, close); b.removeAttribute('aria-busy'); if (ok === false) return; } close(a.value !== undefined ? (typeof a.value === 'function' ? a.value(scrim) : a.value) : true); };
      foot.appendChild(b);
    }
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(null); });
    $('[data-close]', scrim).onclick = () => close(null);
    document.body.appendChild(scrim);
    if (onMount) onMount(scrim, close);
    (scrim.querySelector('[autofocus]') || scrim.querySelector('input,textarea,select,button.primary,button'))?.focus();
  });
}
export function prompt({ title, label, placeholder = '', value = '', confirm = 'Save', multiline = false, required = true }) {
  const field = multiline ? '<textarea class="input" rows="4" placeholder="' + esc(placeholder) + '" autofocus>' + esc(value) + '</textarea>' : '<input class="input" placeholder="' + esc(placeholder) + '" value="' + esc(value) + '" autofocus>';
  return dialog({
    title, body: '<label class="field"><span>' + esc(label) + '</span>' + field + '</label>',
    actions: [{ label: 'Cancel', value: null }, { label: confirm, kind: 'primary', value: (s) => $('.input', s).value.trim(), validate: (s) => (required && !$('.input', s).value.trim() ? (toast('This field is required', 'error'), false) : true) }],
    onMount: (s, close) => { if (!multiline) $('.input', s).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('.btn.primary', s).click(); } }); }
  });
}
export const confirmBox = ({ title, message, confirm = 'Confirm', danger = false }) => dialog({ title, body: '<p style="color:var(--soft);margin:6px 0 10px">' + esc(message) + '</p>', actions: [{ label: 'Cancel', value: false }, { label: confirm, kind: danger ? 'danger' : 'primary', value: true }] }).then((v) => v === true);

/* ------------------------------------------------------------------ pop menu */
export function popMenu(anchor, items) {
  $$('.popup').forEach((p) => p.remove());
  const pop = document.createElement('div'); pop.className = 'popup'; pop.setAttribute('role', 'menu');
  pop.innerHTML = items.map((it, i) => it.sep ? '<div class="ed-menu-sep"></div>' : '<button role="menuitem" data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' + (it.icon ? icon(it.icon, 16) : '') + esc(it.label) + '</button>').join('');
  anchor.parentElement.style.position = 'relative'; anchor.parentElement.appendChild(pop);
  const off = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', off, true); } };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  pop.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pop.remove(); document.removeEventListener('mousedown', off, true); items[Number(b.dataset.i)].run(); });
  return pop;
}

/* ----------------------------------------------------------------- shared UI */
export const statusPill = (a) => {
  const building = a.status === 'published' && a.deployState === 'building';
  const label = building ? 'Going live' : a.status === 'published' && a.pendingUpdate ? 'Published · update pending' : a.status === 'in_review' && a.publishedVersion != null ? 'Update in review' : STATUS_LABEL[a.status] || a.status;
  return '<span class="pill ' + (building ? 'building' : a.status) + '">' + esc(label) + '</span>';
};
export const thumb = (a) => '<span class="thumb">' + (a.cover ? '<img loading="lazy" alt="" src="' + esc(a.cover) + '">' : icon('image', 18)) + '</span>';
export const liveUrl = (a) => 'https://fcmobiletools.online/blog/' + a.slug + '/';
