const PROJECT_URL = 'https://moczgrwxtfexdbjthxpd.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_twe_ZNKiHXUB4b_J_RjGEa_rPKZrqbr';

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra
  }
});

async function rest(env, path, options = {}) {
  const key = String(env.SUPABASE_SECRET_KEY || '').trim();
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not configured in the Worker.');
  const response = await fetch(PROJECT_URL + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: key,
      Accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const bodyText = await response.text();
  let body = null;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { throw new Error('Supabase returned invalid JSON.'); }
  if (!response.ok) {
    const error = new Error(body?.message || body?.hint || body?.details || 'Supabase request failed.');
    error.status = response.status;
    throw error;
  }
  return body;
}

async function systemAccountId(env) {
  const rows = await rest(env, 'accounts?select=id&system_account=eq.true&username=eq.fcmt-system&limit=1');
  if (!rows?.[0]?.id) throw new Error('Account system admin actor is not configured.');
  return rows[0].id;
}

function safeSearch(value) {
  return String(value || '').replace(/[^a-zA-Z0-9 ._\-@]/g, '').slice(0, 80);
}

function asInt(value, fallback, min, max) {
  const n = Number(value);
  return Number.isInteger(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function ensureUuid(value) {
  const v = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) {
    throw new Error('Invalid identifier.');
  }
  return v;
}

async function adminAccountList(env, url) {
  const q = safeSearch(url.searchParams.get('q'));
  const limit = asInt(url.searchParams.get('limit'), 50, 1, 100);
  let path = 'accounts?select=id,username,display_name,state,created_at,system_account&system_account=eq.false&order=created_at.desc&limit=' + limit;
  if (q) {
    path += '&or=(username.ilike.*' + encodeURIComponent(q) + '*,display_name.ilike.*' + encodeURIComponent(q) + '*)';
  }
  const accounts = await rest(env, path);
  const ids = (accounts || []).map((a) => a.id);
  if (!ids.length) return { users: [] };

  const inList = '(' + ids.join(',') + ')';
  const [progress, rewards] = await Promise.all([
    rest(env, 'account_progress?select=account_id,level,xp_balance,current_streak,longest_streak&account_id=in.' + encodeURIComponent(inList)),
    rest(env, 'reward_accounts?select=account_id,balance&account_id=in.' + encodeURIComponent(inList))
  ]);
  const progressMap = new Map((progress || []).map((x) => [x.account_id, x]));
  const rewardMap = new Map((rewards || []).map((x) => [x.account_id, x]));
  return {
    users: (accounts || []).map((a) => ({
      id: a.id,
      username: a.username,
      displayName: a.display_name,
      state: a.state,
      createdAt: a.created_at,
      systemAccount: Boolean(a.system_account),
      level: Number(progressMap.get(a.id)?.level || 1),
      xp: Number(progressMap.get(a.id)?.xp_balance || 0),
      streak: Number(progressMap.get(a.id)?.current_streak || 0),
      tokens: Number(rewardMap.get(a.id)?.balance || 0)
    }))
  };
}

async function adminAccountDetail(env, id) {
  id = ensureUuid(id);
  const accountRows = await rest(env, 'accounts?select=id,username,display_name,bio,avatar_url,website_url,state,state_reason,frozen_until,closed_at,created_at,updated_at,system_account&id=eq.' + encodeURIComponent(id) + '&limit=1');
  const account = accountRows?.[0];
  if (!account) return null;

  const [progress, rewards, activity, achievements, actions] = await Promise.all([
    rest(env, 'account_progress?select=xp_balance,level,current_streak,longest_streak,last_qualifying_activity_at&account_id=eq.' + encodeURIComponent(id) + '&limit=1'),
    rest(env, 'reward_accounts?select=balance,lifetime_earned,lifetime_spent,lifetime_reversed&account_id=eq.' + encodeURIComponent(id) + '&limit=1'),
    rest(env, 'activity_events?select=event_type,entity_type,entity_id,metadata,created_at&account_id=eq.' + encodeURIComponent(id) + '&order=created_at.desc&limit=40'),
    rest(env, 'user_achievements?select=status,progress,unlocked_at,achievements(name,icon,description)&account_id=eq.' + encodeURIComponent(id) + '&order=updated_at.desc&limit=40'),
    rest(env, 'account_admin_actions?select=action_type,previous_state,new_state,reason,metadata,created_at&target_account_id=eq.' + encodeURIComponent(id) + '&order=created_at.desc&limit=40')
  ]);
  return {
    user: account,
    progress: progress?.[0] || { level: 1, xp_balance: 0, current_streak: 0, longest_streak: 0 },
    rewards: rewards?.[0] || { balance: 0, lifetime_earned: 0, lifetime_spent: 0, lifetime_reversed: 0 },
    activity: activity || [],
    achievements: achievements || [],
    adminActions: actions || []
  };
}

async function adminAdjustXp(env, id, input) {
  id = ensureUuid(id);
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000000000) throw new Error('XP adjustment is invalid.');
  const reason = String(input.reason || '').trim().slice(0, 500);
  if (!reason) throw new Error('A reason is required.');
  const key = ensureUuid(input.idempotencyKey || crypto.randomUUID());
  const actor = await systemAccountId(env);
  const existing = await rest(env, 'xp_transactions?select=id,amount&account_id=eq.' + encodeURIComponent(id) + '&idempotency_key=eq.' + encodeURIComponent(key) + '&limit=1');
  if(existing?.[0]){
    if(Number(existing[0].amount) !== amount) throw new Error('XP idempotency key already used with a different amount.');
    return { ok: true, replayed: true };
  }
  await rest(env, 'xp_transactions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{
      account_id: id,
      amount,
      source_type: 'admin_adjustment',
      source_id: key,
      reason,
      idempotency_key: key,
      created_by_account_id: actor,
      metadata: { admin: true }
    }])
  });
  await rest(env, 'account_admin_actions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{
      target_account_id: id,
      admin_account_id: actor,
      action_type: 'reward_adjustment',
      reason,
      metadata: { type: 'xp', amount }
    }])
  });
  return { ok: true };
}

