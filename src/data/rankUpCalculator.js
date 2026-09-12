export const MAX_RANK = 5;

export const RANKS = [
  { rank: 0, name: 'Default', color: 'default' },
  { rank: 1, name: 'Green', color: 'green' },
  { rank: 2, name: 'Blue', color: 'blue' },
  { rank: 3, name: 'Purple', color: 'purple' },
  { rank: 4, name: 'Red', color: 'red' },
  { rank: 5, name: 'Orange', color: 'orange' },
];

export const RANK_BRACKETS = [
  { id: '110+', label: '110+', min: 110, max: Infinity, costs: [0, 140, 280, 420, 560, 700] },
  { id: '105-109', label: '105–109', min: 105, max: 109, costs: [0, 120, 240, 360, 480, 600] },
  { id: '100-104', label: '100–104', min: 100, max: 104, costs: [0, 100, 200, 300, 400, 500] },
  { id: '95-99', label: '95–99', min: 95, max: 99, costs: [0, 80, 160, 240, 320, 400] },
  { id: '90-94', label: '90–94', min: 90, max: 94, costs: [0, 60, 120, 180, 240, 300] },
  { id: '85-89', label: '85–89', min: 85, max: 89, costs: [0, 40, 80, 120, 160, 200] },
  { id: '0-84', label: '≤84', min: 0, max: 84, costs: [0, 20, 40, 60, 80, 100] },
];

export function getRankBracket(baseOVR) {
  const ovr = Number(baseOVR);
  if (!Number.isInteger(ovr) || ovr < 0) return null;
  return RANK_BRACKETS.find((item) => ovr >= item.min && ovr <= item.max) ?? null;
}

export function getRankStepCost(baseOVR, targetRank) {
  const bracket = getRankBracket(baseOVR);
  const rank = Number(targetRank);
  return bracket && Number.isInteger(rank) && rank >= 1 && rank <= MAX_RANK ? bracket.costs[rank] : null;
}

export function getCumulativeRankCost(baseOVR, rank) {
  const bracket = getRankBracket(baseOVR);
  const target = Number(rank);
  if (!bracket || !Number.isInteger(target) || target < 0 || target > MAX_RANK) return null;
  return bracket.costs.slice(0, target + 1).reduce((sum, value) => sum + value, 0);
}
