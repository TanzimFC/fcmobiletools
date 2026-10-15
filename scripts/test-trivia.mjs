// Data-integrity checks for the Trivia section. Run: npm run test:trivia
import { SEASON_RECAP_QUESTIONS as ET } from '../src/data/seasonRecapTrivia.js';
import { buildNationQuestions } from '../src/lib/triviaNations.js';
import { fold, slugify, rank, highlight } from '../src/lib/triviaCore.js';
import { SETS, buildPools, toRound, poolFor, lengthOptions, pointsFor, gradeFor, readParams, shuffle, reshuffle } from '../src/lib/triviaPlay.js';
import { playUrl } from '../src/lib/triviaRoutes.js';

let failures = 0;
const warnings = [];
const ok = (cond, msg) => { if (!cond) { failures++; console.error('✗', msg); } };
const warn = (msg) => warnings.push(msg);

// ---- Extra Time / Season Recap
ok(ET.length > 200, `Season Recap should hold the full pool, got ${ET.length}`);
ok(new Set(ET.map((q) => q.slug)).size === ET.length, 'Season Recap slugs must be unique');
ok(new Set(ET.map((q) => fold(q.question))).size === ET.length, 'Season Recap questions must be unique');
for (const q of ET) {
  ok(q.answers.length > 0 && q.answers.every(Boolean), `empty answer: ${q.question}`);
  ok(/\?$/.test(q.question), `question should end with "?": ${q.question}`);
  ok(!/\b26\/27\b/.test(q.question.replace(/2026\/27/g, '')), `un-normalised season: ${q.question}`);
}

// ---- A Nation's Story
const ANS = buildNationQuestions();
ok(ANS.length > 0, 'no A Nation\'s Story questions');
ok(new Set(ANS.map((q) => q.url)).size === ANS.length, 'A Nation\'s Story URLs must be unique');
for (const q of ANS) {
  ok(q.options.length >= 2, `no options for ${q.id}`);
  ok(q.correctIndex >= 0, `cannot resolve the correct option for ${q.id}: "${q.answer}" vs [${q.options.join(' | ')}]`);
  if (q.correctIndex >= 0 && q.options[q.correctIndex] !== q.answer) warn(`${q.id}: answer "${q.answer}" matched option "${q.options[q.correctIndex]}"`);
  ok(q.slug.length > 8 && q.slug.length <= 110, `odd slug length for ${q.id}: ${q.slug}`);
  ok(q.url === `/trivia/a-nations-story/${q.nation}/${q.dayId}/#q-${q.index}`, `question should link to its grouped day anchor: ${q.id} -> ${q.url}`);
  ok(q.legacyUrl === `/trivia/a-nations-story/${q.nation}/${q.dayId}/${q.slug}/`, `legacy question URL should be preserved for redirect: ${q.id}`);
}

// ---- Search behaviour
const idx = ET.map((q) => ({ q: q.question, a: q.answer }));
ok(rank(idx, 'dzenan pejcinovic').length >= 2, 'accent-insensitive search failed');
ok(rank(idx, 'bayern munich').length > 3, 'alias search (Bayern Munich) failed');
ok(rank(idx, 'psg').length > 3, 'alias search (PSG) failed');
ok(rank(idx, 'haaland')[0]?.q.includes('Haaland'), 'Haaland should rank first');
ok(highlight('Dženan <b>', 'dzenan') === '<mark>Dženan</mark> &lt;b&gt;', 'highlight must be accent-insensitive and escaped');
ok(slugify('In which year did Japan make their first-ever FIFA World Cup appearance?').startsWith('in-which-year-did-japan'), 'slugify');


// ---- Play page logic (the same module the browser bundle uses)
const ETraw = ET.map((q) => ({ id: q.id, s: q.slug, q: q.question, a: q.answers, c: q.category, l: q.league, k: q.kind, f: q.family }));
const ANSraw = ANS.map((q) => ({ id: q.id, n: q.nation, nn: q.nationName, d: q.dayNumber, lv: q.level, q: q.question, a: q.answer, o: q.options, ci: q.correctIndex, u: q.url }));
const pools = buildPools(ETraw);
for (const q of ETraw) {
  for (let i = 0; i < 40; i++) {
    const r = toRound('season-recap', q, pools);
    ok(r.options.length === 2 && r.options[0] !== r.options[1], `Season Recap round must have 2 distinct options: ${q.q} -> ${r.options}`);
    ok(r.options.every((o) => o != null && o !== 'undefined' && o !== 'null'), `bad option text for ${q.q}`);
    ok(r.ci >= 0 && q.a.includes(r.options[r.ci]), `ci must point at a correct answer: ${q.q}`);
    ok(!q.a.includes(r.options[1 - r.ci]), `the generated wrong option must not be a valid answer: ${q.q} -> ${r.options[1 - r.ci]}`);
  }
}
for (const q of ANSraw) {
  const r = toRound('nations-story', q, null);
  ok(r.options[r.ci] != null && r.options.length >= 2, `nation round broken: ${q.id}`);
  ok(new Set(r.options).size === r.options.length, `duplicate options in ${q.id}: ${r.options.join(' | ')}`);
}
ok(poolFor('nations-story', ANSraw, { topic: 'japan', day: 'all' }).length === ANSraw.filter((q) => q.n === 'japan').length, 'nation filter');
ok(poolFor('nations-story', ANSraw, { topic: 'japan', day: '1' }).every((q) => q.n === 'japan' && q.d === 1), 'day filter');
ok(poolFor('season-recap', ETraw, { topic: 'all' }).length === ETraw.length, 'all topics filter');
ok(lengthOptions(SETS['nations-story'], 3).join() === '3', 'length options should collapse to the pool size');
ok(lengthOptions(SETS['season-recap'], 274).join() === '10,20,30,274', 'length options for the full pool');
ok(pointsFor({ mode: 'quiz' }) === 100, 'quiz points');
ok(pointsFor({ mode: 'attack', secsLeft: 12, secs: 12, streak: 1 }) === 200, 'attack max points (no streak)');
ok(pointsFor({ mode: 'attack', secsLeft: 0, secs: 12, streak: 3 }) === 120, 'attack streak bonus');
ok(gradeFor(95).title === 'Matchday legend' && gradeFor(10).title === 'Keep drilling', 'grades');
ok(shuffle([1, 2, 3, 4, 5]).sort().join() === '1,2,3,4,5', 'shuffle keeps every element');
{ const r0 = toRound('nations-story', ANSraw[0], null); const r1 = reshuffle(r0); ok(r1.options[r1.ci] === r0.options[r0.ci] && r1.options.length === r0.options.length, 'reshuffle keeps the correct option'); }
const rp = readParams('?nation=japan&day=3&mode=attack');
ok(rp.set === 'nations-story' && rp.topic === 'japan' && rp.day === '3' && rp.mode === 'attack', 'readParams infers the nations set');
ok(readParams('').set === 'season-recap' && readParams('?mode=nope').mode === 'quiz', 'readParams defaults');
ok(playUrl({ set: 'nations-story', nation: 'japan', day: 3 }) === '/trivia/play/?set=nations-story&nation=japan&day=3', 'playUrl');

console.log(`Extra Time: ${ET.length} questions · A Nation's Story: ${ANS.length} questions`);
if (warnings.length) { console.log(`\n${warnings.length} data warning(s):`); warnings.forEach((w) => console.log('  ⚠', w)); }
if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll trivia checks passed.');
