// Run with: node --no-warnings scripts/test-redeem-votes.mjs
// Part 1 tests the pure scoring engine. Part 2 runs the real SQL against SQLite (D1 is SQLite).

import assert from 'node:assert/strict';
import {
  SIGNAL, decay, wilsonLower, scoreVotes, decideState, networkKey, isRegional, toPublicSignal, accountWeight,
} from '../src/lib/redeem-signal.js';
import {
  castVote, VoteError, VOTE_LIMITS, ensureVoteSchema, loadSignals, myVotes, hasRecentVote,
  resetSignals, refreshSignals, pruneVotes, hashIdentity, isVotable, recomputeSignal, deleteVotesFor,
} from '../src/lib/redeemVotes.mjs';
import { ensureRedeemSchema, effectiveStatus, publicPayload, listAdminCodes, bulkAction, saveCode, deleteCode } from '../src/lib/redeem.js';
import { createD1 } from './lib/d1-sqlite.mjs';

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed += 1; } catch (error) { console.error(`\nFAILED: ${name}\n`, error); process.exitCode = 1; throw error; }
};
const H = 3_600_000;
const NOW = Date.parse('2026-10-16T12:00:00.000Z');
const ago = (hours) => new Date(NOW - hours * H).toISOString();

// Vote row builders for the pure engine.
const acct = (id, verdict, hoursAgo = 0.1, weight = 1) => ({ voter_key: `a:${id}`, voter_kind: 'account', verdict, base_weight: weight, net_hash: `n${id}`, updated_at: ago(hoursAgo) });
const guest = (id, verdict, hoursAgo = 0.1, net = `g${id}`) => ({ voter_key: `g:${id}`, voter_kind: 'guest', verdict, base_weight: SIGNAL.weights.guest, net_hash: net, updated_at: ago(hoursAgo) });
const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
const verdictOf = (votes, opts = {}) => {
  const score = scoreVotes(votes, { now: NOW, regional: opts.regional, epoch: opts.epoch });
  return { score, ...decideState(score, { previous: opts.previous || 'ok', now: NOW }) };
};

/* ================================================================== */
/* Part 1: pure engine                                                 */
/* ================================================================== */

await test('decay halves every half-life and never exceeds 1', () => {
  assert.equal(decay(0), 1);
  assert.equal(decay(-5), 1);
  assert.ok(Math.abs(decay(SIGNAL.halfLifeHours * H) - 0.5) < 1e-9);
  assert.ok(Math.abs(decay(2 * SIGNAL.halfLifeHours * H) - 0.25) < 1e-9);
});

await test('wilson lower bound: unanimous reports reach 0.5 at n = z^2, tiny samples never do', () => {
  assert.ok(Math.abs(wilsonLower(1, SIGNAL.z ** 2) - 0.5) < 1e-6);
  assert.ok(wilsonLower(1, 1) < 0.5, '1/1 must not look conclusive');
  assert.ok(wilsonLower(1, 2) < 0.5);
  assert.equal(wilsonLower(0, 10), 0);
  assert.equal(wilsonLower(1, 0), 0);
  assert.ok(wilsonLower(0.8, 50) > wilsonLower(0.8, 5), 'more evidence, more confidence');
});

await test('one vote proves nothing, whoever casts it', () => {
  for (const vote of [acct(1, 'failed'), guest(1, 'failed')]) {
    const out = verdictOf([vote]);
    assert.equal(out.state, 'ok');
  }
});

await test('two independent accounts raise a soft review flag, but not an expiry', () => {
  const out = verdictOf([acct(1, 'failed'), acct(2, 'failed')]);
  assert.equal(out.state, 'review');
});

await test('three fresh verified accounts failing marks the code possibly expired', () => {
  const out = verdictOf(many(3, (i) => acct(i, 'failed', 0.2)));
  assert.equal(out.state, 'possibly_expired');
});

