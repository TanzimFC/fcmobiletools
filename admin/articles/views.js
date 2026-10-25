// Editorial Studio — list-style views.
import {
  S, api, esc, $, $$, icon, ago, fmtDateTime, initials, toast, dialog, prompt, confirmBox, popMenu, go, isStaff, loadList, pulse,
  STATUS_LABEL, TYPE_LABEL, CATEGORIES, statusPill, thumb, liveUrl
} from './core.js';
import { ARTICLE_TYPES, markdownToBlocks, blocksToHtml } from './engine/blocks.js';

const view = () => $('#view');

/* ------------------------------------------------------------ new article */
export async function newArticleDialog(preset = {}) {
  let writers = [];
  if (isStaff()) { try { writers = (await api('/writers')).writers || []; } catch { /* optional */ } }
  let type = preset.type || 'guide';
  const body = document.createElement('div');
  body.innerHTML = '<label class="field"><span>Working title</span><input class="input" id="na-title" maxlength="160" placeholder="e.g. How to get the new Stellar player cheaply" autofocus><small>You can change it any time. The URL is created from it.</small></label>'
    + '<div class="field"><span>What kind of article?</span><div class="chips" id="na-types">' + ARTICLE_TYPES.map((t) => '<button type="button" class="chip' + (t === type ? ' on' : '') + '" data-type="' + t + '">' + esc(TYPE_LABEL[t]) + '</button>').join('') + '</div></div>'
    + (writers.length ? '<details style="margin-top:6px"' + (preset.assign ? ' open' : '') + '><summary style="cursor:pointer;color:var(--accent);font-weight:650;margin-bottom:12px">Assign to a writer</summary>'
      + '<label class="field"><span>Writer</span><select class="input" id="na-writer"><option value="">Me</option>' + writers.map((w) => '<option value="' + esc(w.key) + '">' + esc(w.name) + '</option>').join('') + '</select></label>'
      + '<label class="field"><span>Brief</span><textarea class="input" id="na-brief" rows="4" placeholder="What angle, what to cover, what to avoid, links to read."></textarea></label>'
      + '<label class="field"><span>Due date</span><input class="input" id="na-due" type="date"></label></details>' : '');
  body.addEventListener('click', (e) => { const c = e.target.closest('[data-type]'); if (!c) return; type = c.dataset.type; $$('#na-types .chip', body).forEach((x) => x.classList.toggle('on', x === c)); });
  return dialog({
    title: 'New article', body,
    actions: [{ label: 'Cancel', value: null }, {
      label: 'Create and start writing', kind: 'primary',
      validate: async (s, close) => {
        const title = $('#na-title', s).value.trim(); if (!title) { toast('Give it a working title first', 'error'); return false; }
        try {
          const out = await api('/articles', { method: 'POST', body: { title, type, assignTo: $('#na-writer', s)?.value || undefined, brief: $('#na-brief', s)?.value, dueAt: $('#na-due', s)?.value || undefined } });
          S.listLoaded = false;
          if ($('#na-writer', s)?.value) { toast('Assigned. They have been notified.', 'success'); close(out.id); go('#/library'); return false; }
          close(out.id); go('#/write/' + out.id); return false;
        } catch (e) { toast(e.message, 'error'); return false; }
      }
    }],
    onMount: (s) => $('#na-title', s).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('.btn.primary', s).click(); } })
  });
}

