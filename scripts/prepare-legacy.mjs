import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const outDir = path.join(publicDir, '_legacy');
const pages = ['legacy/football-centre.html','legacy/creator.html','trivia/index.html','trivia/france/index.html','trivia/mexico/index.html','trivia/brazil/index.html'];

function safeName(file) { return file.replace(/\.html$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase(); }
function extractStyles(source) { return [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n'); }
function extractScripts(source) { return [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((m) => m[1].trim()).filter(Boolean).join('\n\n'); }
function cleanBody(source) {
  let body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? source;
  body = body.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '').replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<header[^>]*class=["'][^"']*\btopbar\b[^"']*["'][\s\S]*?<\/header>/gi, '');
  body = body.replace(/<div[^>]*class=["'][^"']*\btopbar\b[^"']*["'][\s\S]*?<\/div>/gi, '');
  body = body.replace(/<nav[^>]*class=["'][^"']*\btool-nav\b[^"']*["'][\s\S]*?<\/nav>/gi, '');
  body = body.replace(/<footer[^>]*class=["'][^"']*\bsite-footer\b[^"']*["'][\s\S]*?<\/footer>/gi, '');
  body = body.replace(/<div[^>]*data-site-nav-placeholder[^>]*>\s*<\/div>/gi, '').replace(/<div[^>]*data-site-footer-placeholder[^>]*>\s*<\/div>/gi, '');
  return body.trim();
}
function scopeCss(css) {
  const normalized = css.replace(/:root\s*\{/g, ':scope{').replace(/\bbody\s*\{/g, ':scope{');
  return `@scope (.legacy-app) {\n${normalized}\n}\n`;
}

await mkdir(outDir, { recursive: true });
for (const relative of pages) {
  const source = await readFile(path.join(publicDir, relative), 'utf8');
  const name = safeName(relative);
  await writeFile(path.join(outDir, `${name}.html`), cleanBody(source));
  await writeFile(path.join(outDir, `${name}.css`), scopeCss(extractStyles(source)));
  await writeFile(path.join(outDir, `${name}.js`), extractScripts(source));
}

// These old public copies occupy the exact same URLs as the Astro trivia routes.
// Extract them first, then remove the collision before Astro writes the real routes.
await rm(path.join(publicDir, 'trivia'), { recursive: true, force: true });
console.log(`Prepared ${pages.length} legacy apps into public/_legacy.`);
