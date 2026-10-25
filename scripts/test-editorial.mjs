// Editorial Studio tests: document engine, publish checklist, and the Worker API against in-memory
// fakes of Supabase and GitHub. Run with: node scripts/test-editorial.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as B from '../src/editorial/blocks.js';
import { checkArticle } from '../src/editorial/validate.js';
import { createEditorialApi } from '../src/editorial/studioApi.mjs';
import { makeBackend } from './lib/editorial-fakes.mjs';

let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; } catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; } };
const strip = (blocks) => JSON.stringify(blocks.map(({ id, ...rest }) => rest));

/* ------------------------------------------------------------------ sanitising */
await test('inline sanitiser removes scripts, handlers and unsafe links', () => {
  const dirty = '<p onclick="x()">Hi <script>alert(1)</script><a href="javascript:alert(1)">bad</a> <a href="https://x.com/a">ok</a><img src=x onerror=y><b>bold</b></p>';
  const clean = B.sanitizeInline(dirty);
  assert.ok(!/script|onclick|onerror|javascript/i.test(clean), clean);
  assert.ok(clean.includes('<strong>bold</strong>'));
  assert.ok(clean.includes('href="https://x.com/a"'));
  assert.ok(clean.includes('rel="noopener"'));
});
test('Google Docs style spans become semantic tags', () => {
  const clean = B.sanitizeInline('<span style="font-weight:700">Bold</span> and <span style="font-style:italic">it</span>');
  assert.equal(clean, '<strong>Bold</strong> and <em>it</em>');
});
test('html blocks keep class but drop scripts and bad urls', () => {
  const raw = B.sanitizeRaw('<div class="article-inline-icon" onclick="x"><img src="https://a.com/i.png" alt="i" onerror="y"><script>1</script></div><iframe src="https://evil.com/x"></iframe>');
  assert.ok(raw.includes('class="article-inline-icon"') && !/onclick|onerror|script|evil/.test(raw), raw);
});
test('only YouTube embeds survive', () => {
  assert.equal(B.youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(B.youtubeId('https://evil.com/watch?v=dQw4w9WgXcQ'), '');
});

/* ------------------------------------------------------------- html → blocks */
await test('legacy editor HTML converts to blocks', () => {
  const blocks = B.htmlToBlocks('<h1>Title</h1><p>Hello <strong>world</strong> &amp; more</p><ul><li>a</li><li>b<ul><li>c</li></ul></li></ul><blockquote><p>Quote</p></blockquote><table><tr><th>A</th><th align="right">B</th></tr><tr><td>1</td><td>2</td></tr></table><p><img src="https://x.com/a.png" alt="A"></p><hr>');
  assert.deepEqual(blocks.map((b) => b.type), ['h2', 'p', 'ul', 'quote', 'table', 'image', 'hr']);
  assert.equal(blocks[2].items.length, 3);
  assert.equal(blocks[4].align[1], 'right');
  assert.ok(blocks[1].html.includes('&amp;'));
});
test('Word and web paste: junk wrappers are flattened', () => {
  const blocks = B.htmlToBlocks('<!--StartFragment--><div><div><p class="MsoNormal"><span style="font-weight:bold">Hi</span></p></div></div><!--EndFragment-->');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].html, '<strong>Hi</strong>');
});

