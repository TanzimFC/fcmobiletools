// Browser toolkit shared by /leagues and /leagues/[slug]:
// toasts, sheets, image uploads (with the 7-day / permanent policy), lightbox, player card, guided apply.
import { accountAuth } from './account-client.js';
import { esc, INFO, divisionBadge, ICON, crest, fmt, ring } from './league-card.js';
import { LISTING_RULES, DIVISIONS, GALLERY_MAX, APPLICATION_SHOT_DAYS, NOTE_MAX, divisionIcon } from '../data/leagueConfig.js';
import { fitFor, applicationStrength, noteSuggestions } from './league-smart.js';

export const REGIONS = ['Worldwide', 'Asia', 'Europe', 'North America', 'South America', 'Africa', 'Middle East', 'Other'];
export const LANGS = ['English', 'Bengali', 'Indonesian', 'Arabic', 'Spanish', 'French', 'Portuguese', 'Other'];
export const SIZES = ['4v4', '8v8', '16v16', '32v32'];
export const STYLES = ['Competitive', 'Active and relaxed', 'Casual', 'Quest focused', 'Building a new team'];
export const AVAIL = ['Daily', 'Most days', 'Weekends', 'Evenings', 'Flexible', 'Casual / whenever'];

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } }
};
export { store };

// ───────────── toast ─────────────
export function toast(message, error = false) {
  let host = $('#lgToasts');
  if (!host) { host = document.createElement('div'); host.id = 'lgToasts'; host.className = 'lg-toasts'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const n = document.createElement('div');
  n.className = 'lg-toast' + (error ? ' error' : '');
  n.innerHTML = '<span class="lg-toast-ico">' + (error ? '!' : ICON.check) + '</span><span></span>';
  n.lastChild.textContent = message;
  host.appendChild(n);
  requestAnimationFrame(() => n.classList.add('show'));
  while (host.children.length > 3) host.firstChild.remove();
  setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, error ? 5200 : 3600);
}

// ───────────── auth + api ─────────────
export async function token() {
  try { const r = await accountAuth.auth.getSession(); return r.data?.session?.access_token || ''; } catch { return ''; }
}
export async function api(path, options = {}) {
  const accessToken = await token();
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('authorization', 'Bearer ' + accessToken);
  if (options.body && !(options.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
  let res;
  try { res = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: options.cache || 'no-store' }); }
  catch { const e = new Error('No connection. Check your internet and try again.'); e.status = 0; throw e; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(body.error || 'Something went wrong. Please try again.'); e.status = res.status; e.body = body; throw e; }
  return body;
}
export const signInUrl = (next) => '/account/?next=' + encodeURIComponent(next || location.pathname + location.search + location.hash);

