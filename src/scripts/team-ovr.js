import {
  BASE_OVR_MAX,
  BASE_OVR_MIN,
  DEFAULT_FORMATION,
  FORMATIONS,
  MAX_BADGE_SLOTS,
  MAX_BENCH_SIZE,
  MAX_SQUAD_SIZE,
  RANK_OPTIONS,
  STARTING_XI_SIZE,
  calculateBadgeBonus,
  calculateTeamOVR,
  getFormation,
  isPlayerFilled,
  isValidBaseOVR,
  isValidRank,
} from '../lib/teamOvr.js';

const root = document.getElementById('tovr');
if (!root) {
  // The script can be included by Astro on other pages during development.
} else {
  const $ = (id) => document.getElementById(id);
  const chipsEl = $('chips');
  const benchGrid = $('bench-grid');
  const editor = $('editor');
  const formationSelect = $('formation-select');
  const quickDialog = $('quick-dialog');

  const STORAGE_KEY = 'fcmobiletools:team-ovr:v2';
  const SHARE_PREFIX = '#team-ovr=';

  const state = {
    formation: DEFAULT_FORMATION,
    starters: Array.from({ length: STARTING_XI_SIZE }, () => ({ baseOVR: null, rank: 0 })),
    bench: Array.from({ length: MAX_BENCH_SIZE }, () => ({ baseOVR: null, rank: 0 })),
    badges: Array(MAX_BADGE_SLOTS).fill(false),
    selected: { group: 'starter', index: 0 },
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const isValidNumber = (value) => Number.isInteger(value) && isValidBaseOVR(value);
  const allSlots = () => [
    ...state.starters.map((player, index) => ({ player, group: 'starter', index })),
    ...state.bench.map((player, index) => ({ player, group: 'bench', index })),
  ];
  const includedBench = () => state.bench.filter((player) => isValidNumber(player.baseOVR) && isValidRank(player.rank));
  const includedPlayers = () => [...state.starters, ...includedBench()];
  const selectedPlayer = () => state[state.selected.group][state.selected.index];
  const selectedSlot = () => {
    const slot = getFormation(state.formation).slots[state.selected.index];
    return slot ?? { pos: state.selected.group === 'starter' ? 'POS' : `SUB ${state.selected.index + 1}`, x: 50, y: 50 };
  };

  function playerOvr(player) {
    return isValidNumber(player?.baseOVR) && isValidRank(player?.rank) ? player.baseOVR + player.rank : null;
  }

  function tierForOvr(ovr) {
    if (ovr === null) return 'empty';
    if (ovr >= 125) return 'gold';
    if (ovr >= 120) return 'cyan';
    if (ovr >= 110) return 'mint';
    return 'slate';
  }

  function normalizePlayer(player) {
    const baseOVR = isValidNumber(player?.baseOVR) ? player.baseOVR : null;
    const rank = isValidRank(player?.rank) ? player.rank : 0;
    return { baseOVR, rank };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        formation: state.formation,
        starters: state.starters,
        bench: state.bench,
        badges: state.badges,
      }));
      const saved = $('saved');
      if (saved) saved.setAttribute('data-saved', 'true');
    } catch {
      // Storage can be unavailable in private browsing. The calculator still works.
    }
  }

  function encodeShareState() {
    const payload = JSON.stringify({
      formation: state.formation,
      starters: state.starters,
      bench: state.bench,
      badges: state.badges,
    });
    return btoa(unescape(encodeURIComponent(payload)));
  }

  function decodeShareState(value) {
    try {
      const payload = decodeURIComponent(escape(atob(value)));
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  function loadState() {
    let saved = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch {
      saved = null;
    }

    const hashValue = window.location.hash.startsWith(SHARE_PREFIX)
      ? window.location.hash.slice(SHARE_PREFIX.length)
      : '';
    const shared = hashValue ? decodeShareState(hashValue) : null;
    const source = shared ?? saved;

    if (source) {
      const formation = getFormation(source.formation)?.id ?? DEFAULT_FORMATION;
      state.formation = formation;
      state.starters = Array.from({ length: STARTING_XI_SIZE }, (_, index) => normalizePlayer(source.starters?.[index]));
      state.bench = Array.from({ length: MAX_BENCH_SIZE }, (_, index) => normalizePlayer(source.bench?.[index]));
      state.badges = Array.from({ length: MAX_BADGE_SLOTS }, (_, index) => Boolean(source.badges?.[index]));
    }
  }

  function setEditorOpen(open) {
    editor.dataset.open = open ? 'true' : 'false';
    root.classList.toggle('sheet-open', open);
    if (open) {
      renderEditor();
      requestAnimationFrame(() => $('ed-base')?.focus());
    }
  }

  function openEditor(group, index) {
    state.selected = { group, index };
    setEditorOpen(true);
    updateSelectionClasses();
  }

  function cycleEditor(direction) {
    const count = STARTING_XI_SIZE + MAX_BENCH_SIZE;
    let flatIndex = state.selected.group === 'starter'
      ? state.selected.index
      : STARTING_XI_SIZE + state.selected.index;
    flatIndex = (flatIndex + direction + count) % count;
    state.selected = flatIndex < STARTING_XI_SIZE
      ? { group: 'starter', index: flatIndex }
      : { group: 'bench', index: flatIndex - STARTING_XI_SIZE };
    renderEditor();
    updateSelectionClasses();
  }

  function renderFormation() {
    const formation = getFormation(state.formation);
    if (!formation || !chipsEl) return;

    const starterChips = chipsEl.querySelectorAll('.chip[data-group="starter"]');
    starterChips.forEach((chip, index) => {
      const slot = formation.slots[index];
      if (!slot) return;
      chip.style.setProperty('--x', slot.x);
      chip.style.setProperty('--y', slot.y);
      const pos = chip.querySelector('[data-pos]');
      if (pos) pos.textContent = slot.pos;
      chip.setAttribute('aria-label', `Starter ${index + 1}, ${slot.pos}`);
    });

    formationSelect.value = formation.id;
  }

  function renderChip(chip, player, group, index) {
    const position = group === 'starter'
      ? getFormation(state.formation).slots[index]?.pos ?? 'POS'
      : `SUB ${index + 1}`;
    const ovr = playerOvr(player);
    const chipOvr = chip.querySelector('[data-ovr]');
    const chipPos = chip.querySelector('[data-pos]');
    const pips = chip.querySelectorAll('.chip-pips i');

    if (chipPos) chipPos.textContent = position;
    if (chipOvr) chipOvr.textContent = ovr ?? (isValidNumber(player.baseOVR) ? player.baseOVR : '--');
    chip.dataset.tier = tierForOvr(ovr ?? (isValidNumber(player.baseOVR) ? player.baseOVR : null));
    chip.classList.toggle('is-weak', false);
    chip.setAttribute('aria-label', `${group === 'starter' ? 'Starter' : 'Substitute'} ${index + 1}, ${position}, ${ovr ?? (isValidNumber(player.baseOVR) ? player.baseOVR : 'empty')}`);
    pips.forEach((pip, pipIndex) => pip.classList.toggle('on', isValidRank(player.rank) && pipIndex < player.rank));
  }

  function renderChips() {
    if (chipsEl) {
      chipsEl.querySelectorAll('.chip[data-group="starter"]').forEach((chip, index) => {
        renderChip(chip, state.starters[index], 'starter', index);
      });
    }
    if (benchGrid) {
      benchGrid.querySelectorAll('.chip[data-group="bench"]').forEach((chip, index) => {
        renderChip(chip, state.bench[index], 'bench', index);
      });
    }
  }

  function setSelectedRank(rank) {
    const player = selectedPlayer();
    player.rank = isValidRank(rank) ? rank : 0;
    renderEditor();
    renderAll();
  }

  function updateSelectionClasses() {
    document.querySelectorAll('.chip.is-selected').forEach((chip) => chip.classList.remove('is-selected'));
    const selector = `.chip[data-group="${state.selected.group}"][data-index="${state.selected.index}"]`;
    document.querySelector(selector)?.classList.add('is-selected');
  }

  function renderEditor() {
    const player = selectedPlayer();
    const slot = selectedSlot();
    const base = $('ed-base');
    const title = $('ed-title');
    const kicker = $('ed-kicker');
    const preview = $('ed-ovr');
    const msg = $('ed-msg');

    if (!player || !base || !title || !kicker || !preview || !msg) return;

    const label = state.selected.group === 'starter'
      ? `STARTER ${state.selected.index + 1}`
      : `SUBSTITUTE ${state.selected.index + 1}`;

    kicker.textContent = label;
    title.textContent = slot.pos;
    base.value = player.baseOVR ?? '';

    document.querySelectorAll('#ed-rank [data-rank]').forEach((button) => {
      const active = Number(button.dataset.rank) === player.rank;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const ovr = playerOvr(player);
    preview.textContent = ovr ?? '--';
    preview.dataset.tier = tierForOvr(ovr);

    msg.textContent = player.baseOVR === null
      ? `Between ${BASE_OVR_MIN} and ${BASE_OVR_MAX}. Press Enter for the next player.`
      : isValidNumber(player.baseOVR)
        ? `Player OVR: ${player.baseOVR} + Rank ${player.rank}. Press Enter for the next player.`
        : `Base OVR must be between ${BASE_OVR_MIN} and ${BASE_OVR_MAX}.`;
    msg.dataset.bad = player.baseOVR !== null && !isValidNumber(player.baseOVR) ? 'true' : 'false';
    base.setAttribute('aria-invalid', player.baseOVR !== null && !isValidNumber(player.baseOVR) ? 'true' : 'false');
  }

  function baseAverage(players) {
    return players.length ? Math.ceil(players.reduce((sum, player) => sum + player.baseOVR, 0) / players.length) : null;
  }

  function rankAverage(players) {
    return players.length ? Math.ceil(players.reduce((sum, player) => sum + player.rank, 0) / players.length) : null;
  }

  function playerLabel(group, index) {
    return group === 'starter' ? `Starter ${index + 1}` : `Sub ${index + 1}`;
  }

  function setMetric(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function currentMetrics() {
    const startersEntered = state.starters.filter((player) => isValidNumber(player.baseOVR));
    const subsEntered = includedBench();
    const players = [...startersEntered.map((player) => normalizePlayer(player)), ...subsEntered.map((player) => normalizePlayer(player))];
    const complete = players.length >= STARTING_XI_SIZE && players.length <= MAX_SQUAD_SIZE &&
      players.length === STARTING_XI_SIZE + state.bench.filter((player) => isValidNumber(player.baseOVR)).length &&
      players.every(isPlayerFilled);

    const badges = state.badges.filter(Boolean).length;
    const bAvg = baseAverage(players);
    const rAvg = rankAverage(players);
    const estimate = bAvg === null ? null : bAvg + (rAvg ?? 0) + badges;
    const exactResult = complete
      ? calculateTeamOVR({ players, selectedBadges: state.badges.map((enabled) => ({ enabled })), requiredCount: players.length })
      : null;

    return {
      players,
      startersEntered,
      subsEntered,
      complete,
      badges,
      baseAverage: exactResult?.baseAverage ?? bAvg,
      rankAverage: exactResult?.rankAverage ?? rAvg,
      estimate,
      result: exactResult,
    };
  }

  function updateHero(metrics) {
    const value = metrics.result?.teamOVR ?? metrics.estimate;
    setMetric('hero-number', value ?? '--');
    setMetric('eq-base', metrics.baseAverage ?? '--');
    setMetric('eq-rank', metrics.rankAverage ?? '--');
    setMetric('eq-badge', String(metrics.badges));
    setMetric('eq-base-sub', metrics.baseAverage === null ? 'avg --' : 'rounded average');
    setMetric('eq-rank-sub', metrics.rankAverage === null ? 'avg --' : 'rounded average');
    setMetric('eq-badge-sub', `${metrics.badges} of ${MAX_BADGE_SLOTS}`);

    const stateEl = $('hero-state');
    const hero = $('hero');
    if (stateEl) {
      stateEl.dataset.state = metrics.result ? 'exact' : value === null ? 'empty' : 'estimate';
      stateEl.textContent = metrics.result ? `${metrics.players.length}-player exact squad` : value === null ? 'Waiting for players' : 'Live estimate';
    }
    if (hero) hero.dataset.state = metrics.result ? 'exact' : value === null ? 'empty' : 'estimate';

    const arc = $('ring-arc');
    if (arc) {
      const pct = value === null ? 0 : clamp(((value - BASE_OVR_MIN) / (BASE_OVR_MAX + RANK_OPTIONS[RANK_OPTIONS.length - 1] + MAX_BADGE_SLOTS - BASE_OVR_MIN)) * 100, 0, 100);
      arc.style.strokeDasharray = `${Math.max(0, pct)} 100`;
    }

    const hint = $('next-text');
    if (hint) {
      hint.innerHTML = '';
      const text = metrics.result
        ? 'Set a target below to see the cheapest route from this finished squad.'
        : metrics.estimate === null
          ? 'Enter a Base OVR to start the live estimate.'
          : `Keep entering players. The estimate is currently ${metrics.estimate}; the exact result appears when every included player is complete.`;
      hint.textContent = text;
    }
    const planButton = $('next-plan');
    if (planButton) planButton.hidden = !metrics.result;
  }

  function renderBadges(metrics) {
    document.querySelectorAll('.badge[data-badge]').forEach((button, index) => {
      button.setAttribute('aria-pressed', state.badges[index] ? 'true' : 'false');
    });
    setMetric('badge-total', `+${metrics.badges}`);
  }

  function renderList() {
    const list = $('list');
    if (!list) return;
    list.innerHTML = '';

    const makeGroup = (label) => {
      const heading = document.createElement('div');
      heading.className = 'l-group';
      heading.textContent = label;
      list.appendChild(heading);
    };

    const makeRow = (group, index, player) => {
      const row = document.createElement('div');
      row.className = 'lrow';
      row.dataset.group = group;
      row.dataset.index = String(index);

      const who = document.createElement('div');
      who.className = 'l-name';
      const name = document.createElement('b');
      name.textContent = playerLabel(group, index);
      const pos = document.createElement('small');
      pos.textContent = group === 'starter' ? getFormation(state.formation).slots[index].pos : 'SUBSTITUTE';
      who.append(name, pos);

      const base = document.createElement('input');
      base.type = 'text';
      base.inputMode = 'numeric';
      base.maxLength = 3;
      base.placeholder = 'Base';
      base.value = player.baseOVR ?? '';
      base.setAttribute('aria-label', `${name.textContent} Base OVR`);
      base.setAttribute('aria-invalid', player.baseOVR !== null && !isValidNumber(player.baseOVR) ? 'true' : 'false');

      const rank = document.createElement('div');
      rank.className = 'l-rank';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `Lower ${name.textContent} rank`);
      const rankOutput = document.createElement('output');
      rankOutput.textContent = String(player.rank);
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', `Raise ${name.textContent} rank`);
      rank.append(minus, rankOutput, plus);

      const ovr = document.createElement('strong');
      ovr.className = 'l-ovr';
      ovr.dataset.tier = tierForOvr(playerOvr(player));
      ovr.textContent = playerOvr(player) ?? '--';

      row.append(who, base, rank, ovr);
      list.appendChild(row);

      const setBaseFromInput = () => {
        const digits = base.value.replace(/\D/g, '').slice(0, 3);
        base.value = digits;
        player.baseOVR = digits ? Number(digits) : null;
        base.setAttribute('aria-invalid', player.baseOVR !== null && !isValidNumber(player.baseOVR) ? 'true' : 'false');
        renderAll();
      };

      base.addEventListener('input', setBaseFromInput);
      base.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          openEditor(group, index);
        }
      });
      minus.addEventListener('click', () => {
        player.rank = clamp(player.rank - 1, 0, 5);
        renderAll();
      });
      plus.addEventListener('click', () => {
        player.rank = clamp(player.rank + 1, 0, 5);
        renderAll();
      });
      row.addEventListener('click', (event) => {
        if (event.target instanceof HTMLInputElement || event.target.closest('button')) return;
        openEditor(group, index);
      });
    };

    makeGroup('STARTING XI');
    state.starters.forEach((player, index) => makeRow('starter', index, player));
    if (includedBench().length || state.bench.some((player) => isValidNumber(player.baseOVR))) {
      makeGroup('BENCH');
      state.bench.forEach((player, index) => makeRow('bench', index, player));
    }
  }

  function markWeakest(metrics) {
    const entered = allSlots()
      .filter(({ player }) => isValidNumber(player.baseOVR))
      .sort((a, b) => a.player.baseOVR - b.player.baseOVR);

    const lowest = entered[0]?.player.baseOVR ?? null;

    document.querySelectorAll('.chip.is-weak').forEach((chip) => chip.classList.remove('is-weak'));
    if (lowest !== null) {
      entered
        .filter(({ player }) => player.baseOVR === lowest)
        .forEach(({ group, index }) => {
          document.querySelector(`.chip[data-group="${group}"][data-index="${index}"]`)?.classList.add('is-weak');
        });
    }

    const list = $('weak-list');
    if (!list) return;
    list.innerHTML = '';

    if (!entered.length) {
      const empty = document.createElement('div');
      empty.className = 'p-empty';
      empty.textContent = 'Enter a Base OVR to identify the weakest links.';
      list.appendChild(empty);
      return;
    }

    entered.slice(0, 5).forEach(({ group, index, player }) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'w-row';
      row.classList.toggle('is-lowest', player.baseOVR === lowest);
      const rank = document.createElement('span');
      rank.className = 'w-rank';
      rank.textContent = String(index + 1);
      const who = document.createElement('span');
      who.className = 'w-who';
      const name = document.createElement('b');
      name.textContent = playerLabel(group, index);
      const detail = document.createElement('small');
      detail.textContent = group === 'starter' ? getFormation(state.formation).slots[index].pos : 'Bench';
      who.append(name, detail);
      const ovr = document.createElement('strong');
      ovr.className = 'w-ovr';
      ovr.textContent = String(player.baseOVR);
      row.append(rank, who, ovr);
      row.addEventListener('click', () => openEditor(group, index));
      list.appendChild(row);
    });
  }

  function allocation(players, key, amount) {
    let remaining = Math.max(0, amount);
    const result = [];
    players
      .map((player, index) => ({ player, index }))
      .sort((a, b) => a.player[key] - b.player[key])
      .forEach(({ player, index }) => {
        if (remaining <= 0) return;
        const maximum = key === 'baseOVR' ? BASE_OVR_MAX : 5;
        const room = maximum - player[key];
        const add = Math.min(room, remaining);
        if (add > 0) {
          result.push({ player, index, add });
          remaining -= add;
        }
      });
    return { result, remaining };
  }

  function baseDelta(players, target, badges) {
    if (!players.length) return null;
    const n = players.length;
    const rankPart = Math.ceil(players.reduce((sum, player) => sum + player.rank, 0) / n);
    const baseTotal = players.reduce((sum, player) => sum + player.baseOVR, 0);
    const threshold = target - badges - rankPart;
    const needed = (threshold - 1) * n + 1 - baseTotal;
    const capacity = players.reduce((sum, player) => sum + BASE_OVR_MAX - player.baseOVR, 0);
    return needed <= 0 ? 0 : needed <= capacity ? needed : null;
  }

  function rankDelta(players, target, badges) {
    if (!players.length) return null;
    const n = players.length;
    const basePart = Math.ceil(players.reduce((sum, player) => sum + player.baseOVR, 0) / n);
    const rankTotal = players.reduce((sum, player) => sum + player.rank, 0);
    const threshold = target - badges - basePart;
    const needed = (threshold - 1) * n + 1 - rankTotal;
    const capacity = players.reduce((sum, player) => sum + 5 - player.rank, 0);
    return needed <= 0 ? 0 : needed <= capacity ? needed : null;
  }

  function mixedDelta(players, target, badges) {
    if (!players.length) return null;
    const n = players.length;
    const baseTotal = players.reduce((sum, player) => sum + player.baseOVR, 0);
    const rankTotal = players.reduce((sum, player) => sum + player.rank, 0);
    const baseCapacity = players.reduce((sum, player) => sum + BASE_OVR_MAX - player.baseOVR, 0);
    const rankCapacity = players.reduce((sum, player) => sum + 5 - player.rank, 0);
    let best = null;

    for (let delta = 0; delta <= baseCapacity; delta += 1) {
      const basePart = Math.ceil((baseTotal + delta) / n);
      const neededRank = (target - badges - basePart - 1) * n + 1 - rankTotal;
      const rankAdd = Math.max(0, neededRank);
      if (rankAdd > rankCapacity) continue;
      const total = delta + rankAdd;
      if (!best || total < best.total) best = { baseDelta: delta, rankDelta: rankAdd, total };
      if (best && best.total === 0) break;
    }
    return best;
  }

  function makeRoute(name, cost, text, best = false) {
    const article = document.createElement('details');
    article.className = `route${best ? ' is-best' : ''}`;
    if (best) article.open = true;

    const summary = document.createElement('summary');
    const nameWrap = document.createElement('span');
    nameWrap.className = 'route-name';
    const title = document.createElement('b');
    title.textContent = name;
    if (best) {
      const tag = document.createElement('span');
      tag.className = 'route-badge';
      tag.textContent = 'BEST';
      title.append(tag);
    }
    const sub = document.createElement('small');
    sub.textContent = 'fewest total rating-point changes';
    nameWrap.append(title, sub);

    const total = document.createElement('span');
    total.className = 'route-total';
    const strong = document.createElement('strong');
    strong.textContent = String(cost);
    const unit = document.createElement('span');
    unit.textContent = 'TOTAL';
    total.append(strong, unit);
    summary.append(nameWrap, total);

    const body = document.createElement('div');
    body.className = 'route-body';
    const group = document.createElement('div');
    group.className = 'r-group';
    const heading = document.createElement('h4');
    heading.textContent = 'Changes';
    const list = document.createElement('ul');
    list.className = 'r-list';
    text.forEach((line) => {
      const item = document.createElement('li');
      const left = document.createElement('span');
      left.textContent = line;
      item.append(left);
      list.appendChild(item);
    });
    group.append(heading, list);
    body.appendChild(group);
    article.append(summary, body);
    return article;
  }

  function renderPlanner(metrics) {
    const routesEl = $('routes');
    if (!routesEl) return;
    routesEl.innerHTML = '';

    if (metrics.players.length < STARTING_XI_SIZE || !metrics.players.every(isPlayerFilled)) {
      const empty = document.createElement('div');
      empty.className = 'p-empty';
      empty.innerHTML = '<b>Complete every included player.</b> Add all 11 starters and any bench player you want included, with Base OVR and Rank set.';
      routesEl.appendChild(empty);
      return;
    }

    const target = clamp(Number.parseInt($('t-input')?.value || '120', 10) || 120, STARTING_XI_SIZE, BASE_OVR_MAX + RANK_OPTIONS[RANK_OPTIONS.length - 1] + MAX_BADGE_SLOTS);
    const current = metrics.result?.teamOVR ?? metrics.estimate ?? 0;
    if (target <= current) {
      const done = document.createElement('div');
      done.className = 'p-empty p-done';
      done.textContent = `Target reached. Your current Team OVR is ${current}.`;
      routesEl.appendChild(done);
      return;
    }

    const base = baseDelta(metrics.players, target, metrics.badges);
    const rank = rankDelta(metrics.players, target, metrics.badges);
    const mixed = mixedDelta(metrics.players, target, metrics.badges);
    const routes = [];

    if (base !== null) {
      const changes = allocation(metrics.players, 'baseOVR', base).result.map(({ player, index, add }) => `${playerLabel(index < STARTING_XI_SIZE ? 'starter' : 'bench', index < STARTING_XI_SIZE ? index : index - STARTING_XI_SIZE)}: ${player.baseOVR} → ${player.baseOVR + add}`);
      routes.push({ name: 'Base OVR', cost: base, changes: changes.length ? changes : ['No change needed.'] });
    }
    if (rank !== null) {
      const changes = allocation(metrics.players, 'rank', rank).result.map(({ player, index, add }) => `${playerLabel(index < STARTING_XI_SIZE ? 'starter' : 'bench', index < STARTING_XI_SIZE ? index : index - STARTING_XI_SIZE)}: Rank ${player.rank} → Rank ${player.rank + add}`);
      routes.push({ name: 'Rank', cost: rank, changes: changes.length ? changes : ['No change needed.'] });
    }
    if (mixed !== null) {
      const changes = [];
      if (mixed.baseDelta) changes.push(`Base OVR: +${mixed.baseDelta} total`);
      if (mixed.rankDelta) changes.push(`Rank: +${mixed.rankDelta} total`);
      if (!changes.length) changes.push('No change needed.');
      routes.push({ name: 'Mixed', cost: mixed.total, changes });
    }

    routes.sort((a, b) => a.cost - b.cost);
    if (!routes.length) {
      const empty = document.createElement('div');
      empty.className = 'p-empty';
      empty.textContent = 'No route is possible within the current OVR and Rank limits.';
      routesEl.appendChild(empty);
      return;
    }

    routes.forEach((route, index) => routesEl.appendChild(makeRoute(route.name, route.cost, route.changes, index === 0)));
  }

  function renderNextHint(metrics) {
    const target = $('t-input');
    const value = metrics.result?.teamOVR ?? metrics.estimate;
    if (target && !target.value) target.value = String(clamp((value ?? 119) + 1, 11, BASE_OVR_MAX + 5 + MAX_BADGE_SLOTS));

    const nextValue = value === null || value === undefined ? null : value + 1;
    const nextPlan = $('next-plan');
    if (nextPlan) nextPlan.hidden = nextValue === null;
  }

  function renderAll() {
    const metrics = currentMetrics();

    renderFormation();
    renderChips();
    renderList();
    renderBadges(metrics);
    updateHero(metrics);

    setMetric('squad-count', `${metrics.startersEntered.length} / ${STARTING_XI_SIZE}`);
    setMetric('bench-count', String(metrics.subsEntered.length));
    setMetric('eq-base', metrics.baseAverage ?? '--');
    setMetric('eq-rank', metrics.rankAverage ?? '--');
    setMetric('eq-badge', String(metrics.badges));
    setMetric('badge-total', `+${metrics.badges}`);

    renderPlanner(metrics);
    markWeakest(metrics);
    renderNextHint(metrics);

    const dockNumber = $('dock-number');
    const dockState = $('dock-state');
    if (dockNumber) dockNumber.textContent = metrics.result?.teamOVR ?? metrics.estimate ?? '--';
    if (dockState) {
      dockState.textContent = metrics.result ? 'Exact' : 'Estimate';
      dockState.dataset.exact = metrics.result ? 'true' : 'false';
    }

    saveState();
    updateSelectionClasses();
    if (editor.dataset.open === 'true') renderEditor();
  }

  function installChipListeners() {
    document.querySelectorAll('.chip[data-group]').forEach((chip) => {
      chip.addEventListener('click', () => {
        openEditor(chip.dataset.group, Number(chip.dataset.index));
      });
    });
  }

  function installControls() {
    formationSelect?.addEventListener('change', () => {
      state.formation = getFormation(formationSelect.value)?.id ?? DEFAULT_FORMATION;
      renderAll();
    });

    document.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        root.dataset.view = view;
        document.querySelectorAll('[data-view]').forEach((other) => other.setAttribute('aria-pressed', other === button ? 'true' : 'false'));
        const pitchView = $('view-pitch');
        const listView = $('view-list');
        if (pitchView) pitchView.hidden = view !== 'pitch';
        if (listView) listView.hidden = view !== 'list';
        if (view === 'list') setEditorOpen(false);
      });
    });

    $('ed-close')?.addEventListener('click', () => setEditorOpen(false));
    $('ed-prev')?.addEventListener('click', () => cycleEditor(-1));
    $('ed-next-icon')?.addEventListener('click', () => cycleEditor(1));
    $('ed-next')?.addEventListener('click', () => cycleEditor(1));
    $('ed-clear')?.addEventListener('click', () => {
      const player = selectedPlayer();
      player.baseOVR = null;
      player.rank = 0;
      renderAll();
      renderEditor();
    });

    $('ed-minus')?.addEventListener('click', () => {
      const player = selectedPlayer();
      player.baseOVR = isValidNumber(player.baseOVR) ? clamp(player.baseOVR - 1, BASE_OVR_MIN, BASE_OVR_MAX) : BASE_OVR_MIN;
      renderAll();
    });
    $('ed-plus')?.addEventListener('click', () => {
      const player = selectedPlayer();
      player.baseOVR = isValidNumber(player.baseOVR) ? clamp(player.baseOVR + 1, BASE_OVR_MIN, BASE_OVR_MAX) : BASE_OVR_MIN;
      renderAll();
    });

    $('ed-base')?.addEventListener('input', (event) => {
      const player = selectedPlayer();
      const input = event.currentTarget;
      input.value = input.value.replace(/\D/g, '').slice(0, 3);
      player.baseOVR = input.value === '' ? null : Number(input.value);
      renderAll();
      renderEditor();
    });

    $('ed-base')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        cycleEditor(1);
      }
    });

    document.querySelectorAll('#ed-rank [data-rank]').forEach((button) => {
      button.addEventListener('click', () => setSelectedRank(Number(button.dataset.rank)));
    });

    $('t-minus')?.addEventListener('click', () => {
      const input = $('t-input');
      input.value = String(clamp((Number.parseInt(input.value || '120', 10) || 120) - 1, 11, 138));
      renderAll();
    });
    $('t-plus')?.addEventListener('click', () => {
      const input = $('t-input');
      input.value = String(clamp((Number.parseInt(input.value || '120', 10) || 120) + 1, 11, 138));
      renderAll();
    });
    $('t-input')?.addEventListener('input', () => {
      const input = $('t-input');
      input.value = input.value.replace(/\D/g, '').slice(0, 3);
      renderPlanner(currentMetrics());
    });
    document.querySelectorAll('[data-jump]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = $('t-input');
        const current = Number.parseInt(input.value || '120', 10) || 120;
        input.value = String(clamp(current + Number(button.dataset.jump), 11, 138));
        renderPlanner(currentMetrics());
      });
    });

    document.querySelectorAll('.badge[data-badge]').forEach((button, index) => {
      button.addEventListener('click', () => {
        state.badges[index] = !state.badges[index];
        renderAll();
      });
    });

    $('reset')?.addEventListener('click', () => {
      const reset = window.confirm('Reset the entire Team OVR squad?');
      if (!reset) return;
      state.starters = Array.from({ length: STARTING_XI_SIZE }, () => ({ baseOVR: null, rank: 0 }));
      state.bench = Array.from({ length: MAX_BENCH_SIZE }, () => ({ baseOVR: null, rank: 0 }));
      state.badges.fill(false);
      state.formation = DEFAULT_FORMATION;
      formationSelect.value = DEFAULT_FORMATION;
      setEditorOpen(false);
      renderAll();
      showToast('Squad reset');
    });

    $('share')?.addEventListener('click', async () => {
      const hash = `${SHARE_PREFIX}${encodeShareState()}`;
      const url = `${window.location.origin}${window.location.pathname}${hash}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Share link copied');
      } catch {
        window.history.replaceState(null, '', hash);
        showToast('Share state added to the URL');
      }
    });

    $('quick-open')?.addEventListener('click', () => {
      const msg = $('quick-msg');
      const text = $('quick-text');
      if (msg) msg.textContent = '';
      if (text) text.value = '';
      quickDialog?.showModal();
      text?.focus();
    });

    $('quick-apply')?.addEventListener('click', () => {
      const text = $('quick-text');
      const msg = $('quick-msg');
      const values = text?.value.trim().split(/[\s,]+/).filter(Boolean) ?? [];
      if (!values.length) {
        if (msg) msg.textContent = 'Paste at least one Base OVR value.';
        return;
      }

      const players = Array.from({ length: STARTING_XI_SIZE + MAX_BENCH_SIZE }, () => ({ baseOVR: null, rank: 0 }));
      for (let i = 0; i < Math.min(values.length, players.length); i += 1) {
        const match = values[i].match(/^(\d{2,3})(?:\/(\d))?$/);
        if (!match) {
          if (msg) msg.textContent = `Invalid value: ${values[i]}. Use 117 or 117/2.`;
          return;
        }
        const baseOVR = Number(match[1]);
        const rank = match[2] === undefined ? 0 : Number(match[2]);
        if (!isValidNumber(baseOVR) || !isValidRank(rank)) {
          if (msg) msg.textContent = `Value out of range: ${values[i]}.`;
          return;
        }
        players[i] = { baseOVR, rank };
      }

      state.starters = players.slice(0, STARTING_XI_SIZE);
      state.bench = [
        ...players.slice(STARTING_XI_SIZE),
        ...Array.from({ length: MAX_BENCH_SIZE }, () => ({ baseOVR: null, rank: 0 })),
      ].slice(0, MAX_BENCH_SIZE);
      quickDialog?.close();
      setEditorOpen(false);
      renderAll();
      showToast('Squad filled');
    });
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function installDockObserver() {
    const hero = $('hero');
    const dock = $('dock');
    if (!hero || !dock || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      dock.classList.toggle('show', !entry.isIntersecting && root.dataset.view !== 'list');
    }, { threshold: 0.15 });
    observer.observe(hero);
  }

  loadState();
  if (formationSelect) formationSelect.value = state.formation;
  root.dataset.view = 'pitch';
  $('view-pitch').hidden = false;
  $('view-list').hidden = true;
  renderFormation();
  installChipListeners();
  installControls();
  installDockObserver();
  renderAll();
}
