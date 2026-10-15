// Premium motion layer. Respects prefers-reduced-motion. No dependencies.
export function initFx(root = document) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = root.querySelectorAll('[data-reveal]');
  if (calm || !('IntersectionObserver' in window)) els.forEach((e) => e.classList.add('in'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((e, i) => { e.style.setProperty('--d', `${(i % 6) * 70}ms`); io.observe(e); });
  }
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count) || 0; if (calm || !to) { el.textContent = to; return; }
    const t0 = performance.now(), run = (t) => { const p = Math.min(1, (t - t0) / 1300); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(run); };
    requestAnimationFrame(run);
  });
  if (calm) return;
  root.querySelectorAll('.tp-glass').forEach((c) => {
    c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      c.style.setProperty('--mx', x + 'px'); c.style.setProperty('--my', y + 'px');
      if (c.dataset.tilt !== undefined) c.style.transform = `perspective(900px) rotateX(${((y / r.height) - .5) * -5}deg) rotateY(${((x / r.width) - .5) * 6}deg) translateY(-3px)`; });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
  });
}
