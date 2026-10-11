// Find a League API.
// Same export + signature as before, so src/worker.mjs does not change.
// Premium additions need supabase/migrations/20261010120000_league_premium.sql.
// Until that migration is applied the worker degrades gracefully to the original feature set.

import {
  ADMIN_LISTING_COLUMNS, KICKOFF_MS, inList, isMissingSchema, readListings, rpc, ownerMapFor,
  decorateListings, loadPublicDirectory, loadSitemapSlugs, pickSpotlight as pickSpotlightIds, SLUG_RE
} from './lib/leaguePublic.js';
import {
  DIVISION_KEYS, ACCENT_KEYS, JOIN_KEYS, RULES_VERSION, divisionOriginUrl, SITE_ORIGIN
} from './data/leagueConfig.js';

const PROFILE_COLUMNS = [
  'account_id','status','fc_mobile_uid','in_game_username','ovr','region_server',
  'preferred_languages','discord_handle','tournament_sizes','availability',
  'play_style','notes','avatar_url','share_uid','share_discord','updated_at'
].join(',');

const ACTIVE_ACCOUNT_BLOCKS = new Set(['closed','fraud_removed','frozen','restricted']);
const PROFILE_STATUSES = new Set(['looking_for_league','in_a_league','league_owner','not_looking']);
const FREQUENCIES = new Set(['daily','most_days','several_weekly','weekly','occasional']);
const SIZES = new Set(['4v4','8v8','16v16','32v32']);
const COMMITMENTS = new Set(['casual','regular','competitive']);
const LANGUAGES = new Set(['English','Bengali','Indonesian','Arabic','Spanish','French','Portuguese','Other']);
const REPORT_REASONS = new Set(['fake_or_misleading','inactive','inappropriate','spam','other']);
const ADMIN_STATUSES = ['pending','approved','rejected','paused','removed'];
const DAILY_OUTREACH = 3;
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

// One line, no markup, no pasted essays.
const oneLine = (value, max) => clean(String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' '), max);

function validateProfile(input) {
  const status = PROFILE_STATUSES.has(clean(input.status, 40)) ? clean(input.status, 40) : 'looking_for_league';
  const uid = oneLine(input.fcMobileUid, 64);
  const inGameUsername = oneLine(input.inGameUsername, 40);
  const ovr = intInRange(input.ovr, 50, 200);
  const region = clean(input.regionServer, 60);
  const languages = safeArray(input.preferredLanguages, LANGUAGES, 5);
  const sizes = safeArray(input.tournamentSizes, SIZES, 4);
  const availability = clean(input.availability, 100);
  const playStyle = clean(input.playStyle, 60);
  const notes = oneLine(input.notes, 160);
  const discordHandle = oneLine(input.discordHandle, 100);
  const avatar = imageUrl(input.avatarUrl || '');
  if (inGameUsername.length < 2) throw new Error('Enter your in-game name.');
  if (ovr === null) throw new Error('Enter a valid OVR between 50 and 200.');
  if (region.length < 2) throw new Error('Choose your region.');
  if (uid && uid.length < 3) throw new Error('That UID looks too short.');
  if (input.avatarUrl && avatar === undefined) throw new Error('Upload your profile image again.');
  return {
    status,
    fc_mobile_uid: uid || null,
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
    // Sharing is always the player's choice, per field.
    share_uid: Boolean(input.shareUid) && Boolean(uid),
    share_discord: Boolean(input.shareDiscord) && Boolean(discordHandle),
    updated_at: nowIso()
  };
}

function validateListing(input, premium) {
  const name = oneLine(input.name, 70);
  const pitch = oneLine(input.tagline ?? input.description, 100);
  const logo = imageUrl(input.logoUrl || '');
  const invite = inviteUrl(input.discordInviteUrl || '');
  const contactDiscord = oneLine(input.contactDiscord, 100);
  const frequency = clean(input.tournamentFrequency, 32);
  const sizes = safeArray(input.tournamentSizes, SIZES, 4);
  const languages = safeArray(input.preferredLanguages, LANGUAGES, 5);
  const commitment = clean(input.playerCommitment || 'regular', 24);
  const minOvr = intInRange(input.minOvr, 50, 200);
  const openSpots = intInRange(input.openSpots ?? 1, 0, 50);
  const region = clean(input.regionServer, 60);
  const gameId = oneLine(input.leagueGameId, 64);
  const perks = oneLine(input.perks ?? input.weeklyRewards, 80);
  const activeHours = oneLine(input.activeHours, 60);
  const division = clean(input.division, 20);
  const accent = ACCENT_KEYS.includes(clean(input.accent, 12)) ? clean(input.accent, 12) : 'cyan';
  const joinMethods = safeArray(input.joinMethods, new Set(JOIN_KEYS), 3);
  if (name.length < 3) throw new Error('League name must have at least 3 characters.');
  if (!DIVISION_KEYS.includes(division)) throw new Error('Choose your league division.');
  if (input.logoUrl && logo === undefined) throw new Error('Upload the league crest again.');
  if (input.discordInviteUrl && invite === undefined) throw new Error('Enter a valid Discord invite link.');
  if (!FREQUENCIES.has(frequency)) throw new Error('Choose how often you play tournaments.');
  if (!sizes.length) throw new Error('Choose at least one tournament size.');
  if (!COMMITMENTS.has(commitment)) throw new Error('Choose the league commitment level.');
  if (minOvr === null) throw new Error('Enter a valid minimum OVR between 50 and 200.');
  if (openSpots === null) throw new Error('Enter how many spots are open (0 to 50).');
  if (region.length < 2) throw new Error('Choose the league region.');
  if (!joinMethods.length) throw new Error('Choose at least one way to join.');
  if (joinMethods.includes('discord') && !invite) throw new Error('Add your Discord invite link, or remove “Join Discord”.');
  if (joinMethods.includes('in_game') && !gameId) throw new Error('Add your league ID, or remove “Search in game”.');
  const row = {
    name,
    slug: slugFor(name),
    description: '',
    logo_url: logo || null,
    league_game_id: gameId || null,
    region_server: region,
    preferred_languages: languages.length ? languages : ['English'],
    min_ovr: minOvr,
    tournament_frequency: frequency,
    tournament_sizes: sizes,
    discord_required: joinMethods.includes('discord') && Boolean(input.discordRequired),
    player_commitment: commitment,
    weekly_rewards: perks || null,
    discord_invite_url: invite || null,
    contact_discord: contactDiscord || null,
    open_spots: openSpots,
    recruiting_open: input.recruitingOpen !== false,
    updated_at: nowIso()
  };
  if (premium) {
    row.tagline = pitch || null;
    row.active_hours = activeHours || null;
    row.division = division;
    row.accent = accent;
    row.join_methods = joinMethods;
  }
  return row;
}

