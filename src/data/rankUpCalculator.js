export const MAX_RANK = 5;

export const RANK_NAMES = {
  0: 'Default',
  1: 'Green',
  2: 'Blue',
  3: 'Purple',
  4: 'Red',
  5: 'Orange',
};

export const RANK_COLORS = {
  0: 'default',
  1: 'green',
  2: 'blue',
  3: 'purple',
  4: 'red',
  5: 'orange',
};

export const RANK_OVR_GAIN = 1;
export const RANK_SKILL_POINT_GAIN = 1;

export const RANK_BRACKETS = [
  { id: '110+', label: '110+', min: 110, max: Infinity },
  { id: '105-109', label: '105–109', min: 105, max: 109 },
  { id: '100-104', label: '100–104', min: 100, max: 104 },
  { id: '95-99', label: '95–99', min: 95, max: 99 },
  { id: '90-94', label: '90–94', min: 90, max: 94 },
  { id: '85-89', label: '85–89', min: 85, max: 89 },
  { id: '0-84', label: '≤84', min: 0, max: 84 },
];

export const RANK_UP_COSTS = {
  '110+': { 1: 140, 2: 280, 3: 420, 4: 560, 5: 700 },
  '105-109': { 1: 120, 2: 240, 3: 360, 4: 480, 5: 600 },
  '100-104': { 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 },
  '95-99': { 1: 80, 2: 160, 3: 240, 4: 320, 5: 400 },
  '90-94': { 1: 60, 2: 120, 3: 180, 4: 240, 5: 300 },
  '85-89': { 1: 40, 2: 80, 3: 120, 4: 160, 5: 200 },
  '0-84': { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 },
};

export const RANK_UP_CUMULATIVE_COSTS = Object.fromEntries(
  Object.entries(RANK_UP_COSTS).map(([bracket, costs]) => {
    let total = 0;
    const cumulative = { 0: 0 };
    for (let rank = 1; rank <= MAX_RANK; rank += 1) {
      total += costs[rank];
      cumulative[rank] = total;
    }
    return [bracket, cumulative];
  }),
);

export function getRankBracket(baseOVR) {
  const ovr = Number(baseOVR);
  if (!Number.isFinite(ovr) || ovr < 0) return null;
  return RANK_BRACKETS.find((bracket) => ovr >= bracket.min && ovr <= bracket.max) ?? null;
}

export function getRankCost(baseOVR, rank) {
  const bracket = getRankBracket(baseOVR);
  const targetRank = Number(rank);
  if (!bracket || !Number.isInteger(targetRank) || targetRank < 1 || targetRank > MAX_RANK) return null;
  return RANK_UP_COSTS[bracket.id][targetRank];
}

export function getCumulativeRankCost(baseOVR, rank) {
  const bracket = getRankBracket(baseOVR);
  const targetRank = Number(rank);
  if (!bracket || !Number.isInteger(targetRank) || targetRank < 0 || targetRank > MAX_RANK) return null;
  return RANK_UP_CUMULATIVE_COSTS[bracket.id][targetRank];
}
