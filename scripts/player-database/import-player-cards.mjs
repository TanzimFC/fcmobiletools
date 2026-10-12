#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_JSON = 'data/player-cards.json';
const DEFAULT_ASSETS_DIR = 'data/assets';
const DEFAULT_MANIFEST = path.join(os.homedir(), '.cache', 'fcmobiletools', 'player-db-b2-manifest.json');
const BATCH_SIZE = 100;
const B2_WORKERS = 4;

function parseArgs(argv) {
  const options = {
    jsonPath: DEFAULT_JSON,
    assetsDir: DEFAULT_ASSETS_DIR,
    manifestPath: DEFAULT_MANIFEST,
    dryRun: true,
    allowMissingAssets: false,
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') options.dryRun = false;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--allow-missing-assets') options.allowMissingAssets = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--json') options.jsonPath = argv[++i];
    else if (arg === '--assets-dir') options.assetsDir = argv[++i];
    else if (arg === '--manifest') options.manifestPath = argv[++i];
    else throw new Error('Unknown option: ' + arg);
  }
  if (!options.jsonPath || !options.assetsDir || !options.manifestPath) {
    throw new Error('Values are required after --json, --assets-dir, and --manifest.');
  }
  options.jsonPath = path.resolve(options.jsonPath);
  options.assetsDir = path.resolve(options.assetsDir);
  options.manifestPath = path.resolve(options.manifestPath);
  return options;
}

function printHelp() {
  console.log([
    'Player-card database importer',
    '',
    'Dry-run is the default. No network requests or writes occur unless --apply is supplied.',
    '',
    '  node scripts/player-database/import-player-cards.mjs --dry-run --json data/player-cards.json --assets-dir data/assets',
    '  node scripts/player-database/import-player-cards.mjs --apply --json data/player-cards.json --assets-dir data/assets',
    '  Add --allow-missing-assets only when intentionally importing incomplete image coverage.',
    '',
    'Required apply environment variables:',
    '  SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
    '  B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_PUBLIC_BASE_URL',
    '',
    'The Backblaze bucket must be configured for public reads. Never put secret keys in the repository.'
  ].join('\n'));
}

export function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function extractGamePlayerId(card) {
  const image = (card.assets || []).find((asset) => asset.kind === 'player-image' && asset.canonicalSourceUrl);
  if (!image) return null;
  const match = String(image.canonicalSourceUrl).match(/(?:^|\/)player_\d+_(\d+)(?:_|$)/i);
  return match ? match[1] : null;
}

export function derivePlayerKey(card) {
  const gamePlayerId = extractGamePlayerId(card);
  if (gamePlayerId) return { playerKey: 'renderz:' + gamePlayerId, gamePlayerId };
  const suffix = normalizeName((card.details || {}).nation || 'unknown').replace(/\s+/g, '-');
  return { playerKey: 'name:' + normalizeName(card.name).replace(/\s+/g, '-') + ':' + suffix, gamePlayerId: null };
}

