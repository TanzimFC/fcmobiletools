import { config } from "./config.ts";
import type { NormalizedPlayer } from "./types.ts";

function jsonHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing server-side Supabase key");
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal"
  };
}

async function upsert(table: string, rows: unknown[]) {
  if (!rows.length) return;
  const response = await fetch(config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + table, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(table + " import failed: " + response.status);
}

export async function importPlayers(players: NormalizedPlayer[]) {
  if (!config.supabaseUrl) throw new Error("Missing SUPABASE_URL");

  for (const p of players) {
    await upsert("players", [{
      player_id: p.player_id,
      slug: p.slug,
      name: p.name,
      ovr: p.ovr,
      primary_position: p.primary_position,
      alternate_positions: p.alternate_positions,
      club: p.club,
      league: p.league,
      nation: p.nation,
      event: p.event,
      skill_moves: p.skill_moves,
      weak_foot: p.weak_foot,
      attack_work_rate: p.attack_work_rate,
      defense_work_rate: p.defense_work_rate,
      height_cm: p.height_cm,
      weight_kg: p.weight_kg,
      untradeable: p.untradeable,
      active: p.active,
      source_name: p.source_name,
      source_url: p.source_url,
      source_observed_at: p.source_observed_at,
      source_checksum: p.source_checksum,
      source_payload_hash: p.source_payload_hash,
      data_quality_score: p.data_quality_score
    }]);
  }

  return { imported: players.length };
}