await test('anonymous devices count for less: 3 do nothing, 4 raise a review, 7 independent ones expire it', () => {
  assert.equal(verdictOf(many(3, (i) => guest(i, 'failed'))).state, 'ok');
  assert.equal(verdictOf(many(4, (i) => guest(i, 'failed'))).state, 'review');
  assert.equal(verdictOf(many(6, (i) => guest(i, 'failed'))).state, 'review');
  assert.equal(verdictOf(many(7, (i) => guest(i, 'failed'))).state, 'possibly_expired');
});

await test('a single network cannot brigade: 40 guest devices behind one IP are capped and count as one source', () => {
  const crowd = many(40, (i) => guest(i, 'failed', 0.1, 'same-network'));
  const out = verdictOf(crowd);
  assert.equal(out.state, 'ok');
  assert.ok(out.score.failed.weight <= SIGNAL.guestNetworkCap + 1e-9);
  assert.equal(out.score.failed.sources, 1);
});

await test('one network cannot fake a crowd, even with many signed-in accounts', () => {
  const farm = many(10, (i) => ({ ...acct(i, 'failed', 0.2), net_hash: 'one-ip' }));
  const out = verdictOf(farm);
  assert.equal(out.state, 'ok');
  assert.equal(out.score.failed.sources, 1, 'ten accounts behind one IP are one source');
  assert.ok(out.score.failed.weight <= SIGNAL.networkCap + 1e-9);
});

await test('the same accounts spread over different networks do count', () => {
  const spread = many(3, (i) => acct(i, 'failed', 0.2));
  assert.equal(verdictOf(spread).state, 'possibly_expired');
  // Two accounts on one shared IP plus one elsewhere: dampened, but corroborated by a second network.
  const mixed = [
    { ...acct(1, 'failed', 0.2), net_hash: 'shared' }, { ...acct(2, 'failed', 0.2), net_hash: 'shared' },
    { ...acct(3, 'failed', 0.2), net_hash: 'elsewhere' }, { ...acct(4, 'failed', 0.2), net_hash: 'another' },
  ];
  assert.notEqual(verdictOf(mixed).state, 'ok');
});

await test('new accounts count less until they are a week old', () => {
  const t = NOW;
  const day = 86_400_000;
  const brandNew = accountWeight({ verified: true, createdAt: t, now: t });
  const threeDays = accountWeight({ verified: true, createdAt: t - 3 * day, now: t });
  const week = accountWeight({ verified: true, createdAt: t - 7 * day, now: t });
  const year = accountWeight({ verified: true, createdAt: t - 365 * day, now: t });
  assert.equal(brandNew, SIGNAL.newAccountFloor);
  assert.ok(brandNew < threeDays && threeDays < week);
  assert.equal(week, 1);
  assert.equal(year, 1);
  assert.ok(accountWeight({ verified: false, createdAt: t - 30 * day, now: t }) < 1, 'unverified email counts less');
  assert.ok(accountWeight({ verified: false, createdAt: t, now: t }) <= SIGNAL.weights.guest, 'new and unverified is no better than a guest');
  assert.ok(accountWeight({ verified: true, createdAt: 'garbage', now: t }) > 0, 'missing date is handled');
  // A flood of day-old accounts is not enough to expire a code.
  const fresh = many(3, (i) => ({ ...acct(i, 'failed', 0.2, brandNew) }));
  assert.notEqual(verdictOf(fresh).state, 'possibly_expired');
});

await test('recent data wins: fresh failures beat many stale "worked" votes', () => {
  const stale = many(12, (i) => acct(100 + i, 'worked', 30));
  // Three fresh failures against twelve 30-hour-old successes: at least a review...
  assert.equal(verdictOf([...stale, ...many(3, (i) => acct(i, 'failed', 0.3))]).state, 'review');
  // ...and the fourth fresh failure expires it, despite the 12 older "worked" votes.
  assert.equal(verdictOf([...stale, ...many(4, (i) => acct(i, 'failed', 0.3))]).state, 'possibly_expired');
  // The very same twelve successes cast NOW would have protected the code completely.
  const sameButFresh = many(12, (i) => acct(100 + i, 'worked', 0.3));
  assert.equal(verdictOf([...sameButFresh, ...many(4, (i) => acct(i, 'failed', 0.3))]).state, 'ok');
  // Stale votes carry a small fraction of fresh weight.
  const staleScore = scoreVotes(stale, { now: NOW });
  const freshScore = scoreVotes(sameButFresh, { now: NOW });
  assert.ok(staleScore.worked.weight < freshScore.worked.weight / 20);
});

await test('recent data wins: stale failures cannot flag a code that fresh players confirm', () => {
  const stale = many(10, (i) => acct(100 + i, 'failed', 40));
  const fresh = many(4, (i) => acct(i, 'worked', 0.3));
  const out = verdictOf([...stale, ...fresh]);
  assert.equal(out.state, 'ok');
  assert.equal(out.working, true);
});

await test('votes older than the window are ignored entirely', () => {
  const out = verdictOf(many(10, (i) => acct(i, 'failed', SIGNAL.windowHours + 1)));
  assert.equal(out.score.failed.voters, 0);
  assert.equal(out.state, 'ok');
});

await test('admin epoch: evidence from before the admin check is discarded', () => {
  const votes = many(5, (i) => acct(i, 'failed', 2));
  assert.equal(verdictOf(votes).state, 'possibly_expired');
  const afterAdmin = verdictOf(votes, { epoch: NOW - 1 * H });
  assert.equal(afterAdmin.score.failed.voters, 0);
  assert.equal(afterAdmin.state, 'ok');
});

await test('future-dated votes (clock skew or tampering) are ignored', () => {
  const sneaky = many(5, (i) => ({ ...acct(i, 'failed'), updated_at: new Date(NOW + 10 * H).toISOString() }));
  assert.equal(verdictOf(sneaky).state, 'ok');
});

await test('region-locked codes need more evidence than global ones', () => {
  const three = many(3, (i) => acct(i, 'failed', 0.2));
  assert.equal(verdictOf(three, { regional: false }).state, 'possibly_expired');
  assert.notEqual(verdictOf(three, { regional: true }).state, 'possibly_expired');
  assert.equal(verdictOf(many(6, (i) => acct(i, 'failed', 0.2)), { regional: true }).state, 'possibly_expired');
  assert.equal(isRegional('Vietnam only'), true);
  assert.equal(isRegional('Global / Indonesia promo'), false);
  assert.equal(isRegional(''), false, 'an empty label means the default, Global');
  assert.equal(isRegional(null), false);
});

await test('a mixed crowd stays a review, never an expiry', () => {
  const out = verdictOf([...many(5, (i) => acct(i, 'failed', 0.3)), ...many(3, (i) => acct(50 + i, 'worked', 0.3))]);
  assert.equal(out.state, 'review');
});

await test('hysteresis: possibly_expired stays after reports age out, and clears only on community confirmation', () => {
  assert.equal(verdictOf([], { previous: 'possibly_expired' }).state, 'possibly_expired');
  const confirmed = verdictOf(many(4, (i) => acct(i, 'worked', 0.2)), { previous: 'possibly_expired' });
  assert.equal(confirmed.state, 'ok');
});

await test('hysteresis: an unattended review flag lapses after quiet hours, not before', () => {
  const recent = [acct(1, 'failed', 10), acct(2, 'failed', 10)];
  assert.equal(verdictOf(recent, { previous: 'review' }).state, 'review');
  const old = [acct(1, 'failed', 40), acct(2, 'failed', 41)];
  assert.equal(verdictOf(old, { previous: 'review' }).state, 'review', 'only 40h quiet');
  assert.equal(verdictOf([], { previous: 'review' }).state, 'ok');
});

