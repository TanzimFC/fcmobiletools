// Shared data layer for the blog. Every blog page reads posts through here so
// sections, slugs, covers, dates and reading time are computed exactly once.
import { getCollection } from 'astro:content';

export const slugify = (value) =>
  String(value ?? '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

/* ---------------------------------------------------------------- sections */
// One canonical taxonomy derived from the article `type` field (what the admin edits).
export const SECTIONS = {
  news:           { key: 'news',           label: 'Updates',   slug: 'updates',   accent: '#67dbff', blurb: 'Patch notes, maintenance windows, events going live and everything that changes in the game.' },
  leaks:          { key: 'leaks',          label: 'Leaks',     slug: 'leaks',     accent: '#b7a0ff', blurb: 'Early information from datamines, footage and insiders. Every story is labelled by how confident we are.' },
  guide:          { key: 'guide',          label: 'Guides',    slug: 'guides',    accent: '#72e1ad', blurb: 'Practical walkthroughs that help you spend coins, points and time where they actually pay off.' },
  'event-guide':  { key: 'event-guide',    label: 'Events',    slug: 'events',    accent: '#ff9d76', blurb: 'Event breakdowns, milestone maths and the quickest route to every reward.' },
  analysis:       { key: 'analysis',       label: 'Analysis',  slug: 'analysis',  accent: '#ffd18a', blurb: 'Deeper reads on the economy, the meta and where the game is heading.' },
  'player-review':{ key: 'player-review',  label: 'Reviews',   slug: 'reviews',   accent: '#f3ca76', blurb: 'Player reviews with honest verdicts on whether a card is worth your resources.' },
  opinion:        { key: 'opinion',        label: 'Tactics',   slug: 'tactics',   accent: '#f29bd2', blurb: 'Formations, playstyles and the opinions behind how we play.' },
  ranking:        { key: 'ranking',        label: 'Rankings',  slug: 'rankings',  accent: '#8fb8ff', blurb: 'Ranked lists of the cards, squads and picks that matter right now.' },
  explanation:    { key: 'explanation',    label: 'Explainers',slug: 'explainers',accent: '#9be7e0', blurb: 'Clear explanations of mechanics that the game never quite spells out.' }
};
const SECTION_ORDER = ['news', 'leaks', 'guide', 'event-guide', 'analysis', 'player-review', 'opinion', 'ranking', 'explanation'];
export const sectionOf = (type) => SECTIONS[type] ?? SECTIONS.guide;

/* ------------------------------------------------------------ fact status */
export const FACTS = {
  verified:             { key: 'verified', tone: 'verified', label: 'Verified', title: 'Verified information', note: 'Confirmed by official sources or directly in the game.' },
  'partially-verified': { key: 'partially-verified', tone: 'partial', label: 'Partly verified', title: 'Partially verified', note: 'Some details are confirmed. Others come from unofficial sources, so treat those parts with care.' },
  'community-reported': { key: 'community-reported', tone: 'community', label: 'Unconfirmed', title: 'Unconfirmed, community reported', note: 'Based on community reports, footage or screenshots. This is not confirmed game information and can change.' }
};

/* ----------------------------------------------------------------- tools */
export const TOOLS = {
  '/events':                { title: 'Events & Reset Hub',      label: 'Live hub',   description: 'Live event countdowns, daily reset clock, Division Rivals timer and October schedule.' },
  '/redeem-codes':          { title: 'Redeem Codes',            label: 'Live tool',  description: 'Check current FC Mobile codes and go straight to redemption.' },
  '/fc-mobile-27':          { title: 'FC Mobile 27 Update',     label: 'Season 27',  description: 'Season 27 update guide, Game Plans, Gauntlet Mode, PlayStyles and official install.' },
  '/team-ovr':              { title: 'Team OVR Calculator',     label: 'Calculator', description: 'Work out your squad OVR before you change the lineup.' },
  '/training-calculator':   { title: 'Training Calculator',     label: 'Calculator', description: 'Plan XP, fodder, levels and excess XP before spending resources.' },
  '/rank-up-calculator':    { title: 'Rank Up Calculator',      label: 'Calculator', description: 'Compare Rank Up Point routes and see the effect before you commit.' },
  '/investment-calculator': { title: 'Investment Calculator',   label: 'Calculator', description: 'Calculate after-tax market profit, ROI and break-even sell prices.' },
  '/football-centre':       { title: 'Football Centre',         label: 'Live tool',  description: 'Track matches, points, rewards and event resources in one place.' },
  '/gauntlet-planner':      { title: 'Gauntlet Mode Planner',   label: 'Planner',    description: 'Plan match-by-match rotations and track player availability.' },
  '/shards-counter':        { title: 'Shards Counter',           label: 'Tracker',    description: 'Track your Star Shards balance and progress toward a chosen target.' },
  '/a-nations-story':       { title: "A Nation's Story",        label: 'Event tool', description: 'Find event answers without digging through the full quest flow.' },
  '/tournaments':           { title: 'Tournaments',             label: 'Brackets',   description: 'Official FC Mobile tournament brackets, match results and progress.' }
};
export function resolveTools(list = []) {
  return list.map((value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    const href = raw.startsWith('/') ? raw : '/' + raw.replace(/^\/+/, '');
    const fallback = raw.replace(/^\/+|\/$/g, '').split('/').pop()?.replaceAll('-', ' ') || 'Useful tool';
    return { href, ...(TOOLS[href] ?? { title: fallback, label: 'Tool', description: 'Open this tool alongside the article.' }) };
  }).filter(Boolean);
}

/* ---------------------------------------------------------------- helpers */
// Cloudinary delivery transform. Non-Cloudinary URLs pass through untouched.
const cloudinaryUpload = (url) => {
  const value = String(url ?? '');
  if (!value.includes('res.cloudinary.com') || !value.includes('/image/upload/')) return null;
  const afterUpload = value.split('/image/upload/')[1] ?? '';
  const firstSegment = afterUpload.split('/')[0] ?? '';
  // Preserve authored Cloudinary transformations instead of stacking new ones on top.
  const hasTransforms = Boolean(firstSegment) &&
    !/^v\d+$/i.test(firstSegment) &&
    (firstSegment.includes(',') || /^(?:f_auto|q_auto|w_\d+|h_\d+|c_(?:fill|limit|scale|crop|thumb)|dpr_auto)(?:$|,)/i.test(firstSegment));
  return { value, hasTransforms };
};

export const img = (url, width, extra = '') => {
  const parsed = cloudinaryUpload(url);
  if (!parsed || parsed.hasTransforms) return String(url ?? '');
  return parsed.value.replace(
    '/image/upload/',
    `/image/upload/f_auto,q_auto,c_limit,w_${width}${extra ? ',' + extra : ''}/`
  );
};
export const srcset = (url, widths) => {
  const parsed = cloudinaryUpload(url);
  return parsed && !parsed.hasTransforms
    ? widths.map((w) => `${img(url, w)} ${w}w`).join(', ')
    : undefined;
};

const DATE_FMT = { short: { month: 'short', day: 'numeric' }, medium: { month: 'short', day: 'numeric', year: 'numeric' }, long: { month: 'long', day: 'numeric', year: 'numeric' } };
export const fmtDate = (d, kind = 'medium') => (d ? d.toLocaleDateString('en-US', { ...DATE_FMT[kind], timeZone: 'UTC' }) : '');
export const iso = (d) => (d?.toISOString?.() ?? '');
export const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return String(url ?? ''); } };
export const initial = (name) => String(name ?? '?').trim().slice(0, 1).toUpperCase() || '?';

