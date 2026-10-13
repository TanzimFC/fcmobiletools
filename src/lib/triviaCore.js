// Shared trivia helpers. Imported at build time (pages) AND bundled for the
// browser (search + arena), so server and client always agree on how text is
// normalised and ranked.

export const SITE = 'https://fcmobiletools.online';

/** Lower-case, strip accents, unify apostrophes. "Dženan" -> "dzenan". */
export function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase();
}

/** Words used for matching. Keeps "26/27" style tokens intact. */
export function tokenize(value) {
  return fold(value)
    .replace(/[^a-z0-9/']+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function slugify(value, max = 96) {
  const words = fold(value)
    .replace(/&/g, ' and ')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let out = '';
  for (const word of words) {
    const next = out ? `${out}-${word}` : word;
    if (next.length > max) break;
    out = next;
  }
  return out || 'question';
}

/** Extra words people type that are not in the in-game spelling. */
const ALIASES = [
  [/munchen/, 'munich bayern'],
  [/inter milan/, 'inter internazionale'],
  [/paris saint-germain/, 'psg'],
  [/manchester united/, 'man utd man united'],
  [/manchester city/, 'man city'],
  [/tottenham/, 'spurs'],
  [/wolverhampton/, 'wolves'],
  [/laliga/, 'la liga'],
  [/olympique de marseille/, 'marseille om'],
  [/olympique lyonnais/, 'lyon ol'],
  [/rc celta/, 'celta vigo'],
  [/hamburger sv/, 'hamburg hsv'],
  [/vini jr/, 'vinicius junior'],
  [/nottingham forest/, 'notts forest']
];

/** Folded haystack used for matching, with aliases appended. */
export function haystack(...parts) {
  const base = fold(parts.filter(Boolean).join(' '));
  let extra = '';
  for (const [re, add] of ALIASES) if (re.test(base)) extra += ` ${add}`;
  return base + extra;
}

/**
 * Rank items against a query. Every query word must appear (AND). Items are
 * scored so exact phrases and question matches float to the top.
 * item shape: { q, a, h } where h is a prebuilt haystack (optional).
 */
export function rank(items, query, limit = 24) {
  const words = tokenize(query);
  if (!words.length) return [];
  const phrase = fold(query).trim();
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const hay = item.h || (item.h = haystack(item.q, item.a));
    let ok = true;
    for (const w of words) if (!hay.includes(w)) { ok = false; break; }
    if (!ok) continue;
    const q = fold(item.q);
    let score = 0;
    if (q.includes(phrase)) score += 12;
    for (const w of words) {
      if (new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(q)) score += 4;
      else score += 1;
    }
    if (fold(item.a || '').includes(phrase)) score += 6;
    out.push({ item, score, order: i });
  }
  out.sort((x, y) => y.score - x.score || x.order - y.order);
  return out.slice(0, limit).map((r) => r.item);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** HTML-escape `text` and wrap query words in <mark>, accent-insensitively. */
export function highlight(text, query) {
  const source = String(text ?? '');
  const words = [...new Set(tokenize(query))].sort((a, b) => b.length - a.length);
  if (!words.length) return esc(source);
  let folded = '';
  const map = [];
  for (let i = 0; i < source.length; i++) {
    const f = fold(source[i]);
    for (let k = 0; k < f.length; k++) { folded += f[k]; map.push(i); }
  }
  const hit = new Array(source.length).fill(false);
  for (const w of words) {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(w, from);
      if (at < 0) break;
      for (let k = at; k < at + w.length; k++) if (map[k] !== undefined) hit[map[k]] = true;
      from = at + w.length;
    }
  }
  let html = '';
  let open = false;
  for (let i = 0; i < source.length; i++) {
    if (hit[i] && !open) { html += '<mark>'; open = true; }
    if (!hit[i] && open) { html += '</mark>'; open = false; }
    html += esc(source[i]);
  }
  if (open) html += '</mark>';
  return html;
}

export const absolute = (path) => new URL(path, SITE).toString();

export function breadcrumbLd(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: absolute(step.href)
    }))
  };
}

/** Educational practice question with its options (schema.org Quiz). */
export function quizLd({ url, name, question, answer, options = [], about, level }) {
  const question_ = {
    '@type': 'Question',
    name: question,
    text: question,
    eduQuestionType: options.length > 1 ? 'Multiple choice' : 'Flashcard',
    acceptedAnswer: { '@type': 'Answer', text: answer }
  };
  const wrong = options.filter((o) => o !== answer);
  if (wrong.length) question_.suggestedAnswer = wrong.map((text) => ({ '@type': 'Answer', text }));
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    '@id': `${absolute(url)}#quiz`,
    url: absolute(url),
    name,
    about: { '@type': 'Thing', name: about },
    ...(level ? { educationalLevel: level } : {}),
    inLanguage: 'en',
    hasPart: [question_]
  };
}
