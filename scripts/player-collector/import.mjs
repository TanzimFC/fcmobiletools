import { readFile } from "node:fs/promises";

const input=process.env.PLAYER_COLLECTION_NORMALIZED||"scripts/player-collector/data/normalized.jsonl";
const url=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");

const rows=(await readFile(input,"utf8")).split("\n").filter(Boolean).map(JSON.parse);
const headers={apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"};
const chunks=(a,n)=>Array.from({length:Math.ceil(a.length/n)},(_,i)=>a.slice(i*n,(i+1)*n));

async function post(table,data,onConflict=""){
  if(!data.length) return;
  const endpoint=url+"/rest/v1/"+table+(onConflict?"?on_conflict="+encodeURIComponent(onConflict):"");
  const response=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify(data)});
  if(!response.ok) throw new Error(table+" failed "+response.status+" "+(await response.text()).slice(0,500));
}

for(const batch of chunks(rows,100)){
  await post("players",batch.map(p=>({
    player_id:p.assetId,slug:p.slug,name:p.cardName,full_name:p.fullName||p.cardName,
    ovr:p.rating,primary_position:p.position,alternate_positions:p.positions||[],
    club:p.club,league:p.league,nation:p.nation,event:p.program,
    skill_moves:p.skillMoves,weak_foot:p.weakFoot,
    strong_foot_side:p.strongFootSide||null,strong_foot_stars:p.strongFootStars||null,
    preferred_foot:p.preferredFoot||null,attack_work_rate:p.attackWorkRate||null,
    defense_work_rate:p.defenseWorkRate||null,height_ft_in:p.heightFtIn||null,
    height_cm:p.height||null,weight_kg:p.weight||null,stamina_stat:p.stamina||null,
    untradeable:!!p.untradeable,active:true,date_added:p.dateAdded||null,
    market_status:p.marketStatus||null,market_price:p.marketPrice||null,
    color_rating:p.colorRating||null,color_position:p.colorPosition||null,
    color_name:p.colorName||null,color_level:p.colorLevel||null,
    source_url:p.sourceUrl,source_observed_at:p.sourceObservedAt,
    source_payload_hash:p.sourcePayloadHash,data_quality_score:p.dataQualityScore
  })),"player_id");
  console.log("players",batch.length);
}

const ids=[...new Set(rows.map(p=>p.assetId).filter(Boolean))];
const q=ids.map(id=>encodeURIComponent(id)).join(",");
const lookup=await fetch(url+"/rest/v1/players?select=id,player_id&player_id=in.("+q+")",{headers});
if(!lookup.ok) throw new Error("player lookup failed "+lookup.status);
const idMap=new Map((await lookup.json()).map(x=>[String(x.player_id),x.id]));

for(const batch of chunks(rows,100)){
  const stats=[];
  const ranks=[];
  const assets=[];
  const abilityMap=new Map();

  for(const p of batch){
    const id=idMap.get(String(p.assetId));
    if(!id) continue;

    for(const snap of Array.isArray(p.rankStats)?p.rankStats:[]){
      stats.push({
        player_id:id,rank:Number(snap.rank)||0,training:Number(snap.training)||0,
        stats:snap.stats||{},source_url:p.sourceUrl,
        source_observed_at:p.sourceObservedAt,source_checksum:p.sourcePayloadHash
      });
    }

    for(const r of Array.isArray(p.ranks)?p.ranks:[]){
      ranks.push({
        player_id:id,rank:Number(r.rank)||0,training:Number(r.training)||0,
        ovr:r.ovr??null,modifiers:r.modifiers||{},source_url:p.sourceUrl,
        source_observed_at:p.sourceObservedAt,source_checksum:p.sourcePayloadHash
      });
    }

    for(const a of Array.isArray(p.images)?p.images:[]){
      assets.push({
        player_id:id,asset_type:a.type,asset_url:a.url,source_url:a.sourceUrl,
        metadata:a.metadata||{},is_primary:!!a.isPrimary,checksum:p.sourcePayloadHash
      });
    }

    const addAbility=(type,value)=>{
      const name=typeof value==="string"
        ? value.trim()
        : String(value?.name??value?.label??value?.title??"").trim();
      if(!name) return;
      const abilityKey=type+":"+name.toLowerCase().replace(/\W+/g,"-");
      if(!abilityMap.has(abilityKey))
        abilityMap.set(abilityKey,{name,type,metadata:{raw:value}});
    };

    for(const value of Array.isArray(p.skills)?p.skills:[]) addAbility("skill",value);
    for(const value of Array.isArray(p.traits)?p.traits:[]) addAbility("trait",value);
  }

  await post("player_stats",stats,"player_id,rank,training");
  await post("player_ranks",ranks,"player_id,rank,training");
  await post("player_assets",assets,"player_id,asset_type,asset_url");
  await post("player_abilities",[...abilityMap].map(([ability_key,a])=>({
    ability_key,name:a.name,ability_type:a.type,metadata:a.metadata
  })),"ability_key");

  if(abilityMap.size){
    const keys=[...abilityMap.keys()].map(encodeURIComponent).join(",");
    const response=await fetch(url+"/rest/v1/player_abilities?select=id,ability_key&ability_key=in.("+keys+")",{headers});
    if(response.ok){
      const abilityIds=new Map((await response.json()).map(x=>[x.ability_key,x.id]));
      const linkSeen=new Set();
      const links=[];

      for(const p of batch){
        const playerId=idMap.get(String(p.assetId));
        if(!playerId) continue;

        const values=[
          ...(Array.isArray(p.skills)?p.skills:[]).map(value=>({type:"skill",value})),
          ...(Array.isArray(p.traits)?p.traits:[]).map(value=>({type:"trait",value}))
        ];

        for(const item of values){
          const name=typeof item.value==="string"
            ? item.value.trim()
            : String(item.value?.name??item.value?.label??item.value?.title??"").trim();
          if(!name) continue;

          const abilityKey=item.type+":"+name.toLowerCase().replace(/\W+/g,"-");
          const abilityId=abilityIds.get(abilityKey);
          if(!abilityId) continue;

          const linkKey=String(playerId)+":"+String(abilityId);
          if(linkSeen.has(linkKey)) continue;
          linkSeen.add(linkKey);

          links.push({
            player_id:playerId,
            ability_id:abilityId,
            value:item.value&&typeof item.value==="object"?item.value:{value:item.value}
          });
        }
      }

      await post("player_ability_links",links,"player_id,ability_id");
    }
  }
}

console.log(JSON.stringify({
  importedPlayers:rows.length,
  rankSnapshots:rows.reduce((n,p)=>n+(Array.isArray(p.rankStats)?p.rankStats.length:0),0)
},null,2));