// ───────────── sheets (bottom sheet on phones, centred dialog on desktop) ─────────────
let sheetStack = [];
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function openSheet(html, { wide = false, label = 'Dialog', onClose, className = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'lg-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
  el.innerHTML = '<div class="lg-modal-card' + (wide ? ' wide' : '') + (className ? ' ' + className : '') + '"><span class="lg-grab" aria-hidden="true"></span><button type="button" class="lg-sheet-x" data-sheet-close aria-label="Close">' + ICON.close + '</button><div class="lg-modal-scroll">' + html + '</div></div>';
  const prev = document.activeElement;
  const sheet = {
    el, body: el.querySelector('.lg-modal-scroll'), card: el.querySelector('.lg-modal-card'),
    set(h) { sheet.body.innerHTML = h; },
    close(result) {
      if (!el.isConnected || sheet.closing) return;
      sheet.closing = true; el.classList.add('out');
      const done = () => {
        el.remove(); sheetStack = sheetStack.filter(s => s !== sheet);
        if (!sheetStack.length) document.body.classList.remove('lg-lock');
        if (prev?.isConnected) { try { prev.focus({ preventScroll: true }); } catch { /* element gone */ } }
        onClose?.(result);
      };
      reduced() ? done() : setTimeout(done, 180);
    }
  };
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-sheet-close]')) sheet.close(); });
  document.body.appendChild(el); document.body.classList.add('lg-lock'); sheetStack.push(sheet);
  requestAnimationFrame(() => el.classList.add('in'));
  (el.querySelector('[autofocus]') || el.querySelector('input:not([type=file]),select,textarea,button:not(.lg-sheet-x)'))?.focus({ preventScroll: true });
  return sheet;
}
document.addEventListener('keydown', e => {
  const top = sheetStack[sheetStack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') { top.close(); return; }
  if (e.key === 'Tab') {
    const f = $$(FOCUSABLE, top.el).filter(n => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ───────────── info buttons ─────────────
export function bindInfo() {
  if (bindInfo.done) return; bindInfo.done = true;
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-info]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const [title, text] = INFO[b.dataset.info] || ['Help', ''];
    const s = openSheet('<div class="lg-sheet-head"><h3>' + esc(title) + '</h3></div><p class="lg-info-text">' + text + '</p><div class="lg-modal-actions"><button class="lg-btn lg-btn-primary" type="button" data-sheet-close>Got it</button></div>', { label: title });
    if (b.dataset.info === 'division') s.el.querySelector('.lg-info-text').innerHTML = '<span class="lg-div-list">' + DIVISIONS.map(d => '<span>' + divisionBadge(d.key, { range: true }) + '</span>').join('') + '</span>';
  });
}

// ───────────── lightbox ─────────────
export function openLightbox(items, start = 0) {
  const list = (items || []).filter(i => i && i.src);
  if (!list.length) return null;
  let i = Math.max(0, Math.min(start, list.length - 1));
  const el = document.createElement('div');
  el.className = 'lg-lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Image viewer');
  el.innerHTML = '<button type="button" class="lg-lb-x" data-lb-close aria-label="Close">' + ICON.close + '</button>' +
    (list.length > 1 ? '<button type="button" class="lg-lb-nav prev" data-lb="-1" aria-label="Previous image">' + ICON.arrow + '</button><button type="button" class="lg-lb-nav next" data-lb="1" aria-label="Next image">' + ICON.arrow + '</button>' : '') +
    '<figure><img alt="" referrerpolicy="no-referrer"><figcaption></figcaption></figure><div class="lg-lb-count"></div>';
  const img = $('img', el), cap = $('figcaption', el), count = $('.lg-lb-count', el);
  const show = () => {
    img.classList.remove('zoom'); img.style.transformOrigin = '';
    img.src = list[i].src; cap.textContent = list[i].caption || ''; count.textContent = list.length > 1 ? (i + 1) + ' / ' + list.length : '';
    img.onerror = () => { img.removeAttribute('src'); cap.textContent = list[i].missing || 'This image is no longer available.'; };
  };
  const close = () => { document.removeEventListener('keydown', key, true); el.classList.remove('in'); setTimeout(() => { el.remove(); if (!sheetStack.length) document.body.classList.remove('lg-lock'); }, reduced() ? 0 : 160); };
  const step = (d) => { i = (i + d + list.length) % list.length; show(); };
  function key(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight' && list.length > 1) step(1);
    else if (e.key === 'ArrowLeft' && list.length > 1) step(-1);
  }
  el.addEventListener('click', e => {
    if (e.target.closest('[data-lb-close]') || e.target === el || e.target.tagName === 'FIGURE') return close();
    const n = e.target.closest('[data-lb]'); if (n) return step(Number(n.dataset.lb));
    if (e.target === img) {
      const r = img.getBoundingClientRect();
      img.style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + '% ' + ((e.clientY - r.top) / r.height * 100) + '%';
      img.classList.toggle('zoom');
    }
  });
  let x0 = null;
  el.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  el.addEventListener('touchend', e => { if (x0 == null || list.length < 2) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); x0 = null; }, { passive: true });
  document.addEventListener('keydown', key, true);
  document.body.appendChild(el); document.body.classList.add('lg-lock'); show();
  requestAnimationFrame(() => el.classList.add('in'));
  return { close };
}

// ───────────── image upload ─────────────
// `purpose` is the only thing that matters for retention, and the Worker enforces it:
//   application → deleted automatically after 7 days
//   crest | gallery | avatar → permanent
const IMG_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 8 * 1024 * 1024;
export const PURPOSE_NOTE = {
  application: 'Deleted automatically after ' + APPLICATION_SHOT_DAYS + ' days',
  crest: 'Permanent · stays with your league', gallery: 'Permanent · stays with your league', avatar: 'Permanent · stays with your account'
};

async function detectImageType(file) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return 'image/gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return '';
}
// Big phone screenshots are shrunk before upload: faster, and the owner still reads every detail.
async function shrink(file, maxSide = 1600) {
  if (file.type === 'image/gif' || file.size < 250 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.82));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' }) : file;
  } catch { return file; }
}

export async function uploadImage(file, { onProgress, signal, purpose = 'application' } = {}) {
  if (!file || typeof file.slice !== 'function' || file.size <= 0 || file.size > MAX_BYTES) throw new Error('Choose an image under 8 MB.');
  if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { cancelled: true });
  const accessToken = await token();
  if (!accessToken) throw new Error('Sign in again before uploading.');
  onProgress?.({ phase: 'preparing', pct: 0 });
  let detected = '';
  try { detected = await detectImageType(file); } catch { /* reported below */ }
  if (!detected || !IMG_OK.includes(detected)) throw new Error('This image format is not supported. Use a JPG, PNG, WebP or GIF.');
  const input = file.type === detected ? file : new File([file], file.name || ('image.' + detected.split('/')[1]), { type: detected });
  const prepared = await shrink(input, purpose === 'crest' || purpose === 'avatar' ? 800 : 1600);
  if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { cancelled: true });

  const permanent = purpose !== 'application';
  const body = new FormData();
  body.append('file', prepared);
  body.append('purpose', purpose);
  // Legacy fields keep working against an older Worker; the new Worker ignores them in favour of `purpose`.
  body.append('permanent', String(permanent));
  if (!permanent) body.append('expirationDays', String(APPLICATION_SHOT_DAYS));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => signal?.removeEventListener('abort', abortUpload);
    const fail = (e) => { if (settled) return; settled = true; cleanup(); reject(e); };
    const finish = (v) => { if (settled) return; settled = true; cleanup(); resolve(v); };
    const abortUpload = () => xhr.abort();
    xhr.open('POST', '/api/account/image-upload');
    xhr.setRequestHeader('authorization', 'Bearer ' + accessToken);
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      try { onProgress?.({ phase: ev.loaded >= ev.total ? 'finishing' : 'uploading', pct: Math.round(ev.loaded / ev.total * 100) }); } catch { /* a progress UI must not break the upload */ }
    };
    xhr.onerror = () => fail(new Error('Upload failed. Check your connection and try again.'));
    xhr.onabort = () => fail(Object.assign(new Error('Upload cancelled.'), { cancelled: true }));
    xhr.onload = () => {
      let result = {};
      try { result = JSON.parse(xhr.responseText || '{}'); } catch { /* empty response */ }
      if (xhr.status < 200 || xhr.status >= 300) return fail(new Error(result.error || 'Image upload failed. Please try again.'));
      const url = result.image?.url || result.url || result.imageUrl || result.data?.url || result.data?.display_url || '';
      if (!url) return fail(new Error('The image service returned no image link. Try again.'));
      finish(url);
    };
    if (signal?.aborted) return fail(Object.assign(new Error('Upload cancelled.'), { cancelled: true }));
    signal?.addEventListener('abort', abortUpload, { once: true });
    try { xhr.send(body); } catch { fail(new Error('The upload could not start. Please try again.')); }
  });
}