/* --------------------------------------------------------------------- home */
export async function homeView() {
  const seq = S.seq;
  view().innerHTML = '<div class="page"><div class="skeleton" style="height:120px;margin-bottom:16px"></div><div class="stats">' + '<div class="skeleton"></div>'.repeat(4) + '</div></div>';
  const list = await loadList(true);
  if (seq !== S.seq) return;
  const mine = list.filter((a) => isStaff() ? true : a.ownerKey === S.me.key);
  const hour = new Date().getHours(); const hi = hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const count = (fn) => mine.filter(fn).length;
  const needs = isStaff() ? list.filter((a) => a.status === 'in_review').sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt)) : list.filter((a) => a.status === 'changes_requested');
  const recent = [...mine].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).filter((a) => !['trash'].includes(a.status)).slice(0, 6);
  const due = list.filter((a) => a.dueAt && ['draft', 'changes_requested'].includes(a.status)).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)).slice(0, 5);
  const row = (a, extra = '') => '<button class="row" data-open="' + a.id + '">' + thumb(a) + '<span style="min-width:0"><b>' + esc(a.title) + '</b><small>' + esc(a.author) + ' · ' + esc(TYPE_LABEL[a.type] || a.type) + ' · ' + (extra || ago(a.updatedAt)) + '</small></span>' + statusPill(a) + '</button>';
  const activity = (await api('/inbox').catch(() => ({ items: [] }))).items.slice(0, 5);
  if (seq !== S.seq) return;
  view().innerHTML = '<div class="page">'
    + '<div class="hello"><div><div class="eyebrow">' + (isStaff() ? 'Editorial desk' : 'Writer studio') + '</div><h2>' + hi + ', ' + esc(S.me.name.split(' ')[0]) + '.</h2><p>' + (needs.length ? (isStaff() ? needs.length + ' article' + (needs.length > 1 ? 's' : '') + ' waiting for your review.' : needs.length + ' article' + (needs.length > 1 ? 's' : '') + ' need' + (needs.length > 1 ? '' : 's') + ' your attention.') : 'Everything is up to date. Time to write something great.') + '</p></div><button class="btn primary" data-act="new">' + icon('plus', 16) + ' New article</button></div>'
    + '<div class="stats">'
    + [['Published', count((a) => a.status === 'published'), 'live on the site', 'var(--good)'], ['In review', count((a) => a.status === 'in_review'), 'waiting for an editor', 'var(--warn)'], ['Drafts', count((a) => ['draft', 'changes_requested'].includes(a.status)), 'in progress', 'var(--accent)'], ['Scheduled', count((a) => a.status === 'scheduled'), 'queued to publish', 'var(--violet)']]
      .map(([l, n, s, c]) => '<div class="card stat" style="--c:' + c + '"><small>' + l + '</small><strong>' + n + '</strong><span>' + s + '</span></div>').join('') + '</div>'
    + (needs.length && !isStaff() ? needs.slice(0, 2).map((a) => '<div class="alert"><div class="grow"><b>Changes requested: ' + esc(a.title) + '</b><p>' + esc(a.reviewNote || 'The editor left notes inside the article.') + '</p><div class="actions"><button class="btn sm" data-open="' + a.id + '">Open and fix</button></div></div></div>').join('') : '')
    + '<div class="cols"><section class="card panel"><h3>' + (isStaff() ? 'Review queue' : 'Continue writing') + '<a href="#/library" style="font:600 12.5px var(--sans)">All articles</a></h3><div class="list">'
    + ((isStaff() ? needs : recent).length ? (isStaff() ? needs : recent).slice(0, 6).map((a) => row(a, a.submittedAt ? 'submitted ' + ago(a.submittedAt) : '')).join('') : '<div class="empty"><h3>' + (isStaff() ? 'Queue is clear' : 'No articles yet') + '</h3><span>' + (isStaff() ? 'Nothing is waiting for review.' : 'Start your first article. Drafts save automatically.') + '</span></div>') + '</div>'
    + (isStaff() && recent.length ? '<h3 style="margin-top:22px">Recent activity</h3><div class="list">' + recent.map((a) => row(a)).join('') + '</div>' : '') + '</section>'
    + '<aside style="display:grid;gap:16px;align-content:start">'
    + '<section class="card panel"><h3>Deadlines</h3>' + (due.length ? due.map((a) => '<button class="row" data-open="' + a.id + '" style="grid-template-columns:minmax(0,1fr) auto"><span style="min-width:0"><b>' + esc(a.title) + '</b><small>' + esc(a.author) + '</small></span><span class="pill ' + (Date.parse(a.dueAt) < Date.now() ? 'changes_requested' : 'scheduled') + '">' + new Date(a.dueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + '</span></button>').join('') : '<div class="empty" style="padding:22px 0"><span>No deadlines set.</span></div>') + '</section>'
    + '<section class="card panel"><h3>Latest from the team<a href="#/inbox" style="font:600 12.5px var(--sans)">Inbox</a></h3>' + (activity.length ? activity.map((i) => '<button class="row" data-inbox="' + i.id + '" data-article="' + (i.article_id || '') + '" style="grid-template-columns:minmax(0,1fr)"><span><b>' + esc(i.title) + '</b><small>' + ago(i.created_at) + '</small></span></button>').join('') : '<div class="empty" style="padding:22px 0"><span>No activity yet.</span></div>') + '</section></aside></div></div>';
  bindOpeners(view());
}