export function collectAssetIndex(cards) {
  if (!Array.isArray(cards) || cards.length === 0) throw new Error('The JSON must contain a non-empty array of player-card records.');
  const ids = new Set();
  const assetsByKey = new Map();
  const links = [];

  for (const card of cards) {
    if (!card || typeof card !== 'object') throw new Error('Every card must be an object.');
    if (card.sourceCardId === undefined || card.sourceCardId === null || !String(card.sourceCardId).trim()) {
      throw new Error('A card is missing sourceCardId.');
    }
    const id = String(card.sourceCardId);
    if (ids.has(id)) throw new Error('Duplicate sourceCardId: ' + id);
    ids.add(id);
    if (!String(card.name || '').trim()) throw new Error('Card ' + id + ' is missing its name.');
    const ovr = Number(card.ovr);
    if (!Number.isInteger(ovr) || ovr < 1 || ovr > 200) throw new Error('Card ' + id + ' has an invalid OVR.');

    for (let index = 0; index < (card.assets || []).length; index += 1) {
      const asset = card.assets[index];
      if (!asset || !asset.assetKey || !asset.kind) {
        throw new Error('Card ' + id + ' has an asset without assetKey or kind.');
      }
      const key = String(asset.assetKey);
      const existing = assetsByKey.get(key);
      if (existing) {
        if (existing.kind !== asset.kind) throw new Error('Asset key ' + key + ' is used for more than one asset kind.');
        if (existing.contentHash && asset.contentHash && existing.contentHash !== asset.contentHash) {
          throw new Error('Asset key ' + key + ' has conflicting content hashes.');
        }
        if (!existing.localPath && asset.localPath) existing.localPath = asset.localPath;
        if (!existing.downloadError && asset.downloadError) existing.downloadError = asset.downloadError;
        if (!existing.contentHash && asset.contentHash) existing.contentHash = asset.contentHash;
      } else {
        assetsByKey.set(key, { ...asset, assetKey: key });
      }
      links.push({
        card_id: id,
        asset_key: key,
        role: String(asset.kind),
        asset_order: index,
        is_primary: isPrimaryCardArt(card, asset)
      });
    }
  }

  const seenLinks = new Set();
  const uniqueLinks = links.filter((link) => {
    const key = link.card_id + ':' + link.asset_key;
    if (seenLinks.has(key)) return false;
    seenLinks.add(key);
    return true;
  });

  return { assetsByKey, links: uniqueLinks };
}

function isPrimaryCardArt(card, asset) {
  if (asset.kind !== 'player-card-background') return false;
  const source = String(asset.canonicalSourceUrl || '');
  const alt = String(asset.alt || '');
  return /ANNIVERSARY27/i.test(source) && alt.includes(String(card.ovr) + ' OVR');
}

function safeRawCard(card) {
  const copy = { ...card };
  copy.assets = (card.assets || []).map((asset) => {
    const safe = { ...asset };
    delete safe.sourceUrl;
    delete safe.localPath;
    return safe;
  });
  return copy;
}

function toIso(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function toInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function alternatePositions(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '').split(/[,/|]+/).map((item) => item.trim()).filter(Boolean);
}

