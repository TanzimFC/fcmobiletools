const TOURNAMENT_COOKIE='fcm_tournament_session';
const SESSION_MAX_AGE=60*60*8;
const DEFAULT_SUPABASE_URL='https://moczgrwxtfexdbjthxpd.supabase.co';

const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}
});

function b64(value){return btoa(String.fromCharCode(...new TextEncoder().encode(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function ub64(value){return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0)));}

async function sign(secret,value){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}

function supabaseConfig(env){
  const base=String(env.SUPABASE_URL||DEFAULT_SUPABASE_URL).replace(/\/$/,'');
  const key=String(env.SUPABASE_SECRET_KEY||'').trim();
  if(!key) throw new Error('SUPABASE_SECRET_KEY is not configured.');
  return {base,key};
}
async function sb(env,path,options={}){
  const {base,key}=supabaseConfig(env);
  const r=await fetch(base+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});
  const text=await r.text(); let body=null; try{body=text?JSON.parse(text):null}catch{throw new Error('Supabase returned invalid JSON.')}
  if(!r.ok) throw new Error(body?.message||body?.details||body?.hint||'Supabase request failed.');
  return body;
}
async function rpc(env,name,args){return sb(env,'rpc/'+name,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(args)});}

async function verifyAdmin(request,env){
  if(!env.ADMIN_SESSION_SECRET)return null;
  const match=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('fcm_admin_session='));
  if(!match)return null;
  try{
    const token=match.slice('fcm_admin_session='.length),dot=token.indexOf('.');
    if(dot<1)return null;
    const payload=ub64(token.slice(0,dot)),signature=token.slice(dot+1);
    const sep=payload.lastIndexOf('|'),username=sep>0?payload.slice(0,sep):'',exp=sep>0?Number(payload.slice(sep+1)):0;
    if(!username||!exp||exp<=Date.now()||username!==String(env.ADMIN_USERNAME||'').trim())return null;
    if(signature!==await sign(env.ADMIN_SESSION_SECRET,payload))return null;
    return {role:'admin',username,actorKey:'admin'};
  }catch{return null;}
}
async function verifyTournamentSession(request,env){
  if(!env.ADMIN_SESSION_SECRET)return null;
  const match=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(TOURNAMENT_COOKIE+'='));
  if(!match)return null;
  try{
    const token=match.slice((TOURNAMENT_COOKIE+'=').length),dot=token.indexOf('.');
    if(dot<1)return null;
    const payload=ub64(token.slice(0,dot)),signature=token.slice(dot+1);
    if(signature!==await sign(env.ADMIN_SESSION_SECRET,payload))return null;
    const data=JSON.parse(payload);
    if(!data?.username||!data?.role||data.exp<=Date.now()||!['admin','organizer'].includes(data.role))return null;
    if(data.role==='admin'&&data.username!==String(env.ADMIN_USERNAME||'').trim())return null;
    if(data.role==='organizer'&&data.username!==String(env.TOURNAMENT_USERNAME||'').trim())return null;
    return {role:data.role,username:data.username,actorKey:data.role==='admin'?'admin':'organizer'};
  }catch{return null;}
}
async function identity(request,env){return (await verifyAdmin(request,env))||await verifyTournamentSession(request,env);}

async function makeSession(env,role,username){
  const payload=JSON.stringify({role,username,exp:Date.now()+SESSION_MAX_AGE*1000});
  return b64(payload)+'.'+await sign(env.ADMIN_SESSION_SECRET,payload);
}
async function makeAdminCompatSession(env,username){
  const payload=username+'|'+(Date.now()+SESSION_MAX_AGE*1000);
  return b64(payload)+'.'+await sign(env.ADMIN_SESSION_SECRET,payload);
}

