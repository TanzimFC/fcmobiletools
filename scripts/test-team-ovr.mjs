import assert from 'node:assert/strict';
import { calculateTeamOVR, createEmptyBadges, createEmptyPlayers } from '../src/lib/teamOvr.js';

const players = (count, base = 117, rank = 0) => Array.from({ length: count }, () => ({ baseOVR: base, rank }));

assert.equal(calculateTeamOVR({ players: players(11, 117, 0), badges: [] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: [
  ...players(10, 116, 0), { baseOVR: 117, rank: 0 },
] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: players(11, 117, 1), badges: [] }).teamOVR, 118);
assert.equal(calculateTeamOVR({ players: [
  { baseOVR: 116, rank: 0 }, { baseOVR: 117, rank: 0 }, { baseOVR: 117, rank: 0 },
  ...players(8, 118, 0),
] }).baseAverage, 118);
assert.equal(calculateTeamOVR({ players: [...players(10, 117, 0), { baseOVR: 117, rank: 1 }], badges: [] }).rankAverage, 1);
assert.equal(calculateTeamOVR({ players: players(11, 118, 0), badges: [] }).teamOVR, 118);
for (let size = 12; size <= 18; size += 1) assert.equal(calculateTeamOVR({ players: players(size, 117, 0), badges: [] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), badges: [] }).badgeBonus, 0);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), badges: [{ id: 'numero', level: 5 }] }).teamOVR, 118);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), badges: [{ id: 'numero', level: 5 }, { id: 'champions', level: 5 }] }).teamOVR, 119);
assert.equal(calculateTeamOVR({ players: players(11, 117, 0), badges: [{ id: 'numero', level: 3 }] }).teamOVR, 117);
assert.equal(calculateTeamOVR({ players: players(10, 117, 5), badges: [] }).complete, false);
assert.equal(calculateTeamOVR({ players: players(11, 117, 5), badges: [] }).teamOVR, 122);
assert.equal(calculateTeamOVR({ players: players(19, 117, 0), badges: [] }).complete, false);

const resetPlayers = createEmptyPlayers();
const resetBadges = createEmptyBadges();
assert.equal(resetPlayers.length, 18);
assert.equal(resetPlayers.filter((p) => p.starter).length, 11);
assert.ok(resetPlayers.every((p) => p.baseOVR === ''));
assert.equal(resetBadges.length, 3);
assert.ok(resetBadges.every((b) => b.id === '' && b.level === 0));

console.log('Team OVR tests passed: 14 scenarios.');
