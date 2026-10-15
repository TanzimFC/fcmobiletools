// FC Mobile Trivia: the Play page.
// Screens: boot -> setup -> (countdown) -> question x N -> results. One delegated click handler,
// no <dialog>, no sticky bars. Game rules live in lib/triviaPlay.js (unit-tested in Node).
import {
  SETS, MODES, DELAY, shuffle, buildPools, toRound, poolFor, lengthOptions, pointsFor, gradeFor, readParams, reshuffle
} from '../lib/triviaPlay.js';

const STORE = 'fcmt:trivia:v1';
const root = document.getElementById('tp');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const config = (() => {
  try { return JSON.parse(document.getElementById('tp-config').textContent); } catch (e) { return { nations: [], counts: {} }; }
})();
const NATIONS = {};
config.nations.forEach((n) => { NATIONS[n.slug] = n; });
const DEFAULT_RGB = '233,196,106';

/* ---------- tiny helpers ------------------------------------------------ */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  read() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } },
  write(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* unsupported */ } };
const svg = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ''}>${d}</svg>`;
const I = {
  quiz: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>'),
  attack: svg('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>'),
  cards: svg('<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>'),
  flame: svg('<path d="M12 3c1 3.2 4.5 4.9 4.5 9a4.5 4.5 0 0 1-9 0c0-1.7.8-2.9 1.7-3.9.2 1.2.9 2 1.7 2.2C10.5 8 10.7 5.4 12 3Z"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 'class="go"'),
  play: svg('<path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.5-7.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8Z" fill="currentColor" stroke="none"/>'),
  retry: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.5H8"/>'),
  share: svg('<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  ext: svg('<path d="M8 16 16 8M9 8h7v7"/>'),
  tap: svg('<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 14.5a1.5 1.5 0 0 1 2.4-1.7L9 15"/>'),
  trophy: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M9.5 14.5V17h5v-2.5M8 20h8"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')
};

/* ---------- state ------------------------------------------------------- */
const data = {};
const S = {
  screen: 'boot', setKey: 'season-recap', mode: 'quiz', topic: 'all', day: 'all', length: 0,
  rounds: [], i: 0, score: 0, streak: 0, bestStreak: 0, right: 0, missed: [], known: [], marks: [],
  locked: false, flipped: false, token: 0, started: 0, answered: 0
};
const timers = { advance: 0, raf: 0, countdown: 0, quit: 0 };
const prefs = () => Object.assign({ auto: true }, store.read().prefs);

function clearTimers() {
  clearTimeout(timers.advance); clearTimeout(timers.quit); clearInterval(timers.countdown); cancelAnimationFrame(timers.raf);
  timers.advance = timers.quit = timers.countdown = timers.raf = 0;
}

/* ---------- data -------------------------------------------------------- */
function load(setKey) {
  const entry = data[setKey];
  if (entry && entry.list) return Promise.resolve(entry);
  if (entry && entry.promise) return entry.promise;
  const promise = fetch(SETS[setKey].src, { headers: { accept: 'application/json' } })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((list) => {
      if (!Array.isArray(list) || !list.length) throw new Error('Question data was empty');
      data[setKey] = { list, pools: setKey === 'season-recap' ? buildPools(list) : null };
      return data[setKey];
    })
    .catch((error) => { data[setKey] = { error }; throw error; });
  data[setKey] = { promise };
  return promise;
}

/* ---------- screen plumbing -------------------------------------------- */
function accent(rgb) {
  // Gold stays the action colour everywhere; a nation's colour only tints the ticket glow (--g).
  root.style.setProperty('--g', rgb);
}
function paint(name, html, cls) {
  S.screen = name;
  root.dataset.state = name;
  const wrap = root.closest('.tp-wrap'); if (wrap) wrap.dataset.state = name;
  root.innerHTML = '<div class="tp-screen ' + (cls || '') + '" data-screen="' + name + '">' + html + '</div>';
  const f = root.querySelector('[data-focus]');
  if (f) f.focus({ preventScroll: true });
}
function bringIntoView() {
  const top = root.getBoundingClientRect().top;
  if (top < -10 || top > innerHeight * 0.4) root.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}
function syncUrl() {
  try {
    const q = new URLSearchParams();
    q.set('set', S.setKey); q.set('mode', S.mode);
    if (S.topic !== 'all') q.set(S.setKey === 'nations-story' ? 'nation' : 'topic', S.topic);
    if (S.day !== 'all') q.set('day', S.day);
    history.replaceState(null, '', location.pathname + '?' + q.toString());
  } catch (e) { /* sandboxed */ }
}

/* ---------- SETUP ------------------------------------------------------- */
function derive() {
  const set = SETS[S.setKey], entry = data[S.setKey], ready = !!(entry && entry.list);
  const d = { set, entry, ready, topics: [], days: [], total: 0, lengths: [] };
  if (!ready) return d;
  const list = entry.list;
  if (S.setKey === 'season-recap') {
    const seen = {}; list.forEach((q) => { seen[q.c] = (seen[q.c] || 0) + 1; });
    d.topics = Object.keys(seen).map((t) => ({ v: t, label: t, count: seen[t] }));
  } else {
    const seen = {}; list.forEach((q) => { seen[q.n] = (seen[q.n] || 0) + 1; });
    const order = config.nations.map((n) => n.slug).filter((s) => seen[s]);
    Object.keys(seen).forEach((s) => { if (order.indexOf(s) < 0) order.push(s); });
    d.topics = order.map((s) => ({ v: s, label: (NATIONS[s] && NATIONS[s].name) || s, flag: NATIONS[s] && NATIONS[s].flag, count: seen[s] }));
    if (S.topic !== 'all') {
      const ds = {}; list.filter((q) => q.n === S.topic).forEach((q) => { ds[q.d] = (ds[q.d] || 0) + 1; });
      d.days = Object.keys(ds).map(Number).sort((a, b) => a - b).map((n) => ({ v: String(n), count: ds[n] }));
    }
  }
  if (S.topic !== 'all' && !d.topics.some((t) => t.v === S.topic)) S.topic = 'all';
  if (S.day !== 'all' && !d.days.some((x) => x.v === String(S.day))) S.day = 'all';
  d.total = poolFor(S.setKey, list, S).length;
  d.lengths = lengthOptions(set, d.total);
  if (d.lengths.length && d.lengths.indexOf(S.length) < 0) {
    S.length = d.lengths.filter((n) => n >= (S.length || 0))[0] || d.lengths[d.lengths.length - 1];
    if (!S.length) S.length = d.lengths[0];
    if (!S._explicitLength) S.length = d.lengths[0];
  }
  return d;
}

function estimate(n) {
  const per = S.mode === 'attack' ? Math.min(SETS[S.setKey].secs, 9) : S.mode === 'cards' ? 7 : 10;
  const secs = n * per;
  return secs < 90 ? '~' + secs + 's' : '~' + Math.round(secs / 60) + ' min';
}
function bestLabel() {
  const b = (store.read().best || {})[S.setKey + ':' + S.mode];
  return b || '';
}

function renderSetup() {
  clearTimers(); S.token++;
  const d = derive(), set = d.set;
  const nat = S.setKey === 'nations-story' && NATIONS[S.topic];
  accent(nat ? nat.glow : DEFAULT_RGB);
  syncUrl();

  const collections = Object.keys(SETS).map((k) => {
    const s = SETS[k];
    return `<button type="button" class="tp-coll" data-act="set" data-v="${k}" aria-pressed="${S.setKey === k}">
      <span class="tp-coll-ico">${k === 'season-recap' ? I.attack : svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>')}</span>
      <span><b>${esc(s.title)}</b><small>${esc(s.sub)} · ${config.counts[k] || ''} questions · ${s.options} options</small></span>
      <i class="tp-tick">${I.check}</i></button>`;
  }).join('');

  const modes = Object.keys(MODES).map((k) => {
    const m = MODES[k];
    return `<button type="button" class="tp-mode" data-act="mode" data-v="${k}" aria-pressed="${S.mode === k}">
      <span class="tp-mode-ico">${I[k]}</span><strong>${m.name}</strong><em>${m.blurb}</em><i class="tp-tick">${I.check}</i></button>`;
  }).join('');

  let scope = '';
  if (!d.ready) {
    const err = data[S.setKey] && data[S.setKey].error;
    scope = err
      ? `<div class="tp-inline-err" role="alert"><b>Couldn't load the questions.</b><span>Check your connection and try again.</span><button type="button" class="tv-btn sm" data-act="reload">${I.retry} Try again</button></div>`
      : `<div class="tp-skel" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><p class="tp-loading">Loading questions…</p>`;
  } else {
    const chip = (act, v, on, html) => `<button type="button" class="tp-chip-btn" data-act="${act}" data-v="${esc(v)}" aria-pressed="${on}">${html}</button>`;
    scope += `<section class="tp-block"><h3 class="tp-label"><span>03</span>${set.topicLabel}</h3><div class="tp-chips">` +
      chip('topic', 'all', S.topic === 'all', 'Everything') +
      d.topics.map((t) => chip('topic', t.v, S.topic === t.v, (t.flag ? `<span class="tp-flag">${t.flag}</span>` : '') + esc(t.label) + ` <small>${t.count}</small>`)).join('') +
      '</div></section>';
    if (d.days.length) {
      scope += `<section class="tp-block"><h3 class="tp-label"><span>04</span>Day</h3><div class="tp-chips">` +
        chip('day', 'all', S.day === 'all', 'All days') +
        d.days.map((x) => chip('day', x.v, String(S.day) === x.v, 'Day ' + x.v + ` <small>${x.count}</small>`)).join('') + '</div></section>';
    }
    scope += `<section class="tp-block"><h3 class="tp-label"><span>${d.days.length ? '05' : '04'}</span>Questions</h3><div class="tp-chips">` +
      d.lengths.map((n) => chip('length', String(n), S.length === n, n === d.total ? 'All ' + n : String(n))).join('') + '</div></section>';
  }

  const best = bestLabel();
  const canStart = d.ready && d.total > 0;
  const startLabel = canStart ? 'Start ' + MODES[S.mode].name : (d.ready ? 'No questions here' : 'Loading…');
  const scopeText = S.topic === 'all' ? 'Everything' : ((NATIONS[S.topic] && NATIONS[S.topic].name) || S.topic) + (S.day !== 'all' ? ' · Day ' + S.day : '');

  paint('setup', `
    <header class="tp-head">
      <div>
        <span class="tv-eyebrow"><i class="tv-live"></i>Practice</span>
        <h1 class="tv-h1 tp-title">Build your <span class="tv-grad">round</span></h1>
        <p class="tv-lede">Pick a collection and a mode, then hit Start. Five seconds, no account.</p>
      </div>
      <button type="button" class="tv-btn lg tp-quick" data-act="start" ${canStart ? '' : 'disabled'}>${I.play}<span>${esc(startLabel)}</span></button>
    </header>
    <div class="tp-setup">
      <div class="tp-config">
        <section class="tp-block"><h3 class="tp-label"><span>01</span>Collection</h3><div class="tp-colls">${collections}</div></section>
        <section class="tp-block"><h3 class="tp-label"><span>02</span>Mode</h3><div class="tp-modes">${modes}</div></section>
        ${scope}
      </div>
      <aside class="tp-summary tp-ticket" aria-label="Your game">
        <div class="tp-ticket-main">
          <p class="tp-ticket-kicker"><span>Matchday pass</span><span>FC Mobile Tools</span></p>
          <div class="tp-sum-top"><span class="tp-sum-ico">${nat ? `<span class="tp-flag-xl">${nat.flag}</span>` : I[S.mode]}</span><div><small>Your game</small><h2>${esc(set.title)}</h2></div></div>
          <dl class="tp-sum">
            <div><dt>Mode</dt><dd>${MODES[S.mode].name}</dd></div>
            <div><dt>${set.topicLabel}</dt><dd>${esc(scopeText)}</dd></div>
            <div><dt>Questions</dt><dd>${d.ready ? S.length + ' of ' + d.total : '…'}</dd></div>
            <div><dt>Time</dt><dd>${d.ready ? estimate(S.length) : '…'}</dd></div>
          </dl>
          ${best ? `<p class="tp-best">${I.trophy}<span>Personal best <b>${esc(best)}</b></span></p>` : ''}
        </div>
        <div class="tp-perf" aria-hidden="true"></div>
        <div class="tp-ticket-stub">
          <button type="button" class="tv-btn lg ${canStart ? 'pulse' : ''} tp-start" data-act="start" data-focus ${canStart ? '' : 'disabled'}>${I.play}<span>${esc(startLabel)}</span></button>
          <p class="tp-keyhint"><span class="tp-kb"><kbd>Enter</kbd> to start · </span><a href="${set.answersUrl}">Browse the answers instead</a></p>
        </div>
      </aside>
    </div>`);
}

