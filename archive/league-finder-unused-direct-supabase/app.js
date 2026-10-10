// FC Mobile Tools — Find a League (single-page app, hash routing)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const C = window.FL_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app'), topEl = $('#top');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KICK_MS = 6 * 3600e3, PULSE_MS = 24 * 3600e3;
const REGIONS = { asia: 'Asia', mena: 'Middle East & N. Africa', europe: 'Europe', africa: 'Africa', north_america: 'North America', latin_america: 'Latin America', oceania: 'Oceania' };
const LANGS = { english: 'English', arabic: 'Arabic', spanish: 'Spanish', portuguese: 'Portuguese', turkish: 'Turkish', hindi: 'Hindi', bengali: 'Bengali', indonesian: 'Indonesian', french: 'French', other: 'Other' };
const STYLES = { casual: 'Casual', grinder: 'Daily Grinder', competitive: 'Competitive' };
const VIBES = { quest_grinders: 'Quest Grinders', daily_tourneys: 'Daily Tournaments', competitive: 'Competitive', chill: 'Chill', beginner: 'New-Player Friendly', discord_active: 'Discord Active', f2p: 'F2P Friendly' };
const DISCORD_RE = /^https:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,40}\/?$/;

/* ---------- icons ---------- */
const P = {
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const ic = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* ---------- helpers ---------- */
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const initials = (s) => String(s || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const avatar = (url, name, cls = '') => url
  ? `<img class="av ${cls}" src="${esc(url)}" data-n="${esc(name)}" alt="" loading="lazy">`
  : `<span class="av mono ${cls}" style="--h:${hue(name)}">${esc(initials(name))}</span>`;
const bannerBg = (c) => c.banner_url
  ? `background-image:linear-gradient(180deg,rgba(7,9,13,.05),rgba(7,9,13,.7)),url('${esc(c.banner_url)}')`
  : `background-image:linear-gradient(135deg,hsl(${hue(c.name || 'x')} 70% 32%),hsl(${(hue(c.name || 'x') + 60) % 360} 70% 16%))`;
const ago = (t) => { const s = Math.max(0, (Date.now() - new Date(t)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; };
const pad = (n) => String(n).padStart(2, '0');
const fmtCD = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`; };
const fmtDur = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const fmtSize = (a, b) => (a === b ? `${b}v${b}` : `${a}v${a} – ${b}v${b}`);
const pace = (n) => (n >= 7 ? 'Daily' : n > 0 ? `${n}/week` : 'No regular');
const questDays = (n) => (n > 0 ? Math.ceil(100 / (n / 7)) : null);
const opts = (map, sel, ph) => (ph ? `<option value="">${esc(ph)}</option>` : '') + Object.entries(map).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

function errMsg(e) {
  const m = (e && e.message) || String(e);
  if (m.includes('COOLDOWN:')) return `Not ready yet — available in ${fmtDur(+m.split('COOLDOWN:')[1] * 1000)}.`;
  const map = {
    AUTH: 'Please sign in again.', NOT_MEMBER: 'Only league members can do that.', NEED_PROFILE: 'Finish your Player Card first.',
    ALREADY_IN_LEAGUE: 'Leave your current league first.', NOT_RECRUITING: "This league isn't recruiting right now.",
    TOO_MANY_APPS: 'You have 5 pending requests. Withdraw one first.', ALREADY_APPLIED: 'You already have a pending request here.',
    DAILY_LIMIT: 'All 3 scout passes used today. They reset at 00:00 UTC.', ALREADY_APPROACHED: 'You already approached this player.',
    PLAYER_UNAVAILABLE: 'This player is no longer available.', NOT_APPROVED_OWNER: 'Your league must be approved first.',
    FORBIDDEN: "You can't do that.", NOT_PENDING: 'This was already handled.', OWNER_CANNOT_LEAVE: "Owners can't leave — delete the league instead.", NOT_FOUND: 'Not found.',
  };
  for (const k in map) if (m.includes(k)) return map[k];
  if (e && e.code === '23505') {
    if (/uid/i.test(m)) return 'That UID is already linked to another account.';
    if (/name/i.test(m)) return 'A league with that name already exists.';
    if (/owner_id/i.test(m)) return 'You already have a league.';
  }
  if (e && e.code === '23514') return 'One of the values is out of range — please check the form.';
  return m;
}

function toast(msg, type = 'ok') {
  const t = document.createElement('div'); t.className = `toast ${type}`;
  t.innerHTML = `${ic(type === 'ok' ? 'check' : 'x', 16)}<span>${esc(msg)}</span>`;
  $('#toasts').append(t); setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3600);
}

function modal(html, cls = '') {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true"><button class="x" aria-label="Close" data-close>${ic('x', 16)}</button>${html}</div>`;
  document.body.append(ov); document.body.classList.add('lock'); requestAnimationFrame(() => ov.classList.add('on'));
  ov.close = () => { ov.classList.remove('on'); setTimeout(() => { ov.remove(); if (!$('.ov')) document.body.classList.remove('lock'); }, 200); };
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-close]')) ov.close(); });
  return ov;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const o = $$('.ov').pop(); o && o.close(); } });

async function run(btn, fn) {
  if (btn) { btn.disabled = true; btn.classList.add('busy'); }
  try { return await fn(); } catch (e) { console.error(e); toast(errMsg(e), 'err'); }
  finally { if (btn) { btn.disabled = false; btn.classList.remove('busy'); } }
}