// ───────────────────────── player-facing handlers ─────────────────────────

async function bootstrap(request, env, accountContext, supabaseRest, json) {
  const auth = await requireUser(request, env, accountContext, json);
  if (auth.response) return auth.response;
  const { account, user } = auth.context;
  let profile = null;
  try {
    profile = await loadLeagueProfile(env, account.id, supabaseRest);
  } catch (error) {
    console.error('[LEAGUE_PROFILE_READ]', error?.message);
    return json({ error: 'League profiles are temporarily unavailable.' }, 503);
  }

  const suggested = profile ? [] : await supabaseRest(env,
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

  const [directory, own, signalPack, publicPack, crewPack, myApps] = await Promise.all([
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
    rpc(env, supabaseRest, 'server_league_directory_signals', { p_account_id: account.id }).catch(() => null),
    rpc(env, supabaseRest, 'server_league_public_signals', {}).catch(() => null),
    rpc(env, supabaseRest, 'server_league_crew_signals', { p_account_id: account.id }).catch(() => null),
    supabaseRest(env,
      'league_applications?applicant_account_id=eq.' + encodeURIComponent(account.id) +
      '&select=id,listing_id,status,created_at,status_changed_at&order=created_at.desc&limit=50').catch(() => [])
  ]);

  const crewMap = new Map((crewPack?.signals || []).map(s => [s.listingId, s]));
  const myRequestIds = new Set(crewPack?.myRequests || []);
  const myCrew = crewPack?.myCrew || null;
  const withCrew = (row) => {
    const c = crewMap.get(row.id) || {};
    return {
      ...row,
      crewCount: Number(c.crewCount || row.crewCount || 0),
      matchdays7d: Number(c.matchdays7d || row.matchdays7d || 0),
      matchdays14: c.matchdays14 || [],
      lastKickoffBy: c.lastKickoffBy || '',
      myCrewStatus: myCrew && myCrew.listingId === row.id && myCrew.status === 'approved' ? 'approved'
        : myRequestIds.has(row.id) ? 'pending' : ''
    };
  };

  const signalMap = new Map();
  for (const sig of (Array.isArray(publicPack) ? publicPack : [])) signalMap.set(sig.listingId, { ...sig });
  for (const sig of (signalPack?.signals || [])) signalMap.set(sig.listingId, { ...(signalMap.get(sig.listingId) || {}), ...sig });
  const savedIds = new Set(signalPack?.saved || []);
  const confirmedIds = new Set(signalPack?.confirmedRecently || []);
  const myAppByListing = new Map((myApps || []).map(a => [a.listing_id, a]));

  const owners = await ownerMapFor(env, supabaseRest, [...directory.rows, ...own.rows]);
  const leagues = decorateListings(directory.rows, owners, { signals: signalMap, viewerId: account.id }).map(row => ({
    ...withCrew(row),
    saved: savedIds.has(row.id),
    confirmedByMe: confirmedIds.has(row.id),
    myApplication: myAppByListing.get(row.id)
      ? { id: myAppByListing.get(row.id).id, status: myAppByListing.get(row.id).status } : null
  }));
  const spotlight = pickSpotlightIds(leagues);
  let ownListings = decorateListings(own.rows, owners, { includeNote: true, viewerId: account.id, signals: signalMap }).map(withCrew);
  let ownerCrew = [];
  if (crewPack && ownListings[0]?.status === 'approved') {
    const oc = await rpc(env, supabaseRest, 'server_league_owner_crew', {
      p_listing_id: ownListings[0].id, p_owner_account_id: account.id
    }).catch(() => null);
    if (oc?.ok) {
      ownerCrew = oc.crew || [];
      ownListings = ownListings.map((row, i) => i === 0 ? {
        ...row, matchdays14: oc.matchdays14 || [], matchdays7d: Number(oc.matchdays7d || 0),
        crewCount: ownerCrew.filter(m => m.status === 'approved').length
      } : row);
    }
  }

  const liveOwn = own.rows.find(row => row.status === 'approved');
  const approvedOwner = Boolean(liveOwn && liveOwn.recruiting_open);
  let newApplications = 0;
  if (liveOwn) {
    const counts = await supabaseRest(env,
      'league_applications?listing_id=eq.' + encodeURIComponent(liveOwn.id) + '&status=eq.new&select=id&limit=100').catch(() => []);
    newApplications = (counts || []).length;
  }
  const usedToday = approvedOwner ? await outreachUsage(env, account.id, supabaseRest).catch(() => 0) : 0;
  const appealRows = ownListings.length ? await supabaseRest(env,
    'league_listing_appeals?owner_account_id=eq.' + encodeURIComponent(account.id) +
    '&select=listing_id,status,review_note,created_at&order=created_at.desc&limit=50').catch(() => []) : [];
  const appealsByListing = new Map();
  for (const appeal of (appealRows || [])) if (!appealsByListing.has(appeal.listing_id)) appealsByListing.set(appeal.listing_id, appeal);
  ownListings = ownListings.map(row => {
    const appeal = appealsByListing.get(row.id);
    return { ...row, appealStatus: appeal?.status || '', appealNote: appeal?.review_note || '' };
  });

  return json({
    account: accountOut,
    profile,
    suggestedProfile,
    leagues,
    spotlight,
    ownListings,
    savedCount: savedIds.size,
    crewReady: Boolean(crewPack),
    myCrew,
    ownerCrew,
    myApplications: (myApps || []).map(a => ({ id: a.id, listingId: a.listing_id, status: a.status, createdAt: a.created_at })),
    newApplications,
    approvedOwner,
    canFindPlayers: approvedOwner,
    outreachUsedToday: usedToday,
    outreachRemaining: Math.max(0, DAILY_OUTREACH - usedToday),
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

async function createListing(request, env, authContext, supabaseRest, json, purge) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const { account } = authContext;
  const existing = await supabaseRest(env,
    'league_listings?owner_account_id=eq.' + encodeURIComponent(account.id) +
    '&status=in.(pending,approved,paused,rejected)&select=id,status&limit=1'
  );
  if (existing?.length) return json({ error: 'You already have a league listing. Edit it instead of creating another.' }, 409);

  const premium = await supportsPremiumColumns(env, supabaseRest);
  if (!premium) return json({ error: 'League listings are being upgraded. Please try again shortly.' }, 503);
  const input = await request.json().catch(() => ({}));
  if (input.acceptRules !== true) return json({ error: 'Agree to the league rules to list your league.' }, 400);
  let fields;
  try {
    fields = validateListing(input, premium);
  } catch (error) {
    return json({ error: error?.message || 'Check your league listing.' }, 400);
  }
  const row = {
    ...fields,
    owner_account_id: account.id,
    status: 'approved',
    is_sample: false,
    rules_accepted_at: nowIso(),
    rules_version: RULES_VERSION,
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
    purge?.(row.slug);
    return json({ ok: true, slug: row.slug, url: '/leagues/' + row.slug + '/', message: 'Your league is live.' }, 201);
  } catch (error) {
    console.error('[LEAGUE_LISTING_CREATE]', error?.message);
    if (/duplicate key|unique/i.test(String(error?.message || ''))) {
      return json({ error: 'You already have a league listing.' }, 409);
    }
    return json({ error: 'The league could not be listed. Please try again.' }, 500);
  }
}

async function loadOwnListing(env, supabaseRest, id, accountId) {
  const { rows, premium } = await readListings(env, supabaseRest,
    '&id=eq.' + encodeURIComponent(id) + '&owner_account_id=eq.' + encodeURIComponent(accountId) + '&limit=1');
  return { listing: rows[0] || null, premium };
}

async function updateListing(request, env, authContext, match, supabaseRest, json, purge) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const { account } = authContext;
  const id = match[1];
  const { listing: old, premium } = await loadOwnListing(env, supabaseRest, id, account.id);
  if (!old) return json({ error: 'League listing not found.' }, 404);
  if (old.status === 'removed') return json({ error: 'This listing was removed. Create a new listing instead.' }, 403);
  const resubmitting = old.status === 'rejected';

  const input = await request.json().catch(() => ({}));
  let fields;
  try {
    fields = validateListing({
      name: old.name,
      tagline: input.tagline ?? old.tagline,
      logoUrl: input.logoUrl ?? old.logo_url,
      leagueGameId: input.leagueGameId ?? old.league_game_id,
      regionServer: input.regionServer ?? old.region_server,
      preferredLanguages: input.preferredLanguages ?? old.preferred_languages,
      minOvr: input.minOvr ?? old.min_ovr,
      tournamentFrequency: input.tournamentFrequency ?? old.tournament_frequency,
      tournamentSizes: input.tournamentSizes ?? old.tournament_sizes,
      discordRequired: input.discordRequired ?? old.discord_required,
      playerCommitment: input.playerCommitment ?? old.player_commitment,
      perks: input.perks ?? old.weekly_rewards,
      discordInviteUrl: input.discordInviteUrl ?? old.discord_invite_url,
      contactDiscord: input.contactDiscord ?? old.contact_discord,
      openSpots: input.openSpots ?? old.open_spots,
      recruitingOpen: input.recruitingOpen ?? old.recruiting_open,
      activeHours: input.activeHours ?? old.active_hours,
      division: input.division ?? old.division,
      accent: input.accent ?? old.accent,
      joinMethods: input.joinMethods ?? old.join_methods
    }, premium);
  } catch (error) {
    return json({ error: error?.message || 'Check your league listing.' }, 400);
  }
  delete fields.slug;
  delete fields.name; // the name is locked so players always recognise the league
  try {
    const saved = await supabaseRest(env,
      'league_listings?id=eq.' + encodeURIComponent(id) + '&owner_account_id=eq.' + encodeURIComponent(account.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        // Edits go live straight away. The "Reviewed" badge is cleared because the team reviewed the old details.
        body: JSON.stringify({
          ...fields,
          ...(resubmitting ? { status: 'approved', moderation_note: null } : {}),
          reviewed_by: null, reviewed_at: null, updated_at: nowIso()
        })
      });
    if (!saved?.length) return json({ error: 'League listing could not be updated.' }, 500);
  } catch (error) {
    console.error('[LEAGUE_LISTING_UPDATE]', error?.message);
    return json({ error: 'League listing could not be updated.' }, 500);
  }
  purge?.(old.slug);
  return json({ ok: true, slug: old.slug, url: '/leagues/' + old.slug + '/', message: resubmitting ? 'Your league is live again.' : 'Saved.' });
}

// Open spots and recruiting on/off are operational, not content, so they apply instantly without re-review.
async function quickUpdate(request, env, authContext, match, supabaseRest, json, purge) {
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
  purge?.(listing.slug);
  return json({ ok: true, openSpots: Number(saved[0].open_spots), recruitingOpen: Boolean(saved[0].recruiting_open) });
}

function rpcFailure(result, json, fallback) {
  const status = result?.code === 'cooldown' || result?.code === 'rate_limited' || result?.code === 'limit' ? 429
    : result?.code === 'not_found' ? 404
    : result?.code === 'duplicate' ? 409
    : result?.code === 'invalid_reason' || result?.code === 'invalid' ? 400 : 403;
  return json({ error: result?.message || fallback, ...result }, status);
}

async function kickoff(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  let result;
  try {
    result = await rpc(env, supabaseRest, 'server_league_kickoff_v2', {
      p_listing_id: match[1], p_account_id: authContext.account.id
    });
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    // crew migration not applied yet: keep the original owner-only Kickoff
    result = await rpc(env, supabaseRest, 'server_league_kickoff', {
      p_listing_id: match[1], p_owner_account_id: authContext.account.id
    });
  }
  if (!result?.ok) return rpcFailure(result, json, 'Kickoff is not available yet.');
  return json(result);
}

// ───────────────────────── crew + matchday log ─────────────────────────

async function crewRequest(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const result = await rpc(env, supabaseRest, 'server_league_crew_request', {
    p_listing_id: match[1], p_account_id: authContext.account.id
  });
  if (!result?.ok) return rpcFailure(result, json, 'Your crew request could not be sent.');
  return json(result);
}

async function crewLeave(request, env, authContext, match, supabaseRest, json) {
  const result = await rpc(env, supabaseRest, 'server_league_crew_leave', {
    p_listing_id: match[1], p_account_id: authContext.account.id
  });
  if (!result?.ok) return rpcFailure(result, json, 'You are not in this crew.');
  return json(result);
}

async function crewDecide(request, env, authContext, match, supabaseRest, json) {
  const body = await request.json().catch(() => ({}));
  const accountId = clean(body.accountId, 64).toLowerCase();
  const action = clean(body.action, 16);
  if (!new RegExp('^' + UUID_RE + '$', 'i').test(accountId)) return json({ error: 'Choose a crew member.' }, 400);
  if (!['approve', 'decline', 'remove'].includes(action)) return json({ error: 'Unknown crew action.' }, 400);
  const result = await rpc(env, supabaseRest, 'server_league_crew_decide', {
    p_listing_id: match[1], p_owner_account_id: authContext.account.id, p_account_id: accountId, p_action: action
  });
  if (!result?.ok) return rpcFailure(result, json, 'That crew change could not be saved.');
  return json(result);
}

async function logMatchday(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const body = await request.json().catch(() => ({}));
  const size = clean(body.size, 10);
  if (!SIZES.has(size)) return json({ error: 'Choose a tournament size.' }, 400);
  const result = await rpc(env, supabaseRest, 'server_league_log_matchday', {
    p_listing_id: match[1], p_owner_account_id: authContext.account.id, p_size: size
  });
  if (!result?.ok) return rpcFailure(result, json, 'Tournament could not be logged.');
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
  const own = await supabaseRest(env,
    'league_listings?owner_account_id=eq.' + encodeURIComponent(account.id) +
    '&status=eq.approved&recruiting_open=eq.true&select=id&limit=1');
  if (!own?.length) return json({ error: 'Player search opens once your league is live with spots open.' }, 403);

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
    '&status=eq.looking_for_league&select=share_uid,share_discord,fc_mobile_uid,in_game_username,ovr,region_server,discord_handle,preferred_languages,tournament_sizes,availability,play_style,notes,avatar_url,updated_at&limit=1');
  if (!rows?.[0]) return json({ error: 'This player is no longer looking for a league.' }, 404);
  const p = rows[0];
  return json({
    ok: true,
    usedToday: Number(usage.used_today || 0),
    remainingToday: Number(usage.remaining_today ?? Math.max(0, DAILY_OUTREACH - Number(usage.used_today || 0))),
    alreadyRevealed: Boolean(usage.already_revealed),
    player: {
      fcMobileUid: p.share_uid ? (p.fc_mobile_uid || '') : '',
      uidShared: Boolean(p.share_uid),
      inGameUsername: p.in_game_username,
      ovr: Number(p.ovr || 0),
      regionServer: p.region_server,
      discordHandle: p.share_discord ? (p.discord_handle || '') : '',
      discordShared: Boolean(p.share_discord),
      preferredLanguages: p.preferred_languages || [],
      tournamentSizes: p.tournament_sizes || [],
      availability: p.availability || '',
      playStyle: p.play_style || '',
      notes: p.notes || '',
      avatarUrl: p.avatar_url || null
    }
  });
}

// Lightweight personal state for one league page (the page itself is public and cached).
async function leagueMe(request, env, authContext, url, supabaseRest, json) {
  const id = clean(url.searchParams.get('listing'), 40).toLowerCase();
  if (!new RegExp('^' + UUID_RE + '$', 'i').test(id)) return json({ error: 'Choose a league.' }, 400);
  const { account, user } = authContext;
  const q = (v) => encodeURIComponent(v);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [profile, listing, saved, savedCountRows, confirmed, app, crew, crewPack] = await Promise.all([
    loadLeagueProfile(env, account.id, supabaseRest).catch(() => null),
    readListings(env, supabaseRest, '&id=eq.' + q(id) + '&limit=1').then(r => r.rows[0] || null).catch(() => null),
    supabaseRest(env, 'league_saves?account_id=eq.' + q(account.id) + '&listing_id=eq.' + q(id) + '&select=listing_id&limit=1').catch(() => []),
    supabaseRest(env, 'league_saves?account_id=eq.' + q(account.id) + '&select=listing_id&limit=4').catch(() => []),
    supabaseRest(env, 'league_active_confirmations?account_id=eq.' + q(account.id) + '&listing_id=eq.' + q(id) + '&created_at=gte.' + q(since) + '&select=id&limit=1').catch(() => []),
    supabaseRest(env, 'league_applications?applicant_account_id=eq.' + q(account.id) + '&listing_id=eq.' + q(id) + '&select=id,status,created_at&limit=1').catch(() => []),
    supabaseRest(env, 'league_crew?account_id=eq.' + q(account.id) + '&listing_id=eq.' + q(id) + '&select=status&limit=1').catch(() => []),
    Promise.resolve(null)
  ]);
  let suggested = {};
  if (!profile) {
    const g = await supabaseRest(env, 'account_game_profiles?account_id=eq.' + q(account.id) + '&select=fc_mobile_uid,in_game_username,region_server,discord_handle&limit=1').catch(() => []);
    suggested = { fcMobileUid: g?.[0]?.fc_mobile_uid || '', inGameUsername: g?.[0]?.in_game_username || '', regionServer: g?.[0]?.region_server || '', discordHandle: g?.[0]?.discord_handle || '' };
  }
  const isMine = Boolean(listing) && listing.owner_account_id === account.id;
  const crewStatus = crew?.[0]?.status || '';
  return json({
    account: { id: account.id, username: account.username, displayName: account.display_name || account.username, emailConfirmed: Boolean(user.email_confirmed_at) },
    profile, suggested, isMine,
    saved: Boolean(saved?.length), savedCount: (savedCountRows || []).length, confirmedByMe: Boolean(confirmed?.length),
    application: app?.[0] ? { id: app[0].id, status: app[0].status, createdAt: app[0].created_at } : null,
    crewStatus,
    canKickoff: isMine || crewStatus === 'approved',
    lastKickoffAt: listing?.last_kickoff_at || null
  });
}

// ───────────────────────── applications ─────────────────────────

const APP_STATUSES = new Set(['new', 'shortlisted', 'invited', 'joined', 'declined']);

async function applyToLeague(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const input = await request.json().catch(() => ({}));
  const shot = imageUrl(input.screenshotUrl || '');
  if (input.screenshotUrl && shot === undefined) return json({ error: 'Upload your team screenshot again.' }, 400);
  const result = await rpc(env, supabaseRest, 'server_league_apply', {
    p_listing_id: match[1], p_account_id: authContext.account.id,
    p_message: oneLine(input.message, 200), p_screenshot_url: shot || null,
    p_share_uid: Boolean(input.shareUid), p_share_discord: Boolean(input.shareDiscord)
  });
  if (!result?.ok) return rpcFailure(result, json, 'Your application could not be sent.');
  return json({ ok: true, id: result.id, status: 'new', message: 'Application sent. The owner will review it.' }, 201);
}

async function listApplications(request, env, authContext, match, supabaseRest, json) {
  const { account } = authContext;
  const { listing } = await loadOwnListing(env, supabaseRest, match[1], account.id);
  if (!listing) return json({ error: 'League listing not found.' }, 404);
  const rows = await supabaseRest(env,
    'league_applications?listing_id=eq.' + encodeURIComponent(listing.id) +
    '&status=neq.withdrawn&select=id,applicant_account_id,status,message,screenshot_url,ovr,in_game_username,region_server,shared_uid,shared_discord,owner_note,created_at,status_changed_at' +
    '&order=created_at.desc&limit=100').catch(() => []);
  const ids = [...new Set((rows || []).map(r => r.applicant_account_id))];
  const accounts = ids.length ? await supabaseRest(env, 'accounts?select=id,username,display_name,avatar_url&id=in.' + inList(ids)).catch(() => []) : [];
  const accMap = new Map((accounts || []).map(a => [a.id, a]));
  return json({ applications: (rows || []).map(r => {
    const a = accMap.get(r.applicant_account_id) || {};
    return {
      id: r.id, accountId: r.applicant_account_id, status: r.status, message: r.message || '', screenshotUrl: r.screenshot_url || null,
      ovr: Number(r.ovr || 0), inGameUsername: r.in_game_username || '', regionServer: r.region_server || '',
      uid: r.shared_uid || '', discord: r.shared_discord || '', ownerNote: r.owner_note || '',
      username: a.username || '', displayName: a.display_name || a.username || 'FC Mobile player', avatarUrl: a.avatar_url || null,
      createdAt: r.created_at, statusChangedAt: r.status_changed_at
    };
  }) });
}

async function decideApplication(request, env, authContext, match, supabaseRest, json) {
  const input = await request.json().catch(() => ({}));
  const status = clean(input.status, 20);
  if (!APP_STATUSES.has(status)) return json({ error: 'Choose a valid status.' }, 400);
  const result = await rpc(env, supabaseRest, 'server_league_application_decide', {
    p_application_id: match[1], p_owner_account_id: authContext.account.id, p_status: status, p_note: oneLine(input.note, 300)
  });
  if (!result?.ok) return rpcFailure(result, json, 'That change could not be saved.');
  return json(result);
}

async function withdrawApplication(request, env, authContext, match, supabaseRest, json) {
  const result = await rpc(env, supabaseRest, 'server_league_application_withdraw', {
    p_application_id: match[1], p_account_id: authContext.account.id
  });
  if (!result?.ok) return rpcFailure(result, json, 'Could not withdraw this application.');
  return json(result);
}


async function openInboxConversation(request, env, authContext, match, supabaseRest, json) {
  const { account } = authContext;
  const listingId = match[1];
  const input = await request.json().catch(() => ({}));
  const listings = await supabaseRest(env,
    'league_listings?id=eq.' + encodeURIComponent(listingId) +
    '&select=id,owner_account_id,name,status,slug&limit=1');
  const listing = listings?.[0];
  if (!listing || !listing.owner_account_id) return json({ error: 'League listing not found.' }, 404);
  const isOwner = listing.owner_account_id === account.id;
  const applicantId = isOwner ? clean(input.applicantId, 64) : account.id;
  if (!applicantId || applicantId === listing.owner_account_id) {
    return json({ error: 'Choose a player who applied to this league.' }, 400);
  }
  if (!isOwner && listing.status === 'removed') return json({ error: 'This listing is no longer available.' }, 404);
  const application = await supabaseRest(env,
    'league_applications?listing_id=eq.' + encodeURIComponent(listingId) +
    '&applicant_account_id=eq.' + encodeURIComponent(applicantId) +
    '&status=neq.withdrawn&select=id&limit=1').catch(() => []);
  if (!application?.length) return json({ error: 'Inbox messages are available only between a league owner and a player who applied.' }, 403);
  const existing = await supabaseRest(env,
    'league_conversations?listing_id=eq.' + encodeURIComponent(listingId) +
    '&applicant_account_id=eq.' + encodeURIComponent(applicantId) + '&select=id&limit=1').catch(() => []);
  let conversationId = existing?.[0]?.id || '';
  if (!conversationId) {
    const inserted = await supabaseRest(env,
      'league_conversations?on_conflict=listing_id,applicant_account_id&select=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([{
          listing_id: listingId, owner_account_id: listing.owner_account_id,
          applicant_account_id: applicantId, updated_at: nowIso()
        }])
      });
    conversationId = inserted?.[0]?.id || '';
  }
  if (!conversationId) {
    const retry = await supabaseRest(env,
      'league_conversations?listing_id=eq.' + encodeURIComponent(listingId) +
      '&applicant_account_id=eq.' + encodeURIComponent(applicantId) + '&select=id&limit=1').catch(() => []);
    conversationId = retry?.[0]?.id || '';
  }
  if (!conversationId) return json({ error: 'Conversation could not be opened. Try again.' }, 500);
  return json({ ok: true, conversationId });
}

