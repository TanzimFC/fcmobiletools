// League data helpers shared by the Worker API (src/leagueWorker.mjs) and the
// server-rendered pages (/leagues and /leagues/[slug]).
// Every function takes `supabaseRest(env, path, options)` so each caller keeps its own transport.

import { divisionByKey, ACCENT_KEYS, JOIN_KEYS, LISTING_EXPIRY_DAYS, EXPIRY_WARNING_DAYS } from '../data/leagueConfig.js';

export const BASE_LISTING_COLUMNS = [
  'id', 'owner_account_id', 'slug', 'name', 'description', 'logo_url', 'league_game_id',
  'region_server', 'preferred_languages', 'min_ovr', 'tournament_frequency',
  'tournament_sizes', 'discord_required', 'player_commitment', 'weekly_rewards',
  'discord_invite_url', 'contact_discord', 'open_spots', 'recruiting_open', 'status', 'moderation_note',
  'last_kickoff_at', 'last_active_at', 'created_at', 'updated_at'
];
export const PREMIUM_LISTING_COLUMNS = [
  'tagline', 'active_hours', 'is_verified', 'is_featured', 'featured_until', 'reviewed_at',
  'division', 'join_methods', 'accent', 'is_sample'
];
export const ADMIN_LISTING_COLUMNS = ['admin_note', 'reviewed_by', 'rules_accepted_at', 'rules_version'];

export const KICKOFF_MS = 6 * 60 * 60 * 1000;
export const inList = (ids) => encodeURIComponent('(' + ids.join(',') + ')');
export const isMissingSchema = (error) =>
  /column|does not exist|schema cache|could not find the function|undefined_function/i.test(String(error?.message || ''));

export async function readListings(env, supabaseRest, queryTail, { admin = false } = {}) {
  const cols = [...BASE_LISTING_COLUMNS, ...PREMIUM_LISTING_COLUMNS, ...(admin ? ADMIN_LISTING_COLUMNS : [])];
  try {
    const rows = await supabaseRest(env, 'league_listings?select=' + encodeURIComponent(cols.join(',')) + queryTail);
    return { rows: rows || [], premium: true };
  } catch (error) {
    if (!isMissingSchema(error)) throw error;
    const rows = await supabaseRest(env, 'league_listings?select=' + encodeURIComponent(BASE_LISTING_COLUMNS.join(',')) + queryTail);
    return { rows: rows || [], premium: false };
  }
}

export async function rpc(env, supabaseRest, name, args) {
  return supabaseRest(env, 'rpc/' + name, { method: 'POST', body: JSON.stringify(args) });
}

