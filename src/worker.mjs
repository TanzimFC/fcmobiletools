const SESSION_COOKIE = 'fcm_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 8;

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

const ADMIN_LOGIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>FC Mobile Tools Admin</title><style>body{margin:0;background:#0b1020;color:#fff;font:16px system-ui;display:grid;place-items:center;min-height:100vh}form{width:min(380px,90vw);padding:28px;background:#151c30;border:1px solid #2a3550;border-radius:16px}input,button{width:100%;box-sizing:border-box;padding:12px;margin-top:8px;border-radius:9px;border:1px solid #394764;background:#0d1426;color:#fff}button{margin-top:18px;background:#fff;color:#111;font-weight:700;cursor:pointer}.error{color:#ff8585;min-height:20px;margin-top:10px}</style></head><body><form id="login"><h1>Admin sign in</h1><label>Username<input name="username" autocomplete="username" required></label><br><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button id="submit">Sign in</button><div class="error" id="error"></div></form><script>login.addEventListener('submit',async e=>{e.preventDefault();error.textContent='';submit.disabled=true;try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(Object.fromEntries(new FormData(login)))});const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Sign-in failed.');location.replace('/admin/')}catch(x){error.textContent=x.message;submit.disabled=false}})</script></body></html>`;

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
  const body = text ? JSON.parse(text) : null;
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
      const commitSha=await writeRepoFile(env,'src/data/redeemCodes.js',redeemText(codes),file.sha,`admin: update redeem code ${code.code}`); return json({ok:true,commitSha});
    }
    if(path === '/football' && request.method === 'GET') { const file=await repoFile(env,'src/data/footballCentre.js'); const match=file.text.match(/export const FOOTBALL_CENTRE_CONTENT = ([\s\S]+);\s*$/); if(!match) throw new Error('Football Centre data file has an unexpected format.'); return json({content:JSON.parse(match[1])}); }
    if(path === '/football' && request.method === 'POST') { const {content}=await request.json(); if(!content?.clubs || !Array.isArray(content.matches) || !content.videoEmbedUrl || !content.videoWatchUrl) throw new Error('Football Centre content is incomplete.'); for(const club of Object.values(content.clubs)) if(!club.name || !club.short || !club.logo) throw new Error('Every club needs a name, short name, and logo URL.'); const file=await repoFile(env,'src/data/footballCentre.js'); const text=`// Football Centre content managed by the admin panel.\nexport const FOOTBALL_CENTRE_CONTENT = ${JSON.stringify(content,null,2)};\n`; const commitSha=await writeRepoFile(env,'src/data/footballCentre.js',text,file.sha,'admin: update Football Centre content'); return json({ok:true,commitSha}); }
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
