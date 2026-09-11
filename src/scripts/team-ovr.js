import {
  calculateTeamOVR,
  isValidBaseOVR,
  isValidRank,
  STARTING_XI_SIZE,
  MAX_SQUAD_SIZE,
  MAX_BADGE_SLOTS,
  BASE_OVR_MAX,
  RANK_OPTIONS,
} from '../lib/teamOvr.js';

const formation = document.getElementById('formation');
const subsEl = document.getElementById('subs');
const addSub = document.getElementById('add-sub');
const reset = document.getElementById('reset');

if (formation && subsEl && addSub && reset) {
  const state = {
    starters: Array.from(formation.querySelectorAll('.card')).map(() => ({ baseOVR: null, rank: null })),
    subs: [],
    badges: Array(MAX_BADGE_SLOTS).fill(false),
  };

  const $ = (id) => document.getElementById(id);
  const valid = (player) => isValidBaseOVR(player.baseOVR) && isValidRank(player.rank);
  const maxSubs = MAX_SQUAD_SIZE - STARTING_XI_SIZE;
  const allPlayers = () => [...state.starters, ...state.subs];
  const badgeSelection = () => state.badges.map((enabled) => ({ enabled }));
  const sum = (players, key) => players.reduce((total, player) => total + player[key], 0);

  const pitch = formation.closest('.pitch');
  if (pitch) pitch.style.aspectRatio = '2 / 3';

  // Move optional squad inputs above the analysis tools on desktop and mobile.
  const rightCol = document.querySelector('.right-col');
  const subsBlock = document.querySelector('.subs-block');
  const badgesBlock = subsBlock?.nextElementSibling;
  const plannerBlock = rightCol?.querySelector('.planner');
  if (rightCol && subsBlock && badgesBlock && plannerBlock) {
    rightCol.insertBefore(subsBlock, plannerBlock);
    rightCol.insertBefore(badgesBlock, plannerBlock);
  }

  const style = document.createElement('style');
  style.textContent = `
    .pitch{aspect-ratio:2/3!important;height:auto!important}
    .pitch>img{object-fit:fill!important}
    .formation{overflow:visible}
    .card{width:clamp(58px,14%,112px);padding:7px}
    .card-top{gap:3px}.card-top span:last-child{white-space:nowrap;font-size:7px}
    .card input{height:31px;font-size:11px}.card select{height:27px;font-size:8px}
    .subs-block,.badges-block{margin-bottom:20px}
    .subs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .sub{min-width:0}.sub-foot{display:flex;justify-content:space-between;gap:6px;margin-top:9px;padding-top:8px;border-top:1px solid var(--border);font:700 7px var(--mono);color:var(--muted)}
    .sub-foot b{color:var(--blue);font:900 10px var(--mono)}
    @media(max-width:900px){.subs{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:760px){.card{width:58px;padding:5px}.card-top span:last-child{font-size:6px}.card input{height:26px;font-size:9px}.card select{height:23px;font-size:7px}.card-ovr{font-size:8px}.subs{grid-template-columns:1fr}.right-col .subs-block,.right-col .badges-block{margin-bottom:14px}}
    @media(max-width:380px){.card{width:54px;padding:4px}.card-top{margin-bottom:3px}.card-top span:last-child{font-size:5.5px}.card input{height:24px;font-size:8px}.card select{height:21px;font-size:6.5px}.card-ovr{margin-top:3px}}
  `;
  document.head.appendChild(style);

  function playerLabel(index) {
    return `Player ${index + 1}`;
  }

  formation.querySelectorAll('.card').forEach((card, index) => {
    const number = card.querySelector('.card-top span:last-child');
    if (number) number.textContent = playerLabel(index);
  });

  function allocation(players, key, amount) {
    let remaining = amount;
    const result = [];
    [...players]
      .map((player, index) => ({ player, index }))
      .sort((a, b) => a.player[key] - b.player[key])
      .forEach(({ player, index }) => {
        if (remaining <= 0) return;
        const max = key === 'baseOVR' ? BASE_OVR_MAX : 5;
        const room = max - player[key];
        const add = Math.min(room, remaining);
        if (add > 0) {
          result.push({ player, index, add });
          remaining -= add;
        }
      });
    return result;
  }

  function findBaseDelta(players, target, badges) {
    const n = players.length;
    const baseTotal = sum(players, 'baseOVR');
    const rankPart = Math.ceil(sum(players, 'rank') / n);
    const needed = (target - badges - rankPart - 1) * n + 1 - baseTotal;
    const capacity = players.reduce((total, player) => total + BASE_OVR_MAX - player.baseOVR, 0);
    return needed <= 0 ? 0 : needed <= capacity ? needed : null;
  }

  function findRankDelta(players, target, badges) {
    const n = players.length;
    const basePart = Math.ceil(sum(players, 'baseOVR') / n);
    const rankTotal = sum(players, 'rank');
    const needed = (target - badges - basePart - 1) * n + 1 - rankTotal;
    const capacity = players.reduce((total, player) => total + 5 - player.rank, 0);
    return needed <= 0 ? 0 : needed <= capacity ? needed : null;
  }

  function findMixed(players, target, badges) {
    const n = players.length;
    const baseTotal = sum(players, 'baseOVR');
    const rankTotal = sum(players, 'rank');
    const baseCapacity = players.reduce((total, player) => total + BASE_OVR_MAX - player.baseOVR, 0);
    const rankCapacity = players.reduce((total, player) => total + 5 - player.rank, 0);
    let best = null;
    for (let baseDelta = 0; baseDelta <= baseCapacity; baseDelta += 1) {
      const basePart = Math.ceil((baseTotal + baseDelta) / n);
      const neededRank = (target - badges - basePart - 1) * n + 1 - rankTotal;
      const rankDelta = Math.max(0, neededRank);
      if (rankDelta > rankCapacity) continue;
      if (!best || baseDelta + rankDelta < best.baseDelta + best.rankDelta) best = { baseDelta, rankDelta };
    }
    return best;
  }

  function routeText(kind, delta, players) {
    if (delta === 0) return 'No upgrade is required for this route.';
    const key = kind === 'base' ? 'baseOVR' : 'rank';
    return allocation(players, key, delta).map(({ player, index, add }) => kind === 'base'
      ? `${playerLabel(index)}: ${player.baseOVR} → ${player.baseOVR + add} Base OVR`
      : `${playerLabel(index)}: Rank ${player.rank} → Rank ${player.rank + add}`).join('\n');
  }

  function renderSubs() {
    subsEl.innerHTML = '';
    state.subs.forEach((player, index) => {
      const card = document.createElement('article');
      card.className = 'sub';
      card.innerHTML = `<div class="sub-top"><b>SUB ${index + 1}</b><button class="sub-remove" type="button" aria-label="Remove substitute">×</button></div><label>Base OVR<input data-base type="number" min="40" max="${BASE_OVR_MAX}" inputmode="numeric" placeholder="Base OVR"></label><label>Rank<select data-rank><option value="">Rank</option>${RANK_OPTIONS.map((rank) => `<option value="${rank}">Rank ${rank}</option>`).join('')}</select></label><div class="sub-foot"><span>Included in Team OVR</span><b data-sub-ovr>--</b></div>`;
      const base = card.querySelector('[data-base]');
      const rank = card.querySelector('[data-rank]');
      const subOvr = card.querySelector('[data-sub-ovr]');
      base.value = player.baseOVR ?? '';
      rank.value = player.rank ?? '';
      subOvr.textContent = valid(player) ? player.baseOVR + player.rank : '--';
      base.addEventListener('input', () => { player.baseOVR = base.value === '' ? null : Number(base.value); subOvr.textContent = valid(player) ? player.baseOVR + player.rank : isValidBaseOVR(player.baseOVR) ? player.baseOVR : '--'; recompute(); });
      rank.addEventListener('change', () => { player.rank = rank.value === '' ? null : Number(rank.value); subOvr.textContent = valid(player) ? player.baseOVR + player.rank : '--'; recompute(); });
      card.querySelector('.sub-remove').addEventListener('click', () => { state.subs.splice(index, 1); renderSubs(); recompute(); });
      subsEl.appendChild(card);
    });
    addSub.disabled = state.subs.length >= maxSubs;
    addSub.textContent = state.subs.length >= maxSubs ? 'Maximum 7 substitutes' : '+ Add Substitute';
  }

  function renderPlanner(target, players, current, badges) {
    const box = $('planner');
    if (!box) return;
    if (players.length < STARTING_XI_SIZE || players.length > MAX_SQUAD_SIZE || players.some((player) => !valid(player))) {
      box.innerHTML = '<div class="planner-empty">Complete every included player to unlock exact upgrade routes.</div>';
      return;
    }
    if (target <= current) {
      box.innerHTML = `<div class="route best"><div class="route-title"><span>TARGET REACHED</span><b>${current} OVR</b></div><p>Your squad is already at or above the selected target.</p></div>`;
      return;
    }
    const baseDelta = findBaseDelta(players, target, badges);
    const rankDelta = findRankDelta(players, target, badges);
    const mixed = findMixed(players, target, badges);
    const routes = [];
    if (baseDelta !== null) routes.push({ name: 'Base OVR', cost: baseDelta, text: routeText('base', baseDelta, players) });
    if (rankDelta !== null) routes.push({ name: 'Rank', cost: rankDelta, text: routeText('rank', rankDelta, players) });
    if (mixed) routes.push({ name: 'Mixed', cost: mixed.baseDelta + mixed.rankDelta, text: `${mixed.baseDelta ? `+${mixed.baseDelta} total Base OVR` : 'No Base OVR change'}\n${mixed.rankDelta ? `+${mixed.rankDelta} total Rank` : 'No Rank change'}` });
    routes.sort((a, b) => a.cost - b.cost);
    box.innerHTML = routes.length ? routes.map((route, index) => `<div class="route ${index === 0 ? 'best' : ''}"><div class="route-title"><span>${index === 0 ? 'BEST ROUTE · ' : ''}${route.name}</span><b>${route.cost} TOTAL</b></div><p>${route.text.replaceAll('\n', '<br>')}</p></div>`).join('') : '<div class="planner-empty">No route is possible within the current Base OVR and Rank limits.</div>';
  }

  function renderNext(players, current, badges) {
    const number = $('next-number');
    const needed = $('next-needed');
    const routes = $('next-routes');
    const fill = $('meter-fill');
    if (!number || !needed || !routes || !fill) return;
    if (players.length < STARTING_XI_SIZE || players.length > MAX_SQUAD_SIZE || players.some((player) => !valid(player))) {
      number.textContent = '--';
      needed.textContent = 'Complete the squad';
      routes.textContent = 'Enter Base OVR and Rank for every included player to calculate the next exact Team OVR.';
      fill.style.width = '0%';
      return;
    }

    const target = current + 1;
    const baseDelta = findBaseDelta(players, target, badges);
    const rankDelta = findRankDelta(players, target, badges);
    const mixed = findMixed(players, target, badges);
    const costs = [baseDelta, rankDelta, mixed ? mixed.baseDelta + mixed.rankDelta : null].filter((value) => value !== null);
    number.textContent = target;
    if (!costs.length) {
      needed.textContent = 'No route available';
      routes.textContent = `Team OVR ${current} is at the current Base OVR and Rank ceiling.`;
      fill.style.width = '100%';
      return;
    }
    const cheapest = Math.min(...costs);
    needed.textContent = `Minimum change: ${cheapest}`;
    const labels = [];
    if (baseDelta !== null) labels.push(`Base +${baseDelta}`);
    if (rankDelta !== null) labels.push(`Rank +${rankDelta}`);
    if (mixed) labels.push(`Mixed +${mixed.baseDelta + mixed.rankDelta}`);
    routes.textContent = `Exact threshold for ${target} OVR: ${labels.join(' · ')}.`;
    fill.style.width = `${Math.max(10, Math.min(100, 100 / Math.max(1, cheapest)))}%`;
  }

  function renderBottleneck(players, current) {
    const box = $('bottleneck');
    if (!box) return;
    if (players.length < STARTING_XI_SIZE || players.length > MAX_SQUAD_SIZE || players.some((player) => !valid(player))) {
      box.innerHTML = '<div class="planner-empty">Complete every included player to find the lowest OVR bottleneck.</div>';
      return;
    }

    const lowest = Math.min(...players.map((player) => player.baseOVR));
    const lowestPlayers = players.map((player, index) => ({ player, index })).filter(({ player }) => player.baseOVR === lowest);
    const n = players.length;
    const baseTotal = sum(players, 'baseOVR');
    const rankTotal = sum(players, 'rank');
    const basePart = Math.ceil(baseTotal / n);
    const rankPart = Math.ceil(rankTotal / n);
    const baseGap = basePart * n - baseTotal;
    const rankGap = rankPart * n - rankTotal;
    const testIndex = lowestPlayers[0].index;
    const oneStep = players.map((player) => ({ ...player }));
    if (oneStep[testIndex].baseOVR < BASE_OVR_MAX) oneStep[testIndex].baseOVR += 1;
    const after = calculateTeamOVR({ players: oneStep, selectedBadges: badgeSelection(), requiredCount: n });
    const gain = after.complete ? after.teamOVR - current : 0;
    const names = lowestPlayers.map(({ index }) => playerLabel(index)).join(', ');

    box.innerHTML = `<div class="bottleneck-card"><div class="bottleneck-ovr">${lowest}</div><div><strong>${names}</strong><p>Lowest Base OVR: ${lowest}. A +1 Base OVR test gives ${gain > 0 ? `+${gain} Team OVR` : 'no immediate Team OVR increase'} at the current threshold. Base average gap: ${baseGap}. Rank average gap: ${rankGap}.</p></div></div>`;
  }

  function recompute() {
    const players = allPlayers();
    const validBase = players.filter((player) => isValidBaseOVR(player.baseOVR));
    const validRank = players.filter((player) => isValidRank(player.rank));
    const complete = players.filter(valid);
    const badgeBonus = state.badges.filter(Boolean).length;
    const baseAverage = validBase.length ? Math.ceil(sum(validBase, 'baseOVR') / validBase.length) : null;
    const rankAverage = validRank.length ? Math.ceil(sum(validRank, 'rank') / validRank.length) : null;
    const exact = players.length >= STARTING_XI_SIZE && players.length <= MAX_SQUAD_SIZE && complete.length === players.length;
    const result = exact ? calculateTeamOVR({ players, selectedBadges: badgeSelection(), requiredCount: players.length }) : null;
    const estimate = baseAverage === null ? null : baseAverage + (rankAverage ?? 0) + badgeBonus;

    $('starter-count').textContent = `${state.starters.filter(valid).length} / ${STARTING_XI_SIZE}`;
    $('sub-count').textContent = `${state.subs.length} included`;
    $('badge-total').textContent = `+${badgeBonus} OVR`;
    $('base-avg').textContent = result?.baseAverage ?? baseAverage ?? '--';
    $('rank-avg').textContent = result?.rankAverage ?? rankAverage ?? '--';
    $('badge-avg').textContent = `+${badgeBonus}`;
    $('result-number').textContent = result?.teamOVR ?? estimate ?? '--';
    $('result-label').textContent = exact ? 'YOUR TEAM OVR' : 'LIVE ESTIMATE';
    $('result-status').textContent = exact ? `${players.length}-player squad · Exact formula` : `Based on ${validBase.length} Base OVR${validBase.length === 1 ? '' : 's'} entered so far`;
    $('break-base').textContent = result?.baseAverage ?? baseAverage ?? '--';
    $('break-rank').textContent = result?.rankAverage ?? rankAverage ?? '--';
    $('break-badge').textContent = `+${badgeBonus}`;
    $('break-total').textContent = result?.teamOVR ?? estimate ?? '--';
    $('planner-current').textContent = result?.teamOVR ?? estimate ?? '--';

    formation.querySelectorAll('.card').forEach((card, index) => {
      const player = state.starters[index];
      const cardOvr = card.querySelector('[data-card-ovr]');
      cardOvr.textContent = valid(player) ? player.baseOVR + player.rank : isValidBaseOVR(player.baseOVR) ? player.baseOVR : '--';
    });

    const math = $('math');
    if (result?.complete) {
      math.textContent = `Base OVR\n${result.totalBase} ÷ ${result.squadSize} = ${(result.totalBase / result.squadSize).toFixed(2)} → ${result.baseAverage}\n\nRank\n${result.totalRank} ÷ ${result.squadSize} = ${(result.totalRank / result.squadSize).toFixed(2)} → ${result.rankAverage}\n\nBadges\n+${result.badgeBonus}\n\nTeam OVR\n${result.baseAverage} + ${result.rankAverage} + ${result.badgeBonus} = ${result.teamOVR}`;
    } else {
      math.textContent = estimate === null ? 'Enter a Base OVR to see the live calculation.' : `Live estimate\nBase average: ${baseAverage}\nRank average: ${rankAverage ?? 0}\nBadges: +${badgeBonus}\n\nEstimated Team OVR: ${estimate}`;
    }

    const target = Number($('target-ovr').value) || 120;
    renderPlanner(target, players, result?.teamOVR ?? estimate ?? 0, badgeBonus);
    renderNext(players, result?.teamOVR ?? 0, badgeBonus);
    renderBottleneck(players, result?.teamOVR ?? 0);
  }

  formation.querySelectorAll('.card').forEach((card, index) => {
    const player = state.starters[index];
    const base = card.querySelector('[data-field="baseOVR"]');
    const rank = card.querySelector('[data-field="rank"]');
    base.addEventListener('input', () => { player.baseOVR = base.value === '' ? null : Number(base.value); recompute(); });
    rank.addEventListener('change', () => { player.rank = rank.value === '' ? null : Number(rank.value); recompute(); });
  });

  addSub.addEventListener('click', () => {
    if (state.subs.length >= maxSubs) return;
    state.subs.push({ id: Date.now() + Math.random(), baseOVR: null, rank: null });
    renderSubs();
    recompute();
  });

  document.querySelectorAll('[data-badge]').forEach((checkbox, index) => checkbox.addEventListener('change', () => { state.badges[index] = checkbox.checked; recompute(); }));
  $('target-ovr')?.addEventListener('input', recompute);

  reset.addEventListener('click', () => {
    if (!window.confirm('Reset the squad?')) return;
    state.starters.forEach((player) => { player.baseOVR = null; player.rank = null; });
    state.subs = [];
    state.badges.fill(false);
    formation.querySelectorAll('[data-field="baseOVR"]').forEach((input) => { input.value = ''; });
    formation.querySelectorAll('[data-field="rank"]').forEach((select) => { select.value = ''; });
    document.querySelectorAll('[data-badge]').forEach((checkbox) => { checkbox.checked = false; });
    renderSubs();
    recompute();
  });

  renderSubs();
  recompute();
}
