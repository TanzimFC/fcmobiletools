// Browser helpers shared by /leagues and /leagues/[slug].
import { accountAuth } from './account-client.js';
import { esc, INFO, divisionBadge } from './league-card.js';
import { LISTING_RULES, DIVISIONS } from '../data/leagueConfig.js';

export const REGIONS = ['Worldwide', 'Asia', 'Europe', 'North America', 'South America', 'Africa', 'Middle East', 'Other'];
export const LANGS = ['English', 'Bengali', 'Indonesian', 'Arabic', 'Spanish', 'French', 'Portuguese', 'Other'];
export const SIZES = ['4v4', '8v8', '16v16', '32v32'];
export const STYLES = ['Competitive', 'Active and relaxed', 'Casual', 'Quest focused', 'Building a new team'];
export const AVAIL = ['Daily', 'Most days', 'Weekends', 'Evenings', 'Flexible', 'Casual / whenever'];

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ───────────── toast ─────────────
export function toast(message, error = false) {
  let node = $('#lgToast');
  if (!node) { node = document.createElement('div'); node.id = 'lgToast'; node.className = 'lg-toast'; node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); document.body.appendChild(node); }
  node.textContent = message; node.classList.toggle('error', error); node.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => node.classList.remove('show'), 4200);
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

// ───────────── sheets (modals) ─────────────
let sheetStack = [];
export function openSheet(html, { wide = false, label = 'Dialog', onClose } = {}) {
  const el = document.createElement('div');
  el.className = 'lg-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', label);
  el.innerHTML = '<div class="lg-modal-card' + (wide ? ' wide' : '') + '"><button type="button" class="lg-sheet-x" data-sheet-close aria-label="Close">✕</button>' + html + '</div>';
  const prev = document.activeElement;
  const api = {
    el,
    close(result) {
      if (!el.isConnected) return;
      el.remove(); sheetStack = sheetStack.filter(s => s !== api);
      if (!sheetStack.length) document.body.classList.remove('lg-lock');
      if (prev?.isConnected) prev.focus();
      onClose?.(result);
    }
  };
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-sheet-close]')) api.close(); });
  document.body.appendChild(el); document.body.classList.add('lg-lock'); sheetStack.push(api);
  (el.querySelector('[autofocus]') || el.querySelector('input,select,textarea,button:not(.lg-sheet-x)'))?.focus();
  return api;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetStack.length) sheetStack[sheetStack.length - 1].close(); });

// ───────────── info buttons ─────────────
export function bindInfo() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-info]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const [title, text] = INFO[b.dataset.info] || ['Help', ''];
    const s = openSheet('<h3>' + esc(title) + '</h3><p class="lg-info-text">' + text + '</p><div class="lg-modal-actions"><button class="lg-btn lg-btn-primary" type="button" data-sheet-close>Got it</button></div>', { label: title });
    if (b.dataset.info === 'division') s.el.querySelector('.lg-info-text').innerHTML = '<span class="lg-div-list">' +
      DIVISIONS.map(d => '<span>' + divisionBadge(d.key, { range: true }) + '</span>').join('') + '</span>';
  });
}

// ───────────── image upload with a real progress bar ─────────────
const IMG_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 8 * 1024 * 1024;

// Big phone screenshots are shrunk before upload: faster, cheaper, and the owner still reads every detail.
async function detectImageType(file) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'image/gif';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return '';
}

async function shrink(file, maxSide = 1440) {
  if (file.type === 'image/gif' || file.size < 250 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.78));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' }) : file;
  } catch { return file; }
}

