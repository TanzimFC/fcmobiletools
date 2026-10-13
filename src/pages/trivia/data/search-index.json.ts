// One compact index for the global Trivia search (fetched lazily by the browser).
import { SEASON_RECAP_QUESTIONS } from '../../../data/seasonRecapTrivia.js';
import { buildNationQuestions } from '../../../lib/triviaNations.js';
import { SEASON_RECAP_ROUTE } from '../../../lib/triviaRoutes.js';

export const GET = () => {
  const et = SEASON_RECAP_QUESTIONS.map((q) => ({
    t: 'et', q: q.question, a: q.answer, u: `${SEASON_RECAP_ROUTE}#${q.slug}`, m: `Extra Time · Season Recap · ${q.category}`
  }));
  const ans = buildNationQuestions().map((q) => ({
    t: 'ans', q: q.question, a: q.answer, u: q.url, m: `A Nation's Story · ${q.nationName} · Day ${q.dayNumber}`
  }));
  return new Response(JSON.stringify([...ans, ...et]), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