const wordCount = (t) => String(t ?? '').split(/\s+/).filter(Boolean).length;

/* --------------------------------------------------------------- decorate */
export function decorate(entry) {
  const d = entry.data;
  const section = sectionOf(d.type);
  const date = d.publishedAt ?? d.pubDate ?? d.createdAt ?? null;
  const updated = d.updatedAt && (!date || d.updatedAt.valueOf() - date.valueOf() > 864e5) ? d.updatedAt : null;
  const inline = String(entry.body ?? '').match(/!\[[^\]]*\]\(([^)\s]+)/)?.[1] ?? '';
  const cover = d.image || d.heroImage || inline || '';
  const words = wordCount(entry.body);
  const tags = (d.tags ?? []).filter(Boolean);
  const authorName = d.author || 'TanzimFC';
  return {
    entry,
    slug: entry.slug,
    href: `/blog/${entry.slug}/`,
    title: d.title,
    subtitle: d.subtitle || '',
    description: d.description,
    excerpt: d.excerpt || d.description,
    section,
    category: d.category,
    date,
    updated,
    cover,
    coverIsInline: !d.image && !d.heroImage && !!inline,
    thumb: d.thumbnail || cover,
    imageAlt: d.imageAlt || '',
    imageCaption: d.imageCaption || '',
    words,
    minutes: d.readingTime ?? Math.max(1, Math.ceil(words / 220)),
    author: authorName,
    authorSlug: slugify(authorName),
    tags,
    featured: !!d.featured,
    series: (d.series || '').trim(),
    seriesOrder: d.seriesOrder ?? null,
    fact: FACTS[d.factStatus] ?? null,
    sources: d.sources ?? [],
    lastReviewed: d.lastReviewed ?? null,
    search: [d.title, d.subtitle, d.description, d.excerpt, section.label, d.category, authorName, ...tags].filter(Boolean).join(' ').toLowerCase()
  };
}

