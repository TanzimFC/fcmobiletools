import { config } from "./config.ts";
import type { NormalizedPlayer } from "./types.ts";

const base = () => config.supabaseUrl.replace(/\/$/, "") + "/rest/v1";

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing server-side Supabase key");
  return { apikey:key, Authorization:"Bearer "+key, "Content-Type":"application/json" };
}

async function write(table:string, rows:unknown[]) {
  if (!rows.length) return;
  const response = await fetch(base()+"/"+table, {
    method:"POST",
    headers:{...authHeaders(), Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(table+" write failed: "+response.status);
}

async function lookup(ids:string[]) {
  const value = ids.map(id => id.replace(/[^a-zA-Z0-9_.:-]/g, "")).filter(Boolean).join(",");
  const response = await fetch(base()+"/players?select=id,player_id&player_id=in.("+value+")", {headers:authHeaders()});
  if (!response.ok) throw new Error("player lookup failed: "+response.status);
  return await response.json() as Array<{id:number;player_id:string}>;
}

export async function importFull(players:NormalizedPlayer[]) {
  await write("players", players.map(p => ({
    player_id:p.player_id, slug:p.slug, name:p.name, ovr:p.ovr,
    primary_position:p.primary_position, alternate_positions:p.alternate_positions,
    club:p.club, league:p.league, nation:p.nation, event:p.event,
    skill_moves:p.skill_moves, weak_foot:p.weak_foot,
    attack_work_rate:p.attack_work_rate, defense_work_rate:p.defense_work_rate,
    height_cm:p.height_cm, weight_kg:p.weight_kg,
    untradeable:p.untradeable, active:p.active,
    source_name:p.source_name, source_url:p.source_url,
    source_observed_at:p.source_observed_at, source_checksum:p.source_checksum,
    source_payload_hash:p.source_payload_hash,
    data_quality_score:p.data_quality_score
  })));

  const ids = new Map((await lookup(players.map(p=>p.player_id))).map(x=>[x.player_id,x.id]));
  const stats:any[]=[]; const ranks:any[]=[]; const prices:any[]=[]; const shards:any[]=[]; const assets:any[]=[];

  for (const p of players) {
    const id=ids.get(p.player_id);
    if (!id) continue;

    stats.push({
      player_id:id, rank:0, training:0, stats:p.stats,
      source_name:p.source_name, source_url:p.source_url,
      source_observed_at:p.source_observed_at, source_checksum:p.source_checksum
    });

    for (const r of p.ranks) ranks.push({
      player_id:id, rank:r.rank, training:r.training, ovr:r.ovr,
      modifiers:r.modifiers, source_name:p.source_name,
      source_url:p.source_url, source_observed_at:p.source_observed_at,
      source_checksum:p.source_checksum
    });

    for (const price of p.prices) prices.push({
      player_id:id, price:price.price, observed_at:price.observed_at,
      source_name:p.source_name, source_url:p.source_url,
      source_checksum:p.source_checksum
    });

    for (const shard of p.shard_costs) shards.push({
      player_id:id, rank:shard.rank, shard_cost:shard.shard_cost,
      source_name:p.source_name, source_url:p.source_url,
      source_observed_at:p.source_observed_at
    });

    for (const asset of p.assets) assets.push({
      player_id:id, asset_type:asset.type, asset_url:asset.url,
      source_name:p.source_name, source_url:asset.source_url,
      checksum:p.source_checksum
    });
  }

  await write("player_stats",stats);
  await write("player_ranks",ranks);
  await write("player_prices",prices);
  await write("player_shard_costs",shards);
  await write("player_assets",assets);

  return {players:players.length,stats:stats.length,ranks:ranks.length,prices:prices.length,shardCosts:shards.length,assets:assets.length};
}