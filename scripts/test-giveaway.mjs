import assert from 'node:assert/strict';
import {
  sha256Hex, randomSeed, entriesHash, rankEntries,
  generateClaimCode, isValidClaimCodeShape, normalizeClaimCode, canonicalClaimCode, maskName
} from '../src/lib/giveawayDraw.js';
import { banDaysForStrike, requirementsFor, DEFAULT_REQUIREMENTS, unlockedMilestones, BONUS_DEFAULTS } from '../src/data/giveawayConfig.js';

// sha256 known vector
assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

// determinism and order independence
const entries = Array.from({ length: 300 }, (_, i) => ({ id: 'e' + String(i).padStart(4, '0'), tickets: 1 + (i % 5) }));
const seed = 'a'.repeat(64);
const h1 = await entriesHash('g1', entries);
const h2 = await entriesHash('g1', [...entries].reverse());
assert.equal(h1, h2, 'entries hash must not depend on order');
assert.notEqual(h1, await entriesHash('g2', entries), 'giveaway id is part of the hash');
const r1 = await rankEntries(seed, h1, entries);
const r2 = await rankEntries(seed, h1, [...entries].reverse());
assert.deepEqual(r1, r2, 'ranking must not depend on input order');
assert.equal(r1.length, entries.length);
assert.equal(new Set(r1).size, entries.length, 'every entry appears exactly once');
assert.notDeepEqual(r1, await rankEntries('b'.repeat(64), h1, entries), 'a different seed changes the ranking');

// removing a disqualified entry must not reshuffle the others (reroll safety)
const without = entries.filter((e) => e.id !== r1[0]);
const rWithout = await rankEntries(seed, h1, without);
assert.deepEqual(rWithout, r1.slice(1), 'dropping the winner promotes the next entry in order');

// ticket weighting: a 6 ticket entry should win about 6 times as often as a 1 ticket entry
{
  const pool = [{ id: 'heavy', tickets: 6 }, ...Array.from({ length: 12 }, (_, i) => ({ id: 'l' + i, tickets: 1 }))];
  let heavy = 0; const runs = 1500;
  for (let i = 0; i < runs; i += 1) {
    const s = randomSeed();
    const rank = await rankEntries(s, await entriesHash('g', pool), pool);
    if (rank[0] === 'heavy') heavy += 1;
  }
  const expected = 6 / 18; // 33.3%
  const observed = heavy / runs;
  assert.ok(Math.abs(observed - expected) < 0.05, 'heavy entry share ' + observed.toFixed(3) + ' should be near ' + expected.toFixed(3));
}

// claim codes
for (let i = 0; i < 200; i += 1) {
  const code = generateClaimCode();
  assert.match(code, /^FCM-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
  assert.ok(isValidClaimCodeShape(code));
  assert.ok(isValidClaimCodeShape(code.toLowerCase().replace(/-/g, ' ')), 'lowercase and spaces are accepted');
  assert.equal(canonicalClaimCode(code.toLowerCase()), code);
}
const sample = generateClaimCode();
const body = normalizeClaimCode(sample);
const tampered = body.slice(0, 5) + (body[5] === '2' ? '3' : '2') + body.slice(6);
assert.equal(isValidClaimCodeShape(tampered), false, 'a single changed character is caught by the checksum');
assert.equal(isValidClaimCodeShape('FCM-1111-1111-1111'), false);
assert.equal(isValidClaimCodeShape(''), false);
assert.equal(new Set(Array.from({ length: 500 }, generateClaimCode)).size, 500, 'codes do not collide');

// masking never leaks a short name
assert.equal(maskName('ab'), '**');
assert.equal(maskName('abcd'), 'a***');
assert.equal(maskName('tanzimfc'), 'ta****fc');
assert.ok(!maskName('verylongusername123').includes('longuser'));

// ban ladder and milestones
assert.equal(banDaysForStrike(1), 14);
assert.equal(banDaysForStrike(2), 60);
assert.equal(banDaysForStrike(3), 180);
assert.equal(banDaysForStrike(4), null, 'fourth strike is permanent');
assert.equal(unlockedMilestones([{ entries: 100, label: 'A', bonus_winners: 1 }, { entries: 500, label: 'B', bonus_winners: 2 }], 150).bonusWinners, 1);
assert.equal(unlockedMilestones([{ entries: 100, label: 'A', bonus_winners: 1 }, { entries: 500, label: 'B', bonus_winners: 2 }], 600).bonusWinners, 3);
assert.equal(requirementsFor(null).length, DEFAULT_REQUIREMENTS.length, 'missing config falls back to defaults');
assert.deepEqual(BONUS_DEFAULTS, { daily: false, dailyCap: 0, referral: false, referralCap: 0 }, 'giveaways default to one entry with no boosts or referral entries');

console.log('Giveaway engine tests passed.');

// ───────────── draw stage plan ─────────────
{
  const { planStage, SPEEDS } = await import('../public/giveaway-stage/stage.js');
  const std = planStage({ speed: 'standard', winners: 3 });
  assert.deepEqual(std.steps.map((s) => s.id).slice(0, 7), ['prepare', 'seed', 'freeze', 'scan', 'shuffle', 'rank', 'countdown'], 'phases run in broadcast order');
  assert.equal(std.steps.filter((s) => s.id === 'reveal').length, 3, 'one reveal per winner');
  assert.equal(std.total, std.steps.reduce((n, s) => n + s.ms, 0));
  const quick = planStage({ speed: 'quick', winners: 3 });
  const epic = planStage({ speed: 'epic', winners: 3 });
  assert.ok(quick.total < std.total && std.total < epic.total, 'quick < standard < epic');
  assert.ok(epic.total > 150000 && epic.total < 260000, 'epic is about three minutes for a few winners');
  assert.ok(quick.total < 45000, 'quick stays under about 45 seconds');
  const many = planStage({ speed: 'standard', winners: 12 });
  const reveals = many.steps.filter((s) => s.id === 'reveal');
  assert.ok(reveals[11].ms < reveals[0].ms, 'late reveals are faster so big draws do not drag');
  assert.equal(planStage({ winners: 0 }).steps.filter((s) => s.id === 'reveal').length, 1, 'always at least one reveal');
  assert.ok(SPEEDS.quick < SPEEDS.standard && SPEEDS.standard < SPEEDS.epic);
}
console.log('draw stage plan ok');
