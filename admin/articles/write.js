// Editorial Studio — the writing screen: editor, inspector, review and publish actions.
import { BlockEditor } from './editor.js';
import {
  S, api, esc, $, $$, icon, ago, fmtDateTime, toast, dialog, prompt, confirmBox, popMenu, go, isStaff, pulse,
  STATUS_LABEL, TYPE_LABEL, FACT_LABEL, CATEGORIES, statusPill, liveUrl
} from './core.js';
import { slugify, wordCount, readingMinutes, hashDoc, blocksToHtml, blocksToMarkdown, ARTICLE_TYPES, FACT_STATUSES, inlineText } from './engine/blocks.js';
import { checkArticle } from './engine/validate.js';

const FIELD_KEYS = ['title', 'subtitle', 'description', 'type', 'category', 'tags', 'image', 'imageAlt', 'imageCaption', 'seoTitle', 'seoDescription', 'canonicalUrl', 'factStatus', 'lastReviewed', 'sources', 'relatedArticles', 'relatedTools', 'series', 'seriesOrder', 'slug', 'featured', 'author', 'brief', 'dueAt'];
const clone = (v) => JSON.parse(JSON.stringify(v ?? null));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const autosize = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };

let live = null;
export function leaveWrite() { if (live) { live.destroy(); live = null; } }

