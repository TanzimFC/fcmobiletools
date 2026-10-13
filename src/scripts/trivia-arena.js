// Practice arena. Loaded lazily the first time someone presses a [data-arena] button.
// Modes: Quiz (untimed), Time Attack (speed bonus), Flashcards (self-graded).
import '../styles/trivia-arena.css';

const SETS = {
  'season-recap': { src: '/trivia/data/season-recap.json', title: 'Season Recap (Challenge)', options: 2, secs: 12, lengths: [10, 20, 30] },
  'nations-story': { src: '/trivia/data/nations-story.json', title: "A Nation's Story", options: 4, secs: 15, lengths: [5, 10, 20] }
};
const MODES = {
  quiz: { name: 'Quiz', icon: '🎯', blurb: 'No timer. Instant feedback after every answer.' },
  attack: { name: 'Time Attack', icon: '⚡', blurb: 'Answer fast for bonus points, like the real event.' },
  cards: { name: 'Flashcards', icon: '🃏', blurb: 'Flip, check yourself and re-drill what you missed.' }
};
const STORE = 'fcmt:trivia:v1';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[(Math.random() * a.length) | 0];
const store = {
  read() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } },
  write(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch {} }
};

let dlg, data = {}, state = null;

/* ---------- 2-option generation for Season Recap ----------------------- */
function buildPools(list) {
  const pools = { num: {}, club: {}, clubAll: new Set(), person: {}, personAll: new Set() };
  for (const q of list) {
    for (const a of q.a) {
      if (q.k === 'number') (pools.num[q.f] ||= new Set()).add(Number(a));
      else if (q.k === 'club') { (pools.club[q.l] ||= new Set()).add(a); pools.clubAll.add(a); }
      else { (pools.person[q.c] ||= new Set()).add(a); pools.personAll.add(a); }
    }
  }
  return pools;
}
function distractor(q, correct, pools) {
  const taken = new Set(q.a.map(String));
  if (q.k === 'number') {
    const n = Number(correct);
    const near = [...(pools.num[q.f] || [])].filter((v) => v !== n && Math.abs(v - n) <= 5 && v > 0);
    if (near.length) return String(pick(near));
    const around = [-3, -2, -1, 1, 2, 3].map((d) => n + d).filter((v) => v > 0);
    return String(pick(around));
  }
  const first = q.k === 'club' ? [...(pools.club[q.l] || [])] : [...(pools.person[q.c] || [])];
  const any = q.k === 'club' ? [...pools.clubAll] : [...pools.personAll];
  const choices = [first, any].map((l) => l.filter((x) => !taken.has(x)));
  return pick(choices[0].length > 3 ? choices[0] : choices[1]);
}
function toRound(setKey, q, pools) {
  if (setKey === 'nations-story') {
    return { id: q.id, q: q.q, correct: q.a, ci: q.ci, options: q.o, answerText: q.a, link: q.u, tag: `${q.nn} · Day ${q.d}` };
  }
  const correct = pick(q.a);
  const options = shuffle([correct, distractor(q, correct, pools)]);
  return { id: q.id, q: q.q, correct, ci: options.indexOf(correct), options, answerText: q.a.length > 1 ? q.a.join(' / ') : q.a[0], link: `/trivia/extra-time/season-recap/#${q.s}`, tag: q.c };
}

