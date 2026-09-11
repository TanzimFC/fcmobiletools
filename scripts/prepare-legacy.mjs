import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const outDir = path.join(publicDir, '_legacy');

const pages = [
  'legacy/football-centre.html',
  'legacy/creator.html',
  'trivia/index.html',
  'trivia/france/index.html',
  'trivia/mexico/index.html',
  'trivia/brazil/index.html'
];

function safeName(file) {
  return file.replace(/\.html$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

function extractStyles(source) {
  return [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join('\n');
}

function extractScripts(source) {
  return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter(Boolean)
    .filter((script) => !/<\s*script/i.test(script))
    .join('\n\n');
}

function cleanBody(source) {
  let body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? source;
  body = body.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '');
  body = body.replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<header[^>]*class=["'][^"']*\btopbar\b[^"']*["'][\s\S]*?<\/header>/gi, '');
  body = body.replace(/<div[^>]*class=["'][^"']*\btopbar\b[^"']*["'][\s\S]*?<\/div>/gi, '');
  body = body.replace(/<nav[^>]*class=["'][^"']*\btool-nav\b[^"']*["'][\s\S]*?<\/nav>/gi, '');
  body = body.replace(/<footer[^>]*class=["'][^"']*\bsite-footer\b[^"']*["'][\s\S]*?<\/footer>/gi, '');
  body = body.replace(/<div[^>]*data-site-nav-placeholder[^>]*>\s*<\/div>/gi, '');
  body = body.replace(/<div[^>]*data-site-footer-placeholder[^>]*>\s*<\/div>/gi, '');
  return body.trim();
}

function scopeCss(css) {
  return css
    .replace(/:root\s*\{/g, '.legacy-app{')
    .replace(/\bbody\s*\{/g, '.legacy-app{')
    .replace(/(^|\})\s*\*\s*\{/g, '$1.legacy-app *{')
    .replace(/(^|\})\s*button\s*,\s*input\s*\{/g, '$1.legacy-app button,.legacy-app input{')
    .replace(/(^|\})\s*button\s*\{/g, '$1.legacy-app button{')
    .replace(/(^|\})\s*a\s*\{/g, '$1.legacy-app a{')
    .replace(/\.site-nav/g, '.legacy-app .site-nav')
    .replace(/\.site-footer/g, '.legacy-app .site-footer');
}

await mkdir(outDir, { recursive: true });

for (const relative of pages) {
  const sourcePath = path.join(publicDir, relative);
  const source = await readFile(sourcePath, 'utf8');
  const name = safeName(relative);
  await writeFile(path.join(outDir, `${name}.html`), cleanBody(source));
  await writeFile(path.join(outDir, `${name}.css`), scopeCss(extractStyles(source)));
  await writeFile(path.join(outDir, `${name}.js`), extractScripts(source));
}

console.log(`Prepared ${pages.length} legacy apps into public/_legacy.`);
