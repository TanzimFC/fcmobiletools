import type { NormalizedPlayer, RawPlayer } from "./types.ts";

const text = (v: unknown) => v == null || v === "" ? null : String(v).trim() || null;
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const first = (...v: unknown[]) => v.find(x => x != null && x !== "");
const slug = (v: string) => v.toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

export function normalize(raw: RawPlayer, observedAt = new Date().toISOString()): NormalizedPlayer {
  const playerId = text(first(raw.assetId, raw.playerId, raw.id));
  const name = text(first(raw.cardName, raw.name, raw.playerName));

  if (!playerId) throw new Error("Missing stable player id");
  if (!name) throw new Error("Missing player name");

  const statsRaw = raw.stats && typeof raw.stats === "object" ? raw.stats as Record<string, unknown> : {};
  const stats = Object.fromEntries(
    Object.entries(statsRaw)
      .map(([key, value]) => [key, Number(value)])
      .filter(([, value]) => Number.isFinite(value))
  );

  const filled = [
    playerId, name, raw.rating ?? raw.ovr, raw.position,
    raw.club, raw.league, raw.nation, raw.program, raw.skillMoves,
    raw.weakFoot, raw.height, raw.weight
  ].filter(v => v != null && v !== "").length;

  return {
    player_id: playerId,
    slug: slug(name) + "-" + playerId,
    name,
    ovr: num(first(raw.rating, raw.ovr, raw.overall)),
    primary_position: text(first(raw.position, raw.primaryPosition)),
    alternate_positions: Array.isArray(raw.positions) ? raw.positions.map(String) : [],
    club: text(first(raw.club, raw.team)),
    league: text(raw.league),
    nation: text(first(raw.nation, raw.country)),
    event: text(first(raw.program, raw.event)),
    skill_moves: num(first(raw.skillMoves, raw.skill_moves)),
    weak_foot: num(first(raw.weakFoot, raw.weak_foot)),
    attack_work_rate: text(first(raw.attackWorkRate, raw.attackingWorkRate)),
    defense_work_rate: text(first(raw.defenseWorkRate, raw.defendingWorkRate)),
    height_cm: num(first(raw.heightCm, raw.height)),
    weight_kg: num(first(raw.weightKg, raw.weight)),
    untradeable: raw.untradeable === true,
    active: raw.active !== false,
    source_url: text(raw.sourceUrl),
    source_observed_at: observedAt,
    source_checksum: text(raw.checksum),
    source_payload_hash: null,
    data_quality_score: Math.round((filled / 13) * 100),
    stats,
    ranks: [],
    abilities: [],
    assets: [],
    prices: [],
    shard_costs: []
  };
}