/* ---------- Shell -------------------------------------------------------- */
function ensureDialog() {
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.className = 'tva';
  dlg.setAttribute('aria-labelledby', 'tva-title');
  dlg.innerHTML = '<div class="tva-inner" id="tva-root"></div>';
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => { clearInterval(state?.timer); document.documentElement.classList.remove('tva-lock'); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  // Document-level: focus falls back to <body> whenever a screen re-renders.
  document.addEventListener('keydown', (e) => { if (dlg.open && !e.ctrlKey && !e.metaKey && !e.altKey) onKey(e); });
  dlg.addEventListener('click', onClick);
  return dlg;
}
const root = () => dlg.querySelector('#tva-root');
const head = (title, sub = '') => `<header class="tva-head"><div><small>${esc(sub)}</small><h2 id="tva-title">${esc(title)}</h2></div><button class="tva-close" data-act="close" aria-label="Close practice">✕</button></header>`;

export async function openArena(opts = {}) {
  const setKey = SETS[opts.set] ? opts.set : 'season-recap';
  ensureDialog();
  document.documentElement.classList.add('tva-lock');
  root().innerHTML = head(SETS[setKey].title, 'Practice') + '<div class="tva-body tva-center"><div class="tva-spin"></div><p>Loading questions…</p></div>';
  if (!dlg.open) dlg.showModal();
  try {
    if (!data[setKey]) {
      const response = await fetch(SETS[setKey].src, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error('Question data request failed: HTTP ' + response.status);
      const list = await response.json();
      if (!Array.isArray(list) || list.length === 0) throw new Error('Question data was empty or invalid.');
      data[setKey] = { list, pools: setKey === 'season-recap' ? buildPools(list) : null };
    }
  } catch (error) {
    console.error('[Trivia] Could not load practice questions:', error);
    root().innerHTML = head(SETS[setKey].title, 'Practice') + '<div class="tva-body tva-center"><p>Couldn\'t load the questions. Refresh the page and try again.</p><a class="tv-btn ghost" href="' + esc(SETS[setKey].src) + '" target="_blank" rel="noopener">Check question data</a></div>';
    return;
  }
  state = { setKey, mode: MODES[opts.mode] ? opts.mode : 'quiz', topic: opts.nation || opts.topic || 'all', day: opts.day || 'all', length: Number(opts.length) || SETS[setKey].lengths[0] };
  renderSetup();
}

/* ---------- Setup -------------------------------------------------------- */
function poolFor(s) {
  const { list } = data[s.setKey];
  return list.filter((q) => {
    if (s.setKey === 'season-recap') return s.topic === 'all' || q.c === s.topic;
    return (s.topic === 'all' || q.n === s.topic) && (s.day === 'all' || String(q.d) === String(s.day));
  });
}
function renderSetup() {
  const s = state, cfg = SETS[s.setKey], { list } = data[s.setKey];
  const topics = s.setKey === 'season-recap'
    ? ['all', ...new Set(list.map((q) => q.c))]
    : ['all', ...new Set(list.map((q) => q.n))];
  const label = (t) => (t === 'all' ? 'Everything' : s.setKey === 'nations-story' ? t[0].toUpperCase() + t.slice(1) : t);
  const days = s.setKey === 'nations-story' ? ['all', ...new Set(list.filter((q) => s.topic === 'all' || q.n === s.topic).map((q) => q.d))] : [];
  const total = poolFor(s).length;
  const lengths = [...cfg.lengths.filter((n) => n < total), total].filter((n, i, a) => a.indexOf(n) === i);
  if (!lengths.includes(s.length)) s.length = Math.min(s.length, total);
  const best = store.read().best?.[`${s.setKey}:${s.mode}`];
  root().innerHTML = head(cfg.title, 'Practice mode') + `
  <div class="tva-body">
    <div class="tva-sec"><b>Mode</b><div class="tva-modes">${Object.entries(MODES).map(([k, m]) =>
      `<button class="tva-mode" data-act="mode" data-v="${k}" aria-pressed="${s.mode === k}"><span>${m.icon}</span><strong>${m.name}</strong><em>${m.blurb}</em></button>`).join('')}</div></div>
    <div class="tva-sec"><b>${s.setKey === 'season-recap' ? 'Topic' : 'Nation'}</b><div class="tva-chips">${topics.map((t) =>
      `<button class="tva-chip" data-act="topic" data-v="${esc(t)}" aria-pressed="${s.topic === t}">${esc(label(t))}</button>`).join('')}</div></div>
    ${days.length ? `<div class="tva-sec"><b>Day</b><div class="tva-chips">${days.map((d) =>
      `<button class="tva-chip" data-act="day" data-v="${d}" aria-pressed="${String(s.day) === String(d)}">${d === 'all' ? 'All days' : 'Day ' + d}</button>`).join('')}</div></div>` : ''}
    <div class="tva-sec"><b>Questions</b><div class="tva-chips">${lengths.map((n) =>
      `<button class="tva-chip" data-act="length" data-v="${n}" aria-pressed="${s.length === n}">${n === total ? 'All ' + n : n}</button>`).join('')}</div></div>
    <div class="tva-note">${cfg.options === 2 ? 'Real rounds show 2 options per question. Here, the second option is generated, so yours will differ from the game.' : 'Real 4-option sets from the event.'}${best ? ` · Personal best: <b>${best}</b>` : ''}</div>
  </div>
  <footer class="tva-foot"><span>${total} question${total === 1 ? '' : 's'} available</span><button class="tv-btn" data-act="start" ${total ? '' : 'disabled'}>Start ${MODES[s.mode].name}</button></footer>`;
}

/* ---------- Play --------------------------------------------------------- */
function start(only) {
  const s = state, cfg = SETS[s.setKey], { pools } = data[s.setKey];
  const src = only || shuffle(poolFor(s)).slice(0, s.length);
  s.rounds = only ? src : src.map((q) => toRound(s.setKey, q, pools));
  s.i = 0; s.score = 0; s.streak = 0; s.best = 0; s.right = 0; s.missed = []; s.known = []; s.locked = false; s.flipped = false;
  s.secs = cfg.secs;
  renderQuestion();
}
function renderQuestion() {
  const s = state, r = s.rounds[s.i], cfg = SETS[s.setKey];
  clearInterval(s.timer);
  s.locked = false; s.flipped = false;
  const pct = (s.i / s.rounds.length) * 100;
  const top = `${head(MODES[s.mode].name, `${esc(r.tag)}`)}
    <div class="tva-prog"><i style="width:${pct}%"></i></div>
    <div class="tva-hud"><span>Question <b>${s.i + 1}</b> / ${s.rounds.length}</span>
      ${s.mode === 'cards' ? `<span>Known <b>${s.known.length}</b></span>` : `<span>Score <b id="tva-score">${s.score}</b></span><span class="tva-streak ${s.streak > 1 ? 'on' : ''}">🔥 <b>${s.streak}</b></span>`}
      ${s.mode === 'attack' ? '<span class="tva-time"><b id="tva-t">' + cfg.secs + '</b>s</span>' : ''}</div>`;
  if (s.mode === 'cards') {
    root().innerHTML = top + `<div class="tva-body tva-cardwrap">
      <button class="tva-card" data-act="flip" aria-label="Flip card"><div class="tva-face front"><small>Question</small><p>${esc(r.q)}</p><em>Tap to reveal the answer</em></div>
        <div class="tva-face back"><small>Answer</small><p>${esc(r.answerText)}</p></div></button>
      <div class="tva-grade" hidden><button class="tv-btn ghost" data-act="learn">Still learning</button><button class="tv-btn" data-act="know">Got it ✓</button></div></div>`;
    return;
  }
  root().innerHTML = top + `<div class="tva-body"><h3 class="tva-q">${esc(r.q)}</h3>
    <div class="tva-opts ${r.options.length === 2 ? 'two' : ''}">${r.options.map((o, n) =>
      `<button class="tva-opt" data-act="pick" data-i="${n}"><span class="k">${r.options.length === 2 ? n + 1 : String.fromCharCode(65 + n)}</span><span>${esc(o)}</span><i class="m"></i></button>`).join('')}</div>
    <div class="tva-fb" aria-live="polite"></div></div>`;
  if (s.mode === 'attack') {
    s.t0 = performance.now();
    s.timer = setInterval(() => {
      const left = Math.max(0, cfg.secs - (performance.now() - s.t0) / 1000);
      const el = root().querySelector('#tva-t');
      if (el) { el.textContent = Math.ceil(left); el.parentElement.classList.toggle('low', left <= 4); }
      root().querySelector('.tva-prog i')?.style.setProperty('opacity', '1');
      if (left <= 0) answer(-1);
    }, 100);
  }
}
function answer(i) {
  const s = state, r = s.rounds[s.i], cfg = SETS[s.setKey];
  if (s.locked) return;
  s.locked = true; clearInterval(s.timer);
  const good = i === r.ci;
  let gain = 0;
  if (good) {
    s.right++; s.streak++; s.best = Math.max(s.best, s.streak);
    gain = 100;
    if (s.mode === 'attack') {
      const left = Math.max(0, cfg.secs - (performance.now() - s.t0) / 1000);
      gain += Math.round((left / cfg.secs) * 100) + 10 * Math.min(s.streak - 1, 5);
    }
    s.score += gain;
  } else { s.streak = 0; s.missed.push(r); }
  const btns = [...root().querySelectorAll('.tva-opt')];
  btns.forEach((b, n) => { b.disabled = true; if (n === r.ci) b.classList.add('ok'); else if (n === i) b.classList.add('bad'); });
  const fb = root().querySelector('.tva-fb');
  fb.innerHTML = `<div class="tva-fbrow ${good ? 'good' : 'bad'}"><strong>${good ? (gain > 100 ? `Correct +${gain}` : 'Correct +100') : i < 0 ? "Time's up" : 'Not quite'}</strong>${good ? '' : `<span>Answer: <b>${esc(r.answerText)}</b></span>`}<a href="${r.link}" class="tva-more">Open answer page ↗</a></div>
    ${s.mode === 'quiz' || !good ? `<button class="tv-btn sm" data-act="next">${s.i + 1 === s.rounds.length ? 'See results' : 'Next question'} →</button>` : ''}`;
  const sc = root().querySelector('#tva-score'); if (sc) sc.textContent = s.score;
  const st = root().querySelector('.tva-streak'); if (st) { st.classList.toggle('on', s.streak > 1); st.querySelector('b').textContent = s.streak; }
  if (s.mode === 'attack' && good) setTimeout(next, 850);
}
function next() {
  const s = state;
  if (s.i + 1 >= s.rounds.length) return results();
  s.i++; renderQuestion();
}

/* ---------- Results ------------------------------------------------------ */
function results() {
  const s = state, n = s.rounds.length;
  clearInterval(s.timer);
  const cards = s.mode === 'cards';
  const hit = cards ? s.known.length : s.right;
  const pct = Math.round((hit / n) * 100);
  const key = `${s.setKey}:${s.mode}`;
  const db = store.read(); db.best ||= {};
  const metric = s.mode === 'attack' ? s.score : pct;
  const label = s.mode === 'attack' ? `${s.score} pts` : `${pct}%`;
  const prev = db.best[key] ? parseInt(db.best[key], 10) : -1;
  const record = metric > prev;
  if (record) { db.best[key] = label; store.write(db); }
  const grade = pct >= 90 ? 'Matchday legend' : pct >= 70 ? 'First-team starter' : pct >= 50 ? 'Solid squad player' : 'Keep drilling';
  const wrong = cards ? s.rounds.filter((r) => !s.known.includes(r)) : s.missed;
  root().innerHTML = `${head('Round complete', MODES[s.mode].name)}<div class="tva-body tva-res">
    <div class="tva-ringw"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52" style="--p:${pct}"/></svg><div><b>${pct}%</b><small>${hit} / ${n}</small></div></div>
    <h3>${grade}</h3>
    <div class="tva-kpis">${s.mode === 'attack' ? `<div><b>${s.score}</b><span>Points</span></div>` : ''}${cards ? '' : `<div><b>${s.best}</b><span>Best streak</span></div>`}<div><b>${wrong.length}</b><span>${cards ? 'To revisit' : 'Missed'}</span></div></div>
    ${record && n >= 5 ? `<div class="tva-record">🏆 New personal best: ${label}</div>` : ''}
    ${wrong.length ? `<div class="tva-miss"><b>Review</b>${wrong.map((r) => `<a href="${r.link}"><span>${esc(r.q)}</span><em>${esc(r.answerText)}</em></a>`).join('')}</div>` : '<p class="tva-perfect">Flawless. Nothing to review.</p>'}
  </div><footer class="tva-foot">${wrong.length ? '<button class="tv-btn ghost" data-act="retry">Retry missed</button>' : '<span></span>'}<button class="tv-btn" data-act="again">New round</button></footer>`;
  if (pct >= 90 && !matchMedia('(prefers-reduced-motion: reduce)').matches) burst();
}
function burst() {
  const el = document.createElement('div'); el.className = 'tva-burst';
  el.innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="--a:${i * 20}deg;--d:${60 + (i % 3) * 28}px;--c:${['#4cc9ff', '#f6c453', '#4ee0a0', '#9a8cff'][i % 4]}"></i>`).join('');
  root().querySelector('.tva-ringw')?.appendChild(el);
}

/* ---------- Events ------------------------------------------------------- */
function onClick(e) {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, v = t.dataset.v, s = state;
  if (a === 'close') dlg.close();
  else if (a === 'mode') { s.mode = v; renderSetup(); }
  else if (a === 'topic') { s.topic = v; s.day = 'all'; renderSetup(); }
  else if (a === 'day') { s.day = v; renderSetup(); }
  else if (a === 'length') { s.length = Number(v); renderSetup(); }
  else if (a === 'start') start();
  else if (a === 'pick') answer(Number(t.dataset.i));
  else if (a === 'next') next();
  else if (a === 'flip') flip();
  else if (a === 'know') { s.known.push(s.rounds[s.i]); next(); }
  else if (a === 'learn') { s.missed.push(s.rounds[s.i]); next(); }
  else if (a === 'again') renderSetup();
  else if (a === 'retry') start(shuffle(s.mode === 'cards' ? s.rounds.filter((r) => !s.known.includes(r)) : s.missed));
}
function flip() {
  const card = root().querySelector('.tva-card'); if (!card) return;
  state.flipped = !state.flipped;
  card.classList.toggle('flipped', state.flipped);
  root().querySelector('.tva-grade').hidden = !state.flipped;
}
function onKey(e) {
  const s = state; if (!s?.rounds || !root().querySelector('.tva-q, .tva-card')) return;
  if (s.mode === 'cards') { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } return; }
  const r = s.rounds[s.i];
  if (!s.locked) {
    const idx = /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : /^[a-dA-D]$/.test(e.key) ? e.key.toLowerCase().charCodeAt(0) - 97 : -1;
    if (idx >= 0 && idx < r.options.length) { e.preventDefault(); answer(idx); }
  } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
}