export function buildImportRows(cards, collection, fileReport = {}, resolvedByHash = new Map()) {
  const now = new Date().toISOString();
  const playersByKey = new Map();
  const playerRows = [];
  const cardRows = [];

  for (const card of cards) {
    const identity = derivePlayerKey(card);
    if (!playersByKey.has(identity.playerKey)) {
      const player = {
        player_key: identity.playerKey,
        game_player_id: identity.gamePlayerId,
        name: String(card.name),
        normalized_name: normalizeName(card.name),
        created_at: now,
        updated_at: now
      };
      playersByKey.set(identity.playerKey, player);
      playerRows.push(player);
    }

    const details = card.details && typeof card.details === 'object' ? card.details : {};
    cardRows.push({
      id: String(card.sourceCardId),
      player_key: identity.playerKey,
      source_slug: card.sourceSlug || null,
      name: String(card.name),
      normalized_name: normalizeName(card.name),
      ovr: Number(card.ovr),
      position: String(card.position || 'UNK'),
      alternate_positions: alternatePositions(details.alternatePositions),
      program: card.program || null,
      club: details.club || null,
      league: details.league || null,
      nation: details.nation || null,
      source_url: card.sourceUrl || null,
      source_program_url: card.sourceProgramUrl || null,
      source_page_status: toInteger(card.sourcePageStatus),
      source_page_title: card.sourcePageTitle || null,
      collected_at: toIso(card.collectedAt),
      stats_collected_at: toIso(card.statsCollectedAt),
      details: details,
      stats: card.stats && typeof card.stats === 'object' ? card.stats : {},
      stat_extraction: card.statExtraction || null,
      skill_points_to_spend: toInteger(card.skillPointsToSpend),
      skill_points_to_spend_label: card.skillPointsToSpendLabel || null,
      play_styles: card.playStyles === undefined || card.playStyles === null ? [] : card.playStyles,
      skill_tree: card.skillTree === undefined || card.skillTree === null ? {} : card.skillTree,
      game_traits: card.gameTraits === undefined || card.gameTraits === null ? [] : card.gameTraits,
      requested_view_state: card.requestedViewState || null,
      progression: card.progression || null,
      raw_data: safeRawCard(card),
      created_at: now,
      updated_at: now
    });
  }

  const assetRows = [];
  for (const asset of collection.assetsByKey.values()) {
    const localPath = fileReport.fileByKey ? fileReport.fileByKey.get(asset.assetKey) : null;
    const fileHash = fileReport.shaByKey ? fileReport.shaByKey.get(asset.assetKey) : null;
    const contentHash = asset.contentHash || fileHash || null;
    const stored = contentHash ? resolvedByHash.get(contentHash) : null;
    const unavailable = Boolean(asset.downloadError && !localPath && !stored);
    const metadata = { ...asset };
    delete metadata.sourceUrl;
    delete metadata.localPath;
    delete metadata.bytes;
    delete metadata.contentHash;
    delete metadata.contentType;
    delete metadata.width;
    delete metadata.height;
    delete metadata.assetKey;
    assetRows.push({
      asset_key: asset.assetKey,
      kind: asset.kind,
      canonical_source_url: asset.canonicalSourceUrl || null,
      alt: asset.alt || null,
      content_type: asset.contentType || null,
      content_hash: contentHash,
      file_bytes: toInteger(asset.bytes) || (localPath ? (fileReport.sizeByKey || new Map()).get(asset.assetKey) || null : null),
      width: toInteger(asset.width),
      height: toInteger(asset.height),
      b2_object_key: stored ? stored.b2_object_key : null,
      public_url: stored ? stored.public_url : null,
      status: stored && stored.public_url ? 'uploaded' : (unavailable ? 'unavailable' : 'pending'),
      download_error: asset.downloadError || null,
      metadata,
      created_at: now,
      updated_at: now
    });
  }

  const validKeys = new Set(collection.assetsByKey.keys());
  const links = collection.links.filter((link) => validKeys.has(link.asset_key));

  return { players: playerRows, cards: cardRows, assets: assetRows, links };
}

async function loadJson(jsonPath) {
  const source = await fs.readFile(jsonPath, 'utf8');
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error('Cannot parse JSON at ' + jsonPath + ': ' + error.message);
  }
}

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function inspectAssetFiles(assetsByKey, assetsDir) {
  const fileByKey = new Map();
  const shaByKey = new Map();
  const sizeByKey = new Map();
  const mismatches = [];
  const missing = [];
  let unavailable = 0;

  for (const asset of assetsByKey.values()) {
    if (asset.downloadError && !asset.localPath) {
      unavailable += 1;
      continue;
    }
    const basename = asset.localPath ? path.basename(asset.localPath) : (String(asset.kind) + '-' + asset.assetKey + '.png');
    const candidates = [
      path.resolve(assetsDir, basename),
      asset.localPath ? path.resolve(asset.localPath) : null
    ];
    const filePath = await firstExistingPath(candidates);
    if (!filePath) {
      missing.push(asset);
      continue;
    }
    const bytes = await fs.readFile(filePath);
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    if (asset.contentHash && sha.toLowerCase() !== String(asset.contentHash).toLowerCase()) {
      mismatches.push({ assetKey: asset.assetKey, path: filePath, expected: asset.contentHash, actual: sha });
      continue;
    }
    if (asset.bytes !== undefined && asset.bytes !== null && Number(asset.bytes) !== bytes.length) {
      mismatches.push({ assetKey: asset.assetKey, path: filePath, expectedBytes: Number(asset.bytes), actualBytes: bytes.length });
      continue;
    }
    fileByKey.set(asset.assetKey, filePath);
    shaByKey.set(asset.assetKey, sha);
    sizeByKey.set(asset.assetKey, bytes.length);
  }

  return { fileByKey, shaByKey, sizeByKey, missing, mismatches, unavailable };
}

