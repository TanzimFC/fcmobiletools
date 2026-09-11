import { FODDER_XP, getCumulativeXP, RANK_TRAINING_LIMITS } from '../data/trainingCalculator.js';

export function calculateTraining({ currentLevel = 0, targetLevel = 0, fodderId, pricePerCard = null, rank = null }) {
  const current = Number(currentLevel);
  const target = Number(targetLevel);
  const fodder = FODDER_XP.find((item) => item.id === fodderId);
  const currentXP = getCumulativeXP(current);
  const targetXP = getCumulativeXP(target);

  if (currentXP == null || targetXP == null) return { valid: false, error: 'Select valid training levels.' };
  if (target < current) return { valid: false, error: 'Target level must be at or above the current level.' };
  if (!fodder) return { valid: false, error: 'Select a training fodder OVR.' };

  const maxForRank = rank != null && RANK_TRAINING_LIMITS[rank] != null ? RANK_TRAINING_LIMITS[rank] : null;
  if (maxForRank != null && target > maxForRank) {
    return { valid: false, error: `Training Level ${target} is not currently available for this player's Rank. Rank Up the player first.` };
  }

  const requiredXP = targetXP - currentXP;
  const playersRequired = requiredXP === 0 ? 0 : Math.ceil(requiredXP / fodder.xp);
  const xpProvided = playersRequired * fodder.xp;
  const excessXP = xpProvided - requiredXP;
  const price = Number(pricePerCard);
  const hasPrice = Number.isFinite(price) && price >= 0;
  const estimatedCost = hasPrice ? playersRequired * price : null;
  const costPerXP = hasPrice && fodder.xp > 0 ? price / fodder.xp : null;

  return {
    valid: true,
    currentLevel: current,
    targetLevel: target,
    fodder,
    requiredXP,
    xpProvided,
    excessXP,
    playersRequired,
    estimatedCost,
    costPerXP,
    progress: target === current ? 100 : Math.round((currentXP / targetXP) * 100)
  };
}

export function compareFodder({ currentLevel, targetLevel, prices = {} }) {
  return FODDER_XP.map((fodder) => {
    const result = calculateTraining({ currentLevel, targetLevel, fodderId: fodder.id, pricePerCard: prices[fodder.id] });
    return { ...fodder, ...result, pricePerCard: prices[fodder.id] ?? '' };
  });
}
