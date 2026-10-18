// Checks for the smart layer of Find a League: fit scoring, application coach, owner action center,
// image policy (gallery + 7-day applicant screenshots) and admin media moderation.
// Usage: node scripts/test-league-smart.mjs
import assert from 'node:assert/strict';
import { leagueWorkerRoute } from '../src/leagueWorker.mjs';
import { decorateListings, cleanGallery } from '../src/lib/leaguePublic.js';
import { leagueCard, spotCard, cardMedia } from '../src/lib/league-card.js';
import {
  fitFor, rankLeagues, similarLeagues, screenshotState, applicationStrength, noteSuggestions, pipeline, applicationNudge,
  triageApplications, kickoffState, listingExpiry, listingHealth, ownerActions, taglineSuggestions
} from '../src/lib/league-smart.js';

globalThis.caches = { default: { match: async () => undefined, put: async () => {}, delete: async () => true } };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
let passed = 0;
const ok = (name, fn) => Promise.resolve(fn()).then(() => { passed++; console.log('  ✓ ' + name); }, (e) => { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; });
const DAY = 864e5, HOUR = 36e5, now = Date.now();
const ago = (ms) => new Date(now - ms).toISOString();
const league = (o = {}) => ({ id: 'l1', name: 'L', minOvr: 110, regionServer: 'Asia', preferredLanguages: ['English'], tournamentSizes: ['8v8'], tournamentFrequency: 'daily', playerCommitment: 'regular', openSpots: 3, recruitingOpen: true, activityScore: 10, division: 'silver', ...o });
const player = { ovr: 118, region_server: 'Asia', preferred_languages: ['English'], tournament_sizes: ['8v8'], play_style: 'Active and relaxed', availability: 'Daily' };

console.log('Fit engine');
await ok('a matching player scores "great"; the reasons are plain language', () => {
  const f = fitFor(player, league());
  assert.equal(f.qualifies, true); assert.equal(f.tone, 'great'); assert.ok(f.score >= 80);
  assert.ok(f.reasons.includes('Meets 110+ OVR') && f.reasons.includes('Same region'));
});
await ok('just under the minimum is "near"; far under is "low"; both can still be explained', () => {
  const near = fitFor({ ...player, ovr: 108 }, league()); assert.equal(near.tone, 'near'); assert.equal(near.ovrGap, 2); assert.equal(near.qualifies, false);
  const far = fitFor({ ...player, ovr: 90 }, league()); assert.equal(far.tone, 'low'); assert.match(far.gaps[0], /20 more OVR/);
});
await ok('an OVR-only guest gets a fair score (missing details are neutral, never punished)', () => {
  const f = fitFor({ ovr: 118 }, league());
  assert.equal(f.qualifies, true); assert.ok(f.score >= 60, 'score ' + f.score);
});
await ok('Worldwide leagues accept every region', () => {
  assert.ok(fitFor({ ...player, region_server: 'Europe' }, league({ regionServer: 'Worldwide' })).reasons.includes('Open to every region'));
});
await ok('recommendations skip full leagues, your own league and ones you do not qualify for', () => {
  const picks = rankLeagues([league({ id: 'a' }), league({ id: 'b', openSpots: 0 }), league({ id: 'c', minOvr: 140 }), league({ id: 'd', isMine: true }), league({ id: 'e', regionServer: 'Europe' })], player, { limit: 5 });
  assert.deepEqual(picks.map(p => p.league.id), ['a', 'e']);
});
await ok('similar leagues prefer the same division and region and exclude the league itself', () => {
  const base = league({ id: 'x' });
  const s = similarLeagues(base, [base, league({ id: 'near' }), league({ id: 'far', division: 'bronze', regionServer: 'Africa', tournamentSizes: ['32v32'], preferredLanguages: ['Arabic'], minOvr: 160 })], 2);
  assert.equal(s[0].id, 'near'); assert.ok(!s.some(l => l.id === 'x'));
});

