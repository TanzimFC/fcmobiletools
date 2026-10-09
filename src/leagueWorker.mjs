const PROFILE_COLUMNS = [
  'account_id','status','fc_mobile_uid','in_game_username','ovr','region_server',
  'preferred_languages','discord_handle','tournament_sizes','availability',
  'play_style','notes','avatar_url','updated_at'
].join(',');

const LISTING_COLUMNS = [
  'id','owner_account_id','slug','name','description','logo_url','league_game_id',
  'region_server','preferred_languages','min_ovr','tournament_frequency',
  'tournament_sizes','discord_required','player_commitment','weekly_rewards',
  'discord_invite_url','contact_discord','open_spots','recruiting_open','status','moderation_note',
  'last_kickoff_at','last_active_at','created_at','updated_at'
].join(',');

const ACTIVE_ACCOUNT_BLOCKS = new Set(['closed','fraud_removed','frozen','restricted']);
const PROFILE_STATUSES = new Set(['looking_for_league','in_a_league','league_owner','not_looking']);
const FREQUENCIES = new Set(['daily','most_days','several_weekly','weekly','occasional']);
const SIZES = new Set(['4v4','8v8','16v16','32v32']);
const COMMITMENTS = new Set(['casual','regular','competitive']);
const LANGUAGES = new Set(['English','Bengali','Indonesian','Arabic','Spanish','French','Portuguese','Other']);

const clean = (value, max = 200) => String(value ?? '').trim().replace(/\u0000/g, '').slice(0, max);
const intInRange = (value, min, max) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const safeArray = (value, allowed, max = 6) =>
  [...new Set((Array.isArray(value) ? value : []).map(x => clean(x, 40)).filter(x => allowed.has(x)))].slice(0, max);
const utcStart = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString();
const nowIso = () => new Date().toISOString();

function imageUrl(value) {
  const raw = clean(value, 2048);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash ||
        !/^i\.ibb\.co(?:\.com)?$/i.test(u.hostname) || u.pathname.length < 2) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function inviteUrl(value) {
  const raw = clean(value, 500);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash ||
        !/^(?:discord\.gg|discord\.com|discordapp\.com)$/i.test(u.hostname) ||
        !/^\/(?:invite\/)?[a-z0-9-]+\/?$/i.test(u.pathname)) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function slugFor(value) {
  const base = clean(value, 70).toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'league';
  return base + '-' + Date.now().toString(36).slice(-7);
}

function accountIsBlocked(account) {
  return !account || ACTIVE_ACCOUNT_BLOCKS.has(String(account.state || ''));
}

async function loadLeagueProfile(env, accountId, supabaseRest) {
  const rows = await supabaseRest(env,
    'league_profiles?account_id=eq.' + encodeURIComponent(accountId) +
    '&select=' + encodeURIComponent(PROFILE_COLUMNS) + '&limit=1');
  return rows?.[0] || null;
}

async function requireUser(request, env, accountContext, json) {
  const context = await accountContext(request, env);
  if (!context) return { response: json({ error: 'Sign in to use Find a League.' }, 401) };
  if (accountIsBlocked(context.account)) {
    return { response: json({ error: 'This account cannot use league features right now.' }, 403) };
  }
  return { context };
}

function requireVerified(context, json) {
  if (!context.user?.email_confirmed_at) {
    return json({ error: 'Verify your email before making changes to your league profile.' }, 403);
  }
  return null;
}

function validateProfile(input) {
  const status = clean(input.status, 40);
  const uid = clean(input.fcMobileUid, 64);
  const inGameUsername = clean(input.inGameUsername, 40);
  const ovr = intInRange(input.ovr, 50, 200);
  const region = clean(input.regionServer, 60);
  const languages = safeArray(input.preferredLanguages, LANGUAGES, 5);
  const sizes = safeArray(input.tournamentSizes, SIZES, 4);
  const availability = clean(input.availability, 100);
  const playStyle = clean(input.playStyle, 60);
  const notes = clean(input.notes, 500);
  const discordHandle = clean(input.discordHandle, 100);
  const avatar = imageUrl(input.avatarUrl || '');
  if (!PROFILE_STATUSES.has(status)) throw new Error('Choose a profile status.');
  if (uid.length < 3) throw new Error('Enter your FC Mobile UID.');
  if (inGameUsername.length < 2) throw new Error('Enter your in-game username.');
  if (ovr === null) throw new Error('Enter a valid OVR between 50 and 200.');
  if (region.length < 2) throw new Error('Choose your region or server.');
  if (input.avatarUrl && avatar === undefined) throw new Error('Upload your profile image again.');
  return {
    status,
    fc_mobile_uid: uid,
    in_game_username: inGameUsername,
    ovr,
    region_server: region,
    preferred_languages: languages.length ? languages : ['English'],
    discord_handle: discordHandle || null,
    tournament_sizes: sizes,
    availability: availability || null,
    play_style: playStyle || null,
    notes: notes || null,
    avatar_url: avatar || null,
    updated_at: nowIso()
  };
}

