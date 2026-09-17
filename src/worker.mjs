const SESSION_COOKIE = 'fcm_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 8;

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

const ADMIN_LOGIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>FC Mobile Tools Admin</title><style>@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&display=swap');:root{--bg:#090b0d;--panel:#111619;--line:#293033;--text:#f6f3ea;--muted:#8f9893;--lime:#c9f56a;--lav:#aa91ff;--coral:#ff7e6d;--mono:'IBM Plex Mono',monospace;--sans:'Manrope',system-ui,sans-serif;--display:'Sora',system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(700px 450px at 12% 2%,#aa91ff1d,transparent 60%),radial-gradient(680px 480px at 92% 8%,#c9f56a16,transparent 58%),#090b0d;color:var(--text);font-family:var(--sans);overflow:hidden}body:before{content:"";position:fixed;inset:0;background-image:linear-gradient(#ffffff03 1px,transparent 1px),linear-gradient(90deg,#ffffff03 1px,transparent 1px);background-size:46px 46px;mask-image:linear-gradient(to bottom,black,transparent 88%);pointer-events:none}.shell{width:min(440px,100%);position:relative}.orb{position:absolute;border-radius:50%;filter:blur(52px);pointer-events:none}.orb-a{width:150px;height:150px;background:var(--lav);top:-65px;left:-65px;opacity:.18}.orb-b{width:130px;height:130px;background:var(--coral);right:-55px;bottom:-60px;opacity:.12}.card{position:relative;padding:28px;border:1px solid #2a3336;border-radius:25px;background:linear-gradient(145deg,#121719f2,#0b1012ee);box-shadow:0 35px 110px #000c}.brand{display:flex;align-items:center;gap:11px}.mark{width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,var(--lime),#efffb7);color:#11160c;font:800 11px var(--mono);box-shadow:0 0 38px #c9f56a19}.brand b{display:block;font:700 15px var(--display);letter-spacing:-.025em}.brand small{display:block;margin-top:2px;color:#68736d;font-size:9px}.eyebrow{display:flex;align-items:center;gap:8px;margin-top:28px;color:var(--lime);font:700 7px var(--mono);letter-spacing:.15em}.eyebrow i{width:20px;height:1px;background:linear-gradient(90deg,var(--lime),transparent)}h1{font:700 35px/1.02 var(--display);letter-spacing:-.05em;margin:10px 0 8px}p{margin:0;color:var(--muted);font-size:10px;line-height:1.7}.field{display:block;margin-top:17px}.field span{display:block;margin-bottom:7px;color:#c8d0cb;font-size:9px;font-weight:700}input,button{width:100%;padding:12px 13px;border-radius:11px;border:1px solid #2c3538;background:#090e10;color:#f5f8f4;font:600 10px var(--sans);outline:0}input:focus{border-color:#7d9b45;box-shadow:0 0 0 3px #c9f56a10}button{margin-top:18px;border-color:#b8df5d;background:linear-gradient(135deg,var(--lime),#efffb7);color:#11160c;font:800 9px var(--mono);cursor:pointer;box-shadow:0 14px 35px #c9f56a10}button:disabled{opacity:.6;cursor:wait}.error{min-height:20px;margin-top:12px;color:#ff9f95;font:700 8px var(--mono)}.hint{margin-top:18px;padding-top:16px;border-top:1px solid #232b2e;color:#68736e;font-size:8px}.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.chip{padding:7px 8px;border:1px solid #293235;border-radius:999px;background:#0b1012;color:#74807a;font:700 7px var(--mono)}@media(max-width:520px){.card{padding:23px}.shell{max-width:390px}h1{font-size:31px}}</style></head><body><div class="shell"><div class="orb orb-a"></div><div class="orb orb-b"></div><form class="card" id="login"><div class="brand"><div class="mark">FC</div><div><b>FC Mobile Tools</b><small>Private admin workspace</small></div></div><div class="eyebrow"><i></i> SECURE ENTRY</div><h1>Welcome back</h1><p>Sign in to manage redeem codes, Football Centre content and the shared media library</p><label class="field"><span>Username</span><input name="username" autocomplete="username" required></label><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label><button id="submit" type="submit">Enter workspace</button><div class="error" id="error" role="alert"></div><div class="hint">Admin access only<div class="chips"><span class="chip">CONTENT</span><span class="chip">FOOTBALL</span><span class="chip">MEDIA</span></div></div></form></div><script>const form=document.getElementById('login'),error=document.getElementById('error'),submit=document.getElementById('submit');form.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';submit.disabled=true;submit.textContent='Opening workspace…';try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(Object.fromEntries(new FormData(form)))});const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Sign in failed');location.replace('/admin/')}catch(x){error.textContent=x.message;submit.disabled=false;submit.textContent='Enter workspace'}})</script></body></html>`;

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
      const file=await repoFile(env,'src/data/redeemCodes.js'); const codes=parseRedeem(file.text); const i=codes.findIndex(x=>String(x.code).toUpperCase()===code.code); if(i>=0) codes[i]=code; else codes.unshift(code);
      const commitSha=await writeRepoFile(env,'src/data/redeemCodes.js',redeemText(codes),file.sha,`admin: update redeem code ${code.code}`); return json({ok:true,commitSha,action:i>=0?'updated':'created'});
    }
    if(path === '/football' && request.method === 'GET') return json({content:parseFootball((await repoFile(env,'src/data/footballCentre.js')).text)});
    if(path === '/football' && request.method === 'POST') { const {content}=await request.json(); validateFootball(content); const file=await repoFile(env,'src/data/footballCentre.js'); const text=`// Football Centre content managed by the admin panel.\n// Keep this file JSON-compatible because the Worker reads and validates it before committing updates.\nexport const FOOTBALL_CENTRE_CONTENT = ${JSON.stringify(content,null,2)};\n`; const commitSha=await writeRepoFile(env,'src/data/footballCentre.js',text,file.sha,'admin: update Football Centre content'); return json({ok:true,commitSha}); }
    if(path === '/media/sign' && request.method === 'GET') { if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary is not fully configured in the Worker.'); const timestamp=Math.floor(Date.now()/1000),folder=env.CLOUDINARY_FOLDER||'fc-mobile-tools'; const digest=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`)); return json({cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,timestamp,folder,signature:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')}); }
    if(path === '/media' && request.method === 'GET') { if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET) throw new Error('Cloudinary is not fully configured in the Worker.'); const auth=btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`), r=await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?max_results=100`,{headers:{authorization:`Basic ${auth}`}}), body=await r.json(); if(!r.ok) throw new Error(body?.error?.message||`Cloudinary request failed (${r.status}).`); return json({resources:(body.resources||[]).map(x=>({publicId:x.public_id,url:x.secure_url,width:x.width,height:x.height,bytes:x.bytes,format:x.format,createdAt:x.created_at}))}); }
    return json({error:'Admin endpoint not found.'},404);
  } catch(error) { return json({error:error?.message||'Admin operation failed.'},500); }
}

export default { async fetch(request,env) {
  const url=new URL(request.url);
  const isAdminEntry = url.pathname === '/admin' || url.pathname === '/admin/' || url.pathname === '/admin/login' || url.pathname === '/admin/login/' || url.pathname === '/admin/login.html';
  if(url.pathname.startsWith('/api/admin/')) return api(request,env,url.pathname.slice('/api/admin'.length));
  if(isAdminEntry) {
    if(await authenticated(request,env)) return env.ASSETS.fetch(new Request(new URL('/admin/dashboard.html',url),{method:'GET',headers:request.headers}));
    return new Response(ADMIN_LOGIN_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  if(url.pathname.startsWith('/admin/')) {
    if(!(await authenticated(request,env))) return new Response('Not found',{status:404});
    return env.ASSETS.fetch(request);
  }
  return env.ASSETS.fetch(request);
} };