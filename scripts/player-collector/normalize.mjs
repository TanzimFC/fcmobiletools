import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const input=process.env.PLAYER_COLLECTION_INPUT||"scripts/player-collector/data/players.jsonl";
const output=process.env.PLAYER_COLLECTION_NORMALIZED||"scripts/player-collector/data/normalized.jsonl";
const min=Number(process.env.PLAYER_QUALITY_MIN||60);

const source=await readFile(input,"utf8");
const rows=source.split("\n").filter(Boolean).map(JSON.parse);
const seen=new Set(), accepted=[], rejected=[];
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const slug=x=>x.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");

for(const raw of rows){
  const id=String(raw.assetId||raw.playerId||"");
  const name=String(raw.cardName||raw.name||"").trim();
  const stats=raw.stats&&typeof raw.stats==="object"?raw.stats:{};
  const images=Array.isArray(raw.images)?raw.images:[];
  const hasVisual=images.some(x=>x.type==="player_render"||x.type==="card_background");
  const errors=[];
  if(!id) errors.push("missing stable id");
  if(!name) errors.push("missing name");
  if(!raw.rating) errors.push("missing ovr");
  if(!raw.position) errors.push("missing position");
  if(!raw.league) errors.push("missing league");
  if(!raw.program) errors.push("missing event");
  if(Object.keys(stats).length<10) errors.push("insufficient stats");
  if(!hasVisual) errors.push("missing player visual");

  if(seen.has(id)) errors.push("duplicate stable id");
  seen.add(id);

  const score=Math.min(100,
    (id&&name?25:0)+
    (raw.rating?15:0)+
    (raw.position?10:0)+
    (raw.league?10:0)+
    (raw.program?10:0)+
    Math.min(20,Math.round(Object.keys(stats).length/35*20))+
    (hasVisual?10:0)
  );

  const normalized={
    ...raw,
    assetId:id,
    cardName:name,
    slug:slug(name)+"-"+id,
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
