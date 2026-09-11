import { cp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const publicDir = path.join(root, 'public');

// Keep the original working assets available to Astro without moving them by hand.
await mkdir(path.join(publicDir, 'assets'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(publicDir, 'assets'), { recursive: true, force: true });

await exec('astro', ['build'], { cwd: root, shell: process.platform === 'win32' });

const dist = path.join(root, 'dist');

// The standalone trivia library contains many existing HTML pages. Add the same
// site shell to those pages while leaving their quiz markup and JS untouched.
const triviaRoot = path.join(dist, 'trivia');
const shellScript = '/assets/site-shell.js';
const globalCss = '/styles.css';

async function walk(dir) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.name.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}
function exists(p) { try { return require('node:fs').existsSync(p); } catch { return false; } }

for (const file of await walk(triviaRoot)) {
  let html = await readFile(file, 'utf8');
  if (!html.includes('data-site-nav')) {
    html = html.replace('</head>', `  <link rel="stylesheet" href="${globalCss}">\n</head>`);
    html = html.replace(/<header\\s+class=["']topbar["'][\\s\\S]*?<\\/header>/gi, '');
    html = html.replace(/<footer\\s+class=["']site-footer["'][\\s\\S]*?<\\/footer>/gi, '');
    html = html.replace(/<div\\s+data-site-nav-placeholder[^>]*>\\s*<\\/div>/gi, '');
    html = html.replace(/<div\\s+data-site-footer-placeholder[^>]*>\\s*<\\/div>/gi, '');
    html = html.replace('</body>', `  <script src="${shellScript}" defer></script>\n</body>`);
    await writeFile(file, html);
  }
}

console.log('Astro build complete; legacy trivia pages received the shared site shell.');
