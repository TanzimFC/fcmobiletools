// Logic checks for the league hub. Runs the real Worker route code against a mocked database.
// Usage: node scripts/test-leagues.mjs
import assert from 'node:assert/strict';
import { leagueWorkerRoute } from '../src/leagueWorker.mjs';
import { decorateListings, pickSpotlight } from '../src/lib/leaguePublic.js';
import { leagueCard, trustBadge } from '../src/lib/league-card.js';
import { divisionByKey, DIVISIONS } from '../src/data/leagueConfig.js';

globalThis.caches = { default: { match: async () => undefined, put: async () => {}, delete: async () => true } };
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
let passed = 0; const ok = (name, fn) => Promise.resolve(fn()).then(() => { passed++; console.log('  ✓ ' + name); }, (e) => { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; });

const now = new Date().toISOString();
const rows = [
  { id: '11111111-1111-4111-8111-111111111111', owner_account_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', slug: 'real-fc', name: 'Real FC', description: '', tagline: 'Daily 8v8', region_server: 'Asia', min_ovr: 110, tournament_frequency: 'daily', tournament_sizes: ['8v8'], preferred_languages: ['English'], open_spots: 4, recruiting_open: true, status: 'approved', discord_invite_url: 'https://discord.gg/secret', contact_discord: '@boss', league_game_id: 'GAME123', division: 'silver', join_methods: ['apply', 'discord'], accent: 'gold', is_verified: true, reviewed_at: now, created_at: now },
  { id: '22222222-2222-4222-8222-222222222222', owner_account_id: null, slug: 'sample-x', name: 'Sample X', region_server: 'Europe', min_ovr: 100, tournament_frequency: 'weekly', tournament_sizes: ['4v4'], open_spots: 3, recruiting_open: true, status: 'approved', division: 'bronze', join_methods: ['apply'], is_sample: true, is_verified: true, reviewed_at: now, created_at: now }
];
const signals = new Map([[rows[0].id, { confirmations7d: 3, matchdays7d: 2, activityScore: 12 }], [rows[1].id, { activityScore: 99 }]]);

console.log('Data shaping');
await ok('public listings never carry contact details', () => {
  const [a] = decorateListings([rows[0]], new Map(), { contact: false });
  assert.equal(a.discordInviteUrl, undefined); assert.equal(a.contactDiscord, undefined); assert.equal(a.leagueGameId, undefined);
  assert.equal(a.hasDiscord, true); assert.equal(a.hasGameId, true);
});
await ok('verified club and reviewed listing are different labels; samples are never verified', () => {
  const [real, sample] = decorateListings(rows, new Map(), { contact: false, signals });
  assert.match(trustBadge(real), /Verified club/);
  assert.match(trustBadge({ ...real, verified: false }), />Reviewed</);
  assert.equal(sample.verified, false); assert.equal(sample.reviewed, false); assert.match(trustBadge(sample), /Sample club/);
});
await ok('spotlight uses real activity only (samples excluded)', () => {
  const list = decorateListings(rows, new Map(), { contact: false, signals });
  assert.deepEqual(pickSpotlight(list), [rows[0].id]);
});
await ok('card shows spots, min OVR, schedule, joining methods and division', () => {
  const [a] = decorateListings([rows[0]], new Map(), { contact: false });
  const html = leagueCard(a);
  for (const needle of ['Open spots', '>4<', 'Min OVR', '110+', 'Daily', '8v8', 'Apply here', 'Join Discord', '/leagues/icons/silver.webp', 'href="/leagues/real-fc/"']) assert.ok(html.includes(needle), 'missing ' + needle);
  assert.ok(!html.includes('secret') && !html.includes('GAME123'));
});
await ok('five divisions with the agreed ranges', () => {
  assert.equal(DIVISIONS.length, 5); assert.equal(divisionByKey('fc_champions').max, 10000); assert.equal(divisionByKey('silver').min, 2100);
});

console.log('Worker API');
const calls = [];
function makeRest(extra = {}) {
  return async (env, path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body });
    if (extra[path.split('?')[0]]) return extra[path.split('?')[0]](path, options);
    if (path.startsWith('league_listings?') && path.includes('select=tagline')) return [];
    if (path.startsWith('league_listings?') && path.includes('status=eq.approved')) return rows;
    if (path.startsWith('rpc/server_league_public_signals')) return [{ listingId: rows[0].id, confirmations7d: 3, activityScore: 12 }];
    if (path.startsWith('accounts?')) return [{ id: rows[0].owner_account_id, username: 'boss', display_name: 'Boss' }];
    if (path.startsWith('league_listings') && options.method === 'POST') return null;
    return [];
  };
}
const ctx = { waitUntil() {} };
const call = (method, path, { body, user = true, rest = makeRest(), query = '' } = {}) => leagueWorkerRoute({
  request: new Request('https://x.test' + path + query, { method, body: body && method !== 'GET' ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } }),
  env: {}, url: new URL('https://x.test' + path + query), ctx, authenticated: async () => false,
  accountContext: async () => user ? { account: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', username: 'player', state: '' }, user: { email_confirmed_at: 'yes' } } : null,
  supabaseRest: rest, json
});

