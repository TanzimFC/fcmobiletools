// Turns the raw "Question :: Answer / Answer" lines into clean question objects.
import { fold, slugify, haystack } from './triviaCore.js';

export const CATEGORIES = [
  'Transfers 2026/27',
  'Goals',
  'Hat-tricks',
  'Goalkeepers',
  'Awards',
  'Title winners',
  'Records & runs',
  'European qualification'
];

export const LEAGUES = ['Premier League', 'LaLiga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Europe', 'Other'];

// Names the game prints with accents (confirmed on the SportsDunia list). The
// other source strips them; we show the accented form and search ignores accents.
const NAME_FIXES = [
  ['Dzenan Pejcinovic', 'Dženan Pejčinović'],
  ['Pavel Sulc', 'Pavel Šulc'],
  ['Arda Guler', 'Arda Güler'],
  ['Kylian Mbappe', 'Kylian Mbappé'],
  ['Leo Roman', 'Leo Román']
];

// Source typos / wording differences we normalise so duplicates merge.
const REWRITES = [
  [/\bfor or more goals\b/g, 'four or more goals'],
  [/\bahead of the 26\/27 season\b/g, 'ahead of the 2026/27 season'],
  [/\bSerie A club signed\b/g, 'Serie A team signed'],
  [
    /How many goals did Dominic Calvert-Lewin score in the 2025\/26 season\?/,
    'How many goals did Dominic Calvert-Lewin score in the 2025/26 Premier League season?'
  ]
];

function clean(text) {
  let out = text.trim();
  for (const [re, to] of REWRITES) out = out.replace(re, to);
  for (const [from, to] of NAME_FIXES) out = out.split(from).join(to);
  return out;
}

function classify(q) {
  if (/UEFA (Champions|Europa|Conference) League/.test(q) && /(qualified|compete)/.test(q)) return 'European qualification';
  if (/\bsigned\b.*ahead of/.test(q)) return 'Transfers 2026/27';
  if (/\bwon the .* title\b/.test(q)) return 'Title winners';
  if (/hat-trick|four or more goals/.test(q)) return 'Hat-tricks';
  if (/(Player of the (Month|Season)|Save of the Season|Goal of the Season|Coach of the Season|Manager of the Season|Young Player|Rookie|Playmaker|Rising Star|Most Valuable Player|Goalkeeper of the Season)/.test(q)) return 'Awards';
  if (/clean sheets|goalkeeper|Zamora/i.test(q)) return 'Goalkeepers';
  if (/longest|how many different/i.test(q)) return 'Records & runs';
  return 'Goals';
}

function leagueOf(q) {
  if (/Ukrainian|Belgian|Liga Portugal|Eredivisie|Super Lig|Scottish|Saudi/.test(q)) return 'Other';
  if (/Premier League/.test(q) && !/UEFA/.test(q)) return 'Premier League';
  if (/LALIGA|LaLiga/i.test(q)) return 'LaLiga';
  if (/Serie A/.test(q)) return 'Serie A';
  if (/Bundesliga/.test(q)) return 'Bundesliga';
  if (/Ligue 1/.test(q)) return 'Ligue 1';
  if (/UEFA/.test(q)) return 'Europe';
  return 'Other';
}

function familyOf(q) {
  if (/clean sheets/i.test(q)) return 'clean';
  if (/hat-tricks/i.test(q)) return 'hat';
  if (/longest winning run/i.test(q)) return 'win-run';
  if (/longest unbeaten run/i.test(q)) return 'unbeaten';
  if (/how many goals/i.test(q)) return 'goals';
  return 'other';
}

const CLUB_CATEGORIES = new Set(['Transfers 2026/27', 'Title winners', 'European qualification']);
const isClubQuestion = (q, category) =>
  CLUB_CATEGORIES.has(category) || /^Against which team|^Which team (had|won)/.test(q);

/**
 * @param {string[]} blocks  one or more raw text blocks
 * @param {{prefix?: string}} opts
 */
export function buildExtraTimeQuestions(blocks, { prefix = 'et' } = {}) {
  const merged = new Map();
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const at = trimmed.indexOf(' :: ');
      if (at < 0) throw new Error(`Bad trivia line (missing " :: "): ${trimmed}`);
      const question = clean(trimmed.slice(0, at));
      const answers = trimmed
        .slice(at + 4)
        .split(' / ')
        .map((a) => clean(a))
        .filter(Boolean);
      const key = fold(question).replace(/[^a-z0-9/]+/g, ' ').trim();
      const existing = merged.get(key);
      if (existing) {
        for (const a of answers) if (!existing.answers.some((x) => fold(x) === fold(a))) existing.answers.push(a);
      } else {
        merged.set(key, { question, answers: [...answers] });
      }
    }
  }

  const used = new Set();
  const list = [...merged.values()].map((entry, index) => {
    const category = classify(entry.question);
    const league = leagueOf(entry.question);
    const numeric = entry.answers.every((a) => /^\d+$/.test(a));
    const kind = numeric ? 'number' : isClubQuestion(entry.question, category) ? 'club' : 'person';
    let slug = slugify(entry.question);
    if (used.has(slug)) slug = `${slug}-${index + 1}`;
    used.add(slug);
    return {
      id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
      slug,
      question: entry.question,
      answers: entry.answers,
      answer: entry.answers.join(' / '),
      multi: entry.answers.length > 1,
      category,
      league,
      kind,
      family: familyOf(entry.question),
      h: haystack(entry.question, entry.answers.join(' '), category, league)
    };
  });
  return list;
}

export function countBy(list, key, order) {
  const counts = new Map();
  for (const item of list) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return (order || [...counts.keys()]).map((name) => ({ name, count: counts.get(name) || 0 })).filter((x) => x.count);
}
