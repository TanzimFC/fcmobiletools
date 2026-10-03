/**
 * Pure calculation engine for the FC Mobile Team OVR Calculator.
 * No DOM or UI dependencies.
 */

export const STARTING_XI_SIZE = 11;
export const MAX_SQUAD_SIZE = 18;
export const MAX_BADGE_SLOTS = 3;
export const RANK_OPTIONS = [0, 1, 2, 3, 4, 5];
export const RANK_MIN = 0;
export const RANK_MAX = 5;
export const BASE_OVR_MIN = 40;
export const BASE_OVR_MAX = 130;

export const BADGES = [
  { id: 'badge-1', name: 'Badge 1', teamOVR: 1 },
  { id: 'badge-2', name: 'Badge 2', teamOVR: 1 },
  { id: 'badge-3', name: 'Badge 3', teamOVR: 1 },
];

export function isValidBaseOVR(value) {
  return Number.isInteger(value) && value >= BASE_OVR_MIN && value <= BASE_OVR_MAX;
}

export function isValidRank(value) {
  return RANK_OPTIONS.includes(value);
}

export function isPlayerFilled(player) {
  return !!player && isValidBaseOVR(player.baseOVR) && isValidRank(player.rank);
}

export function getBadgeTeamOVRBonus(badgeId, enabled = false) {
  return BADGES.some((badge) => badge.id === badgeId) && enabled ? 1 : 0;
}

export function calculateBadgeBonus(selectedBadges = []) {
  const slots = selectedBadges.slice(0, MAX_BADGE_SLOTS);
  const breakdown = slots.map((slot, index) => ({
    badgeId: `badge-${index + 1}`,
    name: `Badge ${index + 1}`,
    bonus: slot?.enabled ? 1 : 0,
  }));
  const badgeBonus = breakdown.reduce((sum, badge) => sum + badge.bonus, 0);
  return { badgeBonus, breakdown };
}

export function calculateTeamOVR({ players = [], selectedBadges = [], requiredCount } = {}) {
  const filled = players.filter(isPlayerFilled);
  const required = requiredCount ?? players.length;
  const complete = required >= STARTING_XI_SIZE && required <= MAX_SQUAD_SIZE && filled.length === required && players.length === required;
  if (!complete) return { complete: false, filledCount: filled.length, requiredCount: required };

  const squadSize = players.length;
  const totalBase = players.reduce((sum, player) => sum + player.baseOVR, 0);
  const totalRank = players.reduce((sum, player) => sum + player.rank, 0);
  const baseAverage = Math.ceil(totalBase / squadSize);
  const rankAverage = Math.ceil(totalRank / squadSize);
  const { badgeBonus, breakdown: badgeBreakdown } = calculateBadgeBonus(selectedBadges);
  return { complete: true, squadSize, totalBase, totalRank, baseAverage, rankAverage, badgeBonus, badgeBreakdown, teamOVR: baseAverage + rankAverage + badgeBonus };
}

/* ------------------------------------------------------------------ *
 * v2 additions: squad summary, upgrade planner, formations, sharing.
 * Everything below is pure (no DOM) so it can be unit tested in Node.
 * ------------------------------------------------------------------ */

export const MAX_BENCH_SIZE = MAX_SQUAD_SIZE - STARTING_XI_SIZE;
export const MAX_TEAM_OVR = BASE_OVR_MAX + RANK_MAX + MAX_BADGE_SLOTS;