function validateListing(input) {
  const name = clean(input.name, 70);
  const description = clean(input.description, 700);
  const logo = imageUrl(input.logoUrl || '');
  const invite = inviteUrl(input.discordInviteUrl || '');
  const contactDiscord = clean(input.contactDiscord, 100);
  const frequency = clean(input.tournamentFrequency, 32);
  const sizes = safeArray(input.tournamentSizes, SIZES, 4);
  const languages = safeArray(input.preferredLanguages, LANGUAGES, 5);
  const commitment = clean(input.playerCommitment, 24);
  const minOvr = intInRange(input.minOvr, 50, 200);
  const openSpots = intInRange(input.openSpots ?? 1, 0, 50);
  const region = clean(input.regionServer, 60);
  const gameId = clean(input.leagueGameId, 64);
  const rewards = clean(input.weeklyRewards, 300);
  if (name.length < 3) throw new Error('League name must have at least 3 characters.');
  if (description.length < 20) throw new Error('Add a short description of at least 20 characters.');
  if (input.logoUrl && logo === undefined) throw new Error('Upload the league crest again.');
  if (input.discordInviteUrl && invite === undefined) throw new Error('Enter a valid Discord invite link.');
  if (!FREQUENCIES.has(frequency)) throw new Error('Choose how often this league runs tournaments.');
  if (!sizes.length) throw new Error('Choose at least one tournament size.');
  if (!COMMITMENTS.has(commitment)) throw new Error('Choose the league commitment level.');
  if (minOvr === null) throw new Error('Enter a valid minimum OVR between 50 and 200.');
  if (openSpots === null) throw new Error('Enter a valid number of open spots.');
  if (region.length < 2) throw new Error('Choose the league region or server.');
  return {
    name,
    slug: slugFor(name),
    description,
    logo_url: logo || null,
    league_game_id: gameId || null,
    region_server: region,
    preferred_languages: languages.length ? languages : ['English'],
    min_ovr: minOvr,
    tournament_frequency: frequency,
    tournament_sizes: sizes,
    discord_required: Boolean(input.discordRequired),
    player_commitment: commitment,
    weekly_rewards: rewards || null,
    discord_invite_url: invite || null,
    contact_discord: contactDiscord || null,
    open_spots: openSpots,
    recruiting_open: input.recruitingOpen !== false,
    updated_at: nowIso()
  };
}

async function decorateListings(env, listings, supabaseRest) {
  if (!listings?.length) return [];
  const ownerIds = [...new Set(listings.map(row => row.owner_account_id).filter(Boolean))];
  const ownerRows = ownerIds.length
    ? await supabaseRest(env, 'accounts?select=id,username,display_name,avatar_url&id=in.' +
      encodeURIComponent('(' + ownerIds.join(',') + ')')).catch(() => [])
    : [];
  const owners = new Map((ownerRows || []).map(row => [row.id, row]));
  const now = Date.now();
  return listings.map(row => {
    const owner = owners.get(row.owner_account_id) || {};
    const kickoffAt = row.last_kickoff_at ? Date.parse(row.last_kickoff_at) : 0;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      logoUrl: row.logo_url || null,
      leagueGameId: row.league_game_id || '',
      regionServer: row.region_server,
      preferredLanguages: row.preferred_languages || [],
      minOvr: Number(row.min_ovr || 0),
      tournamentFrequency: row.tournament_frequency,
      tournamentSizes: row.tournament_sizes || [],
      discordRequired: Boolean(row.discord_required),
      playerCommitment: row.player_commitment,
      weeklyRewards: row.weekly_rewards || '',
      discordInviteUrl: row.discord_invite_url || null,
      contactDiscord: row.contact_discord || '',
      openSpots: Number(row.open_spots || 0),
      recruitingOpen: Boolean(row.recruiting_open),
      status: row.status,
      moderationNote: row.moderation_note || '',
      lastKickoffAt: row.last_kickoff_at || null,
      kickoffActive: kickoffAt > now - 6 * 60 * 60 * 1000,
      lastActiveAt: row.last_active_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      owner: {
        username: owner.username || 'FC Mobile player',
        displayName: owner.display_name || owner.username || 'FC Mobile player',
        avatarUrl: owner.avatar_url || null
      }
    };
  }).sort((a, b) => {
    if (a.kickoffActive !== b.kickoffActive) return a.kickoffActive ? -1 : 1;
    if (a.kickoffActive && b.kickoffActive) return Date.parse(b.lastKickoffAt || 0) - Date.parse(a.lastKickoffAt || 0);
    return Date.parse(b.lastActiveAt || b.createdAt || 0) - Date.parse(a.lastActiveAt || a.createdAt || 0);
  });
}

