// Editorial Studio — Worker API.
//
// Mounted by worker.mjs at /api/admin/{articles,inbox,...} and /api/creator/{articles,inbox,...}.
// All editorial state lives in Supabase (instant, no rebuild). Publishing commits one Markdown file to
// GitHub; the existing Astro build turns it into the public page. Nothing public ever reads Supabase,
// so the free 5 GB egress allowance is only spent by editors, and the list screens never fetch bodies.
import {
  DOC_VERSION, ARTICLE_TYPES, FACT_STATUSES, cleanBlocks, htmlToBlocks, markdownToBlocks, parseFrontmatter,
  articleToMarkdownFile, hashDoc, wordCount, readingMinutes, slugify
} from './blocks.js';
import { checkArticle } from './validate.js';

const REPO_DIR = 'src/content/blog/';
const SITE = 'https://fcmobiletools.online';
const AUTOSAVE_REVISION_MS = 10 * 60 * 1000;
const LOCK_MS = 90 * 1000;
const KEEP_AUTOSAVE_REVISIONS = 30;

const SLIM = 'id,slug,title,subtitle,status,type,category,author_name,owner_key,cover_image,featured,word_count,reading_time,updated_at,published_at,scheduled_for,submitted_at,due_at,version,published_version,deploy_state,review_note,editing_by,editing_at,doc_version,brief';
const CTRL = 'id,slug,title,status,owner_key,author_name,version,doc_version,published_version,published_at,published_file_sha,last_revision_at,content_hash,editing_by,editing_at,scheduled_for,created_at';

const WRITER_EDITABLE = new Set(['draft', 'changes_requested', 'published']);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const strList = (v, n, max) => (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean).slice(0, n);
const nowIso = () => new Date().toISOString();

export const DEFAULT_STYLE_GUIDE = `# Writing for FCMobiletools

**Be useful first.** Lead with what the reader can do or needs to know. Save background for later.

**Label certainty.** Every leak or rumour gets a fact status. Say what is confirmed, what is reported, and what is a guess.

**Show your numbers.** If you claim a price, cost or odds, show the maths or name the source.

**Keep it scannable.** Use section headings, short paragraphs, tables for comparisons and a callout for the single most important warning.

**Images.** Use real in-game screenshots, add alt text, and never use art you do not have the right to publish.

**Before you submit.** Run the Publish checklist, read the article once out loud, and add every source you used.`;

