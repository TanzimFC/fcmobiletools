// FCMobiletools Draw Stage
// A full-screen, broadcast-style draw show: preparing, seed lock, entry freeze, ticket scan,
// shuffle, ranking, countdown, winner reveals and a final board. Built to be screen-recorded.
//
// Used by the admin panel (live draw) and by /giveaways/<slug>/draw/ (public replay + rehearsal).
// The stage never decides a winner. It animates a result that the server (or a published draw)
// already produced, and it says so on screen when the show is a rehearsal.
//
// No dependencies. Import it with:  const { openDrawStage } = await import('/giveaway-stage/stage.js');

const SKIP = Symbol('skip');
export const SPEEDS = { quick: 0.3, standard: 1, epic: 2.2 };
export const SPEED_LABELS = { quick: 'Quick, about 30 seconds', standard: 'Standard, about 1.5 minutes', epic: 'Epic, about 3 minutes' };

// ───────────── plan (pure, so it can be tested) ─────────────
export function planStage({ speed = 'standard', winners = 1 } = {}) {
  const m = typeof speed === 'number' ? speed : (SPEEDS[speed] ?? 1);
  const floor = m < 0.2 ? 500 : 1800;
  const base = [['prepare', 9000], ['seed', 8000], ['freeze', 9000], ['scan', 10000], ['shuffle', 9000], ['rank', 12000]];
  const steps = base.map(([id, ms]) => ({ id, ms: Math.max(floor, Math.round(ms * m)) }));
  steps.push({ id: 'countdown', ms: m < 0.5 ? 3300 : 4400 });
  const count = Math.max(1, Math.floor(Number(winners) || 1));
  for (let i = 0; i < count; i += 1) {
    const b = i < 3 ? 7000 : i < 6 ? 4500 : 2800;
    steps.push({ id: 'reveal', index: i, ms: Math.max(m < 0.2 ? 1400 : 2600, Math.round(b * m)) });
  }
  return { steps, total: steps.reduce((n, s) => n + s.ms, 0), multiplier: m };
}

// ───────────── tiny helpers ─────────────
const $ = (s, r) => (r || document).querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (a, b) => a + Math.random() * (b - a);
const pad = (n) => String(n).padStart(2, '0');
const fmt = (n) => Number(n || 0).toLocaleString();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const HEX = '0123456789abcdef';
const randHex = (n) => Array.from({ length: n }, () => HEX[(Math.random() * 16) | 0]).join('');
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
const fillerName = () => { const p = () => ALPHA[(Math.random() * ALPHA.length) | 0]; return p() + p() + '****' + p() + p(); };
const enc = new TextEncoder();
async function sha(text) {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

let cssLoaded = false;
function ensureCss() {
  if (cssLoaded || document.getElementById('dsCss')) { cssLoaded = true; return; }
  const l = document.createElement('link');
  l.id = 'dsCss'; l.rel = 'stylesheet'; l.href = new URL('./stage.css', import.meta.url).href;
  document.head.appendChild(l); cssLoaded = true;
}

// ───────────── sound (synthesised, optional) ─────────────
function makeSound() {
  let ctx = null; let on = false;
  const ensure = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  const tone = (f, d, { type = 'sine', v = 0.07, at = 0, to } = {}) => {
    if (!on || !ensure()) return;
    const t = ctx.currentTime + at; const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d + 0.03);
  };
  const noise = (d, { v = 0.05, from = 400, to = 4000 } = {}) => {
    if (!on || !ensure()) return;
    const len = Math.floor(ctx.sampleRate * d); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
    const t = ctx.currentTime; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + d);
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(f).connect(g).connect(ctx.destination); src.start();
  };
  return {
    get on() { return on; },
    set(v) { on = Boolean(v); if (on) ensure(); },
    tick() { tone(1500, 0.04, { type: 'square', v: 0.025 }); },
    count() { tone(660, 0.22, { type: 'triangle', v: 0.09 }); },
    whoosh() { noise(1.1, { v: 0.06, from: 300, to: 5200 }); },
    thud() { tone(90, 0.5, { type: 'sine', v: 0.2, to: 38 }); },
    lock() { tone(220, 0.12, { type: 'square', v: 0.05 }); tone(440, 0.18, { type: 'square', v: 0.05, at: 0.1 }); },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.5, { type: 'triangle', v: 0.08, at: i * 0.09 })); noise(0.9, { v: 0.05, from: 2000, to: 9000 }); },
    fanfare() { [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.7, { type: 'sawtooth', v: 0.045, at: i * 0.11 })); tone(130.8, 1.4, { type: 'sine', v: 0.14 }); noise(1.6, { v: 0.05, from: 1500, to: 8000 }); }
  };
}

