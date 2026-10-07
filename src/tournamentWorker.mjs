import { TOURNAMENT_FORMATS, getTournamentFormat } from './tournaments/formats.js';
import { buildTournamentStructure } from './tournaments/engine.js';

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
function normalizeTournament(row,players=[],matches=[],stages=[],standings=[]){
  const p=players.filter(x=>Number(x.tournament_id)===Number(row.id)).sort((a,b)=>Number(a.slot)-Number(b.slot));
  const ms=matches.filter(x=>Number(x.tournament_id)===Number(row.id)).sort((a,b)=>
    Number(a.matchday||0)-Number(b.matchday||0) ||
    Number(a.stage_id||0)-Number(b.stage_id||0) ||
    Number(a.round_number||0)-Number(b.round_number||0) ||
    Number(a.match_number||0)-Number(b.match_number||0) ||
    Number(a.leg_number||1)-Number(b.leg_number||1)
  );
  const byId=new Map(p.map(x=>[Number(x.id),x]));
  const mappedMatches=ms.map(m=>{
    const p1=byId.get(Number(m.player1_id)),p2=byId.get(Number(m.player2_id));
    return {
      id:Number(m.id),
      matchNumber:Number(m.match_number),
      roundNumber:Number(m.round_number||1),
      legNumber:Number(m.leg_number||1),
      matchday:m.matchday==null?null:Number(m.matchday),
      stageId:m.stage_id==null?null:Number(m.stage_id),
      groupId:m.group_id==null?null:Number(m.group_id),
      tieId:m.tie_id==null?null:Number(m.tie_id),
      status:m.status,
      player1:p1?{id:Number(p1.id),displayName:p1.display_name,playerTag:p1.player_tag}:null,
      player2:p2?{id:Number(p2.id),displayName:p2.display_name,playerTag:p2.player_tag}:null,
      player1Score:m.player1_score==null?m.home_score:m.player1_score,
      player2Score:m.player2_score==null?m.away_score:m.player2_score,
      winnerPlayerId:m.winner_player_id==null?null:Number(m.winner_player_id),
      extraTime:Boolean(m.extra_time),
      penaltiesHome:m.penalties_home==null?null:Number(m.penalties_home),
      penaltiesAway:m.penalties_away==null?null:Number(m.penalties_away)
    };
  });

  const mappedStandings=(standings||[]).map(s=>{
    const player=byId.get(Number(s.player_id));
    return {
      id:Number(s.id),
      stageId:Number(s.stage_id),
      groupId:s.group_id==null?null:Number(s.group_id),
      playerId:Number(s.player_id),
      player:player?{id:Number(player.id),displayName:player.display_name,playerTag:player.player_tag,avatarUrl:player.avatar_url}:null,
      played:Number(s.played||0),
      wins:Number(s.wins||0),
      draws:Number(s.draws||0),
      losses:Number(s.losses||0),
      goalsFor:Number(s.goals_for||0),
      goalsAgainst:Number(s.goals_against||0),
      goalDifference:Number(s.goal_difference||0),
      points:Number(s.points||0),
      rank:s.rank==null?null:Number(s.rank)
    };
  });

  const mappedStages=(stages||[]).slice().sort((a,b)=>Number(a.stage_order)-Number(b.stage_order)).map(s=>({
    id:Number(s.id),
    order:Number(s.stage_order),
    key:s.stage_key,
    name:s.name,
    type:s.stage_type,
    matchMode:s.match_mode,
    groupCount:s.group_count==null?null:Number(s.group_count),
    teamsPerGroup:s.teams_per_group==null?null:Number(s.teams_per_group),
    advancePerGroup:s.advance_per_group==null?null:Number(s.advance_per_group),
    rounds:s.rounds==null?null:Number(s.rounds),
    config:s.config||{},
    groups:[],
    standings:mappedStandings.filter(x=>x.stageId===Number(s.id)).sort((a,b)=>
      (a.rank??999999)-(b.rank??999999) || b.points-a.points || b.goalDifference-a.goalDifference
    ),
    matches:mappedMatches.filter(x=>x.stageId===Number(s.id))
  }));

  const finalMatch=ms.length?ms.reduce((a,b)=>
    Number(b.round_number||0)>Number(a.round_number||0) ||
    (Number(b.round_number||0)===Number(a.round_number||0)&&Number(b.match_number||0)>Number(a.match_number||0))?b:a
  ):null;
  const winnerId=finalMatch?.winner_player_id!=null?Number(finalMatch.winner_player_id):null;
  const winner=winnerId?byId.get(winnerId):null;

  return {
    id:Number(row.id),
    slug:row.slug,
    name:row.name,
    description:row.description,
    format:Number(row.format),
    formatKey:row.format_key||'single_elimination',
    participantCount:Number(row.participant_count||row.format),
    formatConfig:row.format_config||{},
    status:row.status,
    isPublic:Boolean(row.is_public),
    startsAt:row.starts_at?new Date(row.starts_at).toISOString().slice(0,16):null,
    players:p.map(x=>({
      id:Number(x.id),
      slot:Number(x.slot),
      seed:Number(x.seed||x.slot),
      displayName:x.display_name,
      playerTag:x.player_tag||'',
      avatarUrl:x.avatar_url||''
    })),
    stages:mappedStages,
    rounds:mappedStages.flatMap(s=>s.matches.length?[{number:s.order,name:s.name,matches:s.matches}]:[]),
    winner:winner?{id:Number(winner.id),displayName:winner.display_name,playerTag:winner.player_tag||''}:null,
    publishedAt:row.published_at
  };
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
function decodeGithub(value){try{return new TextDecoder().decode(Uint8Array.from(atob(String(value||'').replace(/\s+/g,'')),c=>c.charCodeAt(0)));}catch{return '';}}
async function publishSnapshot(env){
  const snapshot=await publicSnapshot(env);
  const source='// Generated by the FCMOBILETOOLS Tournament Organizer.\nexport const TOURNAMENT_PUBLICATIONS = '+JSON.stringify(snapshot,null,2)+';\n';
  const file=await github(env,'contents/src/data/tournaments.js?ref=main');
  const currentSource=decodeGithub(file.content||'');
  if(currentSource===source) return {commitSha:null,count:snapshot.length,unchanged:true};
  const body=await github(env,'contents/src/data/tournaments.js',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({message:'tournament: publish public tournament snapshot',content:encodeGithub(source),sha:file.sha,branch:'main'})});
  const commitSha=body.commit?.sha||null;
  for(const t of snapshot){
    const payload={tournament_id:t.id,git_commit_sha:commitSha,published_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    await sb(env,'tournament_publications?on_conflict=tournament_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([payload])});
    await sb(env,'tournaments?id=eq.'+t.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:t.status,published_at:new Date().toISOString(),updated_at:new Date().toISOString()})});
  }
  return {commitSha,count:snapshot.length,unchanged:false};
}
const LOGIN_HTML=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#071018"><title>Tournament organizer | FCMOBILETOOLS</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(900px 520px at 8% -10%,rgba(76,201,255,.14),transparent 62%),#071018;color:#f5f8fb;font:14px/1.5 Inter,system-ui,sans-serif}.card{width:min(430px,100%);padding:clamp(24px,5vw,38px);border:1px solid rgba(255,255,255,.1);border-radius:26px;background:linear-gradient(160deg,#0f1c2a,#09131c);box-shadow:0 40px 100px -30px #000}.brand{display:flex;align-items:center;gap:12px;color:#a7b4c3;font-size:13px;font-weight:600}.brand img{width:40px;height:40px;object-fit:contain}h1{margin:26px 0 8px;font:700 clamp(30px,8vw,38px)/1.05 'Space Grotesk',Inter,sans-serif;letter-spacing:-.045em}p{margin:0;color:#8fa1b1;line-height:1.6}label{display:block;margin-top:20px;color:#cfdae4;font-size:13px;font-weight:600}input{width:100%;margin-top:8px;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#08121b;color:#f5f8fb;font:inherit;outline:none;transition:border-color .15s,box-shadow .15s}input:focus{border-color:#4cc9ff;box-shadow:0 0 0 3px rgba(76,201,255,.15)}button{width:100%;margin-top:24px;padding:14px;border-radius:12px;border:1px solid #6bdfff;background:linear-gradient(135deg,#69ddff,#2aa8e8);color:#04131c;font:700 15px Inter,system-ui,sans-serif;cursor:pointer}button:hover{background:linear-gradient(135deg,#7fe3ff,#38b3f0)}button:focus-visible{outline:2px solid #fff;outline-offset:3px}#error{min-height:22px;margin-top:14px;color:#ffaaa3;font-size:13px}.hint{margin-top:10px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08);font-size:12.5px;color:#6f8294}</style></head><body><form class="card" id="form"><div class="brand"><img src="/assets/images/logo.png" alt="">FCMOBILETOOLS tournaments</div><h1>Tournament organizer</h1><p>Sign in to build brackets, enter results and publish official tournament pages.</p><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button>Sign in</button><div id="error" role="alert"></div><div class="hint">Site administrators can sign in with their existing admin credentials.</div></form><script>form.onsubmit=async e=>{e.preventDefault();error.textContent='';const r=await fetch('/api/tournament/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});const b=await r.json().catch(()=>({}));if(!r.ok){error.textContent=b.error||'Sign in failed';return}location.replace('/admin/tournament/')}</script></body></html>`;

