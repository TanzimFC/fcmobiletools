// Editorial Studio — block editor.
//
// Each text block is its own small contenteditable, the way Notion and Ghost do it. That avoids the
// whole-document contenteditable and CDN rich-text framework the old editor depended on, which is where
// most of its bugs came from. The document model (engine/blocks.js) is the single source of truth.
import {
  uid, cleanBlocks, sanitizeInline, sanitizeRaw, htmlToBlocks, markdownToBlocks, inlineText, escapeText, escapeAttr, youtubeId,
  blocksToHtml, CALLOUT_KINDS, DOC_VERSION
} from './engine/blocks.js';

const TEXT_TYPES = new Set(['p', 'h2', 'h3', 'quote']);
const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

export const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>', grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  h2: '<path d="M4 6v12M12 6v12M4 12h8M17 10.5c.8-.9 3.5-1 3.5 1.3 0 1.4-3.5 3.2-3.5 5.2h3.7"/>', h3: '<path d="M4 6v12M12 6v12M4 12h8M17 8.5h3.2l-2 3c1.6 0 2.6.9 2.6 2.2 0 1.4-1.2 2.3-2.8 2.3-.7 0-1.4-.2-1.9-.6"/>',
  ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>', ol: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4M3.5 14h3L3.5 17.5h3"/>',
  quote: '<path d="M6 9h4v5H6zM14 9h4v5h-4zM8 14c0 2-1 3-2.5 3.5M16 14c0 2-1 3-2.5 3.5"/>', callout: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 8v5M12 16h.01"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>', table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 4v16"/>',
  hr: '<path d="M4 12h16"/>', code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>', video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10.5 9.5 4 2.5-4 2.5z"/>',
  timeline: '<path d="M6 4v16"/><circle cx="6" cy="7" r="1.6"/><circle cx="6" cy="17" r="1.6"/><path d="M11 7h9M11 17h9"/>', html: '<path d="M8 6 3 12l5 6M16 6l5 6-5 6"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>', italic: '<path d="M10 5h8M6 19h8M14 5 10 19"/>', underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  strike: '<path d="M5 12h14M16 7c-.5-1.3-2-2-4-2-2.4 0-4 1.1-4 3 0 1.2.8 2 2 2.5M8 17c.6 1.2 2.1 2 4 2 2.4 0 4-1.1 4-3 0-.4-.1-.7-.3-1"/>', mark: '<path d="m4 20 4-1 10-10-3-3L5 16zM14 6l3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="m6 14 6-6 6 6"/>', down: '<path d="m6 10 6 6 6-6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', comment: '<path d="M4 5h16v11H9l-5 4z"/>',
  text: '<path d="M5 6h14M12 6v13M9 19h6"/>', swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'
};
export const icon = (name, size = 18) => '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';

const SLASH_ITEMS = [
  { id: 'p', label: 'Text', hint: 'Plain paragraph', icon: 'text', keys: 'text paragraph p' },
  { id: 'h2', label: 'Heading', hint: 'Large section heading', icon: 'h2', keys: 'heading h2 title section' },
  { id: 'h3', label: 'Subheading', hint: 'Smaller heading', icon: 'h3', keys: 'subheading h3' },
  { id: 'ul', label: 'Bullet list', hint: 'Simple list', icon: 'ul', keys: 'bullet list ul' },
  { id: 'ol', label: 'Numbered list', hint: 'Steps in order', icon: 'ol', keys: 'numbered ordered list ol steps' },
  { id: 'image', label: 'Image', hint: 'Upload or paste a link', icon: 'image', keys: 'image picture photo upload screenshot' },
  { id: 'table', label: 'Table', hint: 'Compare rows and columns', icon: 'table', keys: 'table grid compare' },
  { id: 'callout-tip', label: 'Tip', hint: 'Green highlighted note', icon: 'callout', keys: 'tip callout note green' },
  { id: 'callout-warning', label: 'Warning', hint: 'Amber caution box', icon: 'callout', keys: 'warning caution callout amber' },
  { id: 'callout-leak', label: 'Leak notice', hint: 'Marks unconfirmed information', icon: 'callout', keys: 'leak rumour rumor unconfirmed callout' },
  { id: 'callout-info', label: 'Info', hint: 'Blue information box', icon: 'callout', keys: 'info callout blue' },
  { id: 'quote', label: 'Quote', hint: 'Pull quote', icon: 'quote', keys: 'quote blockquote' },
  { id: 'timeline', label: 'Timeline', hint: 'Dated milestones', icon: 'timeline', keys: 'timeline dates schedule milestones' },
  { id: 'video', label: 'YouTube video', hint: 'Embed a video', icon: 'video', keys: 'video youtube embed' },
  { id: 'code', label: 'Code', hint: 'Monospace block', icon: 'code', keys: 'code snippet' },
  { id: 'hr', label: 'Divider', hint: 'Horizontal rule', icon: 'hr', keys: 'divider hr line rule separator' }
];

const fresh = (type, extra = {}) => {
  const base = { id: uid(), type };
  switch (type) {
    case 'p': case 'h2': case 'h3': case 'quote': return { ...base, html: '', ...extra };
    case 'ul': case 'ol': return { ...base, items: [''], ...extra };
    case 'callout': return { ...base, kind: 'info', title: '', html: '', ...extra };
    case 'image': return { ...base, src: '', alt: '', caption: '', ...extra };
    case 'table': return { ...base, head: ['', '', ''], rows: [['', '', ''], ['', '', '']], align: ['left', 'left', 'left'], ...extra };
    case 'code': return { ...base, text: '', lang: '', ...extra };
    case 'video': return { ...base, url: '', ...extra };
    case 'html': return { ...base, html: '', ...extra };
    default: return { ...base, ...extra };
  }
};