/** Formation layouts. Purely cosmetic: Team OVR does not depend on position. */
export const FORMATIONS = [
  { id: '433', label: '4-3-3', slots: [
    ['GK', 50, 91], ['LB', 14, 70], ['CB', 38, 73], ['CB', 62, 73], ['RB', 86, 70],
    ['CM', 28, 51], ['CM', 50, 55], ['CM', 72, 51], ['LW', 16, 22], ['ST', 50, 15], ['RW', 84, 22],
  ] },
  { id: '442', label: '4-4-2', slots: [
    ['GK', 50, 91], ['LB', 14, 70], ['CB', 38, 73], ['CB', 62, 73], ['RB', 86, 70],
    ['LM', 14, 48], ['CM', 38, 52], ['CM', 62, 52], ['RM', 86, 48], ['ST', 36, 19], ['ST', 64, 19],
  ] },
  { id: '4231', label: '4-2-3-1', slots: [
    ['GK', 50, 91], ['LB', 14, 70], ['CB', 38, 73], ['CB', 62, 73], ['RB', 86, 70],
    ['CDM', 36, 57], ['CDM', 64, 57], ['LM', 16, 36], ['CAM', 50, 38], ['RM', 84, 36], ['ST', 50, 15],
  ] },
  { id: '352', label: '3-5-2', slots: [
    ['GK', 50, 91], ['CB', 24, 72], ['CB', 50, 75], ['CB', 76, 72],
    ['LWB', 9, 51], ['CM', 31, 55], ['CAM', 50, 39], ['CM', 69, 55], ['RWB', 91, 51], ['ST', 36, 18], ['ST', 64, 18],
  ] },
  { id: '532', label: '5-3-2', slots: [
    ['GK', 50, 91], ['LWB', 9, 64], ['CB', 29, 73], ['CB', 50, 75], ['CB', 71, 73], ['RWB', 91, 64],
    ['CM', 28, 50], ['CM', 50, 46], ['CM', 72, 50], ['ST', 37, 18], ['ST', 63, 18],
  ] },
].map((formation) => ({
  ...formation,
  slots: formation.slots.map(([pos, x, y]) => ({ pos, x, y })),
}));

export const DEFAULT_FORMATION = '433';

export function getFormation(id) {
  return FORMATIONS.find((formation) => formation.id === id) ?? FORMATIONS[0];
}

const ceilDiv = (total, count) => Math.ceil(total / count);
const rankOf = (player) => (isValidRank(player?.rank) ? player.rank : 0);

/** Visual rarity tier for a single player's OVR. */
export function ovrTier(ovr) {
  if (!Number.isFinite(ovr)) return 'empty';
  if (ovr >= 120) return 'gold';
  if (ovr >= 110) return 'cyan';
  if (ovr >= 100) return 'mint';
  return 'slate';
}

/**
 * Summarise a squad as entered in the UI.
 *
 * A slot counts toward the average as soon as it has a valid Base OVR
 * (rank defaults to 0). Empty bench slots are simply not part of the squad.
 * The result is `exact` once all 11 starters have a Base OVR; before that it is
 * a live `estimate` over the players entered so far.
 */
export function summarizeSquad({ starters = [], bench = [], badges = [] } = {}) {
  const players = [];
  starters.forEach((player, index) => {
    if (isValidBaseOVR(player?.baseOVR)) players.push({ key: `starter:${index}`, baseOVR: player.baseOVR, rank: rankOf(player) });
  });
  bench.forEach((player, index) => {
    if (isValidBaseOVR(player?.baseOVR)) players.push({ key: `bench:${index}`, baseOVR: player.baseOVR, rank: rankOf(player) });
  });

  const startersFilled = players.filter((player) => player.key.startsWith('starter:')).length;
  const benchFilled = players.length - startersFilled;
  const badgeBonus = badges.slice(0, MAX_BADGE_SLOTS).filter(Boolean).length;
  const count = players.length;

  if (!count) {
    return { state: 'empty', exact: false, players, count, startersFilled, benchFilled, badgeBonus, teamOVR: null };
  }

  const totalBase = players.reduce((sum, player) => sum + player.baseOVR, 0);
  const totalRank = players.reduce((sum, player) => sum + player.rank, 0);
  const baseAverage = ceilDiv(totalBase, count);
  const rankAverage = ceilDiv(totalRank, count);
  const exact = startersFilled === STARTING_XI_SIZE;

  return {
    state: exact ? 'exact' : 'estimate',
    exact,
    players,
    count,
    startersFilled,
    benchFilled,
    badgeBonus,
    totalBase,
    totalRank,
    baseRaw: totalBase / count,
    rankRaw: totalRank / count,
    baseAverage,
    rankAverage,
    teamOVR: baseAverage + rankAverage + badgeBonus,
  };
}