function bindOpeners(root) {
  root.onclick = async (e) => {
    const open = e.target.closest('[data-open]'); if (open) { go('#/write/' + open.dataset.open); return; }
    const inb = e.target.closest('[data-inbox]'); if (inb) { api('/inbox/read', { method: 'POST', body: { id: Number(inb.dataset.inbox) } }).then(pulse); if (inb.dataset.article) go('#/write/' + inb.dataset.article); return; }
    if (e.target.closest('[data-act=new]')) newArticleDialog();
  };
}

/* ------------------------------------------------------------------ library */
const TABS = [['all', 'All', () => true], ['draft', 'Drafts', (a) => ['draft', 'changes_requested'].includes(a.status)], ['in_review', 'In review', (a) => a.status === 'in_review'], ['scheduled', 'Scheduled', (a) => a.status === 'scheduled'], ['published', 'Published', (a) => a.status === 'published'], ['archived', 'Unpublished', (a) => a.status === 'archived']];

export async function libraryView(params = new URLSearchParams(), { title = 'Library', fixed = '' } = {}) {
  const seq = S.seq;
  let tab = fixed || params.get('tab') || 'all'; let q = '';
  let showTrash = false; let sort = 'updated';
  view().innerHTML = '<div class="page"><div class="skeleton" style="margin-bottom:10px"></div>' + '<div class="skeleton"></div>'.repeat(5) + '</div>';
  const load = async () => { try { return await loadList(true); } catch (e) { toast(e.message, 'error'); return []; } };
  let all = await load();
  if (seq !== S.seq) return;
  let trash = null;
  const paint = async () => {
    if (showTrash && !trash) trash = (await api('/articles?view=trash')).articles || [];
    if (seq !== S.seq || !$('#lib-body')) return;
    const src = showTrash ? trash : all;
    const fn = (TABS.find((t) => t[0] === tab) || TABS[0])[2];
    let rows = src.filter(showTrash ? () => true : fn);
    if (!isStaff() && !showTrash && false) rows = rows.filter((a) => a.ownerKey === S.me.key);
    if (q) { const n = q.toLowerCase(); rows = rows.filter((a) => (a.title + ' ' + a.slug + ' ' + a.author + ' ' + a.category).toLowerCase().includes(n)); }
    rows = [...rows].sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'due' ? (Date.parse(a.dueAt) || 9e15) - (Date.parse(b.dueAt) || 9e15) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const counts = (f) => all.filter(f).length;
    $('#lib-body').innerHTML = (rows.length ? '<div class="lrow head"><span></span><span>Article</span><span class="c3">Status</span><span class="c4">Author</span><span>Updated</span><span></span></div>' + rows.map((a) => '<div class="lrow" data-id="' + a.id + '"><button data-open="' + a.id + '" aria-label="Open ' + esc(a.title) + '">' + thumb(a) + '</button><button class="t" data-open="' + a.id + '"><b>' + esc(a.title) + '</b><small>' + esc(TYPE_LABEL[a.type] || a.type) + ' · ' + esc(a.category) + ' · ' + a.words.toLocaleString() + ' words' + (a.editingBy && a.editingBy !== S.me.name ? ' · <span style="color:var(--warn)">' + esc(a.editingBy) + ' is editing</span>' : '') + '</small></button><span class="c3">' + statusPill(a) + '</span><span class="muted c4">' + esc(a.author) + '</span><span class="muted">' + ago(a.updatedAt) + '</span><span class="kebab"><button class="icon-btn" data-kebab="' + a.id + '" aria-label="More actions" aria-haspopup="menu">' + icon('more') + '</button></span></div>').join('')
      : '<div class="empty card"><h3>' + (q ? 'No matches' : showTrash ? 'Trash is empty' : 'Nothing here yet') + '</h3><span>' + (q ? 'Try a different search.' : 'Create an article to get started.') + '</span>' + (!q && !showTrash ? '<button class="btn primary" data-act="new" style="margin-top:10px">New article</button>' : '') + '</div>');
    $$('#lib-tabs .chip').forEach((c) => { const t = TABS.find((x) => x[0] === c.dataset.tab); c.classList.toggle('on', !showTrash && c.dataset.tab === tab); const b = c.querySelector('b'); if (b && t) b.textContent = counts(t[2]); });
    $('#lib-trash')?.classList.toggle('on', showTrash);
  };
  view().innerHTML = '<div class="page"><div class="hello"><div><div class="eyebrow">' + esc(title) + '</div><h2 style="font-size:clamp(26px,3vw,34px)">' + (fixed === 'in_review' ? 'Review queue' : isStaff() ? 'All articles' : 'My articles') + '</h2></div><button class="btn primary" data-act="new">' + icon('plus', 16) + ' New article</button></div>'
    + '<div class="toolbar"><div class="chips" id="lib-tabs">' + (fixed ? '' : TABS.map((t) => '<button class="chip" data-tab="' + t[0] + '">' + t[1] + ' <b></b></button>').join('')) + (isStaff() && !fixed ? '<button class="chip" id="lib-trash">' + icon('trash', 14) + ' Trash</button>' : '') + '</div><span style="flex:1"></span>'
    + '<input class="input" id="lib-q" type="search" placeholder="Filter by title, author or category" aria-label="Filter articles"><select class="input" id="lib-sort" style="max-width:150px" aria-label="Sort"><option value="updated">Recently updated</option><option value="title">Title A–Z</option><option value="due">Due date</option></select></div><div id="lib-body" class="list"></div></div>';
  await paint();
  const root = view();
  root.onclick = async (e) => {
    const chip = e.target.closest('[data-tab]'); if (chip) { tab = chip.dataset.tab; showTrash = false; paint(); return; }
    if (e.target.closest('#lib-trash')) { showTrash = !showTrash; paint(); return; }
    const open = e.target.closest('[data-open]'); if (open) { go('#/write/' + open.dataset.open); return; }
    if (e.target.closest('[data-act=new]')) { newArticleDialog(); return; }
    const k = e.target.closest('[data-kebab]'); if (k) rowMenu(k, (showTrash ? trash : all).find((a) => a.id === Number(k.dataset.kebab)), async () => { all = await load(); trash = null; paint(); });
  };
  $('#lib-q').oninput = (e) => { q = e.target.value; paint(); };
  $('#lib-sort').onchange = (e) => { sort = e.target.value; paint(); };
}