function slugify(value){
  return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'tournament';
}
function normalizeTournament(row,players=[],matches=[]){
  const p=players.filter(x=>Number(x.tournament_id)===Number(row.id)).sort((a,b)=>a.slot-b.slot);
  const ms=matches.filter(x=>Number(x.tournament_id)===Number(row.id)).sort((a,b)=>a.round_number-b.round_number||a.match_number-b.match_number);
  const byId=new Map(p.map(x=>[Number(x.id),x]));
  const rounds=[];
  for(const m of ms){
    let round=rounds.find(x=>x.number===m.round_number);
    if(!round){round={number:m.round_number,name:m.round_number===1?'Round of '+row.format/2:m.round_number===Math.log2(row.format)?'Final':'Round '+m.round_number,matches:[]};rounds.push(round);}
    round.matches.push({id:m.id,matchNumber:m.match_number,status:m.status,player1:byId.get(Number(m.player1_id))?{id:m.player1_id,displayName:byId.get(Number(m.player1_id)).display_name,playerTag:byId.get(Number(m.player1_id)).player_tag}:null,player2:byId.get(Number(m.player2_id))?{id:m.player2_id,displayName:byId.get(Number(m.player2_id)).display_name,playerTag:byId.get(Number(m.player2_id)).player_tag}:null,player1Score:m.player1_score,player2Score:m.player2_score,winner:m.winner_player_id?{id:m.winner_player_id}:null});
  }
  const final=ms.length?ms.reduce((a,b)=>b.round_number>a.round_number?b:a):null;
  const winner=final?.winner_player_id?byId.get(Number(final.winner_player_id)):null;
  return {id:row.id,slug:row.slug,name:row.name,description:row.description,format:row.format,status:row.status,isPublic:row.is_public,startsAt:row.starts_at?new Date(row.starts_at).toISOString().slice(0,16):null,players:p.map(x=>({id:x.id,slot:x.slot,seed:x.seed,displayName:x.display_name,playerTag:x.player_tag,avatarUrl:x.avatar_url})),rounds,winner:winner?{id:winner.id,displayName:winner.display_name,playerTag:winner.player_tag}:null,publishedAt:row.published_at};
}
async function getTournament(env,id) {
  const rows = await sb(env,'tournaments?id=eq.'+encodeURIComponent(id)+'&select=*&limit=1');
  if (!rows?.[0]) return null;
  const [players,matches,stages,standings] = await Promise.all([
    sb(env,'tournament_players?tournament_id=eq.'+encodeURIComponent(id)+'&select=*&order=slot.asc'),
    sb(env,'tournament_matches?tournament_id=eq.'+encodeURIComponent(id)+'&select=*&order=matchday.asc,round_number.asc,match_number.asc'),
    sb(env,'tournament_stages?tournament_id=eq.'+encodeURIComponent(id)+'&select=*&order=stage_order.asc'),
    sb(env,'tournament_standings?tournament_id=eq.'+encodeURIComponent(id)+'&select=*&order=rank.asc,points.desc').catch(() => [])
  ]);
  const stageIds = (stages || []).map((x) => Number(x.id)).filter(Number.isInteger);
  const groups = stageIds.length
    ? await sb(env,'tournament_groups?stage_id=in.('+stageIds.join(',')+')&select=*&order=group_number.asc').catch(() => [])
    : [];
  const normalized = normalizeTournament(rows[0],players||[],matches||[],stages||[],standings||[]);
  const groupsByStage = new Map();
  for (const g of groups || []) {
    const key = Number(g.stage_id);
    if (!groupsByStage.has(key)) groupsByStage.set(key, []);
    groupsByStage.get(key).push({id:g.id,groupNumber:g.group_number,name:g.name});
  }
  normalized.stages = normalized.stages.map((s) => ({ ...s, groups: groupsByStage.get(Number(s.id)) || [] }));
  return normalized;
}