async function listInbox(request, env, authContext, supabaseRest, json) {
  const { account } = authContext;
  const columns = 'id,listing_id,owner_account_id,applicant_account_id,created_at,updated_at';
  const [owned, applied] = await Promise.all([
    supabaseRest(env, 'league_conversations?owner_account_id=eq.' + encodeURIComponent(account.id) +
      '&select=' + columns + '&order=updated_at.desc&limit=100').catch(() => []),
    supabaseRest(env, 'league_conversations?applicant_account_id=eq.' + encodeURIComponent(account.id) +
      '&select=' + columns + '&order=updated_at.desc&limit=100').catch(() => [])
  ]);
  const byId = new Map([...(owned || []), ...(applied || [])].map(row => [row.id, row]));
  const conversations = [...byId.values()].sort((a, b) => Date.parse(b.updated_at || 0) - Date.parse(a.updated_at || 0));
  if (!conversations.length) return json({ conversations: [] });
  const conversationIds = conversations.map(c => c.id);
  const listingIds = [...new Set(conversations.map(c => c.listing_id))];
  const accountIds = [...new Set(conversations.flatMap(c => [c.owner_account_id, c.applicant_account_id]))];
  const [messages, listings, accounts] = await Promise.all([
    supabaseRest(env, 'league_messages?conversation_id=in.' + inList(conversationIds) +
      '&select=id,conversation_id,sender_account_id,body,created_at,read_at&order=created_at.desc&limit=1200').catch(() => []),
    supabaseRest(env, 'league_listings?select=id,name,slug,logo_url&id=in.' + inList(listingIds)).catch(() => []),
    supabaseRest(env, 'accounts?select=id,username,display_name,avatar_url&id=in.' + inList(accountIds)).catch(() => [])
  ]);
  const listingMap = new Map((listings || []).map(row => [row.id, row]));
  const accountMap = new Map((accounts || []).map(row => [row.id, row]));
  const latest = new Map(), unread = new Map();
  for (const message of (messages || [])) {
    if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
    if (message.sender_account_id !== account.id && !message.read_at) unread.set(message.conversation_id, (unread.get(message.conversation_id) || 0) + 1);
  }
  return json({ conversations: conversations.map(row => {
    const listing = listingMap.get(row.listing_id) || {};
    const partnerId = row.owner_account_id === account.id ? row.applicant_account_id : row.owner_account_id;
    const partner = accountMap.get(partnerId) || {};
    const last = latest.get(row.id);
    return {
      id: row.id, listingId: row.listing_id, listingName: listing.name || 'League',
      slug: listing.slug || '', logoUrl: listing.logo_url || null,
      participantName: partner.display_name || partner.username || 'Member',
      lastMessage: last?.body ? clean(last.body, 180) : '',
      lastMessageAt: last?.created_at || row.updated_at, unreadCount: unread.get(row.id) || 0,
      updatedAt: row.updated_at
    };
  }) });
}