export class BlockEditor {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.blocks = [];
    this.history = []; this.hIndex = -1; this.hTimer = 0; this.changeTimer = 0;
    this.readOnly = false;
    this.commentCounts = {};
    root.classList.add('ed-root');
    root.addEventListener('keydown', (e) => this.onKeydown(e));
    root.addEventListener('input', (e) => this.onInput(e));
    root.addEventListener('paste', (e) => this.onPaste(e));
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('focusin', (e) => this.onFocusIn(e));
    root.addEventListener('dragstart', (e) => this.onDragStart(e));
    root.addEventListener('dragover', (e) => this.onDragOver(e));
    root.addEventListener('dragleave', (e) => { if (!root.contains(e.relatedTarget)) this.clearDrop(); });
    root.addEventListener('drop', (e) => this.onDrop(e));
    root.addEventListener('dragend', () => this.clearDrop());
    document.addEventListener('selectionchange', this._sel = () => this.onSelectionChange());
    this.menu = null; this.fmt = this.buildFormatBar();
  }

  destroy() { document.removeEventListener('selectionchange', this._sel); this.closeMenus(); this.fmt.remove(); clearTimeout(this.hTimer); clearTimeout(this.changeTimer); }

  /* ---------------------------------------------------------------- public API */
  load(doc) {
    this.blocks = cleanBlocks(doc?.blocks || []);
    if (!this.blocks.length) this.blocks = [fresh('p')];
    this.render();
    this.history = [JSON.stringify(this.blocks)]; this.hIndex = 0;
  }
  setReadOnly(flag) { this.readOnly = !!flag; this.root.classList.toggle('is-readonly', this.readOnly); $$(this.root, '[contenteditable]').forEach((el) => el.setAttribute('contenteditable', this.readOnly ? 'false' : 'true')); }
  getDoc() { this.flush(); return { v: DOC_VERSION, blocks: cleanBlocks(this.blocks.filter((b) => !b._uploading)) }; }
  setCommentCounts(map) { this.commentCounts = map || {}; $$(this.root, '.blk').forEach((el) => this.paintComments(el)); }
  focusFirst() { const ed = this.root.querySelector('[data-ed]'); if (ed) this.placeCaret(ed, false); }
  scrollToBlock(id) { const el = this.el(id); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 1400); } }
  outline() { return this.blocks.filter((b) => b.type === 'h2' || b.type === 'h3').map((b) => ({ id: b.id, level: b.type === 'h2' ? 2 : 3, text: inlineText(b.html) })); }
  replaceBlocks(blocks) { this.snapshotNow(); this.blocks = cleanBlocks(blocks); if (!this.blocks.length) this.blocks = [fresh('p')]; this.render(); this.snapshotNow(); this.changed(); }

  /* ------------------------------------------------------------------ DOM build */
  el(id) { return this.root.querySelector('.blk[data-id="' + CSS.escape(id) + '"]'); }
  block(id) { return this.blocks.find((b) => b.id === id); }
  render() {
    this.root.textContent = '';
    for (const b of this.blocks) this.root.appendChild(this.buildBlock(b));
    this.root.appendChild(this.buildTail());
    this.setReadOnly(this.readOnly);
  }
  buildTail() {
    const t = document.createElement('div');
    t.className = 'ed-tail'; t.tabIndex = -1; t.setAttribute('aria-hidden', 'true');
    t.addEventListener('click', () => {
      const last = this.blocks[this.blocks.length - 1];
      if (last && last.type === 'p' && !inlineText(last.html)) { this.focusBlock(last.id, true); return; }
      const nb = fresh('p'); this.blocks.push(nb); this.insertBlockEl(nb, null); this.focusBlock(nb.id); this.changed(true);
    });
    return t;
  }
  buildBlock(b) {
    const wrap = document.createElement('div');
    wrap.className = 'blk blk-' + b.type; wrap.dataset.id = b.id; wrap.dataset.type = b.type;
    const gutter = document.createElement('div'); gutter.className = 'blk-gutter';
    gutter.innerHTML = '<button type="button" class="blk-add" tabindex="-1" aria-label="Add block below" data-act="add">' + icon('plus', 16) + '</button><button type="button" class="blk-handle" draggable="true" tabindex="-1" aria-label="Drag to move, click for options" data-act="menu">' + icon('grip', 16) + '</button>';
    const body = document.createElement('div'); body.className = 'blk-body';
    wrap.append(gutter, body);
    const badge = document.createElement('button'); badge.type = 'button'; badge.className = 'blk-cmt'; badge.dataset.act = 'comments'; wrap.appendChild(badge);
    this.fillBody(b, body);
    this.paintComments(wrap);
    return wrap;
  }
  paintComments(wrap) {
    const n = this.commentCounts[wrap.dataset.id] || 0;
    const badge = wrap.querySelector('.blk-cmt'); if (!badge) return;
    badge.hidden = !n; badge.innerHTML = n ? icon('comment', 14) + '<b>' + n + '</b>' : ''; badge.setAttribute('aria-label', n + ' open comment' + (n === 1 ? '' : 's'));
    wrap.classList.toggle('has-cmt', !!n);
  }
  edEl(tag, html, ph, extra = '') {
    const e = document.createElement(tag); e.dataset.ed = '1'; e.contentEditable = 'true'; e.spellcheck = true;
    if (ph) e.dataset.ph = ph; if (extra) e.className = extra; e.innerHTML = html || ''; return e;
  }
  fillBody(b, body) {
    body.textContent = '';
    switch (b.type) {
      case 'p': body.appendChild(this.edEl('p', b.html, 'Write something, or press / for blocks')); break;
      case 'h2': body.appendChild(this.edEl('h2', b.html, 'Section heading')); break;
      case 'h3': body.appendChild(this.edEl('h3', b.html, 'Subheading')); break;
      case 'quote': { const q = document.createElement('blockquote'); q.appendChild(this.edEl('p', b.html, 'Quote')); body.appendChild(q); break; }
      case 'ul': case 'ol': {
        const list = document.createElement(b.type);
        for (const item of b.items) list.appendChild(this.edEl('li', item, 'List item'));
        body.appendChild(list); break;
      }
      case 'callout': {
        const box = document.createElement('div'); box.className = 'ed-callout fc-callout--' + b.kind; box.dataset.kind = b.kind;
        const bar = document.createElement('div'); bar.className = 'ed-callout-bar';
        bar.innerHTML = Object.entries(CALLOUT_KINDS).map(([k, l]) => '<button type="button" data-act="kind" data-kind="' + k + '" class="' + (k === b.kind ? 'on' : '') + '">' + l + '</button>').join('');
        const title = this.edEl('div', escapeText(b.title), CALLOUT_KINDS[b.kind], 'ed-callout-title'); title.dataset.edTitle = '1'; title.removeAttribute('data-ed');
        const text = this.edEl('div', b.html, 'Write the note', 'ed-callout-body');
        box.append(bar, title, text); body.appendChild(box); break;
      }
      case 'image': body.appendChild(this.buildImage(b)); break;
      case 'table': body.appendChild(this.buildTable(b)); break;
      case 'hr': { const h = document.createElement('hr'); h.tabIndex = 0; h.className = 'ed-hr'; body.appendChild(h); break; }
      case 'code': {
        const wrap = document.createElement('div'); wrap.className = 'ed-code';
        const lang = document.createElement('input'); lang.className = 'ed-code-lang'; lang.placeholder = 'language'; lang.value = b.lang || ''; lang.dataset.field = 'lang'; lang.maxLength = 20;
        const ta = document.createElement('textarea'); ta.value = b.text; ta.spellcheck = false; ta.rows = Math.max(3, b.text.split('\n').length); ta.dataset.field = 'text'; ta.placeholder = 'Paste code';
        wrap.append(lang, ta); body.appendChild(wrap); break;
      }
      case 'video': body.appendChild(this.buildVideo(b)); break;
      case 'html': {
        const wrap = document.createElement('div'); wrap.className = 'ed-html';
        wrap.innerHTML = '<div class="ed-html-preview">' + b.html + '</div><details><summary>Edit HTML</summary><textarea data-field="html" spellcheck="false"></textarea></details>';
        wrap.querySelector('textarea').value = b.html; body.appendChild(wrap); break;
      }
      default: break;
    }
  }
  buildImage(b) {
    const fig = document.createElement('figure'); fig.className = 'ed-image' + (b._uploading ? ' is-uploading' : '') + (!b.src && !b._uploading ? ' is-empty' : '');
    if (b.src) {
      fig.innerHTML = '<img alt="" draggable="false"><div class="ed-image-tools"><input data-field="alt" placeholder="Describe this image for readers who cannot see it" maxlength="300"><button type="button" data-act="replace-image">Replace</button></div>';
      fig.querySelector('img').src = b.src; fig.querySelector('img').alt = b.alt || '';
      fig.querySelector('[data-field=alt]').value = b.alt || '';
      const cap = this.edEl('figcaption', b.caption, 'Add a caption (optional)'); cap.dataset.edCaption = '1'; cap.removeAttribute('data-ed'); cap.dataset.ed = 'cap'; fig.appendChild(cap);
    } else if (b._uploading) {
      fig.innerHTML = '<div class="ed-image-wait"><span class="ed-spin"></span><b>Uploading ' + escapeText(b._name || 'image') + '</b><i style="--p:' + (b._progress || 0) + '%"></i></div>';
    } else {
      fig.innerHTML = '<div class="ed-image-empty"><div>' + icon('image', 26) + '</div><b>Add an image</b><span>Drop a file, paste a screenshot, or</span><div class="ed-row"><button type="button" data-act="pick-image">Upload</button><button type="button" data-act="image-url">Paste a link</button></div></div>';
    }
    return fig;
  }
  buildVideo(b) {
    const wrap = document.createElement('div'); wrap.className = 'ed-video';
    const id = youtubeId(b.url);
    wrap.innerHTML = id
      ? '<div class="ed-video-thumb"><img alt="" src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg"><span>' + icon('video', 28) + '</span></div><input data-field="url" value="' + escapeAttr(b.url) + '" placeholder="YouTube link">'
      : '<div class="ed-video-empty">' + icon('video', 26) + '<b>Embed a YouTube video</b></div><input data-field="url" placeholder="Paste a YouTube link and press Enter">';
    return wrap;
  }
  buildTable(b) {
    const wrap = document.createElement('div'); wrap.className = 'ed-table';
    const scroll = document.createElement('div'); scroll.className = 'ed-table-scroll';
    const t = document.createElement('table');
    const cell = (tag, html, i) => { const c = document.createElement(tag); c.style.textAlign = (b.align || [])[i] || 'left'; c.appendChild(this.edEl('div', html, '', 'ed-cell')); return c; };
    const thead = document.createElement('thead'); const hr = document.createElement('tr');
    b.head.forEach((h, i) => hr.appendChild(cell('th', h, i))); thead.appendChild(hr); t.appendChild(thead);
    const tb = document.createElement('tbody');
    for (const r of b.rows) { const tr = document.createElement('tr'); r.forEach((c, i) => tr.appendChild(cell('td', c, i))); tb.appendChild(tr); }
    t.appendChild(tb); scroll.appendChild(t); wrap.appendChild(scroll);
    const bar = document.createElement('div'); bar.className = 'ed-table-bar';
    bar.innerHTML = ['row+|Add row', 'col+|Add column', 'row-|Remove row', 'col-|Remove column', 'align|Align column'].map((x) => '<button type="button" data-act="table" data-op="' + x.split('|')[0] + '">' + x.split('|')[1] + '</button>').join('');
    wrap.appendChild(bar);
    return wrap;
  }

  insertBlockEl(b, afterId) {
    const el = this.buildBlock(b);
    const ref = afterId ? this.el(afterId) : null;
    if (ref) ref.after(el); else this.root.insertBefore(el, this.root.querySelector('.ed-tail'));
    return el;
  }
  replaceBlockEl(b) { const old = this.el(b.id); const neu = this.buildBlock(b); if (old) old.replaceWith(neu); this.setReadOnly(this.readOnly); return neu; }

  /* --------------------------------------------------------------- model sync */
  edOf(target) { return target?.closest?.('[data-ed],[data-ed-title],[data-ed-caption]') || null; }
  blkOf(target) { return target?.closest?.('.blk') || null; }
  clean(el) { if (el.innerHTML === '<br>') el.innerHTML = ''; return sanitizeInline(el.innerHTML); }

  syncFrom(blkEl) {
    if (!blkEl) return;
    const b = this.block(blkEl.dataset.id); if (!b) return;
    const body = blkEl.querySelector('.blk-body');
    switch (b.type) {
      case 'p': case 'h2': case 'h3': b.html = this.clean(body.querySelector('[data-ed]')); break;
      case 'quote': b.html = this.clean(body.querySelector('[data-ed]')); break;
      case 'ul': case 'ol': b.items = $$(body, 'li').map((li) => this.clean(li)); break;
      case 'callout': b.title = inlineText(body.querySelector('[data-ed-title]').innerHTML); b.html = this.clean(body.querySelector('.ed-callout-body')); break;
      case 'image': { const cap = body.querySelector('[data-ed=cap]'); if (cap) b.caption = this.clean(cap); const alt = body.querySelector('[data-field=alt]'); if (alt) b.alt = alt.value; break; }
      case 'table': {
        const rows = $$(body, 'tr').map((tr) => $$(tr, '.ed-cell').map((c) => this.clean(c)));
        b.head = rows[0] || []; b.rows = rows.slice(1); break;
      }
      case 'code': b.text = body.querySelector('textarea').value; b.lang = body.querySelector('input').value; break;
      case 'html': b.html = body.querySelector('textarea').value; break;
      case 'video': break;
      default: break;
    }
  }
  flush() { $$(this.root, '.blk').forEach((el) => this.syncFrom(el)); }

  changed(structural = false) {
    if (structural) this.snapshotNow(); else { clearTimeout(this.hTimer); this.hTimer = setTimeout(() => this.snapshotNow(), 700); }
    clearTimeout(this.changeTimer);
    this.changeTimer = setTimeout(() => this.opts.onChange && this.opts.onChange(), 60);
    if (this.opts.onActivity) this.opts.onActivity();
  }
  snapshotNow() {
    clearTimeout(this.hTimer);
    this.flush();
    const snap = JSON.stringify(this.blocks.filter((b) => !b._uploading));
    if (snap === this.history[this.hIndex]) return;
    this.history = this.history.slice(0, this.hIndex + 1); this.history.push(snap);
    if (this.history.length > 120) this.history.shift();
    this.hIndex = this.history.length - 1;
  }
  undo() { this.snapshotNow(); if (this.hIndex <= 0) return; this.hIndex--; this.applySnapshot(); }
  redo() { if (this.hIndex >= this.history.length - 1) return; this.hIndex++; this.applySnapshot(); }
  applySnapshot() {
    const focusId = this.activeBlockId();
    this.blocks = JSON.parse(this.history[this.hIndex]); this.render();
    this.focusBlock(this.block(focusId) ? focusId : this.blocks[0]?.id, true);
    this.changed();
  }
  activeBlockId() { return this.blkOf(document.activeElement)?.dataset.id || null; }

  /* ------------------------------------------------------------ caret helpers */
  placeCaret(ed, atEnd = true) {
    if (!ed) return; ed.focus({ preventScroll: false });
    const r = document.createRange(); r.selectNodeContents(ed); r.collapse(!atEnd);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  setCaretOffset(ed, offset) {
    ed.focus();
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let left = offset; let node;
    while ((node = walker.nextNode())) {
      if (node.length >= left) { const r = document.createRange(); r.setStart(node, left); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; }
      left -= node.length;
    }
    this.placeCaret(ed, true);
  }
  focusBlock(id, atEnd = false) {
    const wrap = this.el(id); if (!wrap) return;
    const ed = wrap.querySelector('[data-ed]');
    if (ed) this.placeCaret(ed, atEnd); else (wrap.querySelector('input,textarea,.ed-hr') || wrap).focus?.();
  }
  caretInfo(ed) {
    const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return null;
    const r = s.getRangeAt(0);
    const pre = document.createRange(); pre.selectNodeContents(ed); pre.setEnd(r.startContainer, r.startOffset);
    const post = document.createRange(); post.selectNodeContents(ed); post.setStart(r.endContainer, r.endOffset);
    const toHtml = (frag) => { const d = document.createElement('div'); d.appendChild(frag); return sanitizeInline(d.innerHTML); };
    const before = toHtml(pre.cloneContents()); const after = toHtml(post.cloneContents());
    return { collapsed: r.collapsed, atStart: !pre.toString().length && !pre.cloneContents().querySelector('img,br'), atEnd: !post.toString().length, before, after, offset: pre.toString().length };
  }

  /* ---------------------------------------------------------------- events */
  onFocusIn(e) { const b = this.blkOf(e.target); $$(this.root, '.blk.is-active').forEach((x) => x !== b && x.classList.remove('is-active')); if (b) b.classList.add('is-active'); }
  onInput(e) {
    const t = e.target; const blk = this.blkOf(t); if (!blk) return;
    const ed = this.edOf(t);
    if (t.matches?.('[data-field]')) { this.syncFrom(blk); if (t.dataset.field === 'text') t.rows = Math.max(3, t.value.split('\n').length); this.changed(); return; }
    if (!ed) return;
    if (ed.innerHTML === '<br>') ed.innerHTML = '';
    const b = this.block(blk.dataset.id);
    if (b && b.type === 'p' && ed.matches('[data-ed]')) {
      const text = ed.textContent;
      if (this.menu?.kind === 'slash') { const m = text.match(/^\/([\w ]{0,20})$/); if (m) this.updateSlash(m[1]); else this.closeMenus(); }
      else if (/^\/[\w ]{0,20}$/.test(text) && e.inputType === 'insertText' && text.length === 1) this.openSlash(blk, ed);
      const md = this.markdownShortcut(b, blk, ed, text); if (md) return;
    }
    this.syncFrom(blk); this.changed();
  }
  markdownShortcut(b, blk, ed, text) {
    const rules = [[/^##\s$/, 'h2'], [/^###\s$/, 'h3'], [/^[-*]\s$/, 'ul'], [/^1[.)]\s$/, 'ol'], [/^>\s$/, 'quote']];
    for (const [re, type] of rules) {
      if (re.test(text.replace(/\u00a0/g, ' '))) { this.closeMenus(); this.convert(b, type, ''); return true; }
    }
    if (/^```$/.test(text)) { this.convert(b, 'code'); return true; }
    return false;
  }
  onClick(e) {
    const act = e.target.closest('[data-act]'); const blk = this.blkOf(e.target);
    if (!act || !blk) { if (!e.target.closest('.ed-menu')) this.closeMenus(); return; }
    const b = this.block(blk.dataset.id); const a = act.dataset.act;
    if (a === 'add') { this.openInsertMenu(blk, act); return; }
    if (a === 'menu') { this.openBlockMenu(blk, act); return; }
    if (a === 'comments') { this.opts.onComment && this.opts.onComment(b.id); return; }
    if (a === 'kind') { this.flush(); b.kind = act.dataset.kind; this.replaceBlockEl(b); this.focusBlock(b.id); this.changed(true); return; }
    if (a === 'pick-image' || a === 'replace-image') { this.pickImage(b); return; }
    if (a === 'image-url') { this.promptImageUrl(b); return; }
    if (a === 'table') { this.tableOp(b, blk, act.dataset.op); return; }
  }
  onKeydown(e) {
    if (this.readOnly) return;
    const mod = e.metaKey || e.ctrlKey;
    if (this.menu && this.handleMenuKey(e)) return;
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); return; }
    if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); this.redo(); return; }
    const t = e.target;
    if (t.matches?.('[data-field=url]') && e.key === 'Enter') { e.preventDefault(); this.applyVideo(t); return; }
    const ed = this.edOf(t); const blk = this.blkOf(t);
    if (!ed || !blk) {
      if (blk && (e.key === 'Backspace' || e.key === 'Delete') && t.classList?.contains('ed-hr')) { e.preventDefault(); this.removeBlock(blk.dataset.id, true); }
      return;
    }
    const b = this.block(blk.dataset.id);
    if (mod && ['b', 'i', 'u'].includes(e.key.toLowerCase())) { e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); this.syncFrom(blk); this.changed(); return; }
    if (mod && e.key.toLowerCase() === 'k' && !getSelection().isCollapsed) { e.preventDefault(); this.openLinkEditor(); return; }
    if (b.type === 'table') { this.tableKey(e, b, blk, ed); return; }
    if (ed.dataset.edTitle !== undefined || ed.dataset.ed === 'cap') { if (e.key === 'Enter') { e.preventDefault(); this.focusNext(blk); } return; }
    if (b.type === 'ul' || b.type === 'ol') { this.listKey(e, b, blk, ed); return; }
    if (b.type === 'callout') { if (e.key === 'Backspace' && !ed.textContent && this.caretInfo(ed)?.atStart) { e.preventDefault(); this.convert(b, 'p', ''); } return; }
    if (!TEXT_TYPES.has(b.type)) return;
    const info = this.caretInfo(ed);
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const text = ed.textContent;
      if (b.type === 'p' && /^---$/.test(text)) { this.convert(b, 'hr'); return; }
      if (b.type === 'p' && /^```\w*$/.test(text)) { this.convert(b, 'code'); return; }
      if (b.type === 'quote' && !text) { this.convert(b, 'p', ''); return; }
      this.splitBlock(b, blk, info);
      return;
    }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); document.execCommand('insertLineBreak'); return; }
    if (e.key === 'Backspace' && info && info.collapsed && info.atStart) { e.preventDefault(); this.backspaceAtStart(b, blk); return; }
    if (e.key === 'Delete' && info && info.collapsed && info.atEnd) { const next = this.blocks[this.blocks.indexOf(b) + 1]; if (next && next.type === 'p' && b.type === 'p') { e.preventDefault(); this.mergeNext(b, blk, next); } return; }
    if (e.key === 'ArrowUp' && info?.collapsed && this.onFirstLine(ed)) { const p = this.prevBlockEl(blk); if (p && p.querySelector('[data-ed]')) { e.preventDefault(); this.placeCaret(p.querySelector('[data-ed]:last-of-type, [data-ed]'), true); } }
    if (e.key === 'ArrowDown' && info?.collapsed && this.onLastLine(ed)) { const n = this.nextBlockEl(blk); if (n && n.querySelector('[data-ed]')) { e.preventDefault(); this.placeCaret(n.querySelector('[data-ed]'), false); } }
  }
  onFirstLine(ed) { const r = getSelection().getRangeAt(0).getClientRects()[0]; return !r || r.top - ed.getBoundingClientRect().top < parseFloat(getComputedStyle(ed).lineHeight || 20) * 0.9; }
  onLastLine(ed) { const r = getSelection().getRangeAt(0).getClientRects()[0]; return !r || ed.getBoundingClientRect().bottom - r.bottom < parseFloat(getComputedStyle(ed).lineHeight || 20) * 0.9; }
  prevBlockEl(blk) { let p = blk.previousElementSibling; while (p && !p.classList.contains('blk')) p = p.previousElementSibling; return p; }
  nextBlockEl(blk) { let n = blk.nextElementSibling; while (n && !n.classList.contains('blk')) n = n.nextElementSibling; return n; }
  focusNext(blk) { const n = this.nextBlockEl(blk); if (n) this.focusBlock(n.dataset.id); else { const nb = fresh('p'); this.blocks.push(nb); this.insertBlockEl(nb, blk.dataset.id); this.focusBlock(nb.id); this.changed(true); } }

  /* ----------------------------------------------------------- structure ops */
  splitBlock(b, blk, info) {
    this.flush(); this.snapshotNow();
    const ed = blk.querySelector('[data-ed]');
    const before = info ? info.before : this.clean(ed); const after = info ? info.after : '';
    b.html = before; ed.innerHTML = before;
    const nb = fresh(b.type === 'quote' ? 'quote' : 'p', { html: after });
    const idx = this.blocks.indexOf(b); this.blocks.splice(idx + 1, 0, nb);
    this.insertBlockEl(nb, b.id); this.focusBlock(nb.id, false); this.changed(true);
  }
  backspaceAtStart(b, blk) {
    this.flush();
    if (b.type !== 'p') { this.convert(b, 'p', b.html); return; }
    const idx = this.blocks.indexOf(b); const prev = this.blocks[idx - 1];
    if (!prev) return;
    if (TEXT_TYPES.has(prev.type) && prev.type !== 'quote') {
      const len = inlineText(prev.html).length;
      prev.html = sanitizeInline(prev.html + (b.html ? ' ' + b.html : '')).replace(/(\S)\s(<)/g, '$1 $2');
      this.blocks.splice(idx, 1); blk.remove();
      const pel = this.el(prev.id); pel.querySelector('[data-ed]').innerHTML = prev.html;
      this.setCaretOffset(pel.querySelector('[data-ed]'), len + (b.html ? 1 : 0)); this.changed(true);
    } else if (!inlineText(b.html)) { this.removeBlock(b.id, true); }
    else { const pel = this.el(prev.id); pel?.classList.add('is-flash'); setTimeout(() => pel?.classList.remove('is-flash'), 600); }
  }
  mergeNext(b, blk, next) {
    this.flush(); const len = inlineText(b.html).length;
    b.html = sanitizeInline(b.html + ' ' + next.html); this.blocks.splice(this.blocks.indexOf(next), 1); this.el(next.id)?.remove();
    blk.querySelector('[data-ed]').innerHTML = b.html; this.setCaretOffset(blk.querySelector('[data-ed]'), len + 1); this.changed(true);
  }
  removeBlock(id, focusPrev = false) {
    this.flush(); const idx = this.blocks.findIndex((x) => x.id === id); if (idx < 0) return;
    this.blocks.splice(idx, 1); this.el(id)?.remove();
    if (!this.blocks.length) { const nb = fresh('p'); this.blocks.push(nb); this.insertBlockEl(nb, null); this.focusBlock(nb.id); }
    else if (focusPrev) { const t = this.blocks[Math.max(0, idx - 1)]; this.focusBlock(t.id, true); }
    this.changed(true);
  }
  moveBlock(id, delta) {
    this.flush(); const idx = this.blocks.findIndex((x) => x.id === id); const to = idx + delta;
    if (idx < 0 || to < 0 || to >= this.blocks.length) return;
    const [b] = this.blocks.splice(idx, 1); this.blocks.splice(to, 0, b);
    const el = this.el(id); const ref = this.el(this.blocks[to + (delta > 0 ? -1 : 1)].id);
    if (delta > 0) ref.after(el); else ref.before(el);
    el.scrollIntoView({ block: 'nearest' }); this.changed(true);
  }
  duplicateBlock(id) { this.flush(); const b = this.block(id); const copy = JSON.parse(JSON.stringify(b)); copy.id = uid(); this.blocks.splice(this.blocks.indexOf(b) + 1, 0, copy); this.insertBlockEl(copy, id); this.changed(true); }
  // Convert a block to another type, keeping its text where it makes sense.
  convert(b, type, html) {
    this.flush();
    const text = html !== undefined ? html : (b.html || '');
    let nb;
    if (type.startsWith('callout-')) nb = fresh('callout', { kind: type.slice(8), html: text });
    else if (type === 'ul' || type === 'ol') nb = fresh(type, { items: Array.isArray(b.items) ? b.items : [text] });
    else if (type === 'timeline') {
      nb = fresh('h2', { html: 'Timeline' }); const list = fresh('ul', { items: ['<strong>Date</strong> — What happens', '<strong>Date</strong> — What happens'] });
      const idx = this.blocks.indexOf(b); this.blocks.splice(idx, 1, nb, list); this.render(); this.focusBlock(nb.id, true); this.changed(true); return;
    } else if (['p', 'h2', 'h3', 'quote'].includes(type)) nb = fresh(type, { html: Array.isArray(b.items) ? b.items.join('<br>') : text });
    else nb = fresh(type);
    nb.id = b.id;
    this.blocks[this.blocks.indexOf(b)] = nb;
    this.replaceBlockEl(nb);
    if (nb.type === 'image') this.pickImage(nb);
    else this.focusBlock(nb.id, true);
    this.changed(true);
  }
  insertAfter(blockObjs, afterId, focusFirst = true) {
    this.flush(); let ref = afterId; let first;
    const idx = afterId ? this.blocks.findIndex((x) => x.id === afterId) : this.blocks.length - 1;
    this.blocks.splice(idx + 1, 0, ...blockObjs);
    for (const nb of blockObjs) { this.insertBlockEl(nb, ref); ref = nb.id; first = first || nb; }
    if (focusFirst && first) this.focusBlock(first.id);
    this.changed(true);
  }

  /* ------------------------------------------------------------------ lists */
  listKey(e, b, blk, ed) {
    const li = ed.closest('li') || ed; const info = this.caretInfo(li);
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!li.textContent.trim()) {
        const items = $$(blk, 'li'); this.flush();
        if (items.length === 1) { this.convert(b, 'p', ''); return; }
        li.remove(); this.syncFrom(blk);
        const nb = fresh('p'); this.blocks.splice(this.blocks.indexOf(b) + 1, 0, nb); this.insertBlockEl(nb, b.id); this.focusBlock(nb.id); this.changed(true); return;
      }
      const n = this.edEl('li', info ? info.after : '', 'List item');
      li.innerHTML = info ? info.before : li.innerHTML; li.after(n); this.placeCaret(n, false); this.syncFrom(blk); this.changed(true); return;
    }
    if (e.key === 'Backspace' && info && info.collapsed && info.atStart) {
      e.preventDefault(); const items = $$(blk, 'li'); const i = items.indexOf(li);
      if (i === 0) { this.flush(); this.convert(b, 'p', items.length === 1 ? '' : undefined); if (items.length > 1) { /* keep remaining items as text */ } return; }
      const prev = items[i - 1]; const len = prev.textContent.length; prev.innerHTML = sanitizeInline(prev.innerHTML + ' ' + li.innerHTML); li.remove(); this.setCaretOffset(prev, len + 1); this.syncFrom(blk); this.changed(true);
    }
  }

  /* ------------------------------------------------------------------ tables */
  tableKey(e, b, blk, ed) {
    if (e.key === 'Tab') {
      e.preventDefault(); const cells = $$(blk, '.ed-cell'); const i = cells.indexOf(ed);
      if (e.shiftKey) { if (i > 0) this.placeCaret(cells[i - 1], true); return; }
      if (i === cells.length - 1) { this.tableOp(b, blk, 'row+'); return; }
      this.placeCaret(cells[i + 1], true);
    }
    if (e.key === 'Enter') { e.preventDefault(); const cells = $$(blk, '.ed-cell'); const cols = b.head.length; const n = cells[cells.indexOf(ed) + cols]; if (n) this.placeCaret(n, true); }
  }
  tableOp(b, blk, op) {
    this.flush(); const cols = b.head.length;
    const ed = document.activeElement.closest?.('.ed-cell'); const cells = $$(blk, '.ed-cell'); const idx = ed ? cells.indexOf(ed) : cells.length - 1;
    const col = Math.max(0, idx % cols); const row = Math.floor(idx / cols) - 1;
    if (op === 'row+') b.rows.splice(Math.max(row, -1) + 1, 0, Array(cols).fill(''));
    if (op === 'row-' && b.rows.length > 1) b.rows.splice(Math.max(row, 0), 1);
    if (op === 'col+') { b.head.splice(col + 1, 0, ''); b.rows.forEach((r) => r.splice(col + 1, 0, '')); b.align.splice(col + 1, 0, 'left'); }
    if (op === 'col-' && cols > 1) { b.head.splice(col, 1); b.rows.forEach((r) => r.splice(col, 1)); b.align.splice(col, 1); }
    if (op === 'align') { const order = ['left', 'center', 'right']; b.align[col] = order[(order.indexOf(b.align[col]) + 1) % 3]; }
    this.replaceBlockEl(b);
    const fresh1 = this.el(b.id); const nc = $$(fresh1, '.ed-cell'); const nCols = b.head.length;
    const target = op.startsWith('row') ? Math.min(nc.length - 1, (Math.max(row, 0) + (op === 'row+' ? 1 : 0) + 1) * nCols + col) : Math.min(nc.length - 1, col + (op === 'col+' ? 1 : 0));
    if (nc[target]) this.placeCaret(nc[target], true);
    this.changed(true);
  }

  /* ------------------------------------------------------------------ images */
  pickImage(b) {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.multiple = false;
    input.onchange = () => { if (input.files[0]) this.uploadInto(input.files[0], b.id); };
    input.click();
  }
  promptImageUrl(b) {
    if (!this.opts.prompt) return;
    this.opts.prompt({ title: 'Image link', label: 'Direct link to the image (https)', placeholder: 'https://', confirm: 'Add image' }).then((url) => {
      if (!url) return; if (!/^https:\/\//i.test(url)) { this.opts.toast && this.opts.toast('Use a link that starts with https://', 'error'); return; }
      b.src = url; b._uploading = false; this.replaceBlockEl(b); this.changed(true);
    });
  }
  async uploadInto(file, blockId, afterId) {
    if (!this.opts.upload) return;
    let b = blockId ? this.block(blockId) : null;
    if (!b) { b = fresh('image'); const idx = afterId ? this.blocks.findIndex((x) => x.id === afterId) : this.blocks.length - 1; this.blocks.splice(idx + 1, 0, b); this.insertBlockEl(b, afterId || this.blocks[idx]?.id || null); }
    b._uploading = true; b._name = file.name; b._progress = 0; this.replaceBlockEl(b);
    try {
      const url = await this.opts.upload(file, (p) => { b._progress = p; const bar = this.el(b.id)?.querySelector('.ed-image-wait i'); if (bar) bar.style.setProperty('--p', p + '%'); });
      b._uploading = false; b.src = url; b.alt = b.alt || ''; delete b._progress; this.replaceBlockEl(b); this.changed(true);
    } catch (err) {
      b._uploading = false; this.replaceBlockEl(b); this.opts.toast && this.opts.toast(err?.message || 'Upload failed', 'error');
      if (!b.src) this.removeBlock(b.id);
    }
  }
  applyVideo(input) {
    const blk = this.blkOf(input); const b = this.block(blk.dataset.id); const id = youtubeId(input.value);
    if (!id) { this.opts.toast && this.opts.toast('That does not look like a YouTube link', 'error'); return; }
    b.url = 'https://www.youtube.com/watch?v=' + id; this.replaceBlockEl(b); this.changed(true);
  }

  /* -------------------------------------------------------------------- paste */
  onPaste(e) {
    if (this.readOnly) return;
    const t = e.target; const ed = this.edOf(t); const blk = this.blkOf(t);
    const dt = e.clipboardData; if (!dt) return;
    const files = Array.from(dt.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); const after = blk?.dataset.id; files.forEach((f) => this.uploadInto(f, null, after)); return; }
    if (t.matches?.('input,textarea')) return;
    if (!ed || !blk) return;
    const b = this.block(blk.dataset.id);
    const html = dt.getData('text/html'); const text = dt.getData('text/plain') || '';
    e.preventDefault();
    const sel = getSelection().toString();
    if (/^https?:\/\/\S+$/.test(text.trim()) && sel) { document.execCommand('createLink', false, text.trim()); this.syncFrom(blk); this.changed(); return; }
    if (b.type === 'p' && !ed.textContent.trim() && youtubeId(text.trim())) { this.convert(b, 'video'); const nb = this.block(b.id); nb.url = 'https://www.youtube.com/watch?v=' + youtubeId(text.trim()); this.replaceBlockEl(nb); this.changed(true); return; }
    let blocks;
    if (html && /<(p|h[1-6]|ul|ol|table|blockquote|img|div|br)\b/i.test(html)) blocks = htmlToBlocks(html);
    else if (/^\s{0,3}(#{1,3}\s|[-*]\s|\d+[.)]\s|>\s|\|.*\||```)/m.test(text) || /\n\s*\n/.test(text)) blocks = markdownToBlocks(text);
    else blocks = null;
    const single = blocks && blocks.length === 1 && blocks[0].type === 'p';
    if (!blocks || single) { const inline = single ? blocks[0].html : escapeText(text).replace(/\r?\n/g, '<br>'); document.execCommand('insertHTML', false, inline); this.syncFrom(blk); this.changed(); return; }
    if (!blocks.length) return;
    const empty = b.type === 'p' && !ed.textContent.trim();
    const info = !empty && TEXT_TYPES.has(b.type) ? this.caretInfo(ed) : null;
    this.flush(); this.snapshotNow();
    if (info && !info.atEnd) {
      // paste in the middle of a paragraph: split it around the pasted blocks
      b.html = info.before; ed.innerHTML = info.before;
      const tail = fresh(b.type === 'quote' ? 'quote' : 'p', { html: info.after });
      this.insertAfter([...blocks, tail], b.id, false); this.focusBlock(blocks[blocks.length - 1].id, true);
    } else if (empty) {
      const idx = this.blocks.indexOf(b); this.blocks.splice(idx, 1, ...blocks); this.render(); this.focusBlock(blocks[blocks.length - 1].id, true); this.changed(true);
    } else { this.insertAfter(blocks, b.id, false); this.focusBlock(blocks[blocks.length - 1].id, true); }
    this.changed(true);
  }

  /* ----------------------------------------------------------------- drag/drop */
  onDragStart(e) {
    const h = e.target.closest?.('.blk-handle'); if (!h) return;
    const blk = this.blkOf(h); this.dragId = blk.dataset.id; this.flush();
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-blk', this.dragId);
    try { e.dataTransfer.setDragImage(blk, 24, 14); } catch { /* ignore */ }
    blk.classList.add('is-dragging');
  }
  dropTarget(e) {
    const blocks = $$(this.root, '.blk:not(.is-dragging)'); let best = null;
    for (const el of blocks) { const r = el.getBoundingClientRect(); if (e.clientY >= r.top && e.clientY <= r.bottom) { best = { el, after: e.clientY > r.top + r.height / 2 }; break; } }
    if (!best && blocks.length) { const last = blocks[blocks.length - 1]; if (e.clientY > last.getBoundingClientRect().bottom) best = { el: last, after: true }; else best = { el: blocks[0], after: false }; }
    return best;
  }
  onDragOver(e) {
    if (this.readOnly) return;
    const hasFiles = Array.from(e.dataTransfer?.types || []).includes('Files');
    if (!this.dragId && !hasFiles) return;
    e.preventDefault(); e.dataTransfer.dropEffect = this.dragId ? 'move' : 'copy';
    const t = this.dropTarget(e); this.clearDrop(); if (!t) return;
    t.el.classList.add(t.after ? 'drop-after' : 'drop-before');
  }
  clearDrop() { $$(this.root, '.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after')); }
  onDrop(e) {
    if (this.readOnly) return;
    const t = this.dropTarget(e); this.clearDrop();
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length && t) { e.preventDefault(); let after = t.after ? t.el.dataset.id : this.prevBlockEl(t.el)?.dataset.id; for (const f of files) { this.uploadInto(f, null, after); } return; }
    if (!this.dragId || !t) return;
    e.preventDefault();
    const id = this.dragId; this.dragId = null; this.el(id)?.classList.remove('is-dragging');
    if (t.el.dataset.id === id) return;
    const idx = this.blocks.findIndex((x) => x.id === id); const [b] = this.blocks.splice(idx, 1);
    let to = this.blocks.findIndex((x) => x.id === t.el.dataset.id) + (t.after ? 1 : 0);
    this.blocks.splice(to, 0, b);
    const el = this.el(id); if (t.after) t.el.after(el); else t.el.before(el);
    this.changed(true);
  }

  /* --------------------------------------------------- menus: slash / block / insert */
  closeMenus() { if (this.menu) { this.menu.el.remove(); this.menu = null; } if (this.linkBox) { this.linkBox.remove(); this.linkBox = null; } }
  placeMenu(menuEl, rect) {
    document.body.appendChild(menuEl);
    const w = menuEl.offsetWidth; const h = menuEl.offsetHeight;
    let left = Math.min(Math.max(8, rect.left), innerWidth - w - 8); let top = rect.bottom + 6;
    if (top + h > innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    menuEl.style.left = left + 'px'; menuEl.style.top = top + 'px';
  }
  listMenu(items, onPick, extraClass = '') {
    const el = document.createElement('div'); el.className = 'ed-menu ' + extraClass; el.setAttribute('role', 'listbox');
    const render = (list, active) => {
      el.innerHTML = list.length ? list.map((it, i) => it.sep ? '<div class="ed-menu-sep"></div>' : '<button type="button" role="option" class="ed-menu-item' + (i === active ? ' on' : '') + (it.danger ? ' danger' : '') + '" data-i="' + i + '"><span class="ed-menu-ic">' + icon(it.icon || 'text', 18) + '</span><span><b>' + escapeText(it.label) + '</b>' + (it.hint ? '<i>' + escapeText(it.hint) + '</i>' : '') + '</span></button>').join('') : '<div class="ed-menu-empty">No matches</div>';
    };
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('click', (e) => { const b = e.target.closest('.ed-menu-item'); if (b && this.menu) { const it = this.menu.items[Number(b.dataset.i)]; onPick(it); } });
    return { el, render };
  }
  openSlash(blk, ed) {
    this.closeMenus();
    const { el, render } = this.listMenu(SLASH_ITEMS, (it) => this.pickSlash(it));
    this.menu = { kind: 'slash', el, render, items: SLASH_ITEMS.slice(), active: 0, blockId: blk.dataset.id };
    render(this.menu.items, 0); this.placeMenu(el, ed.getBoundingClientRect());
  }
  updateSlash(query) {
    const q = query.trim().toLowerCase();
    this.menu.items = SLASH_ITEMS.filter((i) => !q || (i.label + ' ' + i.keys).toLowerCase().includes(q));
    this.menu.active = 0; this.menu.render(this.menu.items, 0);
    if (!this.menu.items.length) { this.menu.render([], -1); }
  }
  pickSlash(it) {
    if (!it) return; const id = this.menu.blockId; this.closeMenus();
    const b = this.block(id); if (!b) return;
    const blk = this.el(id); blk.querySelector('[data-ed]').innerHTML = ''; b.html = '';
    this.convert(b, it.id, '');
  }
  openInsertMenu(blk, anchor) {
    this.closeMenus(); const afterId = blk.dataset.id;
    const items = SLASH_ITEMS.filter((i) => i.id !== 'p');
    const { el, render } = this.listMenu(items, (it) => { this.closeMenus(); const nb = fresh('p'); this.insertAfter([nb], afterId, false); this.convert(nb, it.id, ''); });
    this.menu = { kind: 'insert', el, render, items, active: 0 }; render(items, 0); this.placeMenu(el, anchor.getBoundingClientRect());
  }
  openBlockMenu(blk, anchor) {
    this.closeMenus(); const b = this.block(blk.dataset.id); this.flush();
    const items = [];
    if (TEXT_TYPES.has(b.type) || b.type === 'ul' || b.type === 'ol') {
      for (const [id, label, ic] of [['p', 'Text', 'text'], ['h2', 'Heading', 'h2'], ['h3', 'Subheading', 'h3'], ['ul', 'Bullet list', 'ul'], ['ol', 'Numbered list', 'ol'], ['quote', 'Quote', 'quote'], ['callout-tip', 'Callout', 'callout']]) {
        if (id !== b.type) items.push({ id: 'to:' + id, label: 'Turn into ' + label.toLowerCase(), icon: ic });
      }
      items.push({ sep: true });
    }
    if (this.opts.onComment) items.push({ id: 'comment', label: 'Comment', icon: 'comment' });
    items.push({ id: 'dup', label: 'Duplicate', icon: 'copy' }, { id: 'up', label: 'Move up', icon: 'up' }, { id: 'down', label: 'Move down', icon: 'down' }, { sep: true }, { id: 'del', label: 'Delete', icon: 'trash', danger: true });
    const { el, render } = this.listMenu(items, (it) => {
      this.closeMenus();
      if (it.id.startsWith('to:')) this.convert(b, it.id.slice(3));
      else if (it.id === 'comment') this.opts.onComment(b.id, true);
      else if (it.id === 'dup') this.duplicateBlock(b.id);
      else if (it.id === 'up') this.moveBlock(b.id, -1);
      else if (it.id === 'down') this.moveBlock(b.id, 1);
      else if (it.id === 'del') this.removeBlock(b.id, true);
    }, 'ed-menu--block');
    this.menu = { kind: 'block', el, render, items, active: -1 }; render(items, -1); this.placeMenu(el, anchor.getBoundingClientRect());
  }
  handleMenuKey(e) {
    const m = this.menu; const selectable = m.items.map((x, i) => (x.sep ? -1 : i)).filter((i) => i >= 0);
    if (e.key === 'Escape') { e.preventDefault(); this.closeMenus(); return true; }
    if (!selectable.length) return false;
    if (m.kind === 'slash' || m.kind === 'insert') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const pos = selectable.indexOf(m.active); const n = selectable[(pos + (e.key === 'ArrowDown' ? 1 : -1) + selectable.length) % selectable.length]; m.active = n; m.render(m.items, n); m.el.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); return true; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const it = m.items[m.active]; if (it) { m.kind === 'slash' ? this.pickSlash(it) : m.el.querySelector('.on')?.click(); } return true; }
      if (m.kind === 'slash' && e.key === ' ' && !m.items.length) { this.closeMenus(); }
    }
    return false;
  }

  /* ------------------------------------------------------- inline format bar */
  buildFormatBar() {
    const bar = document.createElement('div'); bar.className = 'ed-fmt'; bar.hidden = true;
    const btn = (cmd, ic, label) => '<button type="button" data-cmd="' + cmd + '" aria-label="' + label + '" title="' + label + '">' + icon(ic, 16) + '</button>';
    bar.innerHTML = btn('bold', 'bold', 'Bold (Ctrl+B)') + btn('italic', 'italic', 'Italic (Ctrl+I)') + btn('underline', 'underline', 'Underline') + btn('strikeThrough', 'strike', 'Strikethrough') + '<span class="sep"></span>' + btn('code', 'code', 'Code') + btn('mark', 'mark', 'Highlight') + btn('link', 'link', 'Link (Ctrl+K)');
    bar.addEventListener('mousedown', (e) => e.preventDefault());
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; const cmd = b.dataset.cmd; const blk = this.blkOf(document.activeElement);
      if (cmd === 'link') { this.openLinkEditor(); return; }
      if (cmd === 'code' || cmd === 'mark') this.toggleWrap(cmd === 'code' ? 'code' : 'mark'); else document.execCommand(cmd);
      if (blk) { this.syncFrom(blk); this.changed(); } this.onSelectionChange();
    });
    document.body.appendChild(bar); return bar;
  }
  toggleWrap(tag) {
    const s = getSelection(); if (!s.rangeCount) return; const r = s.getRangeAt(0);
    const within = (node) => (node.nodeType === 3 ? node.parentElement : node)?.closest?.(tag);
    const ex = within(r.commonAncestorContainer);
    if (ex) { const txt = document.createTextNode(ex.textContent); ex.replaceWith(txt); return; }
    const text = s.toString(); if (!text) return;
    document.execCommand('insertHTML', false, '<' + tag + '>' + escapeText(text) + '</' + tag + '>');
  }
  onSelectionChange() {
    if (this.readOnly) { this.fmt.hidden = true; return; }
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed) { if (!this.linkBox) this.fmt.hidden = true; return; }
    const node = s.anchorNode?.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode;
    const ed = node?.closest?.('[data-ed],[data-ed-title],[data-ed-caption]');
    if (!ed || !this.root.contains(ed) || ed.matches('.ed-cell') && false) { this.fmt.hidden = true; return; }
    const rect = s.getRangeAt(0).getBoundingClientRect(); if (!rect.width) { this.fmt.hidden = true; return; }
    this.fmt.hidden = false; const w = this.fmt.offsetWidth;
    this.fmt.style.left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), innerWidth - w - 8) + 'px';
    this.fmt.style.top = Math.max(8, rect.top - this.fmt.offsetHeight - 10) + 'px';
    for (const b of this.fmt.querySelectorAll('[data-cmd]')) {
      const c = b.dataset.cmd; let on = false;
      try { on = c === 'code' || c === 'mark' ? !!node.closest(c) : c === 'link' ? !!node.closest('a') : document.queryCommandState(c); } catch { on = false; }
      b.classList.toggle('on', on);
    }
  }
  openLinkEditor() {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) { this.opts.toast && this.opts.toast('Select some text first, then add a link', 'info'); return; }
    const range = s.getRangeAt(0).cloneRange(); const existing = (range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer).closest?.('a');
    const rect = range.getBoundingClientRect(); this.closeMenus();
    const box = document.createElement('div'); box.className = 'ed-link';
    box.innerHTML = '<input type="url" placeholder="Paste or type a link" value="' + escapeAttr(existing?.getAttribute('href') || '') + '"><button type="button" class="ok">Apply</button>' + (existing ? '<button type="button" class="rm">Remove</button>' : '');
    document.body.appendChild(box); this.linkBox = box;
    box.style.left = Math.min(Math.max(8, rect.left), innerWidth - 340) + 'px'; box.style.top = (rect.bottom + 8) + 'px';
    const input = box.querySelector('input'); input.focus(); input.select();
    const done = () => { box.remove(); this.linkBox = null; };
    const apply = () => {
      let v = input.value.trim(); done();
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      if (!v) return; if (!/^(https?:|mailto:|\/|#)/i.test(v)) v = 'https://' + v;
      document.execCommand('createLink', false, v);
      const blk = this.blkOf(range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer); if (blk) { this.syncFrom(blk); this.changed(true); }
    };
    box.querySelector('.ok').onclick = apply;
    const rm = box.querySelector('.rm'); if (rm) rm.onclick = () => { done(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); document.execCommand('unlink'); const blk = this.blkOf(range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer); if (blk) { this.syncFrom(blk); this.changed(true); } };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } if (e.key === 'Escape') { done(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); } });
  }

  toHtml() { return blocksToHtml(this.getDoc().blocks); }
}
