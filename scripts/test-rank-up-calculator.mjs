import assert from 'node:assert/strict';
import { calculateRankUp } from '../src/lib/rankUpCalculator.js';
import { getRankBracket } from '../src/data/rankUpCalculator.js';

const cases = [
  [110, 0, 5, 2100, 5, 5],
  [107, 4, 5, 600, 1, 1],
  [100, 0, 3, 600, 3, 3],
  [90, 2, 5, 720, 3, 3],
  [84, 0, 5, 300, 5, 5],
];

for (const [baseOVR, currentRank, targetRank, required, ovrGain, skillPoints] of cases) {
  const result = calculateRankUp({ baseOVR, currentRank, targetRank });
  assert.equal(result.valid, true);
  assert.equal(result.requiredPoints, required);
  assert.equal(result.ovrGain, ovrGain);
  assert.equal(result.skillPoints, skillPoints);
}

const boundaries = [
  [84, '0-84'], [85, '85-89'], [89, '85-89'], [90, '90-94'], [94, '90-94'],
  [95, '95-99'], [99, '95-99'], [100, '100-104'], [104, '100-104'],
  [105, '105-109'], [109, '105-109'], [110, '110+'],
];
for (const [ovr, bracket] of boundaries) assert.equal(getRankBracket(ovr).id, bracket);

const affordability = calculateRankUp({ baseOVR: 110, currentRank: 0, targetRank: 5, availablePoints: 1000 });
assert.equal(affordability.affordable, false);
assert.equal(affordability.remainingPoints, -1100);
assert.equal(affordability.maxAffordableRank, 3);

const partial = calculateRankUp({ baseOVR: 110, currentRank: 1, targetRank: 5 });
assert.equal(partial.requiredPoints, 1960);

const sameRank = calculateRankUp({ baseOVR: 107, currentRank: 5, targetRank: 5 });
assert.equal(sameRank.requiredPoints, 0);
assert.equal(sameRank.targetOVR, 112);

console.log('Rank Up Calculator tests passed.');