async function inboxConversation(request, env, authContext, match, supabaseRest, json) {
  const { account } = authContext;
  const conversationId = match[1];
  const rows = await supabaseRest(env,
    'league_conversations?id=eq.' + encodeURIComponent(conversationId) +
    '&select=id,listing_id,owner_account_id,applicant_account_id&limit=1').catch(() => []);
  const conversation = rows?.[0];
  if (!conversation) return json({ error: 'Conversation not found.' }, 404);
  if (![conversation.owner_account_id, conversation.applicant_account_id].includes(account.id)) {
    return json({ error: 'You are not part of this conversation.' }, 403);
  }
  if (request.method === 'GET') {
    await supabaseRest(env,
      'league_messages?conversation_id=eq.' + encodeURIComponent(conversationId) +
      '&sender_account_id=neq.' + encodeURIComponent(account.id) + '&read_at=is.null', {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ read_at: nowIso() })
      }).catch(() => null);
    const messages = await supabaseRest(env,
      'league_messages?conversation_id=eq.' + encodeURIComponent(conversationId) +
      '&select=id,conversation_id,sender_account_id,body,created_at&order=created_at.asc&limit=100');
    const senderIds = [...new Set((messages || []).map(row => row.sender_account_id))];
    const accounts = senderIds.length ? await supabaseRest(env,
      'accounts?select=id,username,display_name&id=in.' + inList(senderIds)).catch(() => []) : [];
    const accountMap = new Map((accounts || []).map(row => [row.id, row]));
    return json({ messages: (messages || []).map(row => ({
      id: row.id, senderAccountId: row.sender_account_id,
      senderName: accountMap.get(row.sender_account_id)?.display_name || accountMap.get(row.sender_account_id)?.username || 'Member',
      body: row.body, createdAt: row.created_at
    })) });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const input = await request.json().catch(() => ({}));
  const rawBody = typeof input.body === 'string' ? input.body.trim() : '';
  if (rawBody.length > 1200) return json({ error: 'Messages are limited to 1,200 characters.' }, 400);
  const body = clean(rawBody, 1200);
  if (!body) return json({ error: 'Write a message before sending.' }, 400);
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const recent = await supabaseRest(env,
    'league_messages?sender_account_id=eq.' + encodeURIComponent(account.id) +
    '&created_at=gte.' + encodeURIComponent(cutoff) + '&select=id&limit=11').catch(() => []);
  if ((recent || []).length >= 10) return json({ error: 'Message limit reached. Wait a minute before sending again.' }, 429);
  const inserted = await supabaseRest(env, 'league_messages?select=id,conversation_id,sender_account_id,body,created_at', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ conversation_id: conversationId, sender_account_id: account.id, body }])
  });
  await supabaseRest(env, 'league_conversations?id=eq.' + encodeURIComponent(conversationId), {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ updated_at: nowIso() })
  });
  const message = inserted?.[0];
  return json({ ok: true, message: message ? {
    id: message.id, senderAccountId: message.sender_account_id, body: message.body, createdAt: message.created_at
  } : null });
}