async function getTournamentBySlug(env,slug){
  const rows=await sb(env,'tournaments?slug=eq.'+encodeURIComponent(slug)+'&select=*&limit=1');
  if(!rows?.[0])return null;
  return getTournament(env,rows[0].id);
}
async function publicSnapshot(env){
  const rows=await sb(env,"tournaments?is_public=eq.true&status=in.(published,in_progress,completed)&select=*&order=updated_at.desc");
  const out=[]; for(const row of rows||[])out.push(await getTournament(env,row.id));
  return out;
}
async function github(env,path,options={}){
  const [owner,repo]=(env.GITHUB_REPO||'TanzimFC/fcmobiletools').split('/');
  if(!env.GITHUB_TOKEN)throw new Error('GITHUB_TOKEN is not configured.');
  const r=await fetch('https://api.github.com/repos/'+owner+'/'+repo+'/'+path,{...options,headers:{accept:'application/vnd.github+json',authorization:'Bearer '+env.GITHUB_TOKEN,'x-github-api-version':'2022-11-28','user-agent':'FC-Mobile-Tools-Tournaments',...(options.headers||{})}});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{throw new Error('GitHub returned invalid JSON.')}
  if(!r.ok)throw new Error(body?.message||'GitHub request failed.');
  return body;
}
function encodeGithub(value){return btoa(String.fromCharCode(...new TextEncoder().encode(value)));}
async function publishSnapshot(env){
  const snapshot=await publicSnapshot(env);
  const source='// Generated by the FCMOBILETOOLS Tournament Organizer.\nexport const TOURNAMENT_PUBLICATIONS = '+JSON.stringify(snapshot,null,2)+';\n';
  const file=await github(env,'contents/src/data/tournaments.js?ref=main');
  const body=await github(env,'contents/src/data/tournaments.js',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({message:'tournament: publish public tournament snapshot',content:encodeGithub(source),sha:file.sha,branch:'main'})});
  const commitSha=body.commit?.sha||null;
  for(const t of snapshot){
    await sb(env,'tournament_publications',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{tournament_id:t.id,git_commit_sha:commitSha,published_at:new Date().toISOString(),updated_at:new Date().toISOString()}])});
    await sb(env,'tournaments?id=eq.'+t.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:t.status==='completed'?'completed':'published',published_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
  }
  return {commitSha,count:snapshot.length};
}
const LOGIN_HTML=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Tournament Organizer · FCMOBILETOOLS</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071018;color:#f5f8fb;font:14px Inter,system-ui}.card{width:min(420px,calc(100% - 32px));padding:30px;border:1px solid #263b4a;border-radius:22px;background:#0f1a26;box-shadow:0 30px 90px #0008}h1{font:700 32px "Space Grotesk";letter-spacing:-.05em;margin:14px 0 8px}p{color:#8fa1b1;line-height:1.6}label{display:block;margin-top:17px;color:#b9c7d2;font-size:12px;font-weight:700}input,button{width:100%;box-sizing:border-box;margin-top:7px;padding:12px;border-radius:10px;border:1px solid #263b4a;background:#09131d;color:#f5f8fb}button{margin-top:20px;background:linear-gradient(135deg,#69ddff,#2aa8e8);border-color:#69ddff;color:#04131c;font-weight:800;cursor:pointer}#error{min-height:20px;color:#ffaaa3;margin-top:12px;font-size:12px}.hint{margin-top:18px;padding-top:16px;border-top:1px solid #263b4a;font-size:11px;color:#718497}</style></head><body><form class="card" id="form"><div style="color:#4cc9ff;font:700 10px monospace;letter-spacing:.12em">FCMOBILETOOLS · OFFICIAL TOURNAMENTS</div><h1>Tournament Organizer</h1><p>Sign in to create brackets, enter results and publish official tournament pages.</p><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button>Enter tournament dashboard</button><div id="error"></div><div class="hint">Site administrators can use their existing admin credentials here too.</div></form><script>form.onsubmit=async e=>{e.preventDefault();error.textContent='';const r=await fetch('/api/tournament/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const b=await r.json().catch(()=>({}));if(!r.ok){error.textContent=b.error||'Sign in failed';return}location.replace('/admin/tournament/')}</script></body></html>`;

