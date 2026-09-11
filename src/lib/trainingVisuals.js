import { TRAINING_LEVEL_XP } from '../data/trainingCalculator.js';

export function getTrainingCurve() {
  return TRAINING_LEVEL_XP.map(({ level, cumulativeXP }) => ({ level, cumulativeXP }));
}

export function getLevelProgress(currentLevel, targetLevel) {
  const current = TRAINING_LEVEL_XP.find((x) => x.level === Number(currentLevel));
  const target = TRAINING_LEVEL_XP.find((x) => x.level === Number(targetLevel));
  if (!current || !target || target.cumulativeXP <= 0) return 0;
  return Math.min(100, Math.round((current.cumulativeXP / target.cumulativeXP) * 100));
}
