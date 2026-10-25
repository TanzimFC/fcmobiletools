// Editorial Studio — document engine.
//
// One small, dependency-free module used by the browser editor, the Worker API and the tests, so a
// document means exactly the same thing everywhere. A document is a flat list of blocks:
//
//   { v: 2, blocks: [ { id, type, ...fields } ] }
//
// Inline text inside a block is a *restricted* HTML string (strong, em, u, s, code, mark, a, br).
// Everything that enters the system (typing, paste, legacy HTML, imported Markdown) is passed through
// sanitizeInline(), so stored content can never contain scripts, styles or unknown markup.
//
// Publishing turns blocks into Markdown with blocksToMarkdown(); the existing Astro content collection
// renders that file exactly like a hand-written article.

export const DOC_VERSION = 2;
export const CALLOUT_KINDS = { info: 'Info', tip: 'Tip', warning: 'Warning', leak: 'Leak' };
export const BLOCK_TYPES = ['p', 'h2', 'h3', 'ul', 'ol', 'quote', 'callout', 'image', 'table', 'hr', 'code', 'video', 'html'];

let counter = 0;
export function uid() {
  counter = (counter + 1) % 1679616;
  const rand = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
    : Math.floor(Math.random() * 4294967295).toString(36);
  return 'b' + rand.slice(0, 6) + counter.toString(36);
}

/* ------------------------------------------------------------------ entities */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', times: '×' };
export function decodeEntities(value) {
  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (full, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      try { return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''; } catch { return ''; }
    }
    const hit = NAMED[body.toLowerCase()];
    return hit === undefined ? full : hit;
  });
}
export const escapeText = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escapeAttr = (value) => escapeText(value).replace(/"/g, '&quot;');

/* ------------------------------------------------------------- tiny HTML parser */
// Good enough for editor output, Lexical output, pasted Word/Docs/web HTML. No DOM needed, so it runs
// identically in a Worker and under Node.
const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'col']);
const SKIP_CONTENT = new Set(['script', 'style', 'template', 'noscript', 'head', 'title']);
const TAG_RE = /<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>|<([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>|[^<]+|</g;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseHtml(html) {
  const root = { t: 'el', tag: '#root', attrs: {}, kids: [] };
  const stack = [root];
  let skipping = null;
  const top = () => stack[stack.length - 1];
  for (const m of String(html ?? '').matchAll(TAG_RE)) {
    const [raw, closeTag, openTag, attrText, selfClose] = m;
    if (raw.startsWith('<!--')) continue;
    if (skipping) {
      if (closeTag && closeTag.toLowerCase() === skipping) skipping = null;
      continue;
    }
    if (closeTag) {
      const name = closeTag.toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === name) { stack.length = i; break; }
      }
      continue;
    }
    if (openTag) {
      const tag = openTag.toLowerCase();
      if (SKIP_CONTENT.has(tag)) { if (!selfClose) skipping = tag; continue; }
      const attrs = {};
      for (const a of String(attrText || '').matchAll(ATTR_RE)) {
        attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
      }
      const el = { t: 'el', tag, attrs, kids: [] };
      top().kids.push(el);
      if (!VOID.has(tag) && !selfClose) stack.push(el);
      continue;
    }
    top().kids.push({ t: 'text', v: raw });
  }
  return root.kids;
}

const isEl = (n, ...tags) => n && n.t === 'el' && (!tags.length || tags.includes(n.tag));
const textOf = (nodes) => (Array.isArray(nodes) ? nodes : [nodes]).map((n) => (n.t === 'text' ? decodeEntities(n.v) : n.tag === 'br' ? '\n' : textOf(n.kids))).join('');
const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'iframe', 'img', 'body', 'html']);

