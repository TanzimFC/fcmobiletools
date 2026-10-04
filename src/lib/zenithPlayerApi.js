const DEFAULT_BASE_URL = 'https://zenithfcm.com/api';

const memoryCache = new Map();
const MAX_CACHE_ENTRIES = 40;

function envValue(name) {
  return String(globalThis.process?.env?.[name] ?? '').trim();
}

export function getZenithBaseUrl() {
  return (envValue('PLAYER_SOURCE_API_BASE_URL') || envValue('ZENITH_API_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function cacheGet(key) {
  const item = memoryCache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
}

function cacheSet(key, value, ttlMs) {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  while (memoryCache.size > MAX_CACHE_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
    else break;
  }
  return value;
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['players', 'data', 'results', 'items']) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function splitList(value) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (entry && typeof entry === 'object') return [entry.name ?? entry.label ?? entry.title ?? ''];
      return [entry];
    }).map((entry) => String(entry ?? '').trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(/[|,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildZenithPlayerSlug(player) {
  const name = slugify(player?.name ?? player?.cardName ?? 'player');
  const ovr = toNumber(player?.ovr ?? player?.rating) ?? 0;
  const id = String(player?.player_id ?? player?.playerId ?? player?.asset_id ?? player?.id ?? '').trim();
  return [name, ovr, id].filter(Boolean).join('-');
}

function statsFromPlayer(raw) {
  const fields = [
    'pace','acceleration','sprint_speed',
    'shooting','finishing','long_shot','shot_power','positioning','volley','penalties',
    'passing','short_passing','long_passing','vision','crossing','curve','free_kick',
    'dribbling','dribbling_head','balance','agility','reactions','ball_control',
    'defending','marking','standing_tackle','sliding_tackle','awareness','heading',
    'physical','strength','aggression','jumping','stamina_stat',
    'diving','gk_diving','gk_positioning','handling','gk_handling','reflexes','gk_reflexes',
    'kicking','gk_kicking'
  ];

  const stats = {};
  for (const field of fields) {
    const n = toNumber(raw?.[field]);
    if (n !== null) stats[field] = n;
  }
  return stats;
}

function imageRows(raw) {
  const values = [
    ['player_render', raw?.player_image, true],
    ['card_background', raw?.card_background, true],
    ['nation_flag', raw?.nation_flag, false],
    ['club_logo', raw?.club_flag, false],
    ['league_logo', raw?.league_image, false]
  ];

  return values
    .filter(([, url]) => String(url ?? '').trim())
    .map(([asset_type, asset_url, is_primary]) => ({ asset_type, asset_url: String(asset_url).trim(), is_primary }));
}

export function normalizeZenithPlayer(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const playerId = String(raw.player_id ?? raw.playerId ?? raw.asset_id ?? raw.assetId ?? raw.id ?? '').trim();
  const name = String(raw.name ?? raw.card_name ?? raw.cardName ?? '').trim();
  const ovr = toNumber(raw.ovr ?? raw.rating ?? raw.overall);

  if (!playerId || !name || !ovr) return null;

  const alternate = splitList(raw.alternate_position ?? raw.alternatePosition ?? raw.alternate_positions);

  return {
    playerId,
    recordId: String(raw.id ?? '').trim() || null,
    slug: buildZenithPlayerSlug({ ...raw, player_id: playerId }),
    name,
    fullName: String(raw.full_name ?? raw.fullName ?? name).trim(),
    ovr,
    position: String(raw.position ?? '').trim(),
    primary_position: String(raw.position ?? '').trim(),
    alternatePosition: alternate.join(', '),
    alternate_positions: alternate,
    club: String(raw.team ?? raw.club ?? '').trim(),
    league: String(raw.league ?? '').trim(),
    nation: String(raw.nation_region ?? raw.nation ?? '').trim(),
    event: String(raw.event ?? '').trim(),
    skill_moves: toNumber(raw.skill_moves_stars ?? raw.skill_moves),
    weak_foot: toNumber(raw.weak_foot_stars ?? raw.weak_foot),
    strong_foot_side: String(raw.strong_foot_side ?? '').trim(),
    strong_foot_stars: toNumber(raw.strong_foot_stars),
    preferred_foot: String(raw.strong_foot_side ?? '').trim(),
    attack_work_rate: String(raw.work_rate_attack ?? raw.attack_work_rate ?? '').trim(),
    defense_work_rate: String(raw.work_rate_defense ?? raw.defense_work_rate ?? '').trim(),
    height_cm: toNumber(raw.height_cm ?? raw.height),
    weight_kg: toNumber(raw.weight_kg ?? raw.weight),
    date_added: raw.date_added ?? null,
    untradeable: String(raw.is_untradable ?? raw.untradeable ?? '').toLowerCase() === 'true',
    color_rating: String(raw.color_rating ?? '').trim(),
    color_position: String(raw.color_position ?? '').trim(),
    color_name: String(raw.color_name ?? '').trim(),
    color_level: String(raw.color_level ?? '').trim(),
    price: toNumber(raw.price),
    stats: statsFromPlayer(raw),
    skills: splitList(raw.skills),
    traits: splitList(raw.traits_name ?? raw.traits),
    images: imageRows(raw),
    raw
  };
}

async function requestJson(url, context) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Zenith returned invalid JSON for ${context}.`);
  }

  if (!response.ok) {
    throw new Error(`Zenith request failed for ${context} (${response.status}).`);
  }

  return payload;
}

async function fetchWithCache(url, context, ttlMs) {
  const cached = cacheGet(url);
  if (cached !== null) return cached;

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const payload = await requestJson(url, context);
      return cacheSet(url, payload, ttlMs);
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error(`Zenith request failed for ${context}.`);
}

export async function fetchZenithPlayers(options = {}) {
  const base = getZenithBaseUrl();
  const limit = Math.min(1000, Math.max(1, Number(options.limit) || 48));
  const offset = Math.max(0, Number(options.offset) || 0);
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    rank: String(Number(options.rank) || 0),
    sort_by: options.sortBy === 'name' ? 'name' : 'ovr',
    order: options.order === 'asc' ? 'asc' : 'desc',
    include_price: 'false'
  });

  const filters = [
    ['position', options.position],
    ['min_ovr', options.minOvr],
    ['max_ovr', options.maxOvr],
    ['team', options.team],
    ['league', options.league],
    ['nation', options.nation],
    ['event', options.event],
    ['skill_moves', options.skillMoves],
    ['name_starts_with', options.nameStartsWith]
  ];

  for (const [key, value] of filters) {
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(key, String(value).trim());
    }
  }

  const payload = await fetchWithCache(
    `${base}/players?${params.toString()}`,
    'player list',
    30_000
  );

  const rows = asList(payload).map(normalizeZenithPlayer).filter(Boolean);
  const pagination = payload?.pagination && typeof payload.pagination === 'object'
    ? payload.pagination
    : { total: rows.length, limit, offset, has_more: rows.length === limit };

  return {
    players: rows,
    pagination: {
      total: Number(pagination.total) || rows.length,
      limit: Number(pagination.limit) || limit,
      offset: Number(pagination.offset) || offset,
      has_more: pagination.has_more === true || rows.length === limit
    }
  };
}

export async function fetchZenithPlayersByIds(ids, options = {}) {
  const cleanIds = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id).trim()).filter(Boolean))];
  if (!cleanIds.length) return [];

  const rank = Number(options.rank) || 0;
  const chunkSize = Math.min(100, Math.max(1, Number(options.chunkSize) || 100));
  const results = [];

  for (let index = 0; index < cleanIds.length; index += chunkSize) {
    const chunk = cleanIds.slice(index, index + chunkSize);
    const params = new URLSearchParams({
      ids: chunk.join(','),
      rank: String(rank)
    });
    const payload = await fetchWithCache(
      `${getZenithBaseUrl()}/players/by-ids?${params.toString()}`,
      'player batch',
      5 * 60_000
    );
    results.push(...asList(payload).map(normalizeZenithPlayer).filter(Boolean));
  }

  const wanted = new Set(cleanIds);
  return results.filter((player) => wanted.has(player.playerId));
}

export async function fetchZenithPlayerById(playerId, rank = 0) {
  const rows = await fetchZenithPlayersByIds([playerId], { rank, chunkSize: 1 });
  return rows[0] ?? null;
}

export async function fetchZenithPlayerBySlug(slug, rank = 0) {
  const match = String(slug ?? '').match(/-(\d+)$/);
  if (!match) return null;
  return fetchZenithPlayerById(match[1], rank);
}

export async function fetchZenithTopPlayerIds(limit = 10_000) {
  const target = Math.min(100_000, Math.max(1, Number(limit) || 10_000));
  const pageSize = 500;
  const ids = [];
  const seen = new Set();

  for (let offset = 0; ids.length < target; offset += pageSize) {
    const batch = await fetchZenithPlayers({
      limit: Math.min(pageSize, target - ids.length),
      offset,
      rank: 0,
      sortBy: 'ovr',
      order: 'desc'
    });

    for (const player of batch.players) {
      if (!seen.has(player.playerId)) {
        seen.add(player.playerId);
        ids.push(player.playerId);
      }
    }

    if (!batch.pagination.has_more || batch.players.length < 1) break;
  }

  return ids;
}
