import { PLAYSTYLES } from '../data/playstyles.js';
import {
  PLAYSTYLE_AXES,
  PLAYSTYLE_PROFILE,
  describePair,
  decodeBuild,
  encodeBuild,
  fitLabel,
  getPlaystyleByName,
  getPlaystylePosition,
  getPlaystyleQuestions,
  scorePlaystyles
} from '../data/playstyleFinder.js';

(() => {
  const root = document.getElementById('psfRoot');
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover)').matches;
  const HISTORY_KEY = 'fcmt-psf-history-v2';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduce ? 0 : ms));
  const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

  const el = {
    builder: $('psfBuilder'), stage: $('psfStage'), pips: $('psfPips'), stepLabel: $('psfStepLabel'), stepHint: $('psfStepHint'),
    panelPosition: $('psfPanelPosition'), panelQuestion: $('psfPanelQuestion'), back: $('psfBack'), next: $('psfNext'), nextLabel: $('psfNextLabel'),
    status: $('psfStatus'), analyzing: $('psfAnalyzing'), analyzingLine: $('psfAnalyzingLine'), pitchNote: $('psfPitchNote'),
    liveTitle: $('psfLiveTitle'), liveSub: $('psfLiveSub'), liveRadar: $('psfLiveRadar'), lean: $('psfLean'), signal: $('psfSignal'), restart: $('psfRestart'),
    recent: $('psfRecent'), recentList: $('psfRecentList'), results: $('psfResults'), toast: $('psfToast'), constellation: $('psfConstellation')
  };

  const iconFor = (style, level) => {
    const tier = style.noBaseIcon ? (level === 3 ? 2 : 1) : level - 1;
    return '/assets/images/playstyle/playstyle_64_PLAYSTYLE_' + style.icon + '_' + tier + '.png';
  };

  /* ---------- Shared SVG gradients (referenced by CSS) ---------- */
  const defs = document.createElementNS(SVG_NS, 'svg');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.position = 'absolute';
  defs.innerHTML =
    '<defs>' +
    '<linearGradient id="psfCyan" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc9ff"/><stop offset="1" stop-color="#9a8cff"/></linearGradient>' +
    '<linearGradient id="psfGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6c453"/><stop offset="1" stop-color="#fff0c2"/></linearGradient>' +
    '<radialGradient id="psfRadarFill" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#4cc9ff" stop-opacity=".5"/><stop offset="1" stop-color="#9a8cff" stop-opacity=".18"/></radialGradient>' +
    '</defs>';
  root.prepend(defs);

  /* ---------- Toast ---------- */
  let toastTimer = 0;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('on'), 2300);
  }

  /* ---------- Radar ---------- */
  const AXIS_COUNT = PLAYSTYLE_AXES.length;
  const polar = (index, radius, cx, cy) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / AXIS_COUNT;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };

  class Radar {
    constructor(host) {
      this.values = new Array(AXIS_COUNT).fill(0.14);
      this.frame = 0;
      const cx = 100, cy = 100, r = 68;
      let markup = '<svg viewBox="-16 -2 232 204" role="img" aria-label="Your play shape across pace, skill, shooting, creation, defending and physical">';
      [1 / 3, 2 / 3, 1].forEach((k) => {
        markup += '<polygon class="psf-radar-ring" points="' + PLAYSTYLE_AXES.map((_, i) => polar(i, r * k, cx, cy).join(',')).join(' ') + '"/>';
      });
      PLAYSTYLE_AXES.forEach((axis, i) => {
        const [x, y] = polar(i, r, cx, cy);
        markup += '<line class="psf-radar-axis" x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '"/>';
        const [lx, ly] = polar(i, r + 17, cx, cy);
        markup += '<text class="psf-radar-text" x="' + lx + '" y="' + (ly + 3) + '">' + esc(axis.label) + '</text>';
      });
      markup += '<polygon class="psf-radar-area" points=""/>';
      PLAYSTYLE_AXES.forEach(() => { markup += '<circle class="psf-radar-dot" r="2.6" cx="100" cy="100"/>'; });
      markup += '</svg>';
      host.innerHTML = markup;
      this.area = host.querySelector('.psf-radar-area');
      this.dots = Array.from(host.querySelectorAll('.psf-radar-dot'));
      this.cx = cx; this.cy = cy; this.r = r;
      this.draw(this.values);
    }
    draw(values) {
      const points = values.map((v, i) => polar(i, this.r * v, this.cx, this.cy));
      this.area.setAttribute('points', points.map((p) => p.join(',')).join(' '));
      points.forEach((p, i) => { this.dots[i].setAttribute('cx', p[0]); this.dots[i].setAttribute('cy', p[1]); });
    }
    set(target, duration = 700) {
      cancelAnimationFrame(this.frame);
      if (reduce) { this.values = target.slice(); this.draw(this.values); return; }
      const from = this.values.slice();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        this.values = from.map((v, i) => v + (target[i] - v) * eased);
        this.draw(this.values);
        if (t < 1) this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }
  }

  const liveRadar = new Radar(el.liveRadar);
  let resultRadar = null;

  /* ---------- State ---------- */
  const state = { step: 0, position: '', answers: {}, busy: false, res: null };
  const questions = () => (state.position ? getPlaystyleQuestions(state.position) : []);

  /* ---------- Rendering: builder ---------- */
  function renderPips() {
    const total = (state.position ? questions().length : 5) + 1;
    el.pips.innerHTML = Array.from({ length: total }, (_, i) => '<span class="psf-pip' + (i < state.step ? ' is-done' : i === state.step ? ' is-active' : '') + '"></span>').join('');
  }

  function currentAnswered() {
    if (state.step === 0) return Boolean(state.position);
    const q = questions()[state.step - 1];
    return Boolean(q && state.answers[q.id]);
  }

  function renderQuestion(direction) {
    const qs = questions();
    const q = qs[state.step - 1];
    if (!q) return;
    const panel = el.panelQuestion;
    panel.innerHTML =
      '<span class="psf-q-kicker">' + esc(q.kicker) + ' &middot; Question ' + state.step + ' of ' + qs.length + '</span>' +
      '<h2 class="psf-q-title" tabindex="-1">' + esc(q.prompt) + '</h2>' +
      '<p class="psf-q-hint">' + esc(q.hint) + '</p>' +
      '<div class="psf-opts" role="group" aria-label="' + esc(q.prompt) + '">' +
      q.options.map((option, i) =>
        '<button type="button" class="psf-opt' + (state.answers[q.id] === option.id ? ' is-active' : '') + '" data-option="' + option.id + '" aria-pressed="' + (state.answers[q.id] === option.id) + '" style="--i:' + i + '">' +
        '<span class="psf-opt-letter">' + (i + 1) + '</span><span class="psf-opt-label">' + esc(option.label) + '</span><span class="psf-opt-check" aria-hidden="true">&#10003;</span></button>'
      ).join('') + '</div>';
    animatePanel(panel, direction);
  }

  function animatePanel(panel, direction) {
    panel.classList.remove('psf-enter-fwd', 'psf-enter-back');
    void panel.offsetWidth;
    panel.classList.add(direction < 0 ? 'psf-enter-back' : 'psf-enter-fwd');
  }

  function renderStage(direction = 1, { focus = false } = {}) {
    const onPosition = state.step === 0;
    el.panelPosition.hidden = !onPosition;
    el.panelQuestion.hidden = onPosition;
    if (onPosition) animatePanel(el.panelPosition, direction);
    else renderQuestion(direction);

    renderPips();
    const qs = questions();
    const q = qs[state.step - 1];
    el.stepLabel.innerHTML = onPosition ? '<b>Step 1</b> / Position' : '<b>Step ' + (state.step + 1) + '</b> / ' + esc(q.kicker);
    el.stepHint.textContent = onPosition ? 'Takes about 40 seconds' : (qs.length - state.step) + (qs.length - state.step === 1 ? ' tap' : ' taps') + ' to go';
    el.back.hidden = onPosition;
    const last = !onPosition && state.step === qs.length;
    el.nextLabel.textContent = last ? 'Reveal my PlayStyles' : 'Continue';
    el.next.disabled = !currentAnswered();
    el.status.textContent = onPosition
      ? (state.position ? 'Position locked in. Continue when you are ready.' : 'Pick a position to wake the analyzer.')
      : (currentAnswered() ? 'Got it. Continue, or tap a different answer to change it.' : 'Choose the answer that sounds most like you.');
    if (focus && !onPosition) {
      const heading = el.panelQuestion.querySelector('.psf-q-title');
      if (heading) heading.focus({ preventScroll: true });
    }
    renderLive();
  }

  /* ---------- Live analyzer ---------- */
  const leanRows = new Map();
  function renderLive() {
    const position = state.position ? getPlaystylePosition(state.position) : null;
    if (!position) {
      el.liveTitle.textContent = 'Waiting for a position';
      el.liveSub.textContent = 'Pick a position and answer to watch the read sharpen in real time.';
      liveRadar.set(new Array(AXIS_COUNT).fill(0.14));
      renderLean([]);
      renderSignal(0, 1);
      return;
    }
    const result = scorePlaystyles(state.position, state.answers);
    renderSignal(result.answeredCount, result.totalQuestions);
    liveRadar.set(result.dna.map((item) => item.value));
    if (result.archetype && result.answeredCount > 0) {
      el.liveTitle.textContent = 'The ' + result.archetype.title;
      el.liveSub.textContent = result.answeredCount < 2 ? 'Early read: ' + lower(result.archetype.tagline) : result.archetype.tagline;
    } else {
      el.liveTitle.textContent = position.label + ' (' + position.code + ')';
      el.liveSub.textContent = 'Answer the first scenario to start the read.';
    }
    renderLean(result.answeredCount ? result.ranked.filter((item) => item.score > 0).slice(0, 3) : []);
  }

  function renderSignal(done, total) {
    const lit = total ? Math.ceil((done / total) * 4) : 0;
    Array.from(el.signal.children).forEach((bar, i) => bar.classList.toggle('on', i < lit));
  }

  function renderLean(items) {
    const empty = el.lean.querySelector('.psf-lean-empty');
    if (!items.length) {
      leanRows.forEach((row) => row.remove());
      leanRows.clear();
      if (!empty) el.lean.innerHTML = '<p class="psf-lean-empty">Your top three PlayStyles appear here and re-rank after every answer.</p>';
      return;
    }
    if (empty) empty.remove();
    const keep = new Set(items.map((item) => item.name));
    leanRows.forEach((row, name) => { if (!keep.has(name)) { row.remove(); leanRows.delete(name); } });
    items.forEach((item, rank) => {
      let row = leanRows.get(item.name);
      const fresh = !row;
      if (!row) {
        row = document.createElement('div');
        row.className = 'psf-lean-row';
        row.innerHTML = '<img alt="" width="36" height="36" src="' + iconFor(item, 2) + '"><div class="psf-lean-name"><b>' + esc(item.name) + '</b><span class="psf-lean-bar"><i></i></span></div><span class="psf-lean-pct"></span>';
        row.style.transform = 'translateY(' + rank * 64 + 'px)';
        el.lean.append(row);
        leanRows.set(item.name, row);
      }
      row.classList.toggle('is-top', rank === 0);
      row.style.transform = 'translateY(' + rank * 64 + 'px)';
      row.querySelector('.psf-lean-pct').textContent = item.fit + '%';
      const bar = row.querySelector('.psf-lean-bar i');
      if (fresh && !reduce) requestAnimationFrame(() => { bar.style.width = item.fit + '%'; });
      else bar.style.width = item.fit + '%';
    });
  }

  /* ---------- Navigation ---------- */
  function go(step, direction, opts) {
    state.step = step;
    renderStage(direction, opts);
  }

  async function advance() {
    if (state.busy || !currentAnswered()) return;
    const qs = questions();
    if (state.step < qs.length) {
      go(state.step + 1, 1, { focus: true });
      return;
    }
    await runAnalysis();
  }

  async function chooseOption(optionId) {
    if (state.busy) return;
    const q = questions()[state.step - 1];
    if (!q || !q.options.some((option) => option.id === optionId)) return;
    state.answers[q.id] = optionId;
    el.panelQuestion.querySelectorAll('.psf-opt').forEach((button) => {
      const active = button.dataset.option === optionId;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    el.next.disabled = false;
    el.status.textContent = 'Got it. Moving on...';
    renderLive();
    state.busy = true;
    el.panelQuestion.querySelector('.psf-opts')?.classList.add('is-locked');
    await wait(360);
    state.busy = false;
    await advance();
  }

  async function choosePosition(code) {
    if (state.busy) return;
    if (code !== state.position) { state.position = code; state.answers = {}; }
    root.querySelectorAll('[data-position]').forEach((button) => {
      const active = button.dataset.position === code;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const info = getPlaystylePosition(code);
    el.pitchNote.textContent = 'Selected: ' + info.label + ' (' + info.code + ')';
    el.next.disabled = false;
    renderLive();
    renderPips();
    state.busy = true;
    await wait(420);
    state.busy = false;
    go(1, 1, { focus: true });
  }

  async function runAnalysis() {
    state.busy = true;
    el.analyzing.hidden = false;
    const lines = ['Mapping your position...', 'Weighing all 22 PlayStyles...', 'Checking what the community runs...', 'Resolving your best pair...'];
    for (const line of lines) {
      el.analyzingLine.textContent = line;
      await wait(430);
    }
    el.analyzing.hidden = true;
    state.busy = false;
    showResults(true);
  }

  /* ---------- History ---------- */
  function readHistory() {
    try {
      const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(list) ? list.filter((item) => item && decodeBuild(item.enc)) : [];
    } catch { return []; }
  }
  function saveHistory(res) {
    try {
      const enc = encodeBuild(res.position.code, state.answers);
      const entry = { enc, title: res.archetype ? res.archetype.title : res.position.label, names: res.picks.map((p) => p.name), ts: Date.now() };
      const list = [entry, ...readHistory().filter((item) => item.enc !== enc)].slice(0, 4);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch { /* storage unavailable, history is optional */ }
  }
  function ago(ts) {
    const minutes = Math.max(1, Math.round((Date.now() - ts) / 60000));
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + ' h ago';
    return Math.round(hours / 24) + ' d ago';
  }
  function renderRecent() {
    const list = readHistory();
    el.recent.hidden = !list.length || !el.results.hidden;
    el.recentList.innerHTML = list.map((item) => {
      const style = getPlaystyleByName(item.names[0]);
      return '<button type="button" class="psf-recent-item" data-recent="' + esc(item.enc) + '">' +
        (style ? '<img alt="" width="34" height="34" src="' + iconFor(style, 2) + '">' : '') +
        '<span style="margin:0"><b>' + esc(item.title) + '</b><span>' + esc(item.names.join(' + ')) + ' &middot; ' + ago(item.ts) + '</span></span></button>';
    }).join('');
  }

  /* ---------- Results ---------- */
  function buildResult() {
    const scored = scorePlaystyles(state.position, state.answers);
    return { ...scored, picks: scored.picks.slice(), alternates: scored.alternates.slice() };
  }

  function evidenceHtml(pick) {
    return pick.evidence.map((item) => '<li><span><em>' + esc(item.kicker) + '</em>' + esc(cap(item.text)) + '</span></li>').join('');
  }

  function cardHtml(pick, index, single) {
    const main = index === 0;
    const badges = [];
    if (pick.isMeta) badges.push('<span class="psf-badge">Community pick</span>');
    badges.push(pick.fitsPosition ? '<span class="psf-badge alt">Fits ' + esc(state.res.position.code) + '</span>' : '<span class="psf-badge alt">Off-role pick</span>');
    return '<article class="psf-card' + (main ? ' is-main' : '') + '" data-card="' + index + '" style="--i:' + index + '">' +
      '<div class="psf-card-top"><span class="psf-ribbon">' + (single ? 'Best fit' : main ? 'Best fit' : 'Partner pick') + '</span><div class="psf-badges">' + badges.join('') + '</div></div>' +
      '<div class="psf-card-head">' +
        '<div class="psf-icon-wrap"><img class="psf-icon" data-icon width="112" height="112" src="' + iconFor(pick, 1) + '" alt="' + esc(pick.name) + ' PlayStyle icon"></div>' +
        '<div class="psf-name-block"><div class="psf-cat">' + esc(pick.category) + '</div><h3 class="psf-name">' + esc(pick.name) + '</h3><div class="psf-fitline"><b>' + fitLabel(pick.fit) + '</b></div></div>' +
        '<div class="psf-ringbox"><svg viewBox="0 0 80 80" aria-hidden="true"><circle class="psf-ring-bg" cx="40" cy="40" r="36"/><circle class="psf-ring-fg" cx="40" cy="40" r="36" data-ring="' + pick.fit + '"/></svg>' +
        '<div class="psf-ring-num" aria-label="' + pick.fit + ' percent match"><span><span data-count="' + pick.fit + '">0</span><small>%</small></span></div></div>' +
      '</div>' +
      '<p class="psf-sum">' + esc(pick.summary) + '</p>' +
      '<div class="psf-why"><h4>Why it fits you</h4><ul>' + evidenceHtml(pick) + '</ul></div>' +
      '<div class="psf-levels"><div class="psf-levels-head"><span>PlayStyle level</span><strong data-level-label>Level 1</strong></div>' +
        '<div class="psf-tabs" data-lv="0" style="--lv:0" role="group" aria-label="Choose ' + esc(pick.name) + ' level"><span class="psf-tab-glider"></span>' +
          [1, 2, 3].map((level) => '<button type="button" class="psf-tab' + (level === 1 ? ' is-active' : '') + '" data-level="' + level + '" aria-pressed="' + (level === 1) + '">' + (level === 3 ? '&#9733; Level 3' : 'Level ' + level) + '</button>').join('') +
        '</div><p class="psf-level-copy" data-level-copy>' + esc(pick.levels[0]) + '</p></div>' +
    '</article>';
  }

  function altHtml(alt, index) {
    const target = state.res.picks[state.res.picks.length - 1];
    return '<article class="psf-alt" style="--i:' + index + '">' +
      '<div class="psf-alt-head"><img alt="" width="46" height="46" src="' + iconFor(alt, 2) + '"><div><b>' + esc(alt.name) + '</b><span>' + (alt.fit >= 15 ? alt.fit + '% match' : alt.isMeta ? 'Community pick' : 'Fits your role') + '</span></div></div>' +
      '<p>Pick ' + esc(alt.name) + ' instead if ' + esc(PLAYSTYLE_PROFILE[alt.name].altNote) + '</p>' +
      '<button type="button" class="psf-btn small" data-swap="' + esc(alt.name) + '">Swap in for ' + esc(target.name) + '</button></article>';
  }

  function metaHtml() {
    const res = state.res;
    const names = new Set(res.picks.map((p) => p.name));
    if (!res.meta) {
      return '<div><h3>No community consensus yet</h3><p>Guides have not settled on a standard set for the ' + esc(res.position.label.toLowerCase()) + ', so this result is driven only by your answers.</p></div><div class="psf-chips"></div>';
    }
    return '<div><h3>What the community runs at ' + esc(res.position.label.toLowerCase()) + '</h3><p>' + esc(res.meta.note) + '</p><small>Based on FC Mobile community guides from July to October 2026. Metas move with every patch, so treat this as a sanity check rather than a rule.</small></div>' +
      '<div class="psf-chips">' + res.meta.picks.map((name) => {
        const style = getPlaystyleByName(name);
        return '<span class="psf-chip' + (names.has(name) ? ' is-yours' : '') + '"><img alt="" width="28" height="28" src="' + iconFor(style, 2) + '">' + esc(name) + '</span>';
      }).join('') + '</div>';
  }

  function synergyHtml() {
    const res = state.res;
    if (res.picks.length < 2) return '';
    const [a, b] = res.picks;
    return '<div class="psf-syn-icons"><img alt="" width="52" height="52" src="' + iconFor(a, 2) + '"><span aria-hidden="true">+</span><img alt="" width="52" height="52" src="' + iconFor(b, 2) + '"></div>' +
      '<div><h3>How they work together</h3><p>' + esc(describePair(a, b)) + '</p></div>';
  }

  function renderBody() {
    const res = state.res;
    const single = res.picks.length === 1;
    $('psfCards').className = 'psf-r-cards' + (single ? ' is-single' : '');
    $('psfCards').innerHTML = res.picks.map((pick, i) => cardHtml(pick, i, single)).join('');
    const syn = $('psfSynergy');
    syn.hidden = single;
    syn.innerHTML = synergyHtml();
    $('psfAlts').innerHTML = res.alternates.map(altHtml).join('');
    $('psfAltsWrap').hidden = !res.alternates.length;
    $('psfMeta').innerHTML = metaHtml();
    activateCards();
    drawShare();
  }

  function activateCards() {
    root.querySelectorAll('#psfCards [data-count]').forEach((node) => {
      const to = Number(node.dataset.count);
      if (reduce) { node.textContent = to; return; }
      const start = performance.now() + 350;
      const tick = (now) => {
        const t = Math.max(0, Math.min(1, (now - start) / 1100));
        node.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.querySelectorAll('#psfCards [data-ring]').forEach((ring) => {
        ring.style.strokeDashoffset = String(226.2 * (1 - Number(ring.dataset.ring) / 100));
      });
    }));
  }

  function sparkle() {
    if (reduce) return;
    const card = root.querySelector('.psf-card.is-main');
    if (!card) return;
    for (let i = 0; i < 18; i += 1) {
      const spark = document.createElement('span');
      spark.className = 'psf-spark';
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 150;
      spark.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
      spark.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
      spark.style.animationDelay = Math.random() * 0.25 + 's';
      card.append(spark);
      setTimeout(() => spark.remove(), 1800);
    }
  }

  function renderResults() {
    const res = state.res;
    const arche = res.archetype;
    const sub = arche && arche.secondaryLabel && arche.secondary ? 'Also strong: ' + arche.secondaryLabel.toLowerCase() : '';
    el.results.innerHTML =
      '<div class="psf-r-hero"><div>' +
        '<span class="psf-r-pill">Your PlayStyle read &middot; ' + esc(res.position.label) + ' (' + esc(res.position.code) + ')</span>' +
        '<h2 class="psf-r-title">The ' + esc(arche ? arche.title : res.position.label) + '</h2>' +
        (sub ? '<p class="psf-r-sub">' + esc(sub) + '</p>' : '') +
        '<p class="psf-r-tag">' + esc(arche ? arche.tagline : '') + '</p>' +
        '<div class="psf-r-actions">' +
          '<button type="button" class="psf-btn gold" data-act="share">Share my build</button>' +
          '<button type="button" class="psf-btn" data-act="copy">Copy link</button>' +
          '<button type="button" class="psf-btn" data-act="edit">Edit answers</button>' +
          '<button type="button" class="psf-btn" data-act="retake">Try another position</button>' +
        '</div></div>' +
        '<div><div class="psf-r-radar" id="psfRRadar"></div></div></div>' +
      '<div class="psf-r-cards" id="psfCards"></div>' +
      '<div class="psf-synergy" id="psfSynergy"></div>' +
      '<div id="psfAltsWrap"><div class="psf-section-title"><h2>Also worth a look</h2><p>Close calls from your answers. Swap one in to see how your build changes.</p></div><div class="psf-alts" id="psfAlts"></div></div>' +
      '<div class="psf-section-title"><h2>Meta check</h2><p>See how your read compares with what the community is running.</p></div>' +
      '<div class="psf-meta" id="psfMeta"></div>' +
      '<div class="psf-section-title"><h2>Your build card</h2><p>Save it, post it, settle the argument in your club chat.</p></div>' +
      '<div class="psf-share"><canvas id="psfShareCanvas" width="1080" height="1350" role="img" aria-label="Shareable build card"></canvas><div>' +
        '<h3>Show off your build</h3><p>A clean card with your archetype, PlayStyles and play shape. Anyone with the link can open the exact same result.</p>' +
        '<div class="psf-r-actions"><button type="button" class="psf-btn gold" data-act="save">Save image</button><button type="button" class="psf-btn" data-act="share">Share</button><button type="button" class="psf-btn" data-act="copy">Copy link</button></div>' +
      '</div></div>' +
      '<div class="psf-bottom-cta"><a class="psf-btn primary" href="/player/playstyle/">Browse the full PlayStyle guide <span aria-hidden="true">&rarr;</span></a></div>' +
      '<p class="psf-disclaimer">A role-based recommendation built from the PlayStyle guide and community meta. It is not a promise of match results.</p>';

    resultRadar = new Radar($('psfRRadar'));
    renderBody();
    setTimeout(() => resultRadar.set(res.dna.map((item) => item.value), 1100), 350);
    setTimeout(sparkle, 450);
  }

  function showResults(animate) {
    state.res = buildResult();
    saveHistory(state.res);
    try { history.replaceState(null, '', '#b=' + encodeBuild(state.position, state.answers)); } catch { /* ignore */ }
    el.builder.hidden = true;
    el.recent.hidden = true;
    el.results.hidden = false;
    renderResults();
    window.dispatchEvent(new CustomEvent('fcmobiletools:tool-activity', { detail: { entityId: 'playstyle-finder', durationMs: 3000 } }));
    const top = root.querySelector('.psf-hero').offsetHeight - 40;
    window.scrollTo({ top: Math.max(0, top), behavior: animate && !reduce ? 'smooth' : 'auto' });
  }

  function backToBuilder(step) {
    el.results.hidden = true;
    el.builder.hidden = false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
    if (step === 0) {
      state.position = '';
      state.answers = {};
      root.querySelectorAll('[data-position]').forEach((button) => { button.classList.remove('is-active'); button.setAttribute('aria-pressed', 'false'); });
      el.pitchNote.textContent = 'Not sure? Use the position shown on your player card.';
    }
    renderRecent();
    go(step, -1);
    el.builder.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- Share card (canvas) ---------- */
  const loadImage = (src) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function wrap(c, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(' ');
    let line = '';
    let row = 0;
    for (let i = 0; i < words.length; i += 1) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(test).width > maxWidth && line) {
        c.fillText(line, x, y + row * lineHeight);
        row += 1; line = words[i];
        if (row >= maxLines) return row;
      } else line = test;
    }
    c.fillText(line, x, y + row * lineHeight);
    return row + 1;
  }

  let shareToken = 0;
  async function drawShare() {
    const canvas = $('psfShareCanvas');
    const res = state.res;
    if (!canvas || !res) return;
    const token = ++shareToken;
    const W = 1080, H = 1350;
    const head = '"Space Grotesk", Inter, system-ui, sans-serif';
    const body = 'Inter, system-ui, sans-serif';
    try { await Promise.all([document.fonts.load('700 60px "Space Grotesk"'), document.fonts.load('600 26px Inter'), document.fonts.load('800 20px Inter')]); } catch { /* fall back */ }
    const images = await Promise.all(res.picks.map((pick) => loadImage(iconFor(pick, 3))));
    if (token !== shareToken) return;
    const c = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;

    const bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#071420'); bg.addColorStop(1, '#0e1632');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    [[140, 120, 520, 'rgba(76,201,255,.28)'], [960, 380, 480, 'rgba(154,140,255,.24)'], [540, 1250, 520, 'rgba(246,196,83,.14)']].forEach(([x, y, r, color]) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
    c.strokeStyle = 'rgba(255,255,255,.035)'; c.lineWidth = 1;
    for (let x = 0; x <= W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y <= H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const edge = c.createLinearGradient(0, 0, W, H);
    edge.addColorStop(0, 'rgba(76,201,255,.8)'); edge.addColorStop(.5, 'rgba(255,255,255,.12)'); edge.addColorStop(1, 'rgba(246,196,83,.8)');
    c.strokeStyle = edge; c.lineWidth = 3; roundRect(c, 22, 22, W - 44, H - 44, 38); c.stroke();

    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = '#4cc9ff'; c.font = '800 24px ' + body; c.fillText('FCMOBILETOOLS', 70, 96);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '700 20px ' + body; c.textAlign = 'right'; c.fillText('PLAYSTYLE FINDER', W - 70, 96); c.textAlign = 'left';

    const pill = res.position.label.toUpperCase() + '  \u00b7  ' + res.position.code;
    c.font = '800 22px ' + body;
    const pillW = c.measureText(pill).width + 52;
    c.fillStyle = 'rgba(246,196,83,.1)'; roundRect(c, 70, 150, pillW, 50, 25); c.fill();
    c.strokeStyle = 'rgba(246,196,83,.55)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#ffe7a6'; c.fillText(pill, 96, 183);

    const title = 'The ' + (res.archetype ? res.archetype.title : res.position.label);
    let size = 92;
    do { c.font = '700 ' + size + 'px ' + head; size -= 4; } while (c.measureText(title).width > W - 140 && size > 44);
    const tg = c.createLinearGradient(70, 0, W - 70, 0);
    tg.addColorStop(0, '#ffffff'); tg.addColorStop(.5, '#ffe7a6'); tg.addColorStop(1, '#a8ecff');
    c.fillStyle = tg; c.fillText(title, 70, 308);
    c.fillStyle = 'rgba(220,235,245,.82)'; c.font = '500 30px ' + body;
    wrap(c, res.archetype ? res.archetype.tagline : '', 70, 372, W - 140, 44, 2);

    const single = res.picks.length === 1;
    const cardW = single ? 560 : 462, cardH = 440, cardY = 490;
    res.picks.forEach((pick, i) => {
      const x = single ? (W - cardW) / 2 : 70 + i * (cardW + 16);
      const main = i === 0;
      const fill = c.createLinearGradient(x, cardY, x, cardY + cardH);
      fill.addColorStop(0, main ? 'rgba(70,52,14,.85)' : 'rgba(24,42,62,.9)'); fill.addColorStop(1, 'rgba(8,16,26,.95)');
      c.fillStyle = fill; roundRect(c, x, cardY, cardW, cardH, 30); c.fill();
      c.strokeStyle = main ? 'rgba(246,196,83,.85)' : 'rgba(76,201,255,.6)'; c.lineWidth = 2.5; c.stroke();
      c.textAlign = 'center';
      c.fillStyle = main ? '#f6c453' : '#4cc9ff'; c.font = '800 18px ' + body;
      c.fillText(main ? 'BEST FIT' : 'PARTNER PICK', x + cardW / 2, cardY + 46);
      if (images[i]) {
        const glow = c.createRadialGradient(x + cardW / 2, cardY + 150, 10, x + cardW / 2, cardY + 150, 110);
        glow.addColorStop(0, main ? 'rgba(246,196,83,.5)' : 'rgba(76,201,255,.45)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = glow; c.fillRect(x, cardY + 40, cardW, 220);
        c.drawImage(images[i], x + cardW / 2 - 64, cardY + 86, 128, 128);
      }
      c.fillStyle = '#ffffff'; c.font = '700 44px ' + head;
      let nameSize = 44;
      while (c.measureText(pick.name).width > cardW - 50 && nameSize > 26) { nameSize -= 2; c.font = '700 ' + nameSize + 'px ' + head; }
      c.fillText(pick.name, x + cardW / 2, cardY + 276);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '800 17px ' + body; c.fillText(pick.category.toUpperCase(), x + cardW / 2, cardY + 312);
      c.fillStyle = main ? '#ffe7a6' : '#a8ecff'; c.font = '700 64px ' + head; c.fillText(pick.fit + '%', x + cardW / 2, cardY + 384);
      c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '700 16px ' + body;
      c.fillText(fitLabel(pick.fit).toUpperCase(), x + cardW / 2, cardY + 420);
      c.textAlign = 'left';
    });

    // Radar
    const cx = 300, cy = 1110, r = 110;
    const pt = (i, rad) => polar(i, rad, cx, cy);
    c.lineWidth = 1.5;
    [1 / 3, 2 / 3, 1].forEach((k) => {
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.beginPath();
      PLAYSTYLE_AXES.forEach((_, i) => { const [x, y] = pt(i, r * k); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.closePath(); c.stroke();
    });
    PLAYSTYLE_AXES.forEach((axis, i) => {
      const [x, y] = pt(i, r); c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke();
      const [lx, ly] = pt(i, r + 34); c.fillStyle = 'rgba(200,220,235,.75)'; c.font = '700 17px ' + body; c.textAlign = 'center'; c.fillText(axis.label.toUpperCase(), lx, ly + 6);
    });
    c.beginPath();
    res.dna.forEach((item, i) => { const [x, y] = pt(i, r * item.value); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.closePath();
    c.fillStyle = 'rgba(76,201,255,.28)'; c.fill(); c.strokeStyle = '#4cc9ff'; c.lineWidth = 3; c.stroke();
    res.dna.forEach((item, i) => { const [x, y] = pt(i, r * item.value); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); });

    c.textAlign = 'left';
    c.fillStyle = '#9a8cff'; c.font = '800 18px ' + body; c.fillText(single ? 'YOUR PLAY SHAPE' : 'WHY THIS PAIR', 560, 1040);
    c.fillStyle = 'rgba(235,245,252,.92)'; c.font = '500 27px ' + body;
    wrap(c, single ? 'The analyzer read your answers and matched them to the PlayStyle that improves what you actually do.' : res.synergy, 560, 1090, 450, 40, 5);
    c.fillStyle = 'rgba(255,255,255,.45)'; c.font = '700 20px ' + body; c.textAlign = 'center';
    c.fillText('fcmobiletools.online/player/playstyle-finder', W / 2, H - 46);
    c.textAlign = 'left';
  }

  /* ---------- Share / copy / save ---------- */
  const shareUrl = () => location.origin + location.pathname + '#b=' + encodeBuild(state.position, state.answers);
  const shareText = () => 'My FC Mobile ' + state.res.position.code + ' build: ' + state.res.picks.map((p) => p.name).join(' + ') + '. Find yours:';

  async function copyLink() {
    const url = shareUrl();
    try { await navigator.clipboard.writeText(url); } catch {
      const area = document.createElement('textarea');
      area.value = url; area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area); area.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      area.remove();
    }
    toast('Link copied. Your build is in it.');
  }

  function canvasBlob() {
    return new Promise((resolve) => $('psfShareCanvas').toBlob((blob) => resolve(blob), 'image/png'));
  }

  async function saveImage() {
    await drawShare();
    const blob = await canvasBlob();
    if (!blob) { toast('Could not create the image.'); return; }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'fc-mobile-playstyle-' + state.res.position.code.toLowerCase() + '.png';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    toast('Build card saved.');
  }

  async function shareBuild() {
    const data = { title: 'My FC Mobile PlayStyle build', text: shareText(), url: shareUrl() };
    if (navigator.share) {
      try {
        const blob = await canvasBlob();
        const file = blob ? new File([blob], 'playstyle-build.png', { type: 'image/png' }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
        await navigator.share(data);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  /* ---------- Events ---------- */
  root.addEventListener('click', (event) => {
    const target = event.target;
    const position = target.closest('[data-position]');
    if (position) { choosePosition(position.dataset.position); return; }
    const option = target.closest('[data-option]');
    if (option) { chooseOption(option.dataset.option); return; }
    const recent = target.closest('[data-recent]');
    if (recent) {
      const decoded = decodeBuild(recent.dataset.recent);
      if (decoded) { state.position = decoded.position; state.answers = decoded.answers; showResults(true); }
      return;
    }
    const tab = target.closest('.psf-tab');
    if (tab) { setLevel(tab); return; }
    const swap = target.closest('[data-swap]');
    if (swap) { swapIn(swap.dataset.swap); return; }
    const act = target.closest('[data-act]');
    if (act) {
      const name = act.dataset.act;
      if (name === 'share') shareBuild();
      else if (name === 'copy') copyLink();
      else if (name === 'save') saveImage();
      else if (name === 'retake') backToBuilder(0);
      else if (name === 'edit') backToBuilder(1);
      return;
    }
    if (target.closest('#psfNext')) { advance(); return; }
    if (target.closest('#psfBack')) { if (!state.busy && state.step > 0) go(state.step - 1, -1); return; }
    if (target.closest('#psfRestart')) { state.step = 0; backToBuilder(0); }
  });

  function setLevel(tab) {
    const card = tab.closest('.psf-card');
    const pick = state.res.picks[Number(card.dataset.card)];
    const level = Number(tab.dataset.level);
    card.querySelectorAll('.psf-tab').forEach((button) => {
      const active = button === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const tabs = card.querySelector('.psf-tabs');
    tabs.style.setProperty('--lv', level - 1);
    tabs.dataset.lv = String(level - 1);
    card.querySelector('[data-level-label]').textContent = level === 3 ? '\u2605 Level 3' : 'Level ' + level;
    const icon = card.querySelector('[data-icon]');
    icon.src = iconFor(pick, level);
    icon.classList.remove('pop'); void icon.offsetWidth; icon.classList.add('pop');
    const copy = card.querySelector('[data-level-copy]');
    copy.classList.add('swap');
    setTimeout(() => { copy.textContent = pick.levels[level - 1]; copy.classList.remove('swap'); }, reduce ? 0 : 160);
  }

  function swapIn(name) {
    const res = state.res;
    const index = res.alternates.findIndex((alt) => alt.name === name);
    if (index < 0) return;
    const slot = res.picks.length - 1;
    const removed = res.picks[slot];
    res.picks[slot] = res.alternates[index];
    res.alternates[index] = removed;
    res.synergy = res.picks.length === 2 ? describePair(res.picks[0], res.picks[1]) : '';
    renderBody();
    toast(name + ' swapped in for ' + removed.name + '.');
    root.querySelector('#psfCards').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }

  // Spotlight + tilt
  root.addEventListener('pointermove', (event) => {
    const spot = event.target.closest && event.target.closest('.psf-opt, .psf-card');
    if (!spot) return;
    const rect = spot.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    spot.style.setProperty('--mx', x + 'px');
    spot.style.setProperty('--my', y + 'px');
    if (spot.classList.contains('psf-card') && canHover && !reduce) {
      spot.style.setProperty('--ry', ((x / rect.width - 0.5) * 7).toFixed(2) + 'deg');
      spot.style.setProperty('--rx', ((0.5 - y / rect.height) * 6).toFixed(2) + 'deg');
    }
  });
  root.addEventListener('pointerout', (event) => {
    const card = event.target.closest && event.target.closest('.psf-card');
    if (card && !card.contains(event.relatedTarget)) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }
  });

  // Hero parallax
  if (el.constellation && canHover && !reduce) {
    window.addEventListener('pointermove', (event) => {
      el.constellation.style.setProperty('--px', ((event.clientX / window.innerWidth - 0.5) * 34).toFixed(1));
      el.constellation.style.setProperty('--py', ((event.clientY / window.innerHeight - 0.5) * 24).toFixed(1));
    }, { passive: true });
  }

  // Keyboard
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !el.results.hidden || !el.analyzing.hidden) return;
    const tag = (event.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (/^[1-9]$/.test(event.key) && state.step > 0) {
      const q = questions()[state.step - 1];
      const option = q && q.options[Number(event.key) - 1];
      if (option) { event.preventDefault(); chooseOption(option.id); }
    } else if (event.key === 'Enter' && tag !== 'button' && currentAnswered()) {
      event.preventDefault(); advance();
    } else if (event.key === 'Backspace' && state.step > 0 && !state.busy) {
      event.preventDefault(); go(state.step - 1, -1);
    }
  });

  /* ---------- Boot ---------- */
  function boot() {
    renderStage(1);
    renderRecent();
    const match = /[#&]b=([A-Za-z]{2,3}\.[a-e-]+)/.exec(location.hash);
    const decoded = match ? decodeBuild(match[1]) : null;
    if (decoded) {
      const qs = getPlaystyleQuestions(decoded.position);
      if (qs.every((q) => decoded.answers[q.id])) {
        state.position = decoded.position;
        state.answers = decoded.answers;
        const button = root.querySelector('[data-position="' + decoded.position + '"]');
        if (button) { button.classList.add('is-active'); button.setAttribute('aria-pressed', 'true'); }
        showResults(false);
      }
    }
  }
  boot();
})();
