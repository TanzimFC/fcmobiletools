import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fetchZenithTopPlayerIds } from '../../src/lib/zenithPlayerApi.js';

const output = process.env.TOP_PLAYERS_OUTPUT || 'src/data/top-players.json';
const limit = Math.min(100_000, Math.max(1, Number(process.env.TOP_PLAYERS_LIMIT || 10_000)));

async function readExisting() {
  try {
    const raw = JSON.parse(await readFile(resolve(output), 'utf8'));
    return Array.isArray(raw) ? raw.map((id) => String(id).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

try {
  const ids = await fetchZenithTopPlayerIds(limit);
  if (!ids.length) throw new Error('Zenith returned no player IDs.');
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), JSON.stringify(ids, null, 2) + '\n', 'utf8');
  console.log('[top-players] generated', ids.length, 'player IDs');
} catch (error) {
  const existing = await readExisting();
  if (!existing.length) throw error;
  console.warn('[top-players] refresh failed, keeping existing index:', error.message);
  console.warn('[top-players] existing IDs:', existing.length);
}