console.log('Applications');
await ok('applicant screenshots are tracked against the 7-day window', () => {
  assert.equal(screenshotState({ screenshotUrl: 'u', createdAt: ago(2 * DAY) }, now).daysLeft, 5);
  assert.equal(screenshotState({ screenshotUrl: 'u', createdAt: ago(6.5 * DAY) }, now).hoursLeft <= 13, true);
  assert.equal(screenshotState({ screenshotUrl: 'u', createdAt: ago(8 * DAY) }, now).expired, true);
  assert.equal(screenshotState({ screenshotUrl: 'u', createdAt: ago(9 * DAY), screenshotAt: ago(1 * DAY) }, now).expired, false, 're-applied screenshot counts from its own upload');
  assert.equal(screenshotState({ screenshotUrl: null, screenshotExpired: true, createdAt: ago(9 * DAY) }, now).expired, true, 'server-blanked link still reads as expired');
  assert.equal(screenshotState({ screenshotUrl: null, createdAt: ago(1 * DAY) }, now).has, false);
});
await ok('application strength rewards a screenshot, a note and shared contact', () => {
  const weak = applicationStrength({ hasShot: false, note: '', fit: fitFor(player, league()), hasUid: true });
  const strong = applicationStrength({ hasShot: true, note: 'I play daily and join every 8v8 tournament.', sharedUid: true, fit: fitFor(player, league()) });
  assert.ok(strong.score > weak.score); assert.equal(strong.label, 'Strong'); assert.ok(weak.tips.some(t => t.id === 'shot'));
});
await ok('note suggestions are short, unique and fit the 200-character limit', () => {
  const s = noteSuggestions(player, league({ activeHours: '18:00-23:00 UTC' }));
  assert.ok(s.length >= 3 && new Set(s).size === s.length && s.every(x => x.length <= 200));
});
await ok('the tracker shows where an application is and what to do next', () => {
  const p = pipeline('shortlisted');
  assert.deepEqual(p.steps.map(s => s.state), ['done', 'now', 'todo', 'todo']); assert.match(p.hint, /shortlist/i);
  assert.equal(pipeline('joined').steps.every(s => s.state === 'done'), true);
  assert.equal(pipeline('declined').closed, true);
});
await ok('a quiet application gets a nudge, a fresh one does not', () => {
  assert.equal(applicationNudge({ status: 'new', createdAt: ago(1 * DAY) }, now), null);
  assert.match(applicationNudge({ status: 'new', createdAt: ago(6 * DAY) }, now).text, /6 days/);
  assert.equal(applicationNudge({ status: 'declined', createdAt: ago(9 * DAY) }, now), null);
});
await ok('owners see the best applicants first, with honest flags', () => {
  const rows = triageApplications([
    { id: 'low', ovr: 100, status: 'new', screenshotUrl: null, createdAt: ago(HOUR) },
    { id: 'best', ovr: 120, status: 'new', screenshotUrl: 'u', createdAt: ago(HOUR), uid: '1', regionServer: 'Asia', message: 'hi' }
  ], league(), now).sort((a, b) => b._score - a._score);
  assert.equal(rows[0].id, 'best'); assert.ok(rows[0]._score > rows[1]._score);
  assert.ok(rows[1]._flags.some(f => /10 OVR below/.test(f.text)) && rows[1]._flags.some(f => /No screenshot/.test(f.text)));
});

console.log('Owner brain');
await ok('Kickoff has a 6-hour shared cooldown', () => {
  assert.equal(kickoffState({ lastKickoffAt: ago(2 * HOUR) }, now).ready, false);
  assert.equal(kickoffState({ lastKickoffAt: ago(7 * HOUR) }, now).ready, true);
  assert.equal(kickoffState({}, now).ready, true);
});
await ok('the 30-day listing timer resets on Kickoff and warns when close', () => {
  assert.equal(listingExpiry({ lastKickoffAt: ago(1 * DAY) }, now).daysLeft, 29);
  assert.equal(listingExpiry({ lastKickoffAt: ago(27 * DAY) }, now).soon, true);
});
await ok('listing health lists the next best improvement and ignores screenshots until they exist', () => {
  const bare = listingHealth({ openSpots: 2, recruitingOpen: true, lastKickoffAt: ago(DAY) }, { now });
  assert.ok(bare.score < 60 && bare.tips.length >= 3);
  const noGallery = listingHealth({ logoUrl: 'x', tagline: 'Daily 8v8, friendly', activeHours: '18-23', perks: 'p', openSpots: 2, recruitingOpen: true, lastKickoffAt: ago(DAY), confirmations7d: 2 }, { galleryReady: false, now });
  assert.equal(noGallery.score, 100);
});
await ok('the action center puts new applications first and flags an expiring listing', () => {
  const own = league({ status: 'approved', lastKickoffAt: ago(27 * DAY), logoUrl: 'x', tagline: 'Daily 8v8 friendly' });
  const a = ownerActions({ own, newApps: 2, pendingCrew: 1, now });
  assert.equal(a[0].id, 'apps'); assert.ok(a.some(x => x.id === 'expiry' && x.tone === 'warn'));
  assert.equal(ownerActions({ own: { ...own, status: 'paused' }, now })[0].id, 'status');
});
await ok('pitch suggestions are within the one-line limit and unique', () => {
  const t = taglineSuggestions({ tournamentFrequency: 'daily', tournamentSizes: ['8v8'], playerCommitment: 'regular', division: 'silver', openSpots: 3, regionServer: 'Asia', minOvr: 110 });
  assert.ok(t.length >= 3 && new Set(t).size === t.length && t.every(x => x.length <= 100));
});

