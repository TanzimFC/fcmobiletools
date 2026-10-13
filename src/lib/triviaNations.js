// A Nation's Story: keep each day's questions together; question links target anchors on grouped day pages.
import { NATIONS_STORY } from '../data/aNationsStory.js';
import { getQuestionOptions } from '../data/aNationsStoryOptions.js';
import { slugify, haystack, fold } from './triviaCore.js';

export const ANS_BASE = '/trivia/a-nations-story';

// Art is pre-converted to WebP (1280 / 640 wide). The original PNGs were ~2.8 MB each.
export const NATION_STYLE = {
  japan: { color: '#ff4d6a', glow: '255,77,106', blurb: 'Samurai Blue' },
  netherlands: { color: '#ff9a3c', glow: '255,154,60', blurb: 'Oranje' },
  mexico: { color: '#2fd47f', glow: '47,212,127', blurb: 'El Tri' },
  france: { color: '#5b9dff', glow: '91,157,255', blurb: 'Les Bleus' },
  brazil: { color: '#ffd84a', glow: '255,216,74', blurb: 'Seleção' }
};

export const nationImage = (slug, width = 1280) => `/assets/images/anationstory/${slug}-${width}.webp`;
export const nationUrl = (slug) => `${ANS_BASE}/${slug}/`;
export const dayUrl = (slug, dayId) => `${ANS_BASE}/${slug}/${dayId}/`;
export const questionUrl = (slug, dayId, qSlug) => `${ANS_BASE}/${slug}/${dayId}/${qSlug}/`;
export const groupedQuestionUrl = (slug, dayId, qSlug) => `${dayUrl(slug, dayId)}#${qSlug}`;


function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * Which option is the correct one? The stored answer is sometimes a longer or
 * shorter spelling of the option ("Zinedine Zidane" vs "Zidane", "Italy" vs
 * "vs. Italy"), so exact matching alone leaves some questions with no tick.
 */
export function resolveCorrect(answer, options) {
  const a = fold(answer).replace(/[^a-z0-9 ]+/g, ' ').trim();
  const opts = options.map((o) => fold(o).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim());
  let i = options.indexOf(answer);
  if (i >= 0) return i;
  i = opts.findIndex((o) => o === a);
  if (i >= 0) return i;
  const hits = (test) => opts.map((o, n) => (test(o) ? n : -1)).filter((n) => n >= 0);
  let found = hits((o) => o.length > 2 && (a.endsWith(o) || o.endsWith(a)));
  if (found.length === 1) return found[0];
  found = hits((o) => o.length > 2 && new RegExp(`\\b${o}\\b`).test(a));
  if (found.length === 1) return found[0];
  found = hits((o) => editDistance(o, a) <= 2);
  if (found.length === 1) return found[0];
  return -1;
}

let cache;
export function buildNationQuestions() {
  if (cache) return cache;
  const flat = [];
  for (const nation of NATIONS_STORY) {
    const used = new Set();
    for (const day of nation.days) {
      const dayNumber = Number(day.id.replace('day-', ''));
      day.questions.forEach((item, index) => {
        let slug = slugify(item.question);
        if (used.has(slug)) slug = `${slug}-d${dayNumber}-q${index + 1}`;
        used.add(slug);
        const options = getQuestionOptions(nation.slug, day.id, index);
        flat.push({
          id: `${nation.slug}-d${dayNumber}-q${index + 1}`,
          nation: nation.slug,
          nationName: nation.name,
          flag: nation.flag,
          dayId: day.id,
          dayNumber,
          dayTitle: day.title,
          level: day.level || null,
          index: index + 1,
          countInDay: day.questions.length,
          question: item.question,
          answer: item.answer,
          hint: item.hint || '',
          options,
          correctIndex: resolveCorrect(item.answer, options),
          slug,
          url: groupedQuestionUrl(nation.slug, day.id, `q-${index + 1}`),
          legacyUrl: questionUrl(nation.slug, day.id, slug),
          h: haystack(nation.name, item.question, item.answer, options.join(' '))
        });
      });
    }
  }

  cache = flat;
  return flat;
}

/** The "Beginner / Medium / Difficult" tier name, or a nation-specific label. */
export function dayLabel(day) {
  return day.level ? `${day.level} · ${day.title.split('·')[1]?.trim() || ''}`.replace(/ · $/, '') : day.title;
}
