import { RANKS, getRankBracket } from '../data/fcMobileRankUp.js';

export function calculateRankUp({ baseOVR, currentRank, targetRank, availableRP = '' }) {
  const base = Number(baseOVR);
  const current = Number(currentRank);
  const target = Number(targetRank);
  const bracket = getRankBracket(base);
  const available = availableRP === '' ? null : Number(availableRP);

  if (!bracket) return { valid: false, error: 'Enter a valid Base OVR' };
  if (!Number.isInteger(current) || current < 0 || current > 5) return { valid: false, error: 'Choose a valid current rank' };
  if (!Number.isInteger(target) || target < current || target > 5) return { valid: false, error: 'Target rank must be at or above current rank' };
  if (available !== null && (!Number.isFinite(available) || available < 0)) return { valid: false, error: 'Available RP must be 0 or more' };

  const steps = [];
  let total = 0;
  for (let rank = current + 1; rank <= target; rank += 1) {
    const cost = bracket.costs[rank - 1];
    total += cost;
    steps.push({ from: rank - 1, to: rank, cost });
  }

  const ranksGained = target - current;
  return {
    valid: true,
    baseOVR: base,
    bracket,
    currentRank: current,
    targetRank: target,
    targetOVR: base + target,
    ranksGained,
    skillPoints: ranksGained,
    requiredRP: total,
    steps,
    availableRP: available,
    remainingRP: available === null ? null : available - total,
    affordable: available === null ? null : available >= total,
    ranks: RANKS,
  };
}
