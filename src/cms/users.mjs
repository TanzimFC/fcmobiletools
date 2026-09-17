import { Octokit } from 'octokit';
const OWNER='TanzimFC',REPO='fcmobiletools',BRANCH='main',PATH='src/data/cms-users.json';
const api=env=>new Octokit({auth:env.GITHUB_TOKEN});
const dec=s=>new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\n/g,'')),c=>c.charCodeAt(0)));
const clean=u=>({username:String(u.username||'').trim().toLowerCase(),displayName:String(u.displayName||u.username||'').trim(),role:['writer','editor','owner'].includes(String(u.role))?String(u.role):'writer',active:u.active!==false,passwordHash:String(u.passwordHash||''),sessionVersion:Number(u.sessionVersion)>0?Number(u.sessionVersion):1,createdAt:String(u.createdAt||''),updatedAt:String(u.updatedAt||'')});
let cache={at:0,users:null};
async function getFile(env){if(cache.users&&Date.now()-cache.at<15000)return cache.users;const r=await api(env).request('GET /repos/{owner}/{repo}/contents/{path}',{owner:OWNER,repo:REPO,path:PATH,ref:BRANCH,headers:{'x-github-api-version':'2022-11-28'}});cache={at:Date.now(),users:JSON.parse(dec(r.data.content)).map(clean)};return cache.users}
export async function listUsers(env){return(await getFile(env)).map(clean)}
export async function findUser(env,username){return(await listUsers(env)).find(u=>u.username===String(username).trim().toLowerCase()&&u.active)}
const dec64=v=>{v=v.replaceAll('-','+').replaceAll('_','/');v+='='.repeat((4-v.length%4)%4);return Uint8Array.from(atob(v),c=>c.charCodeAt(0))};
const enc=v=>{const b=typeof v==='string'?new TextEncoder().encode(v):v;let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')};
export async function hashPassword(pass){const salt=crypto.getRandomValues(new Uint8Array(16)),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(pass)),'PBKDF2',false,['deriveBits']),bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},key,256);return`pbkdf2$100000$${enc(salt)}$${enc(new Uint8Array(bits))}`}
export async function verifyPassword(pass,stored){const p=String(stored||'').split('$');if(p.length!==4||p[0]!=='pbkdf2')return false;try{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(pass)),'PBKDF2',false,['deriveBits']),salt=dec64(p[2]),expected=dec64(p[3]),actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:Number(p[1]),hash:'SHA-256'},key,256));return enc(actual)===enc(expected)}catch{return false}}