/* ------------------------------------------------------------------- inline HTML */
export function safeHref(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  if (/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//')) return '';
  return v;
}
const isExternal = (href) => /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?fcmobiletools\.online/i.test(href);

function styleFlags(style) {
  const s = String(style || '').toLowerCase();
  return {
    bold: /font-weight\s*:\s*(bold|[6-9]00)/.test(s),
    italic: /font-style\s*:\s*italic/.test(s),
    underline: /text-decoration[^;]*underline/.test(s),
    strike: /text-decoration[^;]*line-through/.test(s)
  };
}

function inlineFromNodes(nodes) {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') { out += escapeText(decodeEntities(n.v).replace(/\u00a0/g, ' ').replace(/[\r\n\t ]+/g, ' ')); continue; }
    const kids = () => inlineFromNodes(n.kids);
    switch (n.tag) {
      case 'strong': case 'b': out += wrap('strong', kids()); break;
      case 'em': case 'i': out += wrap('em', kids()); break;
      case 'u': out += wrap('u', kids()); break;
      case 's': case 'strike': case 'del': out += wrap('s', kids()); break;
      case 'code': case 'kbd': out += wrap('code', escapeText(textOf(n.kids).replace(/\s+/g, ' '))); break;
      case 'mark': out += wrap('mark', kids()); break;
      case 'br': out += '<br>'; break;
      case 'a': {
        const href = safeHref(n.attrs.href);
        const inner = kids();
        out += href ? '<a href="' + escapeAttr(href) + '"' + (isExternal(href) ? ' target="_blank" rel="noopener"' : '') + '>' + inner + '</a>' : inner;
        break;
      }
      case 'span': case 'font': {
        const f = styleFlags(n.attrs.style);
        let inner = kids();
        if (f.strike) inner = wrap('s', inner);
        if (f.italic) inner = wrap('em', inner);
        if (f.bold) inner = wrap('strong', inner);
        out += inner;
        break;
      }
      case 'img': case 'script': case 'style': break;
      default:
        // Unknown or block-level element inside inline context: keep its text, separate blocks by a break.
        out += kids() + (BLOCK_TAGS.has(n.tag) && n.tag !== 'li' ? '<br>' : '');
    }
  }
  return out;
}
function wrap(tag, inner) { return inner.trim() === '' ? inner : '<' + tag + '>' + inner + '</' + tag + '>'; }

function tidyInline(html) {
  let v = html;
  // empty and doubled wrappers, whitespace around line breaks
  for (let i = 0; i < 3; i++) v = v.replace(/<(strong|em|u|s|code|mark)>(\s*)<\/\1>/g, '$2').replace(/<\/(strong|em|u|s|mark)><\1>/g, '');
  v = v.replace(/\s*<br>\s*/g, '<br>').replace(/^(?:<br>)+|(?:<br>)+$/g, '').replace(/(?:<br>){3,}/g, '<br><br>');
  return v.replace(/ {2,}/g, ' ').trim();
}

export function sanitizeInline(html) {
  return tidyInline(inlineFromNodes(parseHtml(html)));
}
export function inlineText(html) {
  return decodeEntities(String(html ?? '').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/* ----------------------------------------------------------------- HTML → blocks */
const mk = (type, fields = {}) => ({ id: uid(), type, ...fields });
const YT = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]{6,20})/i;
export function youtubeId(url) {
  const v = String(url ?? '').trim();
  let m = v.match(YT);
  if (m) return m[1];
  m = v.match(/^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{6,20})/i)
    || v.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{6,20})/i)
    || v.match(/^https?:\/\/(?:www\.)?youtube\.com\/(?:shorts|live)\/([A-Za-z0-9_-]{6,20})/i);
  return m ? m[1] : '';
}

function listItems(listNode) {
  const items = [];
  for (const li of listNode.kids) {
    if (!isEl(li, 'li')) continue;
    const own = li.kids.filter((k) => !isEl(k, 'ul', 'ol'));
    const html = tidyInline(inlineFromNodes(own));
    if (html) items.push(html);
    for (const nested of li.kids.filter((k) => isEl(k, 'ul', 'ol'))) items.push(...listItems(nested));
  }
  return items;
}

function tableBlock(node) {
  const rows = [];
  let align = [];
  const alignOf = (c) => { const v = String(c.attrs.align || (String(c.attrs.style || '').match(/text-align\s*:\s*(left|right|center)/i) || [])[1] || '').toLowerCase(); return ['left', 'right', 'center'].includes(v) ? v : 'left'; };
  const collect = (n) => {
    for (const k of n.kids) {
      if (isEl(k, 'tr')) {
        const cells = k.kids.filter((c) => isEl(c, 'td', 'th'));
        if (!rows.length) align = cells.map(alignOf);
        rows.push(cells.map((c) => tidyInline(inlineFromNodes(c.kids))));
      }
      else if (isEl(k, 'thead', 'tbody', 'tfoot')) collect(k);
    }
  };
  collect(node);
  if (!rows.length) return null;
  const cols = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] || ''));
  return mk('table', { head: norm[0], rows: norm.slice(1), align: Array.from({ length: cols }, (_, i) => align[i] || 'left') });
}

