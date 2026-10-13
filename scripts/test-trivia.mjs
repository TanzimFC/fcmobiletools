// Data-integrity checks for the Trivia section. Run: npm run test:trivia
import { SEASON_RECAP_QUESTIONS as ET } from '../src/data/seasonRecapTrivia.js';
import { buildNationQuestions } from '../src/lib/triviaNations.js';
import { fold, slugify, rank, highlight } from '../src/lib/triviaCore.js';

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
  ok(q.related.length > 0, `no related questions for ${q.id}`);
}

// ---- Search behaviour
const idx = ET.map((q) => ({ q: q.question, a: q.answer }));
ok(rank(idx, 'dzenan pejcinovic').length >= 2, 'accent-insensitive search failed');
ok(rank(idx, 'bayern munich').length > 3, 'alias search (Bayern Munich) failed');
ok(rank(idx, 'psg').length > 3, 'alias search (PSG) failed');
ok(rank(idx, 'haaland')[0]?.q.includes('Haaland'), 'Haaland should rank first');
ok(highlight('Dženan <b>', 'dzenan') === '<mark>Dženan</mark> &lt;b&gt;', 'highlight must be accent-insensitive and escaped');
ok(slugify('In which year did Japan make their first-ever FIFA World Cup appearance?').startsWith('in-which-year-did-japan'), 'slugify');

console.log(`Extra Time: ${ET.length} questions · A Nation's Story: ${ANS.length} questions`);
if (warnings.length) { console.log(`\n${warnings.length} data warning(s):`); warnings.forEach((w) => console.log('  ⚠', w)); }
if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll trivia checks passed.');
