#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const base = 'https://fcmobilesquad.com/star-signings-players';
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/player-data/fetch-star-shards.mjs <output.json>');

const decode = (text) => text.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/\s+/g, ' ').trim();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pages = [];
async function fetchPage(page) {
  const url = new URL(base);
  if (page > 1) url.searchParams.set('page', String(page));
  const response = await fetch(url, { headers: { accept: 'text/html', 'user-agent': 'FCMOBILETOOLS player catalog import/1.0' }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`Shard source returned ${response.status} on page ${page}.`);
  return response.text();
}
pages.push(await fetchPage(1));
const pageCount = Math.max(1, ...[...pages[0].matchAll(/\?page=(\d+)/g)].map((match) => Number(match[1])));
for (let page = 2; page <= pageCount; page++) { await pause(900); pages.push(await fetchPage(page)); }

const observedAt = new Date().toISOString();
const players = [];
for (const html of pages) for (const [, row] of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
  if (!row.includes('data-label="Player card"')) continue;
  const imageUrl = row.match(/class="player-card-base-image"[^>]*src="([^"]+)/)?.[1] || '';
  const id = Number(imageUrl.match(/\/([0-9]+)-[\da-f]+\.png$/i)?.[1]);
  const name = decode(row.match(/class="star-shard-player-name[^\"]*"[^>]*>([\s\S]*?)<\/a>/)?.[1] || row.match(/<img[^>]*alt="([^"]+) card"/)?.[1] || '');
  const cell = (label) => decode(row.match(new RegExp(`<td data-label="${label}">([\\s\\S]*?)<\\/td>`))?.[1] || '');
  const ovr = Number(cell('OVR'));
  const position = cell('Position');
  const alternates = cell('Alternative positions').split(',').map((x) => x.trim()).filter(Boolean);
  const event = cell('Program');
  const shardCost = Number(cell('Star Shards').replace(/,/g, ''));
  const slugName = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  players.push({ player_id: id, name, slug: `${slugName}-${id}`, ovr, position, alternate_positions: alternates, event, player_image_url: imageUrl, shard_cost: shardCost, shard_type: 'star_shard', source_name: 'FC Mobile Squad', source_url: base, usage_policy: 'Factual data and in-game art reuse authorized by project owner; source attribution retained.', observed_at: observedAt });
}

const seen = new Set();
const expected = Number(pages[0].match(/(\d+) total/)?.[1]);
const invalid = players.filter((x) => !Number.isSafeInteger(x.player_id) || !x.name || !Number.isInteger(x.ovr) || x.ovr < 1 || x.ovr > 150 || !x.position || !x.event || !Number.isSafeInteger(x.shard_cost) || x.shard_cost < 0 || seen.has(x.player_id) || !seen.add(x.player_id));
if (!expected || players.length !== expected || invalid.length) throw new Error(`Validation failed: source advertised ${expected || 'an unknown number'}, found ${players.length} rows and ${invalid.length} invalid or duplicate rows.`);
await writeFile(output, `${JSON.stringify(players, null, 2)}\n`);
console.log(`Saved ${players.length} validated players to ${output}.`);
