// Find a League API.
// Same export + signature as before, so src/worker.mjs does not change.
// Premium additions need supabase/migrations/20261010120000_league_premium.sql.
// Until that migration is applied the worker degrades gracefully to the original feature set.

const PROFILE_COLUMNS = [
  'account_id','status','fc_mobile_uid','in_game_username','ovr','region_server',
  'preferred_languages','discord_handle','tournament_sizes','availability',
  'play_style','notes','avatar_url','updated_at'
].join(',');

const BASE_LISTING_COLUMNS = [
  'id','owner_account_id','slug','name','description','logo_url','league_game_id',
  'region_server','preferred_languages','min_ovr','tournament_frequency',
  'tournament_sizes','discord_required','player_commitment','weekly_rewards',
  'discord_invite_url','contact_discord','open_spots','recruiting_open','status','moderation_note',
  'last_kickoff_at','last_active_at','created_at','updated_at'
];
const PREMIUM_LISTING_COLUMNS = ['tagline','active_hours','is_verified','is_featured','featured_until'];
const ADMIN_LISTING_COLUMNS = ['admin_note','reviewed_by','reviewed_at'];

const ACTIVE_ACCOUNT_BLOCKS = new Set(['closed','fraud_removed','frozen','restricted']);
const PROFILE_STATUSES = new Set(['looking_for_league','in_a_league','league_owner','not_looking']);
const FREQUENCIES = new Set(['daily','most_days','several_weekly','weekly','occasional']);
const SIZES = new Set(['4v4','8v8','16v16','32v32']);
const COMMITMENTS = new Set(['casual','regular','competitive']);
const LANGUAGES = new Set(['English','Bengali','Indonesian','Arabic','Spanish','French','Portuguese','Other']);
const REPORT_REASONS = new Set(['fake_or_misleading','inactive','inappropriate','spam','other']);
const ADMIN_STATUSES = ['pending','approved','rejected','paused','removed'];
const DAILY_OUTREACH = 3;
const KICKOFF_MS = 6 * 60 * 60 * 1000;
const UUID_RE = '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})';

const clean = (value, max = 200) => String(value ?? '').trim().replace(/\u0000/g, '').slice(0, max);
const intInRange = (value, min, max) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const safeArray = (value, allowed, max = 6) =>
  [...new Set((Array.isArray(value) ? value : []).map(x => clean(x, 40)).filter(x => allowed.has(x)))].slice(0, max);
const utcStart = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString();
const nowIso = () => new Date().toISOString();
const inList = (ids) => encodeURIComponent('(' + ids.join(',') + ')');
const isMissingSchema = (error) =>
  /column|does not exist|schema cache|could not find the function|undefined_function/i.test(String(error?.message || ''));

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
  return base + '-' + Date.now().toString(36).slice(-7) + Math.random().toString(36).slice(2, 4);
}

function accountIsBlocked(account) {
  return !account || ACTIVE_ACCOUNT_BLOCKS.has(String(account.state || ''));
}

// ───────────────────────── data access helpers ─────────────────────────

async function loadLeagueProfile(env, accountId, supabaseRest) {
  const rows = await supabaseRest(env,
    'league_profiles?account_id=eq.' + encodeURIComponent(accountId) +
    '&select=' + encodeURIComponent(PROFILE_COLUMNS) + '&limit=1');
  return rows?.[0] || null;
}

// Reads listings with the premium columns; if the migration has not been applied yet
// falls back to the original columns so the live site never goes dark during a deploy.
async function readListings(env, supabaseRest, queryTail, { admin = false } = {}) {
  const premiumCols = [...BASE_LISTING_COLUMNS, ...PREMIUM_LISTING_COLUMNS, ...(admin ? ADMIN_LISTING_COLUMNS : [])];
  try {
    const rows = await supabaseRest(env, 'league_listings?select=' + encodeURIComponent(premiumCols.join(',')) + queryTail);
    return { rows: rows || [], premium: true };
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    const rows = await supabaseRest(env, 'league_listings?select=' + encodeURIComponent(BASE_LISTING_COLUMNS.join(',')) + queryTail);
    return { rows: rows || [], premium: false };
  }
}

