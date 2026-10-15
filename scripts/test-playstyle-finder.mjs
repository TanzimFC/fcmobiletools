import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { PLAYSTYLES } from '../src/data/playstyles.js';
import {
  PLAYSTYLE_GOALS,
  PLAYSTYLE_GOAL_GROUPS,
  getPlaystyleRecommendations
} from '../src/data/playstyleFinder.js';

const names = new Set(PLAYSTYLES.map((style) => style.name));
const goalIds = PLAYSTYLE_GOALS.map((goal) => goal.id);
assert.equal(new Set(goalIds).size, goalIds.length, 'goal ids must be unique');
assert.equal(PLAYSTYLE_GOAL_GROUPS.length >= 5, true, 'goals should be grouped by player action');
for (const goal of PLAYSTYLE_GOALS) {
  assert.ok(goal.label && goal.hint && goal.styleNames.length, 'each goal needs a clear label, hint and match');
  for (const name of goal.styleNames) assert.ok(names.has(name), 'goal points to missing PlayStyle: ' + name);
}
assert.equal(getPlaystyleRecommendations([]).length, 0);
assert.equal(getPlaystyleRecommendations(['not-a-goal']).length, 0);
assert.deepEqual(getPlaystyleRecommendations(['sprint-dribble']).map((style) => style.name), ['Rapid']);
assert.deepEqual(getPlaystyleRecommendations(['quick-passes']).map((style) => style.name), ['Bullet Pass', 'Tiki Taka']);
assert.deepEqual(getPlaystyleRecommendations(['crosses', 'headers']).map((style) => style.name), ['Precision Header', 'Whipped Crosser']);
for (const style of PLAYSTYLES) {
  assert.equal(style.levels.length, 3, style.name + ' should describe all 3 levels');
  const tierFiles = style.noBaseIcon ? [1, 2] : [0, 1, 2];
  for (const tier of tierFiles) {
    const icon = 'assets/images/playstyle/playstyle_64_PLAYSTYLE_' + style.icon + '_' + tier + '.png';
    await access(icon);
  }
}
console.log('PlayStyle Finder checks passed: goals, matches, level descriptions and local icons.');
