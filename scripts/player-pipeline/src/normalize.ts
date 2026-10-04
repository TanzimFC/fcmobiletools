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

const abilityKey = (type: string, name: string) => type + ":" + slug(name);

function collectAbilities(raw: RawPlayer) {
  const result: Array<{key:string;name:string;type:string|null;value:unknown}> = [];
  const seen = new Set<string>();

  const add = (type:string, value:unknown, fallbackName?:string) => {
    const name = typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? text((value as any).name ?? (value as any).label ?? (value as any).title)
        : fallbackName;

    if (!name) return;
    const key = abilityKey(type, name);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ key, name, type, value });
  };

  const playStyles = first(raw.playStyles, raw.playstyles, raw.skillStyleSkills);
  if (Array.isArray(playStyles)) playStyles.forEach(v => add("playstyle", v));
  else if (playStyles && typeof playStyles === "object")
    Object.entries(playStyles as Record<string, unknown>).forEach(([k,v]) => add("playstyle", v, k));

  const traits = raw.traits;
  if (Array.isArray(traits)) traits.forEach(v => add("trait", v));
  else if (traits && typeof traits === "object")
    Object.entries(traits as Record<string, unknown>).forEach(([k,v]) => add("trait", v, k));

  return result;
}

function collectAssets(raw: RawPlayer) {
  const map = new Map<string, {type:string;url:string;source_url:string|null;metadata:Record<string,unknown>;is_primary:boolean}>();

  const add = (
    type:string,
    value:unknown,
    sourceUrl:unknown = raw.sourceUrl,
    metadata:Record<string,unknown> = {},
    primary=false
  ) => {
    const url = text(typeof value === "object" && value !== null
      ? first((value as any).url, (value as any).src, (value as any).image)
      : value);
    if (!url || map.has(type)) return;
    map.set(type, {
      type,
      url,
      source_url:text(sourceUrl),
      metadata,
      is_primary:primary
    });
  };

  add("card", first(raw.cardImage, raw.card, raw.images && typeof raw.images === "object" ? (raw.images as any).card : null), raw.sourceUrl, {}, true);
  add("player_render", first(raw.playerRender, raw.playerImage, raw.render, raw.images && typeof raw.images === "object" ? first((raw.images as any).playerRender, (raw.images as any).player, (raw.images as any).render) : null), raw.sourceUrl, {}, true);
  add("card_background", first(raw.cardBackground, raw.cardBackgroundImage, raw.images && typeof raw.images === "object" ? first((raw.images as any).cardBackground, (raw.images as any).background) : null));
  add("card_frame", first(raw.cardFrame, raw.cardFrameImage, raw.images && typeof raw.images === "object" ? (raw.images as any).cardFrame : null));
  add("club_logo", first(raw.clubLogo, raw.images && typeof raw.images === "object" ? (raw.images as any).clubLogo : null));
  add("league_logo", first(raw.leagueLogo, raw.images && typeof raw.images === "object" ? (raw.images as any).leagueLogo : null));
  add("nation_flag", first(raw.nationFlag, raw.nationImage, raw.images && typeof raw.images === "object" ? first((raw.images as any).nationFlag, (raw.images as any).nation) : null));

  const images = raw.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (!image || typeof image !== "object") continue;
      const type = text((image as any).type ?? (image as any).assetType);
      const url = text((image as any).url ?? (image as any).src ?? (image as any).image);
      if (type && url && !map.has(type)) {
        add(type, url, (image as any).sourceUrl, (image as any).metadata ?? {}, Boolean((image as any).isPrimary));
      }
    }
  }

  return [...map.values()];
}

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
    ranks: Array.isArray(raw.ranks) ? raw.ranks.map((r:any,index:number)=>({
      rank: num(r?.rank) ?? index,
      training: num(r?.training) ?? 0,
      ovr: num(first(r?.ovr,r?.rating)),
      modifiers: r?.modifiers && typeof r.modifiers === "object" ? r.modifiers : {}
    })).filter((r:any)=>r.rank>=0 && r.rank<=5) : [],
    abilities: collectAbilities(raw),
    assets: collectAssets(raw),
    prices: Array.isArray(raw.prices) ? raw.prices.map((p:any)=>({
      price:num(first(p?.price,p?.value)) ?? 0,
      observed_at:text(p?.observedAt) ?? observedAt
    })).filter((p:any)=>p.price>0) : [],
    shard_costs: Array.isArray(raw.shardCosts) ? raw.shardCosts.map((s:any,index:number)=>({
      rank:num(s?.rank) ?? index+1,
      shard_cost:num(first(s?.cost,s?.shardCost))
    })).filter((s:any)=>s.rank>=0 && s.rank<=5) : []
  };
}