import assert from 'node:assert/strict';
import {
  BASE_OVR_MIN,
  BASE_OVR_MAX,
  MAX_SQUAD_SIZE,
  RANK_OPTIONS,
  calculateBadgeBonus,
  calculateTeamOVR,
  getBadgeTeamOVRBonus,
  isPlayerFilled,
  FORMATIONS,
  MAX_TEAM_OVR,
  STARTING_XI_SIZE,
  deserializeSquad,
  findWeakest,
  nextOvrOptions,
  ovrTier,
  parseQuickFill,
  planUpgrade,
  serializeSquad,
  summarizeSquad,
} from '../src/lib/teamOvr.js';

const players = (count, base = 117, rank = 0) => Array.from({ length: count }, (_, i) => ({ id: i + 1, baseOVR: base, rank }));
const ticks = (...enabled) => enabled.map((value) => ({ enabled: value }));

assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: [] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: [...players(10, 116, 0), { baseOVR: 117, rank: 0 }], selectedBadges: [] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: players(11, 117, 1), selectedBadges: [] }).teamOVR, 118);
assert.equal(calculateTeamOVR({ players: [{ baseOVR: 116, rank: 0 }, { baseOVR: 117, rank: 0 }, { baseOVR: 117, rank: 0 }, ...players(8, 118, 0)], selectedBadges: [] }).baseAverage, 118);
assert.equal(calculateTeamOVR({ players: [...players(10, 117, 0), { baseOVR: 117, rank: 1 }], selectedBadges: [] }).rankAverage, 1);
for (let size = 11; size <= MAX_SQUAD_SIZE; size += 1) assert.equal(calculateTeamOVR({ players: players(size, 117, 0), selectedBadges: [] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: [] }).badgeBonus, 0);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: ticks(true) }).teamOVR, 118);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: ticks(true, true) }).teamOVR, 119);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: ticks(true, true, true) }).teamOVR, 120);
assert.equal(calculateBadgeBonus(ticks(true, true, true, true)).badgeBonus, 3);
assert.equal(getBadgeTeamOVRBonus('badge-1', true), 1);
assert.equal(getBadgeTeamOVRBonus('badge-1', false), 0);
assert.equal(calculateTeamOVR({ players: players(10, 117, 5), selectedBadges: [] }).complete, false);
assert.equal(calculateTeamOVR({ players: players(11, 117, 5), selectedBadges: [] }).teamOVR, 122);
assert.equal(calculateTeamOVR({ players: players(19, 117, 0), selectedBadges: [] }).complete, false);
assert.equal(calculateTeamOVR({ players: players(11, BASE_OVR_MIN, 0), selectedBadges: [] }).complete, true);
assert.equal(calculateTeamOVR({ players: players(11, BASE_OVR_MAX, 0), selectedBadges: [] }).complete, true);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: [], requiredCount: 12 }).complete, false);
assert.equal(isPlayerFilled({ baseOVR: 117, rank: 0 }), true);
assert.equal(isPlayerFilled({ baseOVR: 117, rank: null }), false);
assert.equal(RANK_OPTIONS.join(','), '0,1,2,3,4,5');
assert.equal(BASE_OVR_MAX, 130);



/* ---------------- v2: summary, planner, sharing ---------------- */
let v2 = 0;
const check = (fn) => { fn(); v2 += 1; };
const slots = (count, base = 117, rank = 0) => Array.from({ length: count }, () => ({ baseOVR: base, rank }));
const empty = (count) => Array.from({ length: count }, () => ({ baseOVR: null, rank: 0 }));

