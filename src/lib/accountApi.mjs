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
