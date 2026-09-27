const SUPABASE_URL = 'https://moczgrwxtfexdbjthxpd.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_twe_ZNKiHXUB4b_J_RjGEA_rPKZrqbr';
const SOURCE_PAGE = 'https://fcmobilesquad.com/star-signings-players';

const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=900', ...headers },
});

async function readTable(table, query, options = {}) {
  const url = new URL(`/rest/v1/${table}`, SUPABASE_URL);
  url.search = query.toString();
  const result = await fetch(url, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      accept: 'application/json',
      ...(options.range ? { range: options.range, 'range-unit': 'items', prefer: 'count=exact' } : {}),
    },
  });
  if (!result.ok) throw new Error(`Player data request failed (${result.status}).`);
  return { rows: await result.json(), total: Number(result.headers.get('content-range')?.split('/')[1]) || 0 };
}

function playerIdsFilter(rows) {
  return `in.(${rows.map((x) => x.player_id).join(',')})`;
}

async function observations(rows, table, columns) {
  if (!rows.length) return new Map();
  const q = new URLSearchParams({ select: columns, player_id: playerIdsFilter(rows), order: 'observed_at.desc', limit: String(rows.length * 8) });
  const { rows: values } = await readTable(table, q);
  const latest = new Map();
  for (const value of values) if (!latest.has(value.player_id)) latest.set(value.player_id, value);
  return latest;
}

async function enrich(rows) {
  const [assets, shards, prices] = await Promise.all([
    readTable('player_assets', new URLSearchParams({ select: 'player_id,asset_type,public_url,local_path', player_id: playerIdsFilter(rows) })),
    observations(rows, 'player_shard_costs', 'player_id,shard_cost,shard_type,event,source_name,source_url,observed_at'),
    observations(rows, 'player_prices', 'player_id,current_sell_price,lowest_sell_price,highest_sell_price,currency,source_name,source_url,usage_policy,observed_at'),
  ]);
  const assetsById = new Map();
  for (const asset of assets.rows) {
    const mapped = assetsById.get(asset.player_id) || {};
    const assetType = asset.asset_type || 'player_image';
    mapped[assetType] = asset.local_path || asset.public_url || null;
    assetsById.set(asset.player_id, mapped);
  }
  return rows.map((player) => {
    const mapped = assetsById.get(player.player_id) || {};
    return {
    ...player,
    image: mapped.player_image || null,
    card_background: mapped.card_background || null,
    nation_flag: mapped.nation_flag || null,
    club_badge: mapped.club_badge || null,
    league_logo: mapped.league_logo || null,
    shard_cost: shards.get(player.player_id) || null,
    sell_price: prices.get(player.player_id) || null,
  }; });
}

async function readRpc(name) {
  const result = await fetch(new URL('/rest/v1/rpc/' + name, SUPABASE_URL), {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, 'content-type': 'application/json', accept: 'application/json' },
    body: '{}'
  });
  if (!result.ok) throw new Error(`Player filter request failed (${result.status}).`);
  return result.json();
}

function setExactFilter(query, field, value) {
  const clean = String(value || '').trim().slice(0, 100);
  if (clean && !/[(),]/.test(clean)) query.set(field, 'eq.' + JSON.stringify(clean));
}

