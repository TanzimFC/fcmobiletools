import { FODDER, MAX_TRAINING_LEVEL, TRAINING_LEVELS, TRAINING_TRANSFER_RATE } from '../data/fcMobileTraining.js';

export function calculateTraining({ currentLevel, targetLevel, fodderId }) {
  const current = Number(currentLevel);
  const target = Number(targetLevel);
  const fodder = FODDER.find((item) => item.id === fodderId);
  if (!Number.isInteger(current) || current < 0 || current > MAX_TRAINING_LEVEL) return { valid: false, error: 'Choose a valid current level' };
  if (!Number.isInteger(target) || target < current || target > MAX_TRAINING_LEVEL) return { valid: false, error: 'Choose a valid target level' };
  if (!fodder) return { valid: false, error: 'Choose a fodder range' };

  const requiredXP = TRAINING_LEVELS[target] - TRAINING_LEVELS[current];
  const cards = requiredXP === 0 ? 0 : Math.ceil(requiredXP / fodder.xp);
  const suppliedXP = cards * fodder.xp;
  return { valid: true, currentLevel: current, targetLevel: target, currentXP: TRAINING_LEVELS[current], targetXP: TRAINING_LEVELS[target], requiredXP, fodder, cards, suppliedXP, extraXP: suppliedXP - requiredXP };
}

export function calculateTransfer(sourceLevel) {
  const level = Number(sourceLevel);
  if (!Number.isInteger(level) || level < 0 || level > MAX_TRAINING_LEVEL) return { valid: false, error: 'Choose a valid source level' };
  const sourceXP = TRAINING_LEVELS[level];
  const receivedXP = Math.floor(sourceXP * TRAINING_TRANSFER_RATE);
  return { valid: true, sourceLevel: level, sourceXP, receivedXP, lostXP: sourceXP - receivedXP, transferRate: TRAINING_TRANSFER_RATE };
}
