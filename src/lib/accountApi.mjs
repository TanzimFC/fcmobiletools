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

function supabaseSecret(env) {
  const key = String(env.SUPABASE_SECRET_KEY || '').trim();
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not configured in the Worker.');
  return key;
}

async function rest(env, path, options = {}) {
  const key = supabaseSecret(env);
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
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch {
    throw new Error('Supabase returned invalid JSON.');
  }
  if (!response.ok) {
    const message = body?.message || body?.hint || body?.details || 'Supabase request failed.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function authRequest(path, body, headers = {}) {
  const response = await fetch(PROJECT_URL + path, {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: 'Bearer ' + PUBLISHABLE_KEY,
      'content-type': 'application/json',
      Accept: 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const error = new Error(
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      'Authentication request failed.'
    );
    error.status = response.status;
    throw error;
  }
  return data || {};
}

function bearer(request) {
  const value = String(request.headers.get('authorization') || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

async function getAuthUser(request) {
  const token = bearer(request);
  if (!token) return null;
  const response = await fetch(PROJECT_URL + '/auth/v1/user', {
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: 'Bearer ' + token,
      Accept: 'application/json'
    }
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  if (!user?.id) return null;
  return user;
}

async function accountForUser(env, user) {
  if (!user?.id) return null;
  const rows = await rest(
    env,
    'accounts?select=id,auth_user_id,username,display_name,bio,avatar_url,website_url,state,created_at,updated_at&auth_user_id=eq.' +
      encodeURIComponent(user.id) +
      '&limit=1'
  );
  return rows?.[0] || null;
}

async function requireAccount(request, env, options = {}) {
  const user = await getAuthUser(request);
  if (!user) return { error: json({ error: 'Authentication required.' }, 401) };
  const account = await accountForUser(env, user);
  if (!account) return { error: json({ error: 'Account is not provisioned.' }, 403) };
  if (options.verified && !user.email_confirmed_at) {
    return { error: json({ error: 'Please verify your email before using this account feature.' }, 403) };
  }
  if (options.active !== false && account.state !== 'active') {
    return { error: json({ error: 'This account is not currently active.' }, 403) };
  }
  return { user, account };
}

function validUsername(value) {
  return /^[a-z0-9][a-z0-9._-]{1,22}[a-z0-9]$/.test(String(value || ''));
}

function cleanUrl(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  const u = new URL(v);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http and https URLs are allowed.');
  return u.toString();
}

async function publicProfile(env, username) {
  if (!validUsername(username)) return null;
  const rows = await rest(
    env,
    'profile_public?select=username,display_name,avatar_url,level,xp,current_streak,longest_streak,selected_title,joined_at,is_public,show_display_name,show_level,show_xp,show_streak,show_joined_date,show_achievements,show_tournament_stats,show_activity_summary&username=eq.' +
      encodeURIComponent(username) +
      '&is_public=eq.true&limit=1'
  );
  const p = rows?.[0];
  if (!p) return null;

  const result = {
    username: p.username,
    displayName: p.show_display_name ? p.display_name : p.username,
    avatarUrl: p.avatar_url || null,
    level: p.show_level ? Number(p.level || 1) : null,
    xp: p.show_xp ? Number(p.xp || 0) : null,
    currentStreak: p.show_streak ? Number(p.current_streak || 0) : null,
    longestStreak: p.show_streak ? Number(p.longest_streak || 0) : null,
    selectedTitle: p.selected_title || null,
    joinedAt: p.show_joined_date ? p.joined_at : null,
    achievements: [],
    tournamentStats: null,
    activity: []
  };

  if (p.show_achievements) {
    const achievements = await rest(
      env,
      'user_achievements?select=unlocked_at,achievements(name,icon,description)&status=eq.unlocked&account_id=eq.' +
        encodeURIComponent(p.account_id || '') +
        '&order=unlocked_at.desc&limit=12'
    ).catch(() => []);
    result.achievements = (achievements || [])
      .filter((row) => row.achievements)
      .map((row) => ({
        name: row.achievements.name,
        icon: row.achievements.icon || '',
        description: row.achievements.description || '',
        unlockedAt: row.unlocked_at
      }));
  }
  return result;
}

async function mePayload(env, user, account) {
  const progressRows = await rest(
    env,
    'account_progress?select=xp_balance,level,current_streak,longest_streak,last_qualifying_activity_at&account_id=eq.' +
      encodeURIComponent(account.id) +
      '&limit=1'
  );
  const rewardRows = await rest(
    env,
    'reward_accounts?select=balance,lifetime_earned,lifetime_spent&account_id=eq.' +
      encodeURIComponent(account.id) +
      '&limit=1'
  );
  const activity = await rest(
    env,
    'activity_events?select=event_type,entity_type,entity_id,metadata,created_at&account_id=eq.' +
      encodeURIComponent(account.id) +
      '&order=created_at.desc&limit=20'
  );
  const achievements = await rest(
    env,
    'user_achievements?select=unlocked_at,achievements(name,icon,description)&status=eq.unlocked&account_id=eq.' +
      encodeURIComponent(account.id) +
      '&order=unlocked_at.desc&limit=20'
  );

  const progress = progressRows?.[0] || {};
  const rewards = rewardRows?.[0] || {};

  let nextLevelMinXp = null;
  const next = await rest(
    env,
    'xp_level_thresholds?select=level,min_xp&active=eq.true&min_xp=gt.' +
      encodeURIComponent(String(progress.xp_balance || 0)) +
      '&order=min_xp.asc&limit=1'
  ).catch(() => []);
  if (next?.[0]) nextLevelMinXp = Number(next[0].min_xp);

  return {
    account: {
      username: account.username,
      displayName: account.display_name,
      bio: account.bio || '',
      avatarUrl: account.avatar_url || null,
      websiteUrl: account.website_url || null,
      state: account.state,
      createdAt: account.created_at,
      emailVerified: Boolean(user.email_confirmed_at),
      level: Number(progress.level || 1),
      xp: Number(progress.xp_balance || 0),
      currentStreak: Number(progress.current_streak || 0),
      longestStreak: Number(progress.longest_streak || 0),
      lastQualifyingActivityAt: progress.last_qualifying_activity_at || null,
      tokens: Number(rewards.balance || 0),
      nextLevelMinXp
    },
    achievements: (achievements || [])
      .filter((row) => row.achievements)
      .map((row) => ({
        name: row.achievements.name,
        icon: row.achievements.icon || '',
        description: row.achievements.description || '',
        unlockedAt: row.unlocked_at
      })),
    activity: activity || []
  };
}

export async function accountApi(request, env, url) {
  const path = url.pathname;
  try {
    if (path === '/api/account/signup' && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      const email = String(input.email || '').trim();
      const password = String(input.password || '');
      const username = String(input.username || '').trim().toLowerCase();
      const displayName = String(input.displayName || '').trim();

      if (!email || !password || !username) return json({ error: 'Email, password and username are required.' }, 400);
      if (password.length < 10) return json({ error: 'Password must be at least 10 characters.' }, 400);
      if (!validUsername(username)) return json({ error: 'Username must be 3–24 characters using lowercase letters, numbers, dots, underscores or hyphens.' }, 400);
      if (displayName.length > 80) return json({ error: 'Display name is too long.' }, 400);

      try {
        const data = await authRequest('/auth/v1/signup', {
          email,
          password,
          data: {
            username,
            display_name: displayName || username
          }
        });

        return json({
          ok: true,
          emailConfirmationRequired: !data.session,
          next: '/profile/'
        });
      } catch (error) {
        const message = String(error?.message || '');
        if (/\+ aliases|disposable|temporary|already associated|invalid email/i.test(message)) {
          return json({ error: message }, 400);
        }
        if (error?.status === 422 || error?.status === 400) {
          return json({ error: message || 'Unable to create the account.' }, 400);
        }
        return json({ error: 'Unable to create the account right now.' }, 500);
      }
    }

    if (path === '/api/account/login' && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      const email = String(input.email || '').trim();
      const password = String(input.password || '');
      if (!email || !password) return json({ error: 'Email and password are required.' }, 400);
      try {
        const data = await authRequest('/auth/v1/token?grant_type=password', { email, password });
        return json({
          ok: true,
          next: '/profile/',
          emailVerified: Boolean(data.user?.email_confirmed_at)
        });
      } catch (error) {
        return json({ error: error?.status === 400 ? 'Invalid email or password. If you have not verified your email yet, check your inbox first.' : 'Unable to sign in right now.' }, 401);
      }
    }

    if (path === '/api/account/me' && request.method === 'GET') {
      const auth = await requireAccount(request, env);
      if (auth.error) return auth.error;
      const payload = await mePayload(env, auth.user, auth.account);
      return json(payload);
    }

    if (path === '/api/account/profile' && request.method === 'PUT') {
      const auth = await requireAccount(request, env);
      if (auth.error) return auth.error;
      const input = await request.json().catch(() => ({}));
      const username = String(input.username || '').trim().toLowerCase();
      const displayName = String(input.displayName || '').trim();
      const avatarUrl = cleanUrl(input.avatarUrl);
      if (!validUsername(username)) return json({ error: 'Username must be 3–24 characters using lowercase letters, numbers, dots, underscores or hyphens.' }, 400);
      if (displayName.length > 80) return json({ error: 'Display name is too long.' }, 400);
      await rest(env, 'accounts?id=eq.' + encodeURIComponent(auth.account.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          username,
          display_name: displayName || username,
          avatar_url: avatarUrl
        })
      });
      return json({ ok: true });
    }

    if (path === '/api/account/settings' && request.method === 'GET') {
      const auth = await requireAccount(request, env);
      if (auth.error) return auth.error;
      const rows = await rest(
        env,
        'profile_settings?select=profile_public,show_display_name,show_level,show_xp,show_streak,show_joined_date,show_achievements,show_tournament_stats,show_activity_summary&account_id=eq.' +
          encodeURIComponent(auth.account.id) + '&limit=1'
      );
      const s = rows?.[0] || {};
      return json({
        account: {
          username: auth.account.username,
          displayName: auth.account.display_name,
          bio: auth.account.bio || '',
          avatarUrl: auth.account.avatar_url || '',
          websiteUrl: auth.account.website_url || '',
          emailVerified: Boolean(auth.user.email_confirmed_at),
        },
        settings: s
      });
    }

    if (path === '/api/account/settings' && request.method === 'PUT') {
      const auth = await requireAccount(request, env);
      if (auth.error) return auth.error;
      const input = await request.json().catch(() => ({}));
      if (input.profile_public !== undefined || input.show_display_name !== undefined) {
        const allowed = [
          'profile_public','show_display_name','show_level','show_xp','show_streak',
          'show_joined_date','show_achievements','show_tournament_stats','show_activity_summary'
        ];
        const values = Object.fromEntries(allowed.map((key) => [key, Boolean(input[key])]));
        await rest(env, 'profile_settings?account_id=eq.' + encodeURIComponent(auth.account.id), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(values)
        });
      } else {
        const username = String(input.username || '').trim().toLowerCase();
        const displayName = String(input.displayName || auth.account.display_name || '').trim();
        const avatarUrl = cleanUrl(input.avatarUrl);
        const websiteUrl = cleanUrl(input.websiteUrl);
        if (!validUsername(username)) return json({ error: 'Invalid username.' }, 400);
        if (displayName.length > 80) return json({ error: 'Display name is too long.' }, 400);
        await rest(env, 'accounts?id=eq.' + encodeURIComponent(auth.account.id), {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            username,
            display_name: displayName || username,
            bio: String(input.bio || '').slice(0, 500),
            avatar_url: avatarUrl,
            website_url: websiteUrl
          })
        });
      }
      return json({ ok: true });
    }

    if (path === '/api/account/public-profile' && request.method === 'GET') {
      const username = String(url.searchParams.get('username') || '').trim().toLowerCase();
      if (!validUsername(username)) return json({ error: 'Profile not found.' }, 404);

      const rows = await rest(
        env,
        'profile_public?select=username,display_name,avatar_url,level,xp,current_streak,longest_streak,selected_title,joined_at,is_public,show_display_name,show_level,show_xp,show_streak,show_joined_date,show_achievements,show_tournament_stats,show_activity_summary&username=eq.' +
          encodeURIComponent(username) + '&is_public=eq.true&limit=1'
      );
      const p = rows?.[0];
      if (!p) return json({ error: 'Profile not found.' }, 404);

      const payload = {
        profile: {
          username: p.username,
          displayName: p.show_display_name ? p.display_name : p.username,
          avatarUrl: p.avatar_url || null,
          level: p.show_level ? Number(p.level || 1) : null,
          xp: p.show_xp ? Number(p.xp || 0) : null,
          currentStreak: p.show_streak ? Number(p.current_streak || 0) : null,
          longestStreak: p.show_streak ? Number(p.longest_streak || 0) : null,
          selectedTitle: p.selected_title || null,
          joinedAt: p.show_joined_date ? p.joined_at : null,
          achievements: [],
          activity: []
        }
      };

      const accountRows = await rest(
        env,
        'accounts?select=id&username=eq.' + encodeURIComponent(username) + '&state=eq.active&system_account=eq.false&limit=1'
      );
      const id = accountRows?.[0]?.id;
      if (id && p.show_achievements) {
        const achievements = await rest(
          env,
          'user_achievements?select=unlocked_at,achievements(name,icon,description)&account_id=eq.' +
            encodeURIComponent(id) + '&status=eq.unlocked&order=unlocked_at.desc&limit=12'
        );
        payload.profile.achievements = (achievements || []).filter((x) => x.achievements).map((x) => ({
          name: x.achievements.name,
          icon: x.achievements.icon || '',
          description: x.achievements.description || '',
          unlockedAt: x.unlocked_at
        }));
      }
      return json(payload);
    }

    if (path === '/api/account/activity' && request.method === 'GET') {
      const auth = await requireAccount(request, env);
      if (auth.error) return auth.error;
      const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 25)));
      const rows = await rest(
        env,
        'activity_events?select=event_type,entity_type,entity_id,metadata,created_at&account_id=eq.' +
          encodeURIComponent(auth.account.id) + '&order=created_at.desc&limit=' + limit
      );
      return json({ activity: rows || [] });
    }

    return json({ error: 'Account endpoint not found.' }, 404);
  } catch (error) {
    console.error('[ACCOUNT_API]', error?.message || error);
    return json({ error: error?.message || 'Account operation failed.' }, 500);
  }
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
  let path = 'accounts?select=id,username,display_name,state,created_at,system_account&order=created_at.desc&limit=' + limit;
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
