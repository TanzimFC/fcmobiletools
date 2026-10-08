// Premium micro-interactions for the account area.
// 1) Cursor spotlight: feeds --mx/--my to cards (see .kpi-card::before etc. in premium.css)
// 2) Count-up for elements marked data-count
const SEL = '.kpi-card, .mission-card, .rw-card, .side-card, .pub-stat';

if (!window.__fcmtPremiumFx) {
  window.__fcmtPremiumFx = true;

  document.addEventListener(
    'pointermove',
    (e) => {
      const card = e.target instanceof Element ? e.target.closest(SEL) : null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', e.clientX - r.left + 'px');
      card.style.setProperty('--my', e.clientY - r.top + 'px');
    },
    { passive: true }
  );

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target) || el.dataset.counted) return;
    el.dataset.counted = '1';
    if (reduce || target < 10) { el.textContent = target.toLocaleString(); return; }
    const t0 = performance.now(), dur = 900;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased).toLocaleString();
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const scan = (root) => root.querySelectorAll?.('[data-count]').forEach(countUp);
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches?.('[data-count]') && countUp(n), scan(n)));
  }).observe(document.body, { childList: true, subtree: true });
  scan(document);
}
