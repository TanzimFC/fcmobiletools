import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');

await mkdir(path.join(publicDir, 'assets'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(publicDir, 'assets'), { recursive: true, force: true });
// The old public/trivia copies collide with the Astro /trivia routes.
await rm(path.join(publicDir, 'trivia'), { recursive: true, force: true });

await exec('node', ['scripts/prepare-legacy.mjs'], { cwd: root });
await exec('astro', ['build'], { cwd: root });

// Keep every existing trivia day as a normal static page. Only the landing and
// nation index pages are owned by Astro; day pages keep their original content.
const triviaSource = path.join(root, 'trivia');
const triviaDist = path.join(distDir, 'trivia');
const triviaAssets = path.join(triviaSource, 'assets');
await mkdir(path.join(triviaDist, 'assets'), { recursive: true });
await cp(triviaAssets, path.join(triviaDist, 'assets'), { recursive: true, force: true });

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'assets') files.push(...await walk(full));
    else if (entry.isFile() && /^day-\d+\.html$/i.test(entry.name)) files.push(full);
  }
  return files;
}

const siteShell = await readFile(path.join(root, 'assets', 'site-shell.js'), 'utf8');
for (const sourceFile of await walk(triviaSource)) {
  const relative = path.relative(triviaSource, sourceFile);
  const destination = path.join(triviaDist, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  let html = await readFile(sourceFile, 'utf8');
  html = html.replace(/<nav\s+class=["']nav["'][\s\S]*?<\/nav>/gi, '');
  html = html.replace(/<header[^>]*class=["'][^"']*\btopbar\b[^"']*["'][\s\S]*?<\/header>/gi, '');
  html = html.replace(/<footer[^>]*class=["'][^"']*\bsite-footer\b[^"']*["'][\s\S]*?<\/footer>/gi, '');
  html = html.replace(/<div[^>]*data-site-nav-placeholder[^>]*>\s*<\/div>/gi, '');
  html = html.replace(/<div[^>]*data-site-footer-placeholder[^>]*>\s*<\/div>/gi, '');
  html = html.replace(/<\/head>/i, '  <link rel="stylesheet" href="/styles.css">\n</head>');
  html = html.replace(/<\/body>/i, `  <script>${siteShell.replace(/<\/script>/gi, '<\\/script>')}</script>\n</body>`);
  await writeFile(destination, html);
}

console.log('Astro build complete with isolated legacy apps and preserved trivia day routes.');