check(() => assert.equal(summarizeSquad({ starters: empty(11), bench: empty(7) }).state, 'empty'));
check(() => {
  const s = summarizeSquad({ starters: [...slots(3, 110), ...empty(8)], bench: empty(7) });
  assert.equal(s.state, 'estimate');
  assert.equal(s.teamOVR, 110);
  assert.equal(s.exact, false);
});
// Empty starter slots must not dilute the Rank average (old behaviour averaged rank over unfilled slots).
check(() => {
  const starters = [{ baseOVR: 117, rank: 5 }, ...empty(10)];
  assert.equal(summarizeSquad({ starters, bench: empty(7) }).rankAverage, 5);
});
check(() => assert.equal(summarizeSquad({ starters: slots(11), bench: empty(7), badges: [true, true, false] }).teamOVR, 119));
// Summary agrees with the original calculateTeamOVR for exact squads of every size.
check(() => {
  for (let bench = 0; bench <= 7; bench += 1) {
    const starters = slots(11, 115, 1).map((p, i) => ({ ...p, baseOVR: 108 + (i % 5) * 3 }));
    const subs = Array.from({ length: bench }, (_, i) => ({ baseOVR: 95 + i * 4, rank: i % 3 }));
    const badges = [true, false, true];
    const a = summarizeSquad({ starters, bench: [...subs, ...empty(7 - bench)], badges });
    const b = calculateTeamOVR({ players: [...starters, ...subs], selectedBadges: badges.map((enabled) => ({ enabled })) });
    assert.equal(a.exact, true);
    assert.equal(a.teamOVR, b.teamOVR);
  }
});
check(() => assert.equal(summarizeSquad({ starters: [...slots(10), { baseOVR: 39, rank: 0 }], bench: [] }).exact, false));
check(() => assert.equal(ovrTier(125) + ovrTier(112) + ovrTier(101) + ovrTier(80) + ovrTier(null), 'goldcyanmintslateempty'));

// Next OVR: 11 x 117 = exactly 117 -> needs 1 Base point (117*11+1 = 1288 total) or 1 Rank step.
check(() => {
  const next = nextOvrOptions(summarizeSquad({ starters: slots(11, 117, 0), bench: empty(7) }));
  assert.deepEqual([next.target, next.baseSteps, next.rankSteps], [118, 1, 1]);
});
check(() => {
  // total base 1286 over 11 -> avg 116.9 -> shows 117; needs 2 points to show 118.
  const starters = [...slots(10, 117), { baseOVR: 116, rank: 0 }];
  assert.equal(nextOvrOptions(summarizeSquad({ starters, bench: empty(7) })).baseSteps, 2);
});
check(() => assert.equal(nextOvrOptions(summarizeSquad({ starters: slots(11, 130, 5), bench: [] })).reachable, false));

// Planner basics.
const squad = (list, badges = []) => summarizeSquad({ starters: list, bench: empty(7), badges });
check(() => assert.equal(planUpgrade({ players: squad(empty(11)).players, target: 120 }).status, 'incomplete'));
check(() => assert.equal(planUpgrade({ players: squad(slots(11, 117, 3)).players, target: 120 }).status, 'reached'));
check(() => assert.equal(planUpgrade({ players: squad(slots(11, 117, 0)).players, target: MAX_TEAM_OVR + 1 }).status, 'unreachable'));
check(() => assert.equal(planUpgrade({ players: squad(slots(11, 130, 5)).players, target: 136 }).status, 'unreachable'));
check(() => {
  const plan = planUpgrade({ players: squad(slots(11, 117, 0)).players, target: 118 });
  assert.equal(plan.status, 'ok');
  assert.equal(plan.routes[0].total, 1);
  assert.equal(plan.routes.length, 2); // base-only and rank-only; mixed is never cheaper for +1
});
// Mixed route only appears when it genuinely beats both pure routes.
check(() => {
  const players = squad(slots(11, 117, 0)).players;
  const plan = planUpgrade({ players, target: 119 });
  assert.equal(plan.routes[0].total, 2);
  assert.equal(plan.routes.some((route) => route.kind === 'mixed'), true);
});

