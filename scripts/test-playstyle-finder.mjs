import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { PLAYSTYLES } from '../src/data/playstyles.js';
import {
  PLAYSTYLE_POSITIONS,
  PLAYSTYLE_POSITION_FIT,
  PLAYSTYLE_GOALS,
  PLAYSTYLE_PROFILES,
  getPlaystyleGoalsForPosition,
  getPlaystyleProfileChoices,
  getPlaystyleRecommendations
} from '../src/data/playstyleFinder.js';

const styleNames = new Set(PLAYSTYLES.map((style) => style.name));
const positionCodes = PLAYSTYLE_POSITIONS.map((position) => position.code);
const goalIds = PLAYSTYLE_GOALS.map((goal) => goal.id);

assert.equal(new Set(positionCodes).size, positionCodes.length, 'position codes must be unique');
assert.equal(new Set(goalIds).size, goalIds.length, 'goal ids must be unique');
assert.ok(positionCodes.includes('CB') && positionCodes.includes('GK'), 'survey needs defenders and goalkeeper');
assert.ok(!positionCodes.includes('CF'), 'CF is no longer an available in-game position');
for (const goal of PLAYSTYLE_GOALS) {
  assert.ok(goal.label && goal.hint && goal.positionCodes.length && goal.styleNames.length, 'each goal needs copy, positions and matches');
  for (const code of goal.positionCodes) {
    assert.ok(positionCodes.includes(code), 'goal uses unknown position: ' + code);
    assert.ok(goal.styleNames.some((name) => (PLAYSTYLE_POSITION_FIT[name] || []).includes(code)), 'goal needs a position-suitable direct match: ' + goal.id + ' / ' + code);
  }
  for (const name of goal.styleNames) assert.ok(styleNames.has(name), 'goal points to missing PlayStyle: ' + name);
}
for (const [group, profiles] of Object.entries(PLAYSTYLE_PROFILES)) {
  assert.ok(profiles.length >= 2, group + ' needs at least two player profiles');
  assert.equal(new Set(profiles.map((profile) => profile.id)).size, profiles.length, group + ' profile ids must be unique');
  for (const profile of profiles) {
    assert.ok(profile.label && profile.hint && profile.styleNames.length, 'each profile needs clear copy and style matches');
    for (const name of profile.styleNames) assert.ok(styleNames.has(name), 'profile points to missing PlayStyle: ' + name);
  }
}

for (const position of PLAYSTYLE_POSITIONS) {
  const goals = getPlaystyleGoalsForPosition(position.code);
  const profiles = getPlaystyleProfileChoices(position.code);
  assert.ok(goals.length >= 2, position.code + ' needs enough relevant job choices');
  assert.ok(profiles.length >= 2, position.code + ' needs enough player-type choices');
  for (const goal of goals) {
    for (const profile of profiles) {
      const recommendations = getPlaystyleRecommendations({
        position: position.code,
        goalId: goal.id,
        profileId: profile.id
      });
      const expectedCount = position.code === 'GK' ? 1 : 2;
      assert.equal(recommendations.length, expectedCount, position.code + ' should return the correct number of recommendations');
      assert.notEqual(recommendations[0].name, recommendations[1].name, 'recommendations must be distinct');
      assert.ok(recommendations.every((style) => styleNames.has(style.name)), 'recommendations must use guide data');
      assert.ok(recommendations.some((style) => goal.styleNames.includes(style.name)), position.code + ' should honour the selected main job');
      if (position.code === 'GK') {
        assert.ok(recommendations.every((style) => style.category === 'Goalkeeper'), 'goalkeeper results must stay in the goalkeeper category');
      }
      if (goal.id === 'standing-tackles' && position.code === 'CB') {
        assert.equal(recommendations[0].name, 'Anticipate', 'standing tackles at centre-back should favour Anticipate');
      }
    }
  }
}

for (const style of PLAYSTYLES) {
  assert.ok(PLAYSTYLE_GOALS.some((goal) => goal.styleNames.includes(style.name)), style.name + ' needs at least one survey goal');
  assert.ok(PLAYSTYLE_POSITION_FIT[style.name]?.length, style.name + ' needs position-fit guidance');
  assert.equal(style.levels.length, 3, style.name + ' should describe all 3 levels');
  const tierFiles = style.noBaseIcon ? [1, 2] : [0, 1, 2];
  for (const tier of tierFiles) {
    const icon = 'assets/images/playstyle/playstyle_64_PLAYSTYLE_' + style.icon + '_' + tier + '.png';
    await access(icon);
  }
}

assert.deepEqual(getPlaystyleRecommendations({ position: 'INVALID', goalId: 'standing-tackles', profileId: 'read-defend' }), []);
assert.equal(getPlaystyleRecommendations({ position: 'GK', goalId: 'keeper-rush', profileId: 'sweeper' }).length, 1, 'goalkeepers should get one PlayStyle only');
assert.deepEqual(getPlaystyleRecommendations({ position: 'CB', goalId: 'not-a-goal', profileId: 'read-defend' }), []);
console.log('PlayStyle Finder checks passed: current positions, role survey, goalkeeper single-style rule, scoring, levels and local icons.');
