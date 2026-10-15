// Premium motion + interaction layer (v2). Respects prefers-reduced-motion. No dependencies.
export function initFx(root = document) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = root.querySelectorAll('[data-reveal]');
  if (calm || !('IntersectionObserver' in window)) els.forEach((e) => e.classList.add('in'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e, i) => { e.style.setProperty('--d', `${(i % 6) * 70}ms`); io.observe(e); });
  }
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count) || 0; if (calm || !to) { el.textContent = to; return; }
    const t0 = performance.now(), run = (t) => { const p = Math.min(1, (t - t0) / 1500); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(run); };
    requestAnimationFrame(run);
  });
  initFind(root);
  initSpy(root);
  if (calm) return;
  const tp = root.querySelector('.tp');
  if (tp) {
    tp.insertAdjacentHTML('afterbegin', '<div class="tp-spot" aria-hidden="true"></div><div class="tp-grain" aria-hidden="true"></div><div class="tp-progress" aria-hidden="true"></div>');
    const spot = tp.querySelector('.tp-spot'), bar = tp.querySelector('.tp-progress');
    addEventListener('pointermove', (e) => { spot.style.setProperty('--cx', e.clientX + 'px'); spot.style.setProperty('--cy', e.clientY + 'px'); }, { passive: true });
    const sp = () => { const h = document.documentElement; bar.style.setProperty('--sp', Math.min(1, scrollY / Math.max(1, h.scrollHeight - innerHeight))); };
    addEventListener('scroll', sp, { passive: true }); sp();
  }
  root.querySelectorAll('.tp-glass').forEach((c) => {
    c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      c.style.setProperty('--mx', x + 'px'); c.style.setProperty('--my', y + 'px');
      if (c.dataset.tilt !== undefined) c.style.transform = `perspective(900px) rotateX(${((y / r.height) - .5) * -6}deg) rotateY(${((x / r.width) - .5) * 7}deg) translateY(-4px)`; });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
  });
  // magnetic buttons
  root.querySelectorAll('.tp-btn:not(:disabled)').forEach((b) => {
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .16}px,${(e.clientY - r.top - r.height / 2) * .22}px) scale(1.03)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
  focusBracket(root);
  if (root.querySelector('.champion')) confetti();
}

// Scroll each bracket to the round where the action is (first round with a playable tie).
function focusBracket(root) {
  root.querySelectorAll('.bracket-wrap').forEach((w) => {
    const r = w.querySelector('.round:has(.tie.ready)'); if (r && r.offsetLeft > 40) setTimeout(() => w.scrollTo({ left: r.offsetLeft - 24, behavior: 'smooth' }), 700);
  });
}

// "Find my match": highlight a player's ties, fixtures and table rows.
function initFind(root) {
  const input = root.querySelector('[data-find]'); if (!input) return;
  const out = root.querySelector('.find small'), items = [...root.querySelectorAll('.tie,.fx,.standings tbody tr')];
  const run = () => {
    const q = input.value.trim().toLowerCase(); let n = 0, first = null;
    items.forEach((el) => { const on = q.length > 0 && el.textContent.toLowerCase().includes(q); el.classList.toggle('hit', on); if (on) { n++; first ||= el; } });
    document.body.classList.toggle('finding', q.length > 0 && n > 0);
    if (out) out.textContent = q ? String(n) : '';
    return first;
  };
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const f = run(); const d = f?.closest('details'); if (d) d.open = true; f?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); }
    if (e.key === 'Escape') { input.value = ''; run(); }
  });
}

// Highlight the stage you are reading in the sticky nav.
function initSpy(root) {
  const links = [...root.querySelectorAll('.stage-nav a')]; if (!links.length || !('IntersectionObserver' in window)) return;
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { links.forEach((a) => a.classList.remove('on')); map.get(e.target.id)?.classList.add('on'); } }), { rootMargin: '-35% 0px -55% 0px' });
  map.forEach((_, id) => { const s = root.getElementById ? root.getElementById(id) : document.getElementById(id); if (s) io.observe(s); });
}

// One-time gold confetti burst for a crowned champion (once per tab session).
function confetti() {
  try { if (sessionStorage.getItem('tp-confetti') === location.pathname) return; sessionStorage.setItem('tp-confetti', location.pathname); } catch {}
  const c = document.createElement('canvas'); Object.assign(c.style, { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998 });
  c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const g = c.getContext('2d'), cols = ['#f2c14e', '#ffe7a8', '#4cc9ff', '#fff'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 15, vy: Math.random() * -13 - 3, s: Math.random() * 7 + 3, r: Math.random() * 6, c: cols[(Math.random() * 4) | 0] }));
  let f = 0; (function tick() { g.clearRect(0, 0, c.width, c.height); ps.forEach((p) => { p.vy += .3; p.x += p.vx; p.y += p.vy; p.r += .2; g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); });
    if (++f < 170) requestAnimationFrame(tick); else c.remove(); })();
}
