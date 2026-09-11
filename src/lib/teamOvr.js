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
