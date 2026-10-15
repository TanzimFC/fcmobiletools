// Pure game logic for the Trivia play page. No DOM in here, so Node can test it
// (npm run test:trivia) and the browser bundle imports the very same code.

export const SETS = {
  'season-recap': {
    key: 'season-recap', src: '/trivia/data/season-recap.json', title: 'Season Recap', sub: 'Extra Time · Challenge',
    options: 2, secs: 12, lengths: [10, 20, 30], topicLabel: 'Topic', answersUrl: '/trivia/extra-time/season-recap/'
  },
  'nations-story': {
    key: 'nations-story', src: '/trivia/data/nations-story.json', title: "A Nation's Story", sub: 'Day-by-day football history',
    options: 4, secs: 15, lengths: [5, 10, 20], topicLabel: 'Nation', answersUrl: '/trivia/a-nations-story/'
  }
};

export const MODES = {
  quiz: { key: 'quiz', name: 'Quiz', blurb: 'Untimed, instant feedback and automatic progression.' },
  attack: { key: 'attack', name: 'Time Attack', blurb: 'Beat the clock for speed bonuses, like the real event.' },
  cards: { key: 'cards', name: 'Flashcards', blurb: 'Flip, self-grade and re-drill what you missed.' }
};

/* Auto-advance delays (ms). Wrong answers wait longer so the correct one can be read. */
export const DELAY = { quiz: { good: 1100, bad: 2300 }, attack: { good: 800, bad: 1800 } };

export const shuffle = (list, rnd = Math.random) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
};
export const pick = (list, rnd = Math.random) => list[Math.floor(rnd() * list.length)];

/* ---------- Season Recap: the real game shows 2 options, we generate the second ---------- */
export function buildPools(list) {
  const pools = { num: {}, club: {}, clubAll: new Set(), person: {}, personAll: new Set() };
  const add = (bag, key, value) => { (bag[key] || (bag[key] = new Set())).add(value); };
  for (const q of list) {
    for (const a of q.a) {
      if (q.k === 'number') add(pools.num, q.f, Number(a));
      else if (q.k === 'club') { add(pools.club, q.l, a); pools.clubAll.add(a); }
      else { add(pools.person, q.c, a); pools.personAll.add(a); }
    }
  }
  return pools;
}

export function distractor(q, correct, pools, rnd = Math.random) {
  const taken = new Set(q.a.map(String));
  if (q.k === 'number') {
    const n = Number(correct);
    const near = Array.from(pools.num[q.f] || []).filter((v) => !taken.has(String(v)) && Math.abs(v - n) <= 5 && v > 0);
    if (near.length) return String(pick(near, rnd));
    const around = [-3, -2, -1, 1, 2, 3].map((d) => n + d).filter((v) => v > 0 && !taken.has(String(v)));
    return String(pick(around.length ? around : [n + 1], rnd));
  }
  const local = Array.from(q.k === 'club' ? (pools.club[q.l] || []) : (pools.person[q.c] || []));
  const global = Array.from(q.k === 'club' ? pools.clubAll : pools.personAll);
  const free = (l) => l.filter((x) => !taken.has(x));
  const a = free(local), b = free(global);
  const bag = a.length > 3 ? a : (b.length ? b : a);
  return bag.length ? pick(bag, rnd) : null;
}

/** One playable round from one raw question. Always returns >= 2 distinct options. */
export function toRound(setKey, q, pools, rnd = Math.random) {
  if (setKey === 'nations-story') {
    return { id: q.id, q: q.q, ci: q.ci, options: q.o.slice(), answerText: q.a, link: q.u, tag: `${q.nn} · Day ${q.d}` };
  }
  const correct = pick(q.a, rnd);
  let wrong = distractor(q, correct, pools, rnd);
  if (wrong == null || wrong === correct) wrong = q.k === 'number' ? String(Number(correct) + 1) : 'None of these';
  const options = shuffle([correct, wrong], rnd);
  return {
    id: q.id, q: q.q, ci: options.indexOf(correct), options,
    answerText: q.a.length > 1 ? q.a.join(' / ') : q.a[0], link: `/trivia/extra-time/season-recap/#${q.s}`, tag: q.c
  };
}

/* ---------- Filtering ---------- */
export function poolFor(setKey, list, f) {
  return list.filter((q) => {
    if (setKey === 'season-recap') return f.topic === 'all' || q.c === f.topic;
    if (!(q.ci >= 0) || !Array.isArray(q.o) || q.o.length < 2) return false;
    return (f.topic === 'all' || q.n === f.topic) && (f.day === 'all' || String(q.d) === String(f.day));
  });
}

export function lengthOptions(cfg, total) {
  const out = cfg.lengths.filter((n) => n < total);
  if (total > 0) out.push(total);
  return out.filter((n, i, a) => a.indexOf(n) === i);
}

/* ---------- Scoring ---------- */
export function pointsFor({ mode, secsLeft = 0, secs = 1, streak = 1 }) {
  let gain = 100;
  if (mode === 'attack') gain += Math.round((Math.max(0, secsLeft) / secs) * 100) + 10 * Math.min(streak - 1, 5);
  return gain;
}

export function gradeFor(pct) {
  if (pct >= 90) return { title: 'Matchday legend', note: 'Almost flawless. The squad sheet is yours.' };
  if (pct >= 70) return { title: 'First-team starter', note: 'Strong showing. One more round and it is perfect.' };
  if (pct >= 50) return { title: 'Solid squad player', note: 'Good base. Review the misses below and go again.' };
  return { title: 'Keep drilling', note: 'Every pro starts on the bench. Try Flashcards, then come back.' };
}

/* ---------- URL <-> settings ---------- */
export function readParams(search) {
  const p = new URLSearchParams(search);
  const set = SETS[p.get('set')] ? p.get('set') : (p.get('nation') || p.get('day') ? 'nations-story' : 'season-recap');
  const mode = MODES[p.get('mode')] ? p.get('mode') : 'quiz';
  const topic = p.get('nation') || p.get('topic') || 'all';
  const day = p.get('day') || 'all';
  const length = Number(p.get('length')) || 0;
  return { set, mode, topic, day, length };
}

/** Same question, options in a new order (used when retrying missed ones so position can't be memorised). */
export function reshuffle(round, rnd = Math.random) {
  if (!round.options || round.options.length < 2) return round;
  const correct = round.options[round.ci];
  const options = shuffle(round.options, rnd);
  return Object.assign({}, round, { options, ci: options.indexOf(correct) });
}
