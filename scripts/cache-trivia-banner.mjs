// One-time download of the Season Recap banner into the repo so it is served from
// our own static assets and never hits Cloudinary again.
//
//   node scripts/cache-trivia-banner.mjs          # downloads if missing
//   node scripts/cache-trivia-banner.mjs --force  # re-download
//
// Then commit assets/trivia/*. For a new banner: change the version in the
// Cloudinary URL below AND the filename (it is cached "immutable" for a year).
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://res.cloudinary.com/b0qikv7n/image/upload/v1791739595/fc-mobile-tools/tra319zimnvlfas22fj8';
const OUT_DIR = path.join(process.cwd(), 'assets', 'trivia');
const FILES = [
  { url: `${BASE}.webp`, name: 'season-recap-challenge-2026-10.webp', magic: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  // JPEG copy is only used for og:image (some social crawlers dislike WebP).
  { url: `${BASE}.jpg`, name: 'season-recap-challenge-2026-10.jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 }
];
const force = process.argv.includes('--force');

await mkdir(OUT_DIR, { recursive: true });
for (const file of FILES) {
  const target = path.join(OUT_DIR, file.name);
  if (!force) {
    try { await access(target); console.log(`✓ ${file.name} already cached`); continue; } catch {}
  }
  const res = await fetch(file.url);
  if (!res.ok) throw new Error(`${file.url} → HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!file.magic(bytes) || bytes.length < 5_000) throw new Error(`${file.name}: response is not a valid image`);
  await writeFile(target, bytes);
  console.log(`✓ saved ${file.name} (${(bytes.length / 1024).toFixed(0)} KB)`);
}
console.log('\nDone. Commit assets/trivia/ — it is now served from your own domain with a 1-year cache.');
