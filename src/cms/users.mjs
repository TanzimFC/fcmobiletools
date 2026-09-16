import { Octokit } from 'octokit';
const OWNER='TanzimFC',REPO='fcmobiletools',BRANCH='main',PATH='src/data/cms-users.json';
const api=env=>new Octokit({auth:env.GITHUB_TOKEN});
const b64=s=>{let x='';for(const b of new TextEncoder().encode(s))x+=String.fromCharCode(b);return btoa(x)};
const dec=s=>{const x=atob(String(s).replace(/\n/g,''));return new TextDecoder().decode(Uint8Array.from(x,c=>c.charCodeAt(0)))};
async function getFile(env){const r=await api(env).request('GET /repos/{owner}/{repo}/contents/{path}',{owner:OWNER,repo:REPO,path:PATH,ref:BRANCH,headers:{'x-github-api-version':'2022-11-28'}});return {sha:r.data.sha,users:JSON.parse(dec(r.data.content))}}
function clean(u){return {username:String(u.username||'').trim(),displayName:String(u.displayName||u.username||'').trim(),role:['writer','editor','owner'].includes(u.role)?u.role:'writer',active:u.active!==false,passwordHash:String(u.passwordHash||'')}}
export async function listUsers(env){return (await getFile(env)).users.map(clean)}
export async function findUser(env,username){return (await listUsers(env)).find(u=>u.username===String(username).trim()&&u.active)}
export async function saveUsers(env,users,sha,message){return (await api(env).rest.repos.createOrUpdateFileContents({owner:OWNER,repo:REPO,path:PATH,message,content:b64(JSON.stringify(users.map(clean),null,2)+'\n'),branch:BRANCH,sha})).data}
export async function mutateUsers(env,mutator,message){const x=await getFile(env),users=x.users.map(clean);const next=await mutator(users);return {users:next,result:await saveUsers(env,next,x.sha,message)}}
function enc(v){const b=typeof v==='string'?new TextEncoder().encode(v):v;let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function dec64(v){v=v.replaceAll('-','+').replaceAll('_','/');v+='='.repeat((4-v.length%4)%4);const s=atob(v);return Uint8Array.from(s,c=>c.charCodeAt(0))}
export async function hashPassword(pass){const salt=crypto.getRandomValues(new Uint8Array(16));const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(pass)),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},key,256);return `pbkdf2$210000$${enc(salt)}$${enc(new Uint8Array(bits))}`}
export async function verifyPassword(pass,stored){const p=String(stored||'').split('$');if(p.length!==4||p[0]!=='pbkdf2')return false;const it=Number(p[1]);if(!Number.isSafeInteger(it)||it<100000)return false;try{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(pass)),'PBKDF2',false,['deriveBits']);const salt=dec64(p[2]),expected=dec64(p[3]);if(expected.length!==32)return false;const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:it,hash:'SHA-256'},key,256));return enc(actual)===enc(expected)}catch{return false}}
