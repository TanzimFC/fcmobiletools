import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'assets', 'images', 'playstyle');
const outputFile = path.join(root, 'src', 'data', 'playstyle-assets.json');

const slug = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

let files = [];
try {
  files = (await readdir(sourceDir)).filter((file) => /\.png$/i.test(file));
} catch {
  files = [];
}

const map = {};
for (const file of files) {
  const match = file.match(/_PLAYSTYLE_(.+)_(0|1|2)\.png$/i);
  if (!match) continue;

  const name = match[1].replace(/_/g, ' ');
  const key = slug(name);
  if (!key) continue;

  if (!map[key]) map[key] = [];
  map[key][Number(match[2])] = '/assets/images/playstyle/' + file;
}

for (const key of Object.keys(map)) {
  map[key] = map[key].filter(Boolean);
}

await writeFile(
  outputFile,
  JSON.stringify(map, null, 2) + '\n',
  'utf8'
);

console.log('[playstyle-assets] mapped styles:', Object.keys(map).length);