export async function uploadImage(file, { onProgress, signal, permanent = false, expirationDays = 7 } = {}) {
  if (!file || typeof file.slice !== 'function' || file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error('Choose an image under 8 MB.');
  }
  if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { cancelled: true });
  const accessToken = await token();
  if (!accessToken) throw new Error('Sign in again before uploading.');
  onProgress?.({ phase: 'preparing', pct: 0 });

  let detected = '';
  try { detected = await detectImageType(file); } catch { /* report unsupported format below */ }
  if (!detected) throw new Error('This image format is not supported. Use a JPG, PNG, WebP or GIF screenshot.');
  const input = file.type === detected ? file : new File(
    [file], file.name || ('team-screenshot.' + detected.split('/')[1]), { type: detected }
  );
  const prepared = await shrink(input);
  if (signal?.aborted) throw Object.assign(new Error('Upload cancelled.'), { cancelled: true });

  const body = new FormData();
  body.append('file', prepared);
  body.append('permanent', String(Boolean(permanent)));
  if (!permanent) body.append('expirationDays', String(Math.max(1, Math.min(180, Number(expirationDays) || 7))));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => signal?.removeEventListener('abort', abortUpload);
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const abortUpload = () => xhr.abort();

    xhr.open('POST', '/api/account/image-upload');
    xhr.setRequestHeader('authorization', 'Bearer ' + accessToken);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      try {
        onProgress?.({
          phase: event.loaded >= event.total ? 'finishing' : 'uploading',
          pct: Math.round(event.loaded / event.total * 100)
        });
      } catch { /* a progress UI must not break the upload */ }
    };
    xhr.onerror = () => fail(new Error('Upload failed. Check your connection and try again.'));
    xhr.onabort = () => fail(Object.assign(new Error('Upload cancelled.'), { cancelled: true }));
    xhr.onload = () => {
      let result = {};
      try { result = JSON.parse(xhr.responseText || '{}'); } catch { /* empty response */ }
      if (xhr.status < 200 || xhr.status >= 300) {
        return fail(new Error(result.error || 'Image upload failed. Please try again.'));
      }
      const url = result.image?.url || result.url || result.imageUrl || result.data?.url || result.data?.display_url || '';
      if (!url) return fail(new Error('The image service returned no image link. Try the upload again.'));
      finish(url);
    };
    if (signal?.aborted) {
      fail(Object.assign(new Error('Upload cancelled.'), { cancelled: true }));
      return;
    }
    signal?.addEventListener('abort', abortUpload, { once: true });
    try { xhr.send(body); }
    catch { fail(new Error('The upload could not start. Please try again.')); }
  });
}

// Drop-in uploader: idle → preparing/uploading (bar + %) → "Uploaded" tick with preview.
export function mountUploader(root, { label, hint, value = '', onChange, round = false, permanent = false, expirationDays = 7 } = {}) {
  root.classList.add('lg-up');
  root.innerHTML =
    '<label class="lg-up-drop"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif"><span class="lg-up-ico">↑</span><span><b>' + esc(label) + '</b><small>' + esc(hint || 'JPG, PNG or WebP · under 8 MB') + '</small></span></label>' +
    '<div class="lg-up-run" hidden><img alt="" class="lg-up-thumb' + (round ? ' round' : '') + '"><div class="lg-up-main"><b class="lg-up-name"></b><div class="lg-up-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><small class="lg-up-status" aria-live="polite"></small></div><button type="button" class="lg-link" data-up-cancel>Cancel</button></div>' +
    '<div class="lg-up-done" hidden><img alt="" class="lg-up-thumb' + (round ? ' round' : '') + '"><div class="lg-up-main"><b class="lg-up-ok"><span>✓</span> Uploaded</b><small class="lg-up-fn"></small></div><button type="button" class="lg-link" data-up-replace>Replace</button><button type="button" class="lg-link danger" data-up-remove>Remove</button></div>' +
    '<div class="lg-up-err" hidden role="alert"></div>';
  const q = (s) => $(s, root);
  const input = q('input[type=file]'), drop = q('.lg-up-drop'), run = q('.lg-up-run'), done = q('.lg-up-done'), err = q('.lg-up-err');
  let url = value || '', working = false, ctrl = null, objectUrl = '';
  const show = (state) => { drop.hidden = state !== 'idle'; run.hidden = state !== 'run'; done.hidden = state !== 'done'; };
  const bar = (pct, text) => { q('.lg-up-bar i').style.width = pct + '%'; q('.lg-up-bar').setAttribute('aria-valuenow', String(pct)); q('.lg-up-status').textContent = text; };
  const setDone = (u, name) => { url = u; q('.lg-up-done .lg-up-thumb').src = objectUrl || u; q('.lg-up-fn').textContent = name || ''; err.hidden = true; show('done'); };
  if (url) setDone(url, '');
  else show('idle');
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    err.hidden = true; working = true; ctrl = new AbortController();
    if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = URL.createObjectURL(file);
    q('.lg-up-run .lg-up-thumb').src = objectUrl; q('.lg-up-name').textContent = file.name; bar(0, 'Preparing…'); show('run');
    onChange?.({ busy: true });
    try {
      const u = await uploadImage(file, { signal: ctrl.signal, permanent, expirationDays, onProgress: ({ phase, pct }) =>
        bar(phase === 'finishing' ? 100 : pct, phase === 'preparing' ? 'Preparing…' : phase === 'finishing' ? 'Almost done…' : 'Uploading ' + pct + '%') });
      bar(100, 'Done'); setDone(u, file.name); onChange?.({ url: u, busy: false });
    } catch (e) {
      show(url ? 'done' : 'idle');
      if (!e.cancelled) { err.textContent = e.message; err.hidden = false; }
      onChange?.({ busy: false });
    } finally { working = false; ctrl = null; }
  });
  root.addEventListener('click', e => {
    if (e.target.closest('[data-up-cancel]')) ctrl?.abort();
    if (e.target.closest('[data-up-replace]')) input.click();
    if (e.target.closest('[data-up-remove]')) { url = ''; show('idle'); onChange?.({ url: '', busy: false }); }
  });
  return { value: () => url, busy: () => working, set(u) { url = u || ''; u ? setDone(u, '') : show('idle'); } };
}