async function outreachUsage(env, accountId, supabaseRest) {
  const rows = await supabaseRest(env,
    'league_outreach?owner_account_id=eq.' + encodeURIComponent(accountId) +
    '&created_at=gte.' + encodeURIComponent(utcStart()) + '&select=id&limit=10');
  return (rows || []).length;
}

async function publicLeagues(env, supabaseRest) {
  const rows = await supabaseRest(env,
    'league_listings?status=eq.approved&recruiting_open=eq.true&select=' +
    encodeURIComponent(LISTING_COLUMNS) +
    '&order=last_kickoff_at.desc.nullslast,last_active_at.desc.nullslast,created_at.desc&limit=150');
  return decorateListings(env, rows || [], supabaseRest);
}

async function bootstrap(request, env, accountContext, supabaseRest, json) {
  const auth = await requireUser(request, env, accountContext, json);
  if (auth.response) return auth.response;
  const { account, user } = auth.context;
  let profile;
  try {
    profile = await loadLeagueProfile(env, account.id, supabaseRest);
  } catch (error) {
    console.error('[LEAGUE_PROFILE_READ]', error?.message);
    return json({ error: 'League profiles are temporarily unavailable.' }, 503);
  }

  const suggested = await supabaseRest(env,
    'account_game_profiles?account_id=eq.' + encodeURIComponent(account.id) +
    '&select=fc_mobile_uid,in_game_username,region_server,discord_handle&limit=1'
  ).catch(() => []);
  const gameProfile = suggested?.[0] || {};
  if (!profile) {
    return json({
      account: {
        id: account.id,
        username: account.username,
        displayName: account.display_name || account.username,
        avatarUrl: account.avatar_url || null,
        emailConfirmed: Boolean(user.email_confirmed_at)
      },
      profile: null,
      needsProfile: true,
      suggestedProfile: {
        fcMobileUid: gameProfile.fc_mobile_uid || '',
        inGameUsername: gameProfile.in_game_username || '',
        regionServer: gameProfile.region_server || '',
        discordHandle: gameProfile.discord_handle || ''
      },
      leagues: [],
      ownListings: [],
      approvedOwner: false,
      canFindPlayers: false,
      outreachUsedToday: 0,
      outreachRemaining: 3
    });
  }
  const [leagues, ownListings, recentConfirmations] = await Promise.all([
    publicLeagues(env, supabaseRest).catch(error => {
      console.error('[LEAGUE_DIRECTORY_READ]', error?.message);
      return [];
    }),
    supabaseRest(env,
      'league_listings?owner_account_id=eq.' + encodeURIComponent(account.id) +
      '&select=' + encodeURIComponent(LISTING_COLUMNS) + '&order=created_at.desc&limit=5'
    ).catch(() => []),
    supabaseRest(env,
      'league_active_confirmations?account_id=eq.' + encodeURIComponent(account.id) +
      '&created_at=gte.' + encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) +
      '&select=listing_id&limit=200'
    ).catch(() => [])
  ]);
  const confirmedIds = new Set((recentConfirmations || []).map(row => row.listing_id));
  const visibleLeagues = (leagues || []).map(row => ({ ...row, confirmedByMe: confirmedIds.has(row.id) }));
  const decoratedOwn = await decorateListings(env, ownListings || [], supabaseRest);
  const approvedOwner = profile.status === 'league_owner' && (ownListings || []).some(row => row.status === 'approved' && row.recruiting_open);
  const usedToday = approvedOwner ? await outreachUsage(env, account.id, supabaseRest).catch(() => 0) : 0;
  return json({
    account: {
      id: account.id,
      username: account.username,
      displayName: account.display_name || account.username,
      avatarUrl: account.avatar_url || null,
      emailConfirmed: Boolean(user.email_confirmed_at)
    },
    profile,
    needsProfile: !profile,
    suggestedProfile: {
      fcMobileUid: gameProfile.fc_mobile_uid || '',
      inGameUsername: gameProfile.in_game_username || '',
      regionServer: gameProfile.region_server || '',
      discordHandle: gameProfile.discord_handle || ''
    },
    leagues: visibleLeagues,
    ownListings: decoratedOwn,
    approvedOwner,
    canFindPlayers: approvedOwner,
    outreachUsedToday: usedToday,
    outreachRemaining: Math.max(0, 3 - usedToday)
  });
}

