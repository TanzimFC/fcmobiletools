#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const INDEX = 'https://sappurit.github.io/s10img/index-CARDS.htm';
const BASE = new URL('.', INDEX);
const args = new Map(process.argv.slice(2).filter((x) => x.startsWith('--')).map((x) => { const [k,...v]=x.slice(2).split('='); return [k,v.length?v.join('='):true]; }));
const slug = (value) => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function classify(name) {
  if (/^backgrounds_/i.test(name)) return 'card_background';
  if (/^_playerinfobanner01_/i.test(name)) return 'event_banner';
  if (/^programlogos_/i.test(name)) return 'event_logo';
  if (/playstyle|skillboost|skillstyle/i.test(name)) return 'playstyle';
  if (/trait/i.test(name)) return 'trait';
  if (/rank/i.test(name)) return 'rank';
  if (/nation|country|flag/i.test(name)) return 'nation_flag';
  if (/club|team|badge/i.test(name)) return 'club_badge';
  if (/league/i.test(name)) return 'league_logo';
  return 'other';
}
function signature(bytes) {
  if (bytes.length >= 8 && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71) return 'png';
  if (bytes.length >= 3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'jpg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'webp';
  if (bytes.length >= 6 && /^GIF8[79]a$/.test(String.fromCharCode(...bytes.slice(0,6)))) return 'gif';
  return null;
}
async function main() {
  const response = await fetch(INDEX, { headers: { 'user-agent':'FCMOBILETOOLS asset catalog sync' } });
  if (!response.ok) throw new Error('Asset index request failed ('+response.status+').');
  const html = await response.text();
  const entries = new Map();
  for (const match of html.matchAll(/<a\b[^>]*href=['"]([^'"]+\/CARDS\/[^'"]+\.(?:png|jpe?g|webp|gif))['"][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1].replace(/&amp;/g,'&');
    const url = new URL(href, BASE);
    if (url.origin !== BASE.origin || !url.pathname.includes('/png/CARDS/')) continue;
    const name = path.posix.basename(url.pathname);
    entries.set(name, { asset_key:'s10img-cards-'+slug(name.replace(/\.[^.]+$/,'')), name, asset_type:classify(name), source_url:url.href, source_name:'Sappurit s10img Season 10 asset index', attribution:'Sappurit/s10img; EA FC Mobile art as cataloged by the source', license:'Unverified; source index does not publish per-file reuse terms' });
  }
  const category = String(args.get('category') || 'all');
  const categoryMap = { backgrounds:'card_background', banners:'event_banner', logos:'event_logo', playstyles:'playstyle', traits:'trait', ranks:'rank', flags:'nation_flag', clubs:'club_badge', leagues:'league_logo' };
  let selected = [...entries.values()].filter((entry) => category === 'all' || entry.asset_type === (categoryMap[category] || category));
  const limit = Math.max(0, Number(args.get('limit')) || 0);
  if (limit) selected = selected.slice(0, limit);
  const manifestPath = args.get('manifest') ? path.resolve(String(args.get('manifest'))) : null;
  if (manifestPath) await fs.writeFile(manifestPath, JSON.stringify({ source:INDEX, generated_at:new Date().toISOString(), total_indexed:entries.size, assets:selected }, null, 2)+'\n');
  if (args.has('download')) {
    const output = path.resolve(String(args.get('out') || 'public/assets/player-cards/s10img'));
    await fs.mkdir(output, { recursive:true });
    for (const entry of selected) {
      const remote = await fetch(entry.source_url, { headers:{ 'user-agent':'FCMOBILETOOLS asset catalog sync' } });
      if (!remote.ok) throw new Error('Asset download failed for '+entry.name+' ('+remote.status+').');
      const bytes = new Uint8Array(await remote.arrayBuffer());
      const format = signature(bytes);
      if (!format || bytes.byteLength > 2_000_000) throw new Error('Unexpected image bytes or size for '+entry.name+'.');
      const localName = slug(entry.name.replace(/\.[^.]+$/,''))+'.'+format;
      const target = path.join(output, localName);
      await fs.writeFile(target, bytes, { flag:'wx' }).catch(async (error) => { if (error.code !== 'EEXIST') throw error; });
      entry.local_path = '/'+path.relative('public', target).replace(/\\/g,'/');
      entry.checksum_sha256 = createHash('sha256').update(bytes).digest('hex');
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  const output = { source:INDEX, indexed:entries.size, selected:selected.length, downloaded:args.has('download') ? selected.filter((x)=>x.local_path).length : 0, assets:selected };
  if (!manifestPath) process.stdout.write(JSON.stringify(output,null,2)+'\n');
}
if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error)=>{ console.error(error.message); process.exitCode=1; });