const imageFrom = (list) => [...(list || [])].find(f => f && /^image\//.test(f.type || '')) || null;

// Single-image uploader: drop, click or paste. idle → uploading (progress) → done (preview).
export function mountUploader(root, { label, hint, value = '', onChange, round = false, purpose = 'application', paste = false, wide = false } = {}) {
  root.classList.add('lg-up'); if (wide) root.classList.add('wide');
  const note = PURPOSE_NOTE[purpose] || '';
  root.innerHTML =
    '<label class="lg-up-drop" tabindex="0"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif"><span class="lg-up-ico">' + ICON.upload + '</span><span class="lg-up-txt"><b>' + esc(label) + '</b><small>' + esc(hint || 'JPG, PNG or WebP · under 8 MB') + (paste ? ' · or paste with Ctrl+V' : '') + '</small></span><em class="lg-up-chip ' + (purpose === 'application' ? 'temp' : 'perm') + '">' + esc(purpose === 'application' ? APPLICATION_SHOT_DAYS + ' days' : 'Permanent') + '</em></label>' +
    '<div class="lg-up-run" hidden><img alt="" class="lg-up-thumb' + (round ? ' round' : '') + '"><div class="lg-up-main"><b class="lg-up-name"></b><div class="lg-up-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><small class="lg-up-status" aria-live="polite"></small></div><button type="button" class="lg-link" data-up-cancel>Cancel</button></div>' +
    '<div class="lg-up-done" hidden><img alt="" class="lg-up-thumb' + (round ? ' round' : '') + '"><div class="lg-up-main"><b class="lg-up-ok"><span>' + ICON.check + '</span>Uploaded</b><small class="lg-up-fn"></small></div><div class="lg-up-btns"><button type="button" class="lg-link" data-up-replace>Replace</button><button type="button" class="lg-link danger" data-up-remove>Remove</button></div></div>' +
    '<div class="lg-up-err" hidden role="alert"></div>' + (note ? '<p class="lg-up-note">' + ICON.lock + esc(note) + '</p>' : '');
  const q = (s) => $(s, root);
  const input = q('input[type=file]'), drop = q('.lg-up-drop'), run = q('.lg-up-run'), done = q('.lg-up-done'), err = q('.lg-up-err');
  let url = value || '', working = false, ctrl = null, objectUrl = '';
  const show = (st) => { drop.hidden = st !== 'idle'; run.hidden = st !== 'run'; done.hidden = st !== 'done'; };
  const bar = (pct, text) => { q('.lg-up-bar i').style.width = pct + '%'; q('.lg-up-bar').setAttribute('aria-valuenow', String(pct)); q('.lg-up-status').textContent = text; };
  const setDone = (u, name) => { url = u; q('.lg-up-done .lg-up-thumb').src = objectUrl || u; q('.lg-up-fn').textContent = name || ''; err.hidden = true; show('done'); };
  url ? setDone(url, '') : show('idle');
  async function take(file) {
    if (!file || working) return;
    err.hidden = true; working = true; ctrl = new AbortController();
    if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = URL.createObjectURL(file);
    q('.lg-up-run .lg-up-thumb').src = objectUrl; q('.lg-up-name').textContent = file.name || 'Pasted image'; bar(0, 'Preparing…'); show('run');
    onChange?.({ busy: true });
    try {
      const u = await uploadImage(file, { signal: ctrl.signal, purpose, onProgress: ({ phase, pct }) => bar(phase === 'finishing' ? 100 : pct, phase === 'preparing' ? 'Preparing…' : phase === 'finishing' ? 'Almost done…' : 'Uploading ' + pct + '%') });
      bar(100, 'Done'); setDone(u, file.name || 'Pasted image'); onChange?.({ url: u, busy: false });
    } catch (e) {
      show(url ? 'done' : 'idle');
      if (!e.cancelled) { err.textContent = e.message; err.hidden = false; }
      onChange?.({ busy: false });
    } finally { working = false; ctrl = null; }
  }
  input.addEventListener('change', () => { const f = input.files?.[0]; input.value = ''; take(f); });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => take(imageFrom(e.dataTransfer?.files)));
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  if (paste) {
    const onPaste = (e) => {
      if (!root.isConnected) { document.removeEventListener('paste', onPaste); return; }
      if (root.offsetParent === null) return;
      const f = imageFrom(e.clipboardData?.files); if (f) { e.preventDefault(); take(f); }
    };
    document.addEventListener('paste', onPaste);
  }
  root.addEventListener('click', e => {
    if (e.target.closest('[data-up-cancel]')) ctrl?.abort();
    if (e.target.closest('[data-up-replace]')) input.click();
    if (e.target.closest('[data-up-remove]')) { url = ''; show('idle'); onChange?.({ url: '', busy: false }); }
  });
  return { value: () => url, busy: () => working, set(u) { url = u || ''; u ? setDone(u, '') : show('idle'); } };
}