async function adminAdjustTokens(env, id, input) {
  id = ensureUuid(id);
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000000000) throw new Error('Token adjustment is invalid.');
  const reason = String(input.reason || '').trim().slice(0, 500);
  if (!reason) throw new Error('A reason is required.');
  const key = ensureUuid(input.idempotencyKey || crypto.randomUUID());
  const expiresAt = input.expiresAt ? new Date(String(input.expiresAt)) : null;
  if (input.expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error('Invalid token expiration.');
  const actor = await systemAccountId(env);
  const existing = await rest(env, 'reward_ledger?select=id,amount&account_id=eq.' + encodeURIComponent(id) + '&idempotency_key=eq.' + encodeURIComponent(key) + '&limit=1');
  if(existing?.[0]){
    if(Number(existing[0].amount) !== amount) throw new Error('Token idempotency key already used with a different amount.');
    return { ok: true, replayed: true };
  }
  await rest(env, 'reward_ledger', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{
      account_id: id,
      entry_type: 'admin_adjustment',
      amount,
      idempotency_key: key,
      created_by_account_id: actor,
      memo: reason,
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      metadata: { admin: true }
    }])
  });
  await rest(env, 'account_admin_actions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{
      target_account_id: id,
      admin_account_id: actor,
      action_type: 'reward_adjustment',
      reason,
      metadata: { type: 'tokens', amount }
    }])
  });
  return { ok: true };
}

