// Tournament interaction layer (v3). No dependencies, respects prefers-reduced-motion.
//
// Removed from v2: cursor spotlight, film grain, scroll progress bar, 3D card tilt,
// magnetic buttons. They ran constantly and fought the brand. Everything here either
// answers a user action or happens once.

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const tpRoot = () => document.querySelector('.tp');

export function initFx(root = document) {
  const reduce = prefersReduced();
  initReveal(root, reduce);
  initCounts(root, reduce);
  initCountdown(root);
  initFind(root);
  initSpy(root);
  initBracket(root, reduce);
  initShare(root);
  if (!reduce && root.querySelector?.('.champion')) confetti();
}

/* ---------- below-the-fold sections fade in once; anything already visible never flashes ---------- */
function initReveal(root, reduce) {
  const els = [...root.querySelectorAll('[data-reveal]:not(.in):not(.pre)')];
  if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => {
    if (e.getBoundingClientRect().top < innerHeight * 0.98) { e.classList.add('in'); return; }
    e.classList.add('pre');
    io.observe(e);
  });
}

/* ---------- count-up numbers, once ---------- */
function initCounts(root, reduce) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count) || 0;
    if (reduce || !to) { el.textContent = String(to); return; }
    const t0 = performance.now();
    const run = (t) => {
      const p = Math.min(1, (t - t0) / 900);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  });
}

/* ---------- "Starts in 2d 4h 10m": minute-level, never a ticking second hand ---------- */
function initCountdown(root) {
  const els = [...root.querySelectorAll('[data-countdown]')];
  if (!els.length) return;
  const tick = () => els.forEach((el) => {
    const ms = new Date(el.dataset.countdown).getTime() - Date.now();
    if (Number.isNaN(ms)) return;
    if (ms <= 0) { el.textContent = 'Starting now'; return; }
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    el.textContent = d ? `${d}d ${h}h ${m % 60}m` : h ? `${h}h ${m % 60}m` : `${m}m`;
  });
  tick();
  setInterval(tick, 30000);
}

/* ---------- toast ---------- */
function toast(msg) {
  const host = tpRoot() || document.body;
  let t = host.querySelector('.tp-toast');
  if (!t) { t = document.createElement('div'); t.className = 'tp-toast'; t.setAttribute('role', 'status'); host.appendChild(t); }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ---------- share: copies a link that deep-links to the player you searched ---------- */
function initShare(root) {
  root.querySelectorAll('[data-share]').forEach((btn) => {
    if (btn._bound) return; btn._bound = true;
    btn.addEventListener('click', async () => {
      const url = new URL(location.href);
      const q = document.querySelector('[data-find]')?.value.trim();
      if (q) url.searchParams.set('player', q); else url.searchParams.delete('player');
      url.hash = '';
      const data = { title: document.title, url: url.toString() };
      try {
        if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share(data); return; }
        await navigator.clipboard.writeText(data.url);
        toast(q ? `Link copied for ${q}` : 'Link copied');
      } catch (err) {
        if (err?.name !== 'AbortError') toast('Could not copy. Copy the address bar instead.');
      }
    });
  });
}

/* ---------- find a player: highlights ties, fixtures and table rows. Supports ?player= ---------- */
function initFind(root) {
  const input = root.querySelector('[data-find]');
  if (!input || input._bound) return; input._bound = true;
  const out = root.querySelector('.find small');
  const items = [...root.querySelectorAll('.tie,.fx,.standings tbody tr')];
  const run = () => {
    const q = input.value.trim().toLowerCase();
    let n = 0, first = null;
    items.forEach((el) => {
      const on = q.length > 0 && el.textContent.toLowerCase().includes(q);
      el.classList.toggle('hit', on);
      if (on) { n++; first ||= el; }
    });
    tpRoot()?.classList.toggle('finding', q.length > 0 && n > 0);
    if (out) out.textContent = q ? (n ? String(n) : '0') : '';
    return first;
  };
  const jump = () => {
    const f = run();
    const d = f?.closest('details'); if (d) d.open = true;
    f?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'center', inline: 'center' });
  };
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jump();
    if (e.key === 'Escape') { input.value = ''; run(); input.blur(); }
  });
  const preset = new URLSearchParams(location.search).get('player');
  if (preset) { input.value = preset; setTimeout(jump, 450); }
}

