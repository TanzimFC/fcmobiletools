import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { PLAYSTYLES } from '../src/data/playstyles.js';
import {
  PLAYSTYLE_POSITIONS,
  PLAYSTYLE_POSITION_FIT,
  PLAYSTYLE_PROFILE,
  PLAYSTYLE_TRAITS,
  PLAYSTYLE_META,
  PLAYSTYLE_QUESTION_BANK,
  getPlaystyleQuestions,
  getPlaystyleRecommendations,
  scorePlaystyles,
  encodeBuild,
  decodeBuild,
  fitLabel
} from '../src/data/playstyleFinder.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const pageSource = await read('../src/pages/player/playstyle-finder.astro');
const cssSource = await read('../src/styles/playstyle-finder.css');
const scriptSource = await read('../src/scripts/playstyle-finder.js');
assert.ok(pageSource.includes('playstyle-finder.css') && pageSource.includes('playstyle-finder.js'), 'page should load its stylesheet and script');
assert.ok(cssSource.includes('prefers-reduced-motion: reduce'), 'finder must respect reduced-motion preferences');
assert.ok(cssSource.includes('@keyframes'), 'finder should keep its premium animations');
assert.ok(scriptSource.includes('fcmobiletools:tool-activity'), 'finder should keep reporting tool activity');

const styleNames = new Set(PLAYSTYLES.map((style) => style.name));
const positionCodes = PLAYSTYLE_POSITIONS.map((position) => position.code);
assert.equal(new Set(positionCodes).size, positionCodes.length, 'position codes must be unique');
assert.ok(!positionCodes.includes('CF'), 'CF is no longer an in-game position');

// Every PlayStyle has a profile that points at known traits.
for (const style of PLAYSTYLES) {
  const profile = PLAYSTYLE_PROFILE[style.name];
  assert.ok(profile, style.name + ' needs a trait profile');
  assert.ok(profile.altNote && profile.role && profile.family, style.name + ' needs pairing copy');
  assert.ok(PLAYSTYLE_POSITION_FIT[style.name]?.length, style.name + ' needs position-fit guidance');
  assert.equal(style.levels.length, 3, style.name + ' should describe all 3 levels');
  for (const trait of Object.keys(profile.traits)) assert.ok(PLAYSTYLE_TRAITS[trait], style.name + ' uses unknown trait ' + trait);
  const tiers = style.noBaseIcon ? [1, 2] : [0, 1, 2];
  for (const tier of tiers) await access('assets/images/playstyle/playstyle_64_PLAYSTYLE_' + style.icon + '_' + tier + '.png');
}
for (const [trait, info] of Object.entries(PLAYSTYLE_TRAITS)) assert.ok(info.adjective && info.tagline && info.axis, trait + ' needs archetype copy');
for (const meta of Object.values(PLAYSTYLE_META)) for (const name of meta.picks) assert.ok(styleNames.has(name), 'meta names unknown PlayStyle ' + name);

// Question banks.
for (const [group, questions] of Object.entries(PLAYSTYLE_QUESTION_BANK)) {
  assert.ok(questions.length >= 3, group + ' needs enough questions');
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length, group + ' question ids must be unique');
  for (const question of questions) {
    assert.ok(question.prompt && question.kicker, 'question needs copy');
    assert.equal(new Set(question.options.map((o) => o.id)).size, question.options.length, 'option ids must be unique in ' + question.id);
    for (const option of question.options) {
      assert.ok(option.label && option.because, 'option needs label and evidence copy');
      for (const trait of Object.keys(option.traits)) assert.ok(PLAYSTYLE_TRAITS[trait], 'option uses unknown trait ' + trait);
    }
  }
}

// Walk every answer combination for every position.
const reached = new Set();
for (const position of PLAYSTYLE_POSITIONS) {
  const questions = getPlaystyleQuestions(position.code);
  assert.ok(questions.length >= 3, position.code + ' needs questions');
  questions.forEach((q) => assert.ok(q.options.length >= 3, position.code + '/' + q.id + ' needs 3+ options'));
  const expected = position.code === 'GK' ? 1 : 2;
  const walk = (index, answers) => {
    if (index === questions.length) {
      const picks = getPlaystyleRecommendations({ position: position.code, answers });
      assert.equal(picks.length, expected, position.code + ' should return ' + expected + ' PlayStyle(s)');
      if (expected === 2) assert.notEqual(picks[0].name, picks[1].name, 'picks must be distinct');
      const full = scorePlaystyles(position.code, answers);
      assert.ok(full.alternates.length >= (position.code === 'GK' ? 1 : 2), position.code + ' should always offer runner-ups');
      assert.ok(full.alternates.every((alt) => !picks.some((pick) => pick.name === alt.name)), 'runner-ups must differ from picks');
      picks.forEach((pick) => {
        reached.add(pick.name);
        assert.ok(styleNames.has(pick.name));
        assert.ok(pick.fit >= 0 && pick.fit <= 98, 'fit must be a sane percentage');
        assert.ok(pick.evidence.length > 0, 'every pick needs evidence');
        if (position.code === 'GK') assert.equal(pick.category, 'Goalkeeper');
        else assert.notEqual(pick.category, 'Goalkeeper');
      });
      const round = decodeBuild(encodeBuild(position.code, answers));
      assert.deepEqual(round, { position: position.code, answers }, 'share links must round-trip');
      return;
    }
    for (const option of questions[index].options) walk(index + 1, { ...answers, [questions[index].id]: option.id });
  };
  walk(0, {});
}
for (const style of PLAYSTYLES) assert.ok(reached.has(style.name), style.name + ' must be reachable by some answers');

// Behavioural spot checks: the engine infers, it does not echo.
const cb = (a) => scorePlaystyles('CB', a).picks.map((p) => p.name);
assert.equal(cb({ duel: 'a', air: 'c', cover: 'd', build: 'b', pain: 'b' })[0], 'Anticipate', 'patient reader CB should get Anticipate');
assert.equal(cb({ duel: 'b', air: 'a', cover: 'c', build: 'd', pain: 'a' })[0], 'Guardian', 'aggressive CB should get Guardian');
assert.ok(cb({ duel: 'c', air: 'b', cover: 'a', build: 'd', pain: 'a' }).includes('Bruiser'), 'physical CB should get Bruiser');
assert.equal(scorePlaystyles('GK', { rebound: 'c', oneonone: 'a', pain: 'b' }).picks[0].name, 'Super Rush');
assert.equal(scorePlaystyles('GK', { rebound: 'a', oneonone: 'b', pain: 'a' }).picks[0].name, 'Deflector');
const partial = scorePlaystyles('ST', { shot: 'b' });
assert.equal(partial.complete, false);
assert.equal(partial.ranked[0].name, 'Finesse Shot', 'live preview should lean on partial answers');
assert.equal(scorePlaystyles('XX', {}), null);
assert.deepEqual(getPlaystyleRecommendations({ position: 'CB', answers: {} }), [], 'incomplete answers give no final result');
assert.equal(decodeBuild('CB.zzzzz'), null);
assert.equal(decodeBuild('nope'), null);
assert.equal(fitLabel(90), 'Excellent match');

console.log('PlayStyle Finder checks passed: scenario engine, trait profiles, reachability of all PlayStyles, pairing, share links and live scoring.');
