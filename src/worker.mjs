const SESSION_COOKIE = 'fcm_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 8;

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

const ADMIN_LOGIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>FC Mobile Tools Admin</title><style>@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap');:root{--bg:#070b10;--panel:#0d141b;--line:#22343f;--text:#f4f8fb;--muted:#8ea2b0;--cyan:#56d6ff;--blue:#4f7dff;--good:#67e7a6;--sans:'Manrope',system-ui,sans-serif;--display:'Sora',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(720px 470px at 12% 2%,#56d6ff1b,transparent 60%),radial-gradient(700px 480px at 92% 8%,#4f7dff1b,transparent 58%),#070b10;color:var(--text);font-family:var(--sans);overflow:hidden}body:before{content:"";position:fixed;inset:0;background-image:linear-gradient(#ffffff03 1px,transparent 1px),linear-gradient(90deg,#ffffff03 1px,transparent 1px);background-size:46px 46px;mask-image:linear-gradient(to bottom,black,transparent 88%);pointer-events:none}.shell{width:min(440px,100%);position:relative}.orb{position:absolute;border-radius:50%;filter:blur(55px);pointer-events:none}.orb-a{width:160px;height:160px;background:var(--cyan);top:-70px;left:-70px;opacity:.16}.orb-b{width:140px;height:140px;background:var(--blue);right:-55px;bottom:-60px;opacity:.14}.card{position:relative;padding:28px;border:1px solid #29404d;border-radius:25px;background:linear-gradient(145deg,#0f1820f3,#091116ef);box-shadow:0 35px 110px #000c}.brand{display:flex;align-items:center;gap:11px}.mark{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,#70e1ff,#4f7dff);color:#04131c;font:800 11px var(--mono);box-shadow:0 0 38px #56d6ff20}.brand b{display:block;font:700 15px var(--display);letter-spacing:-.025em}.brand small{display:block;margin-top:2px;color:#687f8d;font-size:9px}.eyebrow{display:flex;align-items:center;gap:8px;margin-top:28px;color:var(--cyan);font:700 7px var(--mono);letter-spacing:.15em}.eyebrow i{width:20px;height:1px;background:linear-gradient(90deg,var(--cyan),transparent)}h1{font:700 35px/1.02 var(--display);letter-spacing:-.05em;margin:10px 0 8px}p{margin:0;color:var(--muted);font-size:10px;line-height:1.7}.field{display:block;margin-top:17px}.field span{display:block;margin-bottom:7px;color:#c8d8e0;font-size:9px;font-weight:700}input,button{width:100%;padding:12px 13px;border-radius:11px;border:1px solid #2a3e49;background:#081117;color:#f5f8fb;font:600 10px var(--sans);outline:0}input:focus{border-color:#56d6ff;box-shadow:0 0 0 3px #56d6ff10}button{margin-top:18px;border-color:#69dcff;background:linear-gradient(135deg,#69e0ff,#2aa8e8);color:#04131c;font:800 9px var(--mono);cursor:pointer;box-shadow:0 14px 35px #56d6ff10}button:disabled{opacity:.6;cursor:wait}.error{min-height:20px;margin-top:12px;color:#ff9f95;font:700 8px var(--mono)}.hint{margin-top:18px;padding-top:16px;border-top:1px solid #20303a;color:#667e8d;font-size:8px}.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.chip{padding:7px 8px;border:1px solid #243843;border-radius:999px;background:#091217;color:#6f8998;font:700 7px var(--mono)}@media(max-width:520px){.card{padding:23px}.shell{max-width:390px}h1{font-size:31px}}</style></head><body><div class="shell"><div class="orb orb-a"></div><div class="orb orb-b"></div><form class="card" id="login"><div class="brand"><div class="mark">FC</div><div><b>FC Mobile Tools</b><small>Private admin workspace</small></div></div><div class="eyebrow"><i></i> SECURE ENTRY</div><h1>Welcome back</h1><p>Sign in to manage redeem codes, Football Centre content and the shared media library</p><label class="field"><span>Username</span><input name="username" autocomplete="username" required></label><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label><button id="submit" type="submit">Enter workspace</button><div class="error" id="error" role="alert"></div><div class="hint">Admin access only<div class="chips"><span class="chip">CONTENT</span><span class="chip">FOOTBALL</span><span class="chip">MEDIA</span></div></div></form></div><script>const form=document.getElementById('login'),error=document.getElementById('error'),submit=document.getElementById('submit');form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';submit.disabled=true;submit.textContent='Opening workspace…';try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(Object.fromEntries(new FormData(form)))});const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Sign in failed');location.replace('/admin/')}catch(x){error.textContent=x.message;submit.disabled=false;submit.textContent='Enter workspace'}})</script></body></html>`;

