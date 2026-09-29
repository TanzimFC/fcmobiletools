import { argon2id, argon2Verify } from 'hash-wasm';

const SESSION_COOKIE = 'fcm_admin_session';
const CREATOR_SESSION_COOKIE = 'fcm_creator_session';
const SESSION_MAX_AGE = 60 * 60 * 8;
const ARGON2_OPTIONS = { iterations: 3, memorySize: 32768, parallelism: 1, hashLength: 32, outputType: 'encoded' };

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

const ADMIN_LOGIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>FC Mobile Tools Admin</title><style>@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap');:root{--bg:#070b10;--panel:#0d141b;--line:#22343f;--text:#f4f8fb;--muted:#8ea2b0;--cyan:#56d6ff;--blue:#4f7dff;--good:#67e7a6;--sans:'Manrope',system-ui,sans-serif;--display:'Sora',system-ui,sans-serif;--mono:'IBM Plex Mono',monospace}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(720px 470px at 12% 2%,#56d6ff1b,transparent 60%),radial-gradient(700px 480px at 92% 8%,#4f7dff1b,transparent 58%),#070b10;color:var(--text);font-family:var(--sans);overflow:hidden}body:before{content:"";position:fixed;inset:0;background-image:linear-gradient(#ffffff03 1px,transparent 1px),linear-gradient(90deg,#ffffff03 1px,transparent 1px);background-size:46px 46px;mask-image:linear-gradient(to bottom,black,transparent 88%);pointer-events:none}.shell{width:min(440px,100%);position:relative}.orb{position:absolute;border-radius:50%;filter:blur(55px);pointer-events:none}.orb-a{width:160px;height:160px;background:var(--cyan);top:-70px;left:-70px;opacity:.16}.orb-b{width:140px;height:140px;background:var(--blue);right:-55px;bottom:-60px;opacity:.14}.card{position:relative;padding:28px;border:1px solid #29404d;border-radius:25px;background:linear-gradient(145deg,#0f1820f3,#091116ef);box-shadow:0 35px 110px #000c}.brand{display:flex;align-items:center;gap:11px}.mark{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,#70e1ff,#4f7dff);color:#04131c;font:800 11px var(--mono);box-shadow:0 0 38px #56d6ff20}.brand b{display:block;font:700 15px var(--display);letter-spacing:-.025em}.brand small{display:block;margin-top:2px;color:#687f8d;font-size:9px}.eyebrow{display:flex;align-items:center;gap:8px;margin-top:28px;color:var(--cyan);font:700 7px var(--mono);letter-spacing:.15em}.eyebrow i{width:20px;height:1px;background:linear-gradient(90deg,var(--cyan),transparent)}h1{font:700 35px/1.02 var(--display);letter-spacing:-.05em;margin:10px 0 8px}p{margin:0;color:var(--muted);font-size:10px;line-height:1.7}.field{display:block;margin-top:17px}.field span{display:block;margin-bottom:7px;color:#c8d8e0;font-size:9px;font-weight:700}input,button{width:100%;padding:12px 13px;border-radius:11px;border:1px solid #2a3e49;background:#081117;color:#f5f8fb;font:600 10px var(--sans);outline:0}input:focus{border-color:#56d6ff;box-shadow:0 0 0 3px #56d6ff10}.login-action{margin-top:20px}.login-action button{width:100%;min-height:46px;margin-top:0;display:flex;align-items:center;justify-content:center;gap:8px;border-color:#69dcff;background:linear-gradient(135deg,#69e0ff,#2aa8e8);color:#04131c;font:800 9px var(--mono);cursor:pointer;box-shadow:0 14px 35px #56d6ff10}.login-action button.loading:before{content:"";width:11px;height:11px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:loginSpin .7s linear infinite}@keyframes loginSpin{to{transform:rotate(360deg)}}.login-action button:disabled{opacity:.72;cursor:wait}.error{min-height:20px;margin-top:12px;color:#ff9f95;font:700 8px var(--mono)}.hint{margin-top:18px;padding-top:16px;border-top:1px solid #20303a;color:#667e8d;font-size:8px}.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.chip{padding:7px 8px;border:1px solid #243843;border-radius:999px;background:#091217;color:#6f8998;font:700 7px var(--mono)}@media(max-width:520px){.card{padding:23px}.shell{max-width:390px}h1{font-size:31px}}</style></head><body><div class="shell"><div class="orb orb-a"></div><div class="orb orb-b"></div><form class="card" id="login"><div class="brand"><div class="mark">FC</div><div><b>FC Mobile Tools</b><small>Private admin workspace</small></div></div><div class="eyebrow"><i></i> SECURE ENTRY</div><h1>Welcome back</h1><p>Sign in to manage redeem codes, Football Centre content and the shared media library</p><label class="field"><span>Username</span><input name="username" autocomplete="username" required></label><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label><div class="login-action"><button id="submit" type="submit">Enter workspace</button></div><div class="error" id="error" role="alert"></div><div class="hint">Admin access only<div class="chips"><span class="chip">CONTENT</span><span class="chip">FOOTBALL</span><span class="chip">MEDIA</span></div></div></form></div><script>const form=document.getElementById('login'),error=document.getElementById('error'),submit=document.getElementById('submit');form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';submit.disabled=true;submit.classList.add('loading');submit.textContent='Opening workspace…';try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(Object.fromEntries(new FormData(form)))});const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Sign in failed');location.replace('/admin/')}catch(x){error.textContent=x.message;submit.classList.remove('loading');submit.disabled=false;submit.textContent='Enter workspace'}})</script></body></html>`;

