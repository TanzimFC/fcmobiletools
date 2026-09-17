from pathlib import Path
import re

# Make calculator data visible in the initial HTML, not only after browser JS runs
p=Path('src/pages/training-calculator.astro'); s=p.read_text()
s=s.replace('<select id="currentLevel"></select>', '<select id="currentLevel">{TRAINING_LEVELS.map((_,i)=><option value={i}>Level {i}</option>)}</select>')
s=s.replace('<select id="targetLevel"></select>', '<select id="targetLevel">{TRAINING_LEVELS.map((_,i)=><option value={i} selected={i===MAX_TRAINING_LEVEL}>Level {i}</option>)}</select>')
s=s.replace('<select id="fodderId"></select>', '<select id="fodderId">{FODDER.map(f=><option value={f.id} selected={f.id===\'95+\'}>{f.label} — {fmt(f.xp)} XP</option>)}</select>')
s=s.replace('<tbody id="fullTable"></tbody>', '<tbody id="fullTable">{TRAINING_LEVELS.map((v,i)=><tr><td>Level {i}</td><td>{fmt(v)} XP</td><td>{i<MAX_TRAINING_LEVEL ? `${fmt(TRAINING_LEVELS[i+1]-v)} XP` : \'MAX\'}</td></tr>)}</tbody>')
s=s.replace("import { calculateTraining, calculateTransfer } from '../lib/fcMobileTraining.js';", "import { calculateTraining, calculateTransfer } from '../lib/fcMobileTraining.js';\nimport { TRAINING_LEVELS, FODDER, MAX_TRAINING_LEVEL } from '../data/fcMobileTraining.js';")
p.write_text(s)

# Rank page had the same browser-only data problem and its script was missing RANKS entirely
p=Path('src/pages/rank-up-calculator.astro'); s=p.read_text()
s=s.replace('<select id="current"></select>', '<select id="current">{RANKS.map(r=><option value={r.value}>R{r.value} · {r.name}</option>)}</select>')
s=s.replace('<select id="target"></select>', '<select id="target">{RANKS.map(r=><option value={r.value} selected={r.value===5}>R{r.value} · {r.name}</option>)}</select>')
s=s.replace('<tbody id="table"></tbody>', '<tbody id="table">{RANK_COSTS.map(row=><tr><td>{row.label}</td>{row.costs.map(v=><td>{v} RP</td>)}</tr>)}</tbody>')
s=s.replace("import { calculateRankUp } from '../lib/fcMobileRankUp.js';", "import { calculateRankUp } from '../lib/fcMobileRankUp.js';\nimport { RANKS, RANK_COSTS } from '../data/fcMobileRankUp.js';")
p.write_text(s)

# Remove the extra redeem hero showcase wrapper completely
p=Path('src/pages/redeem-codes.astro'); s=p.read_text()
pat=r'<div class="hero-showcase" aria-label="FC Mobile redeem code artwork">\s*(?:<div class="hero-stage">\s*)?(?:<div class="hero-stage-glow"></div>\s*)?(?:<div class="hero-ring hero-ring-one"></div>\s*)?(?:<div class="hero-ring hero-ring-two"></div>\s*)?<div class="hero-object-main">(<img[^>]+>)</div>\s*(?:</div>\s*)?</div>'
s,n=re.subn(pat,r'<div class="hero-object-main">\1</div>',s,count=1,flags=re.S)
if n:
    s=s.replace('.codes-page .hero-showcase{background:transparent!important;border:0!important;box-shadow:none!important;backdrop-filter:none!important}\n','')
p.write_text(s)