function uniqueContentFiles(collection, fileReport) {
  const byHash = new Map();
  for (const asset of collection.assetsByKey.values()) {
    const filePath = fileReport.fileByKey.get(asset.assetKey);
    if (!filePath) continue;
    const hash = asset.contentHash || fileReport.shaByKey.get(asset.assetKey);
    if (!hash) continue;
    if (!byHash.has(hash)) byHash.set(hash, { hash, filePath, asset });
  }
  return [...byHash.values()];
}

function extensionFor(asset) {
  const type = String(asset.contentType || '').toLowerCase();
  if (type.includes('webp')) return 'webp';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('avif')) return 'avif';
  if (type.includes('gif')) return 'gif';
  return 'png';
}

function objectKeyFor(item) {
  return 'player-database/sha256/' + item.hash + '.' + extensionFor(item.asset);
}

function buildPublicUrl(base, objectKey) {
  return String(base).replace(/\/+$/, '') + '/' + objectKey.split('/').map(encodeURIComponent).join('/');
}

async function readManifest(manifestPath) {
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error('Cannot read B2 manifest at ' + manifestPath + ': ' + error.message);
  }
}

async function writeManifest(manifestPath, manifest) {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const tempPath = manifestPath + '.tmp';
  await fs.writeFile(tempPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await fs.rename(tempPath, manifestPath);
}

function supabaseConfig() {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!baseUrl || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) before using --apply.');
  }
  return { baseUrl, key };
}

function supabaseHeaders(config) {
  return {
    apikey: config.key,
    Authorization: 'Bearer ' + config.key,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

async function supabaseRequest(config, url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...supabaseHeaders(config), ...(options.headers || {}) } });
  const text = await response.text();
  if (!response.ok) {
    throw new Error('Supabase request failed (' + response.status + '): ' + text.slice(0, 1200));
  }
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function getExistingResources(config, hashes) {
  const byHash = new Map();
  const uniqueHashes = [...new Set(hashes.filter(Boolean))];
  for (let start = 0; start < uniqueHashes.length; start += 50) {
    const batch = uniqueHashes.slice(start, start + 50);
    const url = new URL(config.baseUrl + '/rest/v1/player_assets');
    url.searchParams.set('select', 'content_hash,b2_object_key,public_url');
    url.searchParams.set('content_hash', 'in.(' + batch.join(',') + ')');
    const rows = await supabaseRequest(config, url, { method: 'GET' });
    for (const row of rows || []) {
      if (row.content_hash && row.public_url && !byHash.has(row.content_hash)) {
        byHash.set(row.content_hash, {
          b2_object_key: row.b2_object_key || null,
          public_url: row.public_url
        });
      }
    }
  }
  return byHash;
}

async function b2Authorize() {
  const keyId = process.env.B2_APPLICATION_KEY_ID || '';
  const applicationKey = process.env.B2_APPLICATION_KEY || '';
  if (!keyId || !applicationKey) throw new Error('Set B2_APPLICATION_KEY_ID and B2_APPLICATION_KEY to upload assets.');
  const basic = Buffer.from(keyId + ':' + applicationKey).toString('base64');
  const response = await fetch('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', {
    headers: { Authorization: 'Basic ' + basic }
  });
  const text = await response.text();
  if (!response.ok) throw new Error('Backblaze authorization failed (' + response.status + '): ' + text.slice(0, 800));
  const json = JSON.parse(text);
  const api = json.apiInfo && json.apiInfo.storageApi;
  if (!json.authorizationToken || !api || !api.apiUrl) throw new Error('Backblaze returned an incomplete authorization response.');
  return { apiUrl: api.apiUrl, authorizationToken: json.authorizationToken };
}