console.log('Images');
await ok('only clean https images from our uploader survive as league screenshots', () => {
  const g = cleanGallery(['https://i.ibb.co/a/1.png', 'http://i.ibb.co/a/2.png', 'https://evil.test/x.png', 'https://i.ibb.co/a/3.png?x=1', 'https://i.ibb.co/a/1.png', 'not a url', 'https://i.ibb.co/a/4.png', 'https://i.ibb.co/a/5.png', 'https://i.ibb.co/a/6.png']);
  assert.deepEqual(g, ['https://i.ibb.co/a/1.png', 'https://i.ibb.co/a/4.png', 'https://i.ibb.co/a/5.png', 'https://i.ibb.co/a/6.png']);
});
await ok('a public card only shows owner images once the team has reviewed the listing', () => {
  const r = { galleryUrls: ['https://i.ibb.co/a/1.png'] };
  assert.equal(cardMedia(r), ''); assert.equal(cardMedia({ ...r, reviewed: true }), 'https://i.ibb.co/a/1.png');
  const html = leagueCard({ id: 'x', slug: 's', name: 'N', openSpots: 1, minOvr: 100, joinMethods: ['apply'], ...r });
  assert.ok(!html.includes('i.ibb.co'), 'unreviewed image leaked onto a card');
  assert.match(spotCard({ id: 'x', slug: 's', name: 'N', openSpots: 1, minOvr: 100 }), /href="\/leagues\/s\/"/);
});

console.log('Worker: gallery, expiry, moderation');
const OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', LID = '11111111-1111-4111-8111-111111111111';
const row = (o = {}) => ({ id: LID, owner_account_id: OWNER, slug: 'real-fc', name: 'Real FC', description: '', tagline: 'Daily 8v8', region_server: 'Asia', min_ovr: 110, tournament_frequency: 'daily', tournament_sizes: ['8v8'], open_spots: 4, recruiting_open: true, status: 'approved', created_at: ago(DAY), division: 'silver', join_methods: ['apply'], accent: 'cyan', logo_url: 'https://i.ibb.co/c/crest.png', gallery_urls: [], ...o });
const calls = [];
const makeRest = (handlers = {}) => async (env, path, options = {}) => {
  calls.push({ path, method: options.method || 'GET', body: options.body });
  const base = path.split('?')[0];
  if (handlers[base]) return handlers[base](path, options);
  return [];
};
const call = (method, path, { body, rest, admin = false, user = true } = {}) => leagueWorkerRoute({
  request: new Request('https://x.test' + path, { method, body: body && method !== 'GET' ? JSON.stringify(body) : undefined, headers: { 'content-type': 'application/json' } }),
  env: {}, url: new URL('https://x.test' + path), ctx: { waitUntil() {} }, authenticated: async () => admin,
  accountContext: async () => user ? { account: { id: OWNER, username: 'owner', state: '' }, user: { email_confirmed_at: 'yes' } } : null, supabaseRest: rest, json
});
const createBody = { name: 'Shots FC', division: 'silver', regionServer: 'Asia', minOvr: 110, openSpots: 3, tournamentFrequency: 'daily', tournamentSizes: ['8v8'], joinMethods: ['apply'], acceptRules: true };
const listingHandler = (extra = {}) => (path, o) => (o.method === 'POST' ? null : path.includes('owner_account_id') ? [] : [row()]);

