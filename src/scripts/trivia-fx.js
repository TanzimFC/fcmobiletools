import { openArena } from './trivia-arena.js';

// Small, dependency-free polish for Trivia pages. Everything degrades cleanly:
// without JS the content is simply visible.
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

// 6. Lazy search; use a statically bundled practice launcher so the arena
// is available reliably in both development and the production static build.
if (document.querySelector('[data-tv-search]')) import('./trivia-search.js');

async function launchPractice(btn, opts = {}) {
  if (btn?.dataset.arenaBusy === 'true') return;
  if (btn) {
    btn.dataset.arenaBusy = 'true';
    btn.setAttribute('aria-busy', 'true');
    if ('disabled' in btn) btn.disabled = true;
  }
  try {
    await openArena({ ...(btn?.dataset || {}), ...opts, set: btn?.dataset.arena || opts.set || 'season-recap' });
  } catch (error) {
    console.error('[Trivia] Practice mode failed to open:', error);
    const host = btn?.closest('.tv-mode, .tv-banner-copy, .tv-event-copy, .tv-box') || document.querySelector('.tv-wrap');
    if (host) {
      let note = host.querySelector('.tv-practice-feedback');
      if (!note) {
        note = document.createElement('p');
        note.className = 'tv-practice-feedback';
        note.setAttribute('role', 'alert');
        host.append(note);
      }
      note.textContent = 'Practice could not open. Refresh the page and try again.';
    }
  } finally {
    if (btn) {
      delete btn.dataset.arenaBusy;
      btn.removeAttribute('aria-busy');
      if ('disabled' in btn) btn.disabled = false;
    }
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target instanceof Element ? e.target.closest('[data-arena]') : null;
  if (!btn) return;
  e.preventDefault();
  void launchPractice(btn);
});

// Deep-link: ?practice=quiz opens the arena for the first launcher on the page.
{
  const mode = new URLSearchParams(location.search).get('practice');
  const first = mode && document.querySelector('[data-arena]');
  if (first) void launchPractice(first, { mode });
}
