import assert from 'node:assert/strict';
import { calculateRankUp } from '../src/lib/fcMobileRankUp.js';

const rankTwo = calculateRankUp({ baseOVR: 110, currentRank: 0, targetRank: 2, availableRP: 400 });
assert.equal(rankTwo.valid, true);
assert.equal(rankTwo.requiredRP, 420);
assert.equal(rankTwo.targetOVR, 112);
assert.equal(rankTwo.affordable, false);
assert.equal(rankTwo.remainingRP, -20);

const affordable = calculateRankUp({ baseOVR: 100, currentRank: 0, targetRank: 2, availableRP: 300 });
assert.equal(affordable.valid, true);
assert.equal(affordable.requiredRP, 300);
assert.equal(affordable.affordable, true);

assert.equal(calculateRankUp({ baseOVR: 109, currentRank: 0, targetRank: 1 }).requiredRP, 120);
assert.equal(calculateRankUp({ baseOVR: 110, currentRank: 4, targetRank: 3 }).valid, false);
assert.equal(calculateRankUp({ baseOVR: 110, currentRank: 0, targetRank: 6 }).valid, false);
assert.equal(calculateRankUp({ baseOVR: -1, currentRank: 0, targetRank: 1 }).valid, false);
assert.equal(calculateRankUp({ baseOVR: 110, currentRank: 0, targetRank: 5, availableRP: -1 }).valid, false);
console.log('Rank Up calculator checks passed.');
