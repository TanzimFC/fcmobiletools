export const TEAM_OVR_RANK_MAX = 5;
export const TEAM_OVR_MIN_PLAYERS = 11;
export const TEAM_OVR_MAX_PLAYERS = 18;
export const TEAM_OVR_BASE_MIN = 1;
export const TEAM_OVR_BASE_MAX = 122;

export const STARTING_POSITIONS = ['GK', 'LB', 'CB', 'CB', 'RB', 'CM', 'CM', 'CM', 'LW', 'ST', 'RW'];

// Keep Team Badge data centralized. Only explicit Team OVR bonuses are included.
export const TEAM_BADGES = [
  { id: 'numero', name: 'Numero', status: 'active', levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
  { id: 'champions', name: 'Champions', status: 'active', levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
  { id: 'twg', name: 'TWG', status: 'expired', levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
];

export function createEmptyPlayers() {
  return Array.from({ length: TEAM_OVR_MAX_PLAYERS }, (_, index) => ({
    id: index + 1,
    position: STARTING_POSITIONS[index] || 'SUB',
    baseOVR: '',
    rank: 0,
    starter: index < TEAM_OVR_MIN_PLAYERS,
  }));
}

export function createEmptyBadges() {
  return Array.from({ length: 3 }, (_, index) => ({ id: '', level: 0, slot: index + 1 }));
}

export function calculateTeamOVR({ players = [], badges = [] } = {}) {
  const validPlayers = players.filter((player) => {
    const baseOVR = Number(player?.baseOVR);
    const rank = Number(player?.rank ?? 0);
    return Number.isFinite(baseOVR) && baseOVR >= TEAM_OVR_BASE_MIN && baseOVR <= TEAM_OVR_BASE_MAX && Number.isInteger(rank) && rank >= 0 && rank <= TEAM_OVR_RANK_MAX;
  });
  const squadSize = validPlayers.length;
  const baseTotal = validPlayers.reduce((sum, player) => sum + Number(player.baseOVR), 0);
  const rankTotal = validPlayers.reduce((sum, player) => sum + Number(player.rank ?? 0), 0);

  if (squadSize < TEAM_OVR_MIN_PLAYERS || squadSize > TEAM_OVR_MAX_PLAYERS) {
    return { complete: false, squadSize, baseTotal, rankTotal, baseAverage: null, rankAverage: null, badgeBonus: 0, teamOVR: null };
  }

  const baseAverage = Math.ceil(baseTotal / squadSize);
  const rankAverage = Math.ceil(rankTotal / squadSize);
  const badgeBonus = badges.reduce((sum, selection) => {
    const badge = TEAM_BADGES.find((item) => item.id === selection?.id && item.status === 'active');
    const level = Number(selection?.level || 0);
    return sum + (badge?.levels?.[level] || 0);
  }, 0);

  return { complete: true, squadSize, baseTotal, rankTotal, baseAverage, rankAverage, badgeBonus, teamOVR: baseAverage + rankAverage + badgeBonus };
}
