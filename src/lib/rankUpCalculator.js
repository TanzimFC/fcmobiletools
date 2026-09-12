import { MAX_RANK, getCumulativeRankCost, getRankBracket, getRankStepCost } from '../data/rankUpCalculator.js';

export function calculateRankUp({ baseOVR, currentRank = 0, targetRank = 0, availablePoints = '' }) {
  const base = Number(baseOVR);
  const current = Number(currentRank);
  const target = Number(targetRank);
  const available = availablePoints === '' || availablePoints == null ? null : Number(availablePoints);
  const bracket = getRankBracket(base);

  if (!bracket) return { valid: false, error: 'Enter a valid Base OVR' };
  if (!Number.isInteger(current) || current < 0 || current > MAX_RANK) return { valid: false, error: 'Choose a valid Current Rank' };
  if (!Number.isInteger(target) || target < current || target > MAX_RANK) return { valid: false, error: 'Target Rank must be at or above Current Rank' };
  if (available != null && (!Number.isFinite(available) || available < 0)) return { valid: false, error: 'Available RP must be 0 or more' };

  const requiredPoints = getCumulativeRankCost(base, target) - getCumulativeRankCost(base, current);
  const steps = [];
  for (let rank = current + 1; rank <= target; rank += 1) {
    steps.push({ from: rank - 1, to: rank, cost: getRankStepCost(base, rank) });
  }

  const ranksGained = target - current;
  const result = {
    valid: true,
    baseOVR: base,
    bracket,
    currentRank: current,
    targetRank: target,
    targetOVR: base + target,
    ovrGain: ranksGained,
    skillPoints: ranksGained,
    ranksGained,
    requiredPoints,
    steps,
    availablePoints: available,
    remainingPoints: available == null ? null : available - requiredPoints,
    affordable: available == null ? null : available >= requiredPoints,
  };

  if (available != null) {
    let maxAffordableRank = current;
    for (let rank = current + 1; rank <= MAX_RANK; rank += 1) {
      const cost = getCumulativeRankCost(base, rank) - getCumulativeRankCost(base, current);
      if (cost <= available) maxAffordableRank = rank;
      else break;
    }
    result.maxAffordableRank = maxAffordableRank;
  }

  return result;
}