function rowMenu(btn, a, refresh) {
  const items = [{ label: 'Open', icon: 'eye', run: () => go('#/write/' + a.id) }];
  if (a.status === 'published') items.push({ label: 'View on site', icon: 'external', run: () => window.open(liveUrl(a), '_blank', 'noopener') });
  if (a.status !== 'trash') items.push({ label: 'Duplicate', icon: 'copy', run: async () => { try { const o = await api('/articles/' + a.id + '/duplicate', { method: 'POST', body: {} }); toast('Duplicated', 'success'); go('#/write/' + o.id); } catch (e) { toast(e.message, 'error'); } } });
  if (isStaff()) {
    if (a.status !== 'trash') items.push({ label: 'Assign to a writer…', icon: 'user', run: () => assignDialog(a, refresh) });
    items.push({ sep: true });
    if (a.status === 'trash') items.push({ label: 'Restore', icon: 'up', run: async () => { await api('/articles/' + a.id + '/restore', { method: 'POST', body: {} }); toast('Restored as a draft', 'success'); refresh(); } });
    else items.push({ label: 'Move to trash', icon: 'trash', danger: true, run: async () => { try { if (await confirmBox({ title: 'Move to trash?', message: '"' + a.title + '" will be hidden from the library. You can restore it later.', confirm: 'Move to trash', danger: true })) { await api('/articles/' + a.id + '/trash', { method: 'POST', body: {} }); toast('Moved to trash', 'success'); refresh(); } } catch (e) { toast(e.message, 'error'); } } });
  }
  popMenu(btn, items);
}