async function saveProfile(request, env, authContext, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const { account } = authContext;
  const input = await request.json().catch(() => ({}));
  let row;
  try {
    row = validateProfile(input);
  } catch (error) {
    return json({ error: error?.message || 'Check your league profile.' }, 400);
  }
  row.account_id = account.id;
  try {
    const saved = await supabaseRest(env,
      'league_profiles?on_conflict=account_id&select=' + encodeURIComponent(PROFILE_COLUMNS),
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([row])
      });
    return json({ ok: true, profile: saved?.[0] || row });
  } catch (error) {
    console.error('[LEAGUE_PROFILE_SAVE]', error?.message);
    return json({ error: 'Your league profile could not be saved. Please try again.' }, 500);
  }
}

async function createListing(request, env, authContext, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const { account } = authContext;
  const profile = await loadLeagueProfile(env, account.id, supabaseRest);
  if (!profile || profile.status !== 'league_owner') {
    return json({ error: 'Set your league profile status to League owner first.' }, 403);
  }
  const existing = await supabaseRest(env,
    'league_listings?owner_account_id=eq.' + encodeURIComponent(account.id) +
    '&status=in.(pending,approved,paused)&select=id,status&limit=1'
  );
  if (existing?.length) return json({ error: 'You already have a league listing. Edit it or contact admin if it needs review.' }, 409);

  let fields;
  try {
    fields = validateListing(await request.json().catch(() => ({})));
  } catch (error) {
    return json({ error: error?.message || 'Check your league listing.' }, 400);
  }
  const row = {
    ...fields,
    owner_account_id: account.id,
    status: 'pending',
    moderation_note: null,
    reviewed_by: null,
    reviewed_at: null
  };
  try {
    const saved = await supabaseRest(env, 'league_listings?select=' + encodeURIComponent(LISTING_COLUMNS), {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([row])
    });
    return json({ ok: true, listing: (await decorateListings(env, saved || [], supabaseRest))[0] || null }, 201);
  } catch (error) {
    console.error('[LEAGUE_LISTING_CREATE]', error?.message);
    if (/duplicate key|unique/i.test(String(error?.message || ''))) {
      return json({ error: 'This account already has a listing awaiting review.' }, 409);
    }
    return json({ error: 'The league listing could not be submitted. Please try again.' }, 500);
  }
}