async function b2GetUploadTarget(auth) {
  const bucketId = process.env.B2_BUCKET_ID || '';
  if (!bucketId) throw new Error('Set B2_BUCKET_ID before uploading assets.');
  const url = auth.apiUrl + '/b2api/v4/b2_get_upload_url?bucketId=' + encodeURIComponent(bucketId);
  const response = await fetch(url, { headers: { Authorization: auth.authorizationToken } });
  const text = await response.text();
  if (!response.ok) throw new Error('Cannot get Backblaze upload URL (' + response.status + '): ' + text.slice(0, 800));
  const data = JSON.parse(text);
  return { uploadUrl: data.uploadUrl, authorizationToken: data.authorizationToken };
}

async function uploadOne(auth, target, item, publicBaseUrl) {
  const bytes = await fs.readFile(item.filePath);
  const sha1 = crypto.createHash('sha1').update(bytes).digest('hex');
  const objectKey = objectKeyFor(item);
  const encodedName = objectKey.split('/').map(encodeURIComponent).join('/');
  let activeTarget = target;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(activeTarget.uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: activeTarget.authorizationToken,
        'X-Bz-File-Name': encodedName,
        'Content-Type': item.asset.contentType || 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'X-Bz-Content-Sha1': sha1
      },
      body: bytes
    });
    const text = await response.text();
    if (response.ok) {
      target.uploadUrl = activeTarget.uploadUrl;
      target.authorizationToken = activeTarget.authorizationToken;
      return { b2_object_key: objectKey, public_url: buildPublicUrl(publicBaseUrl, objectKey) };
    }
    if ((response.status === 401 || response.status >= 500) && attempt < 5) {
      activeTarget = await b2GetUploadTarget(auth);
      continue;
    }
    throw new Error('Backblaze upload failed for ' + objectKey + ' (' + response.status + '): ' + text.slice(0, 1000));
  }
  throw new Error('Backblaze upload failed after five attempts: ' + objectKey);
}

async function uploadAssets(auth, items, publicBaseUrl, manifestPath, manifest) {
  if (items.length === 0) return new Map();
  let cursor = 0;
  let completed = 0;
  const uploadedByHash = new Map();
  let writeChain = Promise.resolve();

  const persistManifest = () => {
    writeChain = writeChain.then(() => writeManifest(manifestPath, manifest));
    return writeChain;
  };

  const worker = async () => {
    let target = await b2GetUploadTarget(auth);
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      const item = items[current];
      const uploaded = await uploadOne(auth, target, item, publicBaseUrl).catch(async (error) => {
        if (String(error.message).includes('Backblaze upload failed')) throw error;
        throw error;
      });
      uploadedByHash.set(item.hash, uploaded);
      manifest[item.hash] = uploaded;
      await persistManifest();
      completed += 1;
      if (completed === items.length || completed % 25 === 0) {
        console.log('[B2] Uploaded ' + completed + '/' + items.length + ' unique image files.');
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(B2_WORKERS, items.length) }, () => worker()));
  return uploadedByHash;
}

async function upsertBatch(config, table, conflict, rows) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const url = new URL(config.baseUrl + '/rest/v1/' + table);
    url.searchParams.set('on_conflict', conflict);
    await supabaseRequest(config, url, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch)
    });
  }
}