export async function assignDialog(a, done) {
  let writers = []; try { writers = (await api('/writers')).writers || []; } catch { /* ignore */ }
  const to = await dialog({
    title: 'Assign article', body: '<p style="color:var(--mute);margin:4px 0 14px">"' + esc(a.title) + '" will move to the writer\'s library and they will be notified.</p><label class="field"><span>Writer</span><select class="input" autofocus>' + writers.map((w) => '<option value="' + esc(w.key) + '">' + esc(w.name) + '</option>').join('') + '</select></label>',
    actions: [{ label: 'Cancel', value: null }, { label: 'Assign', kind: 'primary', value: (s) => $('select', s).value }]
  });
  if (!to) return;
  try { await api('/articles/' + a.id + '/assign', { method: 'POST', body: { to } }); toast('Assigned', 'success'); done && done(); } catch (e) { toast(e.message, 'error'); }
}

/* -------------------------------------------------------------------- inbox */
export async function inboxView() {
  const seq = S.seq;
  view().innerHTML = '<div class="page"><div class="skeleton"></div></div>';
  let items = []; try { items = (await api('/inbox')).items || []; } catch (e) { toast(e.message, 'error'); }
  if (seq !== S.seq) return;
  const KIND = { review: 'Review', changes: 'Changes', published: 'Published', live: 'Live', comment: 'Comment', assigned: 'Assignment' };
  view().innerHTML = '<div class="page" style="max-width:820px"><div class="hello"><div><div class="eyebrow">Inbox</div><h2 style="font-size:clamp(26px,3vw,34px)">Notifications</h2></div>' + (items.some((i) => !i.read_at) ? '<button class="btn" data-act="all">Mark all read</button>' : '') + '</div>'
    + (items.length ? items.map((i) => '<button class="inbox-item ' + (i.read_at ? '' : 'unread') + '" data-id="' + i.id + '" data-article="' + (i.article_id || '') + '"><span class="dot"></span><span style="min-width:0"><b>' + esc(i.title) + '</b><small>' + esc(i.message || '') + '</small></span><small>' + esc(KIND[i.kind] || '') + ' · ' + ago(i.created_at) + '</small></button>').join('') : '<div class="empty card"><h3>You are all caught up</h3><span>Review requests, comments and assignments will show up here.</span></div>') + '</div>';
  view().onclick = async (e) => {
    if (e.target.closest('[data-act=all]')) { await api('/inbox/read', { method: 'POST', body: { all: true } }); pulse(); inboxView(); return; }
    const it = e.target.closest('.inbox-item'); if (!it) return;
    await api('/inbox/read', { method: 'POST', body: { id: Number(it.dataset.id) } }).catch(() => {}); pulse();
    if (it.dataset.article) go('#/write/' + it.dataset.article); else it.classList.remove('unread');
  };
}