// Multi-image gallery for league screenshots (permanent). Reorder, remove, add up to `max`.
export function mountGallery(root, { values = [], max = GALLERY_MAX, onChange } = {}) {
  root.classList.add('lg-gal');
  let urls = [...values].slice(0, max);
  const pending = new Map(); let seq = 0;
  const emit = () => onChange?.({ urls: [...urls], busy: pending.size > 0 });
  function draw() {
    const tiles = urls.map((u, i) => '<div class="lg-gal-tile" data-i="' + i + '"><img src="' + esc(u) + '" alt="League screenshot ' + (i + 1) + '" referrerpolicy="no-referrer"><span class="lg-gal-tools">' +
      (i > 0 ? '<button type="button" data-g="left" aria-label="Move earlier">' + ICON.arrow + '</button>' : '') +
      '<button type="button" data-g="del" aria-label="Remove screenshot">' + ICON.trash + '</button></span>' + (i === 0 ? '<em>Cover</em>' : '') + '</div>').join('');
    const ups = [...pending.entries()].map(([id, p]) => '<div class="lg-gal-tile busy" data-p="' + id + '"><img src="' + esc(p.preview) + '" alt=""><div class="lg-gal-bar"><i style="width:' + p.pct + '%"></i></div><button type="button" class="lg-gal-x" data-g="cancel" aria-label="Cancel upload">' + ICON.close + '</button></div>').join('');
    const room = urls.length + pending.size < max;
    root.innerHTML = '<div class="lg-gal-grid">' + tiles + ups + (room ? '<label class="lg-gal-add" tabindex="0"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple>' + ICON.plus + '<b>Add screenshot</b><small>' + (urls.length + pending.size) + ' / ' + max + '</small></label>' : '') + '</div>' +
      '<div class="lg-up-err" hidden role="alert"></div><p class="lg-up-note">' + ICON.lock + 'Permanent · stays with your league. Show your league table or tournament results.</p>';
    const add = $('.lg-gal-add', root);
    if (add) {
      const inp = $('input', add);
      inp.addEventListener('change', () => { const files = [...inp.files]; inp.value = ''; files.forEach(addFile); });
      add.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
      ['dragenter', 'dragover'].forEach(t => add.addEventListener(t, e => { e.preventDefault(); add.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(t => add.addEventListener(t, e => { e.preventDefault(); add.classList.remove('drag'); }));
      add.addEventListener('drop', e => [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type)).forEach(addFile));
    }
  }
  function say(msg) { const e = $('.lg-up-err', root); if (e) { e.textContent = msg; e.hidden = !msg; } }
  async function addFile(file) {
    if (urls.length + pending.size >= max) { say('You can add up to ' + max + ' screenshots.'); return; }
    const id = ++seq, ctrl = new AbortController();
    pending.set(id, { pct: 0, preview: URL.createObjectURL(file), ctrl }); draw(); emit();
    try {
      const u = await uploadImage(file, { purpose: 'gallery', signal: ctrl.signal, onProgress: ({ pct }) => { const p = pending.get(id); const bar = $('[data-p="' + id + '"] .lg-gal-bar i', root); if (p) p.pct = pct; if (bar) bar.style.width = pct + '%'; } });
      urls.push(u);
    } catch (e) { if (!e.cancelled) { pending.delete(id); draw(); say(e.message); pending.set(id, null); } }
    const p = pending.get(id); if (p?.preview) URL.revokeObjectURL(p.preview);
    pending.delete(id); draw(); emit();
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const tile = b.closest('.lg-gal-tile'); const i = Number(tile?.dataset.i);
    if (b.dataset.g === 'del') { urls.splice(i, 1); say(''); draw(); emit(); }
    else if (b.dataset.g === 'left' && i > 0) { [urls[i - 1], urls[i]] = [urls[i], urls[i - 1]]; draw(); emit(); }
    else if (b.dataset.g === 'cancel') pending.get(Number(tile.dataset.p))?.ctrl.abort();
  });
  draw();
  return { value: () => [...urls], busy: () => pending.size > 0 };
}

// ───────────── player card sheet ─────────────
const opt = (list, cur, ph) => (ph ? '<option value="">' + esc(ph) + '</option>' : '') + list.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
const chips = (name, list, sel) => list.map(v => '<label class="lg-chip"><input type="checkbox" name="' + name + '" value="' + esc(v) + '"' + ((sel || []).includes(v) ? ' checked' : '') + '><span>' + esc(v) + '</span></label>').join('');
const checked = (f, name) => $$('input[name="' + name + '"]:checked', f).map(i => i.value);
const toggle = (name, on, text, sub = '') => '<label class="lg-switch"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '><i></i><span><b>' + esc(text) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></label>';

export function openProfileSheet({ profile, suggested = {}, intro = '' } = {}) {
  return new Promise(resolve => {
    const p = profile || {}, s = suggested || {};
    const sheet = openSheet(
      '<div class="lg-sheet-head"><span class="lg-eyebrow"><i></i>' + (profile ? 'PLAYER CARD' : 'QUICK START') + '</span><h3>' + (profile ? 'Your player card' : 'Create your player card') + '</h3>' +
      '<p class="lg-sub">' + esc(intro || 'Three details and you are ready to apply. Everything else is optional.') + '</p></div>' +
      '<form class="lg-form" novalidate>' +
        '<div class="lg-seg" role="tablist"><button type="button" class="on" data-pt="a">Essentials</button><button type="button" data-pt="b">Playing</button><button type="button" data-pt="c">Contact & privacy</button></div>' +
        '<div class="lg-pane" data-pane="a">' +
          '<label class="lg-field"><span>In-game name <b>*</b></span><input name="inGameUsername" required maxlength="40" autocomplete="off" value="' + esc(p.in_game_username || s.inGameUsername || '') + '" autofocus></label>' +
          '<div class="lg-grid-2"><label class="lg-field"><span>Team OVR <b>*</b></span><input name="ovr" type="number" inputmode="numeric" min="50" max="200" required placeholder="e.g. 118" value="' + esc(p.ovr || '') + '"></label>' +
          '<label class="lg-field"><span>Region <b>*</b></span><select name="regionServer" required>' + opt(REGIONS, p.region_server || s.regionServer || '', 'Choose') + '</select></label></div>' +
          '<div class="lg-up-slot" data-slot="avatar"></div>' +
        '</div>' +
        '<div class="lg-pane" data-pane="b" hidden>' +
          '<fieldset class="lg-fieldset"><legend>Tournament sizes you play</legend><div class="lg-chips">' + chips('tournamentSizes', SIZES, p.tournament_sizes) + '</div></fieldset>' +
          '<fieldset class="lg-fieldset"><legend>Languages</legend><div class="lg-chips">' + chips('preferredLanguages', LANGS, p.preferred_languages || ['English']) + '</div></fieldset>' +
          '<div class="lg-grid-2"><label class="lg-field"><span>Availability</span><select name="availability">' + opt(AVAIL, p.availability || '', 'Choose') + '</select></label>' +
          '<label class="lg-field"><span>Play style</span><select name="playStyle">' + opt(STYLES, p.play_style || '', 'Choose') + '</select></label></div>' +
        '</div>' +
        '<div class="lg-pane" data-pane="c" hidden>' +
          '<label class="lg-field"><span>FC Mobile UID</span><input name="fcMobileUid" maxlength="64" autocomplete="off" value="' + esc(p.fc_mobile_uid || s.fcMobileUid || '') + '"></label>' +
          '<label class="lg-field"><span>Discord</span><input name="discordHandle" maxlength="100" placeholder="name or @name" value="' + esc(p.discord_handle || s.discordHandle || '') + '"></label>' +
          '<div class="lg-privacy"><b>' + ICON.lock + 'Who can see my details <button type="button" class="lg-info" data-info="sharing" aria-label="About sharing">i</button></b>' +
          toggle('findable', p.status !== 'not_looking', 'Let league owners find me', 'Shows your card in player search') +
          toggle('shareUid', p.share_uid, 'Show my UID to owners who unlock my card') +
          toggle('shareDiscord', p.share_discord, 'Show my Discord to owners who unlock my card') +
          '<small>You can also choose per application. Nothing here is ever public.</small></div>' +
        '</div>' +
        '<div class="lg-msg" role="alert"></div>' +
        '<div class="lg-modal-actions"><button class="lg-btn lg-btn-quiet" type="button" data-sheet-close>Cancel</button><button class="lg-btn lg-btn-primary" type="submit">Save player card</button></div>' +
      '</form>', { label: 'Player card', onClose: (r) => resolve(r || null) });
    const f = $('form', sheet.el);
    const up = mountUploader($('[data-slot=avatar]', sheet.el), { label: 'Profile picture', hint: 'Optional · square works best', value: p.avatar_url || '', round: true, purpose: 'avatar' });
    f.addEventListener('click', e => {
      const t = e.target.closest('[data-pt]'); if (!t) return;
      $$('[data-pt]', f).forEach(b => b.classList.toggle('on', b === t));
      $$('[data-pane]', f).forEach(pn => { pn.hidden = pn.dataset.pane !== t.dataset.pt; });
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('.lg-msg', f); msg.textContent = '';
      if (!f.reportValidity()) { const bad = f.querySelector(':invalid'); const pane = bad?.closest('[data-pane]'); if (pane?.hidden) $('[data-pt="' + pane.dataset.pane + '"]', f).click(); return; }
      if (up.busy()) { msg.textContent = 'Wait for the picture to finish uploading.'; return; }
      const btn = $('[type=submit]', f); btn.disabled = true; btn.textContent = 'Saving…';
      const g = (n) => f.elements[n].value.trim();
      try {
        const res = await api('/api/leagues/profile', { method: 'POST', body: JSON.stringify({
          inGameUsername: g('inGameUsername'), ovr: Number(g('ovr')), regionServer: g('regionServer'), fcMobileUid: g('fcMobileUid'), discordHandle: g('discordHandle'),
          availability: g('availability'), playStyle: g('playStyle'), avatarUrl: up.value(), tournamentSizes: checked(f, 'tournamentSizes'), preferredLanguages: checked(f, 'preferredLanguages'),
          status: f.elements.findable.checked ? 'looking_for_league' : 'not_looking', shareUid: f.elements.shareUid.checked, shareDiscord: f.elements.shareDiscord.checked, notes: p.notes || ''
        }) });
        toast('Player card saved.');
        sheet.close(res.profile);
      } catch (error) { msg.textContent = error.message; btn.disabled = false; btn.textContent = 'Save player card'; }
    });
  });
}

// ───────────── celebration ─────────────
export function burst(host) {
  if (reduced() || !host) return;
  const wrap = document.createElement('div'); wrap.className = 'lg-burst'; wrap.setAttribute('aria-hidden', 'true');
  const cols = ['#5df2b0', '#35c8ff', '#ffd66b', '#9a8cff', '#ff8fb1'];
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i'); const a = (i / 26) * Math.PI * 2 + Math.random() * .4, d = 70 + Math.random() * 110;
    s.style.cssText = '--x:' + Math.cos(a) * d + 'px;--y:' + (Math.sin(a) * d - 30) + 'px;--r:' + (Math.random() * 540 - 270) + 'deg;--c:' + cols[i % cols.length] + ';--t:' + (600 + Math.random() * 500) + 'ms';
    wrap.appendChild(s);
  }
  host.appendChild(wrap); setTimeout(() => wrap.remove(), 1400);
}

