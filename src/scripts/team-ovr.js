import { calculateTeamOVR, isValidBaseOVR, isValidRank, STARTING_XI_SIZE, MAX_SQUAD_SIZE, MAX_BADGE_SLOTS, BASE_OVR_MIN, BASE_OVR_MAX, RANK_OPTIONS } from '../lib/teamOvr.js';

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
  let subId = 0;

  const $ = (id) => document.getElementById(id);
  const valid = (p) => isValidBaseOVR(p.baseOVR) && isValidRank(p.rank);
  const maxSubs = MAX_SQUAD_SIZE - STARTING_XI_SIZE;

  function updateCard(el, player) {
    const displayed = isValidBaseOVR(player.baseOVR) && isValidRank(player.rank)
      ? player.baseOVR + player.rank
      : isValidBaseOVR(player.baseOVR) ? player.baseOVR : '--';
    const output = el.querySelector('[data-card-ovr]');
    if (output) output.textContent = displayed;
  }

  function renderSubs() {
    subsEl.innerHTML = '';
    state.subs.forEach((player, index) => {
      const el = document.createElement('article');
      el.className = 'sub';
      el.innerHTML = `
        <div class="sub-top"><b>SUB ${index + 1}</b><button class="sub-remove" type="button" aria-label="Remove substitute">×</button></div>
        <label>Base OVR<input data-base type="number" min="${BASE_OVR_MIN}" max="${BASE_OVR_MAX}" inputmode="numeric" placeholder="OVR"></label>
        <label>Rank<select data-rank><option value="">Rank</option>${RANK_OPTIONS.map((rank) => `<option value="${rank}">Rank ${rank}</option>`).join('')}</select></label>`;

      const base = el.querySelector('[data-base]');
      const rank = el.querySelector('[data-rank]');
      base.addEventListener('input', () => {
        player.baseOVR = base.value === '' ? null : Number(base.value);
        recompute();
      });
      rank.addEventListener('change', () => {
        player.rank = rank.value === '' ? null : Number(rank.value);
        recompute();
      });
      el.querySelector('.sub-remove').addEventListener('click', () => {
        state.subs = state.subs.filter((item) => item !== player);
        renderSubs();
        recompute();
      });
      subsEl.appendChild(el);
    });
    addSub.disabled = state.subs.length >= maxSubs;
    addSub.textContent = state.subs.length >= maxSubs ? 'Maximum substitutes reached' : '+ Add Substitute';
  }

  function recompute() {
    const all = [...state.starters, ...state.subs];
    const completePlayers = all.filter(valid);
    const basePlayers = all.filter((player) => isValidBaseOVR(player.baseOVR));
    const rankPlayers = all.filter((player) => isValidRank(player.rank));
    const badgeBonus = state.badges.filter(Boolean).length;
    const baseAvg = basePlayers.length
      ? Math.ceil(basePlayers.reduce((sum, player) => sum + player.baseOVR, 0) / basePlayers.length)
      : null;
    const rankAvg = rankPlayers.length
      ? Math.ceil(rankPlayers.reduce((sum, player) => sum + player.rank, 0) / rankPlayers.length)
      : null;
    const exact = all.length >= STARTING_XI_SIZE && all.length <= MAX_SQUAD_SIZE && all.every(valid);
    const result = calculateTeamOVR({
      players: all,
      selectedBadges: state.badges.map((enabled) => ({ enabled })),
      requiredCount: all.length,
    });

    $('starter-count').textContent = `${state.starters.filter(valid).length} / ${STARTING_XI_SIZE}`;
    $('sub-count').textContent = `${state.subs.length} included`;
    $('badge-total').textContent = `+${badgeBonus} OVR`;
    $('base-avg').textContent = baseAvg === null ? '--' : baseAvg;
    $('rank-avg').textContent = rankAvg === null ? '--' : rankAvg;
    $('badge-avg').textContent = `+${badgeBonus}`;

    const estimate = baseAvg === null ? null : baseAvg + (rankAvg ?? 0) + badgeBonus;
    $('result-number').textContent = estimate === null ? '--' : estimate;
    $('result-label').textContent = exact ? 'YOUR TEAM OVR' : 'LIVE ESTIMATE';
    $('result-status').textContent = exact
      ? `${all.length}-player squad · Exact formula`
      : `Based on ${basePlayers.length} Base OVR${basePlayers.length === 1 ? '' : 's'} entered so far`;

    formation.querySelectorAll('.card').forEach((card, index) => updateCard(card, state.starters[index]));

    const math = $('math');
    if (exact && result.complete) {
      math.textContent = `Base OVR\n${result.totalBase} ÷ ${result.squadSize} = ${(result.totalBase / result.squadSize).toFixed(2)} → ${result.baseAverage}\n\nRank\n${result.totalRank} ÷ ${result.squadSize} = ${(result.totalRank / result.squadSize).toFixed(2)} → ${result.rankAverage}\n\nBadges\n+${result.badgeBonus}\n\nFinal\n${result.baseAverage} + ${result.rankAverage} + ${result.badgeBonus} = ${result.teamOVR}`;
    } else if (estimate === null) {
      math.textContent = 'Enter a Base OVR to see the estimate.';
    } else {
      math.textContent = `Live estimate\nBase average: ${baseAvg}\nRank average: ${rankAvg ?? 0}\nBadges: +${badgeBonus}\n\nEstimated Team OVR: ${estimate}`;
    }
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
    subId += 1;
    state.subs.push({ id: subId, baseOVR: null, rank: null });
    renderSubs();
    recompute();
  });

  document.querySelectorAll('[data-badge]').forEach((checkbox, index) => {
    checkbox.addEventListener('change', () => {
      state.badges[index] = checkbox.checked;
      recompute();
    });
  });

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