async function submitLeagueAppeal(request, env, authContext, match, supabaseRest, json) {
  const blocked = requireVerified(authContext, json);
  if (blocked) return blocked;
  const input = await request.json().catch(() => ({}));
  const reason = clean(input.reason, 1200);
  if (reason.length < 20) return json({ error: 'Add at least 20 characters so the moderation team can review your appeal.' }, 400);
  const result = await rpc(env, supabaseRest, 'server_league_submit_appeal', {
    p_listing_id: match[1], p_owner_account_id: authContext.account.id, p_reason: reason
  });
  if (!result?.ok) return rpcFailure(result, json, 'Your appeal could not be submitted.');
  return json(result);
}

// Join details are for signed-in players only.
async function listingContact(request, env, authContext, match, supabaseRest, json) {
  const { rows } = await readListings(env, supabaseRest, '&id=eq.' + encodeURIComponent(match[1]) + '&status=eq.approved&limit=1');
  const r = rows[0];
  if (!r) return json({ error: 'League not found.' }, 404);
  return json({ discordInviteUrl: r.discord_invite_url || null, contactDiscord: r.contact_discord || '', leagueGameId: r.league_game_id || '' });
}

// ───────────────────────── public (no sign-in) ─────────────────────────

const PUBLIC_CACHE = 'public, max-age=30, s-maxage=120, stale-while-revalidate=600';