// ───────────── guided apply (4 steps) ─────────────
const SHARE_KEY = 'lg-share-prefs-v1';
export function openApplySheet(league, profile) {
  return new Promise(resolve => {
    const fit = fitFor(profile, league);
    const prefs = (() => { try { return JSON.parse(store.get(SHARE_KEY, '{}')) || {}; } catch { return {}; } })();
    const hasUid = Boolean(profile.fc_mobile_uid), hasDiscord = Boolean(profile.discord_handle);
    const STEPS = ['Fit', 'Screenshot', 'Note', 'Send'];
    const sheet = openSheet(
      '<div class="lg-apply-head">' + crest(league.logoUrl, league.name, 'lg-crest sm') + '<div><span class="lg-eyebrow"><i></i>APPLY</span><h3>' + esc(league.name) + '</h3></div></div>' +
      '<div class="lg-steps" role="list">' + STEPS.map((s, i) => '<span role="listitem" class="' + (i === 0 ? 'on' : '') + '" data-s="' + i + '"><i>' + (i + 1) + '</i>' + s + '</span>').join('') + '</div>' +
      '<form class="lg-form lg-wiz" novalidate>' +
      // 1 · fit
      '<section class="lg-pane" data-step="0"><div class="lg-fitbox">' + (fit ? ring(fit, true) : '') + '<div><b>' + esc(fit?.label || 'Your fit') + '</b><small>' + esc(profile.in_game_username) + ' · OVR ' + esc(profile.ovr) + ' · ' + esc(profile.region_server) + '</small></div><button type="button" class="lg-link" data-edit-card>Edit card</button></div>' +
        '<ul class="lg-fitlist">' + (fit?.reasons || []).map(r => '<li class="ok">' + ICON.check + esc(r) + '</li>').join('') + (fit?.gaps || []).map(r => '<li class="gap">' + ICON.flag + esc(r) + '</li>').join('') + '</ul>' +
        (fit && !fit.qualifies ? '<div class="lg-callout"><strong>You are ' + fit.ovrGap + ' OVR under the ' + league.minOvr + '+ minimum.</strong>You can still apply. The owner decides, and a good screenshot helps.</div>' : '<p class="lg-note-line">Looking good. The owner sees this summary next to your application.</p>') +
      '</section>' +
      // 2 · screenshot
      '<section class="lg-pane" data-step="1" hidden><div class="lg-slot-head"><b>Team screenshot</b> <button type="button" class="lg-info" data-info="apply" aria-label="About applying">i</button><span class="lg-chip-note">Recommended</span></div><div class="lg-up-slot" data-slot="shot"></div>' +
        '<ul class="lg-tips"><li>Show your starting XI with the team OVR visible.</li><li>Use a full-screen screenshot, not a photo of the screen.</li><li>Your screenshot is deleted automatically after ' + APPLICATION_SHOT_DAYS + ' days.</li></ul></section>' +
      // 3 · note + sharing
      '<section class="lg-pane" data-step="2" hidden><label class="lg-field"><span>Short note <small id="lgNoteCount">0/' + NOTE_MAX + '</small></span><textarea name="message" rows="3" maxlength="' + NOTE_MAX + '" placeholder="When you usually play, anything the owner should know."></textarea></label>' +
        '<div class="lg-sugg" id="lgNoteSugg"><span class="lg-k">Tap to use</span></div>' +
        '<div class="lg-privacy"><b>' + ICON.lock + 'Share with this league <button type="button" class="lg-info" data-info="sharing" aria-label="About sharing">i</button></b>' +
          '<label class="lg-switch' + (hasUid ? '' : ' off') + '"><input type="checkbox" name="shareUid"' + (hasUid ? '' : ' disabled') + (hasUid && prefs.uid ? ' checked' : '') + '><i></i><span><b>My UID</b><small>' + (hasUid ? 'The owner can invite you in game' : 'Add it in your player card') + '</small></span></label>' +
          '<label class="lg-switch' + (hasDiscord ? '' : ' off') + '"><input type="checkbox" name="shareDiscord"' + (hasDiscord ? '' : ' disabled') + (hasDiscord && prefs.discord ? ' checked' : '') + '><i></i><span><b>My Discord</b><small>' + (hasDiscord ? 'Only shown to this league' : 'Add it in your player card') + '</small></span></label></div></section>' +
      // 4 · review
      '<section class="lg-pane" data-step="3" hidden><div class="lg-review" id="lgReview"></div></section>' +
      '<div class="lg-msg" role="alert"></div>' +
      '<div class="lg-modal-actions between"><button class="lg-btn lg-btn-quiet" type="button" data-back>Cancel</button><button class="lg-btn lg-btn-primary" type="button" data-next>Next ' + ICON.arrow + '</button></div>' +
      '</form>', { label: 'Apply to ' + league.name, wide: false, onClose: (r) => resolve(r || null), className: 'lg-apply' });

    const f = $('form', sheet.el), msg = $('.lg-msg', f), next = $('[data-next]', f), back = $('[data-back]', f), note = f.elements.message;
    const shot = mountUploader($('[data-slot=shot]', sheet.el), { label: 'Add a screenshot of your team', hint: 'Drop an image or tap to choose', purpose: 'application', paste: true, wide: true, onChange: () => { if (step === 3) review(); if (step === 1) nextLabel(); } });
    let step = 0, sending = false;
    const nextLabel = () => { next.innerHTML = step === 3 ? 'Send application' : (step === 1 && !shot.value() && !shot.busy() ? 'Skip for now ' : 'Next ') + ICON.arrow; };

    const sugg = $('#lgNoteSugg', sheet.el);
    for (const text of noteSuggestions(profile, league)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'lg-sug'; b.textContent = text; b.title = 'Use this note';
      b.addEventListener('click', () => { note.value = text.slice(0, NOTE_MAX); note.dispatchEvent(new Event('input')); note.focus(); });
      sugg.appendChild(b);
    }
    note.addEventListener('input', () => { $('#lgNoteCount', sheet.el).textContent = note.value.length + '/' + NOTE_MAX; });

    function review() {
      const strength = applicationStrength({ hasShot: Boolean(shot.value()), note: note.value, sharedUid: f.elements.shareUid.checked, sharedDiscord: f.elements.shareDiscord.checked, fit, hasUid, hasDiscord });
      $('#lgReview', sheet.el).innerHTML =
        '<div class="lg-strength ' + strength.tone + '"><div class="lg-strength-top"><b>Application strength</b><span>' + strength.label + '</span></div><div class="lg-meter"><i style="width:' + strength.score + '%"></i></div>' +
        (strength.tips.length ? '<ul>' + strength.tips.map(t => '<li>' + esc(t.text) + '</li>').join('') + '</ul>' : '<p>Everything an owner looks for is here.</p>') + '</div>' +
        '<dl class="lg-sum"><div><dt>Player</dt><dd>' + esc(profile.in_game_username) + ' · OVR ' + esc(profile.ovr) + '</dd></div>' +
        '<div><dt>Screenshot</dt><dd>' + (shot.value() ? '<img src="' + esc(shot.value()) + '" alt="" referrerpolicy="no-referrer"> Attached' : 'None added') + '</dd></div>' +
        '<div><dt>Note</dt><dd>' + (note.value.trim() ? esc(note.value.trim()) : 'No note') + '</dd></div>' +
        '<div><dt>Shared</dt><dd>' + ([f.elements.shareUid.checked && 'UID', f.elements.shareDiscord.checked && 'Discord'].filter(Boolean).join(' and ') || 'Nothing. The owner will message you here.') + '</dd></div></dl>' +
        '<ol class="lg-next"><li><b>Owner reviews</b> your card and screenshot.</li><li><b>Shortlist or invite</b> arrives under My applications.</li><li><b>Accept in FC Mobile</b> and you are in.</li></ol>';
    }
    function go(n) {
      step = Math.max(0, Math.min(3, n)); msg.textContent = '';
      $$('[data-step]', f).forEach(p => { p.hidden = Number(p.dataset.step) !== step; });
      $$('.lg-steps span', sheet.el).forEach(s => { const i = Number(s.dataset.s); s.classList.toggle('on', i === step); s.classList.toggle('done', i < step); });
      back.textContent = step === 0 ? 'Cancel' : 'Back';
      nextLabel();
      if (step === 3) review();
      if (step === 1) $('.lg-up-drop', sheet.el)?.focus();
    }
    $('[data-edit-card]', sheet.el).addEventListener('click', async () => { const np = await openProfileSheet({ profile }); if (np) sheet.close({ editedProfile: np }); });
    back.addEventListener('click', () => step === 0 ? sheet.close() : go(step - 1));
    next.addEventListener('click', async () => {
      if (step === 1 && shot.busy()) { msg.textContent = 'Your screenshot is still uploading. One moment.'; return; }
      if (step < 3) { go(step + 1); return; }
      if (sending) return; sending = true; next.disabled = true; next.textContent = 'Sending…'; msg.textContent = '';
      store.set(SHARE_KEY, JSON.stringify({ uid: f.elements.shareUid.checked, discord: f.elements.shareDiscord.checked }));
      try {
        const res = await api('/api/leagues/listings/' + encodeURIComponent(league.id) + '/apply', { method: 'POST', body: JSON.stringify({
          message: note.value.trim(), screenshotUrl: shot.value(), shareUid: f.elements.shareUid.checked, shareDiscord: f.elements.shareDiscord.checked }) });
        sheet.set('<div class="lg-done"><div class="lg-done-tick">' + ICON.check + '</div><h3>Application sent</h3><p><b>' + esc(league.name) + '</b> will see your card' + (shot.value() ? ' and screenshot' : '') + '. Track it under <b>My applications</b>; you will get a message here when the owner replies.</p>' +
          '<div class="lg-modal-actions"><button class="lg-btn lg-btn-primary" type="button" data-sheet-close>Done</button></div></div>');
        burst(sheet.card); sheet.onSent = res; resolve({ sent: res });
      } catch (error) { msg.textContent = error.message; sending = false; next.disabled = false; go(3); }
    });
    go(0);
  });
}