/** Points needed so that ceil(total / count) goes up by one, or null if the cap blocks it. */
function stepsToNextAverage(total, count, capacity) {
  const needed = ceilDiv(total, count) * count + 1 - total;
  return needed <= capacity ? needed : null;
}

/** The cheapest ways to move the headline up by exactly +1. */
export function nextOvrOptions(summary) {
  if (!summary?.count) return null;
  const baseCapacity = summary.players.reduce((sum, player) => sum + BASE_OVR_MAX - player.baseOVR, 0);
  const rankCapacity = summary.players.reduce((sum, player) => sum + RANK_MAX - player.rank, 0);
  const baseSteps = stepsToNextAverage(summary.totalBase, summary.count, baseCapacity);
  const rankSteps = stepsToNextAverage(summary.totalRank, summary.count, rankCapacity);
  return {
    target: summary.teamOVR + 1,
    baseSteps,
    rankSteps,
    reachable: baseSteps !== null || rankSteps !== null,
  };
}

/** Spread `amount` upgrades across players, always lifting the current lowest first. */
function levelUp(players, key, amount, max) {
  const values = players.map((player) => player[key]);
  let left = amount;
  while (left > 0) {
    let pick = -1;
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] < max && (pick === -1 || values[i] < values[pick])) pick = i;
    }
    if (pick === -1) break;
    values[pick] += 1;
    left -= 1;
  }
  return players
    .map((player, i) => ({ key: player.key, from: player[key], to: values[i] }))
    .filter((change) => change.to !== change.from)
    .sort((a, b) => a.from - b.from);
}

function buildRoute(kind, players, baseSteps, rankSteps) {
  return {
    kind,
    baseSteps,
    rankSteps,
    total: baseSteps + rankSteps,
    baseChanges: baseSteps ? levelUp(players, 'baseOVR', baseSteps, BASE_OVR_MAX) : [],
    rankChanges: rankSteps ? levelUp(players, 'rank', rankSteps, RANK_MAX) : [],
  };
}

/**
 * Plan the cheapest upgrade routes to reach `target` Team OVR.
 * Cost model: one Base OVR point and one Rank step each count as one upgrade.
 * Requires a complete starting XI (summary.exact).
 */
export function planUpgrade({ players = [], badgeBonus = 0, target } = {}) {
  if (players.length < STARTING_XI_SIZE || players.length > MAX_SQUAD_SIZE) return { status: 'incomplete', routes: [] };
  const count = players.length;
  const totalBase = players.reduce((sum, player) => sum + player.baseOVR, 0);
  const totalRank = players.reduce((sum, player) => sum + player.rank, 0);
  const current = ceilDiv(totalBase, count) + ceilDiv(totalRank, count) + badgeBonus;

  if (target <= current) return { status: 'reached', current, target, routes: [] };
  if (target > MAX_TEAM_OVR) return { status: 'unreachable', current, target, routes: [] };

  const baseCapacity = players.reduce((sum, player) => sum + BASE_OVR_MAX - player.baseOVR, 0);
  const rankCapacity = players.reduce((sum, player) => sum + RANK_MAX - player.rank, 0);
  const needFor = (goalAverage, total) => Math.max(0, (goalAverage - 1) * count + 1 - total);

  const found = [];

  // Pure routes.
  const baseOnly = needFor(target - badgeBonus - ceilDiv(totalRank, count), totalBase);
  if (baseOnly <= baseCapacity) found.push(buildRoute('base', players, baseOnly, 0));
  const rankOnly = needFor(target - badgeBonus - ceilDiv(totalBase, count), totalRank);
  if (rankOnly <= rankCapacity) found.push(buildRoute('rank', players, 0, rankOnly));

  // Mixed route: scan every Base total, take the cheapest rank top-up.
  let mixed = null;
  for (let baseSteps = 0; baseSteps <= baseCapacity; baseSteps += 1) {
    const rankSteps = needFor(target - badgeBonus - ceilDiv(totalBase + baseSteps, count), totalRank);
    if (rankSteps > rankCapacity) continue;
    if (!mixed || baseSteps + rankSteps < mixed.baseSteps + mixed.rankSteps) mixed = { baseSteps, rankSteps };
  }
  if (mixed && mixed.baseSteps > 0 && mixed.rankSteps > 0) {
    const cheapestPure = Math.min(...found.map((route) => route.total), Infinity);
    if (mixed.baseSteps + mixed.rankSteps < cheapestPure) {
      found.push(buildRoute('mixed', players, mixed.baseSteps, mixed.rankSteps));
    }
  }

  const order = { base: 0, rank: 1, mixed: 2 };
  found.sort((a, b) => a.total - b.total || order[a.kind] - order[b.kind]);
  return found.length
    ? { status: 'ok', current, target, routes: found }
    : { status: 'unreachable', current, target, routes: [] };
}

