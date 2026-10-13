// Palette-style search over every trivia question. The index is fetched lazily
// (first focus) and cached by the browser, so it costs nothing on page load.
import { rank, highlight } from '../lib/triviaCore.js';

const ICON = { et: '⚡', ans: '🌍' };
let indexPromise;
const loadIndex = (src) => (indexPromise ||= fetch(src).then((r) => r.json()));

function mount(root) {
  const input = root.querySelector('input');
  const box = root.querySelector('.tv-results');
  const clear = root.querySelector('.tv-x');
  const scope = root.dataset.scope || 'all';
  let items = null, active = -1, rows = [], current = '';

  const close = () => { box.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); };
  const setActive = (i) => {
    rows.forEach((r, n) => r.setAttribute('aria-selected', n === i ? 'true' : 'false'));
    active = i;
    rows[i]?.scrollIntoView({ block: 'nearest' });
  };

  function render(query) {
    current = query;
    root.classList.toggle('has-value', !!query);
    if (!query.trim()) return close();
    if (!items) { box.hidden = false; box.innerHTML = '<div class="tv-res-empty">Loading questions…</div>'; return; }
    const pool = scope === 'all' ? items : items.filter((i) => i.t === scope);
    const hits = rank(pool, query, 12);
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (!hits.length) {
      box.innerHTML = '<div class="tv-res-empty"><b>No matching question</b>Try fewer words, such as a player, club, nation or year.</div>';
      rows = []; return;
    }
    box.innerHTML = hits.map((h) =>
      `<a class="tv-res" role="option" aria-selected="false" href="${h.u}">` +
      `<span class="tv-res-ico" aria-hidden="true">${ICON[h.t] || '•'}</span>` +
      `<span><small>${h.m}</small><strong>${highlight(h.q, query)}</strong><em>${highlight(h.a, query)}</em></span>` +
      `<span class="tv-res-go" aria-hidden="true">↗</span></a>`
    ).join('') + `<div class="tv-res-foot"><span>↑ ↓ to move</span><span>Enter to open</span><span>Esc to close</span></div>`;
    rows = [...box.querySelectorAll('.tv-res')];
    setActive(0);
  }

  const ensure = () => items || loadIndex(root.dataset.src).then((d) => { items = d; if (current) render(current); }).catch(() => {
    box.hidden = false; box.innerHTML = '<div class="tv-res-empty"><b>Search is unavailable</b>Please refresh and try again.</div>';
  });

  input.addEventListener('focus', ensure, { once: true });
  input.addEventListener('input', () => { ensure(); render(input.value); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); setActive((active + 1) % rows.length); }
    else if (e.key === 'ArrowUp' && rows.length) { e.preventDefault(); setActive((active - 1 + rows.length) % rows.length); }
    else if (e.key === 'Enter' && rows[active]) { e.preventDefault(); location.href = rows[active].getAttribute('href'); }
    else if (e.key === 'Escape') { if (input.value) { input.value = ''; render(''); } else close(); }
  });
  clear?.addEventListener('click', () => { input.value = ''; render(''); input.focus(); });
  document.addEventListener('pointerdown', (e) => { if (!root.contains(e.target)) close(); });
  input.addEventListener('focus', () => { if (input.value) render(input.value); });

  const q = new URLSearchParams(location.search).get('q');
  if (q) { input.value = q; ensure(); render(q); }
  return input;
}

const inputs = [...document.querySelectorAll('[data-tv-search]')].map(mount);
if (inputs.length) {
  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
      e.preventDefault(); inputs[0].focus(); inputs[0].select();
    }
  });
}
