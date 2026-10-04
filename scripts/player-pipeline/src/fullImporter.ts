import { config } from "./config.ts";
import type { NormalizedPlayer } from "./types.ts";

const endpoint = (table: string) => config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + table;

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing server-side Supabase key");
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
}

async function post(table: string, rows: unknown[]) {
  if (!rows.length) return;
  const response = await fetch(endpoint(table), {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(table + " write failed: " + response.status);
}

async function getIds(ids: string[]) {
  const query = ids.map(id => encodeURIComponent(id)).join(",");
  const response = await fetch(endpoint("players") + "?select=id,player_id&player_id=in.(" + query + ")", {
    headers: headers()
  });
  if (!response.ok) throw new Error("player id lookup failed: " + response.status);
  return await response.json() as Array<{ id: number; player_id: string }>;
}

export async function importFull(players: NormalizedPlayer[]) {
  await post("players", players.map(p => ({
    player_id:p.player_id, slug:p.slug, name:p.name, ovr:p.ovr,
    primary_position:p.primary_position, alternate_positions:p.alternate_positions,
    club:p.club, league:p.league, nation:p.nation, event:p.event,
    skill_moves:p.skill_moves, weak_foot:p.weak_foot,
    attack_work_rate:p.attack_work_rate, defense_work_rate:p.defense_work_rate,
    height_cm:p.height_cm, weight_kg:p.weight_kg, untradeable:p.untradeable,
    active:p.active, source_name:p.source_name, source_url:p.source_url,
    source_observed_at:p.source_observed_at, source_checksum:p.source_checksum,
    source_payload_hash:p.source_payload_hash, data_quality_score:p.data_quality_score
  })));

  const map = new Map((await getIds(players.map(p => p.player_id))).map(x => [x.player_id, x.id]));

  const stats:any[] = [];
  const ranks:any[] = [];
  const prices:any[] = [];
  const shards:any[] = [];
  const assets:any[] = [];
  const abilities:any[] = [];

  for (const p of players) {
    const internalId = map.get(p.player_id);
    if (!internalId) continue;

    for (const [key, value] of Object.entries(p.stats)) {
      stats.push({
        player_id: internalId,
        rank: 0,
        training: 0,
        stats: { [key]: value },
        source_name: p.source_name,
        source_url: p.source_url,
        source_observed_at: p.source_observed_at,
        source_checksum: p.source_checksum
      });
    }

    for (const r of p.ranks) ranks.push({
      player_id: internalId,
      rank: r.rank,
      training: r.training,
      ovr: r.ovr,
      modifiers: r.modifiers,
      source_name: p.source_name,
      source_url: p.source_url,
      source_observed_at: p.source_observed_at,
      source_checksum: p.source_checksum
    });

    for (const price of p.prices) prices.push({
      player_id: internalId,
      price: price.price,
      observed_at: price.observed_at,
      source_name: p.source_name,
      source_url: p.source_url,
      source_checksum: p.source_checksum
    });

    for (const shard of p.shard_costs) shards.push({
      player_id: internalId,
      rank: shard.rank,
      shard_cost: shard.shard_cost,
      source_name: p.source_name,
      source_url: p.source_url,
      source_observed_at: p.source_observed_at
    });

    for (const asset of p.assets) assets.push({
      player_id: internalId,
      asset_type: asset.type,
      asset_url: asset.url,
      source_name: p.source_name,
      source_url: asset.source_url,
      checksum: p.source_checksum
    });

    for (const ability of p.abilities) abilities.push({ player_id: internalId, ...ability });
  }

  await Promise.all([
    post("player_stats", stats),
    post("player_ranks", ranks),
    post("player_prices", prices),
    post("player_shard_costs", shards),
    post("player_assets", assets)
  ]);

  return {
    players: players.length,
    stats: stats.length,
    ranks: ranks.length,
    prices: prices.length,
    shardCosts: shards.length,
    assets: assets.length,
    abilities: abilities.length
  };
}