export async function getPosts() {
  const all = await getCollection('blog', ({ data }) => data.status === 'published' && !data.draft);
  return all.map(decorate).sort((a, b) => (b.date?.valueOf() ?? 0) - (a.date?.valueOf() ?? 0));
}

/* ------------------------------------------------------------ collections */
export function sectionsIn(posts) {
  return SECTION_ORDER
    .map((key) => ({ ...SECTIONS[key], count: posts.filter((p) => p.section.key === key).length }))
    .filter((s) => s.count > 0);
}

export function seriesIn(posts) {
  const map = new Map();
  for (const p of posts) {
    if (!p.series) continue;
    if (!map.has(p.series)) map.set(p.series, []);
    map.get(p.series).push(p);
  }
  return [...map.entries()].map(([name, items]) => {
    const parts = items.slice().sort((a, b) => (a.seriesOrder ?? 1e6) - (b.seriesOrder ?? 1e6) || (a.date?.valueOf() ?? 0) - (b.date?.valueOf() ?? 0));
    const newest = items.reduce((m, p) => Math.max(m, p.date?.valueOf() ?? 0), 0);
    return { name, slug: slugify(name), parts, count: parts.length, minutes: parts.reduce((n, p) => n + p.minutes, 0), newest, accent: parts[0].section.accent };
  }).sort((a, b) => b.newest - a.newest);
}

// Category pages exist for every canonical section AND every free-text `category`
// value in use, so historical URLs keep working. A page lists posts that match either.
export function categoryPages(posts) {
  const pages = new Map();
  const add = (slug, label, accent) => { if (slug && !pages.has(slug)) pages.set(slug, { slug, label, accent }); };
  for (const p of posts) {
    add(p.section.slug, p.section.label, p.section.accent);
    add(slugify(p.category), p.category, p.section.accent);
  }
  return [...pages.values()].map((page) => ({
    ...page,
    blurb: Object.values(SECTIONS).find((s) => s.slug === page.slug)?.blurb ?? `Every published article filed under ${page.label}.`,
    posts: posts.filter((p) => p.section.slug === page.slug || slugify(p.category) === page.slug)
  }));
}

export function relatedTo(post, posts, limit = 3) {
  const d = post.entry.data;
  const explicit = (d.relatedArticles ?? [])
    .map((s) => String(s).trim().replace(/^\/?blog\//, '').replace(/\/$/, ''))
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter((p) => p && p.slug !== post.slug);
  const seen = new Set(explicit.map((p) => p.slug));
  const scored = posts
    .filter((p) => p.slug !== post.slug && !seen.has(p.slug))
    .map((p) => {
      let score = 0;
      if (post.series && p.series === post.series) score += 6;
      score += p.tags.filter((t) => post.tags.includes(t)).length * 3;
      if (p.section.key === post.section.key) score += 2;
      if (p.category && p.category === post.category) score += 1;
      if (p.author === post.author) score += 0.5;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score || (b.p.date?.valueOf() ?? 0) - (a.p.date?.valueOf() ?? 0))
    .map((x) => x.p);
  return [...explicit, ...scored].slice(0, limit);
}