const ADMIN_DASHBOARD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap');
:root{--bg:#070b10!important;--panel:#0d141b!important;--panel2:#111a22!important;--line:#20323d!important;--text:#f4f8fb!important;--muted:#8ea2b0!important;--lime:#56d6ff!important;--violet:#4f7dff!important;--coral:#ff7d72!important;--amber:#ffbd68!important;--pink:#82cfff!important;--good:#67e7a6!important;--bad:#ff7d72!important;--sans:'Manrope',system-ui,sans-serif!important;--display:'Sora',system-ui,sans-serif!important;--mono:'IBM Plex Mono',ui-monospace,monospace!important}
html,body{background:radial-gradient(900px 600px at 7% -10%,#56d6ff16,transparent 60%),radial-gradient(760px 540px at 100% 3%,#4f7dff14,transparent 58%),var(--bg)!important;font-family:var(--sans)!important}
body:before{background-image:linear-gradient(#56d6ff04 1px,transparent 1px),linear-gradient(90deg,#56d6ff04 1px,transparent 1px)!important}
.side{background:#071016ed!important;border-right-color:#20323d!important}
.mark{background:linear-gradient(145deg,#70e1ff,#4f7dff)!important;color:#04131c!important;box-shadow:0 0 35px #56d6ff20!important}
.top{background:#070d12eb!important;border-bottom-color:#20323d!important}
.nav button.active{background:linear-gradient(90deg,#56d6ff10,#4f7dff08)!important;border-color:#2b5a72!important;box-shadow:inset 3px 0 #56d6ff,0 8px 24px #0004!important}
.nav button.active:before{color:#56d6ff!important}
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

async function hashPassword(password) {
  if(typeof password !== 'string' || password.length < 10) throw new Error('Password must be at least 10 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return argon2id({ password, salt, ...ARGON2_OPTIONS });
}

async function verifyPassword(password, encodedHash) {
  if(typeof password !== 'string' || typeof encodedHash !== 'string' || !encodedHash) return false;
  try { return await argon2Verify({ password, hash: encodedHash }); } catch { return false; }
}

async function creatorSession(creator, secret) {
  const payload = JSON.stringify({ id:creator.id, username:creator.username, role:creator.role, exp:Date.now()+SESSION_MAX_AGE*1000 });
  const encoded = b64(new TextEncoder().encode(payload));
  return encoded + '.' + await sign(secret,payload);
}

async function creatorAuthenticated(request, env) {
  if(!env.CREATOR_SESSION_SECRET) return null;
  const match=(request.headers.get('cookie')||'').match(new RegExp(CREATOR_SESSION_COOKIE + '=([^;]+)'));
  if(!match) return null;
  try {
    const [payload64,signature]=match[1].split('.');
    const payload=new TextDecoder().decode(unb64(payload64));
    if((await sign(env.CREATOR_SESSION_SECRET,payload))!==signature) return null;
    const data=JSON.parse(payload);
    if(!data?.id || !data?.username || data.exp<=Date.now()) return null;
    return data;
  } catch { return null; }
}
async function sign(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}

async function session(username, secret) {
  const payload = username+'|'+(Date.now() + SESSION_MAX_AGE * 1000);
  return b64(new TextEncoder().encode(payload))+'.'+await sign(secret,payload);
}

async function authenticated(request, env) {
  if (!env.ADMIN_SESSION_SECRET) { adminAuthLog('SESSION_VALIDATION_FAILED',{reason:'ADMIN_SESSION_SECRET_MISSING'}); return false; }
  const cookieHeader=request.headers.get('cookie')||'';
  const match=cookieHeader.split(';').map(x=>x.trim()).find(x=>x.startsWith(SESSION_COOKIE+'='));
  if(!match) return false;
  try {
    const token=match.slice(SESSION_COOKIE.length+1);
    const dot=token.indexOf('.');
    if(dot<1) { adminAuthLog('SESSION_VALIDATION_FAILED',{reason:'MALFORMED_SESSION'}); return false; }
    const payload64=token.slice(0,dot); const signature=token.slice(dot+1);
    const payload=new TextDecoder().decode(unb64(payload64));
    const separator=payload.lastIndexOf('|');
    const username=separator>0?payload.slice(0,separator):''; const expiry=separator>0?payload.slice(separator+1):'';
    if(!username||!expiry||Number(expiry)<=Date.now()) { adminAuthLog('SESSION_VALIDATION_FAILED',{reason:'EXPIRED_OR_INVALID_PAYLOAD'}); return false; }
    const expected=await sign(env.ADMIN_SESSION_SECRET,payload);
    if(expected!==signature) { adminAuthLog('SESSION_VALIDATION_FAILED',{reason:'SIGNATURE_MISMATCH'}); return false; }
    const configuredUser=String(env.ADMIN_USERNAME||'').trim();
    if(!configuredUser || username!==configuredUser) { adminAuthLog('SESSION_VALIDATION_FAILED',{reason:'ADMIN_USERNAME_MISMATCH'}); return false; }
    return true;
  } catch { adminAuthLog('SESSION_VALIDATION_FAILED',{reason:'VALIDATION_EXCEPTION'}); return false; }
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

const AD_SETTINGS_BUILD_FIX = '2026-09-26';

function parseSiteAds(text) {
  const match=text.match(/export const SITE_ADS = (\{[\s\S]*?\});\s*$/);
  if(!match) throw new Error('Ad configuration file has an unexpected format.');
  try { return JSON.parse(match[1]); } catch { throw new Error('Ad configuration is not valid JSON.'); }
}

function validateSiteAds(content) {
  if(!content || typeof content!=='object') throw new Error('Ad configuration is required.');
  content.enabled=Boolean(content.enabled);
  content.provider=String(content.provider||'Monetag').trim()||'Monetag';

  if(!content.popunder || typeof content.popunder!=='object') throw new Error('Popunder configuration is missing.');
  if(!content.push || typeof content.push!=='object') throw new Error('Push configuration is missing.');

  content.popunder.enabled=Boolean(content.popunder.enabled);
  content.popunder.zone=String(content.popunder.zone||'').trim();
  content.popunder.src=String(content.popunder.src||'').trim();
  content.push.enabled=Boolean(content.push.enabled);
  content.push.zone=String(content.push.zone||'').trim();
  content.push.src=String(content.push.src||'').trim();
  content.push.delayMs=Number(content.push.delayMs);

  const validHttps=(value)=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
  if(!content.popunder.zone || !validHttps(content.popunder.src)) throw new Error('Popunder network settings are invalid.');
  if(!content.push.zone || !validHttps(content.push.src)) throw new Error('Push network settings are invalid.');
  if(!Number.isInteger(content.push.delayMs) || content.push.delayMs<5000 || content.push.delayMs>300000) throw new Error('Push delay must be between 5 and 300 seconds.');

  // Never allow the admin UI to remove the private exclusions.
  content.excludedPathPrefixes=['/admin','/api','/creator/login'];
  return content;
}

function siteAdsText(content) {
  return '// Central ad configuration managed by the FC Mobile Tools admin panel.\n// /admin, /api, and /creator/login remain excluded from ads server-side.\nexport const SITE_ADS = '+JSON.stringify(content,null,2)+';\n';
}

function parseRedeem(text) {
  const start=text.indexOf('export const REDEEM_CODES = '), end=text.indexOf('export const REDEEM_STATUS',start);
  if(start<0 || end<0) throw new Error('Redeem data file has an unexpected format.');
  return JSON.parse(text.slice(text.indexOf('[',start),end).replace(/;\s*$/,'').trim());
}

function redeemText(codes) { return `// FC Mobile redeem-code database.\nexport const REDEEM_CODES = ${JSON.stringify(codes,null,2)};\n\nexport const REDEEM_STATUS = {\n  active: { label: 'Active', className: 'active' },\n  scheduled: { label: 'Scheduled', className: 'scheduled' },\n  expired: { label: 'Expired', className: 'expired' },\n  unknown: { label: 'Unknown', className: 'unknown' },\n};\n`; }


function parseFcMobile27(text) {
  const match=text.match(/export const FC_MOBILE_27 = ([\s\S]+);\s*$/);
  if(!match) throw new Error('FC Mobile 27 data file has an unexpected format.');
  try { return JSON.parse(match[1]); } catch { throw new Error('FC Mobile 27 data file is not JSON-compatible.'); }
}
function validateFcMobile27(content) {
  if(!content || typeof content!=='object' || !Array.isArray(content.releases) || !content.releases.length) throw new Error('At least one FC Mobile 27 release is required.');
  const seen=new Set();
  for(const release of content.releases) {
    if(!release?.id || seen.has(release.id)) throw new Error('Release IDs must be unique and non-empty.');
    seen.add(release.id);
    if(!release.title || !release.version || !release.releaseDate) throw new Error('Release title, version, and release date are required.');
    if(!/^https?:\/\/\S+$/i.test(String(release.downloadUrl||''))) throw new Error('Download URL must be a valid HTTP or HTTPS URL.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(release.releaseDate))) throw new Error('Release date must use YYYY-MM-DD.');
    if(!Array.isArray(release.changelog)) release.changelog=[];
    release.changelog=release.changelog.map(x=>String(x).trim()).filter(Boolean);
    release.status=['latest','active','archived'].includes(release.status)?release.status:'archived';
  }
  const latest=content.releases.findIndex(x=>x.status==='latest');
  if(latest<0) content.releases[0].status='latest';
  else content.releases.forEach((x,i)=>{ if(i!==latest && x.status==='latest') x.status='active'; });
  content.lastUpdated=new Date().toISOString().slice(0,10);
}
function fcMobile27Text(content) {
  return '// FC Mobile 27 APK release data managed by the admin panel.\n// Keep this file JSON-compatible so the Worker can validate and update it.\nexport const FC_MOBILE_27 = '+JSON.stringify(content,null,2)+';\n';
}
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
  const jsonArray=(value)=>JSON.stringify(Array.isArray(value)?value:[]);
  const firstInlineImage=String(a.body||'').match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1] || '';
  const effectiveImage=a.image||firstInlineImage;
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
updatedAt: ${yamlValue(a.updatedAt||new Date().toISOString())}
publishedAt: ${yamlValue(a.status==='published' ? (a.publishedAt||new Date().toISOString()) : null)}
image: ${yamlValue(effectiveImage)}
imageAlt: ${yamlValue(a.imageAlt||'')}
imageCaption: ${yamlValue(a.imageCaption||'')}
thumbnail: ${yamlValue(a.thumbnail||'')}
excerpt: ${yamlValue(a.excerpt||a.description||'')}
tags: ${jsonArray(tags)}
relatedPlayers: ${jsonArray(a.relatedPlayers)}
relatedEvents: ${jsonArray(a.relatedEvents)}
relatedArticles: ${jsonArray(a.relatedArticles)}
relatedTools: ${jsonArray(a.relatedTools)}
relatedCodes: ${jsonArray(a.relatedCodes)}
featured: ${Boolean(a.featured)}
readingTime: ${Number(a.readingTime)||Math.max(1,Math.ceil(String(a.body||'').split(/\s+/).filter(Boolean).length/220))}
seoTitle: ${yamlValue(a.seoTitle||a.title)}
seoDescription: ${yamlValue(a.seoDescription||a.description||'')}
canonicalUrl: ${yamlValue(a.canonicalUrl||'')}
sources: ${jsonArray(a.sources)}
factStatus: ${yamlValue(a.factStatus||'verified')}
lastReviewed: ${yamlValue(a.lastReviewed||'')}
series: ${yamlValue(a.series||'')}
---

${String(a.body||'').trim()}
`;
}

async function syncPublishedArticle(env, article) {
  if(!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured; cannot publish the article.');
  const path=`src/content/blog/${article.slug}.md`;
  let existing=null;
  try { existing=await repoFile(env,path); } catch {}
  const text=articleText(article);
  if(existing) return writeRepoFile(env,path,text,existing.sha,'content: publish article');
  return github(env,`contents/${path}`,{
    method:'PUT',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({message:'content: publish article',content:encodeGithub(text),branch:'main'})
  }).then(body=>body.commit?.sha);
}
async function removePublishedArticle(env, slug) {
  if(!env.GITHUB_TOKEN || !slug) return null;
  const path='src/content/blog/'+slug+'.md';
  let existing=null;
  try { existing=await repoFile(env,path); } catch { return null; }
  try {
    const body=await github(env,'contents/'+path,{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({message:'content: remove unpublished article',sha:existing.sha,branch:'main'})});
    return body.commit?.sha;
  } catch(error) {
    if(String(error?.message||'').toLowerCase().includes('not found')) return null;
    throw error;
  }
}
function articleSlug(value) {
  return String(value||'').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,90);
}
function validateTraining(data) {
  if(!data||!Array.isArray(data.levels)||data.levels.length<2||!Array.isArray(data.fodder)||!data.fodder.length) throw new Error('Training data is incomplete.');
  data.levels.forEach((v,i)=>{if(!Number.isFinite(Number(v))||Number(v)<0||(i&&Number(v)<Number(data.levels[i-1]))) throw new Error('Training XP levels must be non-negative and ascending.');});
  data.fodder.forEach((x,i)=>{if(!x?.id||!String(x.label||'').trim()||!Number.isFinite(Number(x.xp))||Number(x.xp)<0) throw new Error(`Fodder entry ${i+1} is invalid.`);});
}

function articleRow(row) {
  const tags=Array.isArray(row.tags)?row.tags:JSON.parse(row.tags||'[]');
  return {
    id:row.id, path:'d1:'+row.id, sha:null, body:row.content||'',
    data:{ id:row.id, slug:row.slug, title:row.title, subtitle:row.subtitle||'', description:row.description||row.excerpt||'', excerpt:row.excerpt||'', type:row.type, category:row.category||'', author:row.author_name||'', authorId:row.author_id, ownerId:row.owner_id, status:row.status, image:row.feature_image||'', imageAlt:row.image_alt||'', imageCaption:row.image_caption||'', thumbnail:row.thumbnail||'', tags, featured:Boolean(row.featured), readingTime:row.reading_time||1, publishedAt:row.published_at, createdAt:row.created_at, updatedAt:row.updated_at, deletedAt:row.deleted_at, factStatus:row.fact_status||'verified', lastReviewed:row.last_reviewed||'', seoTitle:row.seo_title||'', seoDescription:row.seo_description||'', canonicalUrl:row.canonical_url||'', series:row.series||'' }
  };
}

async function creatorRecord(request, env) {
  const session=await creatorAuthenticated(request,env);
  if(!session) return null;
  const database=await d1(env);
  return database.prepare('SELECT id, username, display_name, bio, avatar_url, website_url, role, active FROM creators WHERE id=? AND active=1 LIMIT 1').bind(session.id).first();
}
async function d1(env) {
  if (!env.DB) throw new Error('D1 binding DB is not configured in the Worker.');
  return env.DB;
}

async function ensureEditorialTables(env) {
  const database=await d1(env);
  await database.prepare('CREATE TABLE IF NOT EXISTS article_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL, revision_no INTEGER NOT NULL, editor_id INTEGER, editor_role TEXT NOT NULL, action TEXT NOT NULL DEFAULT \'save\', review_status TEXT NOT NULL DEFAULT \'draft\', note TEXT DEFAULT \'\', snapshot TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, superseded_at TEXT)').run();
  await database.prepare('CREATE INDEX IF NOT EXISTS idx_article_revisions_article ON article_revisions(article_id, revision_no DESC)').run();
  await database.prepare('CREATE INDEX IF NOT EXISTS idx_article_revisions_review ON article_revisions(review_status, superseded_at)').run();
}

function revisionSnapshot(row) {
  return {id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle||'',description:row.description||'',excerpt:row.excerpt||'',content:row.content||'',type:row.type,category:row.category||'Guides',authorId:row.author_id||null,status:row.status,featureImage:row.feature_image||'',imageAlt:row.image_alt||'',imageCaption:row.image_caption||'',thumbnail:row.thumbnail||'',featured:Boolean(row.featured),readingTime:Number(row.reading_time||1),tags:JSON.parse(row.tags||'[]'),relatedPlayers:JSON.parse(row.related_players||'[]'),relatedEvents:JSON.parse(row.related_events||'[]'),relatedArticles:JSON.parse(row.related_articles||'[]'),relatedTools:JSON.parse(row.related_tools||'[]'),relatedCodes:JSON.parse(row.related_codes||'[]'),sources:JSON.parse(row.sources||'[]'),factStatus:row.fact_status||'verified',lastReviewed:row.last_reviewed||'',seoTitle:row.seo_title||'',seoDescription:row.seo_description||'',canonicalUrl:row.canonical_url||'',series:row.series||'',publishedAt:row.published_at||null};
}

async function createRevision(env,row,options={}) {
  await ensureEditorialTables(env);
  const database=await d1(env);
  const next=await database.prepare('SELECT COALESCE(MAX(revision_no),0)+1 AS next_no FROM article_revisions WHERE article_id=?').bind(row.id).first();
  if(options.reviewStatus==='pending') await database.prepare("UPDATE article_revisions SET superseded_at=? WHERE article_id=? AND review_status='pending' AND superseded_at IS NULL").bind(new Date().toISOString(),row.id).run();
  await database.prepare('INSERT INTO article_revisions (article_id,revision_no,editor_id,editor_role,action,review_status,note,snapshot,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(row.id,Number(next?.next_no||1),options.editorId||null,options.editorRole||'admin',options.action||'save',options.reviewStatus||'draft',String(options.note||''),JSON.stringify(revisionSnapshot(row)),new Date().toISOString()).run();
}

function tempPassword() { const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'; const bytes=crypto.getRandomValues(new Uint8Array(18)); return Array.from(bytes,b=>chars[b%chars.length]).join(''); }

async function getAdminAccount(env) {
  const username=String(env.ADMIN_USERNAME||'').trim();
  if(!username || !env.ADMIN_PASSWORD) return null;
  return {
    id:1,
    username,
    display_name:String(env.ADMIN_DISPLAY_NAME||username),
    updated_at:null,
    passwordManagedBy:'Worker secret'
  };
}
function adminAuthLog(stage, details={}) {
  console.warn('[ADMIN_AUTH]', JSON.stringify({stage,...details}));
}

async function saveRedeemCode(env,input,actor='admin') {
  if(!input.code || !input.reward || !input.releaseDate || !['active','scheduled','expired'].includes(input.status)) throw new Error('Code, reward, status, and release date are required.');
  if(input.expiryDate && input.releaseDate > input.expiryDate) throw new Error('Expiry date cannot be before release date.');
  const code={code:String(input.code).trim().toUpperCase(),reward:String(input.reward).trim(),status:input.status,releaseDate:input.releaseDate,expiryDate:input.expiryDate||null,region:String(input.region||'Global').trim(),lastVerified:input.lastVerified||new Date().toISOString().slice(0,10),notes:String(input.notes||'').trim()};
  const file=await repoFile(env,'src/data/redeemCodes.js');
  const codes=parseRedeem(file.text);
  const i=codes.findIndex(x=>String(x.code).toUpperCase()===code.code);
  if(i>=0) codes[i]=code; else codes.unshift(code);
  const commitSha=await writeRepoFile(env,'src/data/redeemCodes.js',redeemText(codes),file.sha,(actor==='creator'?'creator':'admin')+': update redeem code '+code.code);
  return {ok:true,commitSha,action:i>=0?'updated':'created'};
}

async function api(request,env,path) {
  if(path === '/creator/articles' && request.method === 'GET') {
    const creator=await creatorRecord(request,env);
    if(!creator) return json({error:'Authentication required.'},401);
    const database=await d1(env);
    const rows=await database.prepare(`SELECT a.*, c.display_name AS author_name FROM articles a LEFT JOIN creators c ON c.id=a.author_id WHERE a.owner_id=? ORDER BY CASE WHEN a.deleted_at IS NULL THEN 0 ELSE 1 END, COALESCE(a.updated_at,a.created_at) DESC`).bind(creator.id).all();
    return json({creator:{id:creator.id,username:creator.username,displayName:creator.display_name},articles:(rows.results||[]).map(articleRow)});
  }
  if(path === '/creator/articles' && request.method === 'POST') {
    const creator=await creatorRecord(request,env); if(!creator) return json({error:'Authentication required.'},401);
    const input=await request.json(); const title=String(input.title||'').trim(); const slug=articleSlug(input.slug||title);
    if(!title||!slug) throw new Error('Article title is required.');
    const status=['draft','review'].includes(input.status)?input.status:'draft'; const database=await d1(env); const now=new Date().toISOString();
    const tags=JSON.stringify(Array.isArray(input.tags)?input.tags:[]); const existing=await database.prepare('SELECT id FROM articles WHERE slug=? LIMIT 1').bind(slug).first();
    if(existing) throw new Error('An article with this slug already exists.');
    const result=await database.prepare('INSERT INTO articles (slug,title,subtitle,description,excerpt,content,type,category,author_id,status,feature_image,image_alt,image_caption,thumbnail,featured,reading_time,tags,created_at,updated_at,seo_title,seo_description,owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(slug,title,String(input.subtitle||''),String(input.description||''),String(input.description||''),String(input.body||''),String(input.type||'guide'),String(input.category||'Guides'),creator.id,status,String(input.image||''),String(input.imageAlt||''),String(input.imageCaption||''),String(input.thumbnail||''),0,Math.max(1,Number(input.readingTime||1)),tags,now,now,String(input.seoTitle||title),String(input.seoDescription||input.description||''),creator.id).run();
    const row=await database.prepare('SELECT * FROM articles WHERE id=? LIMIT 1').bind(result.meta?.last_row_id).first();
    await createRevision(env,row,{editorId:creator.id,editorRole:'creator',action:status==='review'?'submit':'save',reviewStatus:status==='review'?'pending':'draft'});
    return json({ok:true,articleId:result.meta?.last_row_id,slug});
  }
  if((path.startsWith('/creator/articles/') || path.startsWith('/creator/article/')) && (request.method === 'PUT' || request.method === 'DELETE' || request.method === 'POST')) {
    const creator=await creatorRecord(request,env); if(!creator) return json({error:'Authentication required.'},401);
    const parts=path.split('/').filter(Boolean); const id=Number(parts[2]);
    if(!Number.isInteger(id)||id<1) return json({error:'Invalid article ID.'},400);
    const database=await d1(env); const current=await database.prepare('SELECT * FROM articles WHERE id=? AND owner_id=? LIMIT 1').bind(id,creator.id).first();
    if(!current) return json({error:'Article not found.'},404);
    if(parts[3]==='restore' && request.method==='POST'){await database.prepare('UPDATE articles SET deleted_at=NULL,deleted_by=NULL,updated_at=? WHERE id=? AND owner_id=?').bind(new Date().toISOString(),id,creator.id).run();return json({ok:true,action:'restored'});}
    if(request.method==='DELETE'){const now=new Date().toISOString();await database.prepare('UPDATE articles SET deleted_at=?,deleted_by=?,updated_at=? WHERE id=? AND owner_id=?').bind(now,creator.id,now,id,creator.id).run();return json({ok:true,action:'trashed'});}
    if(request.method==='PUT'){
      if(current.status==='published') return json({error:'Published articles require admin editing.'},403);
      const input=await request.json(); const title=String(input.title||current.title).trim(); const slug=articleSlug(input.slug||current.slug);
      if(!title||!slug) throw new Error('Article title is required.');
      const status=['draft','review'].includes(input.status)?input.status:current.status;
      const conflict=await database.prepare('SELECT id FROM articles WHERE slug=? AND id!=? LIMIT 1').bind(slug,id).first(); if(conflict) throw new Error('An article with this slug already exists.');
      const tags=JSON.stringify(Array.isArray(input.tags)?input.tags:JSON.parse(current.tags||'[]')); const now=new Date().toISOString();
      await database.prepare('UPDATE articles SET slug=?,title=?,subtitle=?,description=?,excerpt=?,content=?,type=?,category=?,status=?,feature_image=?,image_alt=?,image_caption=?,thumbnail=?,tags=?,reading_time=?,updated_at=?,seo_title=?,seo_description=? WHERE id=? AND owner_id=?')
        .bind(slug,title,String(input.subtitle||''),String(input.description||''),String(input.description||''),String(input.body||''),String(input.type||current.type),String(input.category||current.category||'Guides'),status,String(input.image||current.feature_image||''),String(input.imageAlt||current.image_alt||''),String(input.imageCaption||current.image_caption||''),String(input.thumbnail||current.thumbnail||''),tags,Math.max(1,Number(input.readingTime||current.reading_time||1)),now,String(input.seoTitle||title),String(input.seoDescription||input.description||''),id,creator.id).run();
      const row=await database.prepare('SELECT * FROM articles WHERE id=? LIMIT 1').bind(id).first();
      await createRevision(env,row,{editorId:creator.id,editorRole:'creator',action:status==='review'?'submit':'save',reviewStatus:status==='review'?'pending':'draft'});
      return json({ok:true,action:'updated',articleId:id,slug});
    }
  }
  if(path === '/creator/login' && request.method === 'POST') {
    if(!env.CREATOR_SESSION_SECRET) return json({error:'Creator authentication is not configured in the Worker.'},503);
    const body=await request.json().catch(()=>({}));
    const username=String(body.username||'').trim().toLowerCase();
    const password=String(body.password||'');
    if(!username || !password) return json({error:'Username and password are required.'},400);
    const database=await d1(env);
    const creator=await database.prepare('SELECT id, username, display_name, password_hash, role, active FROM creators WHERE username=? LIMIT 1').bind(username).first();
    if(!creator || creator.active!==1 || !(await verifyPassword(password,creator.password_hash))) return json({error:'Invalid username or password.'},401);
    const token=await creatorSession(creator,env.CREATOR_SESSION_SECRET);
    return json({ok:true,creator:{id:creator.id,username:creator.username,displayName:creator.display_name,role:creator.role}},200,{'set-cookie':CREATOR_SESSION_COOKIE+'='+token+'; Path=/; Max-Age='+SESSION_MAX_AGE+'; HttpOnly; Secure; SameSite=Strict'});
  }
  if(path === '/creator/logout' && request.method === 'POST') return json({ok:true},200,{'set-cookie':CREATOR_SESSION_COOKIE+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'});
  if(path === '/creator/me' && request.method === 'GET') {
    const creator=await creatorAuthenticated(request,env);
    if(!creator) return json({error:'Authentication required.'},401);
    const record=await creatorRecord(request,env);
    return json({creator:record||creator});
  }
  if(path === '/creator/account' && (request.method === 'GET' || request.method === 'PUT')) {
    const creator=await creatorRecord(request,env);
    if(!creator) return json({error:'Authentication required.'},401);
    const database=await d1(env);
    if(request.method==='GET') return json({account:{id:creator.id,username:creator.username,displayName:creator.display_name,bio:creator.bio||'',avatarUrl:creator.avatar_url||'',websiteUrl:creator.website_url||''}});
    const input=await request.json(); const updates=[]; const values=[];
    if(input.displayName!==undefined){updates.push('display_name=?');values.push(String(input.displayName).trim());}
    if(input.bio!==undefined){updates.push('bio=?');values.push(String(input.bio));}
    if(input.avatarUrl!==undefined){updates.push('avatar_url=?');values.push(String(input.avatarUrl));}
    if(input.websiteUrl!==undefined){updates.push('website_url=?');values.push(String(input.websiteUrl));}
    if(input.currentPassword||input.newPassword){
      if(!input.currentPassword||!input.newPassword) return json({error:'Current and new passwords are required together.'},400);
      const row=await database.prepare('SELECT password_hash FROM creators WHERE id=? LIMIT 1').bind(creator.id).first();
      if(!row||!(await verifyPassword(String(input.currentPassword),row.password_hash))) return json({error:'Current password is incorrect.'},400);
      updates.push('password_hash=?');values.push(await hashPassword(String(input.newPassword)));
    }
    if(updates.length){updates.push('updated_at=?');values.push(new Date().toISOString());values.push(creator.id);await database.prepare('UPDATE creators SET '+updates.join(', ')+' WHERE id=?').bind(...values).run();}
    return json({ok:true});
  }
  if(path === '/creator/inbox' && request.method === 'GET') {
    const creator=await creatorRecord(request,env); if(!creator) return json({error:'Authentication required.'},401);
    await ensureEditorialTables(env); const database=await d1(env);
    const rows=await database.prepare("SELECT r.id,r.article_id,r.revision_no,r.review_status,r.action,r.note,r.created_at,a.title,a.slug,a.status FROM article_revisions r JOIN articles a ON a.id=r.article_id WHERE r.editor_id=? AND r.review_status IN ('changes_requested','approved') AND r.superseded_at IS NULL ORDER BY r.created_at DESC LIMIT 40").bind(creator.id).all();
    return json({items:rows.results||[]});
  }
  if(path === '/overview' && request.method === 'GET') {
    const creator=await creatorRecord(request,env); if(!creator) return json({error:'Authentication required.'},401);
    const database=await d1(env); const codes=parseRedeem((await repoFile(env,'src/data/redeemCodes.js')).text);
    const articleCount=await database.prepare('SELECT COUNT(*) AS n FROM articles WHERE owner_id=? AND deleted_at IS NULL').bind(creator.id).first();
    const reviewCount=await database.prepare("SELECT COUNT(*) AS n FROM articles WHERE owner_id=? AND status='review' AND deleted_at IS NULL").bind(creator.id).first();
    return json({codes:{total:codes.length,active:codes.filter(x=>x.status==='active').length,scheduled:codes.filter(x=>x.status==='scheduled').length,expired:codes.filter(x=>x.status==='expired').length},articles:{total:Number(articleCount?.n||0),review:Number(reviewCount?.n||0)},user:{displayName:creator.display_name}});
  }
  if(path === '/redeem' && (request.method === 'GET' || request.method === 'POST')) {
    const admin=await authenticated(request,env);
    const creator=admin?null:await creatorRecord(request,env);
    if(!admin && !creator) return json({error:'Authentication required.'},401);
    if(request.method==='GET') return json({codes:parseRedeem((await repoFile(env,'src/data/redeemCodes.js')).text)});
    return json(await saveRedeemCode(env,await request.json(),admin?'admin':'creator'));
  }
  if(path === '/media' && request.method === 'GET') {
    const admin=await authenticated(request,env);
    const creator=admin?null:await creatorRecord(request,env); if(!admin && !creator) return json({error:'Authentication required.'},401);
    if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary is not fully configured in the Worker.');
    const auth=btoa(env.CLOUDINARY_API_KEY+':'+env.CLOUDINARY_API_SECRET), r=await fetch('https://api.cloudinary.com/v1_1/'+env.CLOUDINARY_CLOUD_NAME+'/resources/image/upload?max_results=100',{headers:{authorization:'Basic '+auth}}), body=await r.json();
    if(!r.ok) throw new Error(body?.error?.message||'Cloudinary request failed ('+r.status+').');
    return json({resources:(body.resources||[]).map(x=>({publicId:x.public_id,url:x.secure_url,width:x.width,height:x.height,bytes:x.bytes,format:x.format,createdAt:x.created_at}))});
  }
  if(path === '/login' && request.method === 'POST') {
    const body=await request.json().catch(()=>({}));
    const suppliedUser=String(body.username||'').trim();
    const suppliedPassword=String(body.password||'');
    const configuredUser=String(env.ADMIN_USERNAME||'').trim();
    const configuredPassword=String(env.ADMIN_PASSWORD||'');
    if(!suppliedUser || !suppliedPassword) return json({error:'Username and password are required.'},400);
    if(!env.ADMIN_SESSION_SECRET || !configuredUser || !configuredPassword) {
      adminAuthLog('LOGIN_CONFIGURATION_FAILED',{sessionSecret:Boolean(env.ADMIN_SESSION_SECRET),username:Boolean(configuredUser),password:Boolean(configuredPassword)});
      return json({error:'Admin login is not configured.'},503);
    }
    const usernameMatch=suppliedUser===configuredUser;
    const passwordMatch=suppliedPassword===configuredPassword;
    if(!usernameMatch || !passwordMatch) {
      adminAuthLog('PASSWORD_VERIFICATION_FAILED',{usernameMatch,verified:passwordMatch});
      return json({error:'Invalid username or password.'},401);
    }
    let token;
    try { token=await session(configuredUser,env.ADMIN_SESSION_SECRET); }
    catch { adminAuthLog('SESSION_CREATION_FAILED'); return json({error:'Signing failed.'},500); }
    if(!token) { adminAuthLog('SESSION_CREATION_FAILED'); return json({error:'Signing failed.'},500); }
    adminAuthLog('PASSWORD_VERIFICATION_SUCCEEDED',{usernameMatch:true,verified:true});
    return json({ok:true},200,{'set-cookie':SESSION_COOKIE+'='+token+'; Path=/; Max-Age='+SESSION_MAX_AGE+'; HttpOnly; Secure; SameSite=Lax'});
  }

  if(path === '/logout' && request.method === 'POST') return json({ok:true},200,{'set-cookie':`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`});
  if(!(await authenticated(request,env))) return json({error:'Authentication required.'},401);
  try {
    if(path === '/me') {
      const account=await getAdminAccount(env);
      return json({username:account?.username||env.ADMIN_USERNAME,displayName:account?.display_name||account?.username||env.ADMIN_USERNAME,role:'admin',updatedAt:account?.updated_at||null});
    }
    if(path === '/ad-settings' && request.method === 'GET') {
      return json({settings:parseSiteAds((await repoFile(env,'src/config/siteAds.js')).text)});
    }
    if(path === '/ad-settings' && request.method === 'POST') {
      const input=await request.json().catch(()=>({}));
      const current=parseSiteAds((await repoFile(env,'src/config/siteAds.js')).text);
      const next=validateSiteAds({
        ...current,
        enabled:input.enabled===undefined?current.enabled:Boolean(input.enabled),
        provider:current.provider,
        popunder:{...current.popunder,...(input.popunder||{})},
        push:{...current.push,...(input.push||{})}
      });
      const file=await repoFile(env,'src/config/siteAds.js');
      const commitSha=await writeRepoFile(env,'src/config/siteAds.js',siteAdsText(next),file.sha,'admin: update site ad settings');
      return json({ok:true,commitSha,settings:next});
    }
    if(path === '/account' && (request.method === 'GET' || request.method === 'PUT')) {
      const account=await getAdminAccount(env); if(!account) return json({error:'Admin login is not configured.'},503);
      if(request.method==='GET') return json({account:{username:account.username,displayName:account.display_name,updatedAt:account.updated_at,passwordManagedBy:'Worker secret'}});
      const input=await request.json().catch(()=>({}));
      if(input.currentPassword||input.newPassword) return json({error:'Password is managed by the ADMIN_PASSWORD Worker secret.'},400);
      return json({ok:true});
    }
    if(path === '/creators/bootstrap-self' && request.method === 'POST') {
      const database=await d1(env);
      const existing=await database.prepare("SELECT id,username,display_name FROM creators WHERE username='tanzimfc' LIMIT 1").first();
      if(existing) return json({ok:true,created:false,creator:{id:existing.id,username:existing.username,displayName:existing.display_name}});
      const password=tempPassword(); const passwordHash=await hashPassword(password); const now=new Date().toISOString();
      const result=await database.prepare('INSERT INTO creators (username,display_name,password_hash,bio,avatar_url,website_url,role,active,joined_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind('tanzimfc','TanzimFC',passwordHash,'FC Mobile tools, guides, updates and analysis.','','','creator',1,now,now).run();
      return json({ok:true,created:true,temporaryPassword:password,creator:{id:result.meta?.last_row_id,username:'tanzimfc',displayName:'TanzimFC'}});
    }
    if(path === '/creators' && request.method === 'GET') {
      const database=await d1(env);
      const rows=await database.prepare('SELECT id, username, display_name, bio, avatar_url, website_url, role, active, created_at, joined_at FROM creators ORDER BY id DESC').all();
      return json({creators:rows.results||[]});
    }
    if(path === '/creators' && request.method === 'POST') {
      const input=await request.json();
      const username=String(input.username||'').trim().toLowerCase();
      const displayName=String(input.displayName||input.display_name||'').trim();
      const password=String(input.password||'');
      if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw new Error('Username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens.');
      if(!displayName) throw new Error('Display name is required.');
      const passwordHash=await hashPassword(password);
      const database=await d1(env);
      const now=new Date().toISOString();
      try {
        const result=await database.prepare('INSERT INTO creators (username, display_name, password_hash, bio, avatar_url, website_url, role, active, joined_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)').bind(username,displayName,passwordHash,String(input.bio||''),String(input.avatarUrl||''),String(input.websiteUrl||''),'creator',now,now).run();
        return json({ok:true,id:result.meta?.last_row_id,username,displayName});
      } catch(error) {
        if(String(error?.message||'').toLowerCase().includes('unique')) throw new Error('That creator username already exists.');
        throw error;
      }
    }
    if(path.match(/^\/creators\/\\d+$/) && request.method === 'PUT') {
      const id=Number(path.split('/')[2]);
      if(!Number.isInteger(id)||id<1) return json({error:'Invalid creator ID.'},400);
      const input=await request.json();
      const database=await d1(env);
      const current=await database.prepare('SELECT id, username FROM creators WHERE id=? LIMIT 1').bind(id).first();
      if(!current) return json({error:'Creator not found.'},404);
      const fields=[], values=[];
      if(input.displayName!==undefined){fields.push('display_name=?');values.push(String(input.displayName).trim());}
      if(input.bio!==undefined){fields.push('bio=?');values.push(String(input.bio));}
      if(input.avatarUrl!==undefined){fields.push('avatar_url=?');values.push(String(input.avatarUrl));}
      if(input.websiteUrl!==undefined){fields.push('website_url=?');values.push(String(input.websiteUrl));}
      if(input.active!==undefined){fields.push('active=?');values.push(input.active?1:0);}
      if(input.password){fields.push('password_hash=?');values.push(await hashPassword(String(input.password)));}
      if(!fields.length) return json({ok:true});
      fields.push('updated_at=?');values.push(new Date().toISOString());values.push(id);
      await database.prepare('UPDATE creators SET '+fields.join(', ')+' WHERE id=?').bind(...values).run();
      return json({ok:true,id});
    }
    if(path === '/db-status' && request.method === 'GET') {
      const database=await d1(env);
      const row=await database.prepare('SELECT 1 AS ok').first();
      return json({ok:row?.ok===1, database:'connected'});
    }
    if(path === '/redeem' && (request.method === 'GET' || request.method === 'POST')) {
      const input=request.method==='POST'?await request.json():null;
      return json(request.method==='POST'?await saveRedeemCode(env,input,'admin'):{codes:parseRedeem((await repoFile(env,'src/data/redeemCodes.js')).text)});
    }
    if(path === '/rank-up' && request.method === 'GET') return json(parseRankUp((await repoFile(env,'src/data/fcMobileRankUp.js')).text));
    if(path === '/rank-up' && request.method === 'POST') { const data=await request.json(); validateRankUp(data); const file=await repoFile(env,'src/data/fcMobileRankUp.js'); const commitSha=await writeRepoFile(env,'src/data/fcMobileRankUp.js',rankUpText(data),file.sha,'admin: update Rank Up Points data'); return json({ok:true,commitSha}); }
    if(path === '/training' && request.method === 'GET') return json(parseTraining((await repoFile(env,'src/data/fcMobileTraining.js')).text));
    if(path === '/training' && request.method === 'POST') { const data=await request.json(); validateTraining(data); const file=await repoFile(env,'src/data/fcMobileTraining.js'); const commitSha=await writeRepoFile(env,'src/data/fcMobileTraining.js',trainingText(data),file.sha,'admin: update Training XP data'); return json({ok:true,commitSha}); }

    if(path === '/articles/trash' && request.method === 'GET') {
      const database=await d1(env);
      const rows=await database.prepare(`SELECT a.*, c.display_name AS author_name FROM articles a LEFT JOIN creators c ON c.id=a.author_id WHERE a.deleted_at IS NOT NULL ORDER BY a.deleted_at DESC`).all();
      return json({articles:(rows.results||[]).map(articleRow)});
    }
    const articleAction=path.match(/^\/articles\/(\d+)\/(restore|trash)$/);
    if(articleAction) {
      const id=Number(articleAction[1]), action=articleAction[2], database=await d1(env);
      const row=await database.prepare('SELECT * FROM articles WHERE id=? LIMIT 1').bind(id).first();
      if(!row) return json({error:'Article not found.'},404);
      const now=new Date().toISOString();
      if(action==='restore') {
        await database.prepare('UPDATE articles SET deleted_at=NULL,deleted_by=NULL,updated_at=? WHERE id=?').bind(now,id).run();
        const fresh=await database.prepare('SELECT a.*,c.display_name AS author_name FROM articles a LEFT JOIN creators c ON c.id=a.author_id WHERE a.id=? LIMIT 1').bind(id).first();
        if(fresh.status==='published') await syncPublishedArticle(env,{id:fresh.id,slug:fresh.slug,title:fresh.title,subtitle:fresh.subtitle,description:fresh.description,excerpt:fresh.excerpt,type:fresh.type,category:fresh.category,author:fresh.author_name||'TanzimFC',status:fresh.status,createdBy:fresh.author_name||'TanzimFC',createdAt:fresh.created_at,updatedAt:fresh.updated_at,publishedAt:fresh.published_at,image:fresh.feature_image,imageAlt:fresh.image_alt,imageCaption:fresh.image_caption,thumbnail:fresh.thumbnail,tags:JSON.parse(fresh.tags||'[]'),relatedPlayers:JSON.parse(fresh.related_players||'[]'),relatedEvents:JSON.parse(fresh.related_events||'[]'),relatedArticles:JSON.parse(fresh.related_articles||'[]'),relatedTools:JSON.parse(fresh.related_tools||'[]'),relatedCodes:JSON.parse(fresh.related_codes||'[]'),featured:Boolean(fresh.featured),readingTime:fresh.reading_time,seoTitle:fresh.seo_title,seoDescription:fresh.seo_description,canonicalUrl:fresh.canonical_url,sources:JSON.parse(fresh.sources||'[]'),factStatus:fresh.fact_status,lastReviewed:fresh.last_reviewed,series:fresh.series,body:fresh.content});
      } else {
        if(row.status==='published') await removePublishedArticle(env,row.slug);
        await database.prepare('UPDATE articles SET deleted_at=?,deleted_by=NULL,updated_at=? WHERE id=?').bind(now,now,id).run();
      }
      return json({ok:true,action});
    }
    if(path === '/inbox' && request.method === 'GET') {
      await ensureEditorialTables(env); const database=await d1(env);
      const rows=await database.prepare("SELECT r.id,r.article_id,r.revision_no,r.note,r.created_at,a.title,a.slug,a.status,c.display_name AS author_name FROM article_revisions r JOIN articles a ON a.id=r.article_id LEFT JOIN creators c ON c.id=a.author_id WHERE r.review_status='pending' AND r.superseded_at IS NULL ORDER BY r.created_at ASC LIMIT 50").all();
      return json({items:rows.results||[]});
    }
    if(path.match(/^\/articles\/\d+\/revisions$/) && request.method === 'GET') {
      await ensureEditorialTables(env); const id=Number(path.split('/')[2]); if(!Number.isInteger(id)||id<1) return json({error:'Invalid article ID.'},400);
      const database=await d1(env); const rows=await database.prepare('SELECT id,article_id,revision_no,editor_id,editor_role,action,review_status,note,snapshot,created_at,superseded_at FROM article_revisions WHERE article_id=? ORDER BY revision_no DESC').bind(id).all();
      return json({revisions:rows.results||[]});
    }
    if(path.match(/^\/articles\/\d+\/(approve|request-changes)$/) && request.method === 'POST') {
      await ensureEditorialTables(env); const parts=path.split('/'); const id=Number(parts[2]); const action=parts[3]; const database=await d1(env);
      const row=await database.prepare('SELECT a.*,c.display_name AS author_name FROM articles a LEFT JOIN creators c ON c.id=a.author_id WHERE a.id=? LIMIT 1').bind(id).first();
      if(!row) return json({error:'Article not found.'},404);
      const body=await request.json().catch(()=>({})); const note=String(body.note||'').trim(); const now=new Date().toISOString();
      const pending=await database.prepare("SELECT id FROM article_revisions WHERE article_id=? AND review_status='pending' AND superseded_at IS NULL ORDER BY revision_no DESC LIMIT 1").bind(id).first();
      if(!pending) return json({error:'No pending review exists for this article.'},409);
      if(action==='approve'){
        await database.prepare("UPDATE articles SET status='published',published_at=COALESCE(published_at,?),updated_at=?,deleted_at=NULL WHERE id=?").bind(now,now,id).run();
        await database.prepare("UPDATE article_revisions SET review_status='approved',note=?,superseded_at=NULL WHERE id=?").bind(note,pending.id).run();
        const fresh=await database.prepare('SELECT a.*,c.display_name AS author_name FROM articles a LEFT JOIN creators c ON c.id=a.author_id WHERE a.id=? LIMIT 1').bind(id).first();
        await syncPublishedArticle(env,{id:fresh.id,slug:fresh.slug,title:fresh.title,subtitle:fresh.subtitle,description:fresh.description,excerpt:fresh.excerpt,type:fresh.type,category:fresh.category,author:fresh.author_name||'TanzimFC',status:fresh.status,createdBy:fresh.author_name||'TanzimFC',createdAt:fresh.created_at,updatedAt:fresh.updated_at,publishedAt:fresh.published_at,image:fresh.feature_image,imageAlt:fresh.image_alt,imageCaption:fresh.image_caption,thumbnail:fresh.thumbnail,tags:JSON.parse(fresh.tags||'[]'),relatedPlayers:JSON.parse(fresh.related_players||'[]'),relatedEvents:JSON.parse(fresh.related_events||'[]'),relatedArticles:JSON.parse(fresh.related_articles||'[]'),relatedTools:JSON.parse(fresh.related_tools||'[]'),relatedCodes:JSON.parse(fresh.related_codes||'[]'),featured:Boolean(fresh.featured),readingTime:fresh.reading_time,seoTitle:fresh.seo_title,seoDescription:fresh.seo_description,canonicalUrl:fresh.canonical_url,sources:JSON.parse(fresh.sources||'[]'),factStatus:fresh.fact_status,lastReviewed:fresh.last_reviewed,series:fresh.series,body:fresh.content});
        return json({ok:true,action:'approved'});
      }
      await database.prepare("UPDATE articles SET status='draft',updated_at=? WHERE id=?").bind(now,id).run();
      await database.prepare("UPDATE article_revisions SET review_status='changes_requested',note=? WHERE id=?").bind(note,pending.id).run();
      return json({ok:true,action:'changes_requested'});
    }
    if(path === '/articles' && request.method === 'GET') {
      const database=await d1(env);
      const rows=await database.prepare(`SELECT a.*, c.display_name AS author_name
        FROM articles a LEFT JOIN creators c ON c.id=a.author_id
        WHERE a.deleted_at IS NULL
        ORDER BY COALESCE(a.updated_at,a.created_at) DESC`).all();
      return json({articles:(rows.results||[]).map(articleRow)});
    }
    if(path === '/articles' && request.method === 'POST') {
      const input=await request.json();
      const title=String(input.title||'').trim();
      const slug=articleSlug(input.slug||title);
      if(!title||!slug) throw new Error('Article title is required.');
      const database=await d1(env);
      const now=new Date().toISOString();
      const status=['draft','review','published','archived'].includes(input.status)?input.status:'draft';
      const tags=JSON.stringify(Array.isArray(input.tags)?input.tags:[]);
      const body=String(input.body||'');
      const description=String(input.description||input.excerpt||'');
      let current=null;
      if(input.id && Number.isInteger(Number(input.id))) current=await database.prepare('SELECT * FROM articles WHERE id=? LIMIT 1').bind(Number(input.id)).first();
      if(!current) current=await database.prepare('SELECT * FROM articles WHERE slug=? LIMIT 1').bind(slug).first();
      const authorId=input.authorId && Number.isInteger(Number(input.authorId)) ? Number(input.authorId) : (current?.author_id||null);
      if(current) {
        const conflict=await database.prepare('SELECT id FROM articles WHERE slug=? AND id!=? LIMIT 1').bind(slug,current.id).first();
        if(conflict) throw new Error('An article with this slug already exists.');
        await database.prepare(`UPDATE articles SET slug=?,title=?,subtitle=?,description=?,excerpt=?,content=?,type=?,category=?,author_id=?,status=?,feature_image=?,image_alt=?,image_caption=?,thumbnail=?,featured=?,reading_time=?,related_players=?,related_events=?,related_articles=?,related_tools=?,related_codes=?,tags=?,sources=?,fact_status=?,last_reviewed=?,seo_title=?,seo_description=?,canonical_url=?,series=?,published_at=?,deleted_at=NULL,updated_at=? WHERE id=?`)
          .bind(slug,title,String(input.subtitle||''),description,description,body,String(input.type||current.type||'guide'),String(input.category||current.category||'Guides'),authorId,status,String(input.image||current.feature_image||''),String(input.imageAlt||current.image_alt||''),String(input.imageCaption||current.image_caption||''),String(input.thumbnail||current.thumbnail||''),input.featured?1:0,Number(input.readingTime||current.reading_time||1),JSON.stringify(input.relatedPlayers||JSON.parse(current.related_players||'[]')),JSON.stringify(input.relatedEvents||JSON.parse(current.related_events||'[]')),JSON.stringify(input.relatedArticles||JSON.parse(current.related_articles||'[]')),JSON.stringify(input.relatedTools||JSON.parse(current.related_tools||'[]')),JSON.stringify(input.relatedCodes||JSON.parse(current.related_codes||'[]')),tags,JSON.stringify(input.sources||JSON.parse(current.sources||'[]')),String(input.factStatus||current.fact_status||'verified'),String(input.lastReviewed||current.last_reviewed||''),String(input.seoTitle||title),String(input.seoDescription||description),String(input.canonicalUrl||current.canonical_url||''),String(input.series||current.series||''),status==='published'?(current.published_at||now):null,now,current.id).run();
        if(status==='published') {
          const row=await database.prepare('SELECT a.*, c.display_name AS author_name FROM articles a LEFT JOIN creators c ON c.id=a.author_id WHERE a.id=? LIMIT 1').bind(current.id).first();
          await syncPublishedArticle(env,{id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle,description:row.description,excerpt:row.excerpt,type:row.type,category:row.category,author:row.author_name||'TanzimFC',status:row.status,createdBy:row.author_name||'TanzimFC',createdAt:row.created_at,updatedAt:row.updated_at,publishedAt:row.published_at,image:row.feature_image,imageAlt:row.image_alt,imageCaption:row.image_caption,thumbnail:row.thumbnail,tags:JSON.parse(row.tags||'[]'),relatedPlayers:JSON.parse(row.related_players||'[]'),relatedEvents:JSON.parse(row.related_events||'[]'),relatedArticles:JSON.parse(row.related_articles||'[]'),relatedTools:JSON.parse(row.related_tools||'[]'),relatedCodes:JSON.parse(row.related_codes||'[]'),featured:Boolean(row.featured),readingTime:row.reading_time,seoTitle:row.seo_title,seoDescription:row.seo_description,canonicalUrl:row.canonical_url,sources:JSON.parse(row.sources||'[]'),factStatus:row.fact_status,lastReviewed:row.last_reviewed,series:row.series,body:row.content});
        }
        if(current.status==='published' && status!=='published') await removePublishedArticle(env,current.slug);
        if(current.status==='published' && status==='published' && current.slug!==slug) await removePublishedArticle(env,current.slug);
        const savedRow=await database.prepare('SELECT * FROM articles WHERE id=? LIMIT 1').bind(current.id).first();
        await createRevision(env,savedRow,{editorRole:'admin',action:status==='published'?'publish':status==='review'?'submit':'save',reviewStatus:status==='review'?'pending':status==='published'?'approved':'draft'});
        return json({ok:true,articleId:current.id,slug,action:'updated'});
      }
      const result=await database.prepare(`INSERT INTO articles (slug,title,subtitle,description,excerpt,content,type,category,author_id,status,feature_image,image_alt,image_caption,thumbnail,featured,reading_time,related_players,related_events,related_articles,related_tools,related_codes,tags,sources,fact_status,last_reviewed,seo_title,seo_description,canonical_url,series,published_at,owner_id,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(slug,title,String(input.subtitle||''),description,description,body,String(input.type||'guide'),String(input.category||'Guides'),authorId,status,String(input.image||''),String(input.imageAlt||''),String(input.imageCaption||''),String(input.thumbnail||''),input.featured?1:0,Number(input.readingTime||1),JSON.stringify(input.relatedPlayers||[]),JSON.stringify(input.relatedEvents||[]),JSON.stringify(input.relatedArticles||[]),JSON.stringify(input.relatedTools||[]),JSON.stringify(input.relatedCodes||[]),tags,JSON.stringify(input.sources||[]),String(input.factStatus||'verified'),String(input.lastReviewed||''),String(input.seoTitle||title),String(input.seoDescription||description),String(input.canonicalUrl||''),String(input.series||''),status==='published'?now:null,null,now,now).run();
      if(status==='published') {
        const id=result.meta?.last_row_id;
        const row=await database.prepare('SELECT a.*, c.display_name AS author_name FROM articles a LEFT JOIN creators c ON c.id=a.author_id WHERE a.id=? LIMIT 1').bind(id).first();
        await syncPublishedArticle(env,{id:row.id,slug:row.slug,title:row.title,subtitle:row.subtitle,description:row.description,excerpt:row.excerpt,type:row.type,category:row.category,author:row.author_name||'TanzimFC',status:row.status,createdBy:row.author_name||'TanzimFC',createdAt:row.created_at,updatedAt:row.updated_at,publishedAt:row.published_at,image:row.feature_image,imageAlt:row.image_alt,imageCaption:row.image_caption,thumbnail:row.thumbnail,tags:JSON.parse(row.tags||'[]'),relatedPlayers:JSON.parse(row.related_players||'[]'),relatedEvents:JSON.parse(row.related_events||'[]'),relatedArticles:JSON.parse(row.related_articles||'[]'),relatedTools:JSON.parse(row.related_tools||'[]'),relatedCodes:JSON.parse(row.related_codes||'[]'),featured:Boolean(row.featured),readingTime:row.reading_time,seoTitle:row.seo_title,seoDescription:row.seo_description,canonicalUrl:row.canonical_url,sources:JSON.parse(row.sources||'[]'),factStatus:row.fact_status,lastReviewed:row.last_reviewed,series:row.series,body:row.content});
      }
      const createdRow=await database.prepare('SELECT * FROM articles WHERE id=? LIMIT 1').bind(result.meta?.last_row_id).first();
      await createRevision(env,createdRow,{editorRole:'admin',action:status==='published'?'publish':status==='review'?'submit':'save',reviewStatus:status==='review'?'pending':status==='published'?'approved':'draft'});
      return json({ok:true,articleId:result.meta?.last_row_id,slug,action:'created'});
    }
    if(path === '/fc-mobile-27' && request.method === 'GET') {
      return json({content:parseFcMobile27((await repoFile(env,'src/data/fcMobile27.js')).text)});
    }
    if(path === '/fc-mobile-27' && request.method === 'POST') {
      const input=await request.json().catch(()=>({}));
      const content=parseFcMobile27((await repoFile(env,'src/data/fcMobile27.js')).text);
      const release=input.release;
      if(input.action==='create') {
        if(!release || !release.title) throw new Error('Release data is required.');
        release.id=String(release.id||release.releaseDate||Date.now());
        content.releases=content.releases.filter(x=>x.id!==release.id);
        content.releases.forEach(x=>{x.status='active';});
        release.status='latest';
        content.releases.unshift(release);
      } else if(input.action==='update') {
        if(!release || !release.id) throw new Error('Release ID is required.');
        const index=content.releases.findIndex(x=>x.id===release.id);
        if(index<0) throw new Error('Release not found.');
        if(release.status==='latest') content.releases.forEach(x=>{x.status=x.id===release.id?'latest':'active';});
        content.releases[index]={...content.releases[index],...release};
      } else throw new Error('Unknown FC Mobile 27 action.');
      validateFcMobile27(content);
      const file=await repoFile(env,'src/data/fcMobile27.js');
      const commitSha=await writeRepoFile(env,'src/data/fcMobile27.js',fcMobile27Text(content),file.sha,'admin: update FC Mobile 27 APK release');
      return json({ok:true,commitSha,content});
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
  const hostHeader=(request.headers.get('host')||'').split(':')[0].toLowerCase();

  // Permanently redirect every request received on the former Worker hostname.
  // Check both URL.hostname and Host because the Worker may receive a normalized host.
  if(url.hostname === 'tanzimfc.fcmobiletools.workers.dev' || hostHeader === 'tanzimfc.fcmobiletools.workers.dev') {
    const destination='https://fcmobiletools.online' + url.pathname + url.search;
    return new Response(null,{
      status:301,
      headers:{
        location:destination,
        'cache-control':'public, max-age=3600, s-maxage=3600'
      }
    });
  }

  if(url.pathname === '/players' || url.pathname.startsWith('/players/') || url.pathname === '/player' || url.pathname.startsWith('/player/')) return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
  const isAdminEntry = url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin/login' || url.pathname === '/admin/login/' || url.pathname === '/admin/login.html';
  if(url.pathname === '/api/players' || url.pathname.startsWith('/api/players/')) return json({error:'Player database is temporarily unavailable.'},404);
  if(url.pathname === '/api/football' && request.method === 'GET') {
    try {
      const file=await repoFile(env,'src/data/footballCentre.js');
      return json({content:parseFootball(file.text),updatedAt:new Date().toISOString()},{headers:{'cache-control':'no-store, max-age=0'}});
    } catch(error) {
      return json({error:error?.message||'Unable to load timing data.'},500);
    }
  }
  if(url.pathname === '/admin/fc-mobile-27.html') {
    if(await authenticated(request,env)) return env.ASSETS.fetch(request);
    return new Response('Not found',{status:404});
  }
  if(url.pathname === '/reset-center' || url.pathname === '/reset-center/') {
    return Response.redirect(new URL('/events/',url),301);
  }
  if(url.pathname === '/team-ovr' || url.pathname === '/team-ovr/') {
    const assetUrl = new URL('/team-ovr/', url);
    assetUrl.searchParams.set('_fcmtools_build', '2026-09-29-ovr-fix');
    const asset=await env.ASSETS.fetch(new Request(assetUrl,{method:'GET',headers:request.headers}));
    if(!asset.ok) return asset;
    const headers=new Headers(asset.headers);
    headers.set('cache-control','no-store, max-age=0, must-revalidate');
    headers.set('x-fcmobiletools-page','team-ovr-live');
    return new Response(await asset.arrayBuffer(),{status:asset.status,statusText:asset.statusText,headers});
  }
  if(url.pathname === '/events' || url.pathname === '/events/') {
    const asset=await env.ASSETS.fetch(new Request(new URL('/events/',url),{method:'GET',headers:request.headers}));
    if(!asset.ok) return asset;
    const headers=new Headers(asset.headers);
    headers.set('cache-control','no-store, max-age=0, must-revalidate');
    headers.set('x-fcmobiletools-page','events-reset-live');
    return new Response(await asset.arrayBuffer(),{status:asset.status,statusText:asset.statusText,headers});
  }
  if(url.pathname.startsWith('/api/admin/')) return api(request,env,url.pathname.slice('/api/admin'.length));
  if(isAdminEntry) {
    if(await authenticated(request,env) || await creatorAuthenticated(request,env)) return adminDashboard(request,env,url);
    return new Response(ADMIN_LOGIN_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  if(url.pathname.startsWith('/admin/')) {
    if(await authenticated(request,env)) return env.ASSETS.fetch(request);
    const creator=await creatorAuthenticated(request,env);
    if(creator && url.pathname === '/admin/dashboard.html') return env.ASSETS.fetch(request);
    return new Response('Not found',{status:404});
  }
  return env.ASSETS.fetch(request);
} };
