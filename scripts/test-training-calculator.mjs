import assert from 'node:assert/strict';
import { calculateTraining, calculateTransfer } from '../src/lib/fcMobileTraining.js';
import { MAX_TRAINING_LEVEL } from '../src/data/fcMobileTraining.js';

const first = calculateTraining({ currentLevel: 0, targetLevel: 1, fodderId: '47-59' });
assert.equal(first.valid, true);
assert.equal(first.requiredXP, 100);
assert.equal(first.cards, 1);
assert.equal(first.extraXP, 0);

const max = calculateTraining({ currentLevel: 0, targetLevel: MAX_TRAINING_LEVEL, fodderId: '95+' });
assert.equal(max.valid, true);
assert.equal(max.requiredXP, 160000);
assert.equal(max.cards, 160);
assert.equal(max.extraXP, 0);

const same = calculateTraining({ currentLevel: 8, targetLevel: 8, fodderId: '80-84' });
assert.equal(same.valid, true);
assert.equal(same.cards, 0);
assert.equal(same.requiredXP, 0);
assert.equal(calculateTraining({ currentLevel: 10, targetLevel: 9, fodderId: '90' }).valid, false);
assert.equal(calculateTraining({ currentLevel: 0, targetLevel: 31, fodderId: '90' }).valid, false);

const transfer = calculateTransfer(10);
assert.equal(transfer.valid, true);
assert.equal(transfer.sourceXP, 6000);
assert.equal(transfer.receivedXP, 5400);
assert.equal(transfer.lostXP, 600);
assert.equal(calculateTransfer(31).valid, false);
console.log('Training calculator checks passed.');
