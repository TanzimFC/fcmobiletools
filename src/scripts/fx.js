// FCMOBILETOOLS motion layer. Small on purpose.
//
//  - Scroll reveals: content that starts below the fold fades up once (14px, transform + opacity).
//  - Looping animations (anything marked [data-fx-loop]) pause while off screen.
//  - [data-countup] numbers count up once when they scroll into view.
//
// Nothing here runs for visitors who prefer reduced motion, and the hidden "before reveal"
// state is only ever applied by this script, so content is never stuck invisible.

if (!window.__fcmtFx) {
  window.__fcmtFx = true;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  const REVEAL_SELECTOR = [
    '#content main > section',
    '#content main > div > section',
    '#content main > article',
    '#content .wrap > section',
    '[data-rv]',
  ].join(',');

  const run = () => {
    if (reduce || !('IntersectionObserver' in window)) return;
    root.classList.add('fx-on');

    const vh = window.innerHeight || 800;
    const seen = new Set();
    const targets = [];
    const add = (el, index = 0) => {
      if (!el || seen.has(el) || el.closest('.fcmt-ad-slot, .fcmt-tool-ad-rail, [data-no-rv]')) return;
      seen.add(el);
      // Only elements that begin below the fold are hidden. Everything already on screen stays put.
      if (el.getBoundingClientRect().top < vh * 0.92) return;
      el.classList.add('rv');
      el.style.setProperty('--rv-i', String(Math.min(index, 6)));
      targets.push(el);
    };

    document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => add(el));
    document.querySelectorAll('[data-rv-group]').forEach((group) => {
      [...group.children].forEach((child, i) => add(child, i));
    });

    if (targets.length) {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && entry.boundingClientRect.top >= 0) continue;
          entry.target.classList.add('rv-in');
          io.unobserve(entry.target);
        }
      }, { threshold: 0.06, rootMargin: '0px 0px -6% 0px' });
      targets.forEach((el) => io.observe(el));
    }

    // Pause looping animations while they are off screen.
    const loops = document.querySelectorAll('[data-fx-loop]');
    if (loops.length) {
      const lo = new IntersectionObserver((entries) => {
        for (const entry of entries) entry.target.classList.toggle('fx-paused', !entry.isIntersecting);
      }, { rootMargin: '80px' });
      loops.forEach((el) => lo.observe(el));
    }
  };

  const countUp = () => {
    const nodes = document.querySelectorAll('[data-countup]');
    if (!nodes.length) return;
    const finish = (el) => { el.textContent = el.dataset.countup; };
    if (reduce || !('IntersectionObserver' in window)) { nodes.forEach(finish); return; }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        const el = entry.target;
        const end = Number(el.dataset.countup);
        if (!Number.isFinite(end)) { finish(el); continue; }
        const start = performance.now();
        const dur = 900;
        const tick = (now) => {
          const k = Math.min(1, (now - start) / dur);
          el.textContent = String(Math.round(end * (1 - Math.pow(1 - k, 3))));
          if (k < 1) requestAnimationFrame(tick); else finish(el);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.6 });
    nodes.forEach((el) => io.observe(el));
  };

  const boot = () => { run(); countUp(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
