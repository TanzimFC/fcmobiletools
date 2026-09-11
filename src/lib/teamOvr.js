/**
 * Pure calculation engine for the FC Mobile Team OVR Calculator.
 * No DOM or UI dependencies.
 */

export const STARTING_XI_SIZE = 11;
export const MAX_SQUAD_SIZE = 18;
export const MAX_BADGE_SLOTS = 3;
export const RANK_OPTIONS = [0, 1, 2, 3, 4, 5];
export const RANK_MIN = RANK_OPTIONS[0];
export const RANK_MAX = RANK_OPTIONS[RANK_OPTIONS.length - 1];
export const BASE_OVR_MIN = 40;
export const BASE_OVR_MAX = 135;

export const BADGES = [
  { id: 'numero', name: 'Numero', levels: { 1: { teamOVR: 0 }, 2: { teamOVR: 0 }, 3: { teamOVR: 0 }, 4: { teamOVR: 0 }, 5: { teamOVR: 1 } } },
  { id: 'champions', name: 'Champions', levels: { 1: { teamOVR: 0 }, 2: { teamOVR: 0 }, 3: { teamOVR: 0 }, 4: { teamOVR: 0 }, 5: { teamOVR: 1 } } },
];

const BADGE_BY_ID = Object.fromEntries(BADGES.map((badge) => [badge.id, badge]));

export function isValidBaseOVR(value) {
  return Number.isInteger(value) && value >= BASE_OVR_MIN && value <= BASE_OVR_MAX;
}

export function isValidRank(value) {
  return RANK_OPTIONS.includes(value);
}

export function isPlayerFilled(player) {
  return !!player && isValidBaseOVR(player.baseOVR) && isValidRank(player.rank);
}

export function getBadgeTeamOVRBonus(badgeId, level) {
  if (!badgeId) return 0;
  const badge = BADGE_BY_ID[badgeId];
  if (!badge) return 0;
  return badge.levels[level]?.teamOVR || 0;
}

export function calculateBadgeBonus(selectedBadges = []) {
  const breakdown = [];
  let badgeBonus = 0;
  for (const slot of selectedBadges.slice(0, MAX_BADGE_SLOTS)) {
    if (!slot || !slot.badgeId || !slot.level) continue;
    const badge = BADGE_BY_ID[slot.badgeId];
    const bonus = getBadgeTeamOVRBonus(slot.badgeId, slot.level);
    badgeBonus += bonus;
    breakdown.push({ badgeId: slot.badgeId, name: badge ? badge.name : slot.badgeId, level: slot.level, bonus });
  }
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
