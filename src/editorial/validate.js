// Publish checklist. The same function runs in the editor (live, as you type) and in the Worker
// (as the gate before anything is committed to GitHub), so what the writer sees is what is enforced.
import { ARTICLE_TYPES, FACT_STATUSES, inlineText, plainText, wordCount } from './blocks.js';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isHttps = (v) => /^https:\/\//i.test(String(v || '').trim());

// state: 'pass' | 'warn' | 'fail'. Only 'fail' blocks publishing.
export function checkArticle(a, blocks) {
  const checks = [];
  const add = (id, state, label, hint = '', field = '') => checks.push({ id, state, label, hint, field });
  const title = String(a.title || '').trim();
  const desc = String(a.description || '').trim();
  const words = wordCount(blocks);
  const images = (blocks || []).filter((b) => b.type === 'image');
  const cover = String(a.image || '').trim() || images[0]?.src || '';
  const text = plainText(blocks);

  if (title.length < 8) add('title', 'fail', 'Write a headline', 'The title needs at least 8 characters.', 'title');
  else if (title.length > 100) add('title', 'warn', 'Headline is long', title.length + ' characters. Under 100 reads better in search and cards.', 'title');
  else add('title', 'pass', 'Headline', '', 'title');

  if (!a.slug || !SLUG_RE.test(a.slug) || a.slug.length < 3) add('slug', 'fail', 'Fix the URL slug', 'Use lowercase letters, numbers and single hyphens.', 'slug');
  else add('slug', 'pass', 'URL slug', '', 'slug');

  if (!desc) add('description', 'fail', 'Add a summary', 'It appears on article cards and in search results.', 'description');
  else if (desc.length < 70 || desc.length > 170) add('description', 'warn', 'Summary length', desc.length + ' characters. Aim for 70 to 160.', 'description');
  else add('description', 'pass', 'Summary', '', 'description');

  if (!ARTICLE_TYPES.includes(a.type)) add('type', 'fail', 'Pick an article type', '', 'type');
  else add('type', 'pass', 'Article type', '', 'type');

  if (!String(a.category || '').trim()) add('category', 'fail', 'Pick a category', '', 'category');
  else add('category', 'pass', 'Category', '', 'category');

  if (!cover) add('cover', 'fail', 'Add a cover image', 'Cards and social previews need one. A first image in the body also works.', 'cover');
  else if (!isHttps(cover)) add('cover', 'fail', 'Cover must be an https image', '', 'cover');
  else add('cover', 'pass', 'Cover image', '', 'cover');

  if (cover && !String(a.imageAlt || '').trim() && !(images[0] && images[0].src === cover && images[0].alt)) add('cover-alt', 'warn', 'Describe the cover image', 'Alt text helps accessibility and image search.', 'cover');

  if (words < 120) add('length', 'fail', 'Too short to publish', words + ' words. At least 120 are needed.', 'body');
  else if (words < 300 && !['news', 'leaks'].includes(a.type)) add('length', 'warn', 'Short for a ' + (a.type || 'guide'), words + ' words. Guides and analysis usually need 300 or more.', 'body');
  else add('length', 'pass', 'Length', words + ' words', 'body');

  const h2s = (blocks || []).filter((b) => b.type === 'h2');
  if (words > 700 && h2s.length < 2) add('structure', 'warn', 'Add section headings', 'Long articles are easier to scan with headings.', 'body');
  else add('structure', 'pass', 'Structure', '', 'body');

  const seen = new Set(); let dup = false;
  for (const h of h2s) { const k = inlineText(h.html).toLowerCase(); if (seen.has(k)) dup = true; seen.add(k); }
  if (dup) add('dup-headings', 'warn', 'Two sections share a heading', 'Anchor links need unique headings.', 'body');

  const missingAlt = images.filter((i) => !String(i.alt || '').trim()).length;
  if (missingAlt) add('alt', 'warn', missingAlt + ' image' + (missingAlt > 1 ? 's' : '') + ' without alt text', 'Select the image and describe it.', 'body');

  if (/\b(lorem ipsum|TODO|TBD|FIXME)\b|\[\.\.\.\]|\bXXX\b/i.test(text + ' ' + title + ' ' + desc)) add('placeholder', 'fail', 'Placeholder text left in', 'Search for TODO, TBD, lorem ipsum or [...].', 'body');

  const tags = Array.isArray(a.tags) ? a.tags : [];
  if (!tags.length) add('tags', 'warn', 'Add at least one tag', 'Tags power related articles.', 'tags');
  else if (tags.length > 12) add('tags', 'warn', 'Too many tags', 'Keep it to 12 or fewer.', 'tags');
  else add('tags', 'pass', 'Tags', '', 'tags');

  const sources = Array.isArray(a.sources) ? a.sources.filter(Boolean) : [];
  if (a.type === 'leaks' && a.factStatus === 'verified' && !sources.length) add('fact', 'warn', 'Leak marked Verified without sources', 'Choose Unconfirmed, or add the source.', 'facts');
  else if (!FACT_STATUSES.includes(a.factStatus)) add('fact', 'fail', 'Set how confident this article is', '', 'facts');
  else add('fact', 'pass', 'Fact status', '', 'facts');

  const insecure = (blocks || []).some((b) => /href="http:\/\//i.test(JSON.stringify(b)));
  if (insecure) add('https', 'warn', 'Link uses http://', 'Prefer https links.', 'body');

  if (a.canonicalUrl) {
    let ok = true; try { new URL(a.canonicalUrl); } catch { ok = false; }
    if (!ok) add('canonical', 'fail', 'Canonical URL is not valid', '', 'seo');
  }
  if (a.seoTitle && a.seoTitle.length > 65) add('seo-title', 'warn', 'SEO title may be cut off', a.seoTitle.length + ' characters. About 60 shows fully.', 'seo');
  if (a.seoDescription && a.seoDescription.length > 165) add('seo-desc', 'warn', 'SEO description may be cut off', a.seoDescription.length + ' characters. About 155 shows fully.', 'seo');
  if (a.series && !Number.isInteger(Number(a.seriesOrder))) add('series', 'warn', 'Set the part number in the series', '', 'series');

  const fails = checks.filter((c) => c.state === 'fail').length;
  const warns = checks.filter((c) => c.state === 'warn').length;
  const score = Math.max(0, Math.round(100 - fails * 18 - warns * 6));
  return { checks, fails, warns, ok: fails === 0, score };
}