export async function tournamentWorkerRoute(request,env,url){
  const path=url.pathname;
  if(path==='/api/tournament/login'&&request.method==='POST'){
    const body=await request.json().catch(()=>({})),u=String(body.username||'').trim(),p=String(body.password||'');
    const adminUser=String(env.ADMIN_USERNAME||'').trim(),adminPass=String(env.ADMIN_PASSWORD||'');
    const orgUser=String(env.TOURNAMENT_USERNAME||'').trim(),orgPass=String(env.TOURNAMENT_PASSWORD||'');
    let role=null;
    if(u&&p&&u===adminUser&&p===adminPass)role='admin';
    else if(u&&p&&u===orgUser&&p===orgPass)role='organizer';
    if(!role)return json({error:'Invalid username or password.'},401);
    if(!env.ADMIN_SESSION_SECRET)return json({error:'Tournament session signing is not configured.'},503);
    const token=await makeSession(env,role,u);
    const cookies=[
      TOURNAMENT_COOKIE+'='+token+'; Path=/; Max-Age='+SESSION_MAX_AGE+'; HttpOnly; Secure; SameSite=Lax'
    ];
    if(role==='admin'){
      const adminToken=await makeAdminCompatSession(env,u);
      cookies.push('fcm_admin_session='+adminToken+'; Path=/; Max-Age='+SESSION_MAX_AGE+'; HttpOnly; Secure; SameSite=Lax');
    }
    return json({ok:true,role},200,{'set-cookie':cookies});
  }
  if(path==='/api/tournament/logout'&&request.method==='POST')return json({ok:true},200,{'set-cookie':TOURNAMENT_COOKIE+'=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'});
  if(path==='/api/tournament/public'&&request.method==='GET'){
    const t=await getTournamentBySlug(env,url.searchParams.get('slug')||''); return t&&t.isPublic?json(t):json({error:'Tournament not found.'},404);
  }
  if(path.startsWith('/api/tournament/')){
    const me=await identity(request,env);
    if(!me)return json({error:'Authentication required.'},401);
    try{
      if(path==='/api/tournament/me'&&request.method==='GET')return json(me);
      if(path==='/api/tournament/formats'&&request.method==='GET'){
        return json({formats:TOURNAMENT_FORMATS});
      }
      if(path==='/api/tournament/list'&&request.method==='GET'){
        const rows=await sb(env,'tournaments?select=*&order=updated_at.desc&limit=100');
        const list=[];for(const r of rows||[])list.push(await getTournament(env,r.id));
        return json({tournaments:list,identity:me});
      }
      if(path==='/api/tournament/save'&&request.method==='POST'){
        const input=await request.json().catch(()=>({}));
        const name=String(input.name||'').trim();
        const formatKey=String(input.formatKey||'single_elimination');
        const format=getTournamentFormat(formatKey);
        const participantCount=Number(input.participantCount);
        const players=Array.isArray(input.players)?input.players:[];
        if(!name)return json({error:'Tournament name is required.'},400);
        if(!Number.isInteger(participantCount)||participantCount<format.participantMin||participantCount>format.participantMax)return json({error:`${format.name} supports ${format.participantMin}–${format.participantMax} participants.`},400);
        if(players.length>participantCount||players.some((p,i)=>!String(p.displayName||'').trim()||Number(p.slot)!==i+1))return json({error:'Participant slots must be sequential and cannot exceed the configured participant count.'},400);
        const slug=slugify(input.slug||name);
        const payload={
          id:input.id||null,slug,name,description:String(input.description||''),format:participantCount,
          formatKey,participantCount,formatConfig:input.formatConfig||format.defaults,
          isPublic:Boolean(input.isPublic),startsAt:input.startsAt||null,ownerKey:me.actorKey,
          players:players.map((p,i)=>({slot:i+1,displayName:String(p.displayName).trim(),playerTag:String(p.playerTag||'').trim(),avatarUrl:String(p.avatarUrl||''),seed:Number(p.seed||i+1)}))
        };
        const result=await rpc(env,'save_tournament_draft',{p_payload:payload});
        const id=Array.isArray(result)?result[0]:result;
        await sb(env,'tournament_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{tournament_id:id,actor_key:me.actorKey,actor_role:me.role,action:'save',payload:{formatKey,participantCount,name}}])});
        return json({ok:true,tournament:await getTournament(env,id)});
      }
      const idMatch=path.match(/^\/api\/tournament\/(structure|result|publish)\/(\d+)$/);
      if(idMatch&&request.method==='POST'){
        const action=idMatch[1],id=Number(idMatch[2]);
        if(action==='structure'){
          const current=await getTournament(env,id);if(!current)return json({error:'Tournament not found.'},404);
          const structure=buildTournamentStructure(current,current.players||[]);
          await rpc(env,'save_tournament_structure',{p_payload:{tournamentId:id,stages:structure}});
          await rpc(env,'link_tournament_progression',{p_tournament_id:id});
          await sb(env,'tournament_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{tournament_id:id,actor_key:me.actorKey,actor_role:me.role,action:'generate_structure',payload:{formatKey:current.formatKey,participantCount:current.participantCount,stageCount:structure.length}}])});
          return json({ok:true,tournament:await getTournament(env,id)});
        }
        if(action==='result'){
          const input=await request.json().catch(()=>({}));const matchId=id;
          if(!Number.isInteger(Number(input.player1Score))||!Number.isInteger(Number(input.player2Score)))return json({error:'Enter whole-number scores.'},400);
          const result=await rpc(env,'record_tournament_match_result_v2',{p_match_id:matchId,p_player1_score:Number(input.player1Score),p_player2_score:Number(input.player2Score),p_deciding_winner_player_id:input.decidingWinnerPlayerId?Number(input.decidingWinnerPlayerId):null});
          const r=Array.isArray(result)?result[0]:result;
          await sb(env,'tournament_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{tournament_id:r.tournamentId,actor_key:me.actorKey,actor_role:me.role,action:'record_result',payload:{matchId,player1Score:Number(input.player1Score),player2Score:Number(input.player2Score),winnerPlayerId:r.winnerPlayerId||null}}])});
          return json({ok:true,...r,tournament:await getTournament(env,r.tournamentId)});
        }
        if(action==='publish'){
          if(me.role!=='admin'&&me.role!=='organizer')return json({error:'Not authorized to publish.'},403);
          const current=await getTournament(env,id);if(!current)return json({error:'Tournament not found.'},404);
          await sb(env,'tournaments?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({is_public:true,status:current.status==='completed'?'completed':'published',updated_at:new Date().toISOString()})});
          const published=await publishSnapshot(env);
          await sb(env,'tournament_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{tournament_id:id,actor_key:me.actorKey,actor_role:me.role,action:'publish',payload:{gitCommitSha:published.commitSha}}])});
          return json({ok:true,...published,tournament:await getTournament(env,id)});
        }
      }
      return json({error:'Tournament endpoint not found.'},404);
    }catch(error){return json({error:error?.message||'Tournament operation failed.'},500)}
  }
  if(path==='/admin/tournament'||path==='/admin/tournament/'||path==='/admin/tournament/index.html'){
    if(await identity(request,env))return env.ASSETS.fetch(new Request(new URL('/admin/tournament/index.html',url),request));
    return new Response(LOGIN_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  return null;
}