await ok('creating a listing stores up to four league screenshots', async () => {
  calls.length = 0;
  const res = await call('POST', '/api/leagues/listings', { rest: makeRest({ league_listings: listingHandler() }), body: { ...createBody, galleryUrls: ['https://i.ibb.co/a/1.png', 'https://i.ibb.co/a/2.png'] } });
  assert.equal(res.status, 201);
  const inserted = JSON.parse(calls.find(c => c.method === 'POST' && c.path === 'league_listings').body)[0];
  assert.deepEqual(inserted.gallery_urls, ['https://i.ibb.co/a/1.png', 'https://i.ibb.co/a/2.png']);
});
await ok('screenshots from anywhere else, or more than four, are rejected with a clear message', async () => {
  const rest = makeRest({ league_listings: listingHandler() });
  const bad = await call('POST', '/api/leagues/listings', { rest, body: { ...createBody, galleryUrls: ['https://evil.test/x.png'] } });
  assert.equal(bad.status, 400); assert.match((await bad.json()).error, /screenshots/i);
  const many = await call('POST', '/api/leagues/listings', { rest, body: { ...createBody, galleryUrls: Array.from({ length: 5 }, (_, i) => 'https://i.ibb.co/a/' + i + '.png') } });
  assert.equal(many.status, 400);
});
await ok('before the database update, listing still works and screenshots are quietly skipped', async () => {
  calls.length = 0;
  const rest = makeRest({ league_listings: (path, o) => {
    if (path.includes('gallery_urls')) throw new Error('column league_listings.gallery_urls does not exist');
    return listingHandler()(path, o);
  } });
  const res = await call('POST', '/api/leagues/listings', { rest, body: { ...createBody, galleryUrls: ['https://i.ibb.co/a/1.png'] } });
  assert.equal(res.status, 201);
  const inserted = JSON.parse(calls.find(c => c.method === 'POST' && c.path === 'league_listings').body)[0];
  assert.equal('gallery_urls' in inserted, false);
});
await ok('owner sees expired applicant screenshots as expired, fresh ones as live', async () => {
  const apps = [
    { id: 'a1', applicant_account_id: 'p1', status: 'new', screenshot_url: 'https://i.ibb.co/s/old.png', ovr: 120, created_at: ago(8 * DAY), screenshot_at: ago(8 * DAY) },
    { id: 'a2', applicant_account_id: 'p2', status: 'new', screenshot_url: 'https://i.ibb.co/s/new.png', ovr: 115, created_at: ago(2 * DAY), screenshot_at: ago(2 * DAY) }
  ];
  const rest = makeRest({ league_listings: () => [row()], league_applications: () => apps, accounts: () => [] });
  const res = await call('GET', '/api/leagues/listings/' + LID + '/applications', { rest });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.screenshotDays, 7);
  const [old, fresh] = body.applications;
  assert.equal(old.screenshotExpired, true); assert.equal(old.screenshotUrl, null);
  assert.equal(fresh.screenshotExpired, false); assert.equal(fresh.screenshotUrl, 'https://i.ibb.co/s/new.png');
});
await ok('applications still load before the database update (no screenshot_at column yet)', async () => {
  const rest = makeRest({ league_listings: () => [row()], league_applications: (path) => {
    if (path.includes('screenshot_at')) throw new Error('column league_applications.screenshot_at does not exist');
    return [{ id: 'a1', applicant_account_id: 'p1', status: 'new', screenshot_url: 'https://i.ibb.co/s/x.png', created_at: ago(DAY) }];
  }, accounts: () => [] });
  const res = await call('GET', '/api/leagues/listings/' + LID + '/applications', { rest });
  assert.equal((await res.json()).applications.length, 1);
});
await ok('admins can remove one screenshot, all screenshots, or the crest, and every removal is logged', async () => {
  const shots = ['https://i.ibb.co/g/1.png', 'https://i.ibb.co/g/2.png', 'https://i.ibb.co/g/3.png'];
  const mk = () => makeRest({ league_listings: (path, o) => (o.method === 'PATCH' ? [row()] : [row({ gallery_urls: shots })]), league_moderation_log: () => null });
  calls.length = 0;
  const one = await call('POST', '/api/admin/leagues/' + LID + '/media', { admin: true, rest: mk(), body: { target: 'gallery', index: 1 } });
  assert.equal(one.status, 200);
  assert.deepEqual(JSON.parse(calls.find(c => c.method === 'PATCH').body).gallery_urls, [shots[0], shots[2]]);
  assert.ok(calls.some(c => c.path === 'league_moderation_log' && /media_removed/.test(c.body)), 'removal must be logged');
  calls.length = 0;
  await call('POST', '/api/admin/leagues/' + LID + '/media', { admin: true, rest: mk(), body: { target: 'gallery', index: 'all' } });
  assert.deepEqual(JSON.parse(calls.find(c => c.method === 'PATCH').body).gallery_urls, []);
  calls.length = 0;
  await call('POST', '/api/admin/leagues/' + LID + '/media', { admin: true, rest: mk(), body: { target: 'crest' } });
  assert.equal(JSON.parse(calls.find(c => c.method === 'PATCH').body).logo_url, null);
});
await ok('media moderation is admin-only and rejects nonsense', async () => {
  const rest = makeRest({ league_listings: () => [row()] });
  assert.equal((await call('POST', '/api/admin/leagues/' + LID + '/media', { admin: false, rest, body: { target: 'crest' } })).status, 401);
  assert.equal((await call('POST', '/api/admin/leagues/' + LID + '/media', { admin: true, rest, body: { target: 'banner' } })).status, 400);
  assert.equal((await call('POST', '/api/admin/leagues/' + LID + '/media', { admin: true, rest: makeRest({ league_listings: () => [row({ gallery_urls: ['https://i.ibb.co/g/1.png'] })] }), body: { target: 'gallery', index: 9 } })).status, 400);
});

console.log('\n' + passed + ' checks passed' + (process.exitCode ? ' (with failures)' : ''));
