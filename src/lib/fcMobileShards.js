export function normalizeShardValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

export function calculateShardProgress(current, target) {
  const balance = normalizeShardValue(current);
  const goal = normalizeShardValue(target);
  if (!goal) {
    return { current: balance, target: 0, remaining: 0, overflow: 0, percent: 0, reached: false };
  }
  const remaining = Math.max(goal - balance, 0);
  const overflow = Math.max(balance - goal, 0);
  const percent = Math.min((balance / goal) * 100, 100);
  return { current: balance, target: goal, remaining, overflow, percent, reached: balance >= goal };
}

export function calculateDaysToTarget(current, target, dailyRate) {
  const progress = calculateShardProgress(current, target);
  const perDay = normalizeShardValue(dailyRate);
  if (!progress.remaining || !perDay) return null;
  return Math.ceil(progress.remaining / perDay);
}
