import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const input=process.env.PLAYER_COLLECTION_INPUT||"scripts/player-collector/data/players.jsonl";
const output=process.env.PLAYER_COLLECTION_NORMALIZED||"scripts/player-collector/data/normalized.jsonl";
const min=Number(process.env.PLAYER_QUALITY_MIN||60);

const rows=(await readFile(input,"utf8")).split("\n").filter(Boolean).map(JSON.parse);
const seen=new Set();
const accepted=[];
const rejected=[];
const slugify=x=>String(x).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");

for(const raw of rows){
  const id=String(raw.assetId||raw.playerId||"").trim();
  const name=String(raw.cardName||raw.name||"").trim();
  const stats=raw.stats&&typeof raw.stats==="object"?raw.stats:{};
  const rankStats=Array.isArray(raw.rankStats)?raw.rankStats:[];
  const images=Array.isArray(raw.images)?raw.images:[];
  const hasRender=images.some(x=>x.type==="player_render");
  const hasCardBackground=images.some(x=>x.type==="card_background");
  const errors=[];

  if(!id) errors.push("missing stable id");
  if(!name) errors.push("missing name");
  if(!raw.rating) errors.push("missing ovr");
  if(!raw.position) errors.push("missing position");
  if(!raw.league) errors.push("missing league");
  if(!raw.program) errors.push("missing event");
  if(Object.keys(stats).length<10) errors.push("insufficient base stats");
  if(!hasRender&&!hasCardBackground) errors.push("missing card/player visual");

  if(seen.has(id)) errors.push("duplicate stable id");
  seen.add(id);

  const corePresent=[id,name,raw.rating,raw.position,raw.club,raw.league,raw.nation,raw.program,raw.skillMoves,raw.weakFoot];
  const score=Math.min(100,
    Math.round(corePresent.filter(Boolean).length/10*55)+
    Math.min(25,Math.round(Object.keys(stats).length/35*25))+
    Math.min(10,rankStats.length/6*10)+
    (hasRender?5:0)+
    (hasCardBackground?5:0)
  );

  const normalized={
    ...raw,
    assetId:id,
    cardName:name,
    slug:slugify(name)+"-"+String(raw.rating||0)+"-"+id,
    sourceObservedAt:new Date().toISOString(),
    sourcePayloadHash:hash(raw),
    dataQualityScore:score
  };

  if(errors.length||score<min) rejected.push({player:normalized,errors,score});
  else accepted.push(normalized);
}

await writeFile(output,accepted.map(JSON.stringify).join("\n")+"\n");
await writeFile(output.replace(/\.jsonl$/,".rejected.json"),JSON.stringify(rejected,null,2));
console.log(JSON.stringify({discovered:rows.length,accepted:accepted.length,rejected:rejected.length},null,2));
