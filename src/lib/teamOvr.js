/**
 * Pure calculation engine for the FC Mobile Team OVR Calculator.
 * No DOM or UI dependencies.
 */

export const STARTING_XI_SIZE = 11;
export const MAX_SQUAD_SIZE = 18;
export const MAX_BENCH_SIZE = MAX_SQUAD_SIZE - STARTING_XI_SIZE;
export const MAX_BADGE_SLOTS = 3;

export const RANK_OPTIONS = [0, 1, 2, 3, 4, 5];
export const RANK_MIN = 0;
export const RANK_MAX = 5;
export const BASE_OVR_MIN = 40;
export const BASE_OVR_MAX = 130;

const SLOT = (pos, x, y) => ({ pos, x, y });

export const FORMATIONS = [
  {
    id: '4-3-3',
    label: '4-3-3',
    slots: [
      SLOT('GK', 50, 88),
      SLOT('LB', 18, 68), SLOT('CB', 38, 74), SLOT('CB', 62, 74), SLOT('RB', 82, 68),
      SLOT('CM', 30, 51), SLOT('CM', 50, 57), SLOT('CM', 70, 51),
      SLOT('LW', 18, 28), SLOT('ST', 50, 18), SLOT('RW', 82, 28),
    ],
  },
  {
    id: '4-2-3-1',
    label: '4-2-3-1',
    slots: [
      SLOT('GK', 50, 88),
      SLOT('LB', 18, 68), SLOT('CB', 38, 74), SLOT('CB', 62, 74), SLOT('RB', 82, 68),
      SLOT('CDM', 35, 57), SLOT('CDM', 65, 57),
      SLOT('LW', 18, 35), SLOT('CAM', 50, 31), SLOT('RW', 82, 35),
      SLOT('ST', 50, 17),
    ],
  },
  {
    id: '4-4-2',
    label: '4-4-2',
    slots: [
      SLOT('GK', 50, 88),
      SLOT('LB', 18, 68), SLOT('CB', 38, 74), SLOT('CB', 62, 74), SLOT('RB', 82, 68),
      SLOT('LM', 18, 48), SLOT('CM', 38, 53), SLOT('CM', 62, 53), SLOT('RM', 82, 48),
      SLOT('ST', 38, 22), SLOT('ST', 62, 22),
    ],
  },
  {
    id: '3-4-3',
    label: '3-4-3',
    slots: [
      SLOT('GK', 50, 88),
      SLOT('CB', 26, 71), SLOT('CB', 50, 76), SLOT('CB', 74, 71),
      SLOT('LM', 12, 49), SLOT('CM', 35, 54), SLOT('CM', 65, 54), SLOT('RM', 88, 49),
      SLOT('LW', 18, 28), SLOT('ST', 50, 18), SLOT('RW', 82, 28),
    ],
  },
];

export const DEFAULT_FORMATION = '4-3-3';

export function getFormation(id = DEFAULT_FORMATION) {
  return FORMATIONS.find((formation) => formation.id === id) ?? FORMATIONS.find((formation) => formation.id === DEFAULT_FORMATION);
}

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

  return {
    complete: true,
    squadSize,
    totalBase,
    totalRank,
    baseAverage,
    rankAverage,
    badgeBonus,
    badgeBreakdown,
    teamOVR: baseAverage + rankAverage + badgeBonus,
  };
}