export async function handlePlayerRequest(request, pathname) {
  if (request.method !== 'GET') return response({ error: 'Method not allowed.' }, 405, { allow: 'GET' });
  try {
    if (pathname === '/api/players/filters') {
      return response({ ...(await readRpc('player_filter_options')), source: SOURCE_PAGE });
    }
    if (pathname === '/api/players' || pathname === '/api/players/') {
      const url = new URL(request.url);
      const params = url.searchParams;
      const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 48));
      const offset = Math.max(0, Math.min(100000, Number(params.get('offset')) || 0));
      const sortMap = { 'ovr-desc': 'ovr.desc,name.asc', 'ovr-asc': 'ovr.asc,name.asc', 'name-asc': 'name.asc', 'name-desc': 'name.desc' };
      const query = new URLSearchParams({ select: 'player_id,name,slug,ovr,position,alternate_positions,club,league,nation,event', is_active: 'eq.true', order: sortMap[params.get('sort')] || sortMap['ovr-desc'] });
      const search = (params.get('q') || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (search) query.set('normalized_name', `ilike.*${search}*`);
      const position = (params.get('position') || '').toUpperCase();
      if (/^[A-Z]{1,4}$/.test(position)) query.set('position', `eq.${position}`);
      for (const field of ['club', 'league', 'nation', 'event']) setExactFilter(query, field, params.get(field));
      const minOvr = Number(params.get('minOvr'));
      const maxOvr = Number(params.get('maxOvr'));
      const ovrFilters = [];
      if (Number.isInteger(minOvr) && minOvr >= 1 && minOvr <= 150) ovrFilters.push(`ovr.gte.${minOvr}`);
      if (Number.isInteger(maxOvr) && maxOvr >= 1 && maxOvr <= 150) ovrFilters.push(`ovr.lte.${maxOvr}`);
      if (ovrFilters.length) query.set('and', `(${ovrFilters.join(',')})`);
      const result = await readTable('players', query, { range: `${offset}-${offset + limit - 1}` });
      return response({ players: await enrich(result.rows), total: result.total, limit, offset, source: SOURCE_PAGE });
    }
    if (pathname.startsWith('/api/players/')) {
      const slug = decodeURIComponent(pathname.slice('/api/players/'.length)).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 120);
      if (!slug) return response({ error: 'Player not found.' }, 404);
      const playerQuery = new URLSearchParams({ select: 'player_id,name,slug,ovr,position,alternate_positions,event,skill_moves,weak_foot,strong_foot,strong_foot_side,work_rate_attack,work_rate_defense,height_cm,weight_kg,date_added,is_untradable', slug: `eq.${slug}`, is_active: 'eq.true', limit: '1' });
      const { rows } = await readTable('players', playerQuery);
      if (!rows[0]) return response({ error: 'Player not found.' }, 404);
      const player = rows[0];
      const id = String(player.player_id);
      const [expanded, stats, ranks, assets, shards, prices] = await Promise.all([
        enrich([player]),
        readTable('player_stats', new URLSearchParams({ select: 'stats,source_name,source_url,verified_at', player_id: `eq.${id}`, limit: '1' })),
        readTable('player_ranks', new URLSearchParams({ select: 'rank,training_level,ovr,stat_modifiers,rank_asset_key,source_url', player_id: `eq.${id}`, order: 'rank.asc,training_level.asc', limit: '186' })),
        readTable('player_assets', new URLSearchParams({ select: 'asset_key,asset_type,public_url,local_path,source_name,source_url,attribution,license', player_id: `eq.${id}` })),
        observations([player], 'player_shard_costs', 'player_id,shard_cost,shard_type,event,source_name,source_url,observed_at'),
        observations([player], 'player_prices', 'player_id,current_sell_price,lowest_sell_price,highest_sell_price,currency,source_name,source_url,usage_policy,observed_at'),
      ]);
      const abilityQuery = new URLSearchParams({ select: 'rank,player_abilities(name,slug,ability_type,is_plus,description,player_assets(public_url,local_path))', player_id: `eq.${id}`, order: 'rank.asc' });
      const abilities = await readTable('player_ability_links', abilityQuery);
      return response({ ...expanded[0], stats: stats.rows[0] || null, ranks: ranks.rows, assets: assets.rows, abilities: abilities.rows, shard_cost: shards.get(player.player_id) || null, sell_price: prices.get(player.player_id) || null });
    }
    return response({ error: 'Player API route not found.' }, 404);
  } catch (error) {
    return response({ error: error?.message || 'Unable to load player data.' }, 502, { 'cache-control': 'no-store' });
  }
}
