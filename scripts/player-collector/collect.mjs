import { mkdir, writeFile, appendFile } from "node:fs/promises";

const BASE=(process.env.PLAYER_SOURCE_API_BASE_URL||"https://zenithfcm.com/api").replace(/\/$/,"");
const OUT=process.env.PLAYER_COLLECTION_OUTPUT||"scripts/player-collector/data";
const PAGE_SIZE=Math.min(Number(process.env.PLAYER_API_PAGE_SIZE||1000),1000);
const REQUEST_DELAY_MS=Number(process.env.PLAYER_API_DELAY_MS||150);
const MAX_RETRIES=3;
const MAX_RANK=Number(process.env.PLAYER_MAX_RANK||5);

await mkdir(OUT,{recursive:true});

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function getJson(url){
  for(let attempt=1;attempt<=MAX_RETRIES;attempt++){
    try{
      const response=await fetch(url,{headers:{Accept:"application/json"}});
      if(!response.ok) throw new Error("HTTP "+response.status);
      return await response.json();
    }catch(error){
      if(attempt===MAX_RETRIES) throw error;
      await sleep(attempt*750);
    }
  }
}

function listPayload(payload){
  if(Array.isArray(payload)) return payload;
  if(!payload||typeof payload!=="object") return [];
  for(const key of ["players","data","results","items"]){
    if(Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function stableId(row){
  return String(row?.player_id??row?.playerId??row?.asset_id??row?.assetId??row?.id??"").trim();
}

function playerSlug(row){
  const name=String(row?.name??row?.card_name??row?.cardName??"player").trim();
  const ovr=Number(row?.ovr??row?.rating??0)||0;
  const id=stableId(row);
  return name.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")+"-"+ovr+"-"+id;
}

function imagesFromRow(row){
  const out=[];
  const push=(type,url,primary=false,metadata={})=>{
    if(!url) return;
    const value=String(url).trim();
    if(!value||out.some(x=>x.type===type&&x.url===value)) return;
    out.push({type,url:value,sourceUrl:BASE,metadata,isPrimary:primary});
  };
  push("player_render",row?.player_image,true,{field:"player_image"});
  push("card_background",row?.card_background,true,{field:"card_background"});
  push("nation_flag",row?.nation_flag,false,{field:"nation_flag"});
  push("club_logo",row?.club_flag,false,{field:"club_flag"});
  push("league_logo",row?.league_image,false,{field:"league_image"});
  return out;
}

function normalizeRankRow(row){
  const stats={};
  const fields=[
    "pace","acceleration","sprint_speed","shooting","finishing","long_shot","shot_power",
    "positioning","volley","penalties","passing","short_passing","long_passing","vision",
    "crossing","curve","free_kick","dribbling_head","dribbling","balance","agility",
    "reactions","ball_control","defending","marking","standing_tackle","sliding_tackle",
    "awareness","heading","physical","strength","aggression","jumping","stamina_stat",
    "diving","gk_diving","gk_positioning","handling","gk_handling","reflexes","gk_reflexes",
    "kicking","gk_kicking"
  ];
  for(const field of fields){
    const n=Number(row?.[field]);
    if(Number.isFinite(n)) stats[field]=Math.trunc(n);
  }
  return stats;
}

async function fetchRank(rank){
  const all=[];
  const seen=new Set();
  let offset=0;
  let total=null;

  while(true){
    const qs=new URLSearchParams({
      limit:String(PAGE_SIZE),
      offset:String(offset),
      rank:String(rank),
      sort_by:"ovr",
      order:"desc",
      include_price:rank===0?"true":"false"
    });
    const payload=await getJson(BASE+"/players?"+qs.toString());
    const rows=listPayload(payload);

    if(total===null && Number.isFinite(Number(payload?.pagination?.total)))
      total=Number(payload.pagination.total);

    if(!rows.length) break;

    for(const row of rows){
      const id=stableId(row);
      if(!id) continue;
      const dedupe=id+"|"+String(row?.rank??rank)+"|"+String(row?.training_level??0);
      if(seen.has(dedupe)) continue;
      seen.add(dedupe);
      all.push({
        ...row,
        rank:Number(row?.rank??rank)||rank,
        training_level:Number(row?.training_level??0)||0
      });
    }

    offset+=rows.length;
    console.log("rank",rank,"fetched",offset,total===null?"":"/"+total);

    if(rows.length<PAGE_SIZE || payload?.pagination?.has_more===false) break;
    if(total!==null && offset>=total) break;
    await sleep(REQUEST_DELAY_MS);
  }

  return all;
}

const byPlayer=new Map();

for(let rank=0;rank<=MAX_RANK;rank++){
  const rows=await fetchRank(rank);
  console.log("rank",rank,"records",rows.length);

  for(const row of rows){
    const id=stableId(row);
    if(!id) continue;

    let player=byPlayer.get(id);
    if(!player){
      player={
        assetId:id,
        playerId:id,
        cardName:String(row?.name??"").trim(),
        name:String(row?.name??"").trim(),
        fullName:String(row?.full_name??row?.fullName??row?.name??"").trim(),
        rating:Number(row?.ovr??row?.rating)||null,
        position:row?.position??null,
        alternatePosition:row?.alternate_position??null,
        positions:row?.alternate_position?String(row.alternate_position).split(/\s*[,|/]\s*/).filter(Boolean):[],
        club:row?.team??null,
        league:row?.league??null,
        nation:row?.nation_region??null,
        program:row?.event??null,
        eventName:row?.event??null,
        skillMoves:Number(row?.skill_moves_stars)||null,
        weakFoot:Number(row?.weak_foot_stars)||null,
        strongFootSide:row?.strong_foot_side??null,
        strongFootStars:Number(row?.strong_foot_stars)||null,
        preferredFoot:row?.strong_foot_side??null,
        attackWorkRate:row?.work_rate_attack??null,
        defenseWorkRate:row?.work_rate_defense??null,
        heightFtIn:row?.height_ft_in??null,
        height:Number(row?.height_cm)||null,
        weight:Number(row?.weight_kg)||null,
        stamina:Number(row?.stamina_stat)||null,
        untradeable:String(row?.is_untradable??"").toLowerCase()==="true",
        marketStatus:String(row?.is_untradable??"").toLowerCase()==="true"?"untradeable":"tradable",
        marketPrice:Number(row?.price)||null,
        dateAdded:row?.date_added??null,
        colorRating:row?.color_rating??null,
        colorPosition:row?.color_position??null,
        colorName:row?.color_name??null,
        colorLevel:row?.color_level??null,
        sourceUrl:"https://zenithfcm.com/player/"+playerSlug(row),
        images:imagesFromRow(row),
        stats:normalizeRankRow(row),
        ranks:[],
        rankStats:[],
        abilities:[],
        traits:Array.isArray(row?.traits)?row.traits:[],
        skills:Array.isArray(row?.skills)?row.skills:[],
      };
      byPlayer.set(id,player);
    }

    const rankNumber=Number(row?.rank??rank)||rank;
    const training=Number(row?.training_level??0)||0;
    const stats=normalizeRankRow(row);

    player.rankStats.push({
      rank:rankNumber,
      training,
      ovr:Number(row?.ovr??row?.rating)||null,
      stats
    });

    if(!player.ranks.some(x=>x.rank===rankNumber))
      player.ranks.push({
        rank:rankNumber,
        training,
        ovr:Number(row?.ovr??row?.rating)||null,
        modifiers:{}
      });

    if(rankNumber===0){
      Object.assign(player,{
        rating:Number(row?.ovr??row?.rating)||null,
        position:row?.position??player.position,
        alternatePosition:row?.alternate_position??player.alternatePosition,
        positions:row?.alternate_position?String(row.alternate_position).split(/\s*[,|/]\s*/).filter(Boolean):player.positions,
        club:row?.team??player.club,
        league:row?.league??player.league,
        nation:row?.nation_region??player.nation,
        program:row?.event??player.program,
        eventName:row?.event??player.eventName,
        skillMoves:Number(row?.skill_moves_stars)||player.skillMoves,
        weakFoot:Number(row?.weak_foot_stars)||player.weakFoot,
        strongFootSide:row?.strong_foot_side??player.strongFootSide,
        strongFootStars:Number(row?.strong_foot_stars)||player.strongFootStars,
        preferredFoot:row?.strong_foot_side??player.preferredFoot,
        attackWorkRate:row?.work_rate_attack??player.attackWorkRate,
        defenseWorkRate:row?.work_rate_defense??player.defenseWorkRate,
        heightFtIn:row?.height_ft_in??player.heightFtIn,
        height:Number(row?.height_cm)||player.height,
        weight:Number(row?.weight_kg)||player.weight,
        stamina:Number(row?.stamina_stat)||player.stamina,
        untradeable:String(row?.is_untradable??"").toLowerCase()==="true",
        marketStatus:String(row?.is_untradable??"").toLowerCase()==="true"?"untradeable":"tradable",
        marketPrice:Number(row?.price)||null,
        dateAdded:row?.date_added??player.dateAdded,
        colorRating:row?.color_rating??player.colorRating,
        colorPosition:row?.color_position??player.colorPosition,
        colorName:row?.color_name??player.colorName,
        colorLevel:row?.color_level??player.colorLevel,
        stats
      });
      for(const image of imagesFromRow(row)){
        const exists=player.images.some(x=>x.type===image.type);
        if(!exists) player.images.push(image);
      }
      player.traits=Array.isArray(row?.traits)?row.traits:player.traits;
      player.skills=Array.isArray(row?.skills)?row.skills:player.skills;
    }
  }
}

const players=[...byPlayer.values()];
await writeFile(OUT+"/players.jsonl",players.map(JSON.stringify).join("\n")+"\n");
await writeFile(OUT+"/collection-summary.json",JSON.stringify({
  players:players.length,
  maxRank:MAX_RANK,
  records:players.reduce((n,p)=>n+p.rankStats.length,0),
  generatedAt:new Date().toISOString()
},null,2));
console.log("unique players",players.length);
console.log("rank snapshots",players.reduce((n,p)=>n+p.rankStats.length,0));
