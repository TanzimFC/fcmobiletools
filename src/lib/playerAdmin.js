const SUPABASE_URL = 'https://moczgrwxtfexdbjthxpd.supabase.co';
const POSITIONS = new Set(['GK','RB','RWB','CB','LB','LWB','CDM','RM','CM','LM','CAM','RW','LW','CF','ST']);
const allowedPlayerFields = ['player_id','name','slug','ovr','position','alternate_positions','club','league','nation','event','skill_moves','weak_foot','strong_foot','strong_foot_side','work_rate_attack','work_rate_defense','height_cm','weight_kg','date_added','is_untradable','is_active'];

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const slugify = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
function validatePlayer(input) {
  const row = input && typeof input === 'object' ? input : {};
  const player_id = Number(row.player_id ?? row.asset_id);
  const name = String(row.name || '').trim().slice(0,120);
  const ovr = Number(row.ovr);
  const position = String(row.position || '').trim().toUpperCase();
  if (!Number.isSafeInteger(player_id) || player_id < 1) throw new Error('Each row needs a positive integer player_id.');
  if (!name) throw new Error('Player name is required.');
  if (!Number.isInteger(ovr) || ovr < 1 || ovr > 150) throw new Error('OVR must be an integer from 1 to 150.');
  if (!POSITIONS.has(position)) throw new Error('Choose a valid FC Mobile position.');
  const result = { player_id, name, slug: slugify(row.slug || name) + '-' + player_id, ovr, position };
  for (const field of allowedPlayerFields) if (row[field] !== undefined && !['player_id','name','slug','ovr','position'].includes(field)) result[field] = row[field];
  if (Array.isArray(row.alternate_positions)) result.alternate_positions = row.alternate_positions.map((x) => String(x).toUpperCase()).filter((x) => POSITIONS.has(x));
  for (const field of ['skill_moves','weak_foot']) if (result[field] != null && (!Number.isInteger(Number(result[field])) || Number(result[field]) < 1 || Number(result[field]) > 5)) throw new Error(field + ' must be from 1 to 5.');
  if (row.stats !== undefined && (!row.stats || typeof row.stats !== 'object' || Array.isArray(row.stats))) throw new Error('stats must be a JSON object.');
  return result;
}

