import {
  buildZenithPlayerSlug,
  fetchZenithPlayers,
  fetchZenithPlayerById,
  normalizeZenithPlayer
} from './zenithPlayerApi.js';

const POSITION_VALUES = ['GK','RB','RWB','CB','LB','LWB','CDM','RM','CM','LM','CAM','RW','LW','CF','ST'];
let filterCache = { expiresAt: 0, value: null };

const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
    ...headers
  }
});

function filterValue(request, name) {
  const value = new URL(request.url).searchParams.get(name);
  return value ? value.trim() : '';
}

async function loadFilters() {
  if (filterCache.value && filterCache.expiresAt > Date.now()) return filterCache.value;

  const events = new Set();
  const leagues = new Set();
  const nations = new Set();
  const teams = new Set();
  const pageSize = 1000;

  try {
    const first = await fetchZenithPlayers({ limit: pageSize, offset: 0, rank: 0 });
    for (const player of first.players) {
      if (player.event) events.add(player.event);
      if (player.league) leagues.add(player.league);
      if (player.nation) nations.add(player.nation);
      if (player.club) teams.add(player.club);
    }

    const total = Math.min(first.pagination.total, 20_000);
    const offsets = [];
    for (let offset = pageSize; offset < total; offset += pageSize) offsets.push(offset);

    const concurrency = 5;
    for (let index = 0; index < offsets.length; index += concurrency) {
      const batch = await Promise.all(
        offsets.slice(index, index + concurrency).map((offset) =>
          fetchZenithPlayers({ limit: pageSize, offset, rank: 0 })
            .then((result) => result.players)
            .catch(() => [])
        )
      );
      for (const rows of batch) {
        for (const player of rows) {
          if (player.event) events.add(player.event);
          if (player.league) leagues.add(player.league);
          if (player.nation) nations.add(player.nation);
          if (player.club) teams.add(player.club);
        }
      }
    }
  } catch {
    // Keep the basic position filters available if the upstream filter scan fails.
  }

  const value = {
    positions: POSITION_VALUES,
    events: [...events].sort((a, b) => a.localeCompare(b)),
    leagues: [...leagues].sort((a, b) => a.localeCompare(b)),
    nations: [...nations].sort((a, b) => a.localeCompare(b)),
    teams: [...teams].sort((a, b) => a.localeCompare(b))
  };

  filterCache = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
  return value;
}

function sortOptions(value) {
  switch (value) {
    case 'name-asc':
    case 'name.desc':
      return { sortBy: 'name', order: value === 'name-asc' ? 'asc' : 'desc' };
    case 'ovr-asc':
      return { sortBy: 'ovr', order: 'asc' };
    default:
      return { sortBy: 'ovr', order: 'desc' };
  }
}

export async function handlePlayerRequest(request, pathname) {
  if (request.method !== 'GET') {
    return response({ error: 'Method not allowed.' }, 405, { allow: 'GET' });
  }

  try {
    if (pathname === '/api/players/filters') {
      return response(await loadFilters());
    }

    if (pathname === '/api/players' || pathname === '/api/players/') {
      const search = filterValue(request, 'q');
      const position = filterValue(request, 'position');
      const event = filterValue(request, 'event');
      const team = filterValue(request, 'team');
      const league = filterValue(request, 'league');
      const nation = filterValue(request, 'nation');
      const minOvr = filterValue(request, 'minOvr');
      const maxOvr = filterValue(request, 'maxOvr');
      const limit = Math.min(100, Math.max(1, Number(filterValue(request, 'limit')) || 48));
      const offset = Math.max(0, Number(filterValue(request, 'offset')) || 0);
      const sort = sortOptions(filterValue(request, 'sort'));

      const result = await fetchZenithPlayers({
        limit,
        offset,
        rank: 0,
        nameStartsWith: search,
        position,
        event,
        team,
        league,
        nation,
        minOvr,
        maxOvr,
        sortBy: sort.sortBy,
        order: sort.order
      });

      return response({
        players: result.players,
        pagination: result.pagination,
        source: 'zenith-api'
      });
    }

    if (pathname.startsWith('/api/players/')) {
      const slug = decodeURIComponent(pathname.slice('/api/players/'.length));
      const match = slug.match(/-(\d+)$/);
      const player = match
        ? await fetchZenithPlayerById(match[1], 0)
        : null;

      if (!player) return response({ error: 'Player not found.' }, 404);

      return response({
        ...player,
        source: 'zenith-api'
      });
    }

    return response({ error: 'Player API route not found.' }, 404);
  } catch (error) {
    console.error('[PLAYER_API]', error);
    return response(
      { error: error?.message || 'Unable to load player data.' },
      502,
      { 'cache-control': 'no-store' }
    );
  }
}