async function updateListing(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const { account } = authContext;
  const id = match[1];
  const rows = await supabaseRest(env,
    'league_listings?id=eq.' + encodeURIComponent(id) +
    '&owner_account_id=eq.' + encodeURIComponent(account.id) +
    '&select=' + encodeURIComponent(LISTING_COLUMNS) + '&limit=1');
  const old = rows?.[0];
  if (!old) return json({ error: 'League listing not found.' }, 404);

  const input = await request.json().catch(() => ({}));
  let fields;
  try {
    fields = validateListing({
      name: old.name,
      description: input.description ?? old.description,
      logoUrl: input.logoUrl ?? old.logo_url,
      leagueGameId: input.leagueGameId ?? old.league_game_id,
      regionServer: input.regionServer ?? old.region_server,
      preferredLanguages: input.preferredLanguages ?? old.preferred_languages,
      minOvr: input.minOvr ?? old.min_ovr,
      tournamentFrequency: input.tournamentFrequency ?? old.tournament_frequency,
      tournamentSizes: input.tournamentSizes ?? old.tournament_sizes,
      discordRequired: input.discordRequired ?? old.discord_required,
      playerCommitment: input.playerCommitment ?? old.player_commitment,
      weeklyRewards: input.weeklyRewards ?? old.weekly_rewards,
      discordInviteUrl: input.discordInviteUrl ?? old.discord_invite_url,
      contactDiscord: input.contactDiscord ?? old.contact_discord,
      openSpots: input.openSpots ?? old.open_spots,
      recruitingOpen: input.recruitingOpen ?? old.recruiting_open
    });
  } catch (error) {
    return json({ error: error?.message || 'Check your league listing.' }, 400);
  }
  delete fields.slug;
  delete fields.name;
  const saved = await supabaseRest(env,
    'league_listings?id=eq.' + encodeURIComponent(id) +
    '&owner_account_id=eq.' + encodeURIComponent(account.id), {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        ...fields,
        status: 'pending',
        moderation_note: null,
        reviewed_by: null,
        reviewed_at: null,
        updated_at: nowIso()
      })
    });
  if (!saved?.length) return json({ error: 'League listing could not be updated.' }, 500);
  return json({ ok: true, status: 'pending', message: 'Your changes were sent for approval.' });
}

async function kickoff(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const result = await supabaseRest(env, 'rpc/server_league_kickoff', {
    method: 'POST',
    body: JSON.stringify({ p_listing_id: match[1], p_owner_account_id: authContext.account.id })
  });
  if (!result?.ok) {
    const status = result?.code === 'cooldown' ? 429 : result?.code === 'not_found' ? 404 : 403;
    return json({ error: result?.message || 'Kickoff is not available yet.', ...result }, status);
  }
  return json(result);
}

async function confirmActive(request, env, authContext, match, supabaseRest, json) {
  const result = await supabaseRest(env, 'rpc/server_league_confirm_active', {
    method: 'POST',
    body: JSON.stringify({ p_listing_id: match[1], p_account_id: authContext.account.id })
  });
  if (!result?.ok) {
    const status = result?.code === 'cooldown' ? 429 : result?.code === 'not_found' ? 404 : 403;
    return json({ error: result?.message || 'This league cannot be confirmed right now.', ...result }, status);
  }
  return json(result);
}

async function listPlayers(request, env, authContext, url, supabaseRest, json) {
  const { account } = authContext;
  const profile = await loadLeagueProfile(env, account.id, supabaseRest);
  if (profile?.status !== 'league_owner') return json({ error: 'Set your profile status to League owner before searching for players.' }, 403);
  const own = await supabaseRest(env,
    'league_listings?owner_account_id=eq.' + encodeURIComponent(account.id) +
    '&status=eq.approved&recruiting_open=eq.true&select=id&limit=1');
  if (!own?.length) return json({ error: 'Player search is available to approved league owners with recruitment open.' }, 403);

  const staleBefore = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await supabaseRest(env,
    'league_profiles?status=eq.looking_for_league&updated_at=gte.' + encodeURIComponent(staleBefore) +
    '&select=account_id,ovr,region_server,preferred_languages,tournament_sizes,availability,play_style,notes,avatar_url,updated_at&order=updated_at.desc&limit=150');
  const ids = (rows || []).map(row => row.account_id).filter(Boolean);
  const accounts = ids.length ? await supabaseRest(env,
    'accounts?select=id,username,display_name,avatar_url&id=in.' + encodeURIComponent('(' + ids.join(',') + ')'))
    : [];
  const accountMap = new Map((accounts || []).map(row => [row.id, row]));
  let players = (rows || []).map(row => {
    const a = accountMap.get(row.account_id) || {};
    return {
      accountId: row.account_id,
      username: a.username || 'FC Mobile player',
      displayName: a.display_name || a.username || 'FC Mobile player',
      avatarUrl: row.avatar_url || a.avatar_url || null,
      ovr: Number(row.ovr || 0),
      regionServer: row.region_server,
      preferredLanguages: row.preferred_languages || [],
      tournamentSizes: row.tournament_sizes || [],
      availability: row.availability || '',
      playStyle: row.play_style || '',
      notes: row.notes || '',
      updatedAt: row.updated_at
    };
  });
  const q = clean(url.searchParams.get('q'), 60).toLowerCase();
  const region = clean(url.searchParams.get('region'), 60).toLowerCase();
  const size = clean(url.searchParams.get('size'), 12);
  const minOvr = intInRange(url.searchParams.get('minOvr') || 50, 50, 200) || 50;
  if (q) players = players.filter(p => (p.displayName + ' ' + p.username + ' ' + p.regionServer).toLowerCase().includes(q));
  if (region) players = players.filter(p => p.regionServer.toLowerCase().includes(region));
  if (size) players = players.filter(p => p.tournamentSizes.includes(size));
  players = players.filter(p => p.ovr >= minOvr);
  return json({ players });
}

