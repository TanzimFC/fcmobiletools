export function getStarShardRule(data, ovr, era) {
  const value = Number(ovr);
  if (!Number.isInteger(value)) return null;
  const rule = data?.releaseValueRules?.find((item) => value >= item.minOvr && value <= item.maxOvr);
  if (!rule) return null;
  const shards = era === 'after' ? rule.afterCutoff : rule.beforeCutoff;
  if (!Number.isFinite(Number(shards))) return null;
  return { ...rule, shards: Number(shards) };
}

export function calculateExchange(rows, data) {
  let total = 0;
  let unresolved = 0;
  for (const row of rows || []) {
    const count = Math.max(0, Math.floor(Number(row.count) || 0));
    if (!count) continue;
    const rule = getStarShardRule(data, row.ovr, row.era);
    if (!rule) {
      unresolved += count;
      continue;
    }
    total += rule.shards * count;
  }
  return { total, unresolved };
}

export function calculateSigningGap(currentShards, exchangeShards, signingCost) {
  const current = Math.max(0, Math.floor(Number(currentShards) || 0));
  const added = Math.max(0, Math.floor(Number(exchangeShards) || 0));
  const cost = Math.max(0, Math.floor(Number(signingCost) || 0));
  const afterExchange = current + added;
  return {
    current,
    added,
    cost,
    afterExchange,
    remaining: Math.max(cost - afterExchange, 0),
    surplus: Math.max(afterExchange - cost, 0),
    percent: cost ? Math.min((afterExchange / cost) * 100, 100) : 0
  };
}
