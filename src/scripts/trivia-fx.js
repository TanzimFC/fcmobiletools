// Small, dependency-free polish for Trivia pages. Everything degrades cleanly:
// without JS the content is simply visible.
// Tell the layout's fail-safe that effects are alive (otherwise it reveals everything after 3s).
document.documentElement.classList.add('tv-fx');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

// 1. Reveal on scroll
const reveals = document.querySelectorAll('.tv-reveal');
if (reveals.length) {
  if (reduce || !('IntersectionObserver' in window)) reveals.forEach((el) => el.classList.add('is-in'));
  else {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  }
}

// 2. Cursor spotlight + gentle tilt (desktop pointers only)
if (fine && !reduce) {
  let raf = 0;
  document.addEventListener('pointermove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = e.target instanceof Element ? e.target.closest('.tv-spot, .tv-tilt') : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty('--mx', x + 'px');
      el.style.setProperty('--my', y + 'px');
      if (el.classList.contains('tv-tilt')) {
        el.style.setProperty('--ry', ((x / r.width - 0.5) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - y / r.height) * 5).toFixed(2) + 'deg');
      }
    });
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const el = e.target instanceof Element ? e.target.closest('.tv-tilt') : null;
    if (el && !el.contains(e.relatedTarget)) { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
  });
}

// 3. Count-up numbers: <b data-count="274">
const counters = document.querySelectorAll('[data-count]');
if (counters.length && 'IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target, to = Number(el.dataset.count), t0 = performance.now(), dur = 1100;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US');
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
  counters.forEach((el) => io.observe(el));
}

// 4. Copy-link buttons: <button data-copy="/path/#hash">
document.addEventListener('click', async (e) => {
  const btn = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
  if (!btn) return;
  const url = new URL(btn.dataset.copy, location.origin).toString();
  const old = btn.getAttribute('aria-label');
  const oldTitle = btn.getAttribute('title');
  try {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement('textarea');
      field.value = url; field.setAttribute('readonly', '');
      field.style.position = 'fixed'; field.style.opacity = '0'; field.style.pointerEvents = 'none';
      document.body.appendChild(field); field.select();
      const copied = document.execCommand?.('copy'); field.remove();
      if (!copied) throw new Error('Clipboard copy failed');
    }
    btn.classList.add('done');
    btn.setAttribute('aria-label', 'Link copied');
    btn.setAttribute('title', 'Link copied');
  } catch {
    btn.classList.add('error');
    btn.setAttribute('aria-label', 'Copy failed. Copy the page address manually.');
    btn.setAttribute('title', 'Copy failed. Copy the page address manually.');
  }
  setTimeout(() => {
    btn.classList.remove('done', 'error');
    btn.setAttribute('aria-label', old || 'Copy link');
    if (oldTitle === null) btn.removeAttribute('title'); else btn.setAttribute('title', oldTitle);
  }, 1600);
});

// 5. Banner / art images that are not deployed yet: hide cleanly, gradient shows.
document.querySelectorAll('img[data-optional]').forEach((img) => {
  const hide = () => img.remove();
  if (img.complete && img.naturalWidth === 0) hide();
  else img.addEventListener('error', hide, { once: true });
});

// 6. Lazy search
if (document.querySelector('[data-tv-search]')) import('./trivia-search.js');

// 7. Press ripple on buttons and answer options
if (!reduce) {
  document.addEventListener('pointerdown', (e) => {
    const el = e.target instanceof Element ? e.target.closest('.tv-btn, .tp-opt, .tp-chip-btn, .tp-mode') : null;
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'tv-rip';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 720);
  }, { passive: true });
}

// 8. Old deep link: ?practice=quiz used to open the modal. Send it to the Play page instead.
{
  const mode = new URLSearchParams(location.search).get('practice');
  const link = mode && document.querySelector('a[data-play]');
  if (link) {
    const url = new URL(link.getAttribute('href'), location.origin);
    url.searchParams.set('mode', ['quiz', 'attack', 'cards'].includes(mode) ? mode : 'quiz');
    location.replace(url.toString());
  }
}