/* ---------- highlight the stage you are reading in the sticky nav ---------- */
function initSpy(root) {
  const links = [...root.querySelectorAll('.stage-nav a[href^="#"]')];
  if (!links.length || !('IntersectionObserver' in window)) return;
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => { a.classList.remove('on'); a.removeAttribute('aria-current'); });
    const a = map.get(e.target.id);
    if (a) { a.classList.add('on'); a.setAttribute('aria-current', 'true'); a.scrollIntoView?.({ block: 'nearest', inline: 'center' }); }
  }), { rootMargin: '-30% 0px -60% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* ---------- bracket: open on the live round, round-by-round arrows, mouse drag ---------- */
function initBracket(root, reduce) {
  root.querySelectorAll('.bracket-wrap').forEach((w) => {
    if (w._bound) return; w._bound = true;
    const stage = w.closest('.stage');
    const prev = stage?.querySelector('[data-bracket-nav="prev"]');
    const next = stage?.querySelector('[data-bracket-nav="next"]');
    const step = () => (w.querySelector('.round')?.getBoundingClientRect().width || 260) + 32;
    const sync = () => {
      if (prev) prev.disabled = w.scrollLeft < 8;
      if (next) next.disabled = w.scrollLeft + w.clientWidth >= w.scrollWidth - 8;
    };
    prev?.addEventListener('click', () => w.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
    next?.addEventListener('click', () => w.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
    w.addEventListener('scroll', sync, { passive: true });
    sync();

    const live = w.querySelector('.round:has(.tie.ready)');
    if (live && live.offsetLeft > 40 && !new URLSearchParams(location.search).get('player')) {
      setTimeout(() => w.scrollTo({ left: live.offsetLeft - 24, behavior: reduce ? 'auto' : 'smooth' }), 500);
    }

    let down = false, sx = 0, sl = 0, moved = false;
    w.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = w.scrollLeft; });
    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; w.classList.add('drag'); }
      w.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => { down = false; w.classList.remove('drag'); });
    w.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });
}

/* ---------- /tournaments list: search + state filter, remembered in the URL hash ---------- */
export function initListing(root = document) {
  const cards = [...root.querySelectorAll('.cardx')];
  const chips = [...root.querySelectorAll('.tp-chips button')];
  const input = root.querySelector('[data-list-search]');
  const empty = root.querySelector('[data-empty]');
  if (!cards.length) return;
  let f = 'all';
  const apply = () => {
    const q = (input?.value || '').trim().toLowerCase();
    let n = 0;
    cards.forEach((c) => {
      const ok = (f === 'all' || c.dataset.state === f) && (!q || (c.dataset.name || '').includes(q));
      c.hidden = !ok; if (ok) n++;
    });
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
    if (empty) empty.hidden = n > 0;
  };
  chips.forEach((b) => b.addEventListener('click', () => {
    f = b.dataset.f;
    history.replaceState(null, '', f === 'all' ? location.pathname + location.search : `#${f}`);
    apply();
  }));
  input?.addEventListener('input', apply);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; apply(); input.blur(); } });
  const h = location.hash.slice(1);
  if (['live', 'upcoming', 'finished'].includes(h)) f = h;
  apply();
}

/* ---------- one short, on-brand burst when a champion is crowned (once per tab session) ---------- */
function confetti() {
  try {
    if (sessionStorage.getItem('tp-confetti') === location.pathname) return;
    sessionStorage.setItem('tp-confetti', location.pathname);
  } catch { /* storage blocked: still celebrate once */ }
  const c = document.createElement('canvas');
  Object.assign(c.style, { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998 });
  c.width = innerWidth; c.height = innerHeight; c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const g = c.getContext('2d'), cols = ['#f6c453', '#ffe29a', '#4cc9ff', '#9fe6ff', '#ffffff'];
  const ps = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.32,
    vx: (Math.random() - 0.5) * 13, vy: Math.random() * -12 - 3,
    s: Math.random() * 6 + 3, r: Math.random() * 6, c: cols[(Math.random() * cols.length) | 0]
  }));
  let f = 0;
  (function tick() {
    g.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => {
      p.vy += 0.32; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.r += 0.2;
      g.globalAlpha = Math.max(0, 1 - f / 130);
      g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
    });
    if (++f < 130) requestAnimationFrame(tick); else c.remove();
  })();
}
