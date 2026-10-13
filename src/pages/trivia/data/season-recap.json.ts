// Dataset for the Season Recap finder + practice arena.
import { SEASON_RECAP_QUESTIONS } from '../../../data/seasonRecapTrivia.js';

export const GET = () => {
  const data = SEASON_RECAP_QUESTIONS.map((q) => ({ id: q.id, s: q.slug, q: q.question, a: q.answers, c: q.category, l: q.league, k: q.kind, f: q.family }));
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