/** Lowest Base OVR players, ascending. */
export function findWeakest(players = [], limit = 3) {
  return [...players].sort((a, b) => a.baseOVR - b.baseOVR).slice(0, limit);
}

/**
 * Parse pasted ratings. Each token is `117` or `117/2` (Base OVR / Rank).
 * Tokens may be separated by spaces, commas, semicolons or new lines.
 */
export function parseQuickFill(text = '') {
  const entries = [];
  const invalid = [];
  let overflow = 0;
  String(text).split(/[\s,;]+/).filter(Boolean).forEach((token) => {
    const match = /^(\d{2,3})(?:[/:](\d))?$/.exec(token);
    const baseOVR = match ? Number(match[1]) : NaN;
    const rank = match && match[2] !== undefined ? Number(match[2]) : 0;
    if (!match || !isValidBaseOVR(baseOVR) || !isValidRank(rank)) { invalid.push(token); return; }
    if (entries.length >= MAX_SQUAD_SIZE) { overflow += 1; return; }
    entries.push({ baseOVR, rank });
  });
  return { entries, invalid, overflow };
}

const SHARE_VERSION = '1';
const slotToken = (player) => (isValidBaseOVR(player?.baseOVR) ? `${player.baseOVR}r${rankOf(player)}` : '');
const tokenToSlot = (token) => {
  const match = /^(\d{2,3})r([0-5])$/.exec(token);
  return match && isValidBaseOVR(Number(match[1]))
    ? { baseOVR: Number(match[1]), rank: Number(match[2]) }
    : { baseOVR: null, rank: 0 };
};

/** Compact, URL-safe squad string: `1~433~<11 starters>~<7 bench>~101`. */
export function serializeSquad({ formation = DEFAULT_FORMATION, starters = [], bench = [], badges = [] } = {}) {
  const pad = (list, size) => Array.from({ length: size }, (_, i) => slotToken(list[i]));
  return [
    SHARE_VERSION,
    getFormation(formation).id,
    pad(starters, STARTING_XI_SIZE).join(','),
    pad(bench, MAX_BENCH_SIZE).join(','),
    Array.from({ length: MAX_BADGE_SLOTS }, (_, i) => (badges[i] ? '1' : '0')).join(''),
  ].join('~');
}

/** Inverse of serializeSquad. Returns null when the string is not a valid squad. */
export function deserializeSquad(text) {
  if (typeof text !== 'string') return null;
  const parts = text.split('~');
  if (parts.length !== 5 || parts[0] !== SHARE_VERSION) return null;
  const starters = parts[2].split(',');
  const bench = parts[3].split(',');
  if (starters.length !== STARTING_XI_SIZE || bench.length !== MAX_BENCH_SIZE) return null;
  if (!/^[01]{3}$/.test(parts[4])) return null;
  return {
    formation: getFormation(parts[1]).id,
    starters: starters.map(tokenToSlot),
    bench: bench.map(tokenToSlot),
    badges: parts[4].split('').map((bit) => bit === '1'),
  };
}