const RAW_ALLOWED = new Set(['div', 'span', 'p', 'a', 'img', 'figure', 'figcaption', 'strong', 'em', 'b', 'i', 'u', 's', 'br', 'small', 'sup', 'sub', 'ul', 'ol', 'li', 'iframe', 'mark', 'code']);
const RAW_ATTRS = new Set(['class', 'href', 'src', 'alt', 'title', 'width', 'height', 'loading', 'target', 'rel', 'allowfullscreen']);
export function sanitizeRaw(html) {
  const ser = (nodes) => nodes.map((n) => {
    if (n.t === 'text') return escapeText(decodeEntities(n.v).replace(/\s+/g, ' '));
    if (!RAW_ALLOWED.has(n.tag)) return ser(n.kids);
    if (n.tag === 'iframe' && !youtubeId(n.attrs.src)) return '';
    const attrs = [];
    for (const [k, v] of Object.entries(n.attrs)) {
      if (!RAW_ATTRS.has(k)) continue;
      if (k === 'href' && !safeHref(v)) continue;
      if (k === 'src' && !(/^https?:\/\//i.test(v) || v.startsWith('/'))) continue;
      attrs.push(k + (v === '' ? '' : '="' + escapeAttr(v) + '"'));
    }
    const open = '<' + n.tag + (attrs.length ? ' ' + attrs.join(' ') : '');
    if (VOID.has(n.tag)) return open + ' />';
    return open + '>' + ser(n.kids) + '</' + n.tag + '>';
  }).join('');
  return ser(parseHtml(html)).trim();
}

function calloutFrom(node) {
  const cls = String(node.attrs.class || '');
  const m = cls.match(/fc-callout--(info|tip|warning|leak)/);
  if (!m) return null;
  const title = node.kids.find((k) => isEl(k) && /fc-callout__title/.test(String(k.attrs.class || '')));
  const body = node.kids.find((k) => isEl(k) && /fc-callout__body/.test(String(k.attrs.class || '')));
  return mk('callout', {
    kind: m[1],
    title: title ? inlineText(inlineFromNodes(title.kids)) : '',
    html: tidyInline(inlineFromNodes(body ? body.kids : node.kids.filter((k) => k !== title)))
  });
}

function convertNodes(nodes, out) {
  for (const n of nodes) {
    if (n.t === 'text') {
      const text = tidyInline(escapeText(decodeEntities(n.v).replace(/\s+/g, ' ')));
      if (text) out.push(mk('p', { html: text }));
      continue;
    }
    switch (n.tag) {
      case 'h1': case 'h2': out.push(mk('h2', { html: tidyInline(inlineFromNodes(n.kids)) })); break;
      case 'h3': case 'h4': case 'h5': case 'h6': out.push(mk('h3', { html: tidyInline(inlineFromNodes(n.kids)) })); break;
      case 'p': {
        const img = n.kids.filter((k) => isEl(k, 'img'));
        const rest = n.kids.filter((k) => !isEl(k, 'img') && !(k.t === 'text' && !k.v.trim()));
        if (img.length && !rest.length) { for (const i of img) pushImage(i, out); break; }
        const html = tidyInline(inlineFromNodes(n.kids));
        if (html) out.push(mk('p', { html }));
        for (const i of img) pushImage(i, out);
        break;
      }
      case 'ul': case 'ol': {
        const items = listItems(n);
        if (items.length) out.push(mk(n.tag, { items }));
        break;
      }
      case 'blockquote': {
        const parts = [];
        const inner = n.kids.some((k) => isEl(k, 'p', 'div')) ? n.kids.filter((k) => isEl(k, 'p', 'div')).map((k) => tidyInline(inlineFromNodes(k.kids))).filter(Boolean) : [tidyInline(inlineFromNodes(n.kids))];
        parts.push(...inner);
        const html = parts.join('<br><br>');
        if (html) out.push(mk('quote', { html }));
        break;
      }
      case 'pre': {
        const code = n.kids.find((k) => isEl(k, 'code'));
        const lang = (String(code?.attrs.class || '').match(/language-([a-z0-9+#-]+)/i) || [])[1] || '';
        out.push(mk('code', { text: textOf(code ? code.kids : n.kids).replace(/\n$/, ''), lang }));
        break;
      }
      case 'hr': out.push(mk('hr')); break;
      case 'img': pushImage(n, out); break;
      case 'figure': {
        const img = findFirst(n, 'img');
        const cap = findFirst(n, 'figcaption');
        if (img) pushImage(img, out, cap ? tidyInline(inlineFromNodes(cap.kids)) : '');
        else convertNodes(n.kids, out);
        break;
      }
      case 'table': { const t = tableBlock(n); if (t) out.push(t); break; }
      case 'iframe': { const id = youtubeId(n.attrs.src); if (id) out.push(mk('video', { url: 'https://www.youtube.com/watch?v=' + id })); break; }
      case 'br': break;
      case 'div': case 'section': case 'article': case 'main': case 'aside': case 'span': case 'body': case 'html': case 'font': {
        const callout = n.tag === 'div' ? calloutFrom(n) : null;
        if (callout) { out.push(callout); break; }
        const cls = String(n.attrs.class || '');
        if (n.tag === 'div' && /fc-embed/.test(cls)) {
          const frame = findFirst(n, 'iframe'); const id = frame ? youtubeId(frame.attrs.src) : '';
          if (id) { out.push(mk('video', { url: 'https://www.youtube.com/watch?v=' + id })); break; }
        }
        if (n.tag === 'div' && cls && !/^(?:\s*(?:wrapper|content|container)\s*)$/i.test(cls)) {
          const raw = sanitizeRaw(serializeNode(n));
          if (raw) { out.push(mk('html', { html: raw })); break; }
        }
        const hasBlock = n.kids.some((k) => isEl(k) && BLOCK_TAGS.has(k.tag));
        if (hasBlock) convertNodes(n.kids, out);
        else { const html = tidyInline(inlineFromNodes(n.kids)); if (html) out.push(mk('p', { html })); }
        break;
      }
      default: {
        const html = tidyInline(inlineFromNodes([n]));
        if (html) out.push(mk('p', { html }));
      }
    }
  }
}
function findFirst(node, tag) {
  for (const k of node.kids || []) {
    if (isEl(k, tag)) return k;
    const deeper = isEl(k) ? findFirst(k, tag) : null;
    if (deeper) return deeper;
  }
  return null;
}
function pushImage(img, out, caption = '') {
  const src = String(img.attrs.src || '').trim();
  if (!/^https?:\/\//i.test(src)) return;
  out.push(mk('image', { src, alt: decodeEntities(img.attrs.alt || ''), caption }));
}
function serializeNode(n) {
  if (n.t === 'text') return escapeText(decodeEntities(n.v));
  const attrs = Object.entries(n.attrs).map(([k, v]) => ' ' + k + '="' + escapeAttr(v) + '"').join('');
  return VOID.has(n.tag) ? '<' + n.tag + attrs + '>' : '<' + n.tag + attrs + '>' + n.kids.map(serializeNode).join('') + '</' + n.tag + '>';
}

export function htmlToBlocks(html) {
  const out = [];
  convertNodes(parseHtml(html), out);
  return cleanBlocks(out);
}

/* ------------------------------------------------------------------ normalise */
export function cleanBlocks(blocks) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(blocks) ? blocks : []) {
    if (!raw || !BLOCK_TYPES.includes(raw.type)) continue;
    const b = { ...raw };
    let id = typeof b.id === 'string' && /^[A-Za-z0-9_-]{3,40}$/.test(b.id) ? b.id : uid();
    while (seen.has(id)) id = uid();
    seen.add(id);
    b.id = id;
    switch (b.type) {
      case 'p': case 'h2': case 'h3': b.html = sanitizeInline(b.html); if (b.type !== 'p' && !b.html) continue; break;
      case 'quote': b.html = sanitizeInline(b.html); b.cite = inlineText(b.cite || ''); break;
      case 'callout':
        b.kind = CALLOUT_KINDS[b.kind] ? b.kind : 'info';
        b.title = inlineText(b.title || '').slice(0, 80);
        b.html = sanitizeInline(b.html);
        break;
      case 'ul': case 'ol': b.items = (Array.isArray(b.items) ? b.items : []).map(sanitizeInline).filter(Boolean); if (!b.items.length) continue; break;
      case 'image': {
        const src = String(b.src || '').trim();
        if (!/^https?:\/\//i.test(src)) continue;
        b.src = src; b.alt = String(b.alt || '').slice(0, 300); b.caption = sanitizeInline(b.caption || '');
        break;
      }
      case 'table': {
        const head = (Array.isArray(b.head) ? b.head : []).map(sanitizeInline);
        const rows = (Array.isArray(b.rows) ? b.rows : []).map((r) => (Array.isArray(r) ? r : []).map(sanitizeInline));
        const cols = Math.max(head.length, ...rows.map((r) => r.length), 1);
        b.head = Array.from({ length: cols }, (_, i) => head[i] || '');
        b.rows = rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] || ''));
        b.align = Array.from({ length: cols }, (_, i) => ['left', 'right', 'center'].includes((b.align || [])[i]) ? b.align[i] : 'left');
        break;
      }
      case 'code': b.text = String(b.text ?? '').replace(/\r\n?/g, '\n'); b.lang = String(b.lang || '').replace(/[^a-z0-9+#-]/gi, '').slice(0, 20); break;
      case 'video': { const id = youtubeId(b.url); if (!id) continue; b.url = 'https://www.youtube.com/watch?v=' + id; break; }
      case 'html': b.html = sanitizeRaw(b.html); if (!b.html) continue; break;
      default: break;
    }
    out.push(b);
  }
  return out;
}

export function emptyDoc() { return { v: DOC_VERSION, blocks: [{ id: uid(), type: 'p', html: '' }] }; }
export function docOf(blocks) { return { v: DOC_VERSION, blocks: cleanBlocks(blocks) }; }

const alignAttr = (b, i) => (b.align && b.align[i] && b.align[i] !== 'left' ? ' align="' + b.align[i] + '"' : '');
/* ------------------------------------------------------------- blocks → HTML */
export function blocksToHtml(blocks) {
  return (blocks || []).map((b) => {
    switch (b.type) {
      case 'p': return b.html ? '<p>' + b.html + '</p>' : '';
      case 'h2': return '<h2>' + b.html + '</h2>';
      case 'h3': return '<h3>' + b.html + '</h3>';
      case 'ul': return '<ul>' + b.items.map((i) => '<li>' + i + '</li>').join('') + '</ul>';
      case 'ol': return '<ol>' + b.items.map((i) => '<li>' + i + '</li>').join('') + '</ol>';
      case 'quote': return '<blockquote><p>' + b.html + '</p>' + (b.cite ? '<cite>' + escapeText(b.cite) + '</cite>' : '') + '</blockquote>';
      case 'callout': return '<div class="fc-callout fc-callout--' + b.kind + '"><strong class="fc-callout__title">' + escapeText(b.title || CALLOUT_KINDS[b.kind]) + '</strong><div class="fc-callout__body">' + b.html + '</div></div>';
      case 'image': return b.caption
        ? '<figure class="article-figure"><img src="' + escapeAttr(b.src) + '" alt="' + escapeAttr(b.alt) + '" loading="lazy" /><figcaption>' + b.caption + '</figcaption></figure>'
        : '<p><img src="' + escapeAttr(b.src) + '" alt="' + escapeAttr(b.alt) + '" loading="lazy" /></p>';
      case 'table': return '<div class="article-table"><table><thead><tr>' + b.head.map((c, i) => '<th' + alignAttr(b, i) + '>' + c + '</th>').join('') + '</tr></thead><tbody>' + b.rows.map((r) => '<tr>' + r.map((c, i) => '<td' + alignAttr(b, i) + '>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      case 'hr': return '<hr />';
      case 'code': return '<pre><code' + (b.lang ? ' class="language-' + b.lang + '"' : '') + '>' + escapeText(b.text) + '</code></pre>';
      case 'video': return '<div class="fc-embed"><iframe src="https://www.youtube-nocookie.com/embed/' + youtubeId(b.url) + '" title="Video" loading="lazy" allowfullscreen></iframe></div>';
      case 'html': return b.html;
      default: return '';
    }
  }).filter(Boolean).join('\n');
}

/* ------------------------------------------------------------ inline → Markdown */
function mdEscape(text) { return text.replace(/([\\`*_\[\]~])/g, '\\$1'); }
function inlineMdFromNodes(nodes, ctx = {}) {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') {
      // text arrives already entity-escaped (&amp; &lt; &gt;) which Markdown understands natively
      out += n.v.replace(/\\|[`*_\[\]~]/g, (c) => '\\' + c).replace(/\|/g, ctx.table ? '\\|' : '|');
      continue;
    }
    const inner = () => inlineMdFromNodes(n.kids, ctx);
    switch (n.tag) {
      case 'strong': out += spaced('**', inner()); break;
      case 'em': out += spaced('*', inner()); break;
      case 's': out += spaced('~~', inner()); break;
      case 'u': out += '<u>' + inner() + '</u>'; break;
      case 'mark': out += '<mark>' + inner() + '</mark>'; break;
      case 'code': {
        const raw = textOf(n.kids);
        const ticks = raw.includes('`') ? '``' : '`';
        out += ticks + (raw.includes('`') ? ' ' + raw + ' ' : raw).replace(/\|/g, ctx.table ? '\\|' : '|') + ticks;
        break;
      }
      case 'br': out += '<br />'; break;
      case 'a': {
        const href = String(n.attrs.href || '').replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
        out += '[' + inner() + '](' + href + ')';
        break;
      }
      default: out += inner();
    }
  }
  return out;
}
// Markdown emphasis cannot hug whitespace: "** bold**" is not bold. Move the spaces outside.
function spaced(mark, inner) {
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m[2]) return inner;
  return m[1] + mark + m[2] + mark + m[3];
}
export function inlineToMarkdown(html, ctx) { return inlineMdFromNodes(parseHtml(html), ctx); }

function leadEscape(line) {
  return line
    .replace(/^(\s*)(\d+)([.)])(?=\s|$)/, '$1$2\\$3')
    .replace(/^(\s*)([#>+\-|]|={2,}|-{2,})/, (m, ws, tok) => ws + '\\' + tok);
}

/* --------------------------------------------------------------- blocks → Markdown */
function fence(text) {
  let ticks = '```';
  while (text.includes(ticks)) ticks += '`';
  return ticks;
}
export function blocksToMarkdown(blocks) {
  const parts = [];
  for (const b of blocks || []) {
    let md = '';
    switch (b.type) {
      case 'p': md = leadEscape(inlineToMarkdown(b.html || '')); break;
      case 'h2': md = '## ' + inlineToMarkdown(b.html).replace(/<br \/>/g, ' '); break;
      case 'h3': md = '### ' + inlineToMarkdown(b.html).replace(/<br \/>/g, ' '); break;
      case 'ul': md = b.items.map((i) => '- ' + inlineToMarkdown(i).replace(/<br \/>/g, ' ')).join('\n'); break;
      case 'ol': md = b.items.map((i, n) => (n + 1) + '. ' + inlineToMarkdown(i).replace(/<br \/>/g, ' ')).join('\n'); break;
      case 'quote': {
        const lines = inlineToMarkdown(b.html).split('<br />').map((l) => l.trim());
        if (b.cite) lines.push('', '— ' + mdEscape(b.cite));
        md = lines.map((l) => (l ? '> ' + l : '>')).join('\n');
        break;
      }
      case 'callout': md = blocksToHtml([b]).replace(/\n/g, ''); break;
      case 'image': md = b.caption ? blocksToHtml([b]) : '![' + mdEscape(b.alt || '').replace(/\n/g, ' ') + '](' + String(b.src).replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29') + ')'; break;
      case 'table': {
        const row = (cells) => '| ' + cells.map((c) => inlineToMarkdown(c, { table: true }).replace(/<br \/>/g, '<br />').trim() || ' ').join(' | ') + ' |';
        const sep = (i) => ({ right: '---:', center: ':---:' })[(b.align || [])[i]] || ':---';
        md = [row(b.head), '| ' + b.head.map((_, i) => sep(i)).join(' | ') + ' |', ...b.rows.map(row)].join('\n');
        break;
      }
      case 'hr': md = '---'; break;
      case 'code': { const f = fence(b.text); md = f + (b.lang || '') + '\n' + b.text + '\n' + f; break; }
      case 'video': md = blocksToHtml([b]); break;
      case 'html': md = b.html.replace(/\n+/g, ' '); break;
      default: break;
    }
    if (md.trim() !== '') parts.push(md);
  }
  return parts.join('\n\n') + '\n';
}

/* ------------------------------------------------------------ Markdown → blocks */
// Handles what the existing articles use: headings, paragraphs, lists, quotes, GFM tables, fenced code,
// images, rules and raw HTML. Anything exotic is kept as an `html` block rather than being lost.
function mdInlineToHtml(src) {
  // Convert Markdown inline syntax to HTML, passing existing raw HTML through, then sanitise.
  let s = String(src);
  const stash = [];
  const keep = (html) => '\u0000' + (stash.push(html) - 1) + '\u0000';
  s = s.replace(/\\([\\`*_{}\[\]()#+\-.!|~<>])/g, (m, c) => keep(escapeText(c)));
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (m, t, code) => keep('<code>' + escapeText(code.replace(/^ (.*) $/, '$1')) + '</code>'));
  s = s.replace(/<(\/?[a-zA-Z][^<>]*)>/g, (m) => keep(m));
  s = s.replace(/\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)/g, (m, text, href) => keep('<a href="' + escapeAttr(href) + '">') + text + keep('</a>'));
  s = s.replace(/&(?!#?[a-z0-9]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>')
    .replace(/(^|[^\w*])\*(?=[^\s*])([\s\S]*?[^\s*])\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w_])_(?=[^\s_])([\s\S]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
    .replace(/(?: {2,}|\\)\n/g, '<br>')
    .replace(/\n/g, ' ');
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[Number(i)]);
  return sanitizeInline(s);
}

export function markdownToBlocks(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const blank = (l) => !l.trim();
  const isFence = (l) => /^\s{0,3}(`{3,}|~{3,})/.test(l);
  const isHeading = (l) => /^\s{0,3}#{1,6}\s+\S/.test(l);
  const isHr = (l) => /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l);
  const isQuote = (l) => /^\s{0,3}>/.test(l);
  const isList = (l) => /^\s{0,3}([-*+]|\d+[.)])\s+\S/.test(l);
  const isTableStart = (l, next) => /^\s*\|.*\|\s*$/.test(l) && next && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(next);
  const isHtml = (l) => /^\s{0,3}<\/?[a-zA-Z][^>]*>/.test(l) && !/^\s{0,3}<(a|strong|em|u|s|b|i|code|mark|span|br)\b/i.test(l);
  const isImageLine = (l) => /^\s*!\[[^\]]*\]\([^)]+\)\s*$/.test(l);
  const startsBlock = (l, n) => isFence(l) || isHeading(l) || isHr(l) || isQuote(l) || isList(l) || isTableStart(l, n) || isHtml(l) || isImageLine(l);
  const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) { i++; continue; }
    if (isFence(line)) {
      const open = line.match(/^\s{0,3}(`{3,}|~{3,})\s*([\w+#-]*)/);
      const body = [];
      i++;
      while (i < lines.length && !new RegExp('^\\s{0,3}' + open[1][0] + '{' + open[1].length + ',}\\s*$').test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(mk('code', { text: body.join('\n'), lang: open[2] || '' }));
      continue;
    }
    if (isHeading(line)) {
      const m = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      out.push(mk(m[1].length <= 2 ? 'h2' : 'h3', { html: mdInlineToHtml(m[2]) }));
      i++; continue;
    }
    if (isHr(line)) { out.push(mk('hr')); i++; continue; }
    if (isQuote(line)) {
      const body = [];
      while (i < lines.length && isQuote(lines[i])) body.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      const alert = body[0] && body[0].match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION|INFO)\]\s*$/i);
      if (alert) {
        const kind = { note: 'info', info: 'info', tip: 'tip', warning: 'warning', caution: 'warning', important: 'warning' }[alert[1].toLowerCase()];
        out.push(mk('callout', { kind, title: '', html: mdInlineToHtml(body.slice(1).join('\n').trim()) }));
      } else {
        const paras = body.join('\n').split(/\n\s*\n/).map((p) => mdInlineToHtml(p.trim())).filter(Boolean);
        out.push(mk('quote', { html: paras.join('<br><br>') }));
      }
      continue;
    }
    if (isTableStart(line, lines[i + 1])) {
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : 'left'));
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|?\s*$/.test(lines[i]) && !blank(lines[i])) rows.push(cells(lines[i++]));
      out.push(mk('table', { head: head.map(mdInlineToHtml), rows: rows.map((r) => r.map(mdInlineToHtml)), align }));
      continue;
    }
    if (isList(line)) {
      const ordered = /^\s{0,3}\d/.test(line);
      const items = [];
      while (i < lines.length) {
        if (blank(lines[i])) {
          let k = i; while (k < lines.length && blank(lines[k])) k++;
          if (k < lines.length && isList(lines[k]) && /^\s{0,3}\d/.test(lines[k]) === ordered && !/^\s{2,}/.test(lines[k])) { i = k; continue; }
          break;
        }
        if (isList(lines[i])) {
          if (items.length && /^\s{0,3}\d/.test(lines[i]) !== ordered && !/^\s{2,}/.test(lines[i])) break;
          items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '')); i++; continue;
        }
        if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += '\n' + lines[i].trim(); i++; continue; }
        break;
      }
      out.push(mk(ordered ? 'ol' : 'ul', { items: items.map((it) => mdInlineToHtml(it.replace(/^\[[ xX]\]\s+/, ''))) }));
      continue;
    }
    if (isHtml(line)) {
      const body = [];
      while (i < lines.length && !blank(lines[i])) body.push(lines[i++]);
      // a raw html block may be several blocks run together; parse and convert them structurally
      const blocks = htmlToBlocks(body.join('\n'));
      const classy = /<div\b[^>]*\bclass=/i.test(body.join('\n')) && !blocks.some((b) => b.type === 'callout' || b.type === 'video');
      if (classy) out.push(mk('html', { html: sanitizeRaw(body.join(' ')) }));
      else out.push(...blocks);
      continue;
    }
    if (isImageLine(line)) {
      const m = line.match(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
      out.push(mk('image', { src: m[2], alt: m[1].replace(/\\(.)/g, '$1'), caption: '' }));
      i++; continue;
    }
    const para = [];
    while (i < lines.length && !blank(lines[i]) && (para.length === 0 || !startsBlock(lines[i], lines[i + 1]))) para.push(lines[i++]);
    const text = para.join('\n');
    // inline images inside a paragraph become their own blocks
    const pieces = text.split(/(!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\))/);
    for (const piece of pieces) {
      const im = piece.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
      if (im) out.push(mk('image', { src: im[2], alt: im[1], caption: '' }));
      else if (piece.trim()) out.push(mk('p', { html: mdInlineToHtml(piece.trim()) }));
    }
  }
  return cleanBlocks(out);
}

/* ---------------------------------------------------------- front matter (YAML subset) */
export function parseFrontmatter(source) {
  const text = String(source ?? '').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  const rows = m[1].split('\n');
  const scalar = (raw) => {
    const v = raw.trim();
    if (v === '' ) return '';
    if (v === 'null' || v === '~') return null;
    if (v === 'true' || v === 'false') return v === 'true';
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v.startsWith('"') && v.endsWith('"') && v.length > 1) { try { return JSON.parse(v); } catch { return v.slice(1, -1); } }
    if (v.startsWith("'") && v.endsWith("'") && v.length > 1) return v.slice(1, -1).replace(/''/g, "'");
    if (v.startsWith('[') && v.endsWith(']')) { try { return JSON.parse(v); } catch { return v.slice(1, -1).split(',').map((x) => scalar(x)).filter((x) => x !== ''); } }
    return v;
  };
  for (let n = 0; n < rows.length; n++) {
    const row = rows[n];
    if (!row.trim() || /^\s*#/.test(row)) continue;
    const hit = row.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!hit) continue;
    if (hit[2] === '' || hit[2] === '|' || hit[2] === '>' || hit[2] === '>-') {
      const items = [];
      let j = n + 1;
      while (j < rows.length && (/^\s+-\s+/.test(rows[j]) || /^\s+\S/.test(rows[j]) && hit[2] !== '')) {
        items.push(rows[j].replace(/^\s+-\s+/, '').trim());
        j++;
      }
      if (hit[2] === '' && items.length) { data[hit[1]] = items.map(scalar); n = j - 1; continue; }
      if (hit[2] !== '' && items.length) { data[hit[1]] = items.join(' '); n = j - 1; continue; }
      data[hit[1]] = '';
      continue;
    }
    data[hit[1]] = scalar(hit[2]);
  }
  return { data, body: m[2] };
}

const yamlString = (v) => JSON.stringify(String(v ?? ''));
const yamlList = (v) => JSON.stringify((Array.isArray(v) ? v : []).map(String));

export const ARTICLE_TYPES = ['news', 'guide', 'player-review', 'ranking', 'analysis', 'event-guide', 'explanation', 'opinion', 'leaks'];
export const FACT_STATUSES = ['verified', 'partially-verified', 'community-reported'];

// Builds the Markdown file committed to GitHub. Field names match src/content/config.ts exactly.
export function articleToMarkdownFile(a, blocks) {
  const body = blocksToMarkdown(blocks);
  const words = inlineText(blocksToHtml(blocks)).split(/\s+/).filter(Boolean).length;
  const published = a.publishedAt || new Date().toISOString();
  const lines = [
    '---',
    'id: ' + yamlString(a.id ?? a.slug),
    'slug: ' + yamlString(a.slug),
    'title: ' + yamlString(a.title),
    'subtitle: ' + yamlString(a.subtitle),
    'description: ' + yamlString(a.description),
    'type: ' + yamlString(ARTICLE_TYPES.includes(a.type) ? a.type : 'guide'),
    'category: ' + yamlString(a.category || 'Guides'),
    'author: ' + yamlString(a.author || 'TanzimFC'),
    'status: "published"',
    'createdBy: ' + yamlString(a.createdBy || a.author || 'TanzimFC'),
    'createdAt: ' + yamlString(a.createdAt || published),
    'updatedAt: ' + yamlString(a.updatedAt || published),
    'publishedAt: ' + yamlString(published),
    'image: ' + yamlString(a.image),
    'imageAlt: ' + yamlString(a.imageAlt),
    'imageCaption: ' + yamlString(a.imageCaption),
    'excerpt: ' + yamlString(a.excerpt || a.description),
    'tags: ' + yamlList(a.tags),
    'relatedArticles: ' + yamlList(a.relatedArticles),
    'relatedTools: ' + yamlList(a.relatedTools),
    'featured: ' + (a.featured ? 'true' : 'false'),
    'readingTime: ' + Math.max(1, Math.ceil(words / 220)),
    'seoTitle: ' + yamlString(a.seoTitle || a.title),
    'seoDescription: ' + yamlString(a.seoDescription || a.description),
    'canonicalUrl: ' + yamlString(a.canonicalUrl),
    'sources: ' + yamlList(a.sources),
    'factStatus: ' + yamlString(FACT_STATUSES.includes(a.factStatus) ? a.factStatus : 'verified')
  ];
  if (a.lastReviewed) lines.push('lastReviewed: ' + yamlString(String(a.lastReviewed).slice(0, 10)));
  if (a.series) { lines.push('series: ' + yamlString(a.series)); if (Number.isInteger(a.seriesOrder)) lines.push('seriesOrder: ' + a.seriesOrder); }
  lines.push('---', '', body);
  return lines.join('\n');
}

/* --------------------------------------------------------------------- metrics */
export function plainText(blocks) {
  return (blocks || []).map((b) => {
    switch (b.type) {
      case 'p': case 'h2': case 'h3': case 'quote': case 'callout': return inlineText(b.html);
      case 'ul': case 'ol': return b.items.map(inlineText).join(' ');
      case 'table': return [...b.head, ...b.rows.flat()].map(inlineText).join(' ');
      case 'image': return inlineText(b.caption || '');
      default: return '';
    }
  }).join(' ').replace(/\s+/g, ' ').trim();
}
export function wordCount(blocks) { const t = plainText(blocks); return t ? t.split(' ').length : 0; }
export function readingMinutes(blocks) { return Math.max(1, Math.ceil(wordCount(blocks) / 220)); }
export function outline(blocks) {
  return (blocks || []).filter((b) => b.type === 'h2' || b.type === 'h3').map((b) => ({ id: b.id, level: b.type === 'h2' ? 2 : 3, text: inlineText(b.html) }));
}

export function slugify(value) {
  return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110).replace(/-+$/g, '');
}

// Stable hash used to skip no-op saves and duplicate revisions.
export function hashDoc(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
