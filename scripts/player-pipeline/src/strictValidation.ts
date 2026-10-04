import type { NormalizedPlayer } from "./types.ts";

export function qualityGate(p: NormalizedPlayer) {
  const errors:string[]=[];
  const statsCount=Object.keys(p.stats).length;

  if (!p.player_id) errors.push("missing stable id");
  if (!p.name) errors.push("missing name");
  if (p.ovr == null) errors.push("missing ovr");
  if (!p.primary_position) errors.push("missing position");
  if (!p.club) errors.push("missing club");
  if (!p.league) errors.push("missing league");
  if (!p.nation) errors.push("missing nation");
  if (!p.event) errors.push("missing event");
  if (statsCount < 10) errors.push("insufficient detailed stats");

  return {accepted:errors.length===0,errors};
}

export function gateBatch(players:NormalizedPlayer[]) {
  const seen=new Set<string>();
  const duplicateIds:string[]=[];
  const rejected:Array<{id:string;errors:string[]}>=[];

  for (const player of players) {
    if (seen.has(player.player_id)) duplicateIds.push(player.player_id);
    seen.add(player.player_id);

    const result=qualityGate(player);
    if (!result.accepted) rejected.push({id:player.player_id,errors:result.errors});
  }

  return {
    total:players.length,
    unique:seen.size,
    duplicateIds,
    rejected,
    accepted:players.length-rejected.length,
    valid:duplicateIds.length===0 && rejected.length===0
  };
}