async function revealPlayer(request, env, authContext, match, supabaseRest, json) {
  const playerId = match[1];
  if (playerId === authContext.account.id) return json({ error: 'You cannot contact your own player profile.' }, 400);
  const usage = await supabaseRest(env, 'rpc/server_league_reveal_player', {
    method: 'POST',
    body: JSON.stringify({
      p_owner_account_id: authContext.account.id,
      p_player_account_id: playerId
    })
  });
  if (!usage?.ok) {
    const status = usage?.code === 'daily_limit' ? 429 : usage?.code === 'not_found' ? 404 : 403;
    return json({ error: usage?.message || 'This player cannot be contacted from your account.', ...usage }, status);
  }
  const rows = await supabaseRest(env,
    'league_profiles?account_id=eq.' + encodeURIComponent(playerId) +
    '&status=eq.looking_for_league&select=fc_mobile_uid,in_game_username,ovr,region_server,discord_handle,preferred_languages,tournament_sizes,availability,play_style,notes,avatar_url,updated_at&limit=1');
  if (!rows?.[0]) return json({ error: 'This player is no longer looking for a league.' }, 404);
  const p = rows[0];
  return json({
    ok: true,
    usedToday: Number(usage.used_today || 0),
    remainingToday: Number(usage.remaining_today ?? Math.max(0, 3 - Number(usage.used_today || 0))),
    alreadyRevealed: Boolean(usage.already_revealed),
    player: {
      fcMobileUid: p.fc_mobile_uid,
      inGameUsername: p.in_game_username,
      ovr: Number(p.ovr || 0),
      regionServer: p.region_server,
      discordHandle: p.discord_handle || '',
      preferredLanguages: p.preferred_languages || [],
      tournamentSizes: p.tournament_sizes || [],
      availability: p.availability || '',
      playStyle: p.play_style || '',
      notes: p.notes || '',
      avatarUrl: p.avatar_url || null
    }
  });
}

async function adminApi(request, env, url, authenticated, supabaseRest, json) {
  if (!(await authenticated(request, env))) return json({ error: 'Authentication required.' }, 401);
  if (request.method === 'GET' && url.pathname === '/api/admin/leagues') {
    const requested = clean(url.searchParams.get('status') || 'pending', 20);
    const status = ['pending','approved','rejected','paused','removed','all'].includes(requested) ? requested : 'pending';
    const query = 'league_listings?select=' + encodeURIComponent(LISTING_COLUMNS) +
      (status === 'all' ? '' : '&status=eq.' + encodeURIComponent(status)) +
      '&order=created_at.desc&limit=150';
    const rows = await supabaseRest(env, query);
    const decorated = await decorateListings(env, rows || [], supabaseRest);
    const ownerIds = [...new Set((rows || []).map(row => row.owner_account_id).filter(Boolean))];
    const profileRows = ownerIds.length ? await supabaseRest(env,
      'league_profiles?select=account_id,fc_mobile_uid,in_game_username,ovr,region_server,discord_handle&account_id=in.' +
      encodeURIComponent('(' + ownerIds.join(',') + ')')) : [];
    const ownerProfiles = new Map((profileRows || []).map(row => [row.account_id, row]));
    const ownerByListingId = new Map((rows || []).map(row => [row.id, row.owner_account_id]));
    return json({ listings: decorated.map(row => ({
      ...row,
      ownerGameProfile: (() => {
        const p = ownerProfiles.get(ownerByListingId.get(row.id)) || {};
        return {
          fcMobileUid: p.fc_mobile_uid || '',
          inGameUsername: p.in_game_username || '',
          ovr: Number(p.ovr || 0),
          regionServer: p.region_server || '',
          discordHandle: p.discord_handle || ''
        };
      })()
    })) });
  }
  const review = url.pathname.match(/^\/api\/admin\/leagues\/([0-9a-f-]+)\/review$/i);
  if (review && request.method === 'POST') {
    const input = await request.json().catch(() => ({}));
    const status = clean(input.status, 20);
    if (!['approved','rejected','paused','removed'].includes(status)) {
      return json({ error: 'Choose a valid review action.' }, 400);
    }
    const note = clean(input.note, 500);
    const patch = {
      status,
      moderation_note: note || null,
      reviewed_by: 'site-admin',
      reviewed_at: nowIso(),
      updated_at: nowIso()
    };
    const updated = await supabaseRest(env,
      'league_listings?id=eq.' + encodeURIComponent(review[1]) + '&select=id,status',
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch)
      });
    if (!updated?.length) return json({ error: 'League listing not found.' }, 404);
    return json({ ok: true, status: updated[0].status });
  }
  return json({ error: 'Admin league endpoint not found.' }, 404);
}

