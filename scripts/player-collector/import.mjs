import { readFile } from "node:fs/promises";

const input=process.env.PLAYER_COLLECTION_NORMALIZED||"scripts/player-collector/data/normalized.jsonl";
const url=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const rows=(await readFile(input,"utf8")).split("\n").filter(Boolean).map(JSON.parse);
const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"};
const chunks=(a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n));
const post=async(table,data)=>{
  if(!data.length) return;
  const r=await fetch(url+"/rest/v1/"+table,{method:"POST",headers,body:JSON.stringify(data)});
  if(!r.ok) throw new Error(table+" failed "+r.status+" "+(await r.text()).slice(0,300));
};

for(const batch of chunks(rows,100)){
  await post("players",batch.map(p=>({
    player_id:p.assetId,slug:p.slug,name:p.cardName,full_name:p.fullName??p.cardName,
    ovr:p.rating,primary_position:p.position,alternate_positions:p.positions||[],
    club:p.club,league:p.league,nation:p.nation,event:p.program,
    skill_moves:p.skillMoves,weak_foot:p.weakFoot,preferred_foot:p.preferredFoot||null,
    attack_work_rate:p.attackWorkRate,defense_work_rate:p.defenseWorkRate,
    height_cm:p.height,weight_kg:p.weight,untradeable:!!p.untradeable,active:true,
    date_added:p.dateAdded??null,market_status:p.marketStatus??null,market_price:p.marketPrice??null,
    source_url:p.sourceUrl,source_observed_at:p.sourceObservedAt,
    source_payload_hash:p.sourcePayloadHash,data_quality_score:p.dataQualityScore
  })));
}

const q=rows.map(p=>encodeURIComponent(p.assetId)).join(",");
const lookup=await fetch(url+"/rest/v1/players?select=id,player_id&player_id=in.("+q+")",{headers});
if(!lookup.ok) throw new Error("player lookup failed "+lookup.status);
const ids=new Map((await lookup.json()).map(x=>[x.player_id,x.id]));

for(const batch of chunks(rows,100)){
  const stats=[],ranks=[],assets=[],abilityRows=new Map(),links=[];
  for(const p of batch){
    const id=ids.get(p.assetId); if(!id) continue;
    stats.push({player_id:id,rank:0,training:0,stats:p.stats||{},source_url:p.sourceUrl,source_observed_at:p.sourceObservedAt,source_checksum:p.sourcePayloadHash});
    for(const r of p.ranks||[]) ranks.push({player_id:id,rank:r.rank,training:r.training||0,ovr:r.ovr??null,modifiers:r.modifiers||{},source_url:p.sourceUrl,source_observed_at:p.sourceObservedAt,source_checksum:p.sourcePayloadHash});
    for(const a of p.images||[]) assets.push({player_id:id,asset_type:a.type,asset_url:a.url,source_url:a.sourceUrl,metadata:a.metadata||{},is_primary:!!a.isPrimary,checksum:p.sourcePayloadHash});
    for(const a of p.abilities||[]) abilityRows.set(a.key,{name:a.name,type:a.type,metadata:{value:a.value}});
  }
  await post("player_stats",stats);
  await post("player_ranks",ranks);
  await post("player_assets",assets);
  await post("player_abilities",[...abilityRows].map(([ability_key,a])=>({ability_key,name:a.name,ability_type:a.type,metadata:a.metadata})));
}
console.log(JSON.stringify({imported:rows.length},null,2));
