import assert from 'node:assert/strict';
import { createLocalStore, rankActive, pickTicket, KEYS } from '../src/scripts/redeem-local.js';

const DAY = 86_400_000;
let t = Date.parse('2026-10-28T10:00:00Z');
const clock = () => t;
const fakeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const make = (storage = fakeStorage()) => ({ storage, local: createLocalStore(storage, clock) });
let passed = 0;
const test = (name, fn) => { try { fn(); passed += 1; } catch (e) { console.error('FAILED:', name); throw e; } };

test('redeemed ticks persist, are case-insensitive and can be removed', () => {
  const { storage, local } = make();
  local.redeemed.set('abc123', true);
  assert.equal(local.redeemed.has('ABC123'), true);
  assert.equal(createLocalStore(storage, clock).redeemed.has('abc123'), true, 'survives a reload');
  local.redeemed.set('ABC123', false);
  assert.equal(local.redeemed.has('abc123'), false);
});

test('"new since last visit": first visit shows nothing, later visits show only unseen codes', () => {
  const { local } = make();
  assert.deepEqual(local.seen.diff(['A1', 'B2']), { firstVisit: true, fresh: [] });
  local.seen.commit(['A1', 'B2']);
  assert.deepEqual(local.seen.diff(['A1', 'B2']), { firstVisit: false, fresh: [] });
  assert.deepEqual(local.seen.diff(['C3', 'A1', 'D4']).fresh, ['C3', 'D4']);
});

test('a code I already ticked is never "new" for me', () => {
  const { local } = make();
  local.seen.commit(['A1']);
  local.redeemed.set('C3', true);
  assert.deepEqual(local.seen.diff(['A1', 'C3', 'D4']).fresh, ['D4']);
});

test('a bounced visit does not consume the badge: baseline only moves on commit', () => {
  const { local } = make();
  local.seen.commit(['A1']);
  assert.deepEqual(local.seen.diff(['A1', 'B2']).fresh, ['B2']);
  assert.deepEqual(local.seen.diff(['A1', 'B2']).fresh, ['B2'], 'no commit happened, still new');
  local.seen.commit(['A1', 'B2']);
  assert.deepEqual(local.seen.diff(['A1', 'B2']).fresh, []);
});

test('pruning keeps ticks for listed codes, drops old ghosts, caps size', () => {
  const { local } = make();
  local.redeemed.set('OLDGHOST', true);
  local.redeemed.set('LISTED', true);
  t += 100 * DAY;
  local.redeemed.prune(['LISTED']);
  assert.equal(local.redeemed.has('OLDGHOST'), false);
  assert.equal(local.redeemed.has('LISTED'), true);
  for (let i = 0; i < 450; i += 1) { t += 1000; local.redeemed.set('C' + i, true); }
  local.redeemed.prune(['C0']);
  assert.equal(local.redeemed.has('C449'), true, 'most recent survive the cap');
  assert.equal(local.redeemed.has('C1'), false, 'oldest dropped by the cap');
});

test('my vote shows as pressed until an admin re-check supersedes it', () => {
  const { local } = make();
  local.votes.set('A1', 'failed');
  assert.equal(local.votes.get('A1').v, 'failed');
  const adminAt = new Date(t + 60_000).toISOString();
  assert.equal(local.votes.get('A1', adminAt), null, 'admin re-checked after my vote');
  t += 120_000;
  local.votes.set('A1', 'worked');
  assert.equal(local.votes.get('A1', adminAt).v, 'worked');
  local.votes.set('A1', 'clear');
  assert.equal(local.votes.get('A1'), null);
});

test('server votes merge for a second device; the newer side wins', () => {
  const { local } = make();
  local.votes.set('A1', 'failed', t - 10_000);
  local.votes.merge({
    A1: { verdict: 'worked', at: new Date(t).toISOString() },
    B2: { verdict: 'failed', at: new Date(t - 5000).toISOString() },
    C3: { verdict: 'bogus', at: new Date(t).toISOString() },
  });
  assert.equal(local.votes.get('A1').v, 'worked');
  assert.equal(local.votes.get('B2').v, 'failed');
  assert.equal(local.votes.get('C3'), null);
});

test('"how did it go?" prompt: latest attempt wins, expires, and is not repeated', () => {
  const { local } = make();
  assert.equal(local.attempts.pending(), null);
  local.attempts.mark('A1');
  t += 60_000;
  local.attempts.mark('B2');
  assert.equal(local.attempts.pending().code, 'B2');
  local.attempts.asked('B2');
  assert.equal(local.attempts.pending().code, 'A1');
  local.attempts.asked('A1');
  assert.equal(local.attempts.pending(), null);
  local.attempts.mark('A1'); // copied again right away: still inside the 6h cooldown
  assert.equal(local.attempts.pending(), null);
  t += 7 * 3_600_000;
  local.attempts.mark('A1');
  assert.equal(local.attempts.pending().code, 'A1');
  t += 2 * 3_600_000; // came back far too late
  assert.equal(local.attempts.pending(), null);
});

test('blocked or full storage degrades to memory and never throws', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  const local = createLocalStore(broken, clock);
  local.redeemed.set('A1', true);
  assert.equal(local.redeemed.has('A1'), true);
  local.seen.commit(['A1']);
  assert.equal(local.seen.diff(['A1', 'B2']).fresh[0], 'B2');
  const none = createLocalStore(null, clock);
  none.votes.set('A1', 'worked');
  assert.equal(none.votes.get('A1').v, 'worked');
});

test('corrupt storage is ignored instead of crashing the page', () => {
  const storage = fakeStorage();
  storage.setItem(KEYS.redeemed, '{not json');
  storage.setItem(KEYS.seen, '[1,2');
  storage.setItem(KEYS.votes, '"str"');
  const local = createLocalStore(storage, clock);
  assert.equal(local.redeemed.has('A1'), false);
  assert.equal(local.seen.baseline(), null);
  assert.equal(local.votes.get('A1'), null);
});

test('device id is generated once, validated and stable', () => {
  const { storage, local } = make();
  const id = local.device.id(() => '11111111-2222-4333-8444-555555555555');
  assert.equal(id, '11111111-2222-4333-8444-555555555555');
  assert.equal(createLocalStore(storage, clock).device.id(() => 'zzzz'), id, 'existing id kept');
  assert.equal(make().local.device.id(() => 'not valid!'), '', 'bad generator output rejected');
});

test('ordering: healthy and untried first, redeemed next, reported-dead last; stable inside groups', () => {
  const codes = [
    { code: 'DEAD', community: { state: 'possibly_expired' } },
    { code: 'DONE' },
    { code: 'NEW1' },
    { code: 'NEW2', community: { state: 'review' } },
  ];
  const order = rankActive(codes, { isRedeemed: (c) => c === 'DONE' }).map((c) => c.code);
  assert.deepEqual(order, ['NEW1', 'NEW2', 'DONE', 'DEAD']);
});

test('hero ticket skips a code players report as dead, but never shows nothing', () => {
  assert.equal(pickTicket([{ code: 'DEAD', community: { state: 'possibly_expired' } }, { code: 'OK' }]).code, 'OK');
  assert.equal(pickTicket([{ code: 'DEAD', community: { state: 'possibly_expired' } }]).code, 'DEAD');
  assert.equal(pickTicket([]), null);
});

console.log(`Redeem local-state tests passed (${passed} checks).`);