/* --------------------------------------------------------------------- team */
export async function teamView() {
  if (!isStaff()) { go('#/'); return; }
  const seq = S.seq;
  view().innerHTML = '<div class="page"><div class="skeleton"></div></div>';
  const [writers, list, me] = await Promise.all([api('/writers').then((r) => r.writers || []).catch(() => []), loadList(true), api('/me')]);
  if (seq !== S.seq) return;
  const stat = (w) => { const mine = list.filter((a) => a.ownerKey === w.key); return { total: mine.length, live: mine.filter((a) => a.status === 'published').length, review: mine.filter((a) => a.status === 'in_review').length, words: mine.reduce((n, a) => n + a.words, 0) }; };
  view().innerHTML = '<div class="page"><div class="hello"><div><div class="eyebrow">Team</div><h2 style="font-size:clamp(26px,3vw,34px)">Writers and settings</h2><p>Invite creators, give them briefs, and keep one shared style guide.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="/admin/dashboard.html">' + icon('user', 16) + ' Add or remove writers</a><button class="btn primary" data-act="assign">' + icon('send', 16) + ' Assign an article</button></div></div>'
    + '<div class="cols"><section class="card panel"><h3>Writers <span class="pill">' + writers.length + '</span></h3>'
    + (writers.length ? writers.map((w) => { const s = stat(w); return '<div class="row" style="grid-template-columns:44px minmax(0,1fr) auto"><span class="avatar" style="width:44px;height:44px;font-size:15px">' + esc(initials(w.name)) + '</span><span><b>' + esc(w.name) + (w.role === 'editor' ? ' <span class="pill scheduled" style="margin-left:6px">Editor</span>' : '') + '</b><small>@' + esc(w.username) + ' · ' + s.total + ' articles · ' + s.words.toLocaleString() + ' words</small></span><span style="display:flex;gap:8px;align-items:center">' + (S.me.role === 'admin' ? '<button class="btn sm" data-role="' + esc(w.key.replace('creator:', '')) + '" data-to="' + (w.role === 'editor' ? 'creator' : 'editor') + '">' + (w.role === 'editor' ? 'Make writer' : 'Make editor') + '</button>' : '') + '<span class="pill published">' + s.live + ' live</span></span></div>'; }).join('') : '<div class="empty"><h3>No writers yet</h3><span>Create a creator account from the admin dashboard, then assign them articles here.</span></div>') + '</section>'
    + '<aside style="display:grid;gap:16px;align-content:start">'
    + (S.me.role === 'admin' ? '<section class="card panel"><h3>Style guide</h3><p style="color:var(--mute);margin:0 0 12px;font-size:13px">Shown to every writer in the Guide tab. Markdown works.</p><textarea class="input" id="sg" rows="9">' + esc(me.styleGuide) + '</textarea><div style="margin-top:10px;display:flex;justify-content:flex-end"><button class="btn sm primary" data-act="save-guide">Save style guide</button></div></section>'
      + '<section class="card panel"><h3>Import existing articles</h3><p style="color:var(--mute);margin:0 0 12px;font-size:13px">Brings the Markdown articles already in GitHub into the Studio so they can be edited here. Safe to run again: it never overwrites an article that already exists.</p><button class="btn" data-act="import">Import from GitHub</button><div id="import-out" style="margin-top:12px"></div></section>' : '')
    + '</aside></div></div>';
  view().onclick = async (e) => {
    const rb = e.target.closest('[data-role]');
    if (rb) { try { const r = await fetch('/api/admin/creators/' + rb.dataset.role, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: rb.dataset.to }) }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not change the role'); toast(rb.dataset.to === 'editor' ? 'Now an editor. They can review and publish.' : 'Now a writer.', 'success'); teamView(); } catch (er) { toast(er.message, 'error'); } return; }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'assign') newArticleDialog({ assign: true });
    if (a === 'save-guide') { try { await api('/settings', { method: 'PUT', body: { styleGuide: $('#sg').value } }); toast('Style guide saved', 'success'); } catch (er) { toast(er.message, 'error'); } }
    if (a === 'import') {
      const btn = e.target.closest('button'); btn.setAttribute('aria-busy', 'true');
      try { const r = await api('/import', { method: 'POST', body: {} }); if (!$('#import-out')) return; $('#import-out').innerHTML = '<div class="alert ' + (r.errors?.length ? 'warn' : 'good') + '"><div class="grow"><b>Imported ' + r.imported + ', skipped ' + r.skipped + ' already in the Studio</b>' + (r.errors?.length ? '<p>' + esc(r.errors.join('\n')) + '</p>' : '') + '</div></div>'; S.listLoaded = false; } catch (er) { toast(er.message, 'error'); }
      btn.removeAttribute('aria-busy');
    }
  };
}

