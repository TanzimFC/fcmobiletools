import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// This project is intentionally kept as a static site. The existing FC Mobile
// tools are standalone working documents and must be copied byte-for-byte.
// Astro is retained for the newer content work, but is not allowed to replace
// the legacy app routes with wrappers/iframes.
const entries = [
  'index.html',
  'football-centre',
  'football-centre-v1',
  'fc-mobile-beta',
  'creator.html',
  'trivia',
  'trivia.css',
  'trivia.js',
  'blog',
  'styles.css',
  'assets',
  'google1354adde34ae5b2c.html',
];

for (const entry of entries) {
  const source = path.join(root, entry);
  if (!existsSync(source)) continue;
  await cp(source, path.join(dist, entry), { recursive: true, force: true });
}

// Cloudflare's static assets handler serves a directory named `football-centre`
// as a file when it has no extension. Keep a conventional fallback 404 page.
await cp(path.join(root, '404.html'), path.join(dist, '404.html'), { force: true }).catch(() => {});

console.log(`Static site prepared in ${dist}`);