// ───────────── the ticket pool (canvas) ─────────────
class Pool {
  constructor(cv, count) {
    this.cv = cv; this.g = cv.getContext('2d'); this.count = count; this.mode = 'float'; this.t = 0;
    this.scanX = -1; this.vortex = 1; this.sparks = []; this.alpha = 1; this.lit = 0; this.running = false; this.still = reduced();
    this.resize(); this.build();
    this.onResize = () => { this.resize(); this.layout(); };
    addEventListener('resize', this.onResize);
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.cv.clientWidth || innerWidth; this.h = this.cv.clientHeight || innerHeight; this.dpr = dpr;
    this.cv.width = Math.round(this.w * dpr); this.cv.height = Math.round(this.h * dpr);
  }
  build() {
    this.chips = Array.from({ length: this.count }, () => ({
      x: rand(0, this.w), y: rand(0, this.h), vx: 0, vy: 0, gx: 0, gy: 0, ang: rand(0, 6.283), rad: 0, spd: rand(0.7, 1.3),
      rot: rand(0, 6.283), s: rand(0.7, 1.25), glow: 0, lit: false, drift: rand(0, 6.283), warm: Math.random() < 0.12,
      x0: rand(0, this.w), y0: rand(0, this.h)
    }));
    this.layout();
  }
  layout() {
    const n = this.chips.length; const aw = this.w * (this.w < 700 ? 0.86 : 0.7); const ah = this.h * (this.w < 700 ? 0.3 : 0.34);
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * (aw / ah)))); const rows = Math.ceil(n / cols);
    const cell = Math.min(aw / cols, ah / rows); this.cell = cell;
    const cx = this.w / 2; const cy = this.h * 0.6; const maxR = Math.min(this.w, this.h) * 0.42;
    this.chips.forEach((c, i) => {
      c.gx = cx - ((cols - 1) / 2) * cell + (i % cols) * cell; c.gy = cy - ((rows - 1) / 2) * cell + ((i / cols) | 0) * cell;
      c.rad = 36 + Math.pow(Math.random(), 0.7) * maxR;
    });
  }
  setMode(mode, opts = {}) {
    this.mode = mode; if (opts.vortex) this.vortex = opts.vortex;
    if (mode === 'grid') { this.scanX = -0.05; this.chips.forEach((c) => { c.lit = false; c.glow = 0; }); this.lit = 0; }
    if (this.still) this.snap();
  }
  target(c) {
    const cx = this.w / 2; const cy = this.h * 0.6;
    if (this.mode === 'grid') return [c.gx, c.gy];
    if (this.mode === 'vortex') { const a = c.ang + (this.t * this.vortex * 260) / (c.rad + 70) * c.spd; return [cx + Math.cos(a) * c.rad * 1.25, cy + Math.sin(a) * c.rad * 0.5]; }
    if (this.mode === 'collapse') return [cx, cy];
    return [c.x0 + Math.sin(this.t * 0.4 + c.drift) * 26, c.y0 + Math.cos(this.t * 0.33 + c.drift) * 20];
  }
  snap() { this.chips.forEach((c) => { const [x, y] = this.target(c); c.x = x; c.y = y; }); this.draw(); }
  burst(x, y, n = 90, power = 1) {
    const cols = ['#f6c453', '#ffe7a6', '#4cc9ff', '#9a8cff', '#5cf0b4', '#ff7a9c', '#ffffff'];
    for (let i = 0; i < n; i += 1) {
      const a = rand(0, 6.283); const sp = rand(3, 15) * power;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(2, 7), r: rand(3, 7), a: rand(0, 6.283), va: rand(-0.3, 0.3), col: cols[(Math.random() * cols.length) | 0], life: 1, shape: Math.random() < 0.3 ? 1 : 0 });
    }
    if (this.still) this.sparks.length = 0;
  }
  start() { if (this.running || this.still) return; this.running = true; this.last = performance.now(); const loop = (ts) => { if (!this.running) return; this.step(Math.min(0.033, (ts - this.last) / 1000)); this.last = ts; this.draw(); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  stop() { this.running = false; removeEventListener('resize', this.onResize); }
  step(dt) {
    this.t += dt;
    if (this.cv.clientWidth && (this.cv.clientWidth !== this.w || this.cv.clientHeight !== this.h)) { this.resize(); this.chips.forEach((c) => { c.x0 = rand(0, this.w); c.y0 = rand(0, this.h); if (!this.sized) { c.x = c.x0; c.y = c.y0; } }); this.sized = true; this.layout(); }
    const k = { float: 0.9, grid: 5, vortex: 7, collapse: 11 }[this.mode] || 1;
    const damp = 2 * Math.sqrt(k) * 0.9;
    if (this.mode === 'grid' && this.scanX >= 0) this.scanX = Math.min(1.05, this.scanX);
    for (const c of this.chips) {
      const [tx, ty] = this.target(c);
      c.vx += ((tx - c.x) * k - c.vx * damp) * dt; c.vy += ((ty - c.y) * k - c.vy * damp) * dt;
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += dt * 0.4;
      if (this.mode === 'grid' && !c.lit && c.gx / this.w <= this.scanX) { c.lit = true; c.glow = 1; this.lit += 1; }
      c.glow *= 0.965;
    }
    for (const s of this.sparks) { s.vy += 0.38; s.x += s.vx; s.y += s.vy; s.vx *= 0.985; s.a += s.va; s.life -= 0.0075; }
    this.sparks = this.sparks.filter((s) => s.life > 0 && s.y < this.h + 40);
  }
  draw() {
    const g = this.g; const d = this.dpr; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, this.w, this.h);
    const base = this.mode === 'float' ? 0.28 : 0.62;
    for (const c of this.chips) {
      const a = Math.max(0, Math.min(1, this.alpha)); if (a <= 0.01) continue;
      const lit = this.mode === 'grid' ? c.lit : false; const gl = c.glow;
      const w = (this.mode === 'grid' ? Math.max(5, this.cell * 0.62) : 10) * c.s; const hh = w * 0.58;
      g.save(); g.translate(c.x, c.y);
      if (this.mode === 'vortex') g.rotate(Math.atan2(c.vy, c.vx)); else if (this.mode === 'float') g.rotate(c.rot);
      if (gl > 0.05) { g.fillStyle = 'rgba(246,196,83,' + (gl * 0.2 * a) + ')'; g.beginPath(); g.arc(0, 0, w * 0.95, 0, 6.283); g.fill(); }
      const warm = c.warm || gl > 0.2; const lr = lit && gl <= 0.2;
      g.fillStyle = warm ? 'rgba(255,214,120,' + Math.min(1, (base + gl) * a) + ')' : lr ? 'rgba(180,237,255,' + 0.75 * a + ')' : 'rgba(96,184,230,' + base * a + ')';
      g.beginPath(); (g.roundRect ? g.roundRect(-w / 2, -hh / 2, w, hh, Math.min(3, hh / 3)) : g.rect(-w / 2, -hh / 2, w, hh)); g.fill();
      g.restore();
    }
    if (this.mode === 'grid' && this.scanX >= 0 && this.scanX <= 1.04) {
      const x = this.scanX * this.w; const gr = g.createLinearGradient(x - 60, 0, x + 4, 0);
      gr.addColorStop(0, 'rgba(76,201,255,0)'); gr.addColorStop(1, 'rgba(120,225,255,.55)');
      g.fillStyle = gr; g.fillRect(x - 60, this.h * 0.4, 64, this.h * 0.4);
      g.fillStyle = 'rgba(210,245,255,.95)'; g.fillRect(x, this.h * 0.4, 2, this.h * 0.4);
    }
    for (const s of this.sparks) {
      g.save(); g.translate(s.x, s.y); g.rotate(s.a); g.globalAlpha = Math.max(0, Math.min(1, s.life * 1.4)); g.fillStyle = s.col;
      if (s.shape) { g.beginPath(); g.arc(0, 0, s.r * 0.6, 0, 6.283); g.fill(); } else g.fillRect(-s.r, -s.r / 2, s.r * 2, s.r);
      g.restore();
    }
  }
}