# Add the calculator data endpoints to the Worker
p=Path('src/worker.mjs'); s=p.read_text()
marker='async function api(request,env,path) {'
helpers=r'''function parseRankUp(text) {
  const m=text.match(/export const RANKS = (\[[\s\S]*?\]);\s*export const RANK_COSTS = (\[[\s\S]*?\]);/);
  if(!m) throw new Error('Rank Up data file has an unexpected format.');
  const ranks=JSON.parse(m[1]); const costs=JSON.parse(m[2].replace(/Infinity/g,'null'));
  costs.forEach(x=>{if(x.max===null)x.max='Infinity';}); return {ranks,costs};
}
function rankUpText(data) {
  const ranks=data.ranks.map((r,i)=>({value:i,name:String(r.name||'').trim()}));
  const costs=data.costs.map(x=>({min:Number(x.min),max:x.max==='Infinity'||x.max===null?'Infinity':Number(x.max),label:String(x.label||'').trim(),costs:x.costs.map(Number)}));
  return `export const RANKS = ${JSON.stringify(ranks,null,2)};\n\nexport const RANK_COSTS = ${JSON.stringify(costs,null,2).replace(/"Infinity"/g,'Infinity')};\n\nexport function getRankBracket(baseOVR) {\n  const value = Number(baseOVR);\n  if (!Number.isInteger(value) || value < 0) return null;\n  return RANK_COSTS.find((item) => value >= item.min && value <= item.max) ?? null;\n}\n`;
}
function validateRankUp(data) {
  if(!data||!Array.isArray(data.ranks)||data.ranks.length!==6||!Array.isArray(data.costs)||!data.costs.length) throw new Error('Rank Up data is incomplete.');
  data.ranks.forEach((r,i)=>{if(!String(r.name||'').trim()) throw new Error(`Rank R${i} needs a name.`);});
  data.costs.forEach((x,i)=>{if(!String(x.label||'').trim()||!Number.isFinite(Number(x.min))||!Array.isArray(x.costs)||x.costs.length!==5) throw new Error(`Rank bracket ${i+1} is incomplete.`);x.costs.forEach(c=>{if(!Number.isFinite(Number(c))||Number(c)<0) throw new Error('Rank Up costs must be non-negative numbers.');});});
}
function parseTraining(text) {
  const levels=text.match(/export const TRAINING_LEVELS = (\[[\s\S]*?\]);/)?.[1]; const fodder=text.match(/export const FODDER = (\[[\s\S]*?\]);/)?.[1];
  if(!levels||!fodder) throw new Error('Training data file has an unexpected format.'); return {levels:JSON.parse(levels),fodder:JSON.parse(fodder)};
}
function trainingText(data) { return `// Training calculator data managed by the admin panel.\nexport const TRAINING_LEVELS = ${JSON.stringify(data.levels,null,2)};\n\nexport const FODDER = ${JSON.stringify(data.fodder,null,2)};\n\nexport const MAX_TRAINING_LEVEL = ${data.levels.length-1};\nexport const TRAINING_TRANSFER_RATE = 0.9;\n`; }
function validateTraining(data) {
  if(!data||!Array.isArray(data.levels)||data.levels.length<2||!Array.isArray(data.fodder)||!data.fodder.length) throw new Error('Training data is incomplete.');
  data.levels.forEach((v,i)=>{if(!Number.isFinite(Number(v))||Number(v)<0||(i&&Number(v)<Number(data.levels[i-1]))) throw new Error('Training XP levels must be non-negative and ascending.');});
  data.fodder.forEach((x,i)=>{if(!x?.id||!String(x.label||'').trim()||!Number.isFinite(Number(x.xp))||Number(x.xp)<0) throw new Error(`Fodder entry ${i+1} is invalid.`);});
}
'''
if 'function parseRankUp(text)' not in s: s=s.replace(marker,helpers+'\n'+marker,1)
needle="    if(path === '/football' && request.method === 'GET') return json({content:parseFootball((await repoFile(env,'src/data/footballCentre.js')).text)});"
insert="""    if(path === '/rank-up' && request.method === 'GET') return json(parseRankUp((await repoFile(env,'src/data/fcMobileRankUp.js')).text));
    if(path === '/rank-up' && request.method === 'POST') { const data=await request.json(); validateRankUp(data); const file=await repoFile(env,'src/data/fcMobileRankUp.js'); const commitSha=await writeRepoFile(env,'src/data/fcMobileRankUp.js',rankUpText(data),file.sha,'admin: update Rank Up Points data'); return json({ok:true,commitSha}); }
    if(path === '/training' && request.method === 'GET') return json(parseTraining((await repoFile(env,'src/data/fcMobileTraining.js')).text));
    if(path === '/training' && request.method === 'POST') { const data=await request.json(); validateTraining(data); const file=await repoFile(env,'src/data/fcMobileTraining.js'); const commitSha=await writeRepoFile(env,'src/data/fcMobileTraining.js',trainingText(data),file.sha,'admin: update Training XP data'); return json({ok:true,commitSha}); }
"""
if "path === '/rank-up'" not in s: s=s.replace(needle,insert+needle,1)
p.write_text(s)

# Link the new data centre from the redesigned dashboard
p=Path('admin/dashboard.html'); s=p.read_text()
old='<nav class="nav"><button data-section="overview">Overview</button><button data-section="redeem">Redeem Codes</button><button data-section="football">Football Centre</button><button data-section="media">Media Library</button></nav>'
new=old.replace('</nav>','<a class="nav-external" href="/admin/calculators.html">Calculator Data</a></nav>')
if old in s and 'href="/admin/calculators.html"' not in s:s=s.replace(old,new,1)
css='.nav-external{display:block;padding:12px 12px 12px 42px;border:1px solid transparent;border-radius:12px;color:#7d8883;font-weight:700;font-size:10px;text-decoration:none;position:relative}.nav-external:before{content:"05";position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#606b66;font:700 9px var(--mono)}.nav-external:hover{background:#ffffff05;color:#edf1ed;border-color:#ffffff0b}'
if '.nav-external{' not in s:s=s.replace('</style>',css+'</style>',1)
p.write_text(s)
