import assert from 'node:assert/strict';
import { handlePlayerRequest } from '../../src/lib/playerDatabase.js';

const seeded = [{ player_id: 42, name: 'Luka Modrić', slug: 'luka-modric-42', ovr: 116, position: 'CM', alternate_positions: ['CAM'], event: 'Test Event' }];
const calls = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  calls.push({ url, init });
  const table = url.pathname.split('/').at(-1);
  let data = [];
  if (table === 'players') data = url.searchParams.has('slug') ? seeded : seeded;
  if (table === 'player_assets') data = [{ player_id: 42, public_url: 'https://assets.example/card.png' }];
  if (table === 'player_shard_costs') data = [{ player_id: 42, shard_cost: 1234, shard_type: 'star_shard', event: 'Test Event', source_name: 'Fixture', source_url: 'https://example.test', observed_at: '2026-09-16T00:00:00Z' }];
  if (table === 'player_stats') data = [{ stats: { pace: 100 }, source_name: 'Fixture', source_url: 'https://example.test', verified_at: '2026-09-16T00:00:00Z' }];
  if (table === 'player_ranks') data = [{ rank: 1, training_level: 0, ovr: 117, stat_modifiers: { pace: 2 }, rank_asset_key: null, source_url: null }];
  if (table === 'player_ability_links') data = [];
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json', 'content-range': `0-${Math.max(data.length - 1, 0)}/${data.length}` } });
};

const listResponse = await handlePlayerRequest(new Request('https://site.test/api/players?q=vidic&position=CM&minOvr=110&maxOvr=120&limit=50'), '/api/players');
const listing = await listResponse.json();
assert.equal(listResponse.status, 200);
assert.equal(listing.players[0].name, 'Luka Modrić');
assert.equal(listing.players[0].image, 'https://assets.example/card.png');
assert.equal(listing.players[0].shard_cost.shard_cost, 1234);
assert.equal(calls.find((call) => call.url.pathname.endsWith('/players')).url.searchParams.get('and'), '(ovr.gte.110,ovr.lte.120)');
assert.equal(calls.find((call) => call.url.pathname.endsWith('/players')).init.headers.range, '0-49');

const detailResponse = await handlePlayerRequest(new Request('https://site.test/api/players/luka-modric-42'), '/api/players/luka-modric-42');
const detail = await detailResponse.json();
assert.equal(detailResponse.status, 200);
assert.equal(detail.stats.stats.pace, 100);
assert.equal(detail.ranks[0].rank, 1);
assert.equal(detail.shard_cost.shard_cost, 1234);
assert.equal(detail.sell_price, null);

const methodResponse = await handlePlayerRequest(new Request('https://site.test/api/players', { method: 'POST' }), '/api/players');
assert.equal(methodResponse.status, 405);
console.log('Player API smoke checks passed.');