async function rpc(env, supabaseRest, name, args) {
  return supabaseRest(env, 'rpc/' + name, { method: 'POST', body: JSON.stringify(args) });
}

function decorateListings(listings, ownerMap, { admin = false, includeNote = false, signals = null, viewerId = '' } = {}) {
  const now = Date.now();
  return (listings || []).map(row => {
    const owner = ownerMap.get(row.owner_account_id) || {};
    const kickoffAt = row.last_kickoff_at ? Date.parse(row.last_kickoff_at) : 0;
    const featuredUntil = row.featured_until ? Date.parse(row.featured_until) : 0;
    const featured = Boolean(row.is_featured) && row.status === 'approved' && (!row.featured_until || featuredUntil > now);
    const signal = signals?.get(row.id) || {};
    const out = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline || '',
      description: row.description,
      logoUrl: row.logo_url || null,
      leagueGameId: row.league_game_id || '',
      regionServer: row.region_server,
      preferredLanguages: row.preferred_languages || [],
      minOvr: Number(row.min_ovr || 0),
      tournamentFrequency: row.tournament_frequency,
      tournamentSizes: row.tournament_sizes || [],
      activeHours: row.active_hours || '',
      discordRequired: Boolean(row.discord_required),
      playerCommitment: row.player_commitment,
      weeklyRewards: row.weekly_rewards || '',
      discordInviteUrl: row.discord_invite_url || null,
      contactDiscord: row.contact_discord || '',
      openSpots: Number(row.open_spots || 0),
      recruitingOpen: Boolean(row.recruiting_open),
      status: row.status,
      verified: Boolean(row.is_verified),
      featured,
      lastKickoffAt: row.last_kickoff_at || null,
      kickoffActive: kickoffAt > now - KICKOFF_MS,
      nextKickoffAt: kickoffAt ? new Date(kickoffAt + KICKOFF_MS).toISOString() : null,
      lastActiveAt: row.last_active_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmations7d: Number(signal.confirmations7d || 0),
      saves: Number(signal.saves || 0),
      isMine: Boolean(viewerId) && row.owner_account_id === viewerId,
      owner: {
        username: owner.username || 'FC Mobile player',
        displayName: owner.display_name || owner.username || 'FC Mobile player',
        avatarUrl: owner.avatar_url || null
      }
    };
    if (includeNote || admin) out.moderationNote = row.moderation_note || '';
    if (admin) {
      out.featuredUntil = row.featured_until || null;
      out.adminNote = row.admin_note || '';
      out.reviewedBy = row.reviewed_by || '';
      out.reviewedAt = row.reviewed_at || null;
    }
    return out;
  }).sort((a, b) => {
    if (a.kickoffActive !== b.kickoffActive) return a.kickoffActive ? -1 : 1;
    if (a.kickoffActive && b.kickoffActive) return Date.parse(b.lastKickoffAt || 0) - Date.parse(a.lastKickoffAt || 0);
    return Date.parse(b.lastActiveAt || b.createdAt || 0) - Date.parse(a.lastActiveAt || a.createdAt || 0);
  });
}