function logReport(cards, collection, fileReport, contentFiles) {
  const uniqueHashes = new Set([...collection.assetsByKey.values()].map((asset) => asset.contentHash).filter(Boolean));
  console.log('Player database import preflight');
  console.log('  Cards: ' + cards.length);
  console.log('  Unique player identities: ' + new Set(cards.map((card) => derivePlayerKey(card).playerKey)).size);
  console.log('  Unique asset records: ' + collection.assetsByKey.size);
  console.log('  Distinct source content hashes: ' + uniqueHashes.size);
  console.log('  Local assets verified: ' + fileReport.fileByKey.size);
  console.log('  Unique local content files: ' + contentFiles.length);
  console.log('  Known source download failures: ' + fileReport.unavailable);
  console.log('  Missing local assets: ' + fileReport.missing.length);
  console.log('  File/hash mismatches: ' + fileReport.mismatches.length);
  if (fileReport.mismatches.length) {
    for (const mismatch of fileReport.mismatches.slice(0, 10)) {
      console.log('    MISMATCH ' + mismatch.assetKey + ' (' + mismatch.path + ')');
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const cards = await loadJson(options.jsonPath);
  const collection = collectAssetIndex(cards);
  const fileReport = await inspectAssetFiles(collection.assetsByKey, options.assetsDir);
  const contentFiles = uniqueContentFiles(collection, fileReport);
  logReport(cards, collection, fileReport, contentFiles);

  if (fileReport.mismatches.length) {
    throw new Error('Image integrity checks failed. Restore the original extracted assets before importing.');
  }

  if (options.dryRun) {
    if (fileReport.missing.length && !options.allowMissingAssets) {
      throw new Error('Dry run found missing assets. Supply the complete data/assets folder, or add --allow-missing-assets for an intentionally incomplete test.');
    }
    console.log('DRY RUN passed. No Supabase or Backblaze writes were made.');
    return;
  }

  const supabase = supabaseConfig();
  const manifest = await readManifest(options.manifestPath);
  const hashesToCheck = [];
  for (const asset of collection.assetsByKey.values()) {
    const hash = asset.contentHash || fileReport.shaByKey.get(asset.assetKey);
    if (hash) hashesToCheck.push(hash);
  }
  const existingByHash = await getExistingResources(supabase, hashesToCheck);
  const reusableByHash = new Map(existingByHash);
  for (const [hash, item] of Object.entries(manifest)) {
    if (item && item.public_url && !reusableByHash.has(hash)) reusableByHash.set(hash, item);
  }

  const unresolvedMissing = fileReport.missing.filter((asset) => {
    const hash = asset.contentHash;
    return !(hash && reusableByHash.has(hash)) && !asset.downloadError;
  });
  if (unresolvedMissing.length && !options.allowMissingAssets) {
    throw new Error('Import stopped before uploads: ' + unresolvedMissing.length + ' assets are absent locally and not already present in B2. Add the complete image collection or deliberately pass --allow-missing-assets.');
  }

  const allContentFiles = uniqueContentFiles(collection, fileReport);
  const uploadJobs = allContentFiles.filter((item) => !reusableByHash.has(item.hash));
  const uploadedByHash = new Map(reusableByHash);

  if (uploadJobs.length) {
    const publicBaseUrl = process.env.B2_PUBLIC_BASE_URL || '';
    if (!publicBaseUrl) throw new Error('Set B2_PUBLIC_BASE_URL to the public download base for the B2 bucket before uploading.');
    if (!process.env.B2_BUCKET_ID) {
      throw new Error('Set B2_BUCKET_ID before uploading.');
    }
    const auth = await b2Authorize();
    const newUploads = await uploadAssets(auth, uploadJobs, publicBaseUrl, options.manifestPath, manifest);
    for (const [hash, resource] of newUploads) uploadedByHash.set(hash, resource);
  }

  const rows = buildImportRows(cards, collection, fileReport, uploadedByHash);
  console.log('Writing Supabase rows in batches...');
  await upsertBatch(supabase, 'players', 'player_key', rows.players);
  await upsertBatch(supabase, 'player_cards', 'id', rows.cards);
  await upsertBatch(supabase, 'player_assets', 'asset_key', rows.assets);
  await upsertBatch(supabase, 'player_card_assets', 'card_id,asset_key', rows.links);

  console.log('Import complete.');
  console.log('  Player identities upserted: ' + rows.players.length);
  console.log('  Individual card records upserted: ' + rows.cards.length);
  console.log('  Asset metadata rows upserted: ' + rows.assets.length);
  console.log('  Card-to-asset links upserted: ' + rows.links.length);
  console.log('  Assets still pending: ' + rows.assets.filter((asset) => asset.status === 'pending').length);
  console.log('  Assets unavailable at source: ' + rows.assets.filter((asset) => asset.status === 'unavailable').length);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error('[player-db] ' + error.message);
    process.exitCode = 1;
  });
}