export async function handlePlayerAdminRequest(request, path, env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.PLAYER_DATABASE_SERVICE_KEY;
  if (!key) return reply({ error: 'Player admin storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY as a Cloudflare Worker secret.' }, 503);
  const headers = { apikey: key, authorization: 'Bearer ' + key, accept: 'application/json' };
  const requestJson = async () => {
    try { return await request.json(); } catch { throw new Error('Request body must be valid JSON.'); }
  };
  const db = async (table, query = '', options = {}) => {
    const response = await fetch(new URL('/rest/v1/' + table + query, SUPABASE_URL), { method: options.method || 'GET', headers: { ...headers, ...(options.body ? { 'content-type':'application/json' } : {}), ...(options.prefer ? { prefer:options.prefer } : {}), ...(options.range ? { range:options.range, 'range-unit':'items' } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
    if (!response.ok) throw new Error('Supabase ' + table + ' request failed (' + response.status + '): ' + (await response.text()).slice(0,300));
    return response.status === 204 ? null : response.json().catch(() => null);
  };
  const upsert = (table, rows, conflict) => rows.length ? db(table, '?' + new URLSearchParams({ on_conflict: conflict }), { method:'POST', body:rows, prefer:'resolution=merge-duplicates,return=minimal' }) : null;
  try {
    if (request.method === 'GET' && path === '/player-database') {
      const url = new URL(request.url), limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50)), offset = Math.max(0, Number(url.searchParams.get('offset')) || 0), term = String(url.searchParams.get('q') || '').slice(0,80);
      const query = new URLSearchParams({ select:'player_id,name,slug,ovr,position,club,league,nation,event,is_active', is_active:'eq.true', order:'ovr.desc,name.asc', limit:String(limit), offset:String(offset) });
      if (term) query.set('or', '(name.ilike.*' + term.replace(/[(),]/g,' ') + '*,club.ilike.*' + term.replace(/[(),]/g,' ') + '*,event.ilike.*' + term.replace(/[(),]/g,' ') + '*)');
      const rows = await db('players','?' + query.toString(),{range:offset + '-' + (offset+limit-1)});
      return reply({ players: rows || [], limit, offset });
    }
    const id = path.match(/^\/player-database\/(\d+)$/)?.[1];
    if (request.method === 'GET' && id) {
      const rows = await db('players','?' + new URLSearchParams({ select:'*', player_id:'eq.'+id, limit:'1' }).toString());
      if (!rows?.[0]) return reply({ error:'Player not found.' },404);
      const player = rows[0];
      const [stats,ranks,assets] = await Promise.all([
        db('player_stats','?' + new URLSearchParams({ select:'stats,source_name,source_url,verified_at', player_id:'eq.'+id }).toString()),
        db('player_ranks','?' + new URLSearchParams({ select:'rank,training_level,ovr,stat_modifiers,source_url', player_id:'eq.'+id, order:'rank.asc,training_level.asc' }).toString()),
        db('player_assets','?' + new URLSearchParams({ select:'asset_key,asset_type,local_path,public_url,source_name,source_url,license,attribution', player_id:'eq.'+id }).toString())
      ]);
      return reply({ ...player, stats:stats?.[0]?.stats || {}, ranks:ranks || [], assets:assets || [] });
    }
    if (request.method === 'DELETE' && id) {
      await db('players','?' + new URLSearchParams({ player_id:'eq.'+id }),{method:'PATCH',body:{is_active:false},prefer:'return=minimal'});
      return reply({ ok:true, action:'archived' });
    }
    if (request.method !== 'POST' || path !== '/player-database') return reply({ error:'Player admin route not found.' },404);
    const input = await requestJson();
    const incoming = Array.isArray(input) ? input : Array.isArray(input.players) ? input.players : [input];
    if (!incoming.length || incoming.length > 200) return reply({ error:'Import 1 to 200 players per request.' },400);
    const players = incoming.map(validatePlayer);
    if (new Set(players.map((row) => row.player_id)).size !== players.length) return reply({ error:'Duplicate player_id values are not allowed in one import batch.' },400);
    await upsert('players', players, 'player_id');
    const statsRows = incoming.map((row,i) => row.stats !== undefined ? { player_id:players[i].player_id, stats:row.stats, source_name:row.source?.name || row.source_name || null, source_url:row.source?.url || row.source_url || null, verified_at:row.source?.observed_at || new Date().toISOString() } : null).filter(Boolean);
    await upsert('player_stats', statsRows, 'player_id');
    const rankRows = incoming.flatMap((row,i) => (Array.isArray(row.ranks) ? row.ranks : []).map(rank => ({ player_id:players[i].player_id, rank:Number(rank.rank)||0, training_level:Number(rank.training_level)||0, ovr:rank.ovr == null ? null : Number(rank.ovr), stat_modifiers:rank.stat_modifiers || {}, source_url:rank.source_url || row.source?.url || null })));
    await upsert('player_ranks', rankRows, 'player_id,rank,training_level');
    const assetRows = incoming.flatMap((row,i) => Object.entries(row.assets || {}).flatMap(([kind,value]) => {
      const asset = value && typeof value === 'object' ? value : { public_url:value };
      if (!asset.public_url && !asset.local_path) return [];
      return [{ asset_key:String(asset.asset_key || kind + '-' + players[i].player_id), player_id:players[i].player_id, asset_type:kind, local_path:asset.local_path || null, public_url:asset.public_url || null, source_name:asset.source_name || row.source?.name || row.source_name || 'Unspecified', source_url:asset.source_url || row.source?.url || row.source_url || 'https://example.invalid/', license:asset.license || 'unverified', attribution:asset.attribution || null, checksum_sha256:asset.checksum_sha256 || null }];
    }));
    await upsert('player_assets', assetRows, 'asset_key');
    const abilityRows = incoming.flatMap(row => ['playstyles','traits'].flatMap(type => (Array.isArray(row[type]) ? row[type] : []).map(item => ({ name:String(item.name || '').trim(), slug:slugify(item.slug || item.name) + (item.is_plus ? '-plus' : ''), ability_type:type === 'playstyles' ? 'playstyle' : 'trait', is_plus:Boolean(item.is_plus), description:item.description || null, asset_key:item.asset_key || null })).filter(item => item.name && item.slug)));
    const uniqueAbilities = [...new Map(abilityRows.map(item => [item.slug,item])).values()];
    if (uniqueAbilities.length) {
      await upsert('player_abilities', uniqueAbilities, 'slug');
      const slugs = uniqueAbilities.map(item => item.slug);
      const existing = await db('player_abilities','?' + new URLSearchParams({ select:'id,slug', slug:'in.(' + slugs.join(',') + ')' }).toString());
      const idBySlug = new Map((existing || []).map(item => [item.slug,item.id]));
      const links = incoming.flatMap((row,i) => ['playstyles','traits'].flatMap(type => (Array.isArray(row[type]) ? row[type] : []).map(item => {
        const slug = slugify(item.slug || item.name) + (item.is_plus ? '-plus' : '');
        const ability_id = idBySlug.get(slug);
        return ability_id ? { player_id:players[i].player_id, ability_id, rank:Number(item.rank)||0 } : null;
      }).filter(Boolean)));
      await upsert('player_ability_links',links,'player_id,ability_id,rank');
    }
    return reply({ ok:true, imported:players.length, player_ids:players.map(item => item.player_id) });
  } catch (error) {
    return reply({ error:error?.message || 'Player update failed.' },500);
  }
}