// Property test: every route reaches the target, and no cheaper (base, rank) pair exists.
let seed = 20260929;
const rand = (max) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return Math.floor((seed / 4294967296) * max); };
const apply = (players, route) => players.map((player) => ({
  ...player,
  baseOVR: route.baseChanges.find((c) => c.key === player.key)?.to ?? player.baseOVR,
  rank: route.rankChanges.find((c) => c.key === player.key)?.to ?? player.rank,
}));
const bruteMin = (players, badgeBonus, target) => {
  const n = players.length;
  const totalBase = players.reduce((s, p) => s + p.baseOVR, 0);
  const totalRank = players.reduce((s, p) => s + p.rank, 0);
  const baseCap = players.reduce((s, p) => s + 130 - p.baseOVR, 0);
  const rankCap = players.reduce((s, p) => s + 5 - p.rank, 0);
  let best = Infinity;
  for (let db = 0; db <= baseCap; db += 1) for (let dr = 0; dr <= rankCap; dr += 1) {
    if (Math.ceil((totalBase + db) / n) + Math.ceil((totalRank + dr) / n) + badgeBonus >= target) best = Math.min(best, db + dr);
  }
  return best;
};
check(() => {
  for (let run = 0; run < 150; run += 1) {
    const n = 11 + rand(8);
    const list = Array.from({ length: n }, () => ({ baseOVR: 100 + rand(31), rank: rand(6) }));
    const badges = [rand(2) === 1, rand(2) === 1, rand(2) === 1];
    const summary = summarizeSquad({ starters: list.slice(0, 11), bench: [...list.slice(11), ...empty(18 - n)], badges });
    const target = summary.teamOVR + 1 + rand(6);
    const plan = planUpgrade({ players: summary.players, badgeBonus: summary.badgeBonus, target });
    const expected = bruteMin(summary.players, summary.badgeBonus, target);
    if (expected === Infinity) { assert.equal(plan.status, 'unreachable'); continue; }
    assert.equal(plan.status, 'ok');
    assert.equal(plan.routes[0].total, expected, `cheapest route should be optimal (run ${run})`);
    plan.routes.forEach((route) => {
      const after = summarizeSquad({
        starters: apply(summary.players, route).filter((p) => p.key.startsWith('starter:')),
        bench: apply(summary.players, route).filter((p) => p.key.startsWith('bench:')),
        badges,
      });
      assert.ok(after.teamOVR >= target, `route ${route.kind} must reach the target (run ${run})`);
      assert.equal(route.baseChanges.reduce((s, c) => s + c.to - c.from, 0), route.baseSteps);
      assert.equal(route.rankChanges.reduce((s, c) => s + c.to - c.from, 0), route.rankSteps);
      route.baseChanges.forEach((c) => assert.ok(c.to <= 130 && c.to > c.from));
      route.rankChanges.forEach((c) => assert.ok(c.to <= 5 && c.to > c.from));
    });
  }
});

check(() => assert.deepEqual(findWeakest([{ baseOVR: 120 }, { baseOVR: 99 }, { baseOVR: 105 }, { baseOVR: 99 }], 2).map((p) => p.baseOVR), [99, 99]));

// Quick fill parsing.
check(() => assert.deepEqual(parseQuickFill('117, 116/2\n118:5').entries, [{ baseOVR: 117, rank: 0 }, { baseOVR: 116, rank: 2 }, { baseOVR: 118, rank: 5 }]));
check(() => assert.deepEqual(parseQuickFill('117 abc 12 140 118/9').invalid, ['abc', '12', '140', '118/9']));
check(() => assert.equal(parseQuickFill(Array(20).fill('110').join(' ')).overflow, 2));
check(() => assert.equal(parseQuickFill('').entries.length, 0));

// Share links round-trip and reject garbage.
check(() => {
  const state = { formation: '352', starters: [{ baseOVR: 117, rank: 2 }, ...empty(10)], bench: [{ baseOVR: 99, rank: 0 }, ...empty(6)], badges: [true, false, true] };
  const text = serializeSquad(state);
  assert.match(text, /^[0-9a-z~,]+$/);
  assert.deepEqual(deserializeSquad(text), state);
});
check(() => assert.equal(deserializeSquad('nonsense'), null));
check(() => assert.equal(deserializeSquad('1~433~117r0~~101'), null));
check(() => assert.equal(deserializeSquad(`1~433~${Array(11).fill('999r9').join(',')}~${Array(7).fill('').join(',')}~101`).starters[0].baseOVR, null));
check(() => assert.equal(deserializeSquad(serializeSquad({ formation: 'bogus' })).formation, '433'));

// Formations: 11 slots each, one GK, all coordinates on the pitch.
check(() => FORMATIONS.forEach((f) => {
  assert.equal(f.slots.length, STARTING_XI_SIZE);
  assert.equal(f.slots.filter((s) => s.pos === 'GK').length, 1);
  f.slots.forEach((s) => assert.ok(s.x >= 6 && s.x <= 94 && s.y >= 8 && s.y <= 94));
}));

console.log(`Team OVR tests passed: 21 original scenarios + ${v2} v2 scenarios.`);