async function ownerMapFor(env, supabaseRest, listings) {
  const ids = [...new Set((listings || []).map(row => row.owner_account_id).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await supabaseRest(env, 'accounts?select=id,username,display_name,avatar_url&id=in.' + inList(ids)).catch(() => []);
  return new Map((rows || []).map(row => [row.id, row]));
}

async function outreachUsage(env, accountId, supabaseRest) {
  const rows = await supabaseRest(env,
    'league_outreach?owner_account_id=eq.' + encodeURIComponent(accountId) +
    '&created_at=gte.' + encodeURIComponent(utcStart()) + '&select=id&limit=20');
  return (rows || []).length;
}

// ───────────────────────── validation ─────────────────────────

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

function validateListing(input, premium) {
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
  const tagline = clean(input.tagline, 100);
  const activeHours = clean(input.activeHours, 60);
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
  const row = {
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
  if (premium) {
    row.tagline = tagline || null;
    row.active_hours = activeHours || null;
  }
  return row;
}

// ───────────────────────── player-facing handlers ─────────────────────────

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
  const accountOut = {
    id: account.id,
    username: account.username,
    displayName: account.display_name || account.username,
    avatarUrl: account.avatar_url || null,
    emailConfirmed: Boolean(user.email_confirmed_at)
  };
  const suggestedProfile = {
    fcMobileUid: gameProfile.fc_mobile_uid || '',
    inGameUsername: gameProfile.in_game_username || '',
    regionServer: gameProfile.region_server || '',
    discordHandle: gameProfile.discord_handle || ''
  };

  if (!profile) {
    return json({
      account: accountOut, profile: null, needsProfile: true, suggestedProfile,
      leagues: [], ownListings: [], ownerInsights: null, saved: [], approvedOwner: false,
      canFindPlayers: false, outreachUsedToday: 0, outreachRemaining: DAILY_OUTREACH, premiumReady: true
    });
  }

  const [directory, own, signalPack] = await Promise.all([
    readListings(env, supabaseRest,
      '&status=eq.approved&recruiting_open=eq.true' +
      '&order=last_kickoff_at.desc.nullslast,last_active_at.desc.nullslast,created_at.desc&limit=200'
    ).catch(error => {
      console.error('[LEAGUE_DIRECTORY_READ]', error?.message);
      return { rows: [], premium: true, failed: true };
    }),
    readListings(env, supabaseRest,
      '&owner_account_id=eq.' + encodeURIComponent(account.id) + '&order=created_at.desc&limit=5'
    ).catch(() => ({ rows: [], premium: true })),
    rpc(env, supabaseRest, 'server_league_directory_signals', { p_account_id: account.id }).catch(() => null)
  ]);

  const premiumReady = Boolean(directory.premium && signalPack);
  const signalMap = new Map((signalPack?.signals || []).map(s => [s.listingId, s]));
  const savedIds = new Set(signalPack?.saved || []);
  const confirmedIds = new Set(signalPack?.confirmedRecently || []);

  const owners = await ownerMapFor(env, supabaseRest, [...directory.rows, ...own.rows]);
  const leagues = decorateListings(directory.rows, owners, { signals: signalMap, viewerId: account.id }).map(row => ({
    ...row,
    saved: savedIds.has(row.id),
    confirmedByMe: confirmedIds.has(row.id)
  }));
  const ownListings = decorateListings(own.rows, owners, { includeNote: true, viewerId: account.id });

  const approvedOwner = profile.status === 'league_owner' &&
    own.rows.some(row => row.status === 'approved' && row.recruiting_open);
  const [usedToday, insights] = await Promise.all([
    approvedOwner ? outreachUsage(env, account.id, supabaseRest).catch(() => 0) : Promise.resolve(0),
    ownListings.length && ownListings[0].status !== 'removed'
      ? rpc(env, supabaseRest, 'server_league_owner_insights', { p_listing_id: ownListings[0].id, p_owner_account_id: account.id }).catch(() => null)
      : Promise.resolve(null)
  ]);

  return json({
    account: accountOut,
    profile,
    needsProfile: false,
    suggestedProfile,
    leagues,
    ownListings,
    ownerInsights: insights?.ok ? insights : null,
    approvedOwner,
    canFindPlayers: approvedOwner,
    outreachUsedToday: usedToday,
    outreachRemaining: Math.max(0, DAILY_OUTREACH - usedToday),
    premiumReady,
    directoryFailed: Boolean(directory.failed)
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

async function supportsPremiumColumns(env, supabaseRest) {
  try {
    await supabaseRest(env, 'league_listings?select=tagline&limit=1');
    return true;
  } catch (error) {
    if (isMissingSchema(error)) return false;
    throw error;
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
  if (existing?.length) return json({ error: 'You already have a league listing. Edit it instead of creating another.' }, 409);

  const premium = await supportsPremiumColumns(env, supabaseRest);
  let fields;
  try {
    fields = validateListing(await request.json().catch(() => ({})), premium);
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
    await supabaseRest(env, 'league_listings', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([row])
    });
    return json({ ok: true, status: 'pending', message: 'League submitted. It goes live after review.' }, 201);
  } catch (error) {
    console.error('[LEAGUE_LISTING_CREATE]', error?.message);
    if (/duplicate key|unique/i.test(String(error?.message || ''))) {
      return json({ error: 'This account already has a listing awaiting review.' }, 409);
    }
    return json({ error: 'The league listing could not be submitted. Please try again.' }, 500);
  }
}

async function loadOwnListing(env, supabaseRest, id, accountId) {
  const { rows, premium } = await readListings(env, supabaseRest,
    '&id=eq.' + encodeURIComponent(id) + '&owner_account_id=eq.' + encodeURIComponent(accountId) + '&limit=1');
  return { listing: rows[0] || null, premium };
}

async function updateListing(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const { account } = authContext;
  const id = match[1];
  const { listing: old, premium } = await loadOwnListing(env, supabaseRest, id, account.id);
  if (!old) return json({ error: 'League listing not found.' }, 404);
  if (old.status === 'removed') return json({ error: 'This listing was removed. Create a new listing instead.' }, 403);

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
      recruitingOpen: input.recruitingOpen ?? old.recruiting_open,
      tagline: input.tagline ?? old.tagline,
      activeHours: input.activeHours ?? old.active_hours
    }, premium);
  } catch (error) {
    return json({ error: error?.message || 'Check your league listing.' }, 400);
  }
  delete fields.slug;
  delete fields.name; // the name is locked after submission so reviewers and players see a stable identity
  try {
    const saved = await supabaseRest(env,
      'league_listings?id=eq.' + encodeURIComponent(id) + '&owner_account_id=eq.' + encodeURIComponent(account.id), {
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
  } catch (error) {
    console.error('[LEAGUE_LISTING_UPDATE]', error?.message);
    if (/duplicate key|unique/i.test(String(error?.message || ''))) {
      return json({ error: 'You already have another listing that is pending, live or paused.' }, 409);
    }
    return json({ error: 'League listing could not be updated.' }, 500);
  }
  return json({ ok: true, status: 'pending', message: 'Your changes were sent for review.' });
}

// Open spots and recruiting on/off are operational, not content, so they apply instantly without re-review.
async function quickUpdate(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const { account } = authContext;
  const { listing } = await loadOwnListing(env, supabaseRest, match[1], account.id);
  if (!listing) return json({ error: 'League listing not found.' }, 404);
  if (!['approved', 'pending'].includes(listing.status)) {
    return json({ error: 'Quick updates are available for live or pending listings.' }, 403);
  }
  const input = await request.json().catch(() => ({}));
  const patch = { updated_at: nowIso() };
  if (input.openSpots !== undefined) {
    const spots = intInRange(input.openSpots, 0, 50);
    if (spots === null) return json({ error: 'Open spots must be between 0 and 50.' }, 400);
    patch.open_spots = spots;
  }
  if (input.recruitingOpen !== undefined) patch.recruiting_open = Boolean(input.recruitingOpen);
  if (Object.keys(patch).length === 1) return json({ error: 'Nothing to update.' }, 400);
  const saved = await supabaseRest(env,
    'league_listings?id=eq.' + encodeURIComponent(match[1]) + '&owner_account_id=eq.' + encodeURIComponent(account.id) +
    '&status=in.(approved,pending)&select=id,open_spots,recruiting_open', {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch)
    });
  if (!saved?.length) return json({ error: 'League listing could not be updated.' }, 409);
  return json({ ok: true, openSpots: Number(saved[0].open_spots), recruitingOpen: Boolean(saved[0].recruiting_open) });
}

function rpcFailure(result, json, fallback) {
  const status = result?.code === 'cooldown' || result?.code === 'rate_limited' || result?.code === 'limit' ? 429
    : result?.code === 'not_found' ? 404
    : result?.code === 'duplicate' ? 409
    : result?.code === 'invalid_reason' ? 400 : 403;
  return json({ error: result?.message || fallback, ...result }, status);
}

async function kickoff(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const result = await rpc(env, supabaseRest, 'server_league_kickoff', {
    p_listing_id: match[1], p_owner_account_id: authContext.account.id
  });
  if (!result?.ok) return rpcFailure(result, json, 'Kickoff is not available yet.');
  return json(result);
}

async function confirmActive(request, env, authContext, match, supabaseRest, json) {
  const result = await rpc(env, supabaseRest, 'server_league_confirm_active', {
    p_listing_id: match[1], p_account_id: authContext.account.id
  });
  if (!result?.ok) return rpcFailure(result, json, 'This league cannot be confirmed right now.');
  return json(result);
}

async function toggleSave(request, env, authContext, match, supabaseRest, json) {
  const result = await rpc(env, supabaseRest, 'server_league_toggle_save', {
    p_listing_id: match[1], p_account_id: authContext.account.id
  });
  if (!result?.ok) return rpcFailure(result, json, 'This league could not be saved.');
  return json(result);
}

async function trackJoin(request, env, authContext, match, supabaseRest, json) {
  const result = await rpc(env, supabaseRest, 'server_league_track_join', {
    p_listing_id: match[1], p_account_id: authContext.account.id
  });
  if (!result?.ok) return rpcFailure(result, json, 'Join could not be recorded.');
  return json(result);
}

async function reportListing(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return json({ error: 'Verify your email before reporting a league.' }, 403);
  const input = await request.json().catch(() => ({}));
  const reason = clean(input.reason, 40);
  if (!REPORT_REASONS.has(reason)) return json({ error: 'Choose a reason for the report.' }, 400);
  const result = await rpc(env, supabaseRest, 'server_league_report', {
    p_listing_id: match[1], p_account_id: authContext.account.id,
    p_reason: reason, p_details: clean(input.details, 500)
  });
  if (!result?.ok) return rpcFailure(result, json, 'The report could not be sent.');
  return json({ ok: true, message: 'Thanks. The review team will take a look.' });
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
  const [rows, outreach] = await Promise.all([
    supabaseRest(env,
      'league_profiles?status=eq.looking_for_league&account_id=neq.' + encodeURIComponent(account.id) +
      '&updated_at=gte.' + encodeURIComponent(staleBefore) +
      '&select=account_id,ovr,region_server,preferred_languages,tournament_sizes,availability,play_style,notes,avatar_url,updated_at' +
      '&order=updated_at.desc&limit=200'),
    supabaseRest(env,
      'league_outreach?owner_account_id=eq.' + encodeURIComponent(account.id) + '&select=player_account_id&limit=1000'
    ).catch(() => [])
  ]);
  const revealedIds = new Set((outreach || []).map(row => row.player_account_id));
  const ids = (rows || []).map(row => row.account_id).filter(Boolean);
  const accounts = ids.length ? await supabaseRest(env,
    'accounts?select=id,username,display_name,avatar_url&id=in.' + inList(ids)).catch(() => []) : [];
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
      updatedAt: row.updated_at,
      revealed: revealedIds.has(row.account_id)
    };
  });
  const q = clean(url.searchParams.get('q'), 60).toLowerCase();
  const region = clean(url.searchParams.get('region'), 60).toLowerCase();
  const size = clean(url.searchParams.get('size'), 12);
  const lang = clean(url.searchParams.get('lang'), 40);
  const sort = clean(url.searchParams.get('sort'), 12);
  const minOvr = intInRange(url.searchParams.get('minOvr') || 50, 50, 200) || 50;
  if (q) players = players.filter(p => (p.displayName + ' ' + p.username + ' ' + p.regionServer).toLowerCase().includes(q));
  if (region) players = players.filter(p => p.regionServer.toLowerCase().includes(region));
  if (size) players = players.filter(p => p.tournamentSizes.includes(size));
  if (lang) players = players.filter(p => p.preferredLanguages.includes(lang));
  players = players.filter(p => p.ovr >= minOvr);
  if (sort === 'ovr') players.sort((a, b) => b.ovr - a.ovr);
  return json({ players });
}