/* -------------------------------------------------------------------- guide */
export async function guideView() {
  const seq = S.seq;
  const me = await api('/me');
  if (seq !== S.seq) return;
  const html = blocksToHtml(markdownToBlocks(me.styleGuide));
  view().innerHTML = '<div class="page" style="max-width:780px"><div class="eyebrow">Style guide</div><div class="card panel" style="margin-top:12px;padding:30px 34px"><div class="ed-root" style="font-size:17px">' + html + '</div></div></div>';
}

/* ------------------------------------------------------------------ palette */
export function openPalette() {
  const cmds = [
    { label: 'New article', hint: 'Create', run: () => newArticleDialog() }, { label: 'Go to Home', hint: 'Navigate', run: () => go('#/') },
    { label: 'Go to Library', hint: 'Navigate', run: () => go('#/library') }, { label: 'Go to Inbox', hint: 'Navigate', run: () => go('#/inbox') },
    { label: 'Open style guide', hint: 'Navigate', run: () => go('#/guide') }
  ];
  if (isStaff()) cmds.push({ label: 'Review queue', hint: 'Navigate', run: () => go('#/review') }, { label: 'Team and settings', hint: 'Navigate', run: () => go('#/team') });
  const arts = (S.list || []).map((a) => ({ label: a.title, hint: STATUS_LABEL[a.status] || '', run: () => go('#/write/' + a.id) }));
  let results = []; let active = 0;
  const body = document.createElement('div'); body.className = 'pal';
  body.innerHTML = '<input placeholder="Search articles or run a command" aria-label="Search" autofocus><ul role="listbox"></ul>';
  const input = $('input', body); const ul = $('ul', body);
  const paint = () => {
    const q = input.value.trim().toLowerCase();
    results = [...cmds, ...arts].filter((c) => !q || c.label.toLowerCase().includes(q)).slice(0, 30);
    active = Math.min(active, Math.max(0, results.length - 1));
    ul.innerHTML = results.map((r, i) => '<li><button class="' + (i === active ? 'on' : '') + '" data-i="' + i + '">' + esc(r.label) + '<small>' + esc(r.hint) + '</small></button></li>').join('') || '<li><div class="ed-menu-empty">No results</div></li>';
  };
  dialog({ title: 'Quick search', body, actions: [], cls: 'pal', onMount: (s, close) => {
    $('header', s).style.display = 'none'; paint();
    const run = (i) => { const r = results[i]; if (r) { close(null); r.run(); } };
    input.addEventListener('input', () => { active = 0; paint(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(results.length - 1, active + 1); paint(); $('.on', ul)?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); $('.on', ul)?.scrollIntoView({ block: 'nearest' }); }
      if (e.key === 'Enter') { e.preventDefault(); run(active); }
    });
    ul.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) run(Number(b.dataset.i)); });
  } });
}