// ───────────── player card sheet (only the essentials are required) ─────────────
const opt = (list, cur, ph) => (ph ? '<option value="">' + esc(ph) + '</option>' : '') + list.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
const chips = (name, list, sel) => list.map(v => '<label class="lg-chip"><input type="checkbox" name="' + name + '" value="' + esc(v) + '"' + ((sel || []).includes(v) ? ' checked' : '') + '><span>' + esc(v) + '</span></label>').join('');
const checked = (f, name) => $$('input[name="' + name + '"]:checked', f).map(i => i.value);

export function openProfileSheet({ profile, suggested = {}, intro = '' } = {}) {
  return new Promise(resolve => {
    const p = profile || {}, s = suggested || {};
    const sheet = openSheet(
      '<h3>' + (profile ? 'Your player card' : 'Quick player card') + '</h3>' +
      '<p class="lg-sub">' + esc(intro || 'Three details and you are ready to apply.') + '</p>' +
      '<form class="lg-form" novalidate>' +
        '<label class="lg-field"><span>In-game name <b>*</b></span><input name="inGameUsername" required maxlength="40" autocomplete="off" value="' + esc(p.in_game_username || s.inGameUsername || '') + '" autofocus></label>' +
        '<div class="lg-grid-2">' +
          '<label class="lg-field"><span>Team OVR <b>*</b></span><input name="ovr" type="number" inputmode="numeric" min="50" max="200" required placeholder="e.g. 118" value="' + esc(p.ovr || '') + '"></label>' +
          '<label class="lg-field"><span>Region <b>*</b></span><select name="regionServer" required>' + opt(REGIONS, p.region_server || s.regionServer || '', 'Choose') + '</select></label>' +
        '</div>' +
        '<details class="lg-more"><summary>More details <small>optional</small></summary><div class="lg-more-body">' +
          '<label class="lg-field"><span>FC Mobile UID</span><input name="fcMobileUid" maxlength="64" autocomplete="off" value="' + esc(p.fc_mobile_uid || s.fcMobileUid || '') + '"></label>' +
          '<label class="lg-field"><span>Discord</span><input name="discordHandle" maxlength="100" placeholder="name or @name" value="' + esc(p.discord_handle || s.discordHandle || '') + '"></label>' +
          '<fieldset class="lg-fieldset"><legend>Tournament sizes you play</legend><div class="lg-chips">' + chips('tournamentSizes', SIZES, p.tournament_sizes) + '</div></fieldset>' +
          '<fieldset class="lg-fieldset"><legend>Languages</legend><div class="lg-chips">' + chips('preferredLanguages', LANGS, p.preferred_languages || ['English']) + '</div></fieldset>' +
          '<div class="lg-grid-2"><label class="lg-field"><span>Availability</span><select name="availability">' + opt(AVAIL, p.availability || '', 'Choose') + '</select></label>' +
          '<label class="lg-field"><span>Play style</span><select name="playStyle">' + opt(STYLES, p.play_style || '', 'Choose') + '</select></label></div>' +
          '<div class="lg-up-slot" data-slot="avatar"></div>' +
          '<div class="lg-privacy"><b>Who can see my details ' + '<button type="button" class="lg-info" data-info="sharing" aria-label="About sharing">i</button></b>' +
            '<label class="lg-check"><input type="checkbox" name="findable"' + (p.status === 'not_looking' ? '' : ' checked') + '><span>Let league owners find me in player search</span></label>' +
            '<label class="lg-check"><input type="checkbox" name="shareUid"' + (p.share_uid ? ' checked' : '') + '><span>Show my UID to owners who unlock my card</span></label>' +
            '<label class="lg-check"><input type="checkbox" name="shareDiscord"' + (p.share_discord ? ' checked' : '') + '><span>Show my Discord to owners who unlock my card</span></label>' +
            '<small>You can also choose per application. Nothing is shown publicly.</small></div>' +
        '</div></details>' +
        '<div class="lg-msg" role="alert"></div>' +
        '<div class="lg-modal-actions"><button class="lg-btn lg-btn-quiet" type="button" data-sheet-close>Cancel</button><button class="lg-btn lg-btn-primary" type="submit">Save player card</button></div>' +
      '</form>', { label: 'Player card', onClose: (r) => resolve(r || null) });
    const f = $('form', sheet.el);
    const up = mountUploader($('[data-slot=avatar]', sheet.el), { label: 'Profile picture', hint: 'Optional', value: p.avatar_url || '', round: true, permanent: true });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('.lg-msg', f); msg.textContent = '';
      if (!f.reportValidity()) return;
      if (up.busy()) { msg.textContent = 'Wait for the picture to finish uploading.'; return; }
      const btn = $('[type=submit]', f); btn.disabled = true; btn.textContent = 'Saving…';
      const g = (n) => f.elements[n].value.trim();
      try {
        const res = await api('/api/leagues/profile', { method: 'POST', body: JSON.stringify({
          inGameUsername: g('inGameUsername'), ovr: Number(g('ovr')), regionServer: g('regionServer'), fcMobileUid: g('fcMobileUid'), discordHandle: g('discordHandle'),
          availability: g('availability'), playStyle: g('playStyle'), avatarUrl: up.value(), tournamentSizes: checked(f, 'tournamentSizes'), preferredLanguages: checked(f, 'preferredLanguages'),
          status: f.elements.findable.checked ? 'looking_for_league' : 'not_looking', shareUid: f.elements.shareUid.checked, shareDiscord: f.elements.shareDiscord.checked, notes: p.notes || ''
        }) });
        sheet.close(res.profile);
      } catch (error) { msg.textContent = error.message; btn.disabled = false; btn.textContent = 'Save player card'; }
    });
  });
}