export async function tournamentWorkerRoute(request,env,url){
  const path=url.pathname;
  if(path==='/tournaments'||path==='/tournaments/'||path.startsWith('/tournament/')){
    const publicTournaments=await publicSnapshot(env).catch(()=>[]);
    if(!publicTournaments.length){
      return new Response(JSON.stringify({error:'Tournaments are not open yet.'}),{
        status:404,
        headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
      });
    }
  }
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
    const publicTournaments=await publicSnapshot(env).catch(()=>[]);
    if(!publicTournaments.length) return json({error:'Tournaments are not open yet.'},404);
    const t=await getTournamentBySlug(env,url.searchParams.get('slug')||'');
    return t&&t.isPublic?json(t):json({error:'Tournament not found.'},404);
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
        let id;
        const current=input.id?await getTournament(env,input.id):null;
        if(current?.stages?.length){
          await rpc(env,'update_tournament_details',{p_tournament_id:Number(input.id),p_name:name,p_description:String(input.description||''),p_slug:slug,p_is_public:Boolean(input.isPublic),p_starts_at:input.startsAt||null});
          id=Number(input.id);
        }else{
          const result=await rpc(env,'save_tournament_draft',{p_payload:payload});
          id=Array.isArray(result)?result[0]:result;
        }
        await sb(env,'tournament_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{tournament_id:id,actor_key:me.actorKey,actor_role:me.role,action:'save',payload:{formatKey,participantCount,name,generated:Boolean(current?.stages?.length)}}])});
        return json({ok:true,tournament:await getTournament(env,id)});
      }
      const batchMatch=path.match(/^\/api\/tournament\/results\/(\d+)$/);
      if(batchMatch&&request.method==='POST'){
        const tournamentId=Number(batchMatch[1]);
        const input=await request.json().catch(()=>({}));
        const updates=Array.isArray(input.updates)?input.updates:[];
        const result=await rpc(env,'update_tournament_match_results_v2',{p_tournament_id:tournamentId,p_updates:updates});
        const r=Array.isArray(result)?result[0]:result;
        await sb(env,'tournament_audit_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{tournament_id:tournamentId,actor_key:me.actorKey,actor_role:me.role,action:'update_results',payload:{updatedCount:Number(r?.updatedCount||updates.length)}}])});
        return json({ok:true,...r,tournament:await getTournament(env,tournamentId)});
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
          const result=await rpc(env,'update_tournament_match_result_v2',{p_match_id:matchId,p_player1_score:Number(input.player1Score),p_player2_score:Number(input.player2Score),p_deciding_winner_player_id:input.decidingWinnerPlayerId?Number(input.decidingWinnerPlayerId):null,p_expected_player1_id:input.expectedPlayer1Id?Number(input.expectedPlayer1Id):null,p_expected_player2_id:input.expectedPlayer2Id?Number(input.expectedPlayer2Id):null});
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
    if(await identity(request,env))return env.ASSETS.fetch(new Request(new URL('/admin/tournament/',url),request));
    return new Response(LOGIN_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  return null;
}