export function createEditorialApi(deps) {
  const { supabaseRest: rest, json, authenticated, creatorRecord, d1, github } = deps;

  /* ------------------------------------------------------------- identity */
  async function identityOf(request, env) {
    if (await authenticated(request, env)) {
      return { role: 'admin', name: String(env.ADMIN_DISPLAY_NAME || env.ADMIN_USERNAME || 'TanzimFC'), key: 'admin', reviewer: true };
    }
    const creator = await creatorRecord(request, env);
    if (!creator) return null;
    const editor = String(creator.role || '').toLowerCase() === 'editor';
    return {
      role: editor ? 'editor' : 'writer', reviewer: editor,
      name: String(creator.display_name || creator.username || 'Writer'), key: 'creator:' + creator.id, creator
    };
  }
  const isStaff = (who) => who.role === 'admin' || who.role === 'editor';

  /* ---------------------------------------------------------------- helpers */
  const fail = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);
  const q = encodeURIComponent;

  async function one(env, id, select = CTRL) {
    const rows = await rest(env, 'articles?id=eq.' + q(id) + '&select=' + select + '&limit=1');
    return rows?.[0] || null;
  }
  function canSee(who, row) { return isStaff(who) || row.owner_key === who.key; }
  function canEdit(who, row) {
    if (row.status === 'trash') return false;
    if (isStaff(who)) return true;
    return row.owner_key === who.key && WRITER_EDITABLE.has(row.status);
  }

  async function notify(env, { to, articleId, kind, title, message }) {
    try {
      await rest(env, 'editorial_inbox', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{ recipient_key: to, article_id: articleId || null, kind, title: str(title, 160), message: str(message, 600) }])
      });
    } catch (e) { console.error('[EDITORIAL_NOTIFY]', e?.message); }
  }

  async function revision(env, row, doc, action, note, who, hash) {
    try {
      await rest(env, 'article_revisions', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{
          article_id: row.id, revision_no: row.version, editor_name: who.name, action, note: str(note, 600),
          content_json: doc, content_html: '', content_hash: hash || '',
          metadata: { title: row.title, slug: row.slug }
        }])
      });
      if (row.version % 25 === 0 && action === 'autosave') await pruneRevisions(env, row.id);
    } catch (e) {
      // A duplicate (article_id, revision_no) just means this exact version already has a snapshot.
      if (!/duplicate/i.test(String(e?.message))) console.error('[EDITORIAL_REVISION]', e?.message);
    }
  }
  async function pruneRevisions(env, id) {
    const old = await rest(env, 'article_revisions?article_id=eq.' + q(id) + '&action=eq.autosave&select=id&order=id.desc&offset=' + KEEP_AUTOSAVE_REVISIONS + '&limit=200');
    if (old?.length) await rest(env, 'article_revisions?id=in.(' + old.map((r) => r.id).join(',') + ')', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }

  const listItem = (r) => ({
    id: r.id, slug: r.slug, title: r.title, subtitle: r.subtitle || '', status: r.status, type: r.type, category: r.category,
    author: r.author_name, ownerKey: r.owner_key, cover: r.cover_image || '', featured: !!r.featured,
    words: r.word_count || 0, minutes: r.reading_time || 1, updatedAt: r.updated_at, publishedAt: r.published_at,
    scheduledFor: r.scheduled_for, submittedAt: r.submitted_at, dueAt: r.due_at, version: r.version,
    publishedVersion: r.published_version, deployState: r.deploy_state, reviewNote: r.review_note || '',
    editingBy: r.editing_by && r.editing_at && Date.now() - Date.parse(r.editing_at) < LOCK_MS ? r.editing_by : '',
    brief: !!r.brief, legacy: r.doc_version !== 2,
    pendingUpdate: r.published_version != null && r.version > r.published_version
  });

  function fullArticle(r) {
    let doc;
    let converted = false;
    if (r.doc_version === 2 && r.content_json?.blocks) doc = { v: DOC_VERSION, blocks: cleanBlocks(r.content_json.blocks) };
    else { doc = { v: DOC_VERSION, blocks: htmlToBlocks(r.content_html || '') }; converted = true; }
    if (!doc.blocks.length) doc.blocks = [{ id: 'b' + Date.now().toString(36), type: 'p', html: '' }];
    return {
      ...listItem(r), description: r.description || r.excerpt || '', image: r.cover_image || '', imageAlt: r.image_alt || '',
      imageCaption: r.image_caption || '', tags: r.tags || [], seoTitle: r.seo_title || '', seoDescription: r.seo_description || '',
      canonicalUrl: r.canonical_url || '', factStatus: r.fact_status || 'verified', lastReviewed: r.last_reviewed || '',
      sources: Array.isArray(r.sources) ? r.sources : [], relatedArticles: r.related_articles || [], relatedTools: r.related_tools || [],
      series: r.series || '', seriesOrder: r.series_order ?? null, brief: r.brief || '', createdAt: r.created_at,
      deployedAt: r.deployed_at, deployError: r.deploy_error || '', doc, converted, hash: r.content_hash || ''
    };
  }

  // Column values from a client payload. Writers cannot touch staff-only fields.
  function patchFrom(input, who, row) {
    const p = {};
    const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
    if (has('title')) p.title = str(input.title, 160) || row.title;
    if (has('subtitle')) p.subtitle = str(input.subtitle, 240);
    if (has('description')) { p.description = str(input.description, 400); p.excerpt = p.description; }
    if (has('type') && ARTICLE_TYPES.includes(input.type)) p.type = input.type;
    if (has('category')) p.category = str(input.category, 60) || 'Guides';
    if (has('tags')) p.tags = strList(input.tags, 15, 40);
    if (has('image')) p.cover_image = str(input.image, 800);
    if (has('imageAlt')) p.image_alt = str(input.imageAlt, 300);
    if (has('imageCaption')) p.image_caption = str(input.imageCaption, 400);
    if (has('seoTitle')) p.seo_title = str(input.seoTitle, 120);
    if (has('seoDescription')) p.seo_description = str(input.seoDescription, 300);
    if (has('canonicalUrl')) p.canonical_url = str(input.canonicalUrl, 500);
    if (has('factStatus') && FACT_STATUSES.includes(input.factStatus)) p.fact_status = input.factStatus;
    if (has('lastReviewed')) p.last_reviewed = /^\d{4}-\d{2}-\d{2}/.test(String(input.lastReviewed)) ? String(input.lastReviewed).slice(0, 10) : null;
    if (has('sources')) p.sources = strList(input.sources, 25, 500);
    if (has('relatedArticles')) p.related_articles = strList(input.relatedArticles, 10, 160).map(slugify);
    if (has('relatedTools')) p.related_tools = strList(input.relatedTools, 10, 160);
    if (has('series')) p.series = str(input.series, 100);
    if (has('seriesOrder')) p.series_order = Number.isInteger(Number(input.seriesOrder)) && input.seriesOrder !== '' && input.seriesOrder !== null ? Number(input.seriesOrder) : null;
    if (has('slug') && row.published_version == null && row.status !== 'published') {
      const s = slugify(input.slug);
      if (s.length >= 3) p.slug = s;
    }
    if (isStaff(who)) {
      if (has('featured')) p.featured = !!input.featured;
      if (has('author')) p.author_name = str(input.author, 80) || row.author_name;
      if (has('brief')) p.brief = str(input.brief, 4000);
      if (has('dueAt')) p.due_at = input.dueAt ? new Date(input.dueAt).toISOString() : null;
    }
    return p;
  }

  /* ---------------------------------------------------------------- GitHub */
  async function repoSha(env, path) {
    try { return (await github(env, 'contents/' + path + '?ref=main'))?.sha || null; }
    catch (e) { if (/not found/i.test(String(e?.message))) return null; throw e; }
  }
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromBase64(value) { return new TextDecoder().decode(Uint8Array.from(atob(String(value).replace(/\s/g, '')), (c) => c.charCodeAt(0))); }

  async function commitFile(env, path, text, message, authorName, sha) {
    const body = { message, content: toBase64(text), branch: 'main', author: { name: authorName || 'FCMobiletools Editorial', email: 'editorial@users.noreply.github.com' } };
    if (sha) body.sha = sha;
    const out = await github(env, 'contents/' + path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { commit: out.commit?.sha || '', fileSha: out.content?.sha || '' };
  }

  async function publish(env, who, id, { note = '', action = 'publish' } = {}) {
    const row = (await rest(env, 'articles?id=eq.' + q(id) + '&select=*&limit=1'))?.[0];
    if (!row) return fail('Article not found.', 404);
    const art = fullArticle(row);
    const art2 = { ...art, author: row.author_name, id: row.id };
    const verdict = checkArticle(art2, art.doc.blocks);
    if (!verdict.ok) return fail('This article is not ready to publish.', 422, { checks: verdict.checks.filter((c) => c.state === 'fail') });
    const path = REPO_DIR + row.slug + '.md';
    let sha = row.published_file_sha || null;
    if (!sha) {
      sha = await repoSha(env, path);
      if (sha && row.published_version == null) return fail('A file named ' + row.slug + '.md already exists in the repository. Change the slug, or use Import to adopt that article.', 409);
    }
    const published = row.published_at || nowIso();
    const md = articleToMarkdownFile({
      ...art2, id: row.id, publishedAt: published, updatedAt: nowIso(), createdAt: row.created_at, createdBy: row.author_name
    }, art.doc.blocks);
    const verb = row.published_version == null ? 'publish' : 'update';
    let result;
    try {
      result = await commitFile(env, path, md, 'editorial: ' + verb + ' "' + str(row.title, 80) + '" (' + who.name + ')', row.author_name, sha);
    } catch (e) { return fail('GitHub rejected the commit: ' + (e?.message || 'unknown error'), 502); }

    const patch = {
      status: 'published', published_at: published, published_version: row.version, published_commit: result.commit,
      published_file_sha: result.fileSha, deploy_state: 'building', deployed_at: null, deploy_error: '',
      scheduled_for: null, reviewed_by: who.name, review_note: str(note, 600), updated_at: nowIso(), submitted_at: null
    };
    await rest(env, 'articles?id=eq.' + q(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    await revision(env, { ...row, version: row.version }, art.doc, action, note, who, row.content_hash);
    if (row.owner_key !== who.key) {
      await notify(env, { to: row.owner_key, articleId: row.id, kind: 'published', title: verb === 'publish' ? 'Your article is being published' : 'Your update is being published', message: '"' + row.title + '" will be live in about two minutes.' });
    }
    return json({ ok: true, commit: result.commit, url: SITE + '/blog/' + row.slug + '/', deployState: 'building' });
  }

  async function deployStatus(env, row) {
    if (row.deploy_state !== 'building' || !row.published_commit) return { state: row.deploy_state, error: row.deploy_error || '' };
    const age = Date.now() - Date.parse(row.updated_at || nowIso());
    let verdict = null;
    try {
      const runs = await github(env, 'commits/' + row.published_commit + '/check-runs?per_page=30');
      const relevant = (runs.check_runs || []).filter((r) => /cloudflare|workers|pages|build|deploy/i.test(r.name + ' ' + (r.app?.slug || '')));
      if (relevant.length) {
        if (relevant.some((r) => r.status === 'completed' && ['failure', 'cancelled', 'timed_out'].includes(r.conclusion))) verdict = 'failed';
        else if (relevant.every((r) => r.status === 'completed' && r.conclusion === 'success')) verdict = 'live';
        else verdict = 'building';
      }
    } catch { /* token may not have checks access: fall through to the time-based estimate */ }
    if (!verdict) {
      if (age < 150000) verdict = 'building';
      else {
        const res = await fetch(SITE + '/blog/' + row.slug + '/', { method: 'HEAD', cf: { cacheTtl: 0 } }).catch(() => null);
        verdict = res && res.ok ? 'live' : age > 15 * 60000 ? 'failed' : 'building';
      }
    }
    if (verdict !== 'building') {
      const patch = verdict === 'live' ? { deploy_state: 'live', deployed_at: nowIso(), deploy_error: '' } : { deploy_state: 'failed', deploy_error: 'The site build did not finish. Check the deploy log in Cloudflare.' };
      await rest(env, 'articles?id=eq.' + q(row.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
      if (verdict === 'live') await notify(env, { to: row.owner_key, articleId: row.id, kind: 'live', title: 'Live on the site', message: SITE + '/blog/' + row.slug + '/' });
      return { state: verdict, error: patch.deploy_error || '' };
    }
    return { state: 'building', error: '' };
  }

  async function unpublish(env, who, row) {
    const path = REPO_DIR + row.slug + '.md';
    const sha = row.published_file_sha || await repoSha(env, path);
    if (sha) {
      await github(env, 'contents/' + path, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'editorial: unpublish "' + str(row.title, 80) + '" (' + who.name + ')', sha, branch: 'main' }) });
    }
    await rest(env, 'articles?id=eq.' + q(row.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'archived', published_version: null, published_commit: null, published_file_sha: null, deploy_state: 'none', updated_at: nowIso() }) });
    return json({ ok: true });
  }

  /* --------------------------------------------------------- import from repo */
  async function importFromRepo(env, who) {
    const listing = await github(env, 'contents/' + REPO_DIR.replace(/\/$/, '') + '?ref=main');
    const files = (listing || []).filter((f) => f.type === 'file' && /\.md$/.test(f.name) && !f.name.startsWith('_'));
    const existing = new Set((await rest(env, 'articles?select=slug&limit=1000') || []).map((r) => r.slug));
    let imported = 0; let skipped = 0; const errors = [];
    for (const f of files) {
      const slug = f.name.replace(/\.md$/, '');
      if (existing.has(slug)) { skipped++; continue; }
      try {
        const file = await github(env, 'contents/' + f.path + '?ref=main');
        const { data, body } = parseFrontmatter(fromBase64(file.content));
        const blocks = markdownToBlocks(body);
        const ts = (v) => { const d = new Date(v); return Number.isNaN(d.valueOf()) ? null : d.toISOString(); };
        const published = !data.draft && String(data.status || 'published') === 'published';
        const row = {
          slug, title: str(data.title, 160) || slug, subtitle: str(data.subtitle, 240), description: str(data.description, 400), excerpt: str(data.excerpt || data.description, 400),
          type: ARTICLE_TYPES.includes(data.type) ? data.type : 'guide', category: str(data.category, 60) || 'Guides',
          author_name: str(data.author, 80) || 'TanzimFC', owner_key: 'admin', author_key: 'admin',
          status: published ? 'published' : 'draft', cover_image: str(data.image || data.heroImage, 800), image_alt: str(data.imageAlt, 300), image_caption: str(data.imageCaption, 400),
          tags: strList(data.tags, 15, 40), featured: !!data.featured, seo_title: str(data.seoTitle, 120), seo_description: str(data.seoDescription, 300),
          canonical_url: str(data.canonicalUrl, 500), fact_status: FACT_STATUSES.includes(data.factStatus) ? data.factStatus : 'verified',
          last_reviewed: /^\d{4}-\d{2}-\d{2}/.test(String(data.lastReviewed || '')) ? String(data.lastReviewed).slice(0, 10) : null,
          sources: strList(data.sources, 25, 500), related_articles: strList(data.relatedArticles, 10, 160), related_tools: strList(data.relatedTools, 10, 160),
          series: str(data.series, 100), series_order: Number.isInteger(data.seriesOrder) ? data.seriesOrder : null,
          content_json: { v: DOC_VERSION, blocks }, content_html: '', doc_version: 2, version: 1, content_hash: hashDoc(blocks),
          word_count: wordCount(blocks), reading_time: Math.min(180, readingMinutes(blocks)),
          published_at: published ? (ts(data.publishedAt || data.pubDate) || nowIso()) : null, created_at: ts(data.createdAt) || nowIso(), updated_at: ts(data.updatedAt) || nowIso(),
          published_version: published ? 1 : null, published_file_sha: published ? file.sha : null, deploy_state: published ? 'live' : 'none'
        };
        await rest(env, 'articles', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([row]) });
        imported++;
      } catch (e) { errors.push(slug + ': ' + (e?.message || 'failed')); }
    }
    return json({ ok: true, imported, skipped, errors });
  }

  /* ------------------------------------------------------------ route table */
  async function handle(request, env, path) {
    try {
      const who = await identityOf(request, env);
      if (!who) return fail('Unauthorized.', 401);
      const method = request.method;
      if (method !== 'GET' && request.headers.get('x-editorial') !== '1') return fail('Missing editorial header.', 400);
      const url = new URL(request.url);
      let m;

      if (path === '/me' && method === 'GET') {
        const guide = (await rest(env, 'editorial_settings?key=eq.style_guide&select=value&limit=1'))?.[0]?.value?.text || DEFAULT_STYLE_GUIDE;
        return json({ role: who.role, name: who.name, key: who.key, staff: isStaff(who), styleGuide: guide, types: ARTICLE_TYPES, repoDir: REPO_DIR });
      }

      if (path === '/pulse' && method === 'GET') {
        const inboxKeys = isStaff(who) ? '(' + q(who.key) + ',role:reviewers)' : '(' + q(who.key) + ')';
        const jobs = [
          rest(env, 'articles?select=updated_at&order=updated_at.desc&limit=1' + (isStaff(who) ? '' : '&owner_key=eq.' + q(who.key))),
          rest(env, 'editorial_inbox?select=id&read_at=is.null&recipient_key=in.' + inboxKeys + '&limit=99')
        ];
        if (isStaff(who)) jobs.push(rest(env, 'articles?select=id&status=eq.in_review&limit=99'));
        const [stamp, unread, queue] = await Promise.all(jobs);
        return json({ stamp: stamp?.[0]?.updated_at || '', unread: unread?.length || 0, queue: queue?.length || 0 });
      }

      if (path === '/articles' && method === 'GET') {
        const view = url.searchParams.get('view') || 'all';
        let query = 'articles?select=' + SLIM + '&order=updated_at.desc&limit=300';
        if (!isStaff(who) || view === 'mine') query += '&owner_key=eq.' + q(who.key);
        if (view === 'trash') { if (!isStaff(who)) return json({ articles: [] }); query += '&status=eq.trash'; }
        else query += '&status=neq.trash';
        const rows = await rest(env, query);
        return json({ articles: (rows || []).map(listItem) });
      }

      if (path === '/articles' && method === 'POST') {
        const input = await request.json().catch(() => ({}));
        let owner = who.key; let author = who.name;
        if (input.assignTo && isStaff(who)) {
          const id = Number(String(input.assignTo).replace('creator:', ''));
          const c = Number.isInteger(id) ? await (await d1(env)).prepare('SELECT id, display_name, username FROM creators WHERE id=? AND active=1').bind(id).first() : null;
          if (!c) return fail('That writer was not found.', 404);
          owner = 'creator:' + c.id; author = c.display_name || c.username;
        }
        const title = str(input.title, 160) || 'Untitled article';
        let slug = slugify(input.slug || title) || 'untitled';
        const taken = new Set((await rest(env, 'articles?select=slug&slug=like.' + q(slug + '*') + '&limit=50') || []).map((r) => r.slug));
        for (let n = 2; taken.has(slug); n++) slug = slugify(title).slice(0, 100) + '-' + n;
        const blocks = cleanBlocks(input.doc?.blocks || []);
        const row = {
          slug, title, owner_key: owner, author_key: owner, author_name: author, status: 'draft', doc_version: 2, version: 1,
          type: ARTICLE_TYPES.includes(input.type) ? input.type : 'guide', category: str(input.category, 60) || 'Guides',
          fact_status: input.type === 'leaks' ? 'community-reported' : 'verified',
          content_json: { v: DOC_VERSION, blocks }, content_html: '', content_hash: hashDoc(blocks), word_count: wordCount(blocks), reading_time: Math.min(180, readingMinutes(blocks)),
          brief: isStaff(who) ? str(input.brief, 4000) : '', due_at: isStaff(who) && input.dueAt ? new Date(input.dueAt).toISOString() : null, assigned_by: owner !== who.key ? who.name : null
        };
        const saved = await rest(env, 'articles?select=id,slug,version', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([row]) });
        if (owner !== who.key) await notify(env, { to: owner, articleId: saved[0].id, kind: 'assigned', title: 'New assignment: ' + title, message: str(input.brief, 200) || who.name + ' assigned you an article.' });
        return json({ ok: true, id: saved[0].id, slug: saved[0].slug });
      }

      if (path === '/writers' && method === 'GET') {
        if (!isStaff(who)) return json({ writers: [] });
        const out = await (await d1(env)).prepare('SELECT id, username, display_name, role FROM creators WHERE active=1 ORDER BY display_name').all();
        return json({ writers: (out.results || []).map((c) => ({ key: 'creator:' + c.id, name: c.display_name || c.username, username: c.username, role: c.role })) });
      }

      if (path === '/media/sign' && method === 'GET') {
        if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return fail('Image uploads are not configured.', 503);
        const timestamp = Math.floor(Date.now() / 1000); const folder = env.CLOUDINARY_FOLDER || 'fc-mobile-tools';
        const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode('folder=' + folder + '&timestamp=' + timestamp + env.CLOUDINARY_API_SECRET));
        return json({ cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY, timestamp, folder, signature: [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('') });
      }

      if (path === '/settings' && method === 'PUT') {
        if (who.role !== 'admin') return fail('Only the owner can change the style guide.', 403);
        const input = await request.json().catch(() => ({}));
        await rest(env, 'editorial_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key: 'style_guide', value: { text: str(input.styleGuide, 12000) }, updated_at: nowIso(), updated_by: who.name }]) });
        return json({ ok: true });
      }

      if (path === '/import' && method === 'POST') {
        if (who.role !== 'admin') return fail('Only the owner can import.', 403);
        return importFromRepo(env, who);
      }

      /* inbox */
      if (path === '/inbox' && method === 'GET') {
        const keys = isStaff(who) ? '(' + q(who.key) + ',role:reviewers)' : '(' + q(who.key) + ')';
        const rows = await rest(env, 'editorial_inbox?select=id,article_id,kind,title,message,read_at,created_at&recipient_key=in.' + keys + '&order=created_at.desc&limit=60');
        return json({ items: rows || [] });
      }
      if (path === '/inbox/read' && method === 'POST') {
        const input = await request.json().catch(() => ({}));
        const keys = isStaff(who) ? '(' + q(who.key) + ',role:reviewers)' : '(' + q(who.key) + ')';
        const filter = input.all ? 'read_at=is.null' : 'id=eq.' + q(Number(input.id));
        await rest(env, 'editorial_inbox?' + filter + '&recipient_key=in.' + keys, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ read_at: nowIso() }) });
        return json({ ok: true });
      }

      /* comments */
      if ((m = path.match(/^\/comments\/(\d+)\/resolve$/)) && method === 'POST') {
        const c = (await rest(env, 'article_comments?id=eq.' + m[1] + '&select=id,article_id&limit=1'))?.[0];
        if (!c) return fail('Comment not found.', 404);
        const row = await one(env, c.article_id);
        if (!row || !canSee(who, row)) return fail('Not found.', 404);
        await rest(env, 'article_comments?id=eq.' + m[1], { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ resolved_at: nowIso(), resolved_by: who.name }) });
        return json({ ok: true });
      }

      /* single article */
      if ((m = path.match(/^\/articles\/(\d+)(?:\/([a-z-]+))?(?:\/(\d+))?$/))) {
        const id = Number(m[1]); const sub = m[2] || ''; const sub2 = m[3] || '';
        const row = await one(env, id);
        if (!row || !canSee(who, row)) return fail('Article not found.', 404);

        if (!sub && method === 'GET') {
          const full = (await rest(env, 'articles?id=eq.' + id + '&select=*&limit=1'))[0];
          const comments = await rest(env, 'article_comments?article_id=eq.' + id + '&select=id,block_id,author_name,author_key,body,resolved_at,created_at&order=created_at.asc&limit=200');
          return json({ article: fullArticle(full), comments: comments || [], canEdit: canEdit(who, row) });
        }

        if (sub === 'presence' && method === 'POST') {
          const mine = row.editing_by === who.name || !row.editing_at || Date.now() - Date.parse(row.editing_at) > LOCK_MS;
          if (mine) await rest(env, 'articles?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ editing_by: who.name, editing_at: nowIso() }) });
          return json({ ok: true, other: mine ? '' : row.editing_by });
        }

        if (!sub && (method === 'PATCH' || method === 'PUT')) {
          if (!canEdit(who, row)) return fail(row.status === 'in_review' ? 'This article is in review. Withdraw it to keep editing.' : 'You cannot edit this article.', 403);
          const input = await request.json().catch(() => ({}));
          if (!input.force && Number(input.baseVersion) !== row.version) {
            return fail('Someone else saved a newer version.', 409, { code: 'conflict', serverVersion: row.version, by: row.editing_by || row.author_name });
          }
          const patch = patchFrom(input.fields || {}, who, row);
          let doc = null; let hash = row.content_hash;
          if (input.doc && Array.isArray(input.doc.blocks)) {
            const blocks = cleanBlocks(input.doc.blocks);
            hash = hashDoc(blocks);
            if (hash !== row.content_hash || row.doc_version !== 2) {
              doc = { v: DOC_VERSION, blocks };
              Object.assign(patch, { content_json: doc, content_html: '', doc_version: 2, content_hash: hash, word_count: wordCount(blocks), reading_time: Math.min(180, readingMinutes(blocks)) });
            }
          }
          if (!Object.keys(patch).length) return json({ ok: true, version: row.version, unchanged: true, updatedAt: row.updated_at });
          const next = row.version + 1; const stamp = nowIso();
          Object.assign(patch, { version: next, updated_at: stamp, last_saved_at: stamp, editing_by: who.name, editing_at: stamp });
          let saved;
          try {
            saved = await rest(env, 'articles?id=eq.' + id + '&version=eq.' + row.version + '&select=id,version,slug', { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
          } catch (e) {
            if (/duplicate|unique/i.test(String(e?.message))) return fail('That URL slug is already used by another article.', 409, { code: 'slug' });
            throw e;
          }
          if (!saved?.length) return fail('Someone else saved a newer version.', 409, { code: 'conflict' });
          const due = !row.last_revision_at || Date.now() - Date.parse(row.last_revision_at) > AUTOSAVE_REVISION_MS;
          if (doc && (due || !input.autosave)) {
            await revision(env, { ...row, version: next, title: patch.title || row.title, slug: patch.slug || row.slug }, doc, input.autosave ? 'autosave' : 'save', '', who, hash);
            await rest(env, 'articles?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_revision_at: stamp }) });
          }
          return json({ ok: true, version: next, updatedAt: stamp, slug: saved[0].slug, hash });
        }

        if (sub === 'revisions' && method === 'GET') {
          if (sub2) {
            const rev = (await rest(env, 'article_revisions?id=eq.' + sub2 + '&article_id=eq.' + id + '&select=id,revision_no,editor_name,action,note,created_at,content_json,content_html&limit=1'))?.[0];
            if (!rev) return fail('Revision not found.', 404);
            const doc = rev.content_json?.blocks ? { v: DOC_VERSION, blocks: cleanBlocks(rev.content_json.blocks) } : { v: DOC_VERSION, blocks: htmlToBlocks(rev.content_html || '') };
            return json({ revision: { id: rev.id, no: rev.revision_no, by: rev.editor_name, action: rev.action, note: rev.note, at: rev.created_at, doc } });
          }
          const rows = await rest(env, 'article_revisions?article_id=eq.' + id + '&select=id,revision_no,editor_name,action,note,created_at&order=id.desc&limit=60');
          return json({ revisions: (rows || []).map((r) => ({ id: r.id, no: r.revision_no, by: r.editor_name, action: r.action, note: r.note, at: r.created_at })) });
        }

        if (sub === 'comments' && method === 'GET') {
          const comments = await rest(env, 'article_comments?article_id=eq.' + id + '&select=id,block_id,author_name,author_key,body,resolved_at,created_at&order=created_at.asc&limit=200');
          return json({ comments: comments || [] });
        }

        if (sub === 'comments' && method === 'POST') {
          const input = await request.json().catch(() => ({}));
          const body = str(input.body, 2000);
          if (!body) return fail('Write a comment first.');
          await rest(env, 'article_comments', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ article_id: id, block_id: str(input.blockId, 40) || null, author_key: who.key, author_name: who.name, body }]) });
          const to = isStaff(who) ? row.owner_key : 'role:reviewers';
          if (to !== who.key) await notify(env, { to, articleId: id, kind: 'comment', title: who.name + ' commented on "' + str(row.title, 60) + '"', message: body.slice(0, 200) });
          return json({ ok: true });
        }

        if (sub === 'deploy' && method === 'GET') {
          const r = (await rest(env, 'articles?id=eq.' + id + '&select=id,slug,owner_key,deploy_state,deploy_error,published_commit,updated_at&limit=1'))[0];
          return json(await deployStatus(env, r));
        }

        // From here on, state transitions.
        if (method !== 'POST') return fail('Not found.', 404);
        const input = await request.json().catch(() => ({}));
        const note = str(input.note, 600);
        const stamp = nowIso();
        const setStatus = (patch) => rest(env, 'articles?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...patch, updated_at: stamp }) });

        if (sub === 'submit') {
          if (!(row.owner_key === who.key || isStaff(who))) return fail('Not allowed.', 403);
          if (!['draft', 'changes_requested', 'published'].includes(row.status)) return fail('This article cannot be submitted right now.', 409);
          const full = fullArticle((await rest(env, 'articles?id=eq.' + id + '&select=*&limit=1'))[0]);
          if (wordCount(full.doc.blocks) < 60) return fail('Write at least 60 words before submitting.', 422);
          await setStatus({ status: 'in_review', submitted_at: stamp, review_note: '' });
          await rest(env, 'article_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ article_id: id, reviewer_name: '', status: 'submitted', comment: note }]) });
          await revision(env, row, full.doc, 'submit', note, who, row.content_hash);
          await notify(env, { to: 'role:reviewers', articleId: id, kind: 'review', title: who.name + ' submitted "' + str(row.title, 70) + '"', message: note || 'Ready for review.' });
          return json({ ok: true, status: 'in_review' });
        }
        if (sub === 'withdraw') {
          if (row.owner_key !== who.key && !isStaff(who)) return fail('Not allowed.', 403);
          if (row.status !== 'in_review') return fail('Only articles in review can be withdrawn.', 409);
          await setStatus({ status: row.published_version != null ? 'published' : 'draft', submitted_at: null });
          return json({ ok: true });
        }
        if (!isStaff(who)) return fail('Only editors can do that.', 403);

        if (sub === 'request-changes') {
          if (!note) return fail('Tell the writer what to change.', 422);
          await setStatus({ status: 'changes_requested', review_note: note, reviewed_by: who.name, submitted_at: null });
          await rest(env, 'article_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([{ article_id: id, reviewer_name: who.name, status: 'changes_requested', comment: note }]) });
          await notify(env, { to: row.owner_key, articleId: id, kind: 'changes', title: 'Changes requested on "' + str(row.title, 70) + '"', message: note });
          return json({ ok: true });
        }
        if (sub === 'approve' || sub === 'publish') return publish(env, who, id, { note, action: sub === 'approve' ? 'approve' : 'publish' });
        if (sub === 'schedule') {
          const at = Date.parse(input.at);
          if (!Number.isFinite(at) || at < Date.now() + 2 * 60000) return fail('Pick a time at least two minutes from now.', 422);
          const full = fullArticle((await rest(env, 'articles?id=eq.' + id + '&select=*&limit=1'))[0]);
          const verdict = checkArticle({ ...full, author: row.author_name }, full.doc.blocks);
          if (!verdict.ok) return fail('This article is not ready to publish.', 422, { checks: verdict.checks.filter((c) => c.state === 'fail') });
          await setStatus({ status: 'scheduled', scheduled_for: new Date(at).toISOString(), reviewed_by: who.name });
          return json({ ok: true });
        }
        if (sub === 'unschedule') { await setStatus({ status: 'draft', scheduled_for: null }); return json({ ok: true }); }
        if (sub === 'unpublish') { if (who.role !== 'admin') return fail('Only the owner can unpublish.', 403); return unpublish(env, who, row); }
        if (sub === 'trash') {
          if (row.published_version != null) return fail('Unpublish this article before moving it to trash.', 409);
          await setStatus({ status: 'trash' }); return json({ ok: true });
        }
        if (sub === 'restore') { await setStatus({ status: 'draft' }); return json({ ok: true }); }
        if (sub === 'assign') {
          const target = Number(String(input.to || '').replace('creator:', ''));
          const c = await (await d1(env)).prepare('SELECT id, display_name, username FROM creators WHERE id=? AND active=1').bind(target).first();
          if (!c) return fail('That writer was not found.', 404);
          await setStatus({ owner_key: 'creator:' + c.id, author_key: 'creator:' + c.id, author_name: c.display_name || c.username, assigned_by: who.name });
          await notify(env, { to: 'creator:' + c.id, articleId: id, kind: 'assigned', title: 'Assigned to you: ' + str(row.title, 70), message: who.name + ' assigned you this article.' });
          return json({ ok: true });
        }
        if (sub === 'duplicate') {
          const full = (await rest(env, 'articles?id=eq.' + id + '&select=*&limit=1'))[0];
          const copy = fullArticle(full);
          let slug = slugify(row.slug + '-copy');
          const taken = new Set((await rest(env, 'articles?select=slug&slug=like.' + q(slug + '*') + '&limit=50') || []).map((r) => r.slug));
          for (let n = 2; taken.has(slug); n++) slug = slugify(row.slug) + '-copy-' + n;
          const out = await rest(env, 'articles?select=id', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([{
            slug, title: str(row.title + ' (copy)', 160), owner_key: who.key, author_key: who.key, author_name: who.name, status: 'draft', doc_version: 2, version: 1,
            type: full.type, category: full.category, tags: full.tags, cover_image: full.cover_image, image_alt: full.image_alt, description: full.description, excerpt: full.excerpt,
            fact_status: full.fact_status, content_json: copy.doc, content_html: '', content_hash: hashDoc(copy.doc.blocks), word_count: wordCount(copy.doc.blocks), reading_time: Math.min(180, readingMinutes(copy.doc.blocks))
          }]) });
          return json({ ok: true, id: out[0].id });
        }
        return fail('Not found.', 404);
      }

      return fail('Editorial endpoint not found.', 404);
    } catch (error) {
      console.error('[EDITORIAL_API]', error?.message);
      return json({ error: error?.message || 'Editorial backend failed.' }, 500);
    }
  }

  // Cron: publish anything whose time has come.
  async function sweep(env) {
    const due = await rest(env, 'articles?select=id,title,owner_key&status=eq.scheduled&scheduled_for=lte.' + q(nowIso()) + '&limit=5');
    const system = { role: 'admin', name: 'Scheduler', key: 'admin' };
    const out = [];
    for (const a of due || []) {
      const res = await publish(env, system, a.id, { action: 'publish', note: 'Scheduled publish' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        await rest(env, 'articles?id=eq.' + a.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'draft', scheduled_for: null, review_note: 'Scheduled publish failed: ' + (body.error || 'unknown') }) });
        await notify(env, { to: a.owner_key, articleId: a.id, kind: 'changes', title: 'Scheduled publish failed', message: body.error || '' });
      }
      out.push({ id: a.id, ok: res.ok });
    }
    return out;
  }

  return { handle, sweep };
}