await test('networkKey groups IPv6 by /64 and unwraps IPv4-mapped addresses', () => {
  assert.equal(networkKey('203.0.113.7'), '203.0.113.7');
  assert.equal(networkKey('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(networkKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), networkKey('2001:DB8:1:2::9'));
  assert.notEqual(networkKey('2001:db8:1:2::1'), networkKey('2001:db8:1:3::1'));
  assert.equal(networkKey(''), '');
  assert.equal(networkKey(undefined), '');
});

await test('toPublicSignal exposes only safe fields', () => {
  const pub = toPublicSignal({ state: 'possibly_expired', worked_24h: 2, failed_24h: 9, confirmed: 0, fail_w: 7.1, epoch_start: '' });
  assert.deepEqual(Object.keys(pub).sort(), ['confirmed', 'lastAt', 'resetAt', 'state'], 'no vote counts are public');
  assert.equal(toPublicSignal(null).state, 'ok');
  assert.equal(toPublicSignal({ state: 'weird' }).state, 'ok');
});

/* ================================================================== */
/* Part 2: D1 layer on real SQLite                                     */
/* ================================================================== */

const db = createD1();
await ensureRedeemSchema(db);
await ensureVoteSchema(db);

const LIVE = 'PUMPKINSPICEPACK'; // active, global
const REGIONAL = 'BANCAPNHATSN1TUOI'; // active until 2026-10-19, "Vietnam only"
const EXPIRED = '3RDANNIVERSARY';

const reset = async () => {
  await db.prepare('DELETE FROM redeem_votes').run();
  await db.prepare('DELETE FROM redeem_code_signals').run();
  await db.prepare('DELETE FROM redeem_vote_rate').run();
};
const account = (n, weight = 1) => ({ key: `a:acct-${n}`, kind: 'account', weight });
const device = (n) => ({ key: `g:dev-${n}`, kind: 'guest', weight: SIGNAL.weights.guest });
const vote = (code, verdict, voter, extra = {}) => castVote(db, { code, verdict, voter, netHash: extra.net ?? `net-${voter.key}`, now: extra.now ?? NOW });
const rejects = async (promise, code, status) => {
  await assert.rejects(promise, (error) => error instanceof VoteError && error.code === code && (!status || error.status === status), `expected VoteError ${code}`);
};

await test('schema creation is idempotent and the status rule matches redeem.js', async () => {
  await ensureVoteSchema(db);
  await ensureVoteSchema(db);
  const today = '2026-10-16';
  const rows = [
    { status: 'active', release_date: '2026-10-01', expiry_date: null },
    { status: 'active', release_date: '2026-10-01', expiry_date: '2026-10-15' }, // lapsed
    { status: 'active', release_date: '2026-10-20', expiry_date: null }, // not released
    { status: 'scheduled', release_date: '2026-10-20', expiry_date: null },
    { status: 'expired', release_date: '2026-10-01', expiry_date: '2026-10-05' },
  ];
  for (const row of rows) {
    const effective = effectiveStatus(row, today) === 'active' && row.release_date <= today;
    assert.equal(isVotable(row, today), effective, JSON.stringify(row));
  }
});

await test('a vote is stored once per voter; re-sending inside the refresh window is a no-op', async () => {
  await reset();
  const first = await vote(LIVE, 'worked', account(1));
  assert.equal(first.vote, 'worked');
  assert.equal(first.changed, true);
  assert.equal((await loadSignals(db)).get(LIVE).worked_24h, 1);
  const again = await vote(LIVE, 'worked', account(1), { now: NOW + 60_000 });
  assert.equal(again.changed, false);
  assert.equal((await loadSignals(db)).get(LIVE).worked_24h, 1, 'same voter never counts twice');
  const rows = await db.prepare('SELECT COUNT(*) AS n FROM redeem_votes').first();
  assert.equal(rows.n, 1);
});

await test('changing a verdict updates the same row, and flipping is limited', async () => {
  await reset();
  const voter = account(2);
  let t = NOW;
  const send = (verdict) => vote(LIVE, verdict, voter, { now: (t += 1000) });
  await send('worked');
  await send('failed');
  await send('worked');
  const last = await send('failed'); // 3rd change
  assert.equal(last.vote, 'failed');
  const flipped = (await loadSignals(db)).get(LIVE);
  assert.equal(flipped.failed_24h, 1);
  assert.equal(flipped.worked_24h, 0);
  await rejects(send('worked'), 'locked', 429);
});

await test('retracting a vote removes it and recomputes', async () => {
  await reset();
  await vote(LIVE, 'failed', account(3));
  const out = await vote(LIVE, 'clear', account(3));
  assert.equal(out.vote, null);
  assert.equal((await loadSignals(db)).get(LIVE).failed_24h, 0);
  const none = await vote(LIVE, 'clear', account(99)); // clearing nothing is harmless
  assert.equal(none.changed, false);
});

await test('only active, released codes can be voted on; unknown codes and verdicts are rejected', async () => {
  await reset();
  await rejects(vote(EXPIRED, 'worked', account(1)), 'inactive', 409);
  await rejects(vote('NOSUCHCODE12', 'worked', account(1)), 'not_found', 404);
  await rejects(vote('x', 'worked', account(1)), 'bad_code', 400);
  await rejects(vote(LIVE, 'maybe', account(1)), 'bad_verdict', 400);
  await rejects(vote(LIVE, 'worked', { key: '', kind: 'guest' }), 'bad_voter', 400);
  // Retracting on a dead code is still allowed.
  await vote(EXPIRED, 'clear', account(1));
  // After the expiry date passes, an "active" row is no longer votable.
  await rejects(castVote(db, { code: REGIONAL, verdict: 'worked', voter: account(1), now: Date.parse('2026-10-25T00:00:00Z') }), 'inactive', 409);
});

await test('anonymous devices: at most 4 per network per code', async () => {
  await reset();
  for (let i = 1; i <= VOTE_LIMITS.guestsPerCodeNetwork; i += 1) await vote(LIVE, 'failed', device(i), { net: 'shared-net' });
  await rejects(vote(LIVE, 'failed', device(99), { net: 'shared-net' }), 'network_limit', 429);
  await vote(LIVE, 'failed', device(100), { net: 'other-net' }); // other networks unaffected
  const sig = (await loadSignals(db)).get(LIVE);
  assert.ok(sig.fail_w <= SIGNAL.guestNetworkCap + 0.4 + 1e-6);
});

await test('requests are throttled per voter', async () => {
  await reset();
  const voter = account(7);
  for (let i = 0; i < VOTE_LIMITS.voterPerHour; i += 1) await vote(LIVE, 'clear', voter);
  await rejects(vote(LIVE, 'clear', voter), 'rate_limited', 429);
  // The window rolls: an hour later the same voter may vote again.
  await castVote(db, { code: LIVE, verdict: 'worked', voter, netHash: 'x', now: NOW + 3601_000 });
});

await test('end to end: three accounts report a dead code and it is flagged exactly once', async () => {
  await reset();
  const a = await vote(LIVE, 'failed', account(1));
  const b = await vote(LIVE, 'failed', account(2));
  assert.equal(a.signal.state, 'ok');
  assert.equal(a.publicChanged, false);
  assert.equal(b.signal.state, 'review');
  const c = await vote(LIVE, 'failed', account(3));
  assert.equal(c.signal.state, 'possibly_expired');
  assert.equal(c.publicChanged, true);
  const d = await vote(LIVE, 'failed', account(4));
  assert.equal(d.publicChanged, false, 'no cache churn once already flagged');
});

await test('admin priority: reset clears the flag, ignores older votes, and the crowd must produce fresh evidence', async () => {
  await reset();
  for (let i = 1; i <= 4; i += 1) await vote(LIVE, 'failed', account(i));
  assert.equal((await loadSignals(db)).get(LIVE).state, 'possibly_expired');

  const adminAt = NOW + 30 * 60_000;
  assert.equal(await resetSignals(db, [LIVE], 'admin', adminAt), 1);
  let sig = (await loadSignals(db)).get(LIVE);
  assert.equal(sig.state, 'ok');
  assert.equal(sig.resolved_by, 'admin');
  assert.equal(sig.epoch_start, new Date(adminAt).toISOString());

  // Old failures no longer count, even after a recompute.
  let rec = await recomputeSignal(db, LIVE, adminAt + 60_000);
  assert.equal(rec.after.state, 'ok');
  assert.equal(rec.row.failed_24h, 0);

  // The same people re-send "didn't work" later: that is FRESH evidence and counts again.
  const later = adminAt + 20 * 60_000;
  for (let i = 1; i <= 3; i += 1) await castVote(db, { code: LIVE, verdict: 'failed', voter: account(i), netHash: `net-${i}`, now: later });
  sig = (await loadSignals(db)).get(LIVE);
  assert.equal(sig.state, 'possibly_expired');
  assert.equal(sig.failed_24h, 3);
});

await test('recovery: a flagged code clears when the community confirms it works again', async () => {
  await reset();
  for (let i = 1; i <= 3; i += 1) await vote(LIVE, 'failed', account(i));
  assert.equal((await loadSignals(db)).get(LIVE).state, 'possibly_expired');
  // Players who flip to "worked" and newcomers who confirm it.
  const t = NOW + 5 * H;
  for (let i = 1; i <= 3; i += 1) await castVote(db, { code: LIVE, verdict: 'worked', voter: account(i), netHash: `net-${i}`, now: t });
  for (let i = 10; i <= 12; i += 1) await castVote(db, { code: LIVE, verdict: 'worked', voter: account(i), netHash: `net-${i}`, now: t });
  const sig = (await loadSignals(db)).get(LIVE);
  assert.equal(sig.state, 'ok');
  assert.equal(sig.confirmed, 1);
});

await test('hourly refresh: decay is applied without new votes; dead flags persist, soft flags lapse', async () => {
  await reset();
  await vote(LIVE, 'failed', account(1));
  await vote(LIVE, 'failed', account(2)); // review
  for (let i = 1; i <= 4; i += 1) await vote(REGIONAL, 'failed', account(i));
  const sigs = await loadSignals(db);
  assert.equal(sigs.get(LIVE).state, 'review');

  const dayAfter = NOW + 20 * H;
  await refreshSignals(db, dayAfter);
  assert.equal((await loadSignals(db)).get(LIVE).state, 'review', 'still inside the quiet period');

  const threeDays = NOW + 60 * H;
  const out = await refreshSignals(db, threeDays);
  assert.ok(out.checked >= 1);
  assert.equal((await loadSignals(db)).get(LIVE).state, 'ok', 'unattended soft flag lapses');
});

await test('refresh drops votes and signals for codes that no longer exist', async () => {
  await reset();
  await db.prepare("INSERT INTO redeem_codes (code,reward,status,release_date,region,notes,created_at,updated_at) VALUES ('TEMPCODE1','x','active','2026-10-01','Global','','a','b')").run();
  await vote('TEMPCODE1', 'failed', account(1));
  await db.prepare("DELETE FROM redeem_codes WHERE code='TEMPCODE1'").run();
  await refreshSignals(db, NOW + 1000);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM redeem_votes WHERE code='TEMPCODE1'").first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM redeem_code_signals WHERE code='TEMPCODE1'").first()).n, 0);
});

