// Dataset for the A Nation's Story practice arena (real 4-option sets).
import { buildNationQuestions } from '../../../lib/triviaNations.js';

export const GET = () => {
  const data = buildNationQuestions().map((q) => ({
    id: q.id, n: q.nation, nn: q.nationName, d: q.dayNumber, lv: q.level, q: q.question, a: q.answer, o: q.options, ci: q.correctIndex, u: q.url
  }));
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