export async function writeView(id) {
  leaveWrite();
  const seq = S.seq;
  const root = $('#view');
  root.innerHTML = '<div class="page" style="max-width:780px"><div class="skeleton" style="height:200px;margin-bottom:14px"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  let data;
  try { data = await api('/articles/' + id); }
  catch (e) { root.innerHTML = '<div class="page"><div class="empty card"><h3>' + (e.status === 404 ? 'Article not found' : 'Could not open this article') + '</h3><span>' + esc(e.message) + '</span><a class="btn" href="#/library" style="margin-top:10px">Back to library</a></div></div>'; return; }

  if (seq !== S.seq) return;
  const staff = isStaff();
  let A = data.article; let canEdit = data.canEdit; let comments = data.comments || [];
  const F = {}; for (const k of FIELD_KEYS) F[k] = clone(A[k]);
  F.author = A.author;
  let saved = clone(F); let version = A.version; let lastHash = A.hash || '';
  let status = 'saved'; let saving = false; let pending = false; let saveTimer = 0; let firstDirtyAt = 0; let retry = 0; let otherEditor = '';
  let tab = 'details'; let checks = null; let commentBlock = null; let revisions = null; let previewDevice = 'desktop';
  const timers = []; const cleanups = [];
  const BKEY = 'fcm-studio:' + id;

  root.innerHTML = '<div class="editbar" id="editbar"></div><div class="write" id="write"><div class="canvas"><div class="paper" id="paper"></div></div><aside class="insp" id="insp" aria-label="Article settings"></aside></div>';
  const paper = $('#paper'); const insp = $('#insp');
  paper.innerHTML = '<div id="banners"></div><div id="coverbox"></div>'
    + '<textarea class="title" id="f-title" rows="1" maxlength="160" placeholder="Headline" aria-label="Headline"></textarea>'
    + '<textarea class="subtitle" id="f-subtitle" rows="1" maxlength="240" placeholder="Add a short subheading" aria-label="Subheading"></textarea>'
    + '<div id="ed"></div>';
  const titleEl = $('#f-title'); const subEl = $('#f-subtitle');
  titleEl.value = F.title; subEl.value = F.subtitle; autosize(titleEl); autosize(subEl);

  /* ---------------------------------------------------------------- editor */
  const editor = new BlockEditor($('#ed'), {
    onChange: () => { markDirty(); },
    onComment: (blockId, openNew) => { commentBlock = blockId; setTab('comments'); openInsp(); setTimeout(() => $('#cm-text')?.focus(), 50); },
    upload: (file, onProgress) => uploadImage(file, onProgress),
    prompt, toast
  });
  editor.load(A.doc);
  editor.setReadOnly(!canEdit);
  editor.setCommentCounts(commentCounts());
  function commentCounts() { const m = {}; for (const c of comments) if (!c.resolved_at && c.block_id) m[c.block_id] = (m[c.block_id] || 0) + 1; return m; }

  /* ----------------------------------------------------------- save engine */
  function setStatus(s) {
    status = s; const el = $('#savestate'); if (!el) return;
    el.className = 'savestate ' + s;
    el.innerHTML = '<i></i>' + ({ saved: 'Saved' + (A.updatedAt ? ' · ' + ago(A.updatedAt) : ''), saving: 'Saving…', dirty: 'Unsaved changes', error: 'Offline · kept on this device', readonly: 'Read only' }[s] || '');
  }
  function backup() {
    try { localStorage.setItem(BKEY, JSON.stringify({ at: Date.now(), base: version, dirty: true, fields: F, doc: editor.getDoc() })); } catch { /* storage full or blocked */ }
  }
  let backupTimer = 0;
  function markDirty() {
    if (!canEdit) return;
    setStatus('dirty'); clearTimeout(backupTimer); backupTimer = setTimeout(backup, 500);
    if (!firstDirtyAt) firstDirtyAt = Date.now();
    clearTimeout(saveTimer);
    const wait = Math.max(300, Math.min(2200, 14000 - (Date.now() - firstDirtyAt)));
    saveTimer = setTimeout(() => save(), wait);
    queueChecks(); paintMeters();
  }
  async function save({ manual = false, force = false } = {}) {
    if (!canEdit) return true;
    if (saving) { pending = true; return false; }
    clearTimeout(saveTimer);
    const doc = editor.getDoc(); const hash = hashDoc(doc.blocks);
    const changed = {}; for (const k of FIELD_KEYS) if (!same(F[k], saved[k])) changed[k] = F[k];
    const docChanged = hash !== lastHash;
    if (!docChanged && !Object.keys(changed).length && !force) { if (status !== 'saved') setStatus('saved'); return true; }
    saving = true; setStatus('saving');
    try {
      const out = await api('/articles/' + id, { method: 'PATCH', body: { baseVersion: version, fields: changed, doc: docChanged ? doc : undefined, autosave: !manual, force } });
      version = out.version; A.version = version; if (out.updatedAt) A.updatedAt = out.updatedAt;
      Object.assign(saved, clone(changed)); if (docChanged) lastHash = out.hash || hash;
      if (out.slug && out.slug !== F.slug) { F.slug = out.slug; saved.slug = out.slug; paintInspector(); }
      if (A.status === 'published') { A.pendingUpdate = true; paintBanners(); paintActions(); }
      firstDirtyAt = 0; retry = 0; setStatus('saved');
      try { const b = JSON.parse(localStorage.getItem(BKEY) || 'null'); if (b) { b.dirty = false; localStorage.setItem(BKEY, JSON.stringify(b)); } } catch { /* ignore */ }
      saving = false;
      if (pending) { pending = false; save(); }
      return true;
    } catch (e) {
      saving = false; pending = false;
      if (e.status === 409 && e.data?.code === 'slug') { F.slug = saved.slug; paintInspector(); setStatus('dirty'); toast('That URL is already used by another article. Choose a different slug.', 'error'); return false; }
      if (e.status === 409) { setStatus('error'); backup(); conflict(); return false; }
      if (e.status === 403) { setStatus('error'); toast(e.message, 'error'); await reloadMeta(); return false; }
      setStatus('error'); backup(); retry = Math.min(retry + 1, 5);
      clearTimeout(saveTimer); saveTimer = setTimeout(() => save(), 4000 * retry);
      if (manual) toast('Could not save. Your work is kept on this device and will retry.', 'error');
      return false;
    }
  }
  async function conflict() {
    const pick = await dialog({
      title: 'Someone else saved this article', body: '<p style="color:var(--soft);margin:6px 0 10px">A newer version exists on the server' + (otherEditor ? ' (' + esc(otherEditor) + ' was editing)' : '') + '. Your changes are safely stored on this device either way.</p>',
      actions: [{ label: 'Load the newer version', value: 'theirs' }, { label: 'Keep mine and overwrite', kind: 'danger', value: 'mine' }]
    });
    if (pick === 'mine') { const latest = await api('/articles/' + id); version = latest.article.version; await save({ manual: true, force: true }); }
    else if (pick === 'theirs') { try { localStorage.removeItem(BKEY); } catch { /* ignore */ } writeView(id); }
  }

  /* -------------------------------------------------------------- metrics */
  function paintMeters() {
    const blocks = editor.blocks; const w = wordCount(blocks);
    const el = $('#meters'); if (el) el.innerHTML = '<span class="meter words">' + w.toLocaleString() + ' words · ' + readingMinutes(blocks) + ' min read</span>';
  }
  let checkTimer = 0;
  function queueChecks() { clearTimeout(checkTimer); checkTimer = setTimeout(runChecks, 600); }
  function runChecks() {
    checks = checkArticle({ ...F, id, author: F.author }, editor.getDoc().blocks);
    const ring = $('#ring'); if (ring) { ring.style.setProperty('--p', checks.score); ring.style.setProperty('--rc', checks.fails ? 'var(--bad)' : checks.warns ? 'var(--warn)' : 'var(--good)'); ring.querySelector('span').textContent = checks.ok ? (checks.warns ? checks.warns + '!' : '✓') : checks.fails; ring.title = checks.ok ? 'Ready to publish' + (checks.warns ? ' with ' + checks.warns + ' suggestions' : '') : checks.fails + ' things to fix before publishing'; }
    if (tab === 'checks') paintInspector();
    if (tab === 'outline') paintInspector();
  }

  /* ------------------------------------------------------------- top bar */
  function paintActions() {
    const bar = $('#editbar'); if (!bar) return;
    const st = A.status; const mine = A.ownerKey === S.me.key;
    let primary = '';
    if (staff) {
      if (st === 'in_review') primary = '<button class="btn" data-act="changes">Request changes</button><button class="btn good" data-act="approve">' + icon('check', 16) + ' Approve and publish</button>';
      else if (st === 'scheduled') primary = '<button class="btn" data-act="unschedule">Cancel schedule</button>';
      else if (st === 'published' && !A.pendingUpdate) primary = '<button class="btn" disabled>' + icon('check', 16) + ' Published</button>';
      else primary = '<button class="btn" data-act="schedule" title="Schedule">' + icon('clock', 16) + '</button><button class="btn primary" data-act="publish">' + icon('bolt', 16) + (st === 'published' ? ' Publish update' : ' Publish') + '</button>';
    } else if (st === 'in_review') primary = '<button class="btn" data-act="withdraw">Withdraw</button>';
    else if (canEdit && (st !== 'published' || A.pendingUpdate)) primary = '<button class="btn primary" data-act="submit">' + icon('send', 16) + (st === 'published' ? ' Submit update' : ' Submit for review') + '</button>';
    bar.innerHTML = '<a class="icon-btn" href="#/library" aria-label="Back to library">' + icon('back') + '</a><div class="grow">' + statusPill(A) + '<span id="savestate" class="savestate"></span><span id="meters"></span>' + (otherEditor ? '<span class="pill changes_requested">' + esc(otherEditor) + ' is editing</span>' : '') + '</div>'
      + '<button class="ring" id="ring" data-act="checks" aria-label="Publish checklist"><span></span></button>'
      + '<button class="icon-btn" data-act="preview" aria-label="Preview" title="Preview">' + icon('eye') + '</button><button class="icon-btn" data-act="panel" aria-label="Article settings" title="Settings">' + icon('panel') + '</button>'
      + primary + '<span class="kebab"><button class="icon-btn" data-act="more" aria-label="More actions" aria-haspopup="menu">' + icon('more') + '</button></span>';
    setStatus(canEdit ? status : 'readonly'); paintMeters(); runChecks();
  }
  const bar = $('#editbar');
  bar.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    if (a === 'panel') insp.classList.toggle('open');
    if (a === 'checks') { setTab('checks'); openInsp(); }
    if (a === 'preview') preview();
    if (a === 'more') moreMenu(b);
    if (a === 'submit') submit(b);
    if (a === 'withdraw') act('/withdraw', {}, 'Withdrawn. You can edit again.');
    if (a === 'publish' || a === 'approve') publishNow(b);
    if (a === 'changes') requestChanges();
    if (a === 'schedule') scheduleDialog();
    if (a === 'unschedule') act('/unschedule', {}, 'Schedule cancelled');
  });
  async function act(path, body, msg) {
    try { await save({ manual: true }); await api('/articles/' + id + path, { method: 'POST', body }); if (msg) toast(msg, 'success'); S.listLoaded = false; await reloadMeta(); pulse(); } catch (e) { toast(e.message, 'error'); }
  }
  async function submit(btn) {
    if (!(await save({ manual: true }))) { toast('Fix the save problem first', 'error'); return; }
    runChecks();
    if (checks.fails) {
      const go2 = await dialog({ title: 'A few things first', body: failList(checks) + '<p style="color:var(--mute);font-size:13px">You can still submit. The editor will see these items too.</p>', actions: [{ label: 'Fix them', value: false }, { label: 'Submit anyway', kind: 'primary', value: true }] });
      if (!go2) { setTab('checks'); openInsp(); return; }
    }
    const note = await prompt({ title: 'Submit for review', label: 'Anything the editor should know? (optional)', placeholder: 'Sources, what you are unsure about, deadlines…', multiline: true, confirm: 'Submit', required: false });
    if (note === null) return;
    btn.setAttribute('aria-busy', 'true');
    try { await api('/articles/' + id + '/submit', { method: 'POST', body: { note } }); toast('Submitted. An editor will review it.', 'success'); S.listLoaded = false; await reloadMeta(); pulse(); } catch (e) { toast(e.message, 'error'); }
    btn.removeAttribute('aria-busy');
  }
  const failList = (c) => '<div>' + c.checks.filter((x) => x.state === 'fail').map((x) => '<div class="check fail"><span class="dot">!</span><span><b>' + esc(x.label) + '</b><small>' + esc(x.hint) + '</small></span></div>').join('') + '</div>';
  async function publishNow(btn) {
    if (!(await save({ manual: true }))) { toast('Fix the save problem first', 'error'); return; }
    runChecks();
    if (checks.fails) { setTab('checks'); openInsp(); await dialog({ title: 'Not ready to publish', body: failList(checks), actions: [{ label: 'Fix these', kind: 'primary', value: true }] }); return; }
    if (checks.warns) { const ok = await dialog({ title: 'Publish with ' + checks.warns + ' suggestion' + (checks.warns > 1 ? 's' : '') + '?', body: '<div>' + checks.checks.filter((x) => x.state === 'warn').map((x) => '<div class="check warn"><span class="dot">!</span><span><b>' + esc(x.label) + '</b><small>' + esc(x.hint) + '</small></span></div>').join('') + '</div>', actions: [{ label: 'Review them', value: false }, { label: 'Publish anyway', kind: 'primary', value: true }] }); if (!ok) { setTab('checks'); openInsp(); return; } }
    btn.setAttribute('aria-busy', 'true');
    try {
      const out = await api('/articles/' + id + '/publish', { method: 'POST', body: {} });
      toast('Published. It will be live in about two minutes.', 'success'); S.listLoaded = false; await reloadMeta(); pulse(); void out;
    } catch (e) { if (e.data?.checks) { checks = null; setTab('checks'); } toast(e.message, 'error'); }
    btn.removeAttribute('aria-busy');
  }
  async function requestChanges() {
    const note = await prompt({ title: 'Request changes', label: 'What should the writer fix?', placeholder: 'Be specific. They will see this in their inbox.', multiline: true, confirm: 'Send back' });
    if (!note) return; await act('/request-changes', { note }, 'Sent back to the writer');
  }
  async function scheduleDialog() {
    const soon = new Date(Date.now() + 3600000); soon.setMinutes(0, 0, 0); const pad = (n) => String(n).padStart(2, '0');
    const val = soon.getFullYear() + '-' + pad(soon.getMonth() + 1) + '-' + pad(soon.getDate()) + 'T' + pad(soon.getHours()) + ':00';
    const at = await dialog({ title: 'Schedule publishing', body: '<label class="field"><span>Publish at (your local time)</span><input class="input" type="datetime-local" value="' + val + '" autofocus><small>It is published automatically within a few minutes of this time.</small></label>', actions: [{ label: 'Cancel', value: null }, { label: 'Schedule', kind: 'primary', value: (s) => $('input', s).value }] });
    if (!at) return; await act('/schedule', { at: new Date(at).toISOString() }, 'Scheduled for ' + fmtDateTime(at));
  }
  function moreMenu(btn) {
    const items = [];
    if (A.status === 'published') items.push({ label: 'View on site', icon: 'external', run: () => window.open(liveUrl(A), '_blank', 'noopener') });
    items.push({ label: 'Duplicate', icon: 'copy', run: async () => { try { const o = await api('/articles/' + id + '/duplicate', { method: 'POST', body: {} }); S.listLoaded = false; toast('Duplicated', 'success'); go('#/write/' + o.id); } catch (e) { toast(e.message, 'error'); } } });
    items.push({ label: 'Copy as Markdown', icon: 'code', run: async () => { try { await navigator.clipboard.writeText(blocksToMarkdown(editor.getDoc().blocks)); toast('Markdown copied', 'success'); } catch { toast('Copy was blocked by the browser', 'error'); } } });
    items.push({ label: 'Version history', icon: 'history', run: () => { setTab('history'); openInsp(); } });
    if (staff) {
      items.push({ sep: true });
      if (S.me.role === 'admin' && A.status === 'published') items.push({ label: 'Unpublish', icon: 'x', danger: true, run: async () => { if (await confirmBox({ title: 'Unpublish this article?', message: 'It will be removed from the website after the next build (about two minutes). The text stays here as an archived draft.', confirm: 'Unpublish', danger: true })) act('/unpublish', {}, 'Unpublishing'); } });
      if (A.status !== 'published') items.push({ label: 'Move to trash', icon: 'trash', danger: true, run: async () => { if (await confirmBox({ title: 'Move to trash?', message: 'You can restore it from the library later.', confirm: 'Move to trash', danger: true })) { try { await api('/articles/' + id + '/trash', { method: 'POST', body: {} }); S.listLoaded = false; go('#/library'); } catch (e) { toast(e.message, 'error'); } } } });
    }
    popMenu(btn, items);
  }

  /* -------------------------------------------------------------- banners */
  function paintBanners() {
    const box = $('#banners'); if (!box) return; const out = [];
    const st = A.status;
    if (data.recovered) out.push(data.recovered);
    if (st === 'changes_requested' && A.reviewNote) out.push('<div class="alert"><div class="grow"><b>Changes requested</b><p>' + esc(A.reviewNote) + '</p></div></div>');
    if (st === 'in_review') out.push(staff && A.ownerKey !== S.me.key ? '<div class="alert warn"><div class="grow"><b>Waiting for your review</b><p>Read through, leave comments on blocks, then approve or send it back.</p></div></div>' : '<div class="alert info"><div class="grow"><b>In review</b><p>An editor is looking at this. Editing is locked. Withdraw it to make changes.</p></div></div>');
    if (st === 'scheduled') out.push('<div class="alert info"><div class="grow"><b>Scheduled for ' + esc(fmtDateTime(A.scheduledFor)) + '</b><p>It will publish automatically.</p></div></div>');
    if (A.deployState === 'building') out.push('<div class="alert info"><div class="grow"><b>Going live…</b><p>The site is rebuilding. This takes about two minutes. You can keep working.</p></div></div>');
    if (A.deployState === 'failed') out.push('<div class="alert"><div class="grow"><b>The site build did not finish</b><p>' + esc(A.deployError || 'Check the deploy log in Cloudflare.') + '</p></div></div>');
    if (A.status === 'published' && A.deployState === 'live' && A.pendingUpdate) out.push('<div class="alert info"><div class="grow"><b>Unpublished changes</b><p>The live article still shows the previous version.</p></div></div>');
    if (A.converted) out.push('<div class="alert info"><div class="grow"><b>Converted from the old editor</b><p>Give the formatting a quick look before publishing.</p></div></div>');
    if (A.brief) out.push('<details class="alert info" ' + (A.status === 'draft' && A.words < 80 ? 'open' : '') + '><summary style="cursor:pointer;font-weight:700">Assignment brief' + (A.dueAt ? ' · due ' + esc(new Date(A.dueAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) : '') + '</summary><p style="margin-top:8px">' + esc(A.brief) + '</p></details>');
    box.innerHTML = out.join('');
    $('#rec-restore')?.addEventListener('click', restoreBackup); $('#rec-discard')?.addEventListener('click', () => { try { localStorage.removeItem(BKEY); } catch { /* ignore */ } data.recovered = ''; paintBanners(); });
  }
  async function reloadMeta() {
    const fresh = await api('/articles/' + id);
    const keepDoc = A.doc; A = { ...fresh.article, doc: keepDoc }; canEdit = fresh.canEdit; comments = fresh.comments || comments;
    if (!canEdit) { editor.getDoc(); }
    editor.setReadOnly(!canEdit); titleEl.readOnly = !canEdit; subEl.readOnly = !canEdit;
    version = fresh.article.version; saved.slug = fresh.article.slug; if (!staff || true) { F.slug = fresh.article.slug; }
    paintActions(); paintBanners(); paintCover(); paintInspector(); watchDeploy();
  }
  function restoreBackup() {
    try { const b = JSON.parse(localStorage.getItem(BKEY)); for (const k of FIELD_KEYS) if (b.fields && k in b.fields) F[k] = b.fields[k]; editor.replaceBlocks(b.doc.blocks); titleEl.value = F.title; subEl.value = F.subtitle; autosize(titleEl); autosize(subEl); data.recovered = ''; paintBanners(); paintCover(); paintInspector(); markDirty(); toast('Recovered your unsaved changes', 'success'); } catch { toast('Could not restore the backup', 'error'); }
  }
  // a crashed tab or lost connection can leave newer text on this device than on the server
  try {
    const b = JSON.parse(localStorage.getItem(BKEY) || 'null');
    if (b && b.dirty && canEdit && b.doc && hashDoc(b.doc.blocks) !== lastHash && b.base <= version) {
      data.recovered = '<div class="alert warn"><div class="grow"><b>Unsaved changes found on this device</b><p>From ' + esc(ago(new Date(b.at).toISOString())) + '. Restore them?</p><div class="actions"><button class="btn sm primary" id="rec-restore">Restore</button><button class="btn sm" id="rec-discard">Discard</button></div></div></div>';
    }
  } catch { /* ignore */ }

  /* ---------------------------------------------------------------- cover */
  function paintCover() {
    const box = $('#coverbox'); if (!box) return;
    box.innerHTML = F.image
      ? '<div class="cover has"><img alt="' + esc(F.imageAlt) + '" src="' + esc(F.image) + '">' + (canEdit ? '<div class="cover-tools"><button class="btn sm" data-c="change">Change</button><button class="btn sm" data-c="remove">Remove</button></div>' : '') + '</div>' + (canEdit ? '<input class="input" data-f="imageAlt" placeholder="Describe the cover image (alt text)" value="' + esc(F.imageAlt) + '" style="margin:8px 0 0;font-size:13px">' : '')
      : (canEdit ? '<div class="cover"><button class="cover-add" data-c="change">' + icon('image', 20) + ' Add a cover image <span style="font-weight:500;opacity:.7">· shown on cards and when shared</span></button></div>' : '');
  }
  $('#coverbox').addEventListener('click', (e) => {
    const c = e.target.closest('[data-c]'); if (!c) return;
    if (c.dataset.c === 'remove') { F.image = ''; F.imageAlt = ''; paintCover(); markDirty(); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => { if (!input.files[0]) return; const box = $('#coverbox'); box.innerHTML = '<div class="cover"><div class="ed-image-wait" style="border:0"><span class="ed-spin"></span><b>Uploading cover…</b><i style="--p:0%"></i></div></div>'; try { F.image = await uploadImage(input.files[0], (p) => box.querySelector('i')?.style.setProperty('--p', p + '%')); markDirty(); } catch (er) { toast(er.message, 'error'); } paintCover(); };
    input.click();
  });
  const onTop = (e) => {
    if (e.target === titleEl) { F.title = titleEl.value.replace(/\n/g, ' '); autosize(titleEl); markDirty(); }
    else if (e.target === subEl) { F.subtitle = subEl.value.replace(/\n/g, ' '); autosize(subEl); markDirty(); }
    else if (e.target.dataset?.f && e.target.closest('#coverbox')) { F[e.target.dataset.f] = e.target.value; markDirty(); }
  };
  paper.addEventListener('input', onTop);
  for (const el of [titleEl, subEl]) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (el === titleEl) subEl.focus(); else editor.focusFirst(); } });
  let slugAtFocus = F.slug; let titleAtFocus = F.title;
  titleEl.addEventListener('focus', () => { titleAtFocus = F.title; slugAtFocus = F.slug; });
  titleEl.addEventListener('blur', () => { if (A.status !== 'published' && A.publishedVersion == null && slugAtFocus === slugify(titleAtFocus) && F.title.trim()) { const s = slugify(F.title); if (s && s !== F.slug) { F.slug = s; paintInspector(); markDirty(); } } });
  titleEl.readOnly = !canEdit; subEl.readOnly = !canEdit;

  /* ------------------------------------------------------------- inspector */
  const TABS = [['details', 'Details'], ['seo', 'SEO'], ['checks', 'Checklist'], ['comments', 'Comments'], ['history', 'History'], ['outline', 'Outline']];
  function openInsp() { insp.classList.add('open'); }
  function setTab(t) { tab = t; if (t === 'history') loadRevisions(); if (t === 'comments') refreshComments(); paintInspector(); }
  const dis = () => (canEdit ? '' : ' disabled');
  function fieldInput(key, label, opts = {}) {
    return '<label class="field"><span>' + esc(label) + (opts.max ? '<span class="count" data-count="' + key + '"></span>' : '') + '</span>' + (opts.area ? '<textarea class="input" data-f="' + key + '" rows="' + (opts.rows || 3) + '" maxlength="' + (opts.max || 600) + '" placeholder="' + esc(opts.ph || '') + '"' + dis() + '>' + esc(F[key]) + '</textarea>' : '<input class="input" data-f="' + key + '" value="' + esc(F[key]) + '" placeholder="' + esc(opts.ph || '') + '"' + (opts.type ? ' type="' + opts.type + '"' : '') + (opts.list ? ' list="' + opts.list + '"' : '') + dis() + '>') + (opts.hint ? '<small>' + opts.hint + '</small>' : '') + '</label>';
  }
  function tagBox(key, ph, listId) {
    return '<div class="tagbox" data-tags="' + key + '">' + (F[key] || []).map((t, i) => '<span class="tag">' + esc(t) + (canEdit ? '<button data-rm="' + i + '" aria-label="Remove ' + esc(t) + '">×</button>' : '') + '</span>').join('') + (canEdit ? '<input placeholder="' + esc(ph) + '"' + (listId ? ' list="' + listId + '"' : '') + ' aria-label="' + esc(ph) + '">' : '') + '</div>';
  }
  function paintInspector() {
    const published = (S.list || []).filter((a) => a.status === 'published' && a.id !== id);
    let html = '<div class="tabs" role="tablist">' + TABS.map(([k, l]) => '<button role="tab" data-tab="' + k + '" class="' + (k === tab ? 'on' : '') + '" aria-selected="' + (k === tab) + '">' + l + (k === 'comments' && comments.filter((c) => !c.resolved_at).length ? '<span class="n">' + comments.filter((c) => !c.resolved_at).length + '</span>' : '') + (k === 'checks' && checks && checks.fails ? '<span class="n">' + checks.fails + '</span>' : '') + '</button>').join('') + '</div><div class="tabpane">';
    if (tab === 'details') {
      html += '<div class="field"><span>Article type</span><select class="input" data-f="type"' + dis() + '>' + ARTICLE_TYPES.map((t) => '<option value="' + t + '"' + (t === F.type ? ' selected' : '') + '>' + esc(TYPE_LABEL[t]) + '</option>').join('') + '</select></div>'
        + fieldInput('category', 'Category', { list: 'dl-cats', ph: 'Guides' }) + '<datalist id="dl-cats">' + [...new Set([...CATEGORIES, ...(S.list || []).map((a) => a.category)])].map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist>'
        + fieldInput('description', 'Summary', { area: true, max: 400, rows: 3, ph: 'One or two sentences. Shown on cards and in search results.' })
        + '<div class="field"><span>Tags</span>' + tagBox('tags', 'Add a tag and press Enter') + '<small>Tags drive related articles.</small></div>'
        + '<div class="field"><span>How confident is this?</span><select class="input" data-f="factStatus"' + dis() + '>' + FACT_STATUSES.map((t) => '<option value="' + t + '"' + (t === F.factStatus ? ' selected' : '') + '>' + esc(FACT_LABEL[t]) + '</option>').join('') + '</select><small>Shown on the article. Be honest on leaks.</small></div>'
        + '<label class="field"><span>Sources <small>one link per line</small></span><textarea class="input" data-f="sources" rows="3" placeholder="https://…"' + dis() + '>' + esc((F.sources || []).join('\n')) + '</textarea></label>'
        + fieldInput('lastReviewed', 'Facts last checked', { type: 'date' })
        + '<div class="field"><span>Series</span><div style="display:grid;grid-template-columns:1fr 84px;gap:8px"><input class="input" data-f="series" value="' + esc(F.series) + '" placeholder="e.g. Stellar Series"' + dis() + '><input class="input" data-f="seriesOrder" type="number" min="1" value="' + esc(F.seriesOrder ?? '') + '" placeholder="Part"' + dis() + '></div></div>'
        + '<div class="field"><span>Related articles</span>' + tagBox('relatedArticles', 'Type a slug and press Enter', 'dl-rel') + '<datalist id="dl-rel">' + published.map((a) => '<option value="' + esc(a.slug) + '">' + esc(a.title) + '</option>').join('') + '</datalist></div>'
        + (staff ? '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0">' + fieldInput('author', 'Byline', { ph: 'Author name' }) + '<label class="field" style="grid-template-columns:auto 1fr;align-items:center;gap:10px"><input type="checkbox" data-f="featured"' + (F.featured ? ' checked' : '') + '><span>Feature on the blog homepage</span></label>' + fieldInput('brief', 'Assignment brief', { area: true, rows: 3, max: 4000, ph: 'Visible to the writer' }) + '<label class="field"><span>Due date</span><input class="input" type="date" data-f="dueAt" value="' + esc(F.dueAt ? String(F.dueAt).slice(0, 10) : '') + '"></label>' : '');
    } else if (tab === 'seo') {
      const slugLocked = A.status === 'published' || A.publishedVersion != null;
      html += '<label class="field"><span>URL slug</span><input class="input" data-f="slug" value="' + esc(F.slug) + '"' + (slugLocked || !canEdit ? ' disabled' : '') + ' maxlength="110"><small>fcmobiletools.online/blog/' + esc(F.slug) + '/' + (slugLocked ? ' · locked once published' : '') + '</small></label>'
        + fieldInput('seoTitle', 'SEO title', { max: 120, ph: F.title }) + fieldInput('seoDescription', 'SEO description', { area: true, max: 300, rows: 3, ph: F.description })
        + fieldInput('canonicalUrl', 'Canonical URL', { ph: 'Only if this story first appeared elsewhere' })
        + '<div class="label" style="margin:18px 0 8px">Search preview</div><div class="serp"><small>fcmobiletools.online › blog › ' + esc(F.slug) + '</small><b>' + esc(F.seoTitle || F.title || 'Headline') + '</b><p>' + esc(F.seoDescription || F.description || 'Your summary appears here.') + '</p></div>';
    } else if (tab === 'checks') {
      if (!checks) runChecks();
      html += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px"><div class="ring" style="--p:' + checks.score + ';--rc:' + (checks.fails ? 'var(--bad)' : checks.warns ? 'var(--warn)' : 'var(--good)') + ';width:52px;height:52px"><span style="font-size:14px">' + checks.score + '</span></div><div><b>' + (checks.ok ? 'Ready to publish' : checks.fails + ' to fix before publishing') + '</b><div style="color:var(--mute);font-size:12.5px">' + checks.warns + ' suggestion' + (checks.warns === 1 ? '' : 's') + '</div></div></div>'
        + [...checks.checks].sort((a, b) => ({ fail: 0, warn: 1, pass: 2 }[a.state] - { fail: 0, warn: 1, pass: 2 }[b.state])).map((c) => '<button class="check ' + c.state + '" data-jump="' + esc(c.field) + '"><span class="dot">' + (c.state === 'pass' ? '✓' : '!') + '</span><span><b>' + esc(c.label) + '</b>' + (c.hint ? '<small>' + esc(c.hint) + '</small>' : '') + '</span></button>').join('');
    } else if (tab === 'comments') {
      const open = comments.filter((c) => !c.resolved_at); const done = comments.filter((c) => c.resolved_at);
      const ref = commentBlock ? editor.block(commentBlock) : null;
      html += '<div class="field"><span>' + (ref ? 'Comment on a block' : 'New comment') + '</span>' + (ref ? '<div class="cm"><span class="ref">“' + esc(inlineText(ref.html || (ref.items || []).join(' ') || ref.type).slice(0, 90)) + '”</span> <button class="btn sm ghost" id="cm-clear">Clear</button></div>' : '<small>Hover a block and use its ⋮⋮ menu to attach a comment to it.</small>') + '<textarea class="input" id="cm-text" rows="3" placeholder="Write a comment…"></textarea><button class="btn sm primary" id="cm-send" style="justify-self:end">Post comment</button></div>'
        + (open.length ? open.map(commentCard).join('') : '<div class="empty" style="padding:20px 0"><span>No open comments.</span></div>') + (done.length ? '<details style="margin-top:12px"><summary style="cursor:pointer;color:var(--mute)">' + done.length + ' resolved</summary>' + done.map(commentCard).join('') + '</details>' : '');
    } else if (tab === 'history') {
      html += revisions === null ? '<div class="skeleton"></div>' : revisions.length ? '<p style="color:var(--mute);font-size:13px;margin-top:0">Snapshots are kept when you submit, publish, or save manually, and every few minutes while you write.</p>' + revisions.map((r) => '<button class="rev" data-rev="' + r.id + '"><span><b>' + esc(({ autosave: 'Autosave', save: 'Saved', submit: 'Submitted for review', approve: 'Approved', publish: 'Published', restore: 'Restored' }[r.action]) || r.action) + '</b><small>' + esc(r.by || 'Unknown') + (r.note ? ' · ' + esc(r.note.slice(0, 40)) : '') + '</small></span><small>' + ago(r.at) + '</small></button>').join('') : '<div class="empty" style="padding:24px 0"><span>No snapshots yet.</span></div>';
    } else if (tab === 'outline') {
      const o = editor.outline();
      html += o.length ? '<div class="outline">' + o.map((h) => '<a href="#" class="l' + h.level + '" data-block="' + h.id + '">' + esc(h.text || 'Untitled heading') + '</a>').join('') + '</div>' : '<div class="empty" style="padding:24px 0"><span>Add headings to see the structure of your article.</span></div>';
    }
    insp.innerHTML = html + '</div>';
    $$('[data-count]', insp).forEach((c) => { const v = String(F[c.dataset.count] || ''); const max = c.dataset.count === 'seoTitle' ? 60 : c.dataset.count === 'seoDescription' ? 155 : c.dataset.count === 'description' ? 160 : 400; c.textContent = v.length + '/' + max; c.className = 'count ' + (v.length > max ? 'bad' : v.length > max * 0.6 ? 'ok' : ''); });
  }
  const commentCard = (c) => '<div class="cm ' + (c.resolved_at ? 'done' : '') + '"><header><b>' + esc(c.author_name) + '</b><span>' + ago(c.created_at) + '</span></header>' + (c.block_id && editor.block(c.block_id) ? '<button class="ref" data-block="' + esc(c.block_id) + '" style="text-align:left">“' + esc(inlineText(editor.block(c.block_id).html || (editor.block(c.block_id).items || []).join(' ') || '').slice(0, 70)) + '”</button>' : '') + '<p>' + esc(c.body) + '</p>' + (!c.resolved_at ? '<button class="btn sm" data-resolve="' + c.id + '">Resolve</button>' : '') + '</div>';
  async function refreshComments() { try { comments = (await api('/articles/' + id + '/comments')).comments; editor.setCommentCounts(commentCounts()); if (tab === 'comments') paintInspector(); } catch { /* ignore */ } }
  async function loadRevisions() { try { revisions = (await api('/articles/' + id + '/revisions')).revisions; } catch { revisions = []; } if (tab === 'history') paintInspector(); }

  insp.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { setTab(t.dataset.tab); return; }
    const rm = e.target.closest('[data-rm]'); if (rm) { const key = rm.closest('[data-tags]').dataset.tags; F[key].splice(Number(rm.dataset.rm), 1); paintInspector(); markDirty(); return; }
    const jump = e.target.closest('[data-jump]'); if (jump) { const f = jump.dataset.jump; if (f === 'title') { titleEl.focus(); titleEl.scrollIntoView({ block: 'center' }); } else if (f === 'body') { const first = editor.root.querySelector('[data-ed]'); first?.scrollIntoView({ block: 'center' }); } else if (f === 'cover') { $('#coverbox').scrollIntoView({ block: 'center' }); } else if (f === 'slug' || f === 'seo') setTab('seo'); else if (['description', 'category', 'type', 'tags', 'facts', 'series'].includes(f)) { setTab('details'); setTimeout(() => $('[data-f=' + (f === 'facts' ? 'factStatus' : f === 'tags' ? 'category' : f) + ']', insp)?.focus(), 30); } return; }
    const blk = e.target.closest('[data-block]'); if (blk) { e.preventDefault(); editor.scrollToBlock(blk.dataset.block); return; }
    const res = e.target.closest('[data-resolve]'); if (res) { try { await api('/comments/' + res.dataset.resolve + '/resolve', { method: 'POST', body: {} }); await refreshComments(); } catch (er) { toast(er.message, 'error'); } return; }
    if (e.target.closest('#cm-clear')) { commentBlock = null; paintInspector(); return; }
    if (e.target.closest('#cm-send')) { const ta = $('#cm-text'); const body = ta.value.trim(); if (!body) return; try { await api('/articles/' + id + '/comments', { method: 'POST', body: { body, blockId: commentBlock || undefined } }); commentBlock = null; await refreshComments(); toast('Comment posted', 'success'); } catch (er) { toast(er.message, 'error'); } return; }
    const rev = e.target.closest('[data-rev]'); if (rev) showRevision(Number(rev.dataset.rev));
  });
  insp.addEventListener('input', (e) => {
    const el = e.target; const key = el.dataset?.f; if (!key || !canEdit) return;
    if (key === 'sources') F.sources = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (key === 'seriesOrder') F.seriesOrder = el.value === '' ? null : Number(el.value);
    else if (key === 'featured') F.featured = el.checked;
    else if (key === 'slug') F.slug = slugify(el.value) || el.value.toLowerCase();
    else if (key === 'dueAt') F.dueAt = el.value || null;
    else F[key] = el.value;
    const c = $('[data-count="' + key + '"]', insp); if (c) { const max = key === 'seoTitle' ? 60 : key === 'seoDescription' ? 155 : key === 'description' ? 160 : 400; c.textContent = el.value.length + '/' + max; c.className = 'count ' + (el.value.length > max ? 'bad' : el.value.length > max * 0.6 ? 'ok' : ''); }
    if (tab === 'seo') { const s = $('.serp', insp); if (s) { s.querySelector('b').textContent = F.seoTitle || F.title || 'Headline'; s.querySelector('p').textContent = F.seoDescription || F.description || ''; s.querySelector('small').textContent = 'fcmobiletools.online › blog › ' + F.slug; } }
    markDirty();
  });
  insp.addEventListener('change', (e) => { const el = e.target; if (el.dataset?.f === 'slug') { el.value = F.slug; } if (el.dataset?.f === 'type' && el.value === 'leaks' && F.factStatus === 'verified' && !(F.sources || []).length) { F.factStatus = 'community-reported'; paintInspector(); markDirty(); } });
  insp.addEventListener('keydown', (e) => {
    const box = e.target.closest('[data-tags]'); if (!box || e.target.tagName !== 'INPUT') return;
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const key = box.dataset.tags; const v = e.target.value.trim().replace(/,$/, ''); if (!v) return; const val = key === 'relatedArticles' ? slugify(v) : v.slice(0, 40); if (val && !(F[key] || []).includes(val) && (F[key] || []).length < 15) { F[key] = [...(F[key] || []), val]; paintInspector(); markDirty(); $('[data-tags=' + key + '] input', insp)?.focus(); } }
    if (e.key === 'Backspace' && !e.target.value && (F[box.dataset.tags] || []).length) { F[box.dataset.tags].pop(); paintInspector(); markDirty(); $('[data-tags=' + box.dataset.tags + '] input', insp)?.focus(); }
  });

  /* ------------------------------------------------------ history / preview */
  async function showRevision(rid) {
    let rev; try { rev = (await api('/articles/' + id + '/revisions/' + rid)).revision; } catch (e) { toast(e.message, 'error'); return; }
    const cur = editor.getDoc().blocks; const d = diffBlocks(cur, rev.doc.blocks);
    const body = '<p style="color:var(--mute);margin:4px 0 12px">Comparing the current draft with the snapshot from ' + esc(fmtDateTime(rev.at)) + ' by ' + esc(rev.by) + '. <span style="color:var(--good)">Green</span> is in the snapshot only, <span style="color:var(--bad)">red</span> is in your current draft only.</p><div class="diff ed-root" style="font-size:15px;line-height:1.6">' + d + '</div>';
    const ok = await dialog({ title: 'Version from ' + ago(rev.at), body, wide: true, actions: canEdit ? [{ label: 'Close', value: false }, { label: 'Restore this version', kind: 'primary', value: true }] : [{ label: 'Close', value: false }] });
    if (ok) { editor.replaceBlocks(rev.doc.blocks); markDirty(); toast('Restored. It will save automatically.', 'success'); }
  }
  function diffBlocks(curr, old) {
    const sig = (b) => { const { id: _i, ...r } = b; return JSON.stringify(r); };
    const a = curr.map(sig); const b = old.map(sig); const n = a.length; const m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0; let j = 0; let run = 0;
    const flush = () => { if (run) { out.push('<div class="same">' + run + ' unchanged block' + (run > 1 ? 's' : '') + '</div>'); run = 0; } };
    while (i < n || j < m) {
      if (i < n && j < m && a[i] === b[j]) { run++; i++; j++; }
      else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { flush(); out.push('<div class="add">' + blocksToHtml([old[j]]) + '</div>'); j++; }
      else { flush(); out.push('<div class="del">' + blocksToHtml([curr[i]]) + '</div>'); i++; }
    }
    flush(); return out.join('') || '<div class="same">No differences</div>';
  }
  const PREVIEW_CSS = ':root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#050b12;color:#c8d6e2;font:18px/1.8 Inter,system-ui,sans-serif}.w{max-width:760px;margin:0 auto;padding:40px 22px 90px}h1{font:700 clamp(32px,6vw,50px)/1.06 "Space Grotesk",Inter,sans-serif;letter-spacing:-.04em;color:#fff;margin:0 0 12px}.sub{font-size:20px;color:#9fb3c4;margin:0 0 20px}.meta{color:#7f95a7;font-size:14px;margin-bottom:28px}.cover{width:100%;border-radius:20px;margin:0 0 28px;display:block}h2{font:700 32px/1.14 "Space Grotesk",Inter,sans-serif;color:#fff;margin:2em 0 .6em;letter-spacing:-.03em}h2::before{content:"";display:block;width:44px;height:3px;margin-bottom:16px;border-radius:3px;background:#4cc9ff}h3{font:700 23px/1.25 "Space Grotesk",Inter,sans-serif;color:#fff;margin:1.6em 0 .5em}p{margin:0 0 1.3em}a{color:#4cc9ff}strong{color:#fff}ul,ol{padding-left:1.5em}li{margin:.5em 0}li::marker{color:#4cc9ff}blockquote{margin:1.6em 0;padding:4px 0 4px 22px;border-left:3px solid #4cc9ff;font-style:italic;color:#e3eef6}img{max-width:100%;border-radius:18px}figure{margin:2em 0}figcaption{text-align:center;color:#7f95a7;font-size:14px;margin-top:10px}table{width:100%;border-collapse:collapse;font-size:15.5px;margin:1.6em 0}th,td{padding:10px 14px;border:1px solid rgba(255,255,255,.1);text-align:left}th{background:rgba(76,201,255,.1);color:#fff}.article-table{overflow-x:auto}pre{background:#050a10;border:1px solid rgba(255,255,255,.1);padding:16px;border-radius:14px;overflow:auto;font-size:14px}code{font-family:ui-monospace,monospace;color:#9fe6ff}hr{border:0;height:1px;background:rgba(255,255,255,.12);margin:2.4em 0}mark{background:rgba(76,201,255,.28);color:#fff;padding:.05em .3em;border-radius:.3em}.fc-callout{--c:#67dbff;margin:2em 0;padding:18px 22px;border:1px solid color-mix(in srgb,var(--c) 30%,transparent);border-left:4px solid var(--c);border-radius:16px;background:color-mix(in srgb,var(--c) 10%,transparent);font-size:17px;line-height:1.7}.fc-callout--tip{--c:#72e1ad}.fc-callout--warning{--c:#ffbd59}.fc-callout--leak{--c:#b7a0ff}.fc-callout__title{display:block;margin-bottom:6px;color:var(--c);font:800 12px/1 "Space Grotesk",sans-serif;letter-spacing:.14em;text-transform:uppercase}.fc-embed{position:relative;aspect-ratio:16/9;margin:2em 0;border-radius:18px;overflow:hidden;background:#000}.fc-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}';
  function preview() {
    const doc = editor.getDoc(); const html = '<div class="w">' + (F.image ? '<img class="cover" alt="' + esc(F.imageAlt) + '" src="' + esc(F.image) + '">' : '') + '<h1>' + esc(F.title || 'Untitled') + '</h1>' + (F.subtitle ? '<p class="sub">' + esc(F.subtitle) + '</p>' : '') + '<div class="meta">By ' + esc(F.author) + ' · ' + readingMinutes(doc.blocks) + ' min read · ' + esc(TYPE_LABEL[F.type] || '') + '</div>' + blocksToHtml(doc.blocks) + '</div>';
    const srcdoc = '<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>' + PREVIEW_CSS + '</style>' + html;
    const body = document.createElement('div');
    body.innerHTML = '<div class="chips" style="margin-bottom:12px"><button class="chip on" data-w="100%">Desktop</button><button class="chip" data-w="820px">Tablet</button><button class="chip" data-w="390px">Phone</button></div><iframe class="preview-frame" sandbox title="Article preview"></iframe>';
    const frame = $('iframe', body); frame.srcdoc = srcdoc;
    body.addEventListener('click', (e) => { const c = e.target.closest('[data-w]'); if (!c) return; $$('[data-w]', body).forEach((x) => x.classList.toggle('on', x === c)); frame.style.maxWidth = c.dataset.w; });
    dialog({ title: 'Preview', body, wide: true, actions: [{ label: 'Close', value: null }] });
  }

  /* ------------------------------------------------------------- uploads */
  async function shrink(file) {
    if (file.size < 350000 || /gif|svg/.test(file.type) || !self.createImageBitmap) return file;
    try {
      const bmp = await createImageBitmap(file); const max = 2000; const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (k === 1 && file.size < 1500000) return file;
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.86)); return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' }) : file;
    } catch { return file; }
  }
  async function uploadImage(file, onProgress = () => {}) {
    if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
    if (file.size > 25 * 1024 * 1024) throw new Error('Images must be under 25 MB.');
    const sign = await api('/media/sign'); const blob = await shrink(file);
    return new Promise((resolve, reject) => {
      const fd = new FormData(); fd.append('file', blob); fd.append('api_key', sign.apiKey); fd.append('timestamp', sign.timestamp); fd.append('signature', sign.signature); fd.append('folder', sign.folder);
      const xhr = new XMLHttpRequest(); xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + sign.cloudName + '/image/upload');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => { try { const j = JSON.parse(xhr.responseText); if (xhr.status < 300 && j.secure_url) resolve(j.secure_url); else reject(new Error(j.error?.message || 'Upload failed')); } catch { reject(new Error('Upload failed')); } };
      xhr.onerror = () => reject(new Error('Upload failed. Check your connection.')); xhr.send(fd);
    });
  }

  /* ------------------------------------------------------- deploy + presence */
  let deployTimer = 0;
  function watchDeploy() {
    clearInterval(deployTimer); if (A.deployState !== 'building') return;
    deployTimer = setInterval(async () => {
      if (document.hidden) return;
      try { const d = await api('/articles/' + id + '/deploy'); if (d.state !== 'building') { clearInterval(deployTimer); A.deployState = d.state; A.deployError = d.error; paintBanners(); paintActions(); toast(d.state === 'live' ? 'Live on the site now.' : 'The site build did not finish.', d.state === 'live' ? 'success' : 'error'); S.listLoaded = false; } } catch { /* retry */ }
    }, 12000);
  }
  if (canEdit) {
    const beat = async () => { if (document.hidden) return; try { const r = await api('/articles/' + id + '/presence', { method: 'POST', body: {} }); if ((r.other || '') !== otherEditor) { otherEditor = r.other || ''; paintActions(); } } catch { /* ignore */ } };
    beat(); timers.push(setInterval(beat, 60000));
  }
  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save({ manual: true }).then((ok) => ok && toast('Saved', 'success', 1500)); } };
  const onUnload = (e) => { if (status === 'dirty' || status === 'saving' || status === 'error') { backup(); e.preventDefault(); e.returnValue = ''; } };
  const onHide = () => { if (document.hidden && status === 'dirty') save(); };
  document.addEventListener('keydown', onKey); window.addEventListener('beforeunload', onUnload); document.addEventListener('visibilitychange', onHide);
  window.addEventListener('online', () => save()); 
  document.addEventListener('click', (e) => { if (window.innerWidth <= 1180 && insp.classList.contains('open') && !insp.contains(e.target) && !e.target.closest('[data-act=panel],[data-act=checks],.ed-menu,.scrim,.popup')) insp.classList.remove('open'); });

  paintActions(); paintBanners(); paintCover(); paintInspector(); watchDeploy(); paintMeters();
  if (!canEdit) setStatus('readonly');
  if (new URLSearchParams(location.hash.split('?')[1] || '').get('new') && canEdit) titleEl.focus();
  if (!F.title || F.title === 'Untitled article') setTimeout(() => titleEl.focus(), 60);

  live = { destroy() { clearTimeout(saveTimer); clearTimeout(checkTimer); clearTimeout(backupTimer); clearInterval(deployTimer); timers.forEach(clearInterval); document.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onUnload); document.removeEventListener('visibilitychange', onHide); if (status === 'dirty') { try { save(); } catch { /* ignore */ } } editor.destroy(); } };
}