await test('retention: raw votes and stale rate counters are pruned', async () => {
  await reset();
  const old = new Date(NOW - 11 * 24 * H).toISOString();
  await db.prepare(`INSERT INTO redeem_votes (code,voter_key,voter_kind,verdict,base_weight,net_hash,changes,created_at,updated_at)
    VALUES (?1,'a:ancient','account','worked',1,'n',0,?2,?2)`).bind(LIVE, old).run();
  await vote(LIVE, 'worked', account(2), { now: NOW });
  const out = await pruneVotes(db, NOW);
  assert.equal(out.votes, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM redeem_votes').first()).n, 1);
});

await test('identity hashes are stable, namespaced, salted and not reversible by eye', async () => {
  const a = await hashIdentity(db, 'net', '203.0.113.7');
  assert.equal(a, await hashIdentity(db, 'net', '203.0.113.7'));
  assert.notEqual(a, await hashIdentity(db, 'dev', '203.0.113.7'));
  assert.notEqual(a, await hashIdentity(db, 'net', '203.0.113.8'));
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.ok(!a.includes('203'));
  const salt = await db.prepare("SELECT value FROM redeem_meta WHERE key='vote_salt'").first();
  assert.match(salt.value, /^[0-9a-f]{64}$/);
});

await test('my votes and the quest verification helper', async () => {
  await reset();
  await vote(LIVE, 'worked', account(1));
  await vote(REGIONAL, 'failed', account(1));
  const mine = await myVotes(db, 'a:acct-1', NOW);
  assert.equal(mine[LIVE].verdict, 'worked');
  assert.equal(mine[REGIONAL].verdict, 'failed');
  assert.equal(await hasRecentVote(db, 'a:acct-1', LIVE.toLowerCase(), NOW + 1000), true);
  assert.equal(await hasRecentVote(db, 'a:acct-2', LIVE, NOW), false);
  assert.equal(await hasRecentVote(db, 'a:acct-1', LIVE, NOW + 2 * 24 * H), false, 'a stale vote cannot farm a quest');
});

/* ================================================================== */
/* Part 3: integration with redeem.js (payloads and admin actions)     */
/* ================================================================== */

await test('public payload carries community data for active codes only, and never leaks voter data', async () => {
  await reset();
  for (let i = 1; i <= 3; i += 1) await vote(LIVE, 'failed', account(i), { now: Date.now() });
  const payload = await publicPayload(db);
  const live = payload.codes.find((c) => c.code === LIVE);
  assert.equal(live.community.state, 'possibly_expired');
  assert.equal('failed' in live.community || 'worked' in live.community, false, 'no vote counts on the public page');
  assert.equal(JSON.stringify(payload).includes('acct-'), false);
  assert.equal(JSON.stringify(payload).includes('net_hash'), false);
  const expired = payload.codes.find((c) => c.code === EXPIRED);
  assert.equal(expired.community, undefined, 'no vote UI for expired codes');
  assert.ok(typeof payload.signalsAt === 'string' || payload.signalsAt === null);
});

await test('votes can never change a code status; the admin list shows the evidence', async () => {
  const admin = await listAdminCodes(db);
  const live = admin.codes.find((c) => c.code === LIVE);
  assert.equal(live.status, 'active');
  assert.equal(live.storedStatus, 'active');
  assert.equal(live.community.state, 'possibly_expired');
  assert.ok(live.community.failSources >= 2);
  assert.ok(admin.stats.flagged >= 1);
});

await test('admin "verify" resets reports; "expire" and delete clean up', async () => {
  await bulkAction(db, 'verify', [LIVE], 'admin');
  let live = (await listAdminCodes(db)).codes.find((c) => c.code === LIVE);
  assert.equal(live.community.state, 'ok');
  assert.ok(live.community.resetAt);
  assert.equal((await publicPayload(db)).codes.find((c) => c.code === LIVE).community.state, 'ok');
  assert.equal(live.community.failed, 0, 'admin sees the evidence reset');

  const OTHER = 'GARUDAJUARA'; // active, no expiry date
  await vote(OTHER, 'failed', account(1), { now: Date.now() });
  await bulkAction(db, 'delete', [OTHER], 'admin');
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM redeem_votes WHERE code=?1").bind(OTHER).first()).n, 0);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM redeem_code_signals WHERE code=?1").bind(OTHER).first()).n, 0);
});

await test('an admin edit that re-verifies an active code resets reports; a typo fix elsewhere does not', async () => {
  await reset();
  for (let i = 1; i <= 3; i += 1) await vote(LIVE, 'failed', account(i), { now: Date.now() });
  const rows = (await listAdminCodes(db)).codes.find((c) => c.code === LIVE);
  // Notes-only edit: same status, same last-verified date -> reports stay.
  await saveCode(db, { ...rows, notes: 'Updated note only', originalCode: LIVE }, 'admin');
  assert.equal((await listAdminCodes(db)).codes.find((c) => c.code === LIVE).community.state, 'possibly_expired');
  // Admin sets a new last-verified date -> they checked it -> reset.
  await saveCode(db, { ...rows, lastVerified: '2026-10-01', originalCode: LIVE }, 'admin');
  const after = (await listAdminCodes(db)).codes.find((c) => c.code === LIVE);
  assert.equal(after.community.state, 'ok');
});

console.log(`Redeem community-vote tests passed (${passed} checks).`);