/* ---------- GAME -------------------------------------------------------- */
function resetRound() {
  S.i = 0; S.score = 0; S.streak = 0; S.bestStreak = 0; S.right = 0; S.missed = []; S.known = []; S.marks = [];
  S.locked = false; S.flipped = false; S.answered = 0; S.started = Date.now();
}
function start(only) {
  const entry = data[S.setKey];
  if (!entry || !entry.list) return;
  let rounds;
  if (only) rounds = shuffle(only).map((r) => reshuffle(r));
  else {
    const pool = poolFor(S.setKey, entry.list, S);
    if (!pool.length) return;
    rounds = shuffle(pool).slice(0, S.length || pool.length).map((q) => toRound(S.setKey, q, entry.pools));
  }
  clearTimers(); S.token++;
  S.rounds = rounds; resetRound();
  const nat = S.setKey === 'nations-story' && NATIONS[S.topic];
  accent(nat ? nat.glow : DEFAULT_RGB);
  if (S.mode === 'attack' && !only) countdown(); else renderQuestion();
  bringIntoView();
}
function countdown() {
  let n = 3;
  paint('countdown', `<div class="tp-321"><small>${MODES.attack.name}</small><b id="tp-n" class="pop">3</b><span>Get ready</span><button type="button" class="tv-btn ghost sm" data-act="setup" data-focus>Cancel</button></div>`);
  timers.countdown = setInterval(() => {
    n--;
    if (n <= 0) { clearInterval(timers.countdown); timers.countdown = 0; renderQuestion(); return; }
    const el = root.querySelector('#tp-n');
    if (el) { el.textContent = String(n); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }, 700);
}

function stepsHTML() {
  const n = S.rounds.length;
  if (n > 30) return `<div class="tp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${S.i}"><i style="width:${(S.i / n) * 100}%"></i></div>`;
  return `<div class="tp-steps" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${S.i}">` +
    S.rounds.map((_, k) => `<i class="${S.marks[k] || ''}${k === S.i ? ' now' : ''}"></i>`).join('') + '</div>';
}

function renderQuestion() {
  clearTimers();
  const r = S.rounds[S.i], total = S.rounds.length, set = SETS[S.setKey], cards = S.mode === 'cards';
  S.locked = false; S.flipped = false; S.token++;
  const auto = prefs().auto;

  const stats = cards
    ? `<div class="tp-stat"><small>Known</small><b>${S.known.length}</b></div>`
    : `<div class="tp-stat"><small>Score</small><b id="tp-score">${S.score}</b></div>
       <div class="tp-stat tp-streak ${S.streak > 1 ? 'on' : ''}" id="tp-streak-box"><small>Streak</small><b>${I.flame}<span id="tp-streak">${S.streak}</span></b></div>`;
  const timer = S.mode === 'attack'
    ? `<div class="tp-timer" id="tp-timer" role="timer"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="19"/><circle class="fg" id="tp-ring" cx="22" cy="22" r="19" stroke-dasharray="119.4" stroke-dashoffset="0"/></svg><b id="tp-t">${set.secs}</b></div>`
    : '';

  let body;
  if (cards) {
    body = `<div class="tp-flipwrap"><button type="button" class="tp-flip" id="tp-flip" data-act="flip" aria-pressed="false" aria-label="Flip card to reveal the answer">
        <span class="tp-face front"><small>Question</small><span class="tp-ftext">${esc(r.q)}</span><em>${I.tap} Tap the card or press Space</em></span>
        <span class="tp-face back"><small>Answer</small><span class="tp-ftext">${esc(r.answerText)}</span><em>How did you do?</em></span></button></div>
      <div class="tp-grade"><button type="button" class="tv-btn ghost" data-act="learn" disabled>${I.retry}<span>Still learning</span><kbd>1</kbd></button>
        <button type="button" class="tv-btn" data-act="know" disabled>${I.check}<span>Got it</span><kbd>2</kbd></button></div>`;
  } else {
    body = `<h2 class="tp-qtext" id="tp-qtext">${esc(r.q)}</h2>
      <div class="tp-opts ${r.options.length === 2 ? 'two' : ''}" role="group" aria-labelledby="tp-qtext">${r.options.map((o, n) =>
        `<button type="button" class="tp-opt" data-act="pick" data-i="${n}"><span class="tp-key">${String.fromCharCode(65 + n)}</span><span class="tp-otext">${esc(o)}</span><i class="tp-mark"></i></button>`).join('')}</div>
      <div class="tp-fb" id="tp-fb" aria-live="polite"></div>`;
  }

  const last = S.i + 1 === total;
  const actions = cards ? '' : `<div class="tp-actions">
      <button type="button" class="tv-btn ghost sm" data-act="quit" id="tp-quit">${I.back}<span>End game</span></button>
      ${S.mode === 'quiz' ? `<label class="tp-switch"><input type="checkbox" data-act="auto" ${auto ? 'checked' : ''}><span class="tp-sw" aria-hidden="true"></span><span>Auto-advance</span></label>` : '<span></span>'}
      <button type="button" class="tv-btn" data-act="next" id="tp-next" disabled><span>${last ? 'See results' : 'Next question'}</span>${I.arrow}</button></div>`;
  const cardsActions = cards ? `<div class="tp-actions"><button type="button" class="tv-btn ghost sm" data-act="quit" id="tp-quit">${I.back}<span>End game</span></button><span></span><span></span></div>` : '';

  paint('play', `
    <div class="tp-game" data-mode="${S.mode}">
      <div class="tp-hud"><div class="tp-hud-main"><span class="tp-pill">${I[S.mode]}${MODES[S.mode].name}</span><span class="tp-tag">${esc(r.tag)}</span></div>
        <div class="tp-stats">${stats}${timer}</div></div>
      ${stepsHTML()}
      <article class="tp-card tp-q" tabindex="-1" data-focus data-n="${String(S.i + 1).padStart(2, '0')}">
        <p class="tp-count">${cards ? 'Card' : 'Question'} <b>${S.i + 1}</b> of ${total}</p>
        ${body}
      </article>
      ${actions}${cardsActions}
    </div>`, 'tp-enter');

  if (S.mode === 'attack') startTimer();
}

/* Time Attack clock: rAF-driven, pauses while the tab is hidden. */
function startTimer() {
  const secs = SETS[S.setKey].secs, C = 119.4;
  S.t0 = performance.now(); S.hiddenAt = 0;
  const ring = root.querySelector('#tp-ring'), label = root.querySelector('#tp-t'), box = root.querySelector('#tp-timer');
  const token = S.token;
  const frame = () => {
    if (token !== S.token || S.locked) return;
    if (document.hidden) { timers.raf = requestAnimationFrame(frame); return; }
    const left = Math.max(0, secs - (performance.now() - S.t0) / 1000);
    if (ring) ring.style.strokeDashoffset = String(C * (1 - left / secs));
    if (label) label.textContent = String(Math.ceil(left));
    if (box) box.classList.toggle('low', left <= 4);
    if (left <= 0) { answer(-1); return; }
    timers.raf = requestAnimationFrame(frame);
  };
  timers.raf = requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  if (S.screen !== 'play' || S.mode !== 'attack' || S.locked) return;
  if (document.hidden) S.hiddenAt = performance.now();
  else if (S.hiddenAt) { S.t0 += performance.now() - S.hiddenAt; S.hiddenAt = 0; }
});

