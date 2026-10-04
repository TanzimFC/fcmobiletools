export type RawPlayer = Record<string, unknown>;

export interface PlayerRecord {
  player_id: string;
  slug: string;
  name: string;
  ovr: number | null;
  primary_position: string | null;
  alternate_positions: string[];
  club: string | null;
  league: string | null;
  nation: string | null;
  event: string | null;
  skill_moves: number | null;
  weak_foot: number | null;
  attack_work_rate: string | null;
  defense_work_rate: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  untradeable: boolean;
  active: boolean;
  source_url: string | null;
  source_observed_at: string;
  source_checksum: string | null;
  source_payload_hash: string | null;
  data_quality_score: number;
}

export interface NormalizedPlayer extends PlayerRecord {
  stats: Record<string, number>;
  ranks: Array<{ rank: number; training: number; ovr: number | null; modifiers: Record<string, unknown> }>;
  abilities: Array<{ key: string; name: string; type: string | null; value: unknown }>;
  assets: Array<{ type: string; url: string; source_url: string | null }>;
  prices: Array<{ price: number; observed_at: string }>;
  shard_costs: Array<{ rank: number; shard_cost: number | null }>;
}

export interface SearchPage {
  items: RawPlayer[];
  nextCursor: unknown[] | null;
}
