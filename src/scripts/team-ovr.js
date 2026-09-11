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

  // The field asset is exactly 1024x1536, so keep its 2:3 ratio at every breakpoint.
  const pitch = formation.closest('.pitch');
  if (pitch) pitch.style.aspectRatio = '2 / 3';

  // Keep the portrait field usable on phones while retaining the same 2:3 geometry.
  const style = document.createElement('style');
  style.textContent = `
    .pitch{aspect-ratio:2/3!important;height:auto!important}
    .pitch>img{object-fit:fill!important}
    .formation{overflow:visible}
    .card{width:clamp(62px,14%,112px);padding:8px}
    .subs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .sub{min-width:0}
    @media(max-width:900px){.subs{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:760px){.card{width:clamp(62px,16%,92px);padding:6px}.subs{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:480px){.card{width:62px;padding:5px}.subs{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  function playerLabel(index) {
    if (index < STARTING_XI_SIZE) {
      const position = formation.querySelectorAll('.card')[index]?.querySelector('.position')?.textContent?.trim() || `Player ${index + 1}`;
      const same = Array.from(formation.querySelectorAll('.card')).slice(0, index).filter((card) => card.querySelector('.position')?.textContent?.trim() === position).length;
      return same ? `${position} ${same + 1}` : position;
    }
    return `Sub ${index - STARTING_XI_SIZE + 1}`;
  }

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

  function thresholdDelta(players, target, badges, baseDelta = 0) {
    const n = players.length;
    const baseTotal = sum(players, 'baseOVR') + baseDelta;
    const rankTotal = sum(players, 'rank');
    const basePart = Math.ceil(baseTotal / n);
    const neededRank = (target - badges - basePart - 1) * n + 1 - rankTotal;
    return Math.max(0, neededRank);
  }

  function findBaseDelta(players, target, badges) {
    const n = players.length;
    const baseTotal = sum(players, 'baseOVR');
    const rankPart = Math.ceil(sum(players, 'rank') / n);
    const neededBase = (target - badges - rankPart - 1) * n + 1 - baseTotal;
    const capacity = players.reduce((total, player) => total + BASE_OVR_MAX - player.baseOVR, 0);
    return neededBase <= 0 ? 0 : neededBase <= capacity ? neededBase : null;
  }

  function findRankDelta(players, target, badges) {
    const n = players.length;
    const basePart = Math.ceil(sum(players, 'baseOVR') / n);
    const rankTotal = sum(players, 'rank');
    const neededRank = (target - badges - basePart - 1) * n + 1 - rankTotal;
    const capacity = players.reduce((total, player) => total + 5 - player.rank, 0);
    return neededRank <= 0 ? 0 : neededRank <= capacity ? neededRank : null;
  }

  function findMixed(players, target, badges) {
    const baseCapacity = players.reduce((total, player) => total + BASE_OVR_MAX - player.baseOVR, 0);
    const rankCapacity = players.reduce((total, player) => total + 5 - player.rank, 0);
    let best = null;

    // Only one dimension needs a small linear scan. The actual threshold math is exact.
    for (let baseDelta = 0; baseDelta <= baseCapacity; baseDelta += 1) {
      const rankDelta = thresholdDelta(players, target, badges, baseDelta);
      if (rankDelta > rankCapacity) continue;
      const cost = baseDelta + rankDelta;
      if (!best || cost < best.baseDelta + best.rankDelta) {
        best = { baseDelta, rankDelta };
      }
    }
    return best;
  }

  function routeText(kind, delta, players) {
    if (delta === 0) return 'No upgrade is required for this route.';
    const key = kind === 'base' ? 'baseOVR' : 'rank';
    return allocation(players, key, delta)
      .map(({ player, index, add }) => {
        const label = playerLabel(index);
        if (kind === 'base') return `${label}: ${player.baseOVR} → ${player.baseOVR + add} Base OVR`;
        return `${label}: Rank ${player.rank} → Rank ${player.rank + add}`;
      })
      .join('\n');
  }

  function renderSubs() {
    subsEl.innerHTML = '';
    state.subs.forEach((player, index) => {
      const card = document.createElement('article');
      card.className = 'sub';
      card.innerHTML = `
        <div class="sub-top">
          <b>SUB ${index + 1}</b>
          <button class="sub-remove" type="button" aria-label="Remove substitute">×</button>
        </div>
        <label>Base OVR
          <input data-base type="number" min="40" max="${BASE_OVR_MAX}" inputmode="numeric" placeholder="Base OVR">
        </label>
        <label>Rank
          <select data-rank>
            <option value="">Rank</option>
            ${RANK_OPTIONS.map((rank) => `<option value="${rank}">Rank ${rank}</option>`).join('')}
          </select>
        </label>
        <div class="sub-foot"><span>Included in Team OVR</span><b data-sub-ovr>--</b></div>
      `;

      const base = card.querySelector('[data-base]');
      const rank = card.querySelector('[data-rank]');
      const subOvr = card.querySelector('[data-sub-ovr]');
      base.value = player.baseOVR ?? '';
      rank.value = player.rank ?? '';
      subOvr.textContent = valid(player) ? player.baseOVR + player.rank : '--';

      base.addEventListener('input', () => {
        player.baseOVR = base.value === '' ? null : Number(base.value);
        subOvr.textContent = valid(player) ? player.baseOVR + player.rank : isValidBaseOVR(player.baseOVR) ? player.baseOVR : '--';
        recompute();
      });
      rank.addEventListener('change', () => {
        player.rank = rank.value === '' ? null : Number(rank.value);
        subOvr.textContent = valid(player) ? player.baseOVR + player.rank : '--';
        recompute();
      });
      card.querySelector('.sub-remove').addEventListener('click', () => {
        state.subs.splice(index, 1);
        renderSubs();
        recompute();
      });
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
    if (mixed) {
      const baseText = mixed.baseDelta ? `+${mixed.baseDelta} total Base OVR` : 'No Base OVR change';
      const rankText = mixed.rankDelta ? `+${mixed.rankDelta} total Rank` : 'No Rank change';
      routes.push({ name: 'Mixed', cost: mixed.baseDelta + mixed.rankDelta, text: `${baseText}\n${rankText}` });
    }

    routes.sort((a, b) => a.cost - b.cost);
    box.innerHTML = routes.length
      ? routes.map((route, index) => `
        <div class="route ${index === 0 ? 'best' : ''}">
          <div class="route-title"><span>${index === 0 ? 'BEST ROUTE · ' : ''}${route.name}</span><b>${route.cost} TOTAL</b></div>
          <p>${route.text.replaceAll('\n', '<br>')}</p>
        </div>`).join('')
      : '<div class="planner-empty">No route is possible within the current Base OVR and Rank limits.</div>';
  }

  function renderNext(players, current, badges) {
    const nextNumber = $('next-number');
    const nextNeeded = $('next-needed');
    const nextRoutes = $('next-routes');
    const fill = $('meter-fill');
    if (!nextNumber || !nextNeeded || !nextRoutes || !fill) return;

    if (players.length < STARTING_XI_SIZE || players.length > MAX_SQUAD_SIZE || players.some((player) => !valid(player))) {
      nextNumber.textContent = '--';
      nextNeeded.textContent = 'Enter an exact squad';
      nextRoutes.textContent = 'Complete every included player for exact threshold routes.';
      fill.style.width = '0%';
      return;
    }

    const target = current + 1;
    const baseDelta = findBaseDelta(players, target, badges);
    const rankDelta = findRankDelta(players, target, badges);
    nextNumber.textContent = target;

    const routes = [];
    if (baseDelta !== null) routes.push(`+${baseDelta} Base OVR`);
    if (rankDelta !== null) routes.push(`+${rankDelta} Rank`);
    nextNeeded.textContent = routes.length ? routes.join(' or ') : 'No route available within limits';
    nextRoutes.textContent = routes.length ? `Exact threshold: ${routes.join(' or ')}.` : 'The squad is at the current upgrade ceiling.';

    // Show progress toward the next whole Team OVR using the actual minimum upgrade cost.
    const costs = [baseDelta, rankDelta].filter((value) => value !== null);
    const cheapest = costs.length ? Math.min(...costs) : 0;
    fill.style.width = `${costs.length ? Math.max(8, Math.min(100, 100 - cheapest * 8)) : 0}%`;
  }

  function renderBottleneck(players, current, badges) {
    const box = $('bottleneck');
    if (!box) return;
    if (players.length < STARTING_XI_SIZE || players.length > MAX_SQUAD_SIZE || players.some((player) => !valid(player))) {
      box.innerHTML = '<div class="planner-empty">Complete every included player to find the exact OVR bottleneck.</div>';
      return;
    }

    const n = players.length;
    const baseTotal = sum(players, 'baseOVR');
    const rankTotal = sum(players, 'rank');
    const basePart = Math.ceil(baseTotal / n);
    const rankPart = Math.ceil(rankTotal / n);
    const baseToNext = basePart * n - baseTotal;
    const rankToNext = rankPart * n - rankTotal;

    const candidates = players.map((player, index) => {
      const room = BASE_OVR_MAX - player.baseOVR;
      const onePoint = Math.min(room, Math.max(1, baseToNext + 1));
      const copy = players.map((item) => ({ ...item }));
      copy[index].baseOVR += onePoint;
      const after = calculateTeamOVR({ players: copy, selectedBadges: badgeSelection(), requiredCount: n });
      return { player, index, onePoint, after: after.teamOVR, gain: after.teamOVR - current };
    }).sort((a, b) => b.gain - a.gain || a.player.baseOVR - b.player.baseOVR);

    const best = candidates[0];
    const label = playerLabel(best.index);
    const nextBaseThreshold = baseTotal + baseToNext + 1;
    const canIncreaseBase = best.player.baseOVR < BASE_OVR_MAX;
    const thresholdGain = best.gain > 0
      ? `+${best.gain} Team OVR after +${best.onePoint} Base OVR`
      : canIncreaseBase
        ? `${Math.max(1, nextBaseThreshold - baseTotal)} total Base OVR is needed for the next Base contribution point`
        : 'Already at the Base OVR ceiling';

    box.innerHTML = `
      <div class="bottleneck-card">
        <div class="bottleneck-ovr">${best.player.baseOVR}</div>
        <div>
          <strong>${label} · ${best.player.baseOVR} Base OVR</strong>
          <p>${thresholdGain}. Current Team OVR is ${current}. Base threshold gap: ${baseToNext} point${baseToNext === 1 ? '' : 's'} to the current Base average boundary. Rank threshold gap: ${rankToNext} point${rankToNext === 1 ? '' : 's'} to the current Rank average boundary.</p>
        </div>
      </div>`;
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
    const result = exact
      ? calculateTeamOVR({ players, selectedBadges: badgeSelection(), requiredCount: players.length })
      : null;
    const estimate = baseAverage === null ? null : baseAverage + (rankAverage ?? 0) + badgeBonus;

    $('starter-count').textContent = `${state.starters.filter(valid).length} / ${STARTING_XI_SIZE}`;
    $('sub-count').textContent = `${state.subs.length} included`;
    $('badge-total').textContent = `+${badgeBonus} OVR`;
    $('base-avg').textContent = baseAverage ?? '--';
    $('rank-avg').textContent = rankAverage ?? '--';
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
      math.textContent = estimate === null
        ? 'Enter a Base OVR to see the live calculation.'
        : `Live estimate\nBase average: ${baseAverage}\nRank average: ${rankAverage ?? 0}\nBadges: +${badgeBonus}\n\nEstimated Team OVR: ${estimate}`;
    }

    const target = Number($('target-ovr').value) || 120;
    renderPlanner(target, players, result?.teamOVR ?? estimate ?? 0, badgeBonus);
    renderNext(players, result?.teamOVR ?? 0, badgeBonus);
    renderBottleneck(players, result?.teamOVR ?? 0, badgeBonus);
  }

  formation.querySelectorAll('.card').forEach((card, index) => {
    const player = state.starters[index];
    const base = card.querySelector('[data-field="baseOVR"]');
    const rank = card.querySelector('[data-field="rank"]');
    base.addEventListener('input', () => {
      player.baseOVR = base.value === '' ? null : Number(base.value);
      recompute();
    });
    rank.addEventListener('change', () => {
      player.rank = rank.value === '' ? null : Number(rank.value);
      recompute();
    });
  });

  addSub.addEventListener('click', () => {
    if (state.subs.length >= maxSubs) return;
    state.subs.push({ id: Date.now() + Math.random(), baseOVR: null, rank: null });
    renderSubs();
    recompute();
  });

  document.querySelectorAll('[data-badge]').forEach((checkbox, index) => {
    checkbox.addEventListener('change', () => {
      state.badges[index] = checkbox.checked;
      recompute();
    });
  });

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
