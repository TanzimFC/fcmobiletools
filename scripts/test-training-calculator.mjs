import assert from 'node:assert/strict';
import { calculateTraining } from '../src/lib/trainingCalculator.js';

const a = calculateTraining({ currentLevel: 10, targetLevel: 30, fodderId: '60-69' });
assert.equal(a.requiredXP, 154000);
assert.equal(a.playersRequired, 1284);
assert.equal(a.xpProvided, 154080);
assert.equal(a.excessXP, 80);

const b = calculateTraining({ currentLevel: 0, targetLevel: 30, fodderId: '47-59' });
assert.equal(b.requiredXP, 160000);
assert.equal(b.playersRequired, 1600);

const c = calculateTraining({ currentLevel: 20, targetLevel: 25, fodderId: '75-79' });
assert.equal(c.requiredXP, 45000);
assert.equal(c.playersRequired, 225);

const cost = calculateTraining({ currentLevel: 10, targetLevel: 30, fodderId: '60-69', pricePerCard: 1000 });
assert.equal(cost.estimatedCost, 1284000);
assert.equal(cost.costPerXP, 1000 / 120);

const invalid = calculateTraining({ currentLevel: 20, targetLevel: 10, fodderId: '60-69' });
assert.equal(invalid.valid, false);

console.log('Training calculator tests passed.');
