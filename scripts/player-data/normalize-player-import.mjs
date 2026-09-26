#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const POSITION_SET = new Set(['GK','RB','RWB','CB','LB','LWB','CDM','RM','CM','LM','CAM','RW','LW','CF','ST']);
const ALIASES = {
  player_id: ['player_id','asset_id','assetid','id','resource_id'],
  name: ['name','player_name','playername'],
  ovr: ['ovr','overall','rating'],
  position: ['position','pos'],
  alternate_positions: ['alternate_positions','alt_positions','alternative_positions'],
  event: ['event','program','campaign'],
  club: ['club','team'],
  league: ['league'],
  nation: ['nation','country'],
  is_untradable: ['is_untradable','untradable','untradeable'],
  current_sell_price: ['current_sell_price','sell_price','price','market_price'],
  lowest_sell_price: ['lowest_sell_price','min_price','lowest_price'],
  highest_sell_price: ['highest_sell_price','max_price','highest_price'],
  shard_cost: ['shard_cost','shard_requirement','shards','cost_in_shards'],
  shard_type: ['shard_type','shard_currency'],
  event_phase: ['event_phase','phase','week'],
  observed_at: ['observed_at','updated_at','price_updated_at','timestamp'],
  player_image: ['player_image','image','image_url','player_image_url'],
  card_background: ['card_background','background_url','card_bg'],
  stats: ['stats','attributes']
};
const key = (s) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const parseBool = (v) => v === true || /^(true|1|yes|y|untradable)$/i.test(String(v ?? '').trim()) ? true : v === false || /^(false|0|no|n|tradable)$/i.test(String(v ?? '').trim()) ? false : null;
const nullableNumber = (v) => v === '' || v == null ? null : Number(v);
const slugify = (v) => key(v).replace(/_/g,'-');

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i=0; i<text.length; i++) {
    const ch=text[i];
    if (quoted) { if (ch==='"' && text[i+1]==='"') { cell+='"'; i++; } else if(ch==='"') quoted=false; else cell+=ch; }
    else if(ch==='"') quoted=true;
    else if(ch===',') { row.push(cell); cell=''; }
    else if(ch==='\n') { row.push(cell.replace(/\r$/,'')); rows.push(row); row=[]; cell=''; }
    else cell+=ch;
  }
  if (quoted) throw new Error('CSV ends inside a quoted field.');
  if (cell.length || row.length) { row.push(cell.replace(/\r$/,'')); rows.push(row); }
  if (!rows.length) return [];
  const headers=rows.shift().map(key);
  return rows.filter(r=>r.some(v=>v.trim())).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
}

function first(row, field) {
  for (const alias of ALIASES[field] || [field]) { const value=row[key(alias)]; if (value !== undefined && value !== '') return value; }
  return undefined;
}

export function normalizePlayer(input) {
  const row=Object.fromEntries(Object.entries(input || {}).map(([k,v])=>[key(k),v]));
  const id=nullableNumber(first(row,'player_id'));
  const name=String(first(row,'name') ?? '').trim();
  const position=String(first(row,'position') ?? '').trim().toUpperCase();
  const ovr=nullableNumber(first(row,'ovr'));
  const alternates=first(row,'alternate_positions');
  const normalized={
    player_id:id,
    name,
    slug:String(row.slug || `${slugify(name)}-${id ?? 'missing'}`).trim(),
    ovr,
    position,
    alternate_positions:Array.isArray(alternates) ? alternates.map(x=>String(x).toUpperCase()) : String(alternates ?? '').split(/[|;]/).map(x=>x.trim().toUpperCase()).filter(Boolean),
    club:String(first(row,'club') ?? '').trim() || null,
    league:String(first(row,'league') ?? '').trim() || null,
    nation:String(first(row,'nation') ?? '').trim() || null,
    event:String(first(row,'event') ?? '').trim() || null,
    is_untradable:parseBool(first(row,'is_untradable')),
    stats:first(row,'stats') ?? {},
    assets:{player_image:String(first(row,'player_image') ?? '').trim() || null,card_background:String(first(row,'card_background') ?? '').trim() || null},
    market_price:{current_sell_price:nullableNumber(first(row,'current_sell_price')),lowest_sell_price:nullableNumber(first(row,'lowest_sell_price')),highest_sell_price:nullableNumber(first(row,'highest_sell_price'))},
    shard_cost:{cost:nullableNumber(first(row,'shard_cost')),type:String(first(row,'shard_type') ?? 'star_shard'),event_phase:String(first(row,'event_phase') ?? '') || null},
    source:{name:String(row.source_name ?? ''),url:String(row.source_url ?? ''),usage_policy:String(row.usage_policy ?? 'unverified'),observed_at:String(first(row,'observed_at') ?? '')}
  };
  return normalized;
}