const ADMIN_DASHBOARD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap');
:root{--bg:#070b10!important;--panel:#0d141b!important;--panel2:#111a22!important;--line:#20323d!important;--text:#f4f8fb!important;--muted:#8ea2b0!important;--lime:#56d6ff!important;--violet:#4f7dff!important;--coral:#ff7d72!important;--amber:#ffbd68!important;--pink:#82cfff!important;--good:#67e7a6!important;--bad:#ff7d72!important;--sans:'Manrope',system-ui,sans-serif!important;--display:'Sora',system-ui,sans-serif!important;--mono:'IBM Plex Mono',ui-monospace,monospace!important}
html,body{background:radial-gradient(900px 600px at 7% -10%,#56d6ff16,transparent 60%),radial-gradient(760px 540px at 100% 3%,#4f7dff14,transparent 58%),var(--bg)!important;font-family:var(--sans)!important}
body:before{background-image:linear-gradient(#56d6ff04 1px,transparent 1px),linear-gradient(90deg,#56d6ff04 1px,transparent 1px)!important}
.side{background:#071016ed!important;border-right-color:#20323d!important}
.mark{background:linear-gradient(145deg,#70e1ff,#4f7dff)!important;color:#04131c!important;box-shadow:0 0 35px #56d6ff20!important}
.top{background:#070d12eb!important;border-bottom-color:#20323d!important}
.nav button.active{background:linear-gradient(90deg,#56d6ff10,#4f7dff08)!important;border-color:#2b5a72!important;box-shadow:inset 3px 0 var(--cyan),0 8px 24px #0004!important}
.nav button.active:before{color:var(--cyan)!important}
.btn.primary,.primary{border-color:#69dcff!important;background:linear-gradient(135deg,#69e0ff,#2aa8e8)!important;color:#04131c!important;box-shadow:0 12px 32px #56d6ff10!important}
.btn:hover{border-color:#3d6377!important}.input:focus,select:focus,textarea:focus{border-color:#56d6ff!important;box-shadow:0 0 0 3px #56d6ff10!important}
.tabs button.active{background:#56d6ff0d!important;color:#dff8ff!important;box-shadow:inset 0 0 0 1px #3f738b!important}
.notice{background:linear-gradient(90deg,#4f7dff0a,#56d6ff0a)!important;border-color:#294453!important}
.stat:nth-child(1){border-color:#274c66!important}.stat:nth-child(2){border-color:#2a4a64!important}.stat:nth-child(3){border-color:#55452f!important}.stat:nth-child(4){border-color:#3f416d!important}
.stat:nth-child(1):after{background:#56d6ff!important}.stat:nth-child(2):after{background:#4f7dff!important}.stat:nth-child(3):after{background:#ffbd68!important}.stat:nth-child(4):after{background:#82cfff!important}
.stat:nth-child(1) strong{color:#56d6ff!important}.stat:nth-child(2) strong{color:#73b9ff!important}.stat:nth-child(3) strong{color:#ffbd68!important}.stat:nth-child(4) strong{color:#9ab4ff!important}
.pill.active{background:#56d6ff12!important;color:#56d6ff!important}.pill.scheduled{background:#ffbd6812!important}.pill.expired{background:#ff7d7212!important}
.dropzone{background:radial-gradient(circle at 50% 0,#56d6ff09,transparent 55%),#071118!important;border-color:#365565!important}.dropzone.drag{border-color:#56d6ff!important;background:#0a1921!important;box-shadow:0 0 0 3px #56d6ff10!important}
.save{background:#0d161cee!important;border-color:#29414f!important}
.modal{background:#02070bdd!important}.dialog{background:#0e161d!important;border-color:#2a4351!important}
.close{background:#0d171d!important;border-color:#29404c!important}.pickeritem button{background:#0d171d!important;border-color:#29404c!important}.media,.club,.match,.code{background:#091218!important;border-color:#20333f!important}
.mediagrid .media:hover,.club:hover,.match:hover,.code:hover{border-color:#2e627d!important}
.dropzone b,.dialoghead h3,.head h3,.hero h2,.top h1{font-family:var(--display)!important}
`;

const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-value.length%4)%4)), c => c.charCodeAt(0));

async function sign(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return b64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

async function session(username, secret) {
  const payload = `${username}|${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${b64(new TextEncoder().encode(payload))}.${await sign(secret,payload)}`;
}

async function authenticated(request, env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return false;
  const match = (request.headers.get('cookie') || '').match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return false;
  try {
    const [payload64, signature] = match[1].split('.');
    const payload = new TextDecoder().decode(unb64(payload64));
    const [username, expiry] = payload.split('|');
    if (username !== env.ADMIN_USERNAME || Number(expiry) <= Date.now()) return false;
    return (await sign(env.ADMIN_SESSION_SECRET,payload)) === signature;
  } catch { return false; }
}

async function github(env, path, options = {}) {
  const [owner, repo] = (env.GITHUB_REPO || 'TanzimFC/fcmobiletools').split('/');
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured in the Worker.');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, {
    ...options,
    headers: { accept:'application/vnd.github+json', authorization:`Bearer ${env.GITHUB_TOKEN}`, 'x-github-api-version':'2022-11-28', 'user-agent':'FC-Mobile-Tools-Admin', ...(options.headers || {}) }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { throw new Error('GitHub returned an invalid JSON response.'); }
  if (!response.ok) throw new Error(body?.message || `GitHub request failed (${response.status}).`);
  return body;
}

function decodeGithub(value) { return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')), c=>c.charCodeAt(0))); }
function encodeGithub(value) { return btoa(String.fromCharCode(...new TextEncoder().encode(value))); }

async function repoFile(env,path) {
  const body = await github(env,`contents/${path}?ref=main`);
  return {sha:body.sha,text:decodeGithub(body.content)};
}

async function writeRepoFile(env,path,text,sha,message) {
  const body = await github(env,`contents/${path}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({message,content:encodeGithub(text),sha,branch:'main'})});
  return body.commit?.sha;
}

function parseRedeem(text) {
  const start=text.indexOf('export const REDEEM_CODES = '), end=text.indexOf('export const REDEEM_STATUS',start);
  if(start<0 || end<0) throw new Error('Redeem data file has an unexpected format.');
  return JSON.parse(text.slice(text.indexOf('[',start),end).replace(/;\s*$/,'').trim());
}

function redeemText(codes) { return `// FC Mobile redeem-code database.\nexport const REDEEM_CODES = ${JSON.stringify(codes,null,2)};\n\nexport const REDEEM_STATUS = {\n  active: { label: 'Active', className: 'active' },\n  scheduled: { label: 'Scheduled', className: 'scheduled' },\n  expired: { label: 'Expired', className: 'expired' },\n  unknown: { label: 'Unknown', className: 'unknown' },\n};\n`; }


function parseFootball(text) {
  const match=text.match(/export const FOOTBALL_CENTRE_CONTENT = ([\s\S]+);\s*$/);
  if(!match) throw new Error('Football Centre data file has an unexpected format.');
  try { return JSON.parse(match[1]); } catch { throw new Error('Football Centre data file is not JSON-compatible.'); }
}

function validateFootball(content) {
  if(!content || typeof content !== 'object' || !content.clubs || !Array.isArray(content.matches) || !content.analysis || !content.totw || !content.settings) throw new Error('Football Centre content is incomplete.');
  for(const [id, club] of Object.entries(content.clubs)) {
    if(!id || !club || !club.name || !club.short || !club.logo) throw new Error('Every club needs an ID, name, short name, and logo URL.');
  }
  const ids=new Set(Object.keys(content.clubs));
  const matchIds=new Set();
  for(const match of content.matches) {
    if(!match?.id || matchIds.has(match.id)) throw new Error('Football Centre match IDs must be unique.');
    if(!Number.isInteger(Number(match.week)) || Number(match.week)<1) throw new Error(`Invalid week for ${match.id}.`);
    if(!ids.has(match.home) || !ids.has(match.away)) throw new Error(`Match ${match.id} references an unknown club.`);
    if(match.home===match.away) throw new Error(`Match ${match.id} cannot use the same club twice.`);
    matchIds.add(match.id);
  }
  const scoring=content.settings.scoring;
  for(const key of ['played','worldClass','correctPrediction']) if(!Number.isFinite(Number(scoring?.[key])) || Number(scoring[key])<0) throw new Error(`Football Centre scoring value "${key}" must be a non-negative number.`);
  if(!content.settings.cycleId) throw new Error('Football Centre cycle ID is required.');
  if(!Number.isFinite(Number(content.settings.startingBalance)) || Number(content.settings.startingBalance)<0) throw new Error('Starting balance must be a non-negative number.');
  if(!content.analysis.videoEmbedUrl || !content.analysis.videoWatchUrl) throw new Error('Analysis video URLs are required.');
  if(!content.videoEmbedUrl || !content.videoWatchUrl) { content.videoEmbedUrl=content.analysis.videoEmbedUrl; content.videoWatchUrl=content.analysis.videoWatchUrl; }
}

function parseRankUp(text) {
  const m=text.match(/export const RANKS = (\[[\s\S]*?\]);\s*export const RANK_COSTS = (\[[\s\S]*?\]);/);
  if(!m) throw new Error('Rank Up data file has an unexpected format.');
  const ranks=JSON.parse(m[1]);
  const costs=JSON.parse(m[2].replace(/\bInfinity\b/g,'null'));
  return {ranks,costs};
}
function rankUpText(data) {
  const ranks=data.ranks.map((r,i)=>({value:i,name:String(r.name||'').trim()}));
  const costs=data.costs.map(x=>({min:Number(x.min),max:x.max==='Infinity'||x.max===null?null:Number(x.max),label:String(x.label||'').trim(),costs:x.costs.map(Number)}));
  return `export const RANKS = ${JSON.stringify(ranks,null,2)};

export const RANK_COSTS = ${JSON.stringify(costs,null,2)};

export function getRankBracket(baseOVR) {
  const value = Number(baseOVR);
  if (!Number.isInteger(value) || value < 0) return null;
  return RANK_COSTS.find((item) => value >= item.min && (item.max === null || value <= item.max)) ?? null;
}
`;
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
function parseFrontmatter(text) {
  const m=text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if(!m) return {data:{},body:text};
  const data={};
  for(const line of m[1].split('\n')) {
    const hit=line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if(!hit) continue;
    let value=hit[2].trim();
    if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
    if(value==='true'||value==='false') data[hit[1]]=value==='true';
    else if(value==='null') data[hit[1]]=null;
    else if(/^\\d+$/.test(value)) data[hit[1]]=Number(value);
    else if(value.startsWith('[')) { try { data[hit[1]]=JSON.parse(value); } catch { data[hit[1]]=value; } }
    else data[hit[1]]=value;
  }
  return {data,body:m[2]};
}
function yamlValue(value) {
  if(value === null || value === undefined) return 'null';
  if(typeof value === 'boolean' || typeof value === 'number') return String(value);
  if(Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(String(value));
}
function articleText(a) {
  const tags=Array.isArray(a.tags)?a.tags:[];
  return `---
id: ${yamlValue(a.id)}
slug: ${yamlValue(a.slug)}
title: ${yamlValue(a.title)}
subtitle: ${yamlValue(a.subtitle||'')}
description: ${yamlValue(a.description||'')}
type: ${yamlValue(a.type||'guide')}
category: ${yamlValue(a.category||'Guides')}
author: ${yamlValue(a.author||'TanzimFC')}
status: ${yamlValue(a.status||'draft')}
createdBy: ${yamlValue(a.createdBy||a.author||'TanzimFC')}
createdAt: ${yamlValue(a.createdAt||new Date().toISOString())}
updatedAt: ${yamlValue(new Date().toISOString())}
publishedAt: ${yamlValue(a.status==='published'?(a.publishedAt||new Date().toISOString()):null)}
image: ${yamlValue(a.image||'')}
imageAlt: ${yamlValue(a.imageAlt||'')}
excerpt: ${yamlValue(a.excerpt||a.description||'')}
tags: ${JSON.stringify(tags)}
featured: ${Boolean(a.featured)}
readingTime: ${Number(a.readingTime)||Math.max(1,Math.ceil(String(a.body||'').split(/\s+/).filter(Boolean).length/220))}
seoTitle: ${yamlValue(a.seoTitle||a.title)}
seoDescription: ${yamlValue(a.seoDescription||a.description||'')}
factStatus: ${yamlValue(a.factStatus||'verified')}
---

${String(a.body||'').trim()}
`;
}
function articleSlug(value) {
  return String(value||'').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,90);
}
function validateTraining(data) {
  if(!data||!Array.isArray(data.levels)||data.levels.length<2||!Array.isArray(data.fodder)||!data.fodder.length) throw new Error('Training data is incomplete.');
  data.levels.forEach((v,i)=>{if(!Number.isFinite(Number(v))||Number(v)<0||(i&&Number(v)<Number(data.levels[i-1]))) throw new Error('Training XP levels must be non-negative and ascending.');});
  data.fodder.forEach((x,i)=>{if(!x?.id||!String(x.label||'').trim()||!Number.isFinite(Number(x.xp))||Number(x.xp)<0) throw new Error(`Fodder entry ${i+1} is invalid.`);});
}

async function api(request,env,path) {
  if(path === '/login' && request.method === 'POST') {
    if(!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return json({error:'Admin authentication is not configured in the Worker.'},503);
    const body=await request.json().catch(()=>({}));
    if(body.username !== env.ADMIN_USERNAME || body.password !== env.ADMIN_PASSWORD) return json({error:'Invalid username or password.'},401);
    return json({ok:true},200,{ 'set-cookie':`${SESSION_COOKIE}=${await session(env.ADMIN_USERNAME,env.ADMIN_SESSION_SECRET)}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Strict` });
  }
  if(path === '/logout' && request.method === 'POST') return json({ok:true},200,{'set-cookie':`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`});
  if(!(await authenticated(request,env))) return json({error:'Authentication required.'},401);
  try {
    if(path === '/me') return json({username:env.ADMIN_USERNAME,role:'admin'});
    if(path === '/redeem' && request.method === 'GET') return json({codes:parseRedeem((await repoFile(env,'src/data/redeemCodes.js')).text)});
    if(path === '/redeem' && request.method === 'POST') {
      const input=await request.json();
      if(!input.code || !input.reward || !input.releaseDate || !['active','scheduled','expired'].includes(input.status)) throw new Error('Code, reward, status, and release date are required.');
      if(input.expiryDate && input.releaseDate > input.expiryDate) throw new Error('Expiry date cannot be before release date.');
      const code={code:String(input.code).trim().toUpperCase(),reward:String(input.reward).trim(),status:input.status,releaseDate:input.releaseDate,expiryDate:input.expiryDate||null,region:String(input.region||'Global').trim(),lastVerified:input.lastVerified||new Date().toISOString().slice(0,10),notes:String(input.notes||'').trim()};
      const file=await repoFile(env,'src/data/redeemCodes.js');
      const codes=parseRedeem(file.text);
      const i=codes.findIndex(x=>String(x.code).toUpperCase()===code.code);
      if(i>=0) codes[i]=code; else codes.unshift(code);
      const commitSha=await writeRepoFile(env,'src/data/redeemCodes.js',redeemText(codes),file.sha,`admin: update redeem code ${code.code}`);
      return json({ok:true,commitSha,action:i>=0?'updated':'created'});
    }
    if(path === '/rank-up' && request.method === 'GET') return json(parseRankUp((await repoFile(env,'src/data/fcMobileRankUp.js')).text));
    if(path === '/rank-up' && request.method === 'POST') { const data=await request.json(); validateRankUp(data); const file=await repoFile(env,'src/data/fcMobileRankUp.js'); const commitSha=await writeRepoFile(env,'src/data/fcMobileRankUp.js',rankUpText(data),file.sha,'admin: update Rank Up Points data'); return json({ok:true,commitSha}); }
    if(path === '/training' && request.method === 'GET') return json(parseTraining((await repoFile(env,'src/data/fcMobileTraining.js')).text));
    if(path === '/training' && request.method === 'POST') { const data=await request.json(); validateTraining(data); const file=await repoFile(env,'src/data/fcMobileTraining.js'); const commitSha=await writeRepoFile(env,'src/data/fcMobileTraining.js',trainingText(data),file.sha,'admin: update Training XP data'); return json({ok:true,commitSha}); }

    if(path === '/articles' && request.method === 'GET') {
      const body=await github(env,'contents/src/content/blog?ref=main');
      const files=Array.isArray(body)?body.filter(x=>x.name.endsWith('.md')&&x.name!=='_template.md'):[];
      const articles=[];
      for(const file of files) {
        const item=await repoFile(env,file.path);
        const parsed=parseFrontmatter(item.text);
        articles.push({path:file.path,sha:item.sha,...parsed});
      }
      articles.sort((a,b)=>String(b.data.updatedAt||b.data.publishedAt||'').localeCompare(String(a.data.updatedAt||a.data.publishedAt||'')));
      return json({articles});
    }
    if(path === '/articles' && request.method === 'POST') {
      const input=await request.json();
      const title=String(input.title||'').trim();
      const slug=articleSlug(input.slug||title);
      if(!title||!slug) throw new Error('Article title is required.');
      const filename=`src/content/blog/${slug}.md`;
      let sha;
      try { sha=(await repoFile(env,filename)).sha; } catch {}
      if(sha && input.createOnly) throw new Error('An article with this slug already exists.');
      const data={...input,title,slug,id:String(input.id||slug),author:String(input.author||'TanzimFC'),status:['draft','review','published','archived'].includes(input.status)?input.status:'draft',body:String(input.body||'')};
      const commitSha=await writeRepoFile(env,filename,articleText(data),sha,`admin: ${sha?'update':'create'} article ${slug}`);
      return json({ok:true,commitSha,slug,action:sha?'updated':'created'});
    }
    if(path === '/football' && request.method === 'GET') return json({content:parseFootball((await repoFile(env,'src/data/footballCentre.js')).text)});
    if(path === '/football' && request.method === 'POST') {
      const {content}=await request.json();
      validateFootball(content);
      const file=await repoFile(env,'src/data/footballCentre.js');
      const text=`// Football Centre content managed by the admin panel.\n// Keep this file JSON-compatible because the Worker reads and validates it before committing updates.\nexport const FOOTBALL_CENTRE_CONTENT = ${JSON.stringify(content,null,2)};\n`;
      const commitSha=await writeRepoFile(env,'src/data/footballCentre.js',text,file.sha,'admin: update Football Centre content');
      return json({ok:true,commitSha});
    }
    if(path === '/media/sign' && request.method === 'GET') {
      if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary is not fully configured in the Worker.');
      const timestamp=Math.floor(Date.now()/1000),folder=env.CLOUDINARY_FOLDER||'fc-mobile-tools';
      const digest=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`));
      return json({cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,timestamp,folder,signature:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')});
    }
    if(path === '/media' && request.method === 'GET') {
      if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary is not fully configured in the Worker.');
      const auth=btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`), r=await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?max_results=100`,{headers:{authorization:`Basic ${auth}`}}), body=await r.json();
      if(!r.ok) throw new Error(body?.error?.message||`Cloudinary request failed (${r.status}).`);
      return json({resources:(body.resources||[]).map(x=>({publicId:x.public_id,url:x.secure_url,width:x.width,height:x.height,bytes:x.bytes,format:x.format,createdAt:x.created_at}))});
    }
    return json({error:'Admin endpoint not found.'},404);
  } catch(error) { return json({error:error?.message||'Admin operation failed.'},500); }
}

async function adminDashboard(request, env, url) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/admin/dashboard.html',url),{method:'GET',headers:request.headers}));
  if(!asset.ok) return asset;
  const html = await asset.text();
  const patched = html.replace('</head>', `<style id="fc-admin-cyan-theme">${ADMIN_DASHBOARD_CSS}</style></head>`);
  const headers = new Headers(asset.headers);
  headers.set('content-type','text/html; charset=utf-8');
  headers.set('cache-control','no-store');
  return new Response(patched,{status:asset.status,statusText:asset.statusText,headers});
}

export default { async fetch(request,env) {
  const url=new URL(request.url);
  const isAdminEntry = url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin/login' || url.pathname === '/admin/login/' || url.pathname === '/admin/login.html';
  if(url.pathname.startsWith('/api/admin/')) return api(request,env,url.pathname.slice('/api/admin'.length));
  if(isAdminEntry) {
    if(await authenticated(request,env)) return adminDashboard(request,env,url);
    return new Response(ADMIN_LOGIN_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  if(url.pathname.startsWith('/admin/')) {
    if(!(await authenticated(request,env))) return new Response('Not found',{status:404});
    return env.ASSETS.fetch(request);
  }
  return env.ASSETS.fetch(request);
} };