function answer(i) {
  if (S.locked || S.screen !== 'play') return;
  const r = S.rounds[S.i], set = SETS[S.setKey];
  S.locked = true; S.answered++;
  cancelAnimationFrame(timers.raf);
  const good = i === r.ci;
  let gain = 0, bonus = 0;
  if (good) {
    S.right++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    const left = S.mode === 'attack' ? Math.max(0, set.secs - (performance.now() - S.t0) / 1000) : 0;
    gain = pointsFor({ mode: S.mode, secsLeft: left, secs: set.secs, streak: S.streak });
    bonus = gain - 100; S.score += gain; S.marks[S.i] = 'ok'; buzz(12);
  } else { S.streak = 0; S.missed.push(r); S.marks[S.i] = 'bad'; buzz([24, 50, 24]); }

  root.querySelectorAll('.tp-opt').forEach((b, n) => {
    b.disabled = true;
    if (n === r.ci) b.classList.add('ok'); else if (n === i) b.classList.add('bad'); else b.classList.add('dim');
  });
  const last = S.i + 1 === S.rounds.length;
  const auto = S.mode === 'attack' || prefs().auto;
  const ms = DELAY[S.mode][good ? 'good' : 'bad'];
  const title = good ? (gain > 100 ? 'Correct +' + gain : 'Correct +100') : i < 0 ? "Time's up" : 'Not quite';
  const detail = good
    ? (bonus > 0 ? 'Speed and streak bonus +' + bonus : S.streak > 2 ? S.streak + ' in a row' : 'Nice one')
    : 'Correct answer: <b>' + esc(r.answerText) + '</b>';
  const fb = root.querySelector('#tp-fb');
  if (fb) {
    fb.innerHTML = `<div class="tp-verdict ${good ? 'good' : 'bad'}"><span class="tp-verdict-ico">${good ? I.check : I.x}</span>
      <div><strong>${title}</strong><small>${detail}</small></div>
      <a class="tp-more" href="${esc(r.link)}" target="_blank" rel="noopener">See in answers ${I.ext}</a></div>
      <div class="tp-auto" id="tp-auto" ${auto ? '' : 'hidden'}><i style="animation-duration:${ms}ms"></i><span>${last ? 'Results' : 'Next question'} in a moment. Tap <b>Next</b> to skip.</span></div>`;
  }
  const sc = root.querySelector('#tp-score'); if (sc) { sc.textContent = String(S.score); sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump'); }
  const sk = root.querySelector('#tp-streak'); if (sk) sk.textContent = String(S.streak);
  const sb = root.querySelector('#tp-streak-box'); if (sb) sb.classList.toggle('on', S.streak > 1);
  const card = root.querySelector('.tp-q'); if (card) card.classList.add(good ? 'is-good' : 'is-bad');
  const steps = root.querySelector('.tp-steps'); if (steps) steps.outerHTML = stepsHTML();
  const next = root.querySelector('#tp-next'); if (next) {
    next.disabled = false; next.focus({ preventScroll: true });
    const r = next.getBoundingClientRect();
    if (r.bottom > innerHeight - 12) next.scrollIntoView({ block: 'end', behavior: reduce ? 'auto' : 'smooth' });
  }
  if (auto) {
    const token = S.token;
    timers.advance = setTimeout(() => { if (token === S.token && S.locked && S.screen === 'play') next_(); }, ms);
  }
}
function next_() {
  clearTimeout(timers.advance); timers.advance = 0;
  if (S.i + 1 >= S.rounds.length) return results();
  S.i++; renderQuestion(); bringIntoView();
}
function setAuto(on) {
  const db = store.read(); db.prefs = Object.assign({}, db.prefs, { auto: on }); store.write(db);
  if (!S.locked || S.mode !== 'quiz') return;
  const bar = root.querySelector('#tp-auto');
  clearTimeout(timers.advance); timers.advance = 0;
  if (bar) bar.hidden = !on;
  if (on) {
    const good = root.querySelector('.tp-verdict.good'), ms = DELAY.quiz[good ? 'good' : 'bad'], token = S.token;
    if (bar) { const bi = bar.querySelector('i'); bi.style.animation = 'none'; void bi.offsetWidth; bi.style.animation = ''; bi.style.animationDuration = ms + 'ms'; }
    timers.advance = setTimeout(() => { if (token === S.token && S.locked) next_(); }, ms);
  }
}
function flip() {
  const card = root.querySelector('#tp-flip'); if (!card) return;
  S.flipped = !S.flipped;
  card.classList.toggle('flipped', S.flipped);
  card.setAttribute('aria-pressed', String(S.flipped));
  root.querySelectorAll('.tp-grade button').forEach((b) => { b.disabled = !S.flipped; });
  if (S.flipped) { const k = root.querySelector('[data-act="know"]'); if (k) k.focus({ preventScroll: true }); }
}
function grade(known) {
  if (!S.flipped) return;
  const r = S.rounds[S.i];
  if (known) { S.known.push(r); S.marks[S.i] = 'ok'; buzz(10); } else { S.missed.push(r); S.marks[S.i] = 'learn'; }
  S.answered++;
  next_();
}
function quit() {
  const btn = root.querySelector('#tp-quit');
  if (btn && !btn.dataset.sure) {
    btn.dataset.sure = '1'; btn.classList.add('danger'); btn.querySelector('span').textContent = 'Tap again to end';
    timers.quit = setTimeout(() => { btn.dataset.sure = ''; btn.classList.remove('danger'); const s = btn.querySelector('span'); if (s) s.textContent = 'End game'; }, 3200);
    return;
  }
  clearTimers(); S.token++;
  if (S.answered > 0) { S.rounds = S.rounds.slice(0, S.i + (S.locked ? 1 : 0)); results(); } else renderSetup();
}

/* ---------- RESULTS ----------------------------------------------------- */
function results() {
  clearTimers(); S.token++;
  const cards = S.mode === 'cards', n = Math.max(1, S.rounds.length);
  const hit = cards ? S.known.length : S.right;
  const pct = Math.round((hit / n) * 100);
  const key = S.setKey + ':' + S.mode;
  const db = store.read(); db.best = db.best || {}; db.stats = db.stats || { played: 0, answered: 0, correct: 0, bestStreak: 0 };
  const metric = S.mode === 'attack' ? S.score : pct;
  const label = S.mode === 'attack' ? S.score + ' pts' : pct + '%';
  const prev = db.best[key] ? parseInt(db.best[key], 10) : -1;
  const record = n >= 5 && metric > prev;
  if (record) db.best[key] = label;
  db.stats.played++; db.stats.answered += S.rounds.length; db.stats.correct += hit; db.stats.bestStreak = Math.max(db.stats.bestStreak, S.bestStreak);
  store.write(db);
  S.last = { label, pct, hit, n };

  const g = gradeFor(pct);
  const wrong = S.missed;
  const secs = Math.max(1, Math.round((Date.now() - S.started) / 1000));
  const time = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
  const kpis = [
    S.mode === 'attack' ? `<div><b>${S.score}</b><span>Points</span></div>` : '',
    `<div><b>${hit}<em>/${n}</em></b><span>${cards ? 'Known' : 'Correct'}</span></div>`,
    cards ? '' : `<div><b>${S.bestStreak}</b><span>Best streak</span></div>`,
    `<div><b>${time}</b><span>Time</span></div>`
  ].join('');

  paint('results', `
    <div class="tp-results">
      <div class="tp-res-hero">
        <div class="tp-ring" style="--p:${pct}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52"/></svg>
          <div><b>${pct}<i>%</i></b><small>${hit} of ${n}</small></div></div>
        <div class="tp-res-copy">
          <span class="tv-eyebrow">${I[S.mode]} ${MODES[S.mode].name} · ${esc(SETS[S.setKey].title)}</span>
          <h1 class="tv-h1 tp-res-title">${esc(g.title)}</h1>
          <p class="tv-lede">${esc(g.note)}</p>
          ${record ? `<div class="tp-record">${I.trophy}<span>New personal best: <b>${esc(label)}</b></span></div>` : ''}
          <div class="tp-kpis">${kpis}</div>
          <div class="tv-actions tp-res-actions">
            <button type="button" class="tv-btn lg" data-act="again" data-focus>${I.retry}<span>Play again</span></button>
            ${wrong.length ? `<button type="button" class="tv-btn ghost lg" data-act="retry">${cards ? 'Revisit' : 'Retry'} ${wrong.length} missed</button>` : ''}
          </div>
          <div class="tp-res-links">
            <button type="button" class="tp-link" data-act="setup">Change settings</button>
            <button type="button" class="tp-link" data-act="share">${I.share}<span>Share score</span></button>
            <a class="tp-link" href="${SETS[S.setKey].answersUrl}">Browse answers</a>
          </div>
        </div>
      </div>
      <section class="tp-review">
        <h2 class="tp-label">${wrong.length ? (cards ? 'To revisit' : 'Review what you missed') : 'Review'}</h2>
        ${wrong.length ? wrong.map((r) => `<a class="tp-miss" href="${esc(r.link)}" target="_blank" rel="noopener"><span>${esc(r.q)}</span><em>${esc(r.answerText)}</em>${I.ext}</a>`).join('') : `<p class="tp-perfect">${I.check} Flawless. Nothing to review.</p>`}
      </section>
      <canvas class="tp-confetti" aria-hidden="true"></canvas>
    </div>`, 'tp-enter');
  bringIntoView();
  if (!reduce && (pct >= 80 || record)) confetti(root.querySelector('.tp-confetti'));
}

function confetti(canvas) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d'), box = canvas.parentElement.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = box.width * dpr; canvas.height = Math.min(box.height, 640) * dpr;
  canvas.style.height = Math.min(box.height, 640) + 'px';
  const colors = ['#e9c46a', '#f6dd9b', '#fff6dc', '#3fd89a', '#ffffff'];
  const parts = Array.from({ length: 110 }, () => ({
    x: canvas.width * (0.15 + Math.random() * 0.7), y: canvas.height * 0.28, r: (3 + Math.random() * 5) * dpr,
    vx: (Math.random() - 0.5) * 11 * dpr, vy: (-6 - Math.random() * 9) * dpr, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0], life: 0
  }));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      p.vy += 0.34 * dpr; p.x += p.vx; p.y += p.vy; p.a += p.va; p.vx *= 0.992; p.life++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.max(0, 1 - p.life / 150);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 3, p.r, p.r * 0.6); ctx.restore();
    });
    if (++frame < 160 && root.contains(canvas)) requestAnimationFrame(tick); else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

