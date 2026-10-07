import {
  BASE_OVR_MAX,
  BASE_OVR_MIN,
  DEFAULT_FORMATION,
  MAX_BADGE_SLOTS,
  MAX_BENCH_SIZE,
  MAX_TEAM_OVR,
  RANK_MAX,
  STARTING_XI_SIZE,
  deserializeSquad,
  findWeakest,
  getFormation,
  isValidBaseOVR,
  nextOvrOptions,
  ovrTier,
  parseQuickFill,
  planUpgrade,
  serializeSquad,
  summarizeSquad,
} from '../lib/teamOvr.js';

const root = document.getElementById('tovr');

if (root) {
  const STORAGE_KEY = 'fcmt.team-ovr.v2';
  const $ = (id) => document.getElementById(id);
  const mobileQuery = window.matchMedia('(max-width: 980px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const blank = () => ({ baseOVR: null, rank: 0 });

  const state = {
    formation: DEFAULT_FORMATION,
    starters: Array.from({ length: STARTING_XI_SIZE }, blank),
    bench: Array.from({ length: MAX_BENCH_SIZE }, blank),
    badges: Array(MAX_BADGE_SLOTS).fill(false),
    target: null, // null = follow "current + 1"
    selected: { group: 'starter', index: 0 },
    view: 'pitch',
  };

  const el = {
    hero: $('hero'),
    heroNumber: $('hero-number'),
    heroState: $('hero-state'),
    ring: $('ring-arc'),
    eqBase: $('eq-base'), eqBaseSub: $('eq-base-sub'),
    eqRank: $('eq-rank'), eqRankSub: $('eq-rank-sub'),
    eqBadge: $('eq-badge'), eqBadgeSub: $('eq-badge-sub'),
    nextText: $('next-text'), nextPlan: $('next-plan'),
    squadCount: $('squad-count'), benchCount: $('bench-count'),
    chips: [...root.querySelectorAll('.chip')],
    list: $('list'),
    editor: $('editor'), edKicker: $('ed-kicker'), edTitle: $('ed-title'),
    edBase: $('ed-base'), edMsg: $('ed-msg'), edOvr: $('ed-ovr'),
    edRank: [...root.querySelectorAll('#ed-rank [data-rank]')],
    badgeBtns: [...root.querySelectorAll('[data-badge]')], badgeTotal: $('badge-total'),
    tInput: $('t-input'), routes: $('routes'), weak: $('weak-list'),
    dock: $('dock'), dockNumber: $('dock-number'), dockState: $('dock-state'),
    toast: $('toast'), saved: $('saved'),
    dialog: $('quick-dialog'), quickText: $('quick-text'), quickMsg: $('quick-msg'),
  };

  /* ---------------------------------------------------------------- helpers */
  const slotOf = (group, index) => (group === 'starter' ? state.starters : state.bench)[index];
  const posOf = (index) => getFormation(state.formation).slots[index]?.pos ?? '';
  const keyOf = (group, index) => `${group}:${index}`;
  const splitKey = (key) => { const [group, index] = key.split(':'); return { group, index: Number(index) }; };
  const labelOf = (key) => {
    const { group, index } = splitKey(key);
    return group === 'starter' ? `${posOf(index)} · P${index + 1}` : `SUB ${index + 1}`;
  };
  const order = [
    ...Array.from({ length: STARTING_XI_SIZE }, (_, i) => ({ group: 'starter', index: i })),
    ...Array.from({ length: MAX_BENCH_SIZE }, (_, i) => ({ group: 'bench', index: i })),
  ];
  const orderIndex = (sel) => order.findIndex((o) => o.group === sel.group && o.index === sel.index);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
  const digits = (value) => value.replace(/\D/g, '').slice(0, 3);
  const playerOvr = (p) => (isValidBaseOVR(p.baseOVR) ? p.baseOVR + p.rank : null);
  const badBaseText = (raw, final) => {
    if (raw === '') return false;
    const n = Number(raw);
    if (isValidBaseOVR(n)) return false;
    return final || raw.length >= 3 || n > BASE_OVR_MAX;
  };

  let toastTimer = 0;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400);
  }

  const rafs = new WeakMap();
  function animateNumber(node, to) {
    cancelAnimationFrame(rafs.get(node) ?? 0);
    if (to === null || to === undefined) { node.textContent = '--'; delete node.dataset.shown; return; }
    const from = Number(node.dataset.shown);
    node.dataset.shown = String(to);
    if (reducedMotion || !Number.isFinite(from) || from === to) { node.textContent = String(to); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = String(Math.round(from + (to - from) * eased));
      if (t < 1) rafs.set(node, requestAnimationFrame(tick));
    };
    rafs.set(node, requestAnimationFrame(tick));
  }

  /* ---------------------------------------------------------------- list view */
  function buildList() {
    const row = (group, index) => {
      const who = group === 'starter' ? `Starter ${index + 1}` : `Substitute ${index + 1}`;
      return `<div class="lrow" data-group="${group}" data-index="${index}">
        <div class="l-name"><b data-l-pos>${group === 'starter' ? posOf(index) : `SUB ${index + 1}`}</b><small>${group === 'starter' ? `P${index + 1}` : 'Bench'}</small></div>
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" placeholder="Base OVR" aria-label="${who} Base OVR" />
        <div class="l-rank"><button type="button" data-rank-step="-1" aria-label="${who} lower Rank">−</button><output aria-label="${who} Rank">0</output><button type="button" data-rank-step="1" aria-label="${who} raise Rank">+</button></div>
        <div class="l-ovr" data-tier="empty">--</div>
      </div>`;
    };
    el.list.innerHTML =
      `<div class="l-group">STARTING XI</div>${Array.from({ length: STARTING_XI_SIZE }, (_, i) => row('starter', i)).join('')}` +
      `<div class="l-group">BENCH</div>${Array.from({ length: MAX_BENCH_SIZE }, (_, i) => row('bench', i)).join('')}`;
  }

  el.list.addEventListener('input', (event) => {
    const input = event.target.closest('input');
    if (!input) return;
    const rowEl = input.closest('.lrow');
    input.value = digits(input.value);
    slotOf(rowEl.dataset.group, Number(rowEl.dataset.index)).baseOVR = input.value === '' ? null : Number(input.value);
    update();
  });
  el.list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !event.target.matches('input')) return;
    event.preventDefault();
    const inputs = [...el.list.querySelectorAll('input')];
    const next = inputs[inputs.indexOf(event.target) + 1];
    if (next) { next.focus(); next.select(); } else event.target.blur();
  });
  el.list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-rank-step]');
    if (!button) return;
    const rowEl = button.closest('.lrow');
    const player = slotOf(rowEl.dataset.group, Number(rowEl.dataset.index));
    player.rank = clamp(player.rank + Number(button.dataset.rankStep), 0, RANK_MAX);
    update();
  });

  /* ---------------------------------------------------------------- rendering */
  let lastSummary = null;
  let heroVisible = true;

  function renderHero(summary, next) {
    const { state: mode } = summary;
    el.hero.dataset.state = mode;
    animateNumber(el.heroNumber, summary.teamOVR);
    el.heroState.dataset.state = mode;
    el.heroState.textContent =
      mode === 'empty' ? 'Waiting for players'
        : mode === 'estimate' ? `Estimate · ${summary.startersFilled}/${STARTING_XI_SIZE} starters`
          : `Exact · ${summary.count}-player squad`;
    el.ring.style.strokeDasharray = `${mode === 'exact' ? 100 : (summary.startersFilled / STARTING_XI_SIZE) * 100} 100`;

    el.eqBase.textContent = summary.baseAverage ?? '--';
    el.eqBaseSub.textContent = summary.count ? `avg ${summary.baseRaw.toFixed(2)}` : 'avg --';
    el.eqRank.textContent = summary.rankAverage ?? '--';
    el.eqRankSub.textContent = summary.count ? `avg ${summary.rankRaw.toFixed(2)}` : 'avg --';
    el.eqBadge.textContent = String(summary.badgeBonus);
    el.eqBadgeSub.textContent = `${summary.badgeBonus} of ${MAX_BADGE_SLOTS}`;

    el.nextPlan.hidden = true;
    if (mode === 'empty') {
      el.nextText.textContent = 'Add your starting XI to see what the next point costs.';
    } else if (mode === 'estimate') {
      const missing = STARTING_XI_SIZE - summary.startersFilled;
      el.nextText.innerHTML = `Add <b>${missing}</b> more ${plural(missing, 'starter')} to lock in your exact result.`;
    } else if (!next?.reachable) {
      el.nextText.textContent = 'Your squad is at the Base OVR and Rank ceiling. Nothing left to upgrade.';
    } else {
      const parts = [];
      if (next.baseSteps !== null) parts.push(`<b>+${next.baseSteps}</b> Base OVR ${plural(next.baseSteps, 'point')}`);
      if (next.rankSteps !== null) parts.push(`<b>+${next.rankSteps}</b> Rank ${plural(next.rankSteps, 'step')}`);
      el.nextText.innerHTML = `Reach <b>${next.target}</b> with ${parts.join(' or ')}.`;
      el.nextPlan.hidden = false;
    }

    el.dockNumber.textContent = summary.teamOVR ?? '--';
    el.dockState.textContent = mode === 'exact' ? 'Exact' : 'Estimate';
    el.dockState.dataset.exact = String(mode === 'exact');
    syncDock();
  }

  function syncDock() {
    const show = mobileQuery.matches && !heroVisible && !!lastSummary?.count;
    el.dock.classList.toggle('show', show);
    el.dock.setAttribute('aria-hidden', String(!show));
  }

  function weakKeysOf(summary) {
    const set = new Set();
    if (summary.count < 3) return set;
    const lowest = Math.min(...summary.players.map((p) => p.baseOVR));
    const distinct = new Set(summary.players.map((p) => p.baseOVR)).size;
    if (distinct > 1) summary.players.filter((p) => p.baseOVR === lowest).forEach((p) => set.add(p.key));
    return set;
  }

  function renderChips(weakKeys) {
    el.chips.forEach((chip) => {
      const { group } = chip.dataset;
      const index = Number(chip.dataset.index);
      const player = slotOf(group, index);
      const ovr = playerOvr(player);
      const selected = state.selected.group === group && state.selected.index === index;
      chip.dataset.tier = ovr === null ? 'empty' : ovrTier(ovr);
      chip.querySelector('[data-ovr]').textContent = ovr ?? '--';
      chip.querySelectorAll('.chip-pips i').forEach((pip, i) => pip.classList.toggle('on', ovr !== null && i < player.rank));
      chip.classList.toggle('is-selected', selected);
      chip.classList.toggle('is-weak', weakKeys.has(keyOf(group, index)));
      chip.setAttribute('aria-pressed', String(selected));
      const name = group === 'starter' ? `Starter ${index + 1}, ${posOf(index)}` : `Substitute ${index + 1}`;
      chip.setAttribute('aria-label', ovr === null ? `${name}, empty` : `${name}, Base ${player.baseOVR}, Rank ${player.rank}, OVR ${ovr}`);
      if (group === 'starter') chip.querySelector('[data-pos]').textContent = posOf(index);
    });
  }

  function renderList(weakKeys) {
    el.list.querySelectorAll('.lrow').forEach((rowEl) => {
      const { group } = rowEl.dataset;
      const index = Number(rowEl.dataset.index);
      const player = slotOf(group, index);
      const input = rowEl.querySelector('input');
      const ovr = playerOvr(player);
      if (document.activeElement !== input) input.value = player.baseOVR === null ? '' : String(player.baseOVR);
      input.setAttribute('aria-invalid', String(badBaseText(input.value, document.activeElement !== input)));
      rowEl.querySelector('output').textContent = String(player.rank);
      const out = rowEl.querySelector('.l-ovr');
      out.textContent = ovr ?? '--';
      out.dataset.tier = ovr === null ? 'empty' : ovrTier(ovr);
      rowEl.classList.toggle('is-weak', weakKeys.has(keyOf(group, index)));
      if (group === 'starter') rowEl.querySelector('[data-l-pos]').textContent = posOf(index);
    });
  }

  function renderEditor(force = false) {
    const { group, index } = state.selected;
    const player = slotOf(group, index);
    el.edKicker.textContent = group === 'starter' ? `STARTER ${index + 1}` : `SUBSTITUTE ${index + 1}`;
    el.edTitle.textContent = group === 'starter' ? posOf(index) : `Sub ${index + 1}`;
    if (force || document.activeElement !== el.edBase) el.edBase.value = player.baseOVR === null ? '' : String(player.baseOVR);
    el.edRank.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.rank) === player.rank)));
    const ovr = playerOvr(player);
    el.edOvr.textContent = ovr ?? '--';
    el.edOvr.dataset.tier = ovr === null ? 'empty' : ovrTier(ovr);
    const bad = badBaseText(el.edBase.value, document.activeElement !== el.edBase);
    el.edBase.setAttribute('aria-invalid', String(bad));
    el.edMsg.dataset.bad = String(bad);
    el.edMsg.textContent = bad
      ? `Base OVR must be between ${BASE_OVR_MIN} and ${BASE_OVR_MAX}.`
      : `Between ${BASE_OVR_MIN} and ${BASE_OVR_MAX}. Press Enter for the next player.`;
  }

  function renderBadges() {
    el.badgeBtns.forEach((button, i) => button.setAttribute('aria-pressed', String(state.badges[i])));
    el.badgeTotal.textContent = `+${state.badges.filter(Boolean).length}`;
  }

  const openRoutes = new Map();
  let routesHtml = '';
  const routeName = { base: 'Base OVR only', rank: 'Rank only', mixed: 'Mixed' };

  function renderPlanner(summary, next) {
    const auto = summary.teamOVR === null ? null : summary.teamOVR + 1;
    const shown = state.target ?? auto;
    if (document.activeElement !== el.tInput) el.tInput.value = shown === null ? '' : String(shown);

    let html;
    if (!summary.exact) {
      const pct = Math.round((summary.startersFilled / STARTING_XI_SIZE) * 100);
      const missing = STARTING_XI_SIZE - summary.startersFilled;
      html = `<div class="p-empty"><b>Complete your starting XI to unlock routes.</b> ${missing} more ${plural(missing, 'starter')} needed.<div class="p-progress"><span style="width:${pct}%"></span></div></div>`;
    } else {
      const plan = planUpgrade({ players: summary.players, badgeBonus: summary.badgeBonus, target: shown });
      if (plan.status === 'reached') {
        html = `<div class="p-empty p-done"><b>Target reached.</b> Your squad is already at ${plan.current} OVR. Raise the target to plan the next step.</div>`;
      } else if (plan.status !== 'ok') {
        html = `<div class="p-empty"><b>Out of reach for now.</b> Players cap at ${BASE_OVR_MAX} Base OVR and Rank ${RANK_MAX}, so this squad cannot get to ${shown}.</div>`;
      } else {
        html = plan.routes.map((route, i) => {
          const isOpen = openRoutes.has(route.kind) ? openRoutes.get(route.kind) : i === 0;
          const bits = [];
          if (route.baseSteps) bits.push(`Base +${route.baseSteps}`);
          if (route.rankSteps) bits.push(`Rank +${route.rankSteps}`);
          const lines = (changes, rank) => changes.map((c) =>
            `<li><span>${labelOf(c.key)}</span><b>${rank ? `Rank ${c.from}` : c.from}<i>→</i><em>${rank ? `Rank ${c.to}` : c.to}</em></b></li>`).join('');
          return `<details class="route${i === 0 ? ' is-best' : ''}" data-kind="${route.kind}"${isOpen ? ' open' : ''}>
            <summary>
              <div class="route-name"><b>${routeName[route.kind]}${i === 0 ? '<span class="route-badge">FEWEST</span>' : ''}</b><small>${bits.join(' · ')}</small></div>
              <div class="route-total"><strong>${route.total}</strong><span>${plural(route.total, 'upgrade')}</span></div>
            </summary>
            <div class="route-body">
              ${route.baseChanges.length ? `<div class="r-group"><h4>Base OVR</h4><ul class="r-list">${lines(route.baseChanges, false)}</ul></div>` : ''}
              ${route.rankChanges.length ? `<div class="r-group"><h4>Rank</h4><ul class="r-list">${lines(route.rankChanges, true)}</ul></div>` : ''}
            </div>
          </details>`;
        }).join('');
      }
    }
    if (html !== routesHtml) { el.routes.innerHTML = html; routesHtml = html; }
  }

  // Remember only what the user opens or closes themselves (clicks run before the native toggle).
  el.routes.addEventListener('click', (event) => {
    const summary = event.target.closest('summary');
    const details = summary?.parentElement;
    if (details?.dataset.kind) openRoutes.set(details.dataset.kind, !details.open);
  });

  let weakHtml = '';
  function renderWeak(summary) {
    let html;
    if (summary.count < 2) {
      html = '<div class="p-empty">Enter a few Base OVRs and your lowest players show up here.</div>';
    } else {
      html = findWeakest(summary.players, 3).map((player, i) => {
        const gap = (summary.baseRaw - player.baseOVR).toFixed(1);
        const low = player.baseOVR === Math.min(...summary.players.map((p) => p.baseOVR)) && new Set(summary.players.map((p) => p.baseOVR)).size > 1;
        return `<button type="button" class="w-row${low ? ' is-lowest' : ''}" data-key="${player.key}">
          <span class="w-rank">${i + 1}</span>
          <span class="w-who"><b>${labelOf(player.key)}</b><small>Rank ${player.rank} · ${Number(gap) > 0 ? `${gap} below squad average` : 'at squad average'}</small></span>
          <span class="w-ovr">${player.baseOVR}</span>
        </button>`;
      }).join('');
    }
    if (html !== weakHtml) { el.weak.innerHTML = html; weakHtml = html; }
  }

  el.weak.addEventListener('click', (event) => {
    const row = event.target.closest('[data-key]');
    if (!row) return;
    const { group, index } = splitKey(row.dataset.key);
    if (state.view === 'list') {
      const input = el.list.querySelector(`.lrow[data-group="${group}"][data-index="${index}"] input`);
      input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      input?.focus({ preventScroll: true });
    } else {
      document.getElementById('squad').scrollIntoView({ behavior: 'smooth', block: 'start' });
      select(group, index, { open: true, focus: false });
    }
  });

  let teamOvrTouched=false;
  let teamOvrActivityTimer=0;
  let lastTeamOvrActivitySignature='';

  function scheduleTeamOvrActivity(summary){
    if(!teamOvrTouched || !summary?.exact || !summary.teamOVR) return;
    window.clearTimeout(teamOvrActivityTimer);
    teamOvrActivityTimer=window.setTimeout(()=>{
      const signature=[summary.startersFilled,summary.teamOVR,...summary.players.slice(0,STARTING_XI_SIZE).map(p=>p.baseOVR+'/'+p.rank)].join('|');
      if(signature===lastTeamOvrActivitySignature) return;
      lastTeamOvrActivitySignature=signature;
      window.dispatchEvent(new CustomEvent('fcmobiletools:tool-activity',{
        detail:{
          entityId:'team-ovr',
          durationMs:3000,
          metadata:{teamOVR:Number(summary.teamOVR),startersFilled:Number(summary.startersFilled)}
        }
      }));
    },900);
  }

  function update({ syncEditor = false } = {}) {
    const summary = summarizeSquad({ starters: state.starters, bench: state.bench, badges: state.badges });
    lastSummary = summary;
    const next = summary.exact ? nextOvrOptions(summary) : null;
    const weakKeys = weakKeysOf(summary);
    el.squadCount.textContent = `${summary.startersFilled} / ${STARTING_XI_SIZE}`;
    el.benchCount.textContent = String(summary.benchFilled);
    renderHero(summary, next);
    renderChips(weakKeys);
    renderList(weakKeys);
    renderEditor(syncEditor);
    renderBadges();
    renderPlanner(summary, next);
    renderWeak(summary);
    persist();
    scheduleTeamOvrActivity(summary);
  }

  // A Team OVR Quest requires actual squad input, not a page open.
  root.addEventListener('input',()=>{ teamOvrTouched=true; },{capture:true});
  root.addEventListener('click',event=>{
    if(event.target?.closest('a,[data-site-nav]')) return;
    teamOvrTouched=true;
  },{capture:true});

  /* ---------------------------------------------------------------- selection + sheet */
  const sheetOpen = () => el.editor.dataset.open === 'true';
  function openSheet() {
    if (!mobileQuery.matches) return;
    el.editor.dataset.open = 'true';
    root.classList.add('sheet-open');
    syncDock();
  }
  function closeSheet() {
    el.editor.dataset.open = 'false';
    root.classList.remove('sheet-open');
    if (el.editor.contains(document.activeElement)) document.activeElement.blur();
    syncDock();
  }
  function ensureVisible(node) {
    if (!mobileQuery.matches || !node) return;
    setTimeout(() => {
      const rect = node.getBoundingClientRect();
      const bottomLimit = el.editor.getBoundingClientRect().top - 16;
      const topLimit = 104;
      let dy = 0;
      if (rect.bottom > bottomLimit) dy = rect.bottom - bottomLimit;
      else if (rect.top < topLimit) dy = rect.top - topLimit - 8;
      if (dy) window.scrollBy({ top: dy, behavior: reducedMotion ? 'auto' : 'smooth' });
    }, 380);
  }

  function select(group, index, { open = true, focus = true } = {}) {
    state.selected = { group, index };
    renderChips(weakKeysOf(lastSummary ?? summarizeSquad({ starters: state.starters, bench: state.bench, badges: state.badges })));
    renderEditor(true);
    if (open) openSheet();
    const chip = el.chips.find((c) => c.dataset.group === group && Number(c.dataset.index) === index);
    if (focus) {
      const empty = slotOf(group, index).baseOVR === null;
      if (!mobileQuery.matches || empty) {
        el.edBase.focus({ preventScroll: true });
        el.edBase.select();
      }
    }
    if (open) ensureVisible(chip);
  }

  function step(direction) {
    const at = orderIndex(state.selected);
    const to = at + direction;
    if (to < 0) return;
    if (to >= order.length) { if (mobileQuery.matches) closeSheet(); else el.edBase.blur(); return; }
    select(order[to].group, order[to].index);
  }

  el.chips.forEach((chip) => chip.addEventListener('click', () => select(chip.dataset.group, Number(chip.dataset.index))));

  el.edBase.addEventListener('input', () => {
    el.edBase.value = digits(el.edBase.value);
    const { group, index } = state.selected;
    slotOf(group, index).baseOVR = el.edBase.value === '' ? null : Number(el.edBase.value);
    update();
  });
  el.edBase.addEventListener('blur', () => renderEditor());
  el.edBase.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); step(1); }
  });
  el.edRank.forEach((button) => button.addEventListener('click', () => {
    const { group, index } = state.selected;
    slotOf(group, index).rank = Number(button.dataset.rank);
    update();
  }));

  function typicalBase() {
    const values = [...state.starters, ...state.bench].map((p) => p.baseOVR).filter(isValidBaseOVR);
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 100;
  }
  function bumpBase(delta) {
    const { group, index } = state.selected;
    const player = slotOf(group, index);
    player.baseOVR = isValidBaseOVR(player.baseOVR) ? clamp(player.baseOVR + delta, BASE_OVR_MIN, BASE_OVR_MAX) : typicalBase();
    update({ syncEditor: true });
  }
  $('ed-minus').addEventListener('click', () => bumpBase(-1));
  $('ed-plus').addEventListener('click', () => bumpBase(1));
  $('ed-prev').addEventListener('click', () => step(-1));
  $('ed-next').addEventListener('click', () => step(1));
  $('ed-next-icon').addEventListener('click', () => step(1));
  $('ed-close').addEventListener('click', closeSheet);
  $('ed-clear').addEventListener('click', () => {
    const { group, index } = state.selected;
    Object.assign(slotOf(group, index), blank());
    update({ syncEditor: true });
    el.edBase.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && sheetOpen()) closeSheet(); });
  document.addEventListener('pointerdown', (event) => {
    if (!sheetOpen()) return;
    if (el.editor.contains(event.target) || event.target.closest('.chip') || event.target.closest('.toast')) return;
    closeSheet();
  });
  mobileQuery.addEventListener('change', () => { closeSheet(); syncDock(); });

  /* ---------------------------------------------------------------- badges, target, formation, view */
  el.badgeBtns.forEach((button, i) => button.addEventListener('click', () => { state.badges[i] = !state.badges[i]; update(); }));

  const liveTarget = () => state.target ?? (lastSummary?.teamOVR != null ? lastSummary.teamOVR + 1 : 120);
  const setTarget = (value) => { state.target = clamp(value, 1, MAX_TEAM_OVR); update(); };
  $('t-minus').addEventListener('click', () => setTarget(liveTarget() - 1));
  $('t-plus').addEventListener('click', () => setTarget(liveTarget() + 1));
  root.querySelectorAll('[data-jump]').forEach((button) => button.addEventListener('click', () => {
    const base = lastSummary?.teamOVR ?? 0;
    if (!base) { toast('Enter a few players first'); return; }
    setTarget(base + Number(button.dataset.jump));
  }));
  el.tInput.addEventListener('input', () => {
    el.tInput.value = digits(el.tInput.value);
    state.target = el.tInput.value === '' ? null : clamp(Number(el.tInput.value), 1, MAX_TEAM_OVR);
    update();
  });
  el.tInput.addEventListener('blur', () => { el.tInput.value = ''; update(); });
  el.nextPlan.addEventListener('click', () => {
    state.target = lastSummary.teamOVR + 1;
    update();
    document.getElementById('planner').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  });

  function applyFormation() {
    const formation = getFormation(state.formation);
    $('formation-select').value = formation.id;
    el.chips.filter((c) => c.dataset.group === 'starter').forEach((chip) => {
      const slot = formation.slots[Number(chip.dataset.index)];
      chip.style.setProperty('--x', slot.x);
      chip.style.setProperty('--y', slot.y);
    });
  }
  $('formation-select').addEventListener('change', (event) => {
    state.formation = getFormation(event.target.value).id;
    applyFormation();
    update({ syncEditor: true });
  });

  function setView(view, { save = true } = {}) {
    state.view = view === 'list' ? 'list' : 'pitch';
    root.dataset.view = state.view;
    $('view-pitch').hidden = state.view !== 'pitch';
    $('view-list').hidden = state.view !== 'list';
    root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    $('formation-select').closest('.select').hidden = state.view === 'list';
    if (state.view === 'list') closeSheet();
    if (save) persist();
  }
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

  /* ---------------------------------------------------------------- quick fill, share, reset */
  const canDialog = typeof el.dialog.showModal === 'function';
  if (!canDialog) $('quick-open').hidden = true;
  $('quick-open').addEventListener('click', () => {
    el.quickMsg.textContent = '';
    el.quickMsg.dataset.bad = 'false';
    el.dialog.showModal();
    el.quickText.focus();
  });
  $('quick-apply').addEventListener('click', () => {
    const { entries, invalid, overflow } = parseQuickFill(el.quickText.value);
    if (invalid.length) {
      el.quickMsg.dataset.bad = 'true';
      el.quickMsg.textContent = `Couldn't read: ${invalid.slice(0, 4).join(', ')}${invalid.length > 4 ? '…' : ''}. Use ${BASE_OVR_MIN}–${BASE_OVR_MAX}, with Rank 0–${RANK_MAX} after a slash.`;
      return;
    }
    if (!entries.length) {
      el.quickMsg.dataset.bad = 'true';
      el.quickMsg.textContent = 'Paste some ratings first, like 117 116/2 118.';
      return;
    }
    entries.forEach((entry, i) => {
      const target = i < STARTING_XI_SIZE ? state.starters[i] : state.bench[i - STARTING_XI_SIZE];
      target.baseOVR = entry.baseOVR;
      target.rank = entry.rank;
    });
    el.dialog.close();
    update({ syncEditor: true });
    toast(overflow ? `Filled ${entries.length} players (extra ${overflow} ignored)` : `Filled ${entries.length} ${plural(entries.length, 'player')}`);
  });

  const shareUrl = () => `${location.origin}${location.pathname}#sq=${serializeSquad(state)}`;
  $('share').addEventListener('click', async () => {
    if (!lastSummary?.count) { toast('Add some players before sharing'); return; }
    const url = shareUrl();
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: 'My FC Mobile Team OVR', url }); return; }
      catch (error) { if (error?.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast('Link copied to clipboard'); }
    catch { window.prompt('Copy your squad link:', url); }
  });

  let resetTimer = 0;
  const resetBtn = $('reset');
  const disarmReset = () => { resetBtn.dataset.armed = 'false'; $('reset-label').textContent = 'Reset'; };
  resetBtn.addEventListener('click', () => {
    if (resetBtn.dataset.armed !== 'true') {
      resetBtn.dataset.armed = 'true';
      $('reset-label').textContent = 'Tap to confirm';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(disarmReset, 3200);
      return;
    }
    clearTimeout(resetTimer);
    disarmReset();
    state.starters.forEach((p) => Object.assign(p, blank()));
    state.bench.forEach((p) => Object.assign(p, blank()));
    state.badges.fill(false);
    state.target = null;
    openRoutes.clear();
    closeSheet();
    state.selected = { group: 'starter', index: 0 };
    update({ syncEditor: true });
    toast('Squad cleared');
  });

  /* ---------------------------------------------------------------- persistence */
  let saveTimer = 0;
  let storageOk = true;
  function persist() {
    if (!storageOk) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sq: serializeSquad(state), target: state.target, view: state.view }));
      } catch { storageOk = false; el.saved.hidden = true; }
    }, 250);
  }
  function applySquad(squad) {
    state.formation = squad.formation;
    squad.starters.forEach((p, i) => Object.assign(state.starters[i], p));
    squad.bench.forEach((p, i) => Object.assign(state.bench[i], p));
    squad.badges.forEach((on, i) => { state.badges[i] = on; });
  }

  /* ---------------------------------------------------------------- boot */
  buildList();
  let loadedFromLink = false;
  const hash = new URLSearchParams(location.hash.slice(1)).get('sq');
  const shared = hash ? deserializeSquad(hash) : null;
  if (shared) {
    applySquad(shared);
    loadedFromLink = true;
    history.replaceState(null, '', location.pathname + location.search);
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      if (!loadedFromLink) {
        const squad = deserializeSquad(saved.sq);
        if (squad) applySquad(squad);
        if (Number.isFinite(saved.target)) state.target = clamp(saved.target, 1, MAX_TEAM_OVR);
      }
      if (saved.view === 'list') state.view = 'list';
    }
  } catch { storageOk = false; el.saved.hidden = true; }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; syncDock(); }, { threshold: 0.05 }).observe(el.hero);
  }

  // Pasting a share link into a tab that already has the tool open.
  window.addEventListener('hashchange', () => {
    const incoming = deserializeSquad(new URLSearchParams(location.hash.slice(1)).get('sq') ?? '');
    if (!incoming) return;
    state.starters.forEach((p) => Object.assign(p, blank()));
    state.bench.forEach((p) => Object.assign(p, blank()));
    applySquad(incoming);
    state.target = null;
    history.replaceState(null, '', location.pathname + location.search);
    applyFormation();
    update({ syncEditor: true });
    toast('Loaded the shared squad');
  });

  applyFormation();
  setView(state.view, { save: false });
  update({ syncEditor: true });
  if (loadedFromLink) toast('Loaded the shared squad');
}
