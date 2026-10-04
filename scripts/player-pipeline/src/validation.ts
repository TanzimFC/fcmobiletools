import type { NormalizedPlayer } from "./types.ts";

export function validatePlayer(p: NormalizedPlayer) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!p.player_id) errors.push("missing id");
  if (!p.name) errors.push("missing name");
  if (p.ovr == null) warnings.push("missing ovr");
  if (!p.primary_position) warnings.push("missing position");
  if (!p.club) warnings.push("missing club");
  if (!p.league) warnings.push("missing league");
  if (!p.nation) warnings.push("missing nation");
  if (!p.event) warnings.push("missing event");
  if (!Object.keys(p.stats).length) warnings.push("missing stats");

  return { valid: errors.length === 0, errors, warnings };
}

export function validateBatch(players: NormalizedPlayer[]) {
  const ids = new Set<string>();
  const duplicateIds: string[] = [];
  const rejected: string[] = [];

  for (const p of players) {
    if (ids.has(p.player_id)) duplicateIds.push(p.player_id);
    ids.add(p.player_id);
    if (!validatePlayer(p).valid) rejected.push(p.player_id);
  }

  return { valid: !duplicateIds.length && !rejected.length, total: players.length, unique: ids.size, duplicateIds, rejected };
}