async function adminSetState(env, id, input) {
  id = ensureUuid(id);
  const allowed = new Set(['active','restricted','frozen','fraud_hold','fraud_removed','closed']);
  const newState = String(input.state || '');
  if (!allowed.has(newState)) throw new Error('Invalid account state.');
  const reason = String(input.reason || '').trim().slice(0, 500);
  const actor = await systemAccountId(env);
  const rows = await rest(env, 'accounts?select=state&id=eq.' + encodeURIComponent(id) + '&limit=1');
  const previous = rows?.[0]?.state;
  if (!previous) throw new Error('Account not found.');
  const frozenUntil = newState === 'frozen' && input.frozenUntil ? new Date(String(input.frozenUntil)) : null;
  if (input.frozenUntil && (!frozenUntil || Number.isNaN(frozenUntil.getTime()))) throw new Error('Invalid freeze date.');
  await rest(env, 'accounts?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      state: newState,
      state_reason: reason || null,
      frozen_until: frozenUntil ? frozenUntil.toISOString() : null,
      closed_at: newState === 'closed' ? new Date().toISOString() : null
    })
  });
  await rest(env, 'account_admin_actions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([{
      target_account_id: id,
      admin_account_id: actor,
      action_type: 'state_change',
      previous_state: previous,
      new_state: newState,
      reason: reason || null,
      metadata: { frozen_until: frozenUntil ? frozenUntil.toISOString() : null }
    }])
  });
  return { ok: true, state: newState };
}