async function revealPlayer(request, env, authContext, match, supabaseRest, json) {
  const playerId = match[1];
  if (playerId === authContext.account.id) return json({ error: 'You cannot contact your own player profile.' }, 400);
  const usage = await rpc(env, supabaseRest, 'server_league_reveal_player', {
    p_owner_account_id: authContext.account.id,
    p_player_account_id: playerId
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
    remainingToday: Number(usage.remaining_today ?? Math.max(0, DAILY_OUTREACH - Number(usage.used_today || 0))),
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

// ───────────────────────── admin API ─────────────────────────

async function adminListings(env, url, supabaseRest, json) {
  const requested = clean(url.searchParams.get('status') || 'pending', 20);
  const status = [...ADMIN_STATUSES, 'all'].includes(requested) ? requested : 'pending';
  const { rows, premium } = await readListings(env, supabaseRest,
    (status === 'all' ? '' : '&status=eq.' + encodeURIComponent(status)) + '&order=created_at.desc&limit=300',
    { admin: true });
  const owners = await ownerMapFor(env, supabaseRest, rows);
  const decorated = decorateListings(rows, owners, { admin: true });
  const ownerIds = [...new Set(rows.map(row => row.owner_account_id).filter(Boolean))];
  const ownerByListing = new Map(rows.map(row => [row.id, row.owner_account_id]));
  const [profileRows, reportRows] = await Promise.all([
    ownerIds.length ? supabaseRest(env,
      'league_profiles?select=account_id,fc_mobile_uid,in_game_username,ovr,region_server,discord_handle&account_id=in.' + inList(ownerIds)).catch(() => []) : [],
    supabaseRest(env, 'league_reports?status=eq.open&select=listing_id&limit=3000').catch(() => [])
  ]);
  const profiles = new Map((profileRows || []).map(row => [row.account_id, row]));
  const reportCounts = new Map();
  for (const r of reportRows || []) reportCounts.set(r.listing_id, (reportCounts.get(r.listing_id) || 0) + 1);
  return json({
    premiumReady: premium,
    listings: decorated.map(row => {
      const p = profiles.get(ownerByListing.get(row.id)) || {};
      return {
        ...row,
        openReports: reportCounts.get(row.id) || 0,
        ownerGameProfile: {
          fcMobileUid: p.fc_mobile_uid || '',
          inGameUsername: p.in_game_username || '',
          ovr: Number(p.ovr || 0),
          regionServer: p.region_server || '',
          discordHandle: p.discord_handle || ''
        }
      };
    })
  });
}

async function adminStats(env, supabaseRest, json) {
  try {
    const stats = await rpc(env, supabaseRest, 'server_league_admin_stats', {});
    return json({ ok: true, stats });
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    // Pre-migration fallback: derive what we can from the listing table.
    const rows = await supabaseRest(env, 'league_listings?select=status&limit=5000');
    const count = (s) => (rows || []).filter(r => r.status === s).length;
    return json({ ok: true, premiumReady: false, stats: {
      pending: count('pending'), approved: count('approved'), rejected: count('rejected'),
      paused: count('paused'), removed: count('removed'), total: (rows || []).length,
      openReports: 0, joinClicks7d: 0, saves: 0, confirmations7d: 0, playersLooking: 0, featuredLive: 0, verified: 0
    } });
  }
}

async function adminReports(env, url, supabaseRest, json) {
  const requested = clean(url.searchParams.get('status') || 'open', 20);
  const status = ['open', 'resolved', 'dismissed', 'all'].includes(requested) ? requested : 'open';
  const rows = await supabaseRest(env,
    'league_reports?select=id,listing_id,reporter_account_id,reason,details,status,resolved_by,resolved_at,created_at' +
    (status === 'all' ? '' : '&status=eq.' + encodeURIComponent(status)) +
    '&order=created_at.desc&limit=200');
  const listingIds = [...new Set((rows || []).map(r => r.listing_id))];
  const reporterIds = [...new Set((rows || []).map(r => r.reporter_account_id))];
  const [listings, reporters] = await Promise.all([
    listingIds.length ? supabaseRest(env, 'league_listings?select=id,name,status,logo_url,owner_account_id&id=in.' + inList(listingIds)).catch(() => []) : [],
    reporterIds.length ? supabaseRest(env, 'accounts?select=id,username,display_name&id=in.' + inList(reporterIds)).catch(() => []) : []
  ]);
  const listingMap = new Map((listings || []).map(l => [l.id, l]));
  const reporterMap = new Map((reporters || []).map(a => [a.id, a]));
  return json({ reports: (rows || []).map(r => ({
    id: r.id,
    listingId: r.listing_id,
    listingName: listingMap.get(r.listing_id)?.name || 'Unknown league',
    listingStatus: listingMap.get(r.listing_id)?.status || '',
    logoUrl: listingMap.get(r.listing_id)?.logo_url || null,
    reason: r.reason,
    details: r.details || '',
    status: r.status,
    reporter: reporterMap.get(r.reporter_account_id)?.display_name || reporterMap.get(r.reporter_account_id)?.username || 'Unknown',
    resolvedBy: r.resolved_by || '',
    resolvedAt: r.resolved_at || null,
    createdAt: r.created_at
  })) });
}

function adminRpcFailure(result, json, fallback) {
  const status = result?.code === 'not_found' ? 404
    : ['owner_has_open_listing', 'already_closed'].includes(result?.code) ? 409 : 400;
  return json({ error: result?.message || fallback, ...result }, status);
}

async function adminApi(request, env, url, authenticated, supabaseRest, json) {
  if (!(await authenticated(request, env))) return json({ error: 'Authentication required.' }, 401);
  try {
    const path = url.pathname;
    if (request.method === 'GET' && path === '/api/admin/leagues') return await adminListings(env, url, supabaseRest, json);
    if (request.method === 'GET' && path === '/api/admin/leagues/stats') return await adminStats(env, supabaseRest, json);
    if (request.method === 'GET' && path === '/api/admin/leagues/reports') return await adminReports(env, url, supabaseRest, json);

    const resolve = path.match(new RegExp('^/api/admin/leagues/reports/' + UUID_RE + '/resolve$', 'i'));
    if (resolve && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      const status = clean(input.status, 20);
      if (!['resolved', 'dismissed'].includes(status)) return json({ error: 'Choose resolve or dismiss.' }, 400);
      const result = await rpc(env, supabaseRest, 'server_league_admin_resolve_report', {
        p_report_id: resolve[1], p_status: status, p_actor: 'site-admin', p_note: clean(input.note, 500)
      });
      if (!result?.ok) return adminRpcFailure(result, json, 'Report could not be updated.');
      return json(result);
    }

    const review = path.match(new RegExp('^/api/admin/leagues/' + UUID_RE + '/review$', 'i'));
    if (review && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      const status = clean(input.status, 20);
      if (!['approved', 'rejected', 'paused', 'removed'].includes(status)) {
        return json({ error: 'Choose a valid review action.' }, 400);
      }
      const note = clean(input.note, 500);
      let result;
      try {
        result = await rpc(env, supabaseRest, 'server_league_admin_review', {
          p_listing_id: review[1], p_status: status, p_note: note, p_actor: 'site-admin'
        });
      } catch (error) {
        if (!isMissingSchema(error)) throw error;
        // Pre-migration fallback: original direct update.
        if (status !== 'approved' && !note) return json({ error: 'Add a short review note for this action.' }, 400);
        const updated = await supabaseRest(env, 'league_listings?id=eq.' + encodeURIComponent(review[1]) + '&select=id,status', {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ status, moderation_note: note || null, reviewed_by: 'site-admin', reviewed_at: nowIso(), updated_at: nowIso() })
        });
        if (!updated?.length) return json({ error: 'League listing not found.' }, 404);
        return json({ ok: true, status: updated[0].status });
      }
      if (!result?.ok) return adminRpcFailure(result, json, 'Review could not be saved.');
      return json(result);
    }

    const flags = path.match(new RegExp('^/api/admin/leagues/' + UUID_RE + '/flags$', 'i'));
    if (flags && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      const args = { p_listing_id: flags[1], p_actor: 'site-admin' };
      if (typeof input.verified === 'boolean') args.p_verified = input.verified;
      if (typeof input.featured === 'boolean') {
        args.p_featured = input.featured;
        const days = intInRange(input.featuredDays ?? 7, 1, 60);
        if (input.featured && days === null) return json({ error: 'Featured duration must be 1 to 60 days.' }, 400);
        if (input.featured) args.p_featured_days = days;
      }
      if (typeof input.adminNote === 'string') { args.p_admin_note = clean(input.adminNote, 1000); args.p_set_note = true; }
      const result = await rpc(env, supabaseRest, 'server_league_admin_set_flags', args);
      if (!result?.ok) return adminRpcFailure(result, json, 'Listing flags could not be updated.');
      return json(result);
    }

    const log = path.match(new RegExp('^/api/admin/leagues/' + UUID_RE + '/log$', 'i'));
    if (log && request.method === 'GET') {
      const rows = await supabaseRest(env,
        'league_moderation_log?listing_id=eq.' + encodeURIComponent(log[1]) +
        '&select=id,action,note,actor,created_at&order=created_at.desc&limit=50').catch(() => []);
      return json({ log: (rows || []).map(r => ({ id: r.id, action: r.action, note: r.note || '', actor: r.actor || '', createdAt: r.created_at })) });
    }
    return json({ error: 'Admin league endpoint not found.' }, 404);
  } catch (error) {
    console.error('[LEAGUE_ADMIN_API]', error?.message || error);
    return json({ error: 'League admin request failed. Please try again.' }, 500);
  }
}

// ───────────────────────── router ─────────────────────────

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
    const routes = [
      ['update', updateListing], ['quick', quickUpdate], ['kickoff', kickoff],
      ['active', confirmActive], ['save', toggleSave], ['join', trackJoin], ['report', reportListing]
    ];
    for (const [name, handler] of routes) {
      const m = url.pathname.match(new RegExp('^/api/leagues/listings/' + UUID_RE + '/' + name + '$', 'i'));
      if (request.method === 'POST' && m) return await handler(request, env, context, m, supabaseRest, json);
    }
    if (request.method === 'GET' && url.pathname === '/api/leagues/players') {
      return await listPlayers(request, env, context, url, supabaseRest, json);
    }
    const revealMatch = url.pathname.match(new RegExp('^/api/leagues/players/' + UUID_RE + '/reveal$', 'i'));
    if (request.method === 'POST' && revealMatch) {
      const blocked = requireVerified(context, json);
      if (blocked) return blocked;
      return await revealPlayer(request, env, context, revealMatch, supabaseRest, json);
    }
    return json({ error: 'League endpoint not found.' }, 404);
  } catch (error) {
    console.error('[LEAGUE_API]', error?.message || error);
    return json({ error: 'League features are temporarily unavailable. Please try again.' }, 500);
  }
}