async function publicDirectory(env, supabaseRest, json) {
  try {
    const data = await loadPublicDirectory(env, supabaseRest);
    return json(data, 200, { 'cache-control': PUBLIC_CACHE });
  } catch (error) {
    console.error('[LEAGUE_PUBLIC]', error?.message);
    return json({ error: 'The league board could not be loaded. Please try again.' }, 503, { 'cache-control': 'no-store' });
  }
}

// Division icons never change: fetched once from the origin, then served immutable from the edge.
async function divisionIcon(key, ctx) {
  const origin = divisionOriginUrl(key);
  if (!origin) return new Response('Not found', { status: 404 });
  const res = await fetch(origin, { cf: { cacheEverything: true, cacheTtl: 31536000 } });
  if (!res.ok) return new Response('Icon unavailable', { status: 502, headers: { 'cache-control': 'no-store' } });
  return new Response(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') || 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff'
    }
  });
}

async function leaguesSitemap(env, supabaseRest) {
  const rows = await loadSitemapSlugs(env, supabaseRest);
  const urls = [{ loc: SITE_ORIGIN + '/leagues/', lastmod: '' }, ...rows.map(r => ({
    loc: SITE_ORIGIN + '/leagues/' + r.slug + '/', lastmod: r.updated_at ? String(r.updated_at).slice(0, 10) : ''
  }))];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(u => '<url><loc>' + u.loc + '</loc>' + (u.lastmod ? '<lastmod>' + u.lastmod + '</lastmod>' : '') + '</url>').join('') + '</urlset>';
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

// ───────────────────────── admin API ─────────────────────────

async function adminListings(env, url, supabaseRest, json) {
  const requested = clean(url.searchParams.get('status') || 'pending', 20);
  const status = [...ADMIN_STATUSES, 'all', 'unreviewed'].includes(requested) ? requested : 'unreviewed';
  const filter = status === 'all' ? '' : status === 'unreviewed' ? '&status=eq.approved&reviewed_at=is.null&is_sample=eq.false' : '&status=eq.' + encodeURIComponent(status);
  const { rows, premium } = await readListings(env, supabaseRest,
    filter + '&order=created_at.desc&limit=300',
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
    // Listings go live at once, so the review queue is "live but not yet reviewed".
    const un = await supabaseRest(env, 'league_listings?status=eq.approved&reviewed_at=is.null&is_sample=eq.false&select=id&limit=5000').catch(() => []);
    const openAppeals = await supabaseRest(env, 'league_listing_appeals?status=eq.open&select=id&limit=5000').catch(() => []);
    return json({ ok: true, stats: { ...stats, unreviewed: (un || []).length, openAppeals: (openAppeals || []).length } });
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
    listingIds.length ? supabaseRest(env, 'league_listings?select=id,name,slug,status,logo_url,owner_account_id&id=in.' + inList(listingIds)).catch(() => []) : [],
    reporterIds.length ? supabaseRest(env, 'accounts?select=id,username,display_name&id=in.' + inList(reporterIds)).catch(() => []) : []
  ]);
  const listingMap = new Map((listings || []).map(l => [l.id, l]));
  const reporterMap = new Map((reporters || []).map(a => [a.id, a]));
  return json({ reports: (rows || []).map(r => ({
    id: r.id,
    listingId: r.listing_id,
    listingName: listingMap.get(r.listing_id)?.name || 'Unknown league',
    slug: listingMap.get(r.listing_id)?.slug || '',
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

async function adminAppeals(env, url, supabaseRest, json) {
  const requested = clean(url.searchParams.get('status') || 'open', 20);
  const status = ['open', 'approved', 'denied', 'all'].includes(requested) ? requested : 'open';
  const rows = await supabaseRest(env,
    'league_listing_appeals?select=id,listing_id,owner_account_id,reason,status,review_note,created_at,reviewed_at,reviewed_by' +
    (status === 'all' ? '' : '&status=eq.' + encodeURIComponent(status)) +
    '&order=created_at.desc&limit=200');
  const listingIds = [...new Set((rows || []).map(row => row.listing_id))];
  const ownerIds = [...new Set((rows || []).map(row => row.owner_account_id))];
  const [listings, owners] = await Promise.all([
    listingIds.length ? supabaseRest(env, 'league_listings?select=id,name,slug,status,region_server,logo_url&id=in.' + inList(listingIds)).catch(() => []) : [],
    ownerIds.length ? supabaseRest(env, 'accounts?select=id,username,display_name&id=in.' + inList(ownerIds)).catch(() => []) : []
  ]);
  const listingMap = new Map((listings || []).map(row => [row.id, row]));
  const ownerMap = new Map((owners || []).map(row => [row.id, row]));
  return json({ appeals: (rows || []).map(row => {
    const listing = listingMap.get(row.listing_id) || {};
    const owner = ownerMap.get(row.owner_account_id) || {};
    return {
      id: row.id, listingId: row.listing_id, listingName: listing.name || 'Unknown league',
      slug: listing.slug || '', listingStatus: listing.status || '', regionServer: listing.region_server || '',
      logoUrl: listing.logo_url || null, owner: owner.display_name || owner.username || 'Unknown owner',
      ownerAccountId: row.owner_account_id, reason: row.reason, status: row.status,
      reviewNote: row.review_note || '', createdAt: row.created_at,
      reviewedAt: row.reviewed_at || null, reviewedBy: row.reviewed_by || ''
    };
  }) });
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
    if (request.method === 'GET' && path === '/api/admin/leagues/appeals') return await adminAppeals(env, url, supabaseRest, json);

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

    const appealResolve = path.match(new RegExp('^/api/admin/leagues/appeals/' + UUID_RE + '/resolve$', 'i'));
    if (appealResolve && request.method === 'POST') {
      const input = await request.json().catch(() => ({}));
      const status = clean(input.status, 20);
      if (!['approved', 'denied'].includes(status)) return json({ error: 'Choose approve or deny for this appeal.' }, 400);
      const note = clean(input.note, 500);
      const result = await rpc(env, supabaseRest, 'server_league_admin_resolve_appeal', {
        p_appeal_id: appealResolve[1], p_status: status, p_note: note, p_actor: 'site-admin'
      });
      if (!result?.ok) return adminRpcFailure(result, json, 'Appeal could not be resolved.');
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

export async function leagueWorkerRoute({ request, env, url, ctx, authenticated, accountContext, supabaseRest, json }) {
  if (url.pathname === '/api/admin/leagues' || url.pathname.startsWith('/api/admin/leagues/')) {
    return adminApi(request, env, url, authenticated, supabaseRest, json);
  }
  if (request.method === 'GET' && url.pathname === '/sitemap-leagues.xml') return leaguesSitemap(env, supabaseRest);
  const iconMatch = url.pathname.match(/^\/leagues\/icons\/([a-z_]+)\.webp$/);
  if (request.method === 'GET' && iconMatch) return divisionIcon(iconMatch[1], ctx);
  if (!url.pathname.startsWith('/api/leagues/')) return null;

  // Drop the edge-cached pages for a league and the board after a change.
  const purge = (slug) => {
    try {
      const cache = caches.default;
      const tasks = [cache.delete(new Request(url.origin + '/leagues/')), cache.delete(new Request(url.origin + '/api/leagues/public'))];
      if (slug) tasks.push(cache.delete(new Request(url.origin + '/leagues/' + slug + '/')));
      ctx?.waitUntil?.(Promise.all(tasks));
    } catch { /* cache is best effort */ }
  };

  try {
    // Signed-out visitors can always browse.
    if (request.method === 'GET' && url.pathname === '/api/leagues/public') {
      const cache = caches.default; const key = new Request(url.origin + '/api/leagues/public');
      const hit = await cache.match(key);
      if (hit) return hit;
      const res = await publicDirectory(env, supabaseRest, json);
      if (res.ok) ctx?.waitUntil?.(cache.put(key, res.clone()));
      return res;
    }
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
    if (request.method === 'POST' && url.pathname === '/api/leagues/listings') {
      return await createListing(request, env, context, supabaseRest, json, purge);
    }

    if (request.method === 'GET' && url.pathname === '/api/leagues/me') return await leagueMe(request, env, context, url, supabaseRest, json);

    // Private inbox conversations are tied to an existing league application.
    if (request.method === 'GET' && url.pathname === '/api/leagues/inbox') return await listInbox(request, env, context, supabaseRest, json);
    const inboxMessagesMatch = url.pathname.match(new RegExp('^/api/leagues/inbox/' + UUID_RE + '/messages$', 'i'));
    if (inboxMessagesMatch && ['GET', 'POST'].includes(request.method)) return await inboxConversation(request, env, context, inboxMessagesMatch, supabaseRest, json);
    const startInboxMatch = url.pathname.match(new RegExp('^/api/leagues/listings/' + UUID_RE + '/inbox$', 'i'));
    if (request.method === 'POST' && startInboxMatch) return await openInboxConversation(request, env, context, startInboxMatch, supabaseRest, json);
    const appealMatch = url.pathname.match(new RegExp('^/api/leagues/listings/' + UUID_RE + '/appeal$', 'i'));
    if (request.method === 'POST' && appealMatch) return await submitLeagueAppeal(request, env, context, appealMatch, supabaseRest, json);

    // Listing-level actions that do not need a player profile.
    const ownerRoutes = [['update', updateListing], ['quick', quickUpdate], ['kickoff', kickoff], 
      ['crew-decide', crewDecide], ['applications', listApplications]];
    for (const [name, handler] of ownerRoutes) {
      const m = url.pathname.match(new RegExp('^/api/leagues/listings/' + UUID_RE + '/' + name + '$', 'i'));
      const method = name === 'applications' ? 'GET' : 'POST';
      if (request.method === method && m) return await handler(request, env, context, m, supabaseRest, json, purge);
    }
    const contactMatch = url.pathname.match(new RegExp('^/api/leagues/listings/' + UUID_RE + '/contact$', 'i'));
    if (request.method === 'GET' && contactMatch) return await listingContact(request, env, context, contactMatch, supabaseRest, json);
    const decideMatch = url.pathname.match(new RegExp('^/api/leagues/applications/' + UUID_RE + '/decide$', 'i'));
    if (request.method === 'POST' && decideMatch) return await decideApplication(request, env, context, decideMatch, supabaseRest, json);
    const withdrawMatch = url.pathname.match(new RegExp('^/api/leagues/applications/' + UUID_RE + '/withdraw$', 'i'));
    if (request.method === 'POST' && withdrawMatch) return await withdrawApplication(request, env, context, withdrawMatch, supabaseRest, json);

    // Player actions: these need the short player card (OVR, name, region).
    const leagueProfile = await loadLeagueProfile(env, context.account.id, supabaseRest);
    const needsProfile = () => json({ error: 'Add your OVR and in-game name first.', needsProfile: true }, 428);
    const playerRoutes = [['apply', applyToLeague], ['active', confirmActive], ['save', toggleSave], ['join', trackJoin],
      ['report', reportListing], ['crew', crewRequest], ['crew-leave', crewLeave]];
    for (const [name, handler] of playerRoutes) {
      const m = url.pathname.match(new RegExp('^/api/leagues/listings/' + UUID_RE + '/' + name + '$', 'i'));
      if (request.method === 'POST' && m) {
        if (!leagueProfile && ['apply', 'active', 'save', 'crew'].includes(name)) return needsProfile();
        return await handler(request, env, context, m, supabaseRest, json);
      }
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