// ───────────── the stage ─────────────
export function openDrawStage(opts = {}) {
  ensureCss();
  const o = {
    mode: 'live', title: 'Giveaway draw', prize: '', speed: 'standard', seedCommit: '', entries: 0, winnersTotal: 1, sound: false,
    maskNote: 'Names are masked to protect winners.', finalNote: '', verifyUrl: '', clean: false, ...opts
  };
  const rm = reduced();
  const sound = makeSound(); sound.set(o.sound);
  const S = { alive: true, paused: false, skipping: false, result: null, resultP: null, anims: new Set(), t0: performance.now(), logRows: 0, plan: null, stepStart: 0, prevFocus: document.activeElement };
  const tag = o.mode === 'live' ? 'Live draw' : o.mode === 'replay' ? 'Replay' : o.mode === 'recorded' ? 'Giveaway draw' : 'Rehearsal';

  const root = h('div', 'ds' + (rm ? ' ds-calm' : '') + (o.clean ? ' ds-clean' : '') + (o.mode === 'rehearsal' ? ' ds-rehearsal' : '') + (o.mode === 'recorded' ? ' ds-recorded' : ''));
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Giveaway draw: ' + o.title); root.tabIndex = -1;
  root.innerHTML =
    '<canvas class="ds-cv" aria-hidden="true"></canvas><div class="ds-beams" aria-hidden="true"><i></i><i></i></div><div class="ds-grain" aria-hidden="true"></div><div class="ds-vig" aria-hidden="true"></div><div class="ds-flash" aria-hidden="true"></div>' +
    '<header class="ds-top"><div class="ds-brand"><img class="ds-logo" src="/assets/images/logo.png" alt="FCMobiletools" width="1774" height="887" decoding="async" /></div>' +
    '<div class="ds-title"><strong>' + esc(o.title) + '</strong>' + (o.prize ? '<span>' + esc(o.prize) + '</span>' : '') + '</div>' +
    '<div class="ds-tag ds-tag-' + o.mode + '"><i></i>' + tag + '</div></header>' +
    (o.mode === 'rehearsal' ? '<div class="ds-banner">Rehearsal. Sample names, not a real draw.</div>' : '') +
    '<main class="ds-scene" aria-live="off"></main><aside class="ds-log" aria-hidden="true"></aside>' +
    '<footer class="ds-lower"><div class="ds-lt"><b class="ds-phase"></b><span class="ds-sub"></span></div><div class="ds-meta"><span class="ds-step"></span><span class="ds-clock">00:00</span></div></footer>' +
    '<div class="ds-prog" aria-hidden="true"><i></i></div><div class="ds-sr" role="status" aria-live="polite"></div>' +
    '<div class="ds-ctrl" role="toolbar" aria-label="Stage controls">' +
      '<button type="button" data-a="pause" title="Pause or resume (Space)" aria-label="Pause"><svg viewBox="0 0 24 24"><path class="p1" d="M8 5v14M16 5v14"/></svg></button>' +
      '<button type="button" data-a="sound" title="Sound (S)" aria-label="Sound" aria-pressed="' + sound.on + '"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="sw" d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></svg></button>' +
      '<button type="button" data-a="skip" title="Skip to results (N)" aria-label="Skip to results"><svg viewBox="0 0 24 24"><path d="M5 5l9 7-9 7zM18 5v14"/></svg></button>' +
      '<button type="button" data-a="clean" title="Hide controls for recording (H)" aria-label="Hide controls"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 19h8"/></svg></button>' +
      '<button type="button" data-a="full" title="Full screen (F)" aria-label="Full screen"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>' +
      '<button type="button" data-a="close" title="Close (Esc)" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  document.body.appendChild(root);
  const prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
  const scene = $('.ds-scene', root); const logEl = $('.ds-log', root); const sr = $('.ds-sr', root);
  const pool = new Pool($('.ds-cv', root), Math.max(24, Math.min(o.entries > 0 ? o.entries : 400, innerWidth < 700 ? 220 : 520)));
  pool.start();
  if (pool.still) setTimeout(() => { pool.resize(); pool.layout(); pool.snap(); }, 250);
  requestAnimationFrame(() => root.classList.add('on')); root.focus({ preventScroll: true });

  // ── primitives ──
  const say = (t) => { sr.textContent = t; };
  const lower = (title, sub, step) => {
    const lt = $('.ds-lt', root); lt.classList.remove('swap'); void lt.offsetWidth; lt.classList.add('swap');
    $('.ds-phase', root).textContent = title; $('.ds-sub', root).textContent = sub || ''; if (step) $('.ds-step', root).textContent = step; say(title + '. ' + (sub || ''));
  };
  const log = (text, tone) => {
    const d = new Date(); const row = h('div', 'ds-lg' + (tone ? ' ' + tone : ''), '<time>' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '</time><span>' + esc(text) + '</span>');
    logEl.appendChild(row); while (logEl.children.length > 5) logEl.firstChild.remove();
  };
  const show = (node, cls) => {
    const old = scene.firstElementChild; if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 380); }
    node.classList.add('ds-sc', 'in'); if (cls) node.classList.add(cls); scene.appendChild(node); return node;
  };
  const check = () => { if (!S.alive) throw SKIP; if (S.skipping) throw SKIP; };
  // Sleeps for ms of *running* time (pausing freezes it). Throws SKIP when the person skips.
  const sleep = (ms, onTick) => new Promise((resolve, reject) => {
    let t = 0; let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(); const dt = now - last; last = now;
      if (!S.alive || S.skipping) { clearInterval(id); reject(SKIP); return; }
      if (S.paused) return;
      t += dt; onTick?.(Math.min(1, t / ms));
      if (t >= ms) { clearInterval(id); resolve(); }
    }, 40);
  });
  const anim = (el, frames, optsA) => { const a = el.animate(frames, optsA); S.anims.add(a); a.finished.finally(() => S.anims.delete(a)).catch(() => {}); if (S.paused) a.pause(); return a; };
  const decode = (el, text, ms) => new Promise((resolve) => {
    const n = text.length; let t = 0; let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(); if (!S.alive) { clearInterval(id); resolve(); return; } if (S.paused) { last = now; return; }
      t += now - last; last = now; const k = Math.min(1, t / ms); const lock = Math.floor(k * n);
      el.textContent = text.slice(0, lock) + randHex(n - lock).replace(/./g, (c, i) => (text[lock + i] === ' ' ? ' ' : c));
      if (k >= 1) { clearInterval(id); el.textContent = text; resolve(); }
    }, 45);
  });
  const countTo = (el, to, ms) => new Promise((resolve) => {
    let t = 0; let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now(); if (!S.alive) { clearInterval(id); resolve(); return; } if (S.paused) { last = now; return; }
      t += now - last; last = now; const k = Math.min(1, t / ms); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) { clearInterval(id); resolve(); }
    }, 40);
  });
  const flash = () => { const f = $('.ds-flash', root); if (rm) return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };

  // ── result ──
  const getResult = () => {
    if (!S.resultP) {
      S.resultP = Promise.resolve().then(() => o.prepare ? o.prepare() : ({ entries: o.entries, entriesHash: '', winners: [], alternates: [] })).then((r) => {
        const res = { entries: Number(r.entries) || o.entries || 0, entriesHash: r.entriesHash || '', winners: r.winners || [], alternates: r.alternates || [] };
        S.result = res; return res;
      });
      S.resultP.catch(() => {});
    }
    return S.resultP;
  };
  const planSize = () => Math.max(1, S.result?.winners.length || o.winnersTotal || 1);

  // ── scenes ──
  const phases = {
    async prepare(step) {
      lower('Preparing the draw', o.mode === 'recorded' ? 'Getting every participant name ready for the wheel.' : 'Getting the stage ready. Nothing is picked yet.', 'Step 1 of 8');
      const items = o.mode === 'recorded' ? ['Loading participant names', 'Preparing the wheel', 'Getting the winner reveal ready', 'Setting up the stage'] : ['Connecting to the draw engine', 'Loading the entry list', 'Reading the seed fingerprint', 'Setting up the stage'];
      const el = show(h('div', 'ds-prep', '<div class="ds-rings"><svg viewBox="0 0 200 200"><circle class="r1" cx="100" cy="100" r="86"/><circle class="r2" cx="100" cy="100" r="66"/><circle class="r3" cx="100" cy="100" r="46"/></svg><div class="ds-pct"><b>0</b><small>%</small></div></div>' +
        '<ul class="ds-checks">' + items.map((t) => '<li><i></i><span>' + t + '</span></li>').join('') + '</ul>'));
      const lis = [...el.querySelectorAll('li')]; const pct = $('.ds-pct b', el); let shown = 0;
      log('Draw stage opened');
      await sleep(step.ms, (k) => {
        pct.textContent = Math.round(k * 100); $('.ds-prog i', root).style.width = ((S.stepStart + step.ms * k) / S.plan.total * 100) + '%';
        const due = Math.min(items.length, Math.floor(k * (items.length + 0.4)));
        while (shown < due) { lis[shown].classList.add('ok'); if (shown) log(items[shown - 1] + ' done'); sound.tick(); shown += 1; }
      });
      lis.forEach((l) => l.classList.add('ok')); log('Stage ready', 'ok'); sound.whoosh();
    },

    async seed(step) {
      if (o.mode === 'recorded') {
        lower('The wheel is ready', 'Every participant is in. Here we go.', 'Step 2 of 8');
        const el = show(h('div', 'ds-seed', '<div class="ds-lock"><svg viewBox="0 0 64 64"><path class="sh" d="M20 28v-8a12 12 0 0124 0v8"/><rect x="12" y="28" width="40" height="28" rx="7"/><circle cx="32" cy="42" r="4"/></svg></div><div class="ds-cap">The participant wheel</div><div class="ds-hash">BALLON D’OR · STAR PASS</div><div class="ds-pill ds-pill-wait">Ready</div>'));
        await sleep(step.ms * 0.6);
        el.classList.add('locked'); const pill = $('.ds-pill', el); pill.textContent = 'Ready'; pill.className = 'ds-pill ds-pill-ok';
        sound.lock(); flash(); log('The wheel is ready', 'ok');
        await sleep(step.ms * 0.4); return;
      }
      lower('Seed fingerprint locked', 'Published before entries opened, so nobody can change it now.', 'Step 2 of 8');
      const commit = String(o.seedCommit || '');
      const el = show(h('div', 'ds-seed', '<div class="ds-lock"><svg viewBox="0 0 64 64"><path class="sh" d="M20 28v-8a12 12 0 0124 0v8"/><rect x="12" y="28" width="40" height="28" rx="7"/><circle cx="32" cy="42" r="4"/></svg></div>' +
        '<div class="ds-cap">' + (commit ? 'Seed fingerprint (SHA-256)' : 'The seed was sealed by the server before entries opened') + '</div>' +
        (commit ? '<div class="ds-hash"><span data-h1></span><br><span data-h2></span></div>' : '<div class="ds-hash"></div>') + '<div class="ds-pill ds-pill-wait">Checking</div>'));
      log('Reading seed fingerprint');
      const jobs = [sleep(step.ms * 0.6)];
      if (commit) { const half = Math.ceil(commit.length / 2); jobs.push(decode($('[data-h1]', el), commit.slice(0, half), step.ms * 0.55), decode($('[data-h2]', el), commit.slice(half), step.ms * 0.55)); }
      await Promise.all(jobs);
      el.classList.add('locked'); const pill = $('.ds-pill', el); pill.textContent = 'Locked'; pill.className = 'ds-pill ds-pill-ok';
      sound.lock(); flash(); log('Seed fingerprint locked', 'ok');
      await sleep(step.ms * 0.4);
    },

    async freeze(step) {
      lower(o.mode === 'recorded' ? 'Loading the participant list' : 'Freezing the entry list', o.mode === 'live' ? 'The list is frozen and fingerprinted. Late changes cannot count.' : o.mode === 'recorded' ? 'Getting every supplied name onto the wheel.' : 'The list was frozen and fingerprinted at the draw.', 'Step 3 of 8');
      const cap = o.mode === 'recorded' ? 'Loading participant names' : 'Freezing the entry list';
      const el = show(h('div', 'ds-freeze', '<div class="ds-wait"><i></i><i></i><i></i></div><div class="ds-big"><b data-n>0</b></div><div class="ds-cap" data-cap>' + cap + '</div><div class="ds-hash ds-hash-s" data-fp></div>'));
      log(o.mode === 'live' ? 'Freezing entries and running the draw' : o.mode === 'recorded' ? 'Getting participant names ready' : 'Loading the frozen entry list');
      const t0 = performance.now(); const p = getResult();
      await Promise.all([sleep(step.ms * 0.4), p.then(() => {}, () => {})]);
      let res; try { res = await p; } catch (e) { throw e; }
      el.classList.add('done'); const n = $('[data-n]', el);
      $('[data-cap]', el).textContent = o.mode === 'recorded' ? 'participant names loaded' : res.entries === 1 ? 'entry in the draw' : 'entries in the draw'; sound.thud();
      log(fmt(res.entries) + (o.mode === 'recorded' ? ' participant names loaded' : ' entries frozen'), 'ok');
      const rest = Math.max(2400, step.ms - (performance.now() - t0));
      await Promise.all([countTo(n, res.entries, Math.min(rest * 0.8, 4200)), res.entriesHash ? decode($('[data-fp]', el), res.entriesHash, rest * 0.8) : Promise.resolve()]);
      if (res.entriesHash) log('Entry list fingerprint sealed', 'ok');
      await sleep(Math.max(400, rest * 0.2));
    },

    async scan(step) {
      lower(o.mode === 'recorded' ? 'Counting every name' : 'Checking every entry', o.mode === 'recorded' ? 'Every name gets a place on the participant wheel.' : 'Each eligible person has one equal-weight entry.', 'Step 4 of 8');
      const total = S.result?.entries || o.entries || 0;
      const caption = o.mode === 'recorded' ? 'Names on the wheel' : 'Entries checked';
      const el = show(h('div', 'ds-readout', '<div class="ds-cap">' + caption + '</div><div class="ds-big ds-big-s"><b data-n>0</b><small>of ' + fmt(total) + '</small></div>'));
      pool.alpha = 1; pool.setMode('grid'); log(o.mode === 'recorded' ? 'Loading the participant reel' : 'Scanning the eligible entry pool');
      const n = $('[data-n]', el); let ticks = 0;
      await sleep(step.ms, (k) => {
        pool.scanX = k * 1.04; n.textContent = fmt(Math.round(total * Math.min(1, k * 1.04)));
        if (!rm && Math.floor(k * 18) > ticks) { ticks += 1; sound.tick(); }
        $('.ds-prog i', root).style.width = ((S.stepStart + step.ms * k) / S.plan.total * 100) + '%';
      });
      n.textContent = fmt(total); log('Every entry checked', 'ok'); sound.lock();
    },

    async shuffle(step) {
      lower(o.mode === 'recorded' ? 'The wheel is spinning' : 'Shuffling the pool', o.mode === 'recorded' ? 'All the names are in motion. One will take home the Star Pass.' : 'The sealed seed places every equal-weight entry in a fixed order.', 'Step 5 of 8');
      const lines = o.mode === 'recorded' ? ['Names are on the wheel', 'The wheel is spinning', 'The winner is coming up'] : ['Mixing the entry pool', 'Keeping every entry equal', 'Sealing the order'];
      const el = show(h('div', 'ds-readout', '<div class="ds-cap" data-l>' + lines[0] + '</div><div class="ds-dots"><i></i><i></i><i></i></div>'));
      pool.setMode('vortex', { vortex: 0.5 }); log(o.mode === 'recorded' ? 'Spinning the participant-name reel' : 'Shuffling the pool'); sound.whoosh();
      await sleep(step.ms, (k) => {
        pool.vortex = 0.5 + k * 2.6; $('[data-l]', el).textContent = lines[Math.min(2, Math.floor(k * 3))];
        $('.ds-prog i', root).style.width = ((S.stepStart + step.ms * k) / S.plan.total * 100) + '%';
      });
      log('Order sealed', 'ok');
    },

    async rank(step) {
      if (o.mode === 'recorded') {
        lower('The final spin', 'The wheel is slowing down. One name will win the Star Pass.', 'Step 6 of 8');
        const total = S.result?.entries || o.entries || 0;
        const el = show(h('div', 'ds-rank', '<div class="ds-stream" data-s></div><div class="ds-bar"><i></i></div><div class="ds-cap ds-cap-r"><span data-p>0%</span> names loaded</div><div class="ds-fine">Ballon d’Or Star Pass Giveaway</div>'));
        pool.setMode('vortex', { vortex: 3.4 }); log('Preparing the recorded result');
        const stream = $('[data-s]', el); const bar = $('.ds-bar i', el); const pct = $('[data-p]', el);
        const participants = Array.isArray(o.participantNames) ? o.participantNames : [];
        let shown = -1;
        await sleep(step.ms * 0.82, (k) => {
          bar.style.width = (k * 100) + '%'; pct.textContent = Math.round(k * 100) + '%';
          $('.ds-prog i', root).style.width = ((S.stepStart + step.ms * 0.82 * k) / S.plan.total * 100) + '%';
          const idx = participants.length ? Math.min(participants.length - 1, Math.floor(k * participants.length)) : -1;
          if (idx >= 0 && idx !== shown) {
            shown = idx;
            const r = h('div', 'ds-row', '<i>' + String(idx + 1).padStart(4, '0') + '</i><span>' + esc(participants[idx]) + '</span><em>ON THE WHEEL</em>');
            stream.appendChild(r); while (stream.children.length > 5) stream.firstElementChild.remove();
          }
        });
        bar.style.width = '100%'; pct.textContent = '100%'; sound.lock();
        log(fmt(total) + ' participant names loaded', 'ok');
        await sleep(step.ms * 0.18); return;
      }
      lower('Ranking the entries', 'Every entry gets a score. The lowest score ranks first.', 'Step 6 of 8');
      const total = S.result?.entries || o.entries || 0;
      const el = show(h('div', 'ds-rank', '<div class="ds-stream" data-s></div><div class="ds-bar"><i></i></div><div class="ds-cap ds-cap-r"><span data-p>0%</span> ranked</div><div class="ds-fine">Live SHA-256 sample of the ranking work</div><ul class="ds-vchecks" data-v></ul>'));
      pool.setMode('vortex', { vortex: 3.4 }); log('Computing the ranking');
      const stream = $('[data-s]', el); const bar = $('.ds-bar i', el); const pct = $('[data-p]', el);
      const seed = (o.seedCommit || o.title) + '|' + (S.result?.entriesHash || 'entries');
      let i = 0; let busy = false; const rows = [];
      const ver = o.verify ? Promise.resolve().then(() => o.verify()).catch((e) => ({ checks: [{ ok: false, text: 'Could not run the check: ' + (e?.message || 'unknown error') }] })) : null;
      await sleep(step.ms * 0.82, (k) => {
        bar.style.width = (k * 100) + '%'; pct.textContent = Math.round(k * 100) + '%';
        $('.ds-prog i', root).style.width = ((S.stepStart + step.ms * 0.82 * k) / S.plan.total * 100) + '%';
        if (!busy) { busy = true; i += 1; const idx = i; sha(seed + '|' + idx).then((hx) => { if (!S.alive) return; const r = h('div', 'ds-row', '<i>' + String(Math.min(total || idx, idx)).padStart(4, '0') + '</i><span>' + hx.slice(0, 20) + '</span><em>' + hx.slice(-6) + '</em>'); stream.appendChild(r); rows.push(r); while (rows.length > 5) rows.shift().remove(); busy = false; }); }
      });
      bar.style.width = '100%'; pct.textContent = '100%'; sound.lock();
      if (ver) {
        const v = await Promise.race([ver, new Promise((r) => setTimeout(() => r(null), 8000))]);
        const list = $('[data-v]', el); el.classList.add('verifying');
        for (const c of (v?.checks || [])) { list.appendChild(h('li', c.ok ? 'ok' : 'bad', '<i></i><span>' + esc(c.text) + '</span>')); log(c.text, c.ok ? 'ok' : 'bad'); sound.tick(); await sleep(520); }
      }
      log('Ranking sealed', 'ok');
      await sleep(step.ms * 0.18);
    },

    async countdown(step) {
      lower('Winners in a moment', 'The ranking is sealed. Here we go.', 'Step 7 of 8');
      pool.setMode('collapse'); const nums = [3, 2, 1];
      const el = show(h('div', 'ds-count', '<div class="ds-cring"></div><b></b>'));
      const b = $('b', el); const per = (step.ms - 400) / nums.length;
      for (const num of nums) {
        b.textContent = num; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); sound.count();
        const ring = $('.ds-cring', el); ring.classList.remove('pulse'); void ring.offsetWidth; ring.classList.add('pulse');
        await sleep(per);
      }
      flash(); sound.thud(); pool.alpha = 0; log('Revealing winners', 'ok');
      await sleep(400);
    },

    async reveal(step) {
      const total = planSize(); const i = step.index; const w = S.result?.winners[i];
      if (!w) return;
      const label = total === 1 ? 'Winner' : 'Winner ' + (i + 1) + ' of ' + total;
      lower(label, o.mode === 'recorded' ? 'The wheel has landed.' : 'Names are masked to protect winners.', 'Step 8 of 8');
      pool.alpha = 0; pool.setMode('float');
      const names = o.mode === 'recorded' && Array.isArray(o.participantNames) && o.participantNames.length ? o.participantNames.slice() : Array.from({ length: 26 }, fillerName);
      names.push(w.name);
      const el = show(h('div', 'ds-reveal',
        '<div class="ds-chip">' + esc(label) + '</div>' +
        '<div class="ds-ticket"><div class="ds-stub"><small>Slot</small><b>#' + esc(w.slot || i + 1) + '</b></div><div class="ds-main"><div class="ds-reel"><div class="ds-reel-in">' + names.map((n) => '<span>' + esc(n) + '</span>').join('') + '</div></div>' +
        '<div class="ds-prize">' + esc(w.prize || o.prize || 'In-game reward') + '</div></div></div>'));
      const inner = $('.ds-reel-in', el); const ticket = $('.ds-ticket', el);
      const rh = inner.firstElementChild.getBoundingClientRect().height || 84;
      const recordedSpinMs = o.mode === 'recorded' ? Math.min(14000, Math.max(7000, 2500 + names.length * 45)) : 0;
      const spin = rm ? 300 : Math.max(1500, step.ms * 0.5, recordedSpinMs);
      log('Drawing ' + label.toLowerCase()); sound.whoosh();
      let ticks = 0; const tickTimer = setInterval(() => { if (!S.paused && ticks < 22) { sound.tick(); ticks += 1; } }, spin / 24);
      const a = anim(inner, [{ transform: 'translateY(0)' }, { transform: 'translateY(' + (-(names.length - 1) * rh) + 'px)' }], { duration: spin, easing: 'cubic-bezier(.14,.82,.12,1)', fill: 'forwards' });
      try { await a.finished; } catch { /* cancelled */ } finally { clearInterval(tickTimer); }
      check();
      ticket.classList.add('landed'); flash(); sound.win(); pool.alpha = 1;
      const r = ticket.getBoundingClientRect(); pool.burst(r.left + r.width / 2, r.top + r.height / 2, i === total - 1 ? 150 : 100, 1);
      log(label + ': ' + w.name, 'ok'); say(label + ': ' + w.name + ' wins ' + (w.prize || o.prize || 'the reward'));
      lower(label, w.name + (w.prize ? ' wins ' + w.prize : ''), 'Step 8 of 8');
      await sleep(Math.max(1200, step.ms - spin));
    }
  };

  // ── finale ──
  async function finale() {
    let res; try { res = await getResult(); } catch (e) { return fail(e); }
    pool.alpha = 1; pool.setMode('float');
    lower('Draw complete', fmt(res.entries) + (res.entries === 1 ? ' participant' : ' participants') + ' · ' + res.winners.length + (res.winners.length === 1 ? ' winner' : ' winners'), 'Finished');
    $('.ds-prog i', root).style.width = '100%';
    const alts = res.alternates || [];
    const el = show(h('div', 'ds-final',
      '<div class="ds-fh"><h2>' + (res.winners.length === 1 ? 'And the winner is' : 'The winners') + '</h2><p>' + esc(o.maskNote) + '</p></div>' +
      '<ol class="ds-board">' + res.winners.map((w, i) => '<li style="--i:' + i + '"><span class="ds-slot">#' + esc(w.slot || i + 1) + '</span><strong>' + esc(w.name) + '</strong><em>' + esc(w.prize || o.prize || '') + '</em></li>').join('') + '</ol>' +
      (alts.length ? '<p class="ds-alts">' + alts.length + ' alternate' + (alts.length === 1 ? '' : 's') + ' ready in order, in case a winner cannot claim.</p>' : '') +
      (o.finalNote ? '<p class="ds-note">' + esc(o.finalNote) + '</p>' : '') +
      '<div class="ds-actions"><button type="button" class="ds-btn" data-a="replay">Replay the show</button>' + (o.verifyUrl ? '<a class="ds-btn" href="' + esc(o.verifyUrl) + '" target="_blank" rel="noopener">Verify this draw</a>' : '') + '<button type="button" class="ds-btn ds-gold" data-a="close">Done</button></div>'));
    log('Draw complete', 'ok'); sound.fanfare(); flash();
    const burst = (n) => pool.burst(innerWidth * rand(0.2, 0.8), innerHeight * rand(0.25, 0.5), n, 1.1);
    burst(160); setTimeout(() => S.alive && burst(110), 700); setTimeout(() => S.alive && burst(90), 1500);
    $('[data-a=replay]', el)?.focus();
  }

  function fail(e) {
    pool.alpha = 0.4; pool.setMode('float');
    const title = e?.title || 'The draw did not run';
    lower(title, e?.message || 'Something went wrong.', 'Stopped');
    show(h('div', 'ds-fail', '<div class="ds-x">!</div><h2>' + esc(title) + '</h2><p>' + esc(e?.message || 'Something went wrong. Nothing was changed.') + '</p><div class="ds-actions"><button type="button" class="ds-btn ds-gold" data-a="close">Close</button></div>'));
    log('Draw stopped: ' + (e?.message || 'error'), 'bad'); root.classList.add('ds-failed');
  }

  // ── run ──
  const clock = setInterval(() => { if (!S.paused && S.alive) { const s = Math.floor((performance.now() - S.t0 - S.pausedMs) / 1000); $('.ds-clock', root).textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60); } }, 500);
  S.pausedMs = 0; let pausedAt = 0;
  let doneResolve; const done = new Promise((r) => { doneResolve = r; });

  const stepsFor = (speed, winnerCount) => {
    const steps = planStage({ speed, winners: winnerCount }).steps;
    if (o.mode === 'recorded' && !rm) {
      const names = Array.isArray(o.participantNames) ? o.participantNames : [];
      const spinMs = Math.min(14000, Math.max(7000, 2500 + (names.length + 1) * 45));
      for (const step of steps) if (step.id === 'reveal') step.ms = Math.max(step.ms, spinMs + 1200);
    }
    return steps;
  };
  async function run() {
    S.skipping = false; S.t0 = performance.now(); S.pausedMs = 0;
    const speed = rm ? 'quick' : o.speed;
    const guess = o.winnersTotal || S.result?.winners.length || 1;
    const queue = stepsFor(speed, guess).slice();
    S.plan = { total: queue.reduce((n, x) => n + x.ms, 0) };
    let acc = 0; const bar = $('.ds-prog i', root);
    try {
      while (queue.length) {
        const step = queue.shift(); S.stepStart = acc;
        await phases[step.id](step); acc += step.ms; bar.style.width = (acc / S.plan.total * 100) + '%';
        if (step.id === 'freeze' && S.result) {
          // The real winner count is known now (milestones can add bonus winners), so re-plan the reveals.
          const rest = queue.filter((x) => x.id !== 'reveal');
          const reveals = stepsFor(speed, Math.max(1, S.result.winners.length)).filter((x) => x.id === 'reveal');
          queue.length = 0; queue.push(...rest, ...reveals);
          S.plan.total = acc + queue.reduce((n, x) => n + x.ms, 0);
        }
      }
    } catch (e) {
      if (e !== SKIP) { if (S.alive) fail(e); return; }
    }
    if (!S.alive) return;
    S.skipping = false;
    await finale();
  }

  // ── controls ──
  function pause(v) {
    S.paused = v === undefined ? !S.paused : v; root.classList.toggle('ds-paused', S.paused);
    if (S.paused) { pausedAt = performance.now(); S.anims.forEach((a) => a.pause()); } else { S.pausedMs += performance.now() - pausedAt; S.anims.forEach((a) => a.play()); }
    const b = $('[data-a=pause]', root); b.setAttribute('aria-label', S.paused ? 'Resume' : 'Pause'); b.classList.toggle('on', S.paused);
  }
  function close() {
    if (!S.alive) return; S.alive = false; clearInterval(clock); pool.stop(); S.anims.forEach((a) => a.cancel());
    root.classList.remove('on'); root.classList.add('bye'); document.documentElement.style.overflow = prevOverflow;
    document.removeEventListener('keydown', onKey, true); removeEventListener('mousemove', wake);
    setTimeout(() => root.remove(), 450); try { S.prevFocus?.focus?.({ preventScroll: true }); } catch { /* element gone */ }
    o.onClose?.(S.result); doneResolve(S.result);
  }
  function setClean(v) { root.classList.toggle('ds-clean', v === undefined ? !root.classList.contains('ds-clean') : v); }
  const act = (a) => {
    if (a === 'pause') pause();
    else if (a === 'sound') { sound.set(!sound.on); const b = $('[data-a=sound]', root); b.setAttribute('aria-pressed', String(sound.on)); b.classList.toggle('on', sound.on); if (sound.on) sound.tick(); }
    else if (a === 'skip') { if (S.paused) pause(false); S.skipping = true; S.anims.forEach((x) => { try { x.finish(); } catch { /* already done */ } }); }
    else if (a === 'clean') setClean();
    else if (a === 'full') { if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.().catch(() => {}); }
    else if (a === 'close') close();
    else if (a === 'replay') { pool.alpha = 1; log('Replaying the show'); scene.innerHTML = ''; logEl.innerHTML = ''; run(); }
  };
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });
  const onKey = (e) => {
    if (!S.alive) return; const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); if (document.fullscreenElement) document.exitFullscreen?.(); close(); }
    else if (k === ' ' && !(e.target.closest && e.target.closest('a,button'))) { e.preventDefault(); pause(); }
    else if (k === 's' || k === 'S') act('sound'); else if (k === 'h' || k === 'H') act('clean'); else if (k === 'f' || k === 'F') act('full'); else if (k === 'n' || k === 'N') act('skip');
  };
  document.addEventListener('keydown', onKey, true);
  let idle; const wake = () => { root.classList.add('awake'); clearTimeout(idle); idle = setTimeout(() => root.classList.remove('awake'), 2600); };
  addEventListener('mousemove', wake); root.addEventListener('touchstart', wake, { passive: true }); wake();

  log(tag + ' opened');
  run();
  return { close, pause, skip: () => act('skip'), done, get result() { return S.result; } };
}