export async function ownerMapFor(env, supabaseRest, listings) {
  const ids = [...new Set((listings || []).map(row => row.owner_account_id).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await supabaseRest(env, 'accounts?select=id,username,display_name,avatar_url&id=in.' + inList(ids)).catch(() => []);
  return new Map((rows || []).map(row => [row.id, row]));
}

// `contact: false` strips everything a visitor needs an account for (Discord invite, contact, in-game league ID).
export function decorateListings(listings, ownerMap, { admin = false, includeNote = false, signals = null, viewerId = '', contact = true } = {}) {
  const now = Date.now();
  return (listings || []).map(row => {
    const owner = ownerMap.get(row.owner_account_id) || {};
    const kickoffAt = row.last_kickoff_at ? Date.parse(row.last_kickoff_at) : 0;
    const signal = signals?.get(row.id) || {};
    const methods = (Array.isArray(row.join_methods) && row.join_methods.length ? row.join_methods : ['apply']).filter(m => JOIN_KEYS.includes(m));
    const isSample = Boolean(row.is_sample);
    const out = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline || row.description || '',
      logoUrl: row.logo_url || null,
      regionServer: row.region_server,
      preferredLanguages: row.preferred_languages || [],
      minOvr: Number(row.min_ovr || 0),
      division: divisionByKey(row.division) ? row.division : '',
      tournamentFrequency: row.tournament_frequency,
      tournamentSizes: row.tournament_sizes || [],
      activeHours: row.active_hours || '',
      discordRequired: Boolean(row.discord_required),
      playerCommitment: row.player_commitment,
      perks: row.weekly_rewards || '',
      openSpots: Number(row.open_spots || 0),
      recruitingOpen: Boolean(row.recruiting_open),
      joinMethods: methods.length ? methods : ['apply'],
      accent: ACCENT_KEYS.includes(row.accent) ? row.accent : 'cyan',
      status: row.status,
      isSample,
      adminNote: admin ? (row.admin_note || '') : undefined,
      // Two different things: "reviewed" = the team looked at the listing, "verified" = confirmed real club.
      verified: Boolean(row.is_verified) && !isSample,
      featured: Boolean(row.is_featured) && (!row.featured_until || Date.parse(row.featured_until) > now) && !isSample,
      featuredUntil: row.featured_until || null,
      reviewed: Boolean(row.reviewed_at) && row.status === 'approved' && !isSample,
      lastKickoffAt: row.last_kickoff_at || null,
      kickoffActive: kickoffAt > now - KICKOFF_MS,
      nextKickoffAt: kickoffAt ? new Date(kickoffAt + KICKOFF_MS).toISOString() : null,
      expiresAt: new Date((kickoffAt || Date.parse(row.reviewed_at || row.created_at) || now) + LISTING_EXPIRY_DAYS * 86400000).toISOString(),
      expiresInDays: Math.max(0, Math.ceil(((kickoffAt || Date.parse(row.reviewed_at || row.created_at) || now) + LISTING_EXPIRY_DAYS * 86400000 - now) / 86400000)),
      expiringSoon: ((kickoffAt || Date.parse(row.reviewed_at || row.created_at) || now) + (LISTING_EXPIRY_DAYS - EXPIRY_WARNING_DAYS) * 86400000) < now,
      lastActiveAt: row.last_active_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmations7d: Number(signal.confirmations7d || 0),
      matchdays7d: Number(signal.matchdays7d || 0),
      crewCount: Number(signal.crewCount || 0),
      applications7d: Number(signal.applications7d || 0),
      activityScore: Number(signal.activityScore || 0),
      saves: Number(signal.saves || 0),
      isMine: Boolean(viewerId) && row.owner_account_id === viewerId,
      hasDiscord: Boolean(row.discord_invite_url || row.contact_discord),
      hasGameId: Boolean(row.league_game_id),
      owner: isSample
        ? { username: 'fcmobiletools', displayName: 'Sample club', avatarUrl: null }
        : {
          username: owner.username || 'FC Mobile player',
          displayName: owner.display_name || owner.username || 'FC Mobile player',
          avatarUrl: owner.avatar_url || null
        }
    };
    if (contact) {
      out.discordInviteUrl = row.discord_invite_url || null;
      out.contactDiscord = row.contact_discord || '';
      out.leagueGameId = row.league_game_id || '';
    }
    if (includeNote || admin) out.moderationNote = row.moderation_note || '';
    if (admin) {
      out.adminNote = row.admin_note || '';
      out.reviewedBy = row.reviewed_by || '';
      out.reviewedAt = row.reviewed_at || null;
      out.rulesAcceptedAt = row.rules_accepted_at || null;
    }
    return out;
  }).sort((a, b) => {
    if (a.kickoffActive !== b.kickoffActive) return a.kickoffActive ? -1 : 1;
    if (a.kickoffActive && b.kickoffActive) return Date.parse(b.lastKickoffAt || 0) - Date.parse(a.lastKickoffAt || 0);
    return Date.parse(b.lastActiveAt || b.createdAt || 0) - Date.parse(a.lastActiveAt || a.createdAt || 0);
  });
}

// Real activity only: sample clubs and listings with no signal never reach the Spotlight.
export function pickSpotlight(leagues, limit = 3) {
  return leagues
    .filter(l => !l.isSample && l.recruitingOpen && l.confirmations7d > 0)
    .sort((a, b) => b.confirmations7d - a.confirmations7d || Date.parse(b.lastActiveAt || 0) - Date.parse(a.lastActiveAt || 0))
    .slice(0, limit)
    .map(l => l.id);
}

export function directoryStats(leagues) {
  const real = leagues.filter(l => !l.isSample);
  return {
    leagues: real.length,
    spots: real.reduce((n, l) => n + l.openSpots, 0),
    sample: leagues.length - real.length
  };
}

// Public, signed-out directory. Contact details stay out of this payload on purpose.
export async function loadPublicDirectory(env, supabaseRest) {
  const [directory, signalPack] = await Promise.all([
    readListings(env, supabaseRest,
      '&status=eq.approved&is_sample=eq.false&recruiting_open=eq.true' +
      '&order=last_kickoff_at.desc.nullslast,last_active_at.desc.nullslast,created_at.desc&limit=200'),
    rpc(env, supabaseRest, 'server_league_public_signals', {}).catch(() => null)
  ]);
  const signals = new Map((Array.isArray(signalPack) ? signalPack : []).map(s => [s.listingId, s]));
  const owners = await ownerMapFor(env, supabaseRest, directory.rows);
  const leagues = decorateListings(directory.rows, owners, { signals, contact: false });
  return { leagues, spotlight: pickSpotlight(leagues), stats: directoryStats(leagues) };
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;

export async function loadLeagueBySlug(env, supabaseRest, slug) {
  if (!SLUG_RE.test(String(slug || ''))) return null;
  const { rows } = await readListings(env, supabaseRest,
    '&slug=eq.' + encodeURIComponent(slug) + '&status=eq.approved&is_sample=eq.false&limit=1');
  if (!rows[0] || rows[0].is_sample === true) return null;
  const [signalPack, owners] = await Promise.all([
    rpc(env, supabaseRest, 'server_league_public_signals', {}).catch(() => null),
    ownerMapFor(env, supabaseRest, rows)
  ]);
  const signals = new Map((Array.isArray(signalPack) ? signalPack : []).map(s => [s.listingId, s]));
  const [league] = decorateListings(rows, owners, { signals, contact: false });
  let matchdays14 = [];
  try {
    const md = await supabaseRest(env,
      'league_matchdays?listing_id=eq.' + encodeURIComponent(league.id) +
      '&day=gte.' + new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10) + '&select=day&order=day.asc');
    matchdays14 = (md || []).map(r => r.day);
  } catch { /* optional table */ }
  return { ...league, matchdays14 };
}

export async function loadSitemapSlugs(env, supabaseRest) {
  const rows = await supabaseRest(env,
    'league_listings?status=eq.approved&is_sample=eq.false&select=slug,updated_at&order=updated_at.desc&limit=2000'
  ).catch(() => []);
  return rows || [];
}

// Transport for server-rendered pages (the Worker API passes its own supabaseRest instead).
export async function ssrSupabaseRest(env, path, options = {}) {
  const base = String(env?.SUPABASE_URL || 'https://moczgrwxtfexdbjthxpd.supabase.co').replace(/\/$/, '');
  const key = String(env?.SUPABASE_SECRET_KEY || '').trim();
  if (!key) throw new Error('Supabase is not configured.');
  const response = await fetch(base + '/rest/v1/' + path, {
    method: options.method || 'GET',
    headers: { apikey: key, Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { throw new Error('Supabase returned invalid JSON.'); }
  if (!response.ok) throw new Error(body?.message || body?.hint || 'Supabase request failed (' + response.status + ').');
  return body;
}