async function share(btn) {
  const l = S.last || {}, set = SETS[S.setKey];
  const url = location.origin + '/trivia/play/?set=' + S.setKey + '&mode=' + S.mode;
  const text = `I scored ${l.hit}/${l.n} (${l.pct}%) in ${MODES[S.mode].name} on ${set.title}, FC Mobile Trivia. Beat me:`;
  try {
    if (navigator.share) { await navigator.share({ title: 'FC Mobile Trivia', text, url }); return; }
    await navigator.clipboard.writeText(text + ' ' + url);
    const s = btn.querySelector('span'); const old = s.textContent; s.textContent = 'Copied!';
    setTimeout(() => { s.textContent = old; }, 1600);
  } catch (e) { /* user cancelled the share sheet */ }
}

/* ---------- events ------------------------------------------------------ */
function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled || t.tagName === 'INPUT') return;
  const a = t.dataset.act, v = t.dataset.v;
  if (a === 'set') { S.setKey = v; S.topic = 'all'; S.day = 'all'; S._explicitLength = false; S.length = 0; renderSetup(); load(v).then(() => { if (S.screen === 'setup' && S.setKey === v) renderSetup(); }).catch(() => { if (S.screen === 'setup') renderSetup(); }); }
  else if (a === 'mode') { S.mode = v; renderSetup(); }
  else if (a === 'topic') { S.topic = v; S.day = 'all'; renderSetup(); }
  else if (a === 'day') { S.day = v; renderSetup(); }
  else if (a === 'length') { S.length = Number(v); S._explicitLength = true; renderSetup(); }
  else if (a === 'reload') { delete data[S.setKey]; renderSetup(); load(S.setKey).then(() => renderSetup()).catch(() => renderSetup()); }
  else if (a === 'start') start();
  else if (a === 'pick') answer(Number(t.dataset.i));
  else if (a === 'next') next_();
  else if (a === 'flip') flip();
  else if (a === 'know') grade(true);
  else if (a === 'learn') grade(false);
  else if (a === 'quit') quit();
  else if (a === 'setup') renderSetup();
  else if (a === 'again') start();
  else if (a === 'retry') start(S.missed.slice());
  else if (a === 'share') share(t);
}
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const onButton = !!(e.target && e.target.closest && e.target.closest('button, a, input, label'));
  if (S.screen === 'setup') {
    if (e.key === 'Enter' && !onButton) { e.preventDefault(); start(); }
    return;
  }
  if (S.screen === 'results') { if (e.key === 'Enter' && !onButton) { e.preventDefault(); start(); } return; }
  if (S.screen !== 'play') return;
  if (S.mode === 'cards') {
    if ((e.key === ' ' || e.key === 'Enter') && !onButton) { e.preventDefault(); flip(); }
    else if (S.flipped && (e.key === '1' || e.key === 'ArrowLeft')) { e.preventDefault(); grade(false); }
    else if (S.flipped && (e.key === '2' || e.key === 'ArrowRight')) { e.preventDefault(); grade(true); }
    return;
  }
  const r = S.rounds[S.i];
  if (!S.locked) {
    const idx = /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : /^[a-dA-D]$/.test(e.key) ? e.key.toLowerCase().charCodeAt(0) - 97 : -1;
    if (idx >= 0 && idx < r.options.length) { e.preventDefault(); answer(idx); }
  } else if ((e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') && !onButton) { e.preventDefault(); next_(); }
}

/* ---------- boot -------------------------------------------------------- */
function boot() {
  root.addEventListener('click', onClick);
  root.addEventListener('change', (e) => { const t = e.target; if (t && t.dataset && t.dataset.act === 'auto') setAuto(t.checked); });
  document.addEventListener('keydown', onKey);

  const help = document.getElementById('tp-boot-help');
  const helpTimer = setTimeout(() => { if (help) help.hidden = false; }, 6000);

  const p = readParams(location.search);
  S.setKey = p.set; S.mode = p.mode; S.topic = p.topic; S.day = p.day;
  if (p.length) { S.length = p.length; S._explicitLength = true; }

  load(S.setKey).then(() => {
    clearTimeout(helpTimer);
    renderSetup();
    const other = S.setKey === 'season-recap' ? 'nations-story' : 'season-recap';
    setTimeout(() => { load(other).catch(() => {}); }, 900);
  }).catch((error) => {
    clearTimeout(helpTimer);
    console.error('[Trivia] Could not load questions:', error);
    renderSetup();
  });
}

if (root) boot();