// Full flow: sign-in check → player card if missing → apply.
export async function startApply(league, { profile, suggested, onProfile, onSent }) {
  if (!(await token())) { location.href = signInUrl(); return; }
  let p = profile;
  if (!p) {
    p = await openProfileSheet({ suggested, intro: 'Add your OVR, name and region once. Then you can apply to any league.' });
    if (!p) return; onProfile?.(p);
  }
  for (;;) {
    const r = await openApplySheet(league, p);
    if (r?.editedProfile) { p = r.editedProfile; onProfile?.(p); continue; }
    if (r?.sent) onSent?.(r.sent);
    return;
  }
}

// ───────────── league rules ─────────────
export function rulesHtml() { return '<ol class="lg-rules">' + LISTING_RULES.map(r => '<li>' + esc(r) + '</li>').join('') + '</ol>'; }
export function openRulesSheet() {
  return new Promise(resolve => {
    const sheet = openSheet('<div class="lg-sheet-head"><span class="lg-eyebrow"><i></i>BEFORE YOU LIST</span><h3>League rules</h3><p class="lg-sub">Short and fair. Break them and the listing is removed.</p></div>' + rulesHtml() +
      '<label class="lg-check big"><input type="checkbox" id="lgRulesOk"><span>I have read the rules and I agree to follow them.</span></label>' +
      '<div class="lg-modal-actions"><button class="lg-btn lg-btn-quiet" type="button" data-sheet-close>Close</button><button class="lg-btn lg-btn-primary" type="button" id="lgRulesGo" disabled>I agree</button></div>',
      { label: 'League rules', onClose: (r) => resolve(Boolean(r)) });
    const ok = $('#lgRulesOk', sheet.el), go = $('#lgRulesGo', sheet.el);
    ok.addEventListener('change', () => { go.disabled = !ok.checked; });
    go.addEventListener('click', () => sheet.close(true));
  });
}

