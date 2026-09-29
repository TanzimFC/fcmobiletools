import {
  calculateTeamOVR,
  isValidBaseOVR,
  isValidRank,
  STARTING_XI_SIZE,
  MAX_SQUAD_SIZE,
  MAX_BADGE_SLOTS,
  BASE_OVR_MIN,
  BASE_OVR_MAX,
  RANK_OPTIONS,
} from '../lib/teamOvr.js';

const formation = document.getElementById('formation');
const subsEl = document.getElementById('subs');
const addSub = document.getElementById('add-sub');
const reset = document.getElementById('reset');

if (formation && subsEl && addSub && reset) {
  const state = {
    starters: Array.from(formation.querySelectorAll('.card')).map(() => ({ baseOVR: null, rank: 0 })),
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
    .sub-empty[hidden]{display:none!important}
    .card{width:clamp(58px,14%,112px);padding:7px}
    .card-top{gap:3px}.card-top span:last-child{white-space:nowrap;font-size:7px}
    .card input{height:31px;font-size:11px}.card select{height:27px;font-size:8px}
    .subs-block,.badges-block{margin-bottom:20px}
    .subs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .sub{min-width:0}.sub-foot{display:flex;justify-content:space-between;gap:6px;margin-top:9px;padding-top:8px;border-top:1px solid var(--border);font:700 7px var(--mono);color:var(--muted)}
    .sub-foot b{color:var(--blue);font:900 10px var(--mono)}
    .badges{display:flex!important;flex-direction:column!important;gap:10px!important;width:100%}
    .badge{width:100%!important;box-sizing:border-box!important;min-width:0!important}
    @media(max-width:760px){.card{width:58px;padding:5px}.card-top span:last-child{font-size:6px}.card input{height:26px;font-size:9px}.card select{height:23px;font-size:7px}.card-ovr{font-size:8px}.subs{grid-template-columns:1fr}.right-col .subs-block,.right-col .badges-block{margin-bottom:14px}}
    @media(max-width:380px){.card{width:54px;padding:4px}.card-top{margin-bottom:3px}.card-top span:last-child{font-size:5.5px}.card input{height:24px;font-size:8px}.card select{height:21px;font-size:6.5px}.card-ovr{margin-top:3px}}
  `;
  document.head.appendChild(style);

  formation.querySelectorAll('.card select[data-field="rank"]').forEach((select) => {
    select.value = '0';
  });

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
    if (!n) return null;
    const baseTotal = sum(players, 'baseOVR');
    const rankPart = Math.ceil(sum(players, 'rank') / n);
    const needed = (target - badges - rankPart - 1) * n + 1 - baseTotal;
    const capacity = players.reduce((total, player) => total + BASE_OVR_MAX - player.baseOVR, 0);
    return needed <= 0 ? 0 : needed <= capacity ? needed : null;
  }

  function findRankDelta(players, target, badges, basePlayers = players) {
    const n = players.length;
    if (!n || !basePlayers.length) return null;
    const basePart = Math.ceil(sum(basePlayers, 'baseOVR') / basePlayers.length);
    const rankTotal = sum(players, 'rank');
    const needed = (target - badges - basePart - 1) * n + 1 - rankTotal;
    const capacity = players.reduce((total, player) => total + 5 - player.rank, 0);
    return needed <= 0 ? 0 : needed <= capacity ? needed : null;
  }

  function findMixed(players, target, badges) {
    const basePlayers = players.filter((player) => isValidBaseOVR(player.baseOVR));
    const rankPlayers = players.filter((player) => isValidRank(player.rank));
    if (!basePlayers.length) return null;
    const nBase = basePlayers.length;
    const nRank = rankPlayers.length;
    const baseTotal = sum(basePlayers, 'baseOVR');
    const rankTotal = nRank ? sum(rankPlayers, 'rank') : 0;
    const baseCapacity = basePlayers.reduce((total, player) => total + BASE_OVR_MAX - player.baseOVR, 0);
    const rankCapacity = rankPlayers.reduce((total, player) => total + 5 - player.rank, 0);
    let best = null;
    for (let baseDelta = 0; baseDelta <= baseCapacity; baseDelta += 1) {
      const basePart = Math.ceil((baseTotal + baseDelta) / nBase);
      if (!nRank) {
        if (basePart + badges >= target) {
          best = { baseDelta, rankDelta: 0 };
          break;
        }
        continue;
      }
      const neededRank = (target - badges - basePart - 1) * nRank + 1 - rankTotal;
      const rankDelta = Math.max(0, neededRank);
      if (rankDelta > rankCapacity) continue;
      if (!best || baseDelta + rankDelta < best.baseDelta + best.rankDelta) {
        best = { baseDelta, rankDelta };
      }
    }
    return best;
  }

  function routeText(kind, delta, players, sourceIndices = null) {
    if (delta === 0) return 'No upgrade is required for this route.';
    const key = kind === 'base' ? 'baseOVR' : 'rank';
    return allocation(players, key, delta).map(({ player, index, add }) => {
      const displayIndex = sourceIndices?.[index] ?? index;
      return kind === 'base'
        ? `${playerLabel(displayIndex)}: ${player.baseOVR} → ${player.baseOVR + add} Base OVR`
        : `${playerLabel(displayIndex)}: Rank ${player.rank} → Rank ${player.rank + add}`;
    }).join('\n');
  }

  function renderSubs() {
    subsEl.innerHTML = '';
    state.subs.forEach((player, index) => {
      const card = document.createElement('article');
      card.className = 'sub';
      card.innerHTML = `<div class="sub-top"><b>SUB ${index + 1}</b><button class="sub-remove" type="button" aria-label="Remove substitute">×</button></div><label>Base OVR<input data-base type="number" min="${BASE_OVR_MIN}" max="${BASE_OVR_MAX}" inputmode="numeric" placeholder="Base OVR"></label><label>Rank<select data-rank><option value="0">Rank 0</option>${RANK_OPTIONS.filter((rank) => rank !== 0).map((rank) => `<option value="${rank}">Rank ${rank}</option>`).join('')}</select></label><div class="sub-foot"><span>Included in Team OVR</span><b data-sub-ovr>--</b></div>`;
      const base = card.querySelector('[data-base]');
      const rank = card.querySelector('[data-rank]');
      const subOvr = card.querySelector('[data-sub-ovr]');
      base.value = player.baseOVR ?? '';
      rank.value = player.rank ?? 0;
      subOvr.textContent = valid(player) ? player.baseOVR + player.rank : '--';
      base.addEventListener('input', () => { player.baseOVR = base.value === '' ? null : Number(base.value); subOvr.textContent = valid(player) ? player.baseOVR + player.rank : isValidBaseOVR(player.baseOVR) ? player.baseOVR : '--'; recompute(); });
      rank.addEventListener('change', () => { player.rank = rank.value === '' ? null : Number(rank.value); subOvr.textContent = valid(player) ? player.baseOVR + player.rank : '--'; recompute(); });
      card.querySelector('.sub-remove').addEventListener('click', () => { state.subs.splice(index, 1); renderSubs(); recompute(); });
      subsEl.appendChild(card);
    });
    const emptyState = $('sub-empty');
    if (emptyState) emptyState.hidden = state.subs.length > 0;
    const count = $('sub-count');
    if (count) count.textContent = String(state.subs.length);
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
    const rankPlayers = players.map((player, index) => ({ player, index })).filter(({ player }) => isValidRank(player.rank));
    const rankSourceIndices = rankPlayers.map(({ index }) => index);
    const rankValues = rankPlayers.map(({ player }) => player);
    if (baseDelta !== null) routes.push({ name: 'Base OVR', cost: baseDelta, text: routeText('base', baseDelta, players) });
    if (rankDelta !== null) routes.push({ name: 'Rank', cost: rankDelta, text: routeText('rank', rankDelta, rankValues, rankSourceIndices) });
    if (mixed) routes.push({ name: 'Mixed', cost: mixed.baseDelta + mixed.rankDelta, text: `${mixed.baseDelta ? `+${mixed.baseDelta} total Base OVR` : 'No Base OVR change'}\n${mixed.rankDelta ? `+${mixed.rankDelta} total Rank` : 'No Rank change'}` });
    routes.sort((a, b) => a.cost - b.cost);
    box.innerHTML = routes.length ? routes.map((route, index) => `<div class="route ${index === 0 ? 'best' : ''}"><div class="route-title"><span>${index === 0 ? 'BEST ROUTE · ' : ''}${route.name}</span><b>${route.cost} TOTAL</b></div><p>${route.text.replaceAll('\n', '<br>')}</p></div>`).join('') : '<div class="planner-empty">No route is possible within the current Base OVR and Rank limits.</div>';
  }

  // Rebuilt from scratch: this feature never waits for a complete squad.
  // It uses whatever valid values have already been entered and updates on every input.
  function renderNext() {
    const number = $('next-number');
    const needed = $('next-needed');
    const routes = $('next-routes');
    const fill = $('meter-fill');
    if (!number || !needed || !routes || !fill) return;

    const players = allPlayers();
    const badges = state.badges.filter(Boolean).length;
    const exact = players.length >= STARTING_XI_SIZE
      && players.length <= MAX_SQUAD_SIZE
      && players.every(valid);

    if (!exact) {
      number.textContent = '--';
      needed.textContent = 'Complete the lineup';
      routes.textContent = `Enter Base OVR for all ${STARTING_XI_SIZE} starting players${players.length > STARTING_XI_SIZE ? ' and any added substitutes' : ''} to calculate the next exact Team OVR.`;
      fill.style.width = '0%';
      return;
    }

    const result = calculateTeamOVR({
      players,
      selectedBadges: badgeSelection(),
      requiredCount: players.length,
    });
    if (!result.complete) {
      number.textContent = '--';
      needed.textContent = 'Complete the lineup';
      routes.textContent = 'Complete every included player to calculate the next exact Team OVR.';
      fill.style.width = '0%';
      return;
    }

    const target = result.teamOVR + 1;
    const baseDelta = findBaseDelta(players, target, badges);
    const rankDelta = findRankDelta(players, target, badges);
    const mixed = findMixed(players, target, badges);
    const costs = [baseDelta, rankDelta, mixed ? mixed.baseDelta + mixed.rankDelta : null].filter((value) => value !== null);

    number.textContent = target;
    if (!costs.length) {
      needed.textContent = 'No route available';
      routes.textContent = 'Every included player is already at the current Base OVR and Rank ceiling.';
      fill.style.width = '100%';
      return;
    }

    const cheapest = Math.min(...costs);
    needed.textContent = `Minimum change: ${cheapest}`;
    const labels = [];
    if (baseDelta !== null) labels.push(`Base +${baseDelta}`);
    if (rankDelta !== null) labels.push(`Rank +${rankDelta}`);
    if (mixed) labels.push(`Mixed +${mixed.baseDelta + mixed.rankDelta}`);
    routes.textContent = `Next exact Team OVR: ${target} · ${labels.join(' · ')}.`;
    fill.style.width = `${Math.max(10, Math.min(100, 100 / Math.max(1, cheapest)))}%`;
  }

  // Rebuilt from scratch: bottleneck is Base OVR only, so one player is enough.
  // It immediately shows every player tied for the lowest entered Base OVR.
  function renderBottleneck() {
    const box = $('bottleneck');
    if (!box) return;

    const players = allPlayers();
    const entered = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => isValidBaseOVR(player.baseOVR));

    if (!entered.length) {
      box.innerHTML = '<div class="planner-empty">Enter a Base OVR to find the lowest player. Rank is not required.</div>';
      return;
    }

    const lowest = Math.min(...entered.map(({ player }) => player.baseOVR));
    const lowestPlayers = entered.filter(({ player }) => player.baseOVR === lowest);
    const names = lowestPlayers.map(({ index }) => playerLabel(index)).join(', ');
    const nextHigher = Math.min(...entered.filter(({ player }) => player.baseOVR > lowest).map(({ player }) => player.baseOVR).concat(BASE_OVR_MAX));
    const gap = nextHigher > lowest && nextHigher < BASE_OVR_MAX ? nextHigher - lowest : 0;

    box.innerHTML = `<div class="bottleneck-card"><div class="bottleneck-ovr">${lowest}</div><div><strong>${names}</strong><p>Lowest entered Base OVR. ${lowestPlayers.length === 1 ? 'This player is the current bottleneck.' : 'These players are tied for the current bottleneck.'}${gap ? ` Next entered Base OVR is ${nextHigher}, a ${gap}-point gap.` : ''}</p></div></div>`;
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

    $('starter-count').textContent = `${state.starters.filter(valid).length} / ${STARTING_XI_SIZE}`;
    $('sub-count').textContent = String(state.subs.length);
    $('badge-total').textContent = `+${badgeBonus} OVR`;
    $('base-avg').textContent = result?.baseAverage ?? '--';
    $('rank-avg').textContent = result?.rankAverage ?? '--';
    $('badge-avg').textContent = `+${badgeBonus}`;
    $('result-number').textContent = result?.teamOVR ?? '--';
    $('result-label').textContent = exact ? 'YOUR TEAM OVR' : 'SQUAD INCOMPLETE';
    $('result-status').textContent = exact
      ? `${players.length}-player squad · Exact formula`
      : `Enter Base OVR for all ${STARTING_XI_SIZE} starting players${players.length > STARTING_XI_SIZE ? ' and any added substitutes' : ''} to calculate Team OVR`;
    $('break-base').textContent = result?.baseAverage ?? '--';
    $('break-rank').textContent = result?.rankAverage ?? '--';
    $('break-badge').textContent = `+${badgeBonus}`;
    $('break-total').textContent = result?.teamOVR ?? '--';
    $('planner-current').textContent = result?.teamOVR ?? '--';

    formation.querySelectorAll('.card').forEach((card, index) => {
      const player = state.starters[index];
      const cardOvr = card.querySelector('[data-card-ovr]');
      cardOvr.textContent = valid(player) ? player.baseOVR + player.rank : isValidBaseOVR(player.baseOVR) ? player.baseOVR : '--';
    });

    const math = $('math');
    if (result?.complete) {
      math.textContent = `Base OVR\n${result.totalBase} ÷ ${result.squadSize} = ${(result.totalBase / result.squadSize).toFixed(2)} → ${result.baseAverage}\n\nRank\n${result.totalRank} ÷ ${result.squadSize} = ${(result.totalRank / result.squadSize).toFixed(2)} → ${result.rankAverage}\n\nBadges\n+${result.badgeBonus}\n\nTeam OVR\n${result.baseAverage} + ${result.rankAverage} + ${result.badgeBonus} = ${result.teamOVR}`;
    } else {
      math.textContent = 'Complete every included player to see the exact Team OVR calculation.';
    }

    const target = Number($('target-ovr').value) || 120;
    renderPlanner(target, players, result?.teamOVR ?? 0, badgeBonus);
    renderNext();
    renderBottleneck();
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
    state.subs.push({ id: Date.now() + Math.random(), baseOVR: null, rank: 0 });
    renderSubs();
    recompute();
  });

  document.querySelectorAll('[data-badge]').forEach((checkbox, index) => checkbox.addEventListener('change', () => { state.badges[index] = checkbox.checked; recompute(); }));
  $('target-ovr')?.addEventListener('input', recompute);

  reset.addEventListener('click', () => {
    if (!window.confirm('Reset the squad?')) return;
    state.starters.forEach((player) => { player.baseOVR = null; player.rank = 0; });
    state.subs = [];
    state.badges.fill(false);
    formation.querySelectorAll('[data-field="baseOVR"]').forEach((input) => { input.value = ''; });
    formation.querySelectorAll('[data-field="rank"]').forEach((select) => { select.value = '0'; });
    document.querySelectorAll('[data-badge]').forEach((checkbox) => { checkbox.checked = false; });
    renderSubs();
    recompute();
  });

  renderSubs();
  recompute();
}