async function adminCrud(request, env, url) {
  const path = url.pathname;
  if (path === '/api/admin/account-users' && request.method === 'GET') return json(await adminAccountList(env, url));
  const userMatch = path.match(/^\/api\/admin\/account-users\/([0-9a-f-]+)$/i);
  if (userMatch && request.method === 'GET') {
    const detail = await adminAccountDetail(env, userMatch[1]);
    return detail ? json(detail) : json({ error: 'User not found.' }, 404);
  }
  const xpMatch = path.match(/^\/api\/admin\/account-users\/([0-9a-f-]+)\/xp$/i);
  if (xpMatch && request.method === 'POST') return json(await adminAdjustXp(env, xpMatch[1], await request.json().catch(() => ({}))));
  const tokenMatch = path.match(/^\/api\/admin\/account-users\/([0-9a-f-]+)\/tokens$/i);
  if (tokenMatch && request.method === 'POST') return json(await adminAdjustTokens(env, tokenMatch[1], await request.json().catch(() => ({}))));
  const stateMatch = path.match(/^\/api\/admin\/account-users\/([0-9a-f-]+)\/state$/i);
  if (stateMatch && request.method === 'POST') return json(await adminSetState(env, stateMatch[1], await request.json().catch(() => ({}))));

  if (path === '/api/admin/missions' && request.method === 'GET') {
    const rows = await rest(env, 'reward_tasks?select=*&order=display_order.asc,priority.asc,created_at.desc');
    return json({ missions: rows || [] });
  }
  if (path === '/api/admin/missions' && request.method === 'POST') {
    const input = await request.json().catch(() => ({}));
    const slug = String(input.slug || '').trim().toLowerCase();
    const title = String(input.title || '').trim();
    if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(slug) || !title) throw new Error('Mission slug and title are required.');
    const row = {
      slug, title,
      description: String(input.description || '').trim().slice(0, 1000),
      task_type: ['one_time','daily','repeatable','event'].includes(input.taskType) ? input.taskType : 'one_time',
      reward_points: Math.max(0, Number(input.rewardPoints || 0)),
      xp_reward: Math.max(0, Number(input.xpReward || 0)),
      token_reward: Math.max(0, Number(input.tokenReward || 0)),
      daily_limit: input.dailyLimit == null || input.dailyLimit === '' ? null : Math.max(1, Number(input.dailyLimit)),
      weekly_limit: input.weeklyLimit == null || input.weeklyLimit === '' ? null : Math.max(1, Number(input.weeklyLimit)),
      completion_limit: input.completionLimit == null || input.completionLimit === '' ? null : Math.max(1, Number(input.completionLimit)),
      cooldown_seconds: Math.max(0, Number(input.cooldownSeconds || 0)),
      starts_at: input.startsAt || null, ends_at: input.endsAt || null,
      enabled: Boolean(input.enabled),
      mission_type: ['daily','weekly','one_time','repeatable','achievement','event','community','tournament','calculator','database'].includes(input.missionType) ? input.missionType : 'one_time',
      verification_method: ['server_event','moderated','manual'].includes(input.verificationMethod) ? input.verificationMethod : 'server_event',
      conditions: input.conditions && typeof input.conditions === 'object' ? input.conditions : {},
      admin_notes: String(input.adminNotes || '').slice(0, 2000),
      priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
      display_order: Number.isFinite(Number(input.displayOrder)) ? Number(input.displayOrder) : 100,
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
    };
    await rest(env, 'reward_tasks', { method:'POST', headers:{Prefer:'return=minimal'}, body:JSON.stringify([row]) });
    return json({ok:true});
  }
  const missionMatch=path.match(/^\/api\/admin\/missions\/([0-9a-f-]+)$/i);
  if(missionMatch && request.method==='PUT'){
    const input=await request.json().catch(()=>({}));
    const allowed=['title','description','task_type','reward_points','xp_reward','token_reward','daily_limit','weekly_limit','completion_limit','cooldown_seconds','starts_at','ends_at','enabled','mission_type','verification_method','conditions','admin_notes','priority','display_order','metadata'];
    const map={title:'title',description:'description',taskType:'task_type',rewardPoints:'reward_points',xpReward:'xp_reward',tokenReward:'token_reward',dailyLimit:'daily_limit',weeklyLimit:'weekly_limit',completionLimit:'completion_limit',cooldownSeconds:'cooldown_seconds',startsAt:'starts_at',endsAt:'ends_at',enabled:'enabled',missionType:'mission_type',verificationMethod:'verification_method',conditions:'conditions',adminNotes:'admin_notes',priority:'priority',displayOrder:'display_order',metadata:'metadata'};
    const patch={};for(const k of allowed){const key=map[k];if(input[k]!==undefined)patch[key]=input[k];}
    await rest(env,'reward_tasks?id=eq.'+encodeURIComponent(ensureUuid(missionMatch[1])),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
    return json({ok:true});
  }

  if(path==='/api/admin/achievements' && request.method==='GET') return json({achievements:await rest(env,'achievements?select=*&order=priority.asc,created_at.desc')});
  if(path==='/api/admin/achievements' && request.method==='POST'){
    const input=await request.json().catch(()=>({}));const slug=String(input.slug||'').trim().toLowerCase();const name=String(input.name||'').trim();
    if(!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(slug)||!name) throw new Error('Achievement slug and name are required.');
    await rest(env,'achievements',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{
      slug,name,description:String(input.description||'').slice(0,1000),icon:String(input.icon||'').slice(0,120),
      requirement:input.requirement&&typeof input.requirement==='object'?input.requirement:{},
      hidden:Boolean(input.hidden),xp_reward:Math.max(0,Number(input.xpReward||0)),token_reward:Math.max(0,Number(input.tokenReward||0)),
      active:Boolean(input.active),priority:Number(input.priority||0)
    }])});
    return json({ok:true});
  }
  const achievementMatch=path.match(/^\/api\/admin\/achievements\/([0-9a-f-]+)$/i);
  if(achievementMatch && request.method==='PUT'){
    const input=await request.json().catch(()=>({}));const patch={};
    for(const [key,db] of [['name','name'],['description','description'],['icon','icon'],['requirement','requirement'],['hidden','hidden'],['xpReward','xp_reward'],['tokenReward','token_reward'],['active','active'],['priority','priority']]) if(input[key]!==undefined) patch[db]=input[key];
    await rest(env,'achievements?id=eq.'+encodeURIComponent(ensureUuid(achievementMatch[1])),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
    return json({ok:true});
  }

  if(path==='/api/admin/rewards' && request.method==='GET') return json({rewards:await rest(env,'rewards?select=*&order=priority.asc,created_at.desc')});
  if(path==='/api/admin/rewards' && request.method==='POST'){
    const input=await request.json().catch(()=>({}));const slug=String(input.slug||'').trim().toLowerCase();const name=String(input.name||'').trim();
    const type=['cosmetic','badge','title','profile_frame','digital_reward','promotional_reward','physical_reward','other'].includes(input.rewardType)?input.rewardType:'other';
    if(!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(slug)||!name) throw new Error('Reward slug and name are required.');
    await rest(env,'rewards',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{
      slug,name,description:String(input.description||'').slice(0,1200),image_url:input.imageUrl||null,reward_type:type,
      cost:Math.max(0,Number(input.cost||0)),currency_code:String(input.currencyCode||'tokens').slice(0,32),
      stock:input.stock===''||input.stock==null?null:Math.max(0,Number(input.stock)),
      start_at:input.startAt||null,end_at:input.endAt||null,
      redemption_limit:input.redemptionLimit==null||input.redemptionLimit===''?null:Math.max(1,Number(input.redemptionLimit)),
      eligibility:input.eligibility&&typeof input.eligibility==='object'?input.eligibility:{},
      enabled:Boolean(input.enabled),status:input.status||'active',priority:Number(input.priority||100),
      metadata:input.metadata&&typeof input.metadata==='object'?input.metadata:{}
    }])});
    return json({ok:true});
  }
  const rewardMatch=path.match(/^\/api\/admin\/rewards\/([0-9a-f-]+)$/i);
  if(rewardMatch && request.method==='PUT'){
    const input=await request.json().catch(()=>({}));const patch={};
    const map={name:'name',description:'description',imageUrl:'image_url',rewardType:'reward_type',cost:'cost',currencyCode:'currency_code',stock:'stock',startAt:'start_at',endAt:'end_at',redemptionLimit:'redemption_limit',eligibility:'eligibility',enabled:'enabled',status:'status',priority:'priority',metadata:'metadata'};
    for(const key of Object.keys(map)) if(input[key]!==undefined) patch[map[key]]=input[key];
    await rest(env,'rewards?id=eq.'+encodeURIComponent(ensureUuid(rewardMatch[1])),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
    return json({ok:true});
  }

  if(path==='/api/admin/community-submissions' && request.method==='GET'){
    const status=safeSearch(url.searchParams.get('status'))||'submitted';
    return json({submissions:await rest(env,'community_submissions?select=*&status=eq.'+encodeURIComponent(status)+'&order=created_at.desc&limit=100')});
  }
  const submissionMatch=path.match(/^\/api\/admin\/community-submissions\/([0-9a-f-]+)$/i);
  if(submissionMatch && request.method==='POST'){
    const input=await request.json().catch(()=>({}));
    const status=['submitted','pending','approved','rejected'].includes(input.status)?input.status:null;
    if(!status) throw new Error('Invalid submission status.');
    const id=ensureUuid(submissionMatch[1]);const actor=await systemAccountId(env);
    const rows=await rest(env,'community_submissions?select=id,account_id,status,reward_xp,reward_tokens&id=eq.'+encodeURIComponent(id)+'&limit=1');
    const row=rows?.[0];if(!row) return json({error:'Submission not found.'},404);
    await rest(env,'community_submissions?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,reviewed_by_account_id:actor,reviewed_at:new Date().toISOString(),review_reason:String(input.reason||'').slice(0,500)})});
    if(status==='approved' && row.status!=='approved' && row.reward_xp>0){
      const key=crypto.randomUUID();await rest(env,'xp_transactions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{account_id:row.account_id,amount:row.reward_xp,source_type:'community_submission',source_id:id,reason:'Approved community contribution',idempotency_key:key,created_by_account_id:actor,metadata:{submission_id:id}}])});
    }
    if(status==='approved' && row.status!=='approved' && row.reward_tokens>0){
      await rest(env,'reward_ledger',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{account_id:row.account_id,entry_type:'admin_adjustment',amount:row.reward_tokens,idempotency_key:crypto.randomUUID(),created_by_account_id:actor,memo:'Approved community contribution',metadata:{submission_id:id}}])});
    }
    return json({ok:true});
  }

  return json({error:'Admin account endpoint not found.'},404);
}

export async function adminAccountApi(request, env, url) {
  try {
    return await adminCrud(request, env, url);
  } catch (error) {
    console.error('[ADMIN_ACCOUNT_API]', error?.message || error);
    return json({ error: error?.message || 'Account admin operation failed.' }, 500);
  }
}
