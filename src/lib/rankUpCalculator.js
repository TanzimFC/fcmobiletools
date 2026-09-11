import {
  MAX_RANK,
  RANK_OVR_GAIN,
  RANK_SKILL_POINT_GAIN,
  RANK_UP_COSTS,
  getCumulativeRankCost,
  getRankBracket,
  getRankCost,
} from '../data/rankUpCalculator.js';

export function calculateRankUp({ baseOVR, currentRank, targetRank, availablePoints = null }) {
  const ovr = Number(baseOVR);
  const current = Number(currentRank);
  const target = Number(targetRank);
  const available = availablePoints === '' || availablePoints == null ? null : Number(availablePoints);

  if (!Number.isInteger(ovr) || ovr < 0) return { valid: false, error: 'Enter a valid Base OVR.' };
  if (!Number.isInteger(current) || current < 0 || current > MAX_RANK) return { valid: false, error: 'Choose a valid current Rank.' };
  if (!Number.isInteger(target) || target < 0 || target > MAX_RANK) return { valid: false, error: 'Choose a valid target Rank.' };
  if (target < current) return { valid: false, error: 'Target Rank cannot be below Current Rank.' };
  if (available != null && (!Number.isFinite(available) || available < 0)) return { valid: false, error: 'Available Rank Up Points must be 0 or more.' };

  const bracket = getRankBracket(ovr);
  const currentCumulative = getCumulativeRankCost(ovr, current);
  const targetCumulative = getCumulativeRankCost(ovr, target);
  const requiredPoints = targetCumulative - currentCumulative;
  const skillPoints = (target - current) * RANK_SKILL_POINT_GAIN;
  const ovrGain = (target - current) * RANK_OVR_GAIN;
  const targetOVR = ovr + target * RANK_OVR_GAIN;
  const remainingPoints = available == null ? null : available - requiredPoints;
  const affordable = available == null ? null : remainingPoints >= 0;

  const steps = [];
  for (let rank = current + 1; rank <= target; rank += 1) {
    steps.push({
      from: rank - 1,
      to: rank,
      cost: getRankCost(ovr, rank),
      rankName: rank === 0 ? 'Default' : undefined,
    });
  }

  let maxAffordableRank = current;
  if (available != null) {
    for (let rank = current + 1; rank <= MAX_RANK; rank += 1) {
      const costToRank = getCumulativeRankCost(ovr, rank) - currentCumulative;
      if (costToRank <= available) maxAffordableRank = rank;
      else break;
    }
  }

  return {
    valid: true,
    baseOVR: ovr,
    bracket,
    currentRank: current,
    targetRank: target,
    targetOVR,
    ovrGain,
    skillPoints,
    requiredPoints,
    availablePoints: available,
    remainingPoints,
    affordable,
    maxAffordableRank,
    steps,
    isMaxRank: current === MAX_RANK,
    costs: RANK_UP_COSTS[bracket.id],
  };
}