await ok('signed-out visitors can browse /api/leagues/public and it is edge-cacheable', async () => {
  const res = await call('GET', '/api/leagues/public', { user: false });
  assert.equal(res.status, 200); assert.match(res.headers.get('cache-control'), /s-maxage/);
  const body = await res.json(); assert.equal(body.leagues.length, 2);
  assert.ok(!JSON.stringify(body).includes('discord.gg') && !JSON.stringify(body).includes('GAME123'), 'contact leaked');
  assert.equal(body.stats.leagues, 1); assert.equal(body.stats.sample, 1);
});
await ok('signed-out visitors cannot save, apply or list', async () => {
  for (const [m, p] of [['POST', '/api/leagues/listings/' + rows[0].id + '/save'], ['POST', '/api/leagues/listings/' + rows[0].id + '/apply'], ['POST', '/api/leagues/listings'], ['GET', '/api/leagues/listings/' + rows[0].id + '/contact']]) {
    const res = await call(m, p, { user: false, body: {} }); assert.equal(res.status, 401, p);
  }
});
await ok('any account can list: goes live at once, one listing each', async () => {
  const rest = makeRest({ 'league_listings': (path, o) => (o.method === 'POST' ? null : path.includes('select=tagline') ? [] : path.includes('owner_account_id') ? [] : rows) });
  const bad = await call('POST', '/api/leagues/listings', { rest, body: { name: 'My Club', division: 'silver', regionServer: 'Asia', minOvr: 110, openSpots: 3, tournamentFrequency: 'daily', tournamentSizes: ['8v8'], joinMethods: ['apply'] } });
  assert.equal(bad.status, 400); assert.match((await bad.json()).error, /rules/i);
  calls.length = 0;
  const good = await call('POST', '/api/leagues/listings', { rest, body: { name: 'My Club', tagline: 'Daily 8v8\n\nfriendly', division: 'silver', regionServer: 'Asia', minOvr: 110, openSpots: 3, tournamentFrequency: 'daily', tournamentSizes: ['8v8'], joinMethods: ['apply'], acceptRules: true } });
  assert.equal(good.status, 201); const b = await good.json(); assert.match(b.url, /^\/leagues\/my-club-/);
  const insert = calls.find(c => c.method === 'POST' && c.path === 'league_listings'); const row = JSON.parse(insert.body)[0];
  assert.equal(row.status, 'approved'); assert.ok(row.rules_accepted_at); assert.equal(row.tagline, 'Daily 8v8 friendly', 'newlines must be flattened');
  assert.equal(row.division, 'silver'); assert.deepEqual(row.join_methods, ['apply']);
});
await ok('long pasted paragraphs are cut to the one-line limit', async () => {
  const rest = makeRest({ 'league_listings': (path, o) => (o.method === 'POST' ? null : path.includes('select=tagline') ? [] : path.includes('owner_account_id') ? [] : rows) });
  calls.length = 0;
  await call('POST', '/api/leagues/listings', { rest, body: { name: 'Wordy FC', tagline: 'x'.repeat(900), division: 'bronze', regionServer: 'Asia', minOvr: 100, openSpots: 1, tournamentFrequency: 'weekly', tournamentSizes: ['4v4'], joinMethods: ['apply'], acceptRules: true } });
  const row = JSON.parse(calls.find(c => c.path === 'league_listings' && c.method === 'POST').body)[0];
  assert.ok(row.tagline.length <= 100 && row.description === '');
});
await ok('Discord join method requires an invite link; in-game requires a league ID', async () => {
  const rest = makeRest({ 'league_listings': (path, o) => (o.method === 'POST' ? null : path.includes('select=tagline') ? [] : path.includes('owner_account_id') ? [] : rows) });
  const base = { name: 'Edge FC', division: 'bronze', regionServer: 'Asia', minOvr: 100, openSpots: 1, tournamentFrequency: 'weekly', tournamentSizes: ['4v4'], acceptRules: true };
  const a = await call('POST', '/api/leagues/listings', { rest, body: { ...base, joinMethods: ['discord'] } }); assert.equal(a.status, 400);
  const b = await call('POST', '/api/leagues/listings', { rest, body: { ...base, joinMethods: ['in_game'] } }); assert.equal(b.status, 400);
});
await ok('apply goes through the atomic function with sharing choices; no profile → asks for a player card', async () => {
  const noProfile = await call('POST', '/api/leagues/listings/' + rows[0].id + '/apply', { body: {} });
  assert.equal(noProfile.status, 428);
  const profile = { account_id: 'b', in_game_username: 'P', ovr: 120, region_server: 'Asia' };
  const rest = makeRest({ 'league_profiles': () => [profile], 'rpc/server_league_apply': (p, o) => ({ ok: true, id: 'app1' }) });
  calls.length = 0;
  const res = await call('POST', '/api/leagues/listings/' + rows[0].id + '/apply', { rest, body: { message: 'hi', shareUid: true, shareDiscord: false } });
  assert.equal(res.status, 201);
  const args = JSON.parse(calls.find(c => c.path.startsWith('rpc/server_league_apply')).body);
  assert.equal(args.p_share_uid, true); assert.equal(args.p_share_discord, false);
});
await ok('duplicate / sample / full-league applications come back as clear errors', async () => {
  const profile = { account_id: 'b' };
  for (const [code, status] of [['duplicate', 409], ['limit', 429], ['sample', 403]]) {
    const rest = makeRest({ 'league_profiles': () => [profile], 'rpc/server_league_apply': () => ({ ok: false, code, message: 'msg ' + code }) });
    const res = await call('POST', '/api/leagues/listings/' + rows[0].id + '/apply', { rest, body: {} });
    assert.equal(res.status, status, code); assert.match((await res.json()).error, /msg/);
  }
});
await ok('player search only reveals UID / Discord the player agreed to share', async () => {
  const mk = (flags) => makeRest({
    'rpc/server_league_reveal_player': () => ({ ok: true, used_today: 1, remaining_today: 2 }),
    'league_profiles': () => [{ in_game_username: 'P', ovr: 120, region_server: 'Asia', fc_mobile_uid: 'UID999', discord_handle: '@disc', ...flags }]
  });
  const path = '/api/leagues/players/cccccccc-cccc-4ccc-8ccc-cccccccccccc/reveal';
  const hidden = await (await call('POST', path, { rest: mk({ share_uid: false, share_discord: false }), body: {} })).json();
  assert.equal(hidden.player.fcMobileUid, ''); assert.equal(hidden.player.discordHandle, '');
  const shared = await (await call('POST', path, { rest: mk({ share_uid: true, share_discord: false }), body: {} })).json();
  assert.equal(shared.player.fcMobileUid, 'UID999'); assert.equal(shared.player.discordHandle, '');
});
await ok('division icon proxy only serves the five known icons', async () => {
  const bad = await leagueWorkerRoute({ request: new Request('https://x.test/leagues/icons/hax.webp'), env: {}, url: new URL('https://x.test/leagues/icons/hax.webp'), ctx, json, supabaseRest: async () => [] });
  assert.equal(bad.status, 404);
});
await ok('sitemap lists the board and real leagues only', async () => {
  const rest = async () => [{ slug: 'real-fc', updated_at: now }];
  const res = await leagueWorkerRoute({ request: new Request('https://x.test/sitemap-leagues.xml'), env: {}, url: new URL('https://x.test/sitemap-leagues.xml'), ctx, json, supabaseRest: rest });
  const xml = await res.text(); assert.match(xml, /\/leagues\/<\/loc>/); assert.match(xml, /\/leagues\/real-fc\//);
});
console.log('\n' + passed + ' checks passed' + (process.exitCode ? ' (with failures)' : ''));
