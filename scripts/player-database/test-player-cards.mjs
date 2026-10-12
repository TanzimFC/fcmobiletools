import assert from 'node:assert/strict';
import {
  buildImportRows,
  collectAssetIndex,
  derivePlayerKey,
  normalizeName
} from './import-player-cards.mjs';

const high = {
  sourceCardId: 'card-high-122',
  sourceSlug: 'card-high-122-example-player',
  name: 'Éxample Player',
  ovr: 122,
  position: 'ST',
  program: '3rd Anniversary',
  sourceUrl: 'https://renderz.app/player/card-high-122',
  sourceProgramUrl: 'https://renderz.app/programs/PROGRAM_ANN27-3rd-anniversary',
  collectedAt: '2026-10-12T17:00:00.000Z',
  sourcePageStatus: 200,
  sourcePageTitle: 'Example Player — 122 OVR',
  details: { club: 'Example FC', league: 'Example League', nation: 'Exampleland', alternatePositions: 'LW' },
  stats: { pace: { value: 160 } },
  assets: [
    {
      assetKey: 'render-high',
      kind: 'player-image',
      canonicalSourceUrl: 'https://images-v2.renderz.app/player_26_231747',
      contentType: 'image/png',
      contentHash: null,
      width: 256,
      height: 256
    },
    {
      assetKey: 'background-high',
      kind: 'player-card-background',
      canonicalSourceUrl: 'https://images-v2.renderz.app/bg_23_backgrounds_27_ANNIVERSARY27_LIVE_STATIC',
      alt: 'Éxample Player 122 OVR card design',
      contentType: 'image/png',
      contentHash: null,
      width: 256,
      height: 256
    }
  ]
};

const low = {
  ...high,
  sourceCardId: 'card-low-117',
  sourceSlug: 'card-low-117-example-player',
  ovr: 117,
  sourceUrl: 'https://renderz.app/player/card-low-117',
  sourcePageTitle: 'Example Player — 117 OVR',
  stats: { pace: { value: 151 } },
  assets: [
    {
      ...high.assets[0],
      assetKey: 'render-low'
    },
    {
      ...high.assets[1],
      assetKey: 'background-low',
      alt: 'Éxample Player 117 OVR card design'
    }
  ]
};

assert.equal(normalizeName('Éxample Player'), 'example player');
assert.equal(derivePlayerKey(high).playerKey, derivePlayerKey(low).playerKey);

const collection = collectAssetIndex([high, low]);
const report = {
  fileByKey: new Map(),
  shaByKey: new Map(),
  sizeByKey: new Map()
};
const rows = buildImportRows([high, low], collection, report, new Map());

assert.equal(rows.players.length, 1, 'multiple card versions should share one player identity');
assert.equal(rows.cards.length, 2, 'high- and lower-OVR cards must remain separate database rows');
assert.deepEqual(rows.cards.map((row) => row.ovr).sort((a, b) => a - b), [117, 122]);
assert.notEqual(rows.cards[0].id, rows.cards[1].id);
assert.equal(rows.assets.length, 4);
assert.equal(rows.links.length, 4);
assert.equal(rows.links.filter((row) => row.is_primary).length, 2, 'each card should retain its matching anniversary artwork');
assert.equal(rows.cards[0].player_key, rows.cards[1].player_key);

console.log('Player database tests passed: card variants stay separate and share the correct player identity.');