export function validatePlayers(players) {
  const issues=[]; const ids=new Map(),slugs=new Map();
  players.forEach((p,index)=>{
    const at=`row ${index+1}`;
    if(!Number.isSafeInteger(p.player_id) || p.player_id<1) issues.push({row:index+1,field:'player_id',message:'A positive integer player/asset ID is required.'});
    if(!p.name) issues.push({row:index+1,field:'name',message:'Player name is required.'});
    if(!Number.isInteger(p.ovr) || p.ovr<1 || p.ovr>150) issues.push({row:index+1,field:'ovr',message:'OVR must be an integer from 1 to 150.'});
    if(!POSITION_SET.has(p.position)) issues.push({row:index+1,field:'position',message:'Position is missing or not a recognized FC position.'});
    if(!p.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) issues.push({row:index+1,field:'slug',message:'Slug must contain lowercase letters, numbers, and hyphens.'});
    for(const [field,url] of Object.entries(p.assets)) if(url && !/^https:\/\//i.test(url) && !url.startsWith('/')) issues.push({row:index+1,field,message:'Asset URL must use HTTPS or a repo-relative path.'});
    for(const [field,value] of Object.entries(p.market_price)) if(value!=null && (!Number.isSafeInteger(value)||value<0)) issues.push({row:index+1,field,message:'Price must be a non-negative integer.'});
    if(p.shard_cost.cost!=null && (!Number.isSafeInteger(p.shard_cost.cost)||p.shard_cost.cost<0)) issues.push({row:index+1,field:'shard_cost',message:'Shard cost must be a non-negative integer.'});
    if(!p.stats || typeof p.stats!=='object' || Array.isArray(p.stats)) issues.push({row:index+1,field:'stats',message:'Stats must be a JSON object.'});
    if(ids.has(p.player_id)) issues.push({row:index+1,field:'player_id',message:`Duplicate player ID also appears on row ${ids.get(p.player_id)}.`}); else ids.set(p.player_id,index+1);
    if(slugs.has(p.slug)) issues.push({row:index+1,field:'slug',message:`Duplicate slug also appears on row ${slugs.get(p.slug)}.`}); else slugs.set(p.slug,index+1);
    if(!p.source.url || !p.source.name) issues.push({row:index+1,field:'source',message:'Source name and URL are required for provenance.'});
    if(p.source.usage_policy==='unverified') issues.push({row:index+1,field:'usage_policy',message:'Source reuse permission is unverified; record review before import.'});
    if(p.shard_cost.cost!=null && !p.event) issues.push({row:index+1,field:'event',message:'Shard cost requires an event name.'});
    void at;
  });
  return issues;
}

async function main() {
  const inputPath=process.argv[2];
  if(!inputPath) throw new Error('Usage: node normalize-player-import.mjs <input.csv|input.json> [output.json]');
  const source=await fs.readFile(inputPath,'utf8');
  const rows=path.extname(inputPath).toLowerCase()==='.csv' ? parseCsv(source) : JSON.parse(source);
  const inputs=Array.isArray(rows)?rows:(Array.isArray(rows.players)?rows.players:null);
  if(!inputs) throw new Error('Input JSON must be an array or an object with a players array.');
  const players=inputs.map(normalizePlayer), issues=validatePlayers(players);
  const output={summary:{rows:players.length,valid:players.length-(new Set(issues.map(x=>x.row))).size,invalid_rows:[...new Set(issues.map(x=>x.row))].length},players,issues};
  const outPath=process.argv[3];
  const serialized=JSON.stringify(output,null,2)+'\n';
  if(outPath) await fs.writeFile(outPath,serialized); else process.stdout.write(serialized);
  if(issues.length) process.exitCode=1;
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
