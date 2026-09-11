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
} from '../src/lib/teamOvr.js';

const players = (count, base = 117, rank = 0) => Array.from({ length: count }, (_, i) => ({ id: i + 1, baseOVR: base, rank }));
const badges = (...items) => items.map(([badgeId, level]) => ({ badgeId, level }));

assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: [] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: [...players(10, 116, 0), { baseOVR: 117, rank: 0 }], selectedBadges: [] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: players(11, 117, 1), selectedBadges: [] }).teamOVR, 118);
assert.equal(calculateTeamOVR({ players: [{ baseOVR: 116, rank: 0 }, { baseOVR: 117, rank: 0 }, { baseOVR: 117, rank: 0 }, ...players(8, 118, 0)], selectedBadges: [] }).baseAverage, 118);
assert.equal(calculateTeamOVR({ players: [...players(10, 117, 0), { baseOVR: 117, rank: 1 }], selectedBadges: [] }).rankAverage, 1);
for (let size = 11; size <= MAX_SQUAD_SIZE; size += 1) assert.equal(calculateTeamOVR({ players: players(size, 117, 0), selectedBadges: [] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: [] }).badgeBonus, 0);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: badges(['numero', 5]) }).teamOVR, 118);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: badges(['numero', 5], ['champions', 5]) }).teamOVR, 119);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: badges(['numero', 3]) }).teamOVR, 117);
assert.equal(calculateBadgeBonus(badges(['numero', 5], ['champions', 5], ['unknown', 5], ['numero', 5])).badgeBonus, 2);
assert.equal(getBadgeTeamOVRBonus('numero', 5), 1);
assert.equal(getBadgeTeamOVRBonus('numero', 3), 0);
assert.equal(calculateTeamOVR({ players: players(10, 117, 5), selectedBadges: [] }).complete, false);
assert.equal(calculateTeamOVR({ players: players(11, 117, 5), selectedBadges: [] }).teamOVR, 122);
assert.equal(calculateTeamOVR({ players: players(19, 117, 0), selectedBadges: [] }).complete, false);
assert.equal(calculateTeamOVR({ players: players(11, BASE_OVR_MIN, 0), selectedBadges: [] }).complete, true);
assert.equal(calculateTeamOVR({ players: players(11, BASE_OVR_MAX, 0), selectedBadges: [] }).complete, true);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), selectedBadges: [], requiredCount: 12 }).complete, false);
assert.equal(isPlayerFilled({ baseOVR: 117, rank: 0 }), true);
assert.equal(isPlayerFilled({ baseOVR: 117, rank: null }), false);
assert.equal(RANK_OPTIONS.join(','), '0,1,2,3,4,5');

console.log('Team OVR tests passed: 20 scenarios.');