function burst(el) {
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  for (let i = 0; i < 20; i++) {
    const s = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 100;
    s.className = 'cf'; s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--h:${(Math.random() * 360) | 0}`;
    document.body.append(s); setTimeout(() => s.remove(), 950);
  }
}

/* ---------- state ---------- */
const S = {
  sb: null, user: null, profile: null, member: null, own: null, mine: null, admin: false, badge: 0,
  f: { q: '', region: '', language: '', sort: 'kick', open: false, fit: false, quest: false, vibes: [] },
  rt: 0, market: [], scoutTab: 'market',
};

if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('YOUR-PROJECT')) {
  app.innerHTML = `<div class="empty"><h3>Setup needed</h3>Open <code>/leagues/config.js</code> and add your Supabase URL, anon key and ImgBB key.</div>`;
  throw new Error('FL_CONFIG missing');
}
S.sb = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const rpc = async (fn, args) => { const { data, error } = await S.sb.rpc(fn, args); if (error) throw error; return data; };

/* ---------- global listeners ---------- */
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img && img.tagName === 'IMG' && img.classList.contains('av')) {
    const s = document.createElement('span'); s.className = img.className + ' mono'; s.style.setProperty('--h', hue(img.dataset.n || ''));
    s.textContent = initials(img.dataset.n); img.replaceWith(s);
  } else if (img && img.tagName === 'IMG') img.classList.add('broken');
}, true);
document.addEventListener('pointermove', (e) => {
  const c = e.target.closest && e.target.closest('.lcard'); if (!c) return;
  const r = c.getBoundingClientRect(); c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px');
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-wrap')) $('.menu')?.classList.remove('on');
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  e.preventDefault(); handleAct(el);
});
window.addEventListener('hashchange', route);

/* cooldown ticker: every .kick element */
function tick() {
  const now = Date.now();
  $$('.kick').forEach((w) => {
    const b = w.firstElementChild, ready = +w.dataset.ready, cool = +w.dataset.cool, left = ready - now;
    if (left <= 0) {
      if (!b.classList.contains('busy')) b.disabled = false;
      if (b.textContent !== w.dataset.label) b.textContent = w.dataset.label;
      w.classList.add('is-ready'); w.style.setProperty('--p', 100);
    } else {
      b.disabled = true; b.textContent = `${w.dataset.label} · ${fmtCD(left)}`;
      w.classList.remove('is-ready'); w.style.setProperty('--p', ((1 - left / cool) * 100).toFixed(1));
    }
  });
}
setInterval(tick, 1000);

const coolBtn = (act, label, readyAt, cool, id, cls = '') =>
  `<div class="kick ${cls}" data-ready="${readyAt}" data-cool="${cool}" data-label="${esc(label)}"><button type="button" class="kbtn" data-act="${act}" data-id="${esc(id)}">${esc(label)}</button></div>`;
const kickReady = (last) => (last ? new Date(last).getTime() + KICK_MS : 0);

/* ---------- auth ---------- */
S.sb.auth.onAuthStateChange((ev, session) => {
  const id = session?.user?.id || null;
  if (ev === 'TOKEN_REFRESHED' || ev === 'USER_UPDATED') return;
  if (ev !== 'INITIAL_SESSION' && ev !== 'SIGNED_OUT' && id === (S.user?.id || null)) return;
  setTimeout(() => boot(session), 0);
});

function authModal() {
  const m = modal(`<h2>Join the league hub</h2><p class="mute">Free account. Browse every league, apply in one tap.</p>
    <div class="stack"><button class="btn oauth" data-p="discord">Continue with Discord</button><button class="btn oauth" data-p="google">Continue with Google</button></div>
    <div class="or"><span>or use email</span></div>
    <form id="em" class="stack"><input type="email" name="email" placeholder="you@email.com" required autocomplete="email"><button class="btn primary">Email me a sign-in code</button></form>
    <form id="cd" class="stack" hidden><p class="hint">Enter the code we emailed you (or tap the link in the email).</p><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="Code" required><button class="btn primary">Verify &amp; enter</button></form>`);
  const redirectTo = location.origin + '/leagues/';
  $$('[data-p]', m).forEach((b) => b.onclick = () => run(b, async () => { const { error } = await S.sb.auth.signInWithOAuth({ provider: b.dataset.p, options: { redirectTo } }); if (error) throw error; }));
  let email = '';
  $('#em', m).onsubmit = (e) => { e.preventDefault(); const f = e.target; email = f.email.value.trim(); run(f.querySelector('button'), async () => { const { error } = await S.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }); if (error) throw error; f.hidden = true; $('#cd', m).hidden = false; toast('Code sent — check your inbox'); }); };
  $('#cd', m).onsubmit = (e) => { e.preventDefault(); const f = e.target; run(f.querySelector('button'), async () => { const { error } = await S.sb.auth.verifyOtp({ email, token: f.code.value.trim(), type: 'email' }); if (error) throw error; m.close(); }); };
}

/* ---------- boot ---------- */
async function loadMe() {
  const uid = S.user.id;
  const [p, mem, own, adm] = await Promise.all([
    S.sb.from('fl_profiles').select('*').eq('user_id', uid).maybeSingle(),
    S.sb.from('fl_members').select('league_id,role').eq('user_id', uid).maybeSingle(),
    S.sb.from('fl_leagues').select('*').eq('owner_id', uid).maybeSingle(),
    S.sb.rpc('fl_is_admin'),
  ]);
  for (const r of [p, mem, own]) if (r.error) throw r.error;
  S.profile = p.data; S.member = mem.data; S.own = own.data; S.admin = !!adm.data;
  S.mine = null;
  if (S.member) { const { data } = await S.sb.from('fl_league_cards').select('*').eq('id', S.member.league_id).maybeSingle(); S.mine = data; }
  let badge = 0;
  const inv = await S.sb.from('fl_approaches').select('id', { count: 'exact', head: true }).eq('player_id', uid).eq('status', 'sent');
  badge += inv.count || 0;
  if (S.own && S.own.status === 'approved') {
    const ap = await S.sb.from('fl_applications').select('id', { count: 'exact', head: true }).eq('league_id', S.own.id).eq('status', 'pending');
    badge += ap.count || 0;
  }
  S.badge = badge;
}
async function refresh() { await loadMe(); renderTop(); await route(); }

async function boot(session) {
  S.user = session?.user || null;
  renderTop();
  if (!S.user) { S.profile = S.member = S.own = S.mine = null; return renderGate(); }
  app.innerHTML = `<div class="grid">${skeletons(3)}</div>`;
  try {
    await loadMe();
    if (!S.profile) return renderWizard('new');
    S.sb.rpc('fl_touch').then(() => {}, () => {});
    renderTop(); route();
  } catch (e) { console.error(e); app.innerHTML = `<div class="empty"><h3>Couldn't load</h3>${esc(errMsg(e))}<br><br><button class="btn" onclick="location.reload()">Retry</button></div>`; }
}

/* ---------- header ---------- */
function renderTop() {
  const logo = `<a class="logo" href="/"><span class="mark">FC</span><span>${esc(C.SITE_NAME || 'FC Mobile Tools')}</span></a>`;
  if (!S.user) { topEl.innerHTML = `<div class="top-in">${logo}<div class="top-r"><button class="btn primary sm" data-act="signin">Sign in</button></div></div>`; return; }
  const approvedOwner = S.own && S.own.status === 'approved';
  const pill = S.mine ? coolBtn('kickoff', 'Kickoff', kickReady(S.mine.last_kickoff_at), KICK_MS, S.mine.id, 'mini') : '';
  topEl.innerHTML = `<div class="top-in">${logo}
    <nav class="tabs"><a href="#/" data-tab="">${ic('compass', 16)}Discover</a>${approvedOwner ? `<a href="#/scout" data-tab="scout">${ic('target', 16)}Scout Room</a>` : ''}<a href="#/hub" data-tab="hub">${ic('user', 16)}My Hub${S.badge ? `<i class="dot">${S.badge}</i>` : ''}</a></nav>
    <div class="top-r">${pill}<div class="menu-wrap"><button class="avbtn" data-act="menu" aria-label="Account">${avatar(S.profile?.avatar_url, S.profile?.ign || '?', 'round')}</button>
    <div class="menu"><a href="#/profile">${ic('user', 16)}Edit Player Card</a>${S.admin ? `<a href="/admin/leagues.html">${ic('shield', 16)}Admin panel</a>` : ''}<hr><button data-act="signout">${ic('out', 16)}Sign out</button></div></div></div></div>`;
  markTab(); tick();
}
function markTab() {
  const h = (location.hash.replace(/^#\/?/, '').split('/')[0]) || '';
  const t = h === 'scout' ? 'scout' : (h === 'hub' || h === 'profile' || h === 'register') ? 'hub' : '';
  $$('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === t));
}

/* ---------- logged-out gate ---------- */
function renderGate() {
  app.innerHTML = `<section class="gate wrap"><h1>Find the league<br>that <em>fits your squad.</em></h1>
    <p>Leagues for FC Mobile players — filtered by OVR, region, language and tournament pace. Free account, no spam.</p>
    <button class="btn primary lg" data-act="signin">Sign in to browse leagues</button>
    <div class="feat"><div>${ic('bolt', 22)}<b>Kickoff</b><span>Every league member can lift it to the top, every 6 hours.</span></div>
    <div>${ic('trophy', 22)}<b>Matchday Log</b><span>See which leagues really run tournaments for the 100-tournament quest.</span></div>
    <div>${ic('target', 22)}<b>Scout Room</b><span>League owners find active players. Players get invites, not spam.</span></div></div>
    <div class="grid lockrow">${skeletons(3)}</div></section>`;
}
const skeletons = (n) => Array.from({ length: n }, () => `<div class="lcard sk"><div class="lc-ban"></div><div class="lc-body"><i></i><i></i><i></i></div></div>`).join('');

/* ---------- image upload (ImgBB) ---------- */
async function uploadImg(file, { max = 800, square = false } = {}) {
  if (!C.IMGBB_KEY || C.IMGBB_KEY.startsWith('YOUR')) throw new Error('Image upload is not configured yet.');
  if (!/^image\//.test(file.type)) throw new Error('Pick an image file.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Image is too large (max 12MB).');
  let bmp; try { bmp = await createImageBitmap(file); } catch { throw new Error('Could not read that image. Try a JPG or PNG.'); }
  let sw = bmp.width, sh = bmp.height, sx = 0, sy = 0;
  if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
  const k = Math.min(1, max / Math.max(sw, sh)), w = Math.round(sw * k), h = Math.round(sh * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/webp', 0.86));
  if (!blob) throw new Error('Could not process that image.');
  const fd = new FormData(); fd.append('image', blob);
  const res = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(C.IMGBB_KEY), { method: 'POST', body: fd });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.success) throw new Error(j?.error?.message || 'Upload failed. Try again.');
  const url = j.data.url;
  if (!/^https:\/\/i\.ibb\.co(\.com)?\//.test(url)) throw new Error('Unexpected image host: ' + url);
  return url;
}
const uploader = (name, label, val, { wide = false, square = false, max = 800 } = {}) =>
  `<div class="up ${wide ? 'wide' : ''} ${val ? 'has' : ''}" data-sq="${square ? 1 : 0}" data-max="${max}">
    <div class="up-prev" style="${val ? `background-image:url('${esc(val)}')` : ''}"></div>
    <div class="grow"><b>${esc(label)}</b><label class="btn ghost sm" style="margin-top:6px">Upload image<input type="file" accept="image/*" hidden></label></div>
    <input type="hidden" name="${name}" value="${esc(val || '')}"></div>`;
document.addEventListener('change', async (e) => {
  const f = e.target; if (!f.matches?.('.up input[type=file]')) return;
  const up = f.closest('.up'), file = f.files[0]; if (!file) return;
  up.classList.add('busy');
  try {
    const url = await uploadImg(file, { max: +up.dataset.max || 800, square: up.dataset.sq === '1' });
    const h = up.querySelector('input[type=hidden]'); h.value = url;
    up.querySelector('.up-prev').style.backgroundImage = `url('${url}')`;
    h.dispatchEvent(new Event('input', { bubbles: true })); toast('Image uploaded');
  } catch (err) { toast(err.message || 'Upload failed', 'err'); }
  finally { up.classList.remove('busy'); f.value = ''; }
});

/* ---------- Player Card wizard (onboarding + edit) ---------- */
function renderWizard(mode) {
  const meta = S.user.user_metadata || {}, p = S.profile || {};
  const locked = !!S.member;                         // owners/members: status is managed by the system
  const W = {
    status: p.status || 'looking',
    ign: p.ign || meta.custom_claims?.global_name || meta.name || meta.full_name || '',
    uid: p.uid || '',
    discord: p.discord || (S.user.app_metadata?.provider === 'discord' ? (meta.full_name || '') : ''),
    ovr: p.ovr || '', region: p.region || '', language: p.language || '', play_style: p.play_style || 'casual',
    open_to_offers: p.open_to_offers ?? true, bio: p.bio || '', avatar_url: p.avatar_url || '',
  };
  const steps = locked ? [1, 2] : [0, 1, 2];
  let si = 0;
  const wrap = document.createElement('section'); wrap.className = 'wiz wrap';
  app.innerHTML = ''; app.append(wrap);
  wrap.addEventListener('input', (e) => { const t = e.target; if (t.name) W[t.name] = t.type === 'checkbox' ? t.checked : t.value; });

  const view = {
    0: () => `<h1>What's your situation?</h1><p class="mute">This tunes what we show you. You can change it later.</p>
      <div class="opts">
      ${[['looking', 'compass', 'Looking for a league', 'Show me leagues that fit my OVR and region.'], ['in_league', 'users', "I'm already in a league", 'Here for kickoffs, tournaments and updates.'], ['owner', 'shield', 'I own a league', 'List my league and scout active players.']]
        .map(([v, i, t, d]) => `<button type="button" class="opt ${W.status === v ? 'on' : ''}" data-v="${v}"><span class="oi">${ic(i, 22)}</span><span><b>${t}</b><span>${d}</span></span></button>`).join('')}</div>`,
    1: () => `<h1>Your Player Card</h1><p class="mute">Leagues and scouts see this. Your UID &amp; Discord stay private until you apply or accept an invite.</p>
      <div class="stack">${uploader('avatar_url', 'Profile picture', W.avatar_url, { square: true, max: 400 })}
      <label class="f"><span>In-game name <b>*</b></span><input type="text" name="ign" value="${esc(W.ign)}" maxlength="24" placeholder="Your FC Mobile name"></label>
      <div class="grid2"><label class="f"><span>FC Mobile UID <b>*</b></span><input type="text" name="uid" value="${esc(W.uid)}" maxlength="32" placeholder="e.g. 123456789"></label>
      <label class="f"><span>Team OVR <b>*</b></span><input type="number" name="ovr" value="${esc(W.ovr)}" min="1" max="200" inputmode="numeric" placeholder="e.g. 112"></label></div>
      <label class="f"><span>Discord username <b>*</b></span><input type="text" name="discord" value="${esc(W.discord)}" maxlength="40" placeholder="username"></label></div>`,
    2: () => `<h1>How do you play?</h1><p class="mute">Helps leagues know if you're a fit.</p>
      <div class="stack"><div class="grid2"><label class="f"><span>Region <b>*</b></span><select name="region">${opts(REGIONS, W.region, 'Choose…')}</select></label>
      <label class="f"><span>Language <b>*</b></span><select name="language">${opts(LANGS, W.language, 'Choose…')}</select></label></div>
      <div class="f"><span class="hint" style="font-weight:600">Play style</span><div class="seg" id="seg">${Object.entries(STYLES).map(([k, v]) => `<button type="button" data-s="${k}" class="${W.play_style === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <label class="f"><span>Short bio (optional)</span><textarea name="bio" maxlength="200" placeholder="Daily active, love tournaments…">${esc(W.bio)}</textarea></label>
      ${W.status === 'owner' || locked ? '' : `<label class="switch"><span><b style="display:block;color:var(--text)">Let league owners invite me</b><span class="hint">Appear in the Scout Room. Owners get 3 approaches a day.</span></span><input type="checkbox" name="open_to_offers" ${W.open_to_offers ? 'checked' : ''}></label>`}</div>`,
  };
  const validate = (s) => {
    if (s === 1) {
      if (!/^.{2,24}$/.test(W.ign.trim())) return 'In-game name must be 2–24 characters.';
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(W.uid.trim())) return 'UID: 3–32 letters/numbers only.';
      if (!(+W.ovr >= 1 && +W.ovr <= 200)) return 'Enter your team OVR.';
      if (W.discord.trim().length < 2) return 'Add your Discord username.';
    }
    if (s === 2 && (!W.region || !W.language)) return 'Choose your region and language.';
    return '';
  };
  function draw() {
    const s = steps[si], last = si === steps.length - 1;
    wrap.innerHTML = `<div class="row mute" style="justify-content:space-between;font-size:13px;font-weight:700"><span>${mode === 'edit' ? 'Edit' : 'Welcome'} · Step ${si + 1} of ${steps.length}</span>${mode === 'edit' ? '<a href="#/hub">Cancel</a>' : ''}</div>
      <div class="bar"><i style="width:${((si + 1) / steps.length) * 100}%"></i></div>
      <div class="step">${view[s]()}</div>
      <div class="row">${si ? '<button class="btn ghost" id="bk">Back</button>' : ''}<button class="btn primary grow lg" id="nx">${last ? (mode === 'edit' ? 'Save card' : 'Enter the hub') : 'Continue'}</button></div>`;
    $$('.opt', wrap).forEach((b) => b.onclick = () => { W.status = b.dataset.v; $$('.opt', wrap).forEach((x) => x.classList.toggle('on', x === b)); });
    $$('#seg button', wrap).forEach((b) => b.onclick = () => { W.play_style = b.dataset.s; $$('#seg button', wrap).forEach((x) => x.classList.toggle('on', x === b)); });
    $('#bk', wrap)?.addEventListener('click', () => { si--; draw(); });
    $('#nx', wrap).onclick = (e) => {
      const err = validate(s); if (err) return toast(err, 'err');
      if (!last) { si++; draw(); window.scrollTo(0, 0); return; }
      run(e.currentTarget, async () => {
        const row = { ign: W.ign.trim(), uid: W.uid.trim(), discord: W.discord.trim(), ovr: +W.ovr, region: W.region, language: W.language, play_style: W.play_style, open_to_offers: W.status === 'looking' || locked ? !!W.open_to_offers : false, bio: W.bio.trim(), avatar_url: W.avatar_url || null };
        let q;
        if (!S.profile) q = S.sb.from('fl_profiles').insert({ user_id: S.user.id, status: W.status, ...row });
        else { if (!locked) row.status = W.status; q = S.sb.from('fl_profiles').update(row).eq('user_id', S.user.id); }
        const { error } = await q; if (error) throw error;
        const wasNew = !S.profile;
        await loadMe(); renderTop(); toast(wasNew ? 'Player Card created' : 'Saved');
        go(wasNew ? (W.status === 'owner' && !S.own ? '#/register' : '#/') : '#/hub');
      });
    };
  }
  draw();
}

/* ---------- actions ---------- */
async function handleAct(el) {
  const a = el.dataset.act, id = el.dataset.id;
  switch (a) {
    case 'signin': return authModal();
    case 'menu': $('.menu')?.classList.toggle('on'); return;
    case 'signout': await S.sb.auth.signOut(); location.hash = '#/'; return;
    case 'kickoff': return run(el, async () => { await rpc('fl_kickoff', { p_league: id }); burst(el); toast('Kickoff! Your league is back on top.'); await refresh(); });
    case 'pulse': return run(el, async () => { await rpc('fl_pulse'); burst(el); toast('Pulse sent — league marked active.'); await refresh(); });
    case 'apply': return applyModal(id, el.dataset.name);
    case 'withdraw': return run(el, async () => { await rpc('fl_withdraw_application', { p_id: id }); toast('Request withdrawn'); await refresh(); });
    case 'leave': if (!confirm('Leave this league?')) return; return run(el, async () => { await rpc('fl_leave_league'); toast('You left the league'); await refresh(); });
    case 'review': return run(el, async () => { const r = await rpc('fl_review_application', { p_id: id, p_accept: el.dataset.ok === '1' }); toast(r === 'accepted' ? 'Player added to your roster' : r === 'player_in_league' ? 'That player already joined another league' : 'Declined'); await refresh(); });
    case 'remove': if (!confirm('Remove this member from your roster?')) return; return run(el, async () => { await rpc('fl_remove_member', { p_user: id }); toast('Member removed'); await refresh(); });
    case 'respond': return run(el, async () => { const r = await rpc('fl_respond_approach', { p_id: id, p_accept: el.dataset.ok === '1' }); toast(r === 'accepted' ? 'Welcome to the league!' : r === 'already_in_league' ? "You're already in a league" : 'Invite declined'); await refresh(); });
    case 'log': return run(el, async () => { const n = +$('#mdsize').value; await rpc('fl_log_matchday', { p_size: n }); toast("Today's tournament logged"); await refresh(); });
    case 'resubmit': return run(el, async () => { await rpc('fl_resubmit_league'); toast('Sent for review again'); await refresh(); });
    case 'delete-league': if (!confirm('Delete your league permanently? Members will be released.')) return; return run(el, async () => { const { error } = await S.sb.from('fl_leagues').delete().eq('id', id); if (error) throw error; toast('League deleted'); await loadMe(); renderTop(); go('#/'); });
    case 'copy': try { await navigator.clipboard.writeText(el.dataset.v); toast('Copied'); } catch { toast('Copy failed', 'err'); } return;
    case 'approach': return approachModal(+el.dataset.i);
    case 'scout-tab': S.scoutTab = el.dataset.v; return route();
    case 'more-market': return loadMarket(false);
  }
}

function applyModal(id, name) {
  const m = modal(`<h2>Request to join</h2><p class="mute"><b>${esc(name)}</b> will see your Player Card — IGN, UID, OVR and Discord.</p>
    <form class="stack"><textarea name="msg" maxlength="300" placeholder="Say hi — your OVR, how active you are, why this league."></textarea><button class="btn primary lg">Send request</button></form>`);
  $('form', m).onsubmit = (e) => { e.preventDefault(); const f = e.target; run(f.querySelector('button'), async () => { await rpc('fl_apply', { p_league: id, p_message: f.msg.value.trim() }); m.close(); toast('Request sent'); await refresh(); }); };
}

const notice = (t, d, href, label) => `<div class="empty wrap"><h3>${esc(t)}</h3>${esc(d)}<br><br><a class="btn primary" href="${href}">${esc(label)}</a></div>`;

/* ---------- router ---------- */
async function route() {
  if (!S.user || !S.profile) return;
  const my = ++S.rt; markTab();
  const h = location.hash.replace(/^#\/?/, ''), [a, b] = h.split('/');
  if (S.lastHash !== h) { window.scrollTo(0, 0); S.lastHash = h; }
  try {
    if (a === 'league') await viewLeague(b, my);
    else if (a === 'hub') await viewHub(my);
    else if (a === 'scout') await viewScout(my);
    else if (a === 'register') viewRegister();
    else if (a === 'profile') renderWizard('edit');
    else await viewDiscover();
  } catch (e) { console.error(e); if (my === S.rt) app.innerHTML = `<div class="empty"><h3>Something went wrong</h3>${esc(errMsg(e))}</div>`; }
  tick();
}

/* ---------- league card ---------- */
function tourLine(c) {
  if (!c.tourneys_per_week) return `${ic('trophy', 14)}<span>No regular tournaments</span>`;
  return `${ic('trophy', 14)}<span><b>${pace(c.tourneys_per_week)}</b> tournaments · ${fmtSize(c.tourney_min_size, c.tourney_max_size)}</span>`;
}
function cardHTML(c, i = 0) {
  const fresh = Date.now() - new Date(c.kicked_off_at) < 3600e3;
  const isNew = Date.now() - new Date(c.approved_at || c.created_at) < 7 * 864e5;
  const fit = S.profile && c.min_ovr <= S.profile.ovr;
  const spots = c.recruiting && c.spots_open > 0;
  return `<a class="lcard" href="#/league/${esc(c.id)}" style="--i:${i}">
    <div class="lc-ban" style="${bannerBg(c)}">${fresh ? `<span class="badge hot">${ic('bolt', 12)} Just kicked off</span>` : isNew ? '<span class="badge new">New</span>' : ''}</div>
    <div class="lc-body">
      <div class="lc-head">${avatar(c.logo_url, c.name, 'lg')}<div class="lc-t"><h3>${esc(c.name)}</h3><div class="sub">${c.tag ? `<span class="tag">${esc(c.tag)}</span>` : ''}<span>by ${esc(c.owner_ign || '—')}</span></div></div></div>
      <div class="lc-meta"><span>${ic('pin', 14)}${esc(REGIONS[c.region] || '')}</span><span>${ic('globe', 14)}${esc(LANGS[c.language] || '')}</span><span class="${fit ? 'ok' : ''}">${ic('shield', 14)}${c.min_ovr ? c.min_ovr + '+ OVR' : 'Any OVR'}</span></div>
      <div class="lc-tour">${tourLine(c)}</div>
      ${c.vibes?.length ? `<div class="chips">${c.vibes.slice(0, 3).map((v) => `<span class="chip">${esc(VIBES[v] || v)}</span>`).join('')}</div>` : ''}
      <div class="lc-foot"><span class="spots ${spots ? '' : 'full'}">${spots ? c.spots_open + ' spots open' : 'Full / closed'}</span><span class="pulse"><i></i>${c.pulse_24h} active · ${ago(c.kicked_off_at)}</span></div>
    </div></a>`;
}

/* ---------- Discover ---------- */
let loadSeq = 0;
async function viewDiscover() {
  const f = S.f;
  app.innerHTML = `<section class="wrap">
    <div class="head"><div><h1>Find your <em>league</em></h1><p class="mute">Freshly kicked-off leagues rise to the top.</p></div>
    ${S.own || S.member ? '' : `<a class="btn" href="#/register">${ic('plus', 16)}List your league</a>`}</div>
    <div class="filters glass">
      <label class="search">${ic('search', 18)}<input type="text" id="q" placeholder="Search league name or tag" value="${esc(f.q)}"></label>
      <select id="region">${opts(REGIONS, f.region, 'All regions')}</select>
      <select id="language">${opts(LANGS, f.language, 'All languages')}</select>
      <select id="sort"><option value="kick" ${f.sort === 'kick' ? 'selected' : ''}>Recently kicked off</option><option value="active" ${f.sort === 'active' ? 'selected' : ''}>Most active today</option><option value="new" ${f.sort === 'new' ? 'selected' : ''}>Newest</option><option value="spots" ${f.sort === 'spots' ? 'selected' : ''}>Most open spots</option></select>
    </div>
    <div class="toggles">
      <button class="tgl" data-t="open" aria-pressed="${f.open}">Open spots</button>
      <button class="tgl" data-t="fit" aria-pressed="${f.fit}">Fits my OVR (${S.profile.ovr})</button>
      <button class="tgl" data-t="quest" aria-pressed="${f.quest}">${ic('trophy', 14)}Quest-ready · daily tournaments</button>
    </div>
    <div class="scroller" id="vibes">${Object.entries(VIBES).map(([k, v]) => `<button class="chip btnish ${f.vibes.includes(k) ? 'on' : ''}" data-v="${k}">${v}</button>`).join('')}</div>
    <div id="grid" class="grid"></div><div id="more" class="row" style="justify-content:center;margin-top:26px"></div></section>`;
  let t; const q = $('#q');
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { f.q = q.value; loadCards(true); }, 280); });
  ['region', 'language', 'sort'].forEach((id) => $('#' + id).addEventListener('change', (e) => { f[id] = e.target.value; loadCards(true); }));
  $$('.tgl').forEach((b) => b.onclick = () => { f[b.dataset.t] = !f[b.dataset.t]; b.setAttribute('aria-pressed', f[b.dataset.t]); loadCards(true); });
  $$('#vibes .chip').forEach((b) => b.onclick = () => { const v = b.dataset.v; f.vibes = f.vibes.includes(v) ? f.vibes.filter((x) => x !== v) : [...f.vibes, v]; b.classList.toggle('on'); loadCards(true); });
  S.page = 0; await loadCards(true);
}
async function loadCards(reset) {
  const my = ++loadSeq, grid = $('#grid'); if (!grid) return;
  const f = S.f, PAGE = 18;
  if (reset) { S.page = 0; grid.innerHTML = skeletons(6); $('#more').innerHTML = ''; }
  let q = S.sb.from('fl_league_cards').select('*');
  const s = f.q.replace(/[,()*%\\]/g, ' ').trim();
  if (s) q = q.or(`name.ilike.%${s}%,tag.ilike.%${s}%`);
  if (f.region) q = q.eq('region', f.region);
  if (f.language) q = q.eq('language', f.language);
  if (f.open) q = q.gt('spots_open', 0).eq('recruiting', true);
  if (f.fit) q = q.lte('min_ovr', S.profile.ovr);
  if (f.quest) q = q.gte('tourneys_per_week', 7);
  if (f.vibes.length) q = q.contains('vibes', f.vibes);
  if (f.sort === 'active') q = q.order('pulse_24h', { ascending: false }).order('kicked_off_at', { ascending: false });
  else if (f.sort === 'new') q = q.order('approved_at', { ascending: false, nullsFirst: false });
  else if (f.sort === 'spots') q = q.order('spots_open', { ascending: false }).order('kicked_off_at', { ascending: false });
  else q = q.order('kicked_off_at', { ascending: false });
  q = q.order('id');
  const from = S.page * PAGE; q = q.range(from, from + PAGE - 1);
  const { data, error } = await q;
  if (my !== loadSeq || !$('#grid')) return;
  if (error) { grid.innerHTML = `<div class="empty"><h3>Couldn't load leagues</h3>${esc(errMsg(error))}</div>`; return; }
  if (reset) grid.innerHTML = '';
  if (reset && !data.length) {
    grid.innerHTML = `<div class="empty"><h3>No leagues match</h3>Try removing a filter — or be the first to list yours.<br><br><a class="btn primary" href="#/register">List your league</a></div>`; return;
  }
  grid.insertAdjacentHTML('beforeend', data.map((c, i) => cardHTML(c, i)).join(''));
  $('#more').innerHTML = data.length === PAGE ? '<button class="btn ghost" id="more-b">Load more</button>' : '';
  $('#more-b')?.addEventListener('click', () => { S.page++; loadCards(false); });
}

/* ---------- League detail ---------- */
async function viewLeague(id, my) {
  app.innerHTML = `<div class="wrap"><div class="grid">${skeletons(1)}</div></div>`;
  let d;
  try { d = await rpc('fl_league_detail', { p_id: id }); } catch (e) { if (my !== S.rt) return; app.innerHTML = notice('League not found', 'It may have been removed or is awaiting approval.', '#/', 'Back to leagues'); return; }
  if (my !== S.rt) return;
  const L = d.league, me = d.my, isMember = me.member_of === L.id, isOwner = S.own?.id === L.id, inOther = me.member_of && !isMember;
  let cta = '';
  if (isMember) {
    cta = `${coolBtn('kickoff', 'Kickoff', kickReady(L.last_kickoff_at), KICK_MS, L.id)}${coolBtn('pulse', 'Send Pulse', me.last_pulse ? new Date(me.last_pulse).getTime() + PULSE_MS : 0, PULSE_MS, L.id, 'alt')}
      <p class="hint">Kickoff lifts the league to the top for everyone (every 6h, any member). Pulse tells players it's alive (every 24h).</p>${isOwner ? '' : '<button class="btn danger sm" data-act="leave">Leave league</button>'}`;
  } else if (inOther) cta = `<p class="mute">You're in another league. Leave it from My Hub to apply here.</p>`;
  else if (me.application?.status === 'pending') cta = `<div class="banner ok" style="margin:0">${ic('check', 16)} Request pending</div><button class="btn ghost" data-act="withdraw" data-id="${esc(me.application.id)}">Withdraw request</button>`;
  else if (L.recruiting) cta = `<button class="btn primary block lg" data-act="apply" data-id="${esc(L.id)}" data-name="${esc(L.name)}">Request to join</button>${me.application?.status === 'declined' ? '<p class="hint">Your last request was declined — you can try again.</p>' : ''}`;
  else cta = `<p class="mute">Not recruiting right now.</p>`;
  cta += `<a class="btn block" href="${esc(L.discord_url)}" target="_blank" rel="noopener noreferrer">${ic('send', 16)}Open league Discord</a>`;
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10));
  const logged = new Map(d.matchdays.map((m) => [m.day, m.size]));
  const qd = questDays(L.tourneys_per_week);
  app.innerHTML = `<section class="wrap"><a class="back" href="#/">${ic('back', 16)}All leagues</a>
    <div class="hero glass"><div class="ban" style="${bannerBg(L)}"></div>
      <div class="hi">${avatar(L.logo_url, L.name, 'xl')}<div class="grow"><h1>${esc(L.name)}${L.tag ? `<span class="tag">${esc(L.tag)}</span>` : ''}</h1>
      <div class="meta"><span>${ic('pin', 15)}${esc(REGIONS[L.region] || '')}</span><span>${ic('globe', 15)}${esc(LANGS[L.language] || '')}</span><span>${ic('user', 15)}Owner ${esc(L.owner_ign || '—')}</span><span class="pulse"><i></i>Kicked off ${ago(L.kicked_off_at)}</span></div></div></div></div>
    <div class="cols"><div>
      <div class="stats"><div class="stat"><small>Min OVR</small><b>${L.min_ovr || 'Any'}</b></div>
        <div class="stat"><small>Open spots</small><b>${L.recruiting ? L.spots_open : 0}</b><span>of ${L.capacity}</span></div>
        <div class="stat"><small>Tournaments (7d)</small><b>${L.matchdays_7d}</b><span>logged by owner</span></div>
        <div class="stat"><small>Pulse (24h)</small><b>${L.pulse_24h}</b><span>members active</span></div></div>
      <div class="glass panel"><h3>About</h3><p>${esc(L.description) || '<span class="mute">No description yet.</span>'}</p>${L.vibes?.length ? `<div class="chips" style="margin-top:14px">${L.vibes.map((v) => `<span class="chip">${esc(VIBES[v] || v)}</span>`).join('')}</div>` : ''}</div>
      <div class="glass panel"><h3>${ic('trophy', 18)}Tournament pace <small>last 14 days</small></h3>
        <div class="row" style="gap:22px"><div><small class="mute">Format</small><div><b>${fmtSize(L.tourney_min_size, L.tourney_max_size)}</b></div></div><div><small class="mute">Frequency</small><div><b>${L.tourneys_per_week ? pace(L.tourneys_per_week) : 'Ad-hoc'}</b></div></div>
        ${qd ? `<div><small class="mute">100-tournament quest pace</small><div><b>~${qd} days</b></div></div>` : ''}</div>
        <div class="days" title="Green = tournament logged that day">${days.map((x) => `<i class="${logged.has(x) ? 'on' : ''}" title="${x}${logged.has(x) ? ' · ' + logged.get(x) + 'v' + logged.get(x) : ''}"></i>`).join('')}</div>
        <p class="hint" style="margin-top:10px">Owner-logged matchdays. Every member counts toward a league tournament even if they don't play.</p></div>
      <div class="glass panel"><h3>${ic('users', 18)}On ${esc(C.SITE_NAME || 'FC Mobile Tools')} <small>${d.roster.length} members</small></h3>
        ${d.roster.length ? `<div class="roster">${d.roster.map((r) => `<div class="rm">${avatar(r.avatar_url, r.ign, 'sm')}<div style="min-width:0"><b>${esc(r.ign)}</b><small>${r.role === 'owner' ? 'Owner · ' : ''}${r.ovr} OVR</small></div></div>`).join('')}</div>` : '<p class="mute">No members have joined through the site yet.</p>'}</div>
    </div>
    <aside><div class="glass panel stack" style="position:sticky;top:90px">${cta}
      ${d.kickoffs.length ? `<div style="margin-top:6px"><h3 style="font-size:14px;margin-bottom:10px">${ic('bolt', 16)}Recent kickoffs</h3><div class="list">${d.kickoffs.map((k) => `<div class="row" style="justify-content:space-between;font-size:13.5px"><b>${esc(k.ign)}</b><span class="mute">${ago(k.at)}</span></div>`).join('')}</div></div>` : ''}
    </div></aside></div></section>`;
}

/* ---------- My Hub ---------- */
async function viewHub(my) {
  const uid = S.user.id;
  app.innerHTML = `<div class="wrap"><div class="grid">${skeletons(2)}</div></div>`;
  const [apps, appr, detail, inbox] = await Promise.all([
    S.sb.from('fl_applications').select('id,league_id,status,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(15),
    S.sb.from('fl_approaches').select('id,league_id,status,message,created_at').eq('player_id', uid).order('created_at', { ascending: false }).limit(15),
    S.mine ? rpc('fl_league_detail', { p_id: S.mine.id }) : Promise.resolve(null),
    S.own?.status === 'approved' ? rpc('fl_league_inbox') : Promise.resolve([]),
  ]);
  if (my !== S.rt) return;
  const ids = [...new Set([...(apps.data || []), ...(appr.data || [])].map((x) => x.league_id))];
  const cards = {};
  if (ids.length) { const { data } = await S.sb.from('fl_league_cards').select('id,name,tag,logo_url').in('id', ids); (data || []).forEach((c) => (cards[c.id] = c)); }
  if (my !== S.rt) return;
  const p = S.profile, stLabel = { looking: 'Looking for a league', in_league: 'In a league', owner: 'League owner' }[p.status];
  const lname = (id) => cards[id] ? `<a href="#/league/${esc(id)}"><b>${esc(cards[id].name)}</b></a>` : '<b class="mute">League unavailable</b>';
  const statePill = (s) => `<span class="pill ${s === 'accepted' ? 'ok' : s === 'declined' || s === 'withdrawn' ? 'bad' : 'warn'}">${s === 'sent' ? 'invite' : s}</span>`;

  let left = `<div class="glass panel"><div class="row"><div>${avatar(p.avatar_url, p.ign, 'xl')}</div><div class="grow"><h2 style="font-size:22px">${esc(p.ign)}</h2>
    <div class="row" style="gap:8px;margin-top:6px"><span class="pill ok">${esc(stLabel)}</span><span class="pill">${p.ovr} OVR</span><span class="pill">${esc(STYLES[p.play_style])}</span></div>
    <p class="hint" style="margin-top:8px">UID ${esc(p.uid)} · Discord ${esc(p.discord)} · ${esc(REGIONS[p.region])}</p></div><a class="btn sm" href="#/profile">Edit card</a></div></div>`;

  if (S.mine && detail) {
    const L = detail.league, me = detail.my;
    left += `<div class="glass panel"><h3>${ic('shield', 18)}My league</h3><div class="row" style="margin-bottom:16px">${avatar(L.logo_url, L.name, 'lg')}<div class="grow"><a href="#/league/${esc(L.id)}"><b style="font-size:18px">${esc(L.name)}</b></a><div class="hint">${L.pulse_24h} active today · kicked off ${ago(L.kicked_off_at)}</div></div></div>
      <div class="grid2">${coolBtn('kickoff', 'Kickoff', kickReady(L.last_kickoff_at), KICK_MS, L.id)}${coolBtn('pulse', 'Send Pulse', me.last_pulse ? new Date(me.last_pulse).getTime() + PULSE_MS : 0, PULSE_MS, L.id, 'alt')}</div>
      <p class="hint" style="margin-top:12px">Come back every 6h to Kickoff, every 24h to send a Pulse. Any member can do it — whoever's first keeps the league on top.</p>
      ${S.own ? '' : '<button class="btn danger sm" style="margin-top:12px" data-act="leave">Leave league</button>'}</div>`;
  } else if (!S.own) {
    const inv = (appr.data || []).filter((x) => x.status === 'sent');
    if (inv.length) left += `<div class="glass panel"><h3>Invites <small>${inv.length} waiting</small></h3><div class="list">${inv.map((x) => `<div class="item"><div class="grow">${lname(x.league_id)}<small>${esc(x.message || 'You were invited to join.')}</small></div><button class="btn primary sm" data-act="respond" data-ok="1" data-id="${x.id}">Accept</button><button class="btn ghost sm" data-act="respond" data-ok="0" data-id="${x.id}">Decline</button></div>`).join('')}</div></div>`;
    const myApps = apps.data || [];
    left += `<div class="glass panel"><h3>My requests</h3>${myApps.length ? `<div class="list">${myApps.map((x) => `<div class="item"><div class="grow">${lname(x.league_id)}<small>${ago(x.created_at)}</small></div>${statePill(x.status)}${x.status === 'pending' ? `<button class="btn ghost sm" data-act="withdraw" data-id="${x.id}">Withdraw</button>` : ''}</div>`).join('')}</div>` : `<p class="mute">No requests yet.</p><a class="btn primary" style="margin-top:12px" href="#/">Browse leagues</a>`}</div>`;
  }

  let right = '';
  if (S.own) {
    const L = S.own, st = L.status;
    const banner = st === 'pending' ? `<div class="banner warn">${ic('lock', 18)}<div><b>Waiting for admin approval</b><div class="hint">We review new leagues so players can trust what they see. You'll go live as soon as it's approved.</div></div></div>`
      : st === 'rejected' ? `<div class="banner bad"><div class="grow"><b>Not approved</b><div class="hint">${esc(L.reject_reason || 'No reason provided.')}</div></div><button class="btn sm" data-act="resubmit">Resubmit after editing</button></div>`
      : st === 'suspended' ? `<div class="banner bad"><div><b>League suspended</b><div class="hint">${esc(L.reject_reason || 'Contact the site admin.')}</div></div></div>`
      : `<div class="banner ok">${ic('check', 18)}<b>Live on Find a League</b></div>`;
    right += `<div class="glass panel"><h3>${ic('trophy', 18)}League control <small>${esc(L.name)}</small></h3>${banner}<div class="row"><a class="btn" href="#/register">Edit league</a>${st === 'approved' ? `<a class="btn primary" href="#/scout">${ic('target', 16)}Scout Room</a>` : ''}<button class="btn danger sm" data-act="delete-league" data-id="${L.id}">Delete</button></div></div>`;
    if (st === 'approved' && detail) {
      const today = new Date().toISOString().slice(0, 10), done = detail.matchdays.find((m) => m.day === today);
      right += `<div class="glass panel"><h3>Matchday log</h3><p class="hint" style="margin-bottom:12px">Log today's tournament. Players see this proof of activity — great for quest hunters.</p>
        <div class="row"><input type="number" id="mdsize" min="4" max="32" value="${done ? done.size : L.tourney_max_size}" style="width:90px"><span class="mute">v</span><span class="mute">size</span><button class="btn primary grow" data-act="log">${done ? 'Update today' : "Log today's tournament"}</button></div>${done ? `<p class="hint" style="margin-top:8px">${ic('check', 14)} Logged today (${done.size}v${done.size}).</p>` : ''}</div>`;
      right += `<div class="glass panel"><h3>Join requests <small>${inbox.length}</small></h3>${inbox.length ? `<div class="list">${inbox.map((a) => `<div class="item">${avatar(a.avatar_url, a.ign, 'sm')}<div class="grow"><b>${esc(a.ign)} <span class="pill">${a.ovr} OVR</span></b><small>${esc(REGIONS[a.region])} · ${esc(STYLES[a.play_style])} · UID ${esc(a.uid)} · Discord ${esc(a.discord)}</small>${a.message ? `<small style="display:block;margin-top:4px;color:var(--text)">“${esc(a.message)}”</small>` : ''}</div><button class="btn primary sm" data-act="review" data-ok="1" data-id="${a.id}">Accept</button><button class="btn ghost sm" data-act="review" data-ok="0" data-id="${a.id}">Decline</button></div>`).join('')}</div>` : '<p class="mute">No pending requests. Players can apply from your league page.</p>'}</div>`;
      const others = detail.roster.filter((r) => r.role !== 'owner');
      right += `<div class="glass panel"><h3>Roster on site <small>${others.length}</small></h3>${others.length ? `<div class="list">${others.map((r) => `<div class="item">${avatar(r.avatar_url, r.ign, 'sm')}<div class="grow"><b>${esc(r.ign)}</b><small>${r.ovr} OVR</small></div><button class="btn danger sm" data-act="remove" data-id="${r.user_id}">Remove</button></div>`).join('')}</div>` : '<p class="mute">Members who join through the site appear here.</p>'}</div>`;
    }
  } else if (!S.member) {
    right += `<div class="glass panel"><h3>${ic('shield', 18)}Own a league?</h3><p class="mute" style="margin-bottom:14px">List it free, climb with Kickoff, and scout players looking for a home.</p><a class="btn primary" href="#/register">List my league</a></div>`;
  }
  app.innerHTML = `<section class="wrap"><div class="head"><div><h1>My <em>Hub</em></h1><p class="mute">Your card, your league, your requests.</p></div></div><div class="cols cols2"><div>${left}</div><div>${right}</div></div></section>`;
}

/* ---------- Register / edit league ---------- */
function viewRegister() {
  if (S.member && !S.own) { app.innerHTML = notice("You're already in a league", 'Leave it from My Hub before registering your own.', '#/hub', 'Go to My Hub'); return; }
  const L = S.own || {}, edit = !!S.own;
  const R = { name: L.name || '', tag: L.tag || '', description: L.description || '', logo_url: L.logo_url || '', banner_url: L.banner_url || '', discord_url: L.discord_url || '', region: L.region || '', language: L.language || '', capacity: L.capacity ?? 30, members_in_game: L.members_in_game ?? 1, min_ovr: L.min_ovr ?? 0, tourneys_per_week: L.tourneys_per_week ?? 0, tourney_min_size: L.tourney_min_size ?? 4, tourney_max_size: L.tourney_max_size ?? 32, vibes: [...(L.vibes || [])], recruiting: L.recruiting ?? true };
  app.innerHTML = `<section class="wrap"><a class="back" href="${edit ? '#/hub' : '#/'}">${ic('back', 16)}Back</a>
    <div class="head"><div><h1>${edit ? 'Edit your' : 'List your'} <em>league</em></h1><p class="mute">${edit ? 'Changes go live instantly.' : 'An admin reviews every new league before it goes live.'}</p></div></div>
    <div class="cols"><form id="rf" class="glass panel stack" novalidate>
      <div class="grid2">${uploader('logo_url', 'League logo', R.logo_url, { square: true, max: 400 })}${uploader('banner_url', 'Banner (wide)', R.banner_url, { wide: true, max: 1400 })}</div>
      <div class="grid2"><label class="f"><span>League name <b>*</b></span><input type="text" name="name" maxlength="32" value="${esc(R.name)}" placeholder="3–32 characters"></label>
      <label class="f"><span>Tag</span><input type="text" name="tag" maxlength="6" value="${esc(R.tag)}" placeholder="e.g. FCMT"></label></div>
      <label class="f"><span>Discord invite link <b>*</b></span><input type="url" name="discord_url" value="${esc(R.discord_url)}" placeholder="https://discord.gg/yourcode"><span class="hint">Use a permanent (never-expiring) invite.</span></label>
      <div class="grid2"><label class="f"><span>Region <b>*</b></span><select name="region">${opts(REGIONS, R.region, 'Choose…')}</select></label><label class="f"><span>Main language <b>*</b></span><select name="language">${opts(LANGS, R.language, 'Choose…')}</select></label></div>
      <div class="grid3"><label class="f"><span>Capacity</span><input type="number" name="capacity" min="5" max="100" value="${R.capacity}"></label><label class="f"><span>Members now</span><input type="number" name="members_in_game" min="0" max="100" value="${R.members_in_game}"></label><label class="f"><span>Min OVR</span><input type="number" name="min_ovr" min="0" max="200" value="${R.min_ovr}"></label></div>
      <div class="grid3"><label class="f"><span>Tournaments / week</span><input type="number" name="tourneys_per_week" min="0" max="14" value="${R.tourneys_per_week}"></label><label class="f"><span>Smallest (vs)</span><input type="number" name="tourney_min_size" min="4" max="32" value="${R.tourney_min_size}"></label><label class="f"><span>Largest (vs)</span><input type="number" name="tourney_max_size" min="4" max="32" value="${R.tourney_max_size}"></label></div>
      <div class="f"><span class="hint" style="font-weight:600">Vibe — pick up to 4</span><div class="chips" id="vb" style="margin-top:8px">${Object.entries(VIBES).map(([k, v]) => `<button type="button" class="chip btnish ${R.vibes.includes(k) ? 'on' : ''}" data-v="${k}">${v}</button>`).join('')}</div></div>
      <label class="f"><span>About your league</span><textarea name="description" maxlength="600" placeholder="Rules, activity expectations, what makes you different.">${esc(R.description)}</textarea></label>
      <label class="switch"><span><b style="display:block;color:var(--text)">Recruiting</b><span class="hint">Players can send join requests.</span></span><input type="checkbox" name="recruiting" ${R.recruiting ? 'checked' : ''}></label>
      <button class="btn primary lg" id="rs">${edit ? 'Save changes' : 'Submit for approval'}</button></form>
    <aside><div class="preview"><p class="hint" style="margin-bottom:10px">Live preview</p><div id="pv"></div></div></aside></div></section>`;
  const form = $('#rf');
  const drawPv = () => { const sp = Math.max((+R.capacity || 0) - (+R.members_in_game || 0), 0); $('#pv').innerHTML = cardHTML({ ...R, name: R.name || 'Your league name', id: 'x', spots_open: sp, pulse_24h: 0, kicked_off_at: new Date().toISOString(), approved_at: new Date().toISOString(), owner_ign: S.profile.ign, min_ovr: +R.min_ovr || 0, tourneys_per_week: +R.tourneys_per_week || 0, tourney_min_size: +R.tourney_min_size || 4, tourney_max_size: +R.tourney_max_size || 32 }, 0); };
  drawPv();
  form.addEventListener('input', (e) => { const t = e.target; if (!t.name) return; R[t.name] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? '' : +t.value) : t.value; drawPv(); });
  $$('#vb .chip', form).forEach((b) => b.onclick = () => {
    const v = b.dataset.v;
    if (R.vibes.includes(v)) R.vibes = R.vibes.filter((x) => x !== v);
    else if (R.vibes.length >= 4) return toast('Pick up to 4 vibes', 'err');
    else R.vibes.push(v);
    b.classList.toggle('on', R.vibes.includes(v)); drawPv();
  });
  $('#rs').onclick = (e) => {
    e.preventDefault();
    const n = (x) => +x || 0, name = R.name.trim();
    let err = '';
    if (name.length < 3) err = 'League name needs 3–32 characters.';
    else if (R.tag.trim() && (R.tag.trim().length < 2)) err = 'Tag needs 2–6 characters (or leave it empty).';
    else if (!DISCORD_RE.test(R.discord_url.trim())) err = 'Enter a valid Discord invite (discord.gg/… or discord.com/invite/…).';
    else if (!R.region || !R.language) err = 'Choose region and language.';
    else if (n(R.capacity) < 5 || n(R.capacity) > 100) err = 'Capacity must be 5–100.';
    else if (n(R.members_in_game) > n(R.capacity)) err = "Members can't exceed capacity.";
    else if (n(R.tourney_min_size) < 4 || n(R.tourney_max_size) > 32 || n(R.tourney_min_size) > n(R.tourney_max_size)) err = 'Tournament sizes: 4v4 up to 32v32, smallest ≤ largest.';
    else if (n(R.tourneys_per_week) < 0 || n(R.tourneys_per_week) > 14) err = 'Tournaments per week: 0–14.';
    if (err) return toast(err, 'err');
    run(e.currentTarget, async () => {
      const row = { name, tag: R.tag.trim() || null, description: R.description.trim(), logo_url: R.logo_url || null, banner_url: R.banner_url || null, discord_url: R.discord_url.trim(), region: R.region, language: R.language, capacity: n(R.capacity), members_in_game: n(R.members_in_game), min_ovr: n(R.min_ovr), tourneys_per_week: n(R.tourneys_per_week), tourney_min_size: n(R.tourney_min_size), tourney_max_size: n(R.tourney_max_size), vibes: R.vibes, recruiting: !!R.recruiting };
      const { error } = edit ? await S.sb.from('fl_leagues').update(row).eq('id', S.own.id) : await S.sb.from('fl_leagues').insert({ owner_id: S.user.id, ...row });
      if (error) throw error;
      await loadMe(); renderTop(); toast(edit ? 'League updated' : 'Submitted — we will review it shortly'); go('#/hub');
    });
  };
}

/* ---------- Scout Room ---------- */
async function viewScout(my) {
  if (!(S.own && S.own.status === 'approved')) { app.innerHTML = notice('Scout Room is for approved league owners', 'Once an admin approves your league you can find players here.', S.own ? '#/hub' : '#/register', S.own ? 'Check league status' : 'List my league'); return; }
  S.quota = await rpc('fl_scout_quota'); if (my !== S.rt) return;
  S.sf = S.sf || { region: '', min: '', max: '', style: '' };
  const sf = S.sf;
  app.innerHTML = `<section class="wrap"><div class="head"><div><h1>Scout <em>Room</em></h1><p class="mute">Players who are looking for a league and open to invites.</p></div><div class="glass" style="padding:12px 16px"><div class="hint" style="margin-bottom:6px">Scout passes today</div><div class="quota" id="qt"></div></div></div>
    <div class="subtabs"><button class="tgl" data-act="scout-tab" data-v="market" aria-pressed="${S.scoutTab === 'market'}">Find players</button><button class="tgl" data-act="scout-tab" data-v="sent" aria-pressed="${S.scoutTab === 'sent'}">Approached</button></div><div id="sc"></div></section>`;
  drawQuota();
  if (S.scoutTab === 'sent') {
    const sent = await rpc('fl_scout_sent'); if (my !== S.rt) return;
    $('#sc').innerHTML = sent.length ? `<div class="list">${sent.map((a) => `<div class="item">${avatar(a.avatar_url, a.ign, 'lg')}<div class="grow"><b>${esc(a.ign)} <span class="pill">${a.ovr} OVR</span></b><small>UID ${esc(a.uid)} · Discord ${esc(a.discord)}</small><small style="display:block">${ago(a.created_at)}</small></div><span class="pill ${a.status === 'accepted' ? 'ok' : a.status === 'declined' ? 'bad' : 'warn'}">${a.status === 'sent' ? 'waiting' : a.status}</span><button class="btn ghost sm" data-act="copy" data-v="${esc(a.discord)}">${ic('copy', 14)}Discord</button></div>`).join('')}</div>` : '<div class="empty"><h3>No approaches yet</h3>Find a player and approach them — their contact is revealed instantly.</div>';
    return;
  }
  $('#sc').innerHTML = `<div class="filters glass fscout"><select id="sr">${opts(REGIONS, sf.region, 'Any region')}</select><input type="number" id="smin" placeholder="Min OVR" value="${esc(sf.min)}"><input type="number" id="smax" placeholder="Max OVR" value="${esc(sf.max)}"><select id="ss">${opts(STYLES, sf.style, 'Any style')}</select><button class="btn primary" id="sgo">Search</button></div><div id="pl" class="grid" style="margin-top:6px"></div><div id="pm" class="row" style="justify-content:center;margin-top:24px"></div>`;
  $('#sgo').onclick = () => { sf.region = $('#sr').value; sf.min = $('#smin').value; sf.max = $('#smax').value; sf.style = $('#ss').value; loadMarket(true); };
  await loadMarket(true);
}
function drawQuota() {
  const q = S.quota; if (!$('#qt')) return;
  $('#qt').innerHTML = Array.from({ length: q.limit }, (_, i) => `<i class="${i < q.used ? 'used' : ''}"></i>`).join('') + `<span class="hint" style="margin-left:8px">${Math.max(q.limit - q.used, 0)} left · resets 00:00 UTC</span>`;
}
async function loadMarket(reset) {
  const sf = S.sf, PAGE = 24, box = $('#pl'); if (!box) return;
  if (reset) { S.market = []; box.innerHTML = skeletons(3); $('#pm').innerHTML = ''; }
  let rows;
  try { rows = await rpc('fl_scout_market', { p_region: sf.region || null, p_min_ovr: sf.min === '' ? null : +sf.min, p_max_ovr: sf.max === '' ? null : +sf.max, p_style: sf.style || null, p_limit: PAGE, p_offset: S.market.length }); }
  catch (e) { box.innerHTML = `<div class="empty"><h3>Couldn't load players</h3>${esc(errMsg(e))}</div>`; return; }
  if (!$('#pl')) return;
  S.market = reset ? rows : S.market.concat(rows);
  const draw = (p, i) => `<article class="pcard" style="--i:${i % PAGE}"><div class="top2">${avatar(p.avatar_url, p.ign, 'lg')}<div style="min-width:0"><b style="font-size:16px">${esc(p.ign)}</b><div class="hint">Active ${ago(p.active_at)}</div></div><span class="ovr">${p.ovr}</span></div>
    <div class="chips"><span class="chip">${esc(REGIONS[p.region])}</span><span class="chip">${esc(LANGS[p.language])}</span><span class="chip">${esc(STYLES[p.play_style])}</span></div>${p.bio ? `<p class="mute" style="font-size:13.5px">${esc(p.bio)}</p>` : ''}
    <button class="btn ${p.approached ? 'ghost' : 'primary'}" data-act="approach" data-i="${i}" ${p.approached ? 'disabled' : ''}>${p.approached ? 'Approached' : `${ic('send', 16)}Approach`}</button></article>`;
  box.innerHTML = S.market.length ? S.market.map(draw).join('') : '<div class="empty"><h3>No players match</h3>Widen your filters — new players join daily.</div>';
  $('#pm').innerHTML = rows.length === PAGE ? '<button class="btn ghost" data-act="more-market">Load more</button>' : '';
}
function approachModal(i) {
  const p = S.market[i], L = S.own; if (!p) return;
  if (S.quota.used >= S.quota.limit) return toast('All 3 scout passes used today. They reset at 00:00 UTC.', 'err');
  const def = `Hey ${p.ign}! We're ${L.name}${L.min_ovr ? ` (${L.min_ovr}+ OVR)` : ''} — ${L.tourneys_per_week ? pace(L.tourneys_per_week).toLowerCase() + ' tournaments' : 'active league'}. Want to join us?`;
  const m = modal(`<h2>Approach ${esc(p.ign)}</h2><p class="mute">Uses 1 of your ${S.quota.limit - S.quota.used} scout passes left today. Their UID &amp; Discord unlock instantly, and they get your invite in their Hub.</p>
    <form class="stack"><textarea name="msg" maxlength="300">${esc(def)}</textarea><button class="btn primary lg">${ic('send', 16)}Send invite</button></form>`);
  $('form', m).onsubmit = (e) => { e.preventDefault(); const f = e.target; run(f.querySelector('button'), async () => {
    const r = await rpc('fl_scout_approach', { p_player: p.user_id, p_message: f.msg.value.trim() });
    p.approached = true; S.quota.used = S.quota.limit - r.remaining; drawQuota();
    m.querySelector('.stack').outerHTML = `<div class="reveal"><b>Invite sent ✔</b><div><span class="mute">Discord</span><span><b>${esc(r.player.discord)}</b> <button class="btn ghost sm" data-act="copy" data-v="${esc(r.player.discord)}">${ic('copy', 14)}</button></span></div><div><span class="mute">UID</span><span><b>${esc(r.player.uid)}</b> <button class="btn ghost sm" data-act="copy" data-v="${esc(r.player.uid)}">${ic('copy', 14)}</button></span></div><p class="hint">DM them on Discord with your league invite link. Find them again anytime under “Approached”.</p></div>`;
    loadMarketDraw();
  }); };
}
function loadMarketDraw() { const keep = S.market; const box = $('#pl'); if (!box) return; $$('.pcard', box).forEach((c, i) => { const p = keep[i]; if (p?.approached) { const b = $('button[data-act=approach]', c); if (b) { b.disabled = true; b.className = 'btn ghost'; b.textContent = 'Approached'; } } }); }

/* ---------- start ---------- */
// boot() is triggered by the INITIAL_SESSION auth event above