// ───────────── motion helpers ─────────────
// Cards follow the pointer with a soft light and a tiny 3D tilt. Pure CSS variables, no layout cost.
export function bindCardFx() {
  if (bindCardFx.done || typeof document === 'undefined' || reduced()) return; bindCardFx.done = true;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.lg-card:not(.is-preview), .lg-spot-card');
    if (!card) return;
    const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px');
    if (fine) { card.style.setProperty('--ry', ((x / r.width - .5) * 5).toFixed(2) + 'deg'); card.style.setProperty('--rx', ((.5 - y / r.height) * 4).toFixed(2) + 'deg'); }
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest?.('.lg-card');
    if (card && !card.contains(e.relatedTarget)) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }
  }, { passive: true });
}

let revealIO = null;
export function reveal(root = document) {
  const nodes = $$('[data-reveal]:not(.is-in)', root);
  if (!nodes.length) return;
  if (reduced() || typeof IntersectionObserver === 'undefined') { nodes.forEach(n => n.classList.add('is-in')); return; }
  revealIO = revealIO || new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  nodes.forEach(n => revealIO.observe(n));
}

export function countUp(el, to, { ms = 900 } = {}) {
  if (!el) return;
  const end = Number(to) || 0, start = Number(String(el.textContent).replace(/[^\d.-]/g, '')) || 0;
  if (reduced() || start === end) { el.textContent = fmt(end); return; }
  const t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(start + (end - start) * e)); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

export { ICON, esc, fmt, crest, divisionIcon };