/* ------------------------------------------------------- markdown conversion */
await test('callouts and images with captions round trip', () => {
  const blocks = B.cleanBlocks([
    { type: 'callout', kind: 'warning', title: 'Careful', html: 'Do <strong>not</strong> do this' },
    { type: 'image', src: 'https://x.com/a.png', alt: 'A', caption: 'Cap' },
    { type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ' }
  ]);
  const again = B.markdownToBlocks(B.blocksToMarkdown(blocks));
  assert.equal(strip(blocks), strip(again));
});
test('special characters survive Markdown', () => {
  const blocks = B.cleanBlocks([{ type: 'p', html: '1. not a list * star _ under [brackets] `tick` &amp; amp &lt;tag&gt;' }, { type: 'p', html: '# not a heading' }]);
  const md = B.blocksToMarkdown(blocks);
  const again = B.markdownToBlocks(md);
  assert.equal(strip(blocks), strip(again), md);
});
test('code blocks keep their content verbatim', () => {
  const blocks = B.cleanBlocks([{ type: 'code', text: 'a ``` b\n<b>x</b>', lang: 'js' }]);
  assert.equal(strip(blocks), strip(B.markdownToBlocks(B.blocksToMarkdown(blocks))));
});
test('every existing article imports and re-exports stably', () => {
  const dir = path.resolve('src/content/blog');
  let n = 0;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md') && !x.startsWith('_'))) {
    const { body } = B.parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf8'));
    const blocks = B.markdownToBlocks(body);
    assert.ok(blocks.length > 3, f);
    assert.equal(strip(blocks), strip(B.markdownToBlocks(B.blocksToMarkdown(blocks))), f + ' is not stable');
    n++;
  }
  assert.ok(n >= 15, 'expected to find the real articles');
});
test('generated front matter matches the content collection schema', () => {
  const cfg = fs.readFileSync('src/content/config.ts', 'utf8');
  const enumOf = (name) => [...cfg.match(new RegExp('const ' + name + " = \\[([^\\]]+)\\]"))[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(enumOf('ARTICLE_TYPES'), B.ARTICLE_TYPES, 'article types drifted from config.ts');
  assert.deepEqual(enumOf('FACT_STATUSES'), B.FACT_STATUSES, 'fact statuses drifted from config.ts');
  const file = B.articleToMarkdownFile({
    id: 7, slug: 'x-y', title: 'He said "hi": a test', subtitle: '', description: 'd', type: 'leaks', category: 'Leaks', author: 'A', image: 'https://x.com/a.png',
    tags: ['a', 'b'], sources: ['https://x.com'], factStatus: 'community-reported', series: 'S', seriesOrder: 2, publishedAt: '2026-10-25T10:00:00.000Z'
  }, B.cleanBlocks([{ type: 'p', html: 'Body' }]));
  const { data, body } = B.parseFrontmatter(file);
  assert.equal(data.title, 'He said "hi": a test');
  assert.deepEqual(data.tags, ['a', 'b']);
  assert.equal(data.seriesOrder, 2);
  assert.equal(data.status, 'published');
  assert.ok(!Number.isNaN(Date.parse(data.publishedAt)));
  assert.equal(body.trim(), 'Body');
  const known = new Set([...cfg.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]));
  for (const k of Object.keys(data)) assert.ok(known.has(k), 'front matter key not in schema: ' + k);
});
test('front matter parser handles block lists and comments', () => {
  const { data } = B.parseFrontmatter('---\n# note\ntitle: "A"\ntags:\n  - one\n  - two\nfeatured: true\nsources: []\n---\nbody');
  assert.deepEqual(data.tags, ['one', 'two']);
  assert.equal(data.featured, true);
  assert.deepEqual(data.sources, []);
});

/* --------------------------------------------------------------- checklist */
await test('publish checklist blocks incomplete articles and passes complete ones', () => {
  const words = Array.from({ length: 160 }, (_, i) => 'word' + i).join(' ');
  const blocks = B.cleanBlocks([{ type: 'h2', html: 'One' }, { type: 'p', html: words }]);
  const bad = checkArticle({ title: 'Hi', slug: 'Bad Slug', description: '', type: 'guide', category: '', tags: [] }, blocks);
  assert.ok(!bad.ok && bad.fails >= 4);
  const good = checkArticle({ title: 'A proper headline for testing', slug: 'a-proper', description: 'x'.repeat(100), type: 'guide', category: 'Guides', image: 'https://x.com/c.png', imageAlt: 'c', tags: ['t'], factStatus: 'verified' }, blocks);
  assert.ok(good.ok, JSON.stringify(good.checks.filter((c) => c.state === 'fail')));
});

/* ------------------------------------------------------- fake Supabase + GitHub */
function makeApi(backend, who) {
  const session = { current: who };
  const api = createEditorialApi({
    supabaseRest: backend.rest, github: backend.github,
    json: (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }),
    authenticated: async () => session.current.role === 'admin',
    creatorRecord: async () => (session.current.role === 'admin' ? null : { id: session.current.id, display_name: session.current.name, role: session.current.role === 'editor' ? 'editor' : 'creator' }),
    d1: async () => ({ prepare: () => ({ bind: (id) => ({ first: async () => ({ id, display_name: 'Writer ' + id, username: 'w' + id }), all: async () => ({ results: [{ id: 2, username: 'w2', display_name: 'Writer 2', role: 'creator' }] }) }) }) })
  });
  const call = async (method, p, body) => {
    const res = await api.handle(new Request('https://x.test' + p, { method, headers: { 'x-editorial': '1', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), { ADMIN_DISPLAY_NAME: 'Owner' }, p);
    return { status: res.status, body: await res.json() };
  };
  return { call, api, session };
}
const admin = { role: 'admin', name: 'Owner' };
const writer = (id = 2) => ({ role: 'writer', id, name: 'Writer ' + id });
const longBlocks = () => [{ type: 'h2', html: 'Section' }, { type: 'p', html: Array.from({ length: 200 }, (_, i) => 'word' + i).join(' ') }];
const readyFields = { description: 'A summary that is definitely long enough to pass the length check for search results.', category: 'Guides', image: 'https://res.cloudinary.com/x/image/upload/v1/a.png', imageAlt: 'A', tags: ['fc mobile'] };

await test('writer creates, saves with conflict protection, and cannot see others', async () => {
  const be = makeBackend(); const w = makeApi(be, writer(2));
  const created = await w.call('POST', '/articles', { title: 'My First Guide' });
  assert.equal(created.status, 200);
  const id = created.body.id;
  const s1 = await w.call('PATCH', '/articles/' + id, { baseVersion: 1, fields: { description: 'x' }, doc: { blocks: longBlocks() } });
  assert.equal(s1.status, 200); assert.equal(s1.body.version, 2);
  const stale = await w.call('PATCH', '/articles/' + id, { baseVersion: 1, fields: { subtitle: 'stale' } });
  assert.equal(stale.status, 409); assert.equal(stale.body.code, 'conflict');
  const same = await w.call('PATCH', '/articles/' + id, { baseVersion: 2, doc: { blocks: longBlocks().map((b) => ({ ...b })) } });
  assert.ok(same.body.unchanged || same.body.version >= 2);
  const other = makeApi(be, writer(3));
  assert.equal((await other.call('GET', '/articles/' + id)).status, 404);
  assert.equal((await other.call('GET', '/articles')).body.articles.length, 0);
});

await test('list responses never include article bodies', async () => {
  const be = makeBackend(); const a = makeApi(be, admin);
  const c = await a.call('POST', '/articles', { title: 'List Test', doc: { blocks: longBlocks() } });
  const list = await a.call('GET', '/articles');
  assert.ok(!JSON.stringify(list.body).includes('word10'), 'body leaked into list');
  assert.ok(list.body.articles[0].words > 100);
  assert.equal(c.status, 200);
});

await test('submit → request changes → resubmit → approve publishes to GitHub', async () => {
  const be = makeBackend(); const w = makeApi(be, writer(2)); const a = makeApi(be, admin);
  const id = (await w.call('POST', '/articles', { title: 'Leak Roundup Guide', type: 'leaks' })).body.id;
  assert.equal((await w.call('POST', '/articles/' + id + '/submit', {})).status, 422, 'too short');
  await w.call('PATCH', '/articles/' + id, { baseVersion: 1, fields: { ...readyFields, factStatus: 'community-reported' }, doc: { blocks: longBlocks() } });
  assert.equal((await w.call('POST', '/articles/' + id + '/submit', { note: 'please review' })).status, 200);
  assert.equal((await w.call('PATCH', '/articles/' + id, { baseVersion: 2, fields: { subtitle: 's' } })).status, 403, 'locked in review');
  assert.equal((await a.call('GET', '/pulse')).body.queue, 1);
  assert.equal((await a.call('POST', '/articles/' + id + '/request-changes', {})).status, 422, 'note required');
  assert.equal((await a.call('POST', '/articles/' + id + '/request-changes', { note: 'add a source' })).status, 200);
  assert.ok((await w.call('GET', '/inbox')).body.items.some((i) => i.kind === 'changes'));
  const row = (await w.call('GET', '/articles/' + id)).body.article;
  assert.equal(row.status, 'changes_requested');
  await w.call('POST', '/articles/' + id + '/submit', {});
  assert.equal((await w.call('POST', '/articles/' + id + '/approve', {})).status, 403, 'writers cannot approve');
  const pub = await a.call('POST', '/articles/' + id + '/approve', { note: 'good' });
  assert.equal(pub.status, 200, JSON.stringify(pub.body));
  assert.equal(be.commits.length, 1);
  assert.equal(be.commits[0].file, 'src/content/blog/leak-roundup-guide.md');
  assert.equal(be.commits[0].author.name, 'Writer 2', 'commit is attributed to the writer');
  const md = be.repo.get('src/content/blog/leak-roundup-guide.md').text;
  assert.ok(md.includes('status: "published"') && md.includes('## Section'));
  const after = (await a.call('GET', '/articles/' + id)).body.article;
  assert.equal(after.status, 'published'); assert.equal(after.deployState, 'building');
  assert.ok((await w.call('GET', '/inbox')).body.items.some((i) => i.kind === 'published'));
});

await test('publishing is refused when the checklist fails, and never overwrites an unknown repo file', async () => {
  const be = makeBackend(); const a = makeApi(be, admin);
  const id = (await a.call('POST', '/articles', { title: 'Incomplete Article Here' })).body.id;
  const refused = await a.call('POST', '/articles/' + id + '/publish', {});
  assert.equal(refused.status, 422); assert.ok(refused.body.checks.length > 0);
  await a.call('PATCH', '/articles/' + id, { baseVersion: 1, fields: readyFields, doc: { blocks: longBlocks() } });
  be.repo.set('src/content/blog/incomplete-article-here.md', { text: 'hand uploaded', sha: 'zz' });
  assert.equal((await a.call('POST', '/articles/' + id + '/publish', {})).status, 409);
  assert.equal(be.commits.length, 0);
});

await test('editing a published article keeps it live and shows a pending update, then updates the same file', async () => {
  const be = makeBackend(); const a = makeApi(be, admin);
  const id = (await a.call('POST', '/articles', { title: 'Live Article Update' })).body.id;
  await a.call('PATCH', '/articles/' + id, { baseVersion: 1, fields: readyFields, doc: { blocks: longBlocks() } });
  await a.call('POST', '/articles/' + id + '/publish', {});
  const live = (await a.call('GET', '/articles/' + id)).body.article;
  assert.equal(live.pendingUpdate, false);
  await a.call('PATCH', '/articles/' + id, { baseVersion: live.version, fields: { subtitle: 'edited' } });
  const edited = (await a.call('GET', '/articles/' + id)).body.article;
  assert.equal(edited.status, 'published'); assert.equal(edited.pendingUpdate, true);
  assert.equal((await a.call('PATCH', '/articles/' + id, { baseVersion: edited.version, fields: { slug: 'new-slug' } })).status, 200);
  assert.equal((await a.call('GET', '/articles/' + id)).body.article.slug, 'live-article-update', 'slug locked once published');
  await a.call('POST', '/articles/' + id + '/publish', {});
  assert.equal(be.commits.length, 2); assert.ok(be.commits.every((c) => c.file === 'src/content/blog/live-article-update.md'));
});

await test('scheduled articles are published by the sweep', async () => {
  const be = makeBackend(); const a = makeApi(be, admin);
  const id = (await a.call('POST', '/articles', { title: 'Scheduled Article Test' })).body.id;
  await a.call('PATCH', '/articles/' + id, { baseVersion: 1, fields: readyFields, doc: { blocks: longBlocks() } });
  assert.equal((await a.call('POST', '/articles/' + id + '/schedule', { at: new Date(Date.now() + 30000).toISOString() })).status, 422, 'must be in the future');
  assert.equal((await a.call('POST', '/articles/' + id + '/schedule', { at: new Date(Date.now() + 3600000).toISOString() })).status, 200);
  assert.equal((await a.api.sweep({})).length, 0, 'not due yet');
  be.tables.articles[0].scheduled_for = new Date(Date.now() - 1000).toISOString();
  const out = await a.api.sweep({});
  assert.equal(out.length, 1); assert.ok(out[0].ok);
  assert.equal(be.tables.articles[0].status, 'published');
});

await test('import adopts existing repo articles once and never overwrites studio edits', async () => {
  const be = makeBackend(); const a = makeApi(be, admin);
  const dir = path.resolve('src/content/blog');
  const real = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).slice(0, 3);
  for (const f of real) be.repo.set('src/content/blog/' + f, { text: fs.readFileSync(path.join(dir, f), 'utf8'), sha: 'sha-' + f });
  const origGithub = be.github;
  const wrapped = makeApi({ ...be, github: async (env, p, o) => (p.startsWith('contents/src/content/blog?') ? real.map((name) => ({ type: 'file', name, path: 'src/content/blog/' + name })) : origGithub(env, p, o)) }, admin);
  const first = await wrapped.call('POST', '/import', {});
  assert.equal(first.body.imported, 3, JSON.stringify(first.body));
  const second = await wrapped.call('POST', '/import', {});
  assert.equal(second.body.imported, 0); assert.equal(second.body.skipped, 3);
  const row = be.tables.articles[0];
  assert.equal(row.status, 'published'); assert.equal(row.published_version, 1); assert.equal(row.doc_version, 2);
});

await test('assignment, comments, revisions and trash rules', async () => {
  const be = makeBackend(); const a = makeApi(be, admin); const w = makeApi(be, writer(2));
  const id = (await a.call('POST', '/articles', { title: 'Assigned Topic Piece', assignTo: 'creator:2', brief: 'Cover the new event', dueAt: '2026-11-01' })).body.id;
  assert.ok((await w.call('GET', '/inbox')).body.items.some((i) => i.kind === 'assigned'));
  assert.equal((await w.call('GET', '/articles/' + id)).body.article.brief, 'Cover the new event');
  await w.call('POST', '/articles/' + id + '/comments', { body: 'Question', blockId: 'b1' });
  await a.call('POST', '/articles/' + id + '/comments', { body: 'Answer' });
  assert.equal((await a.call('GET', '/articles/' + id)).body.comments.length, 2);
  await w.call('PATCH', '/articles/' + id, { baseVersion: 1, doc: { blocks: longBlocks() } });
  assert.ok((await w.call('GET', '/articles/' + id + '/revisions')).body.revisions.length >= 1);
  assert.equal((await w.call('POST', '/articles/' + id + '/trash', {})).status, 403);
  assert.equal((await a.call('POST', '/articles/' + id + '/trash', {})).status, 200);
  assert.equal((await w.call('GET', '/articles')).body.articles.length, 0);
});

await test('mutations without the CSRF header are rejected', async () => {
  const be = makeBackend(); const a = makeApi(be, admin);
  const res = await a.api.handle(new Request('https://x.test/articles', { method: 'POST', body: '{}' }), {}, '/articles');
  assert.equal(res.status, 400);
});

console.log(passed + ' editorial tests passed' + (process.exitCode ? ' (with failures)' : ''));