// ───────────── apply to a league ─────────────
export function openApplySheet(league, profile) {
  return new Promise(resolve => {
    const below = Number(profile.ovr) < league.minOvr;
    const sheet = openSheet(
      '<h3>Apply to ' + esc(league.name) + '</h3>' +
      '<div class="lg-me-card"><b>' + esc(profile.in_game_username) + '</b><span>OVR ' + esc(profile.ovr) + ' · ' + esc(profile.region_server) + '</span><button type="button" class="lg-link" data-edit-card>Edit</button></div>' +
      (below ? '<div class="lg-callout"><strong>Your OVR is below ' + league.minOvr + '.</strong>You can still apply. The owner decides.</div>' : '') +
      '<form class="lg-form" novalidate>' +
        '<div><div class="lg-lab">Team screenshot ' + '<button type="button" class="lg-info" data-info="apply" aria-label="About applying">i</button></div><div class="lg-up-slot" data-slot="shot"></div></div>' +
        '<label class="lg-field"><span>Short note <small id="lgNoteCount">0/200</small></span><textarea name="message" rows="2" maxlength="200" placeholder="Your usual hours, anything the owner should know."></textarea></label>' +
        '<div class="lg-privacy"><b>Share with this league ' + '<button type="button" class="lg-info" data-info="sharing" aria-label="About sharing">i</button></b>' +
          '<label class="lg-check"><input type="checkbox" name="shareUid"' + (profile.fc_mobile_uid ? '' : ' disabled') + '><span>My UID' + (profile.fc_mobile_uid ? '' : ' (add it in your player card)') + '</span></label>' +
          '<label class="lg-check"><input type="checkbox" name="shareDiscord"' + (profile.discord_handle ? '' : ' disabled') + '><span>My Discord' + (profile.discord_handle ? '' : ' (add it in your player card)') + '</span></label></div>' +
        '<div class="lg-msg" role="alert"></div>' +
        '<div class="lg-modal-actions"><button class="lg-btn lg-btn-quiet" type="button" data-sheet-close>Cancel</button><button class="lg-btn lg-btn-primary" type="submit">Send application</button></div>' +
      '</form>', { label: 'Apply', onClose: (r) => resolve(r || null) });
    const f = $('form', sheet.el);
    const shot = mountUploader($('[data-slot=shot]', sheet.el), { label: 'Add a screenshot of your team', hint: 'Recommended · so the owner can see your squad' });
    f.elements.message.addEventListener('input', () => { $('#lgNoteCount', sheet.el).textContent = f.elements.message.value.length + '/200'; });
    $('[data-edit-card]', sheet.el).addEventListener('click', async () => {
      const np = await openProfileSheet({ profile });
      if (np) { sheet.close({ editedProfile: np }); }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = $('.lg-msg', f); msg.textContent = '';
      if (shot.busy()) { msg.textContent = 'Your screenshot is still uploading. Wait for the tick.'; return; }
      const btn = $('[type=submit]', f); btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const res = await api('/api/leagues/listings/' + encodeURIComponent(league.id) + '/apply', { method: 'POST', body: JSON.stringify({
          message: f.elements.message.value.trim(), screenshotUrl: shot.value(), shareUid: f.elements.shareUid.checked, shareDiscord: f.elements.shareDiscord.checked }) });
        const card = $('.lg-modal-card', sheet.el);
        card.innerHTML = '<div class="lg-done"><div class="lg-done-tick">✓</div><h3>Application sent</h3><p>' + esc(league.name) + ' will see your card' + (shot.value() ? ' and screenshot' : '') + '. You will find it under My applications.</p><div class="lg-modal-actions"><button class="lg-btn lg-btn-primary" type="button" data-sheet-close>Done</button></div></div>';
        sheet.onSent = res; resolve({ sent: res });
      } catch (error) { msg.textContent = error.message; btn.disabled = false; btn.textContent = 'Send application'; }
    });
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
    const sheet = openSheet('<h3>League rules</h3><p class="lg-sub">Read these before you list your league.</p>' + rulesHtml() +
      '<label class="lg-check big"><input type="checkbox" id="lgRulesOk"><span>I have read the rules and I agree to follow them.</span></label>' +
      '<div class="lg-modal-actions"><button class="lg-btn lg-btn-quiet" type="button" data-sheet-close>Close</button><button class="lg-btn lg-btn-primary" type="button" id="lgRulesGo" disabled>I agree</button></div>',
      { label: 'League rules', onClose: (r) => resolve(Boolean(r)) });
    const ok = $('#lgRulesOk', sheet.el), go = $('#lgRulesGo', sheet.el);
    ok.addEventListener('change', () => { go.disabled = !ok.checked; });
    go.addEventListener('click', () => sheet.close(true));
  });
}
