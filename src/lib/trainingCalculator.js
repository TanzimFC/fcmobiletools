import { FODDER_XP, getCumulativeXP } from '../data/trainingCalculator.js';

export function calculateTraining({ currentLevel = 0, targetLevel = 0, fodderId }) {
  const current = Number(currentLevel);
  const target = Number(targetLevel);
  const fodder = FODDER_XP.find((item) => item.id === fodderId);
  const currentXP = getCumulativeXP(current);
  const targetXP = getCumulativeXP(target);

  if (currentXP == null || targetXP == null) return { valid: false, error: 'Choose valid training levels' };
  if (target < current) return { valid: false, error: 'Target level must be at or above current level' };
  if (!fodder) return { valid: false, error: 'Choose a training fodder range' };

  const requiredXP = targetXP - currentXP;
  const cardsNeeded = requiredXP === 0 ? 0 : Math.ceil(requiredXP / fodder.xp);
  const suppliedXP = cardsNeeded * fodder.xp;
  const excessXP = suppliedXP - requiredXP;

  return {
    valid: true,
    currentLevel: current,
    targetLevel: target,
    currentXP,
    targetXP,
    requiredXP,
    fodder,
    cardsNeeded,
    suppliedXP,
    excessXP,
  };
}
