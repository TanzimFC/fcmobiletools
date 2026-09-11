export const TEAM_OVR_RANK_MAX = 5;
export const TEAM_OVR_MIN_PLAYERS = 11;
export const TEAM_OVR_MAX_PLAYERS = 18;

// Keep badge data centralized so badge changes do not require UI changes.
// Only explicit Team OVR bonuses are represented here.
export const TEAM_BADGES = [
  { id: 'numero', name: 'Numero', levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
  { id: 'champions', name: 'Champions', levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
  { id: 'twg', name: 'TWG', levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
  { id: 'tots', name: 'TOTS', levels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
];

export function calculateTeamOVR({ players = [], badges = [] } = {}) {
  const validPlayers = players.filter((player) => Number.isFinite(Number(player?.baseOVR)) && Number(player.baseOVR) >= 0);
  const squadSize = validPlayers.length;

  if (squadSize < TEAM_OVR_MIN_PLAYERS) {
    return {
      complete: false,
      squadSize,
      baseTotal: validPlayers.reduce((sum, player) => sum + Number(player.baseOVR), 0),
      rankTotal: validPlayers.reduce((sum, player) => sum + Number(player.rank || 0), 0),
      baseAverage: null,
      rankAverage: null,
      badgeBonus: 0,
      teamOVR: null,
    };
  }

  const baseTotal = validPlayers.reduce((sum, player) => sum + Number(player.baseOVR), 0);
  const rankTotal = validPlayers.reduce((sum, player) => sum + Number(player.rank || 0), 0);
  const baseAverage = Math.ceil(baseTotal / squadSize);
  const rankAverage = Math.ceil(rankTotal / squadSize);

  const badgeBonus = badges.reduce((sum, selection) => {
    const badge = TEAM_BADGES.find((item) => item.id === selection?.id);
    const level = Number(selection?.level || 0);
    return sum + (badge?.levels?.[level] || 0);
  }, 0);

  return {
    complete: true,
    squadSize,
    baseTotal,
    rankTotal,
    baseAverage,
    rankAverage,
    badgeBonus,
    teamOVR: baseAverage + rankAverage + badgeBonus,
  };
}