export async function leagueWorkerRoute({ request, env, url, authenticated, accountContext, supabaseRest, json }) {
  if (url.pathname === '/api/admin/leagues' || url.pathname.startsWith('/api/admin/leagues/')) {
    return adminApi(request, env, url, authenticated, supabaseRest, json);
  }
  if (!url.pathname.startsWith('/api/leagues/')) return null;
  try {
    if (request.method === 'GET' && url.pathname === '/api/leagues/bootstrap') {
      return await bootstrap(request, env, accountContext, supabaseRest, json);
    }
    if (!['GET','POST','PUT','PATCH'].includes(request.method)) {
      return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST, PUT, PATCH' });
    }
    const auth = await requireUser(request, env, accountContext, json);
    if (auth.response) return auth.response;
    const { context } = auth;
    if (request.method === 'POST' && url.pathname === '/api/leagues/profile') {
      return await saveProfile(request, env, context, supabaseRest, json);
    }
    const leagueProfile = await loadLeagueProfile(env, context.account.id, supabaseRest);
    if (!leagueProfile) {
      return json({ error: 'Complete your league profile first.', needsProfile: true }, 428);
    }
    if (request.method === 'POST' && url.pathname === '/api/leagues/listings') {
      return await createListing(request, env, context, supabaseRest, json);
    }
    const updateMatch = url.pathname.match(/^\/api\/leagues\/listings\/([0-9a-f-]+)\/update$/i);
    if (request.method === 'POST' && updateMatch) {
      return await updateListing(request, env, context, updateMatch, supabaseRest, json);
    }
    const kickoffMatch = url.pathname.match(/^\/api\/leagues\/listings\/([0-9a-f-]+)\/kickoff$/i);
    if (request.method === 'POST' && kickoffMatch) {
      return await kickoff(request, env, context, kickoffMatch, supabaseRest, json);
    }
    const activeMatch = url.pathname.match(/^\/api\/leagues\/listings\/([0-9a-f-]+)\/active$/i);
    if (request.method === 'POST' && activeMatch) {
      return await confirmActive(request, env, context, activeMatch, supabaseRest, json);
    }
    if (request.method === 'GET' && url.pathname === '/api/leagues/players') {
      return await listPlayers(request, env, context, url, supabaseRest, json);
    }
    const revealMatch = url.pathname.match(/^\/api\/leagues\/players\/([0-9a-f-]+)\/reveal$/i);
    if (request.method === 'POST' && revealMatch) {
      const blocked = requireVerified(context, json);
      if (blocked) return blocked;
      return await revealPlayer(request, env, context, revealMatch, supabaseRest, json);
    }
    if (request.method === 'POST' && url.pathname === '/api/leagues/listings') {
      return await createListing(request, env, context, supabaseRest, json);
    }
    return json({ error: 'League endpoint not found.' }, 404);
  } catch (error) {
    console.error('[LEAGUE_API]', error?.message || error);
    return json({ error: 'League features are temporarily unavailable. Please try again.' }, 500);
  }
}
