import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const outDir = path.join(publicDir, '_legacy');
const pages = [
  ['football-centre', 'football-centre'],
  ['creator.html', 'creator'],
  ['trivia/index.html', 'trivia-index'],
  ['trivia/france/index.html', 'trivia-france-index'],
  ['trivia/mexico/index.html', 'trivia-mexico-index'],
  ['trivia/brazil/index.html', 'trivia-brazil-index']
];

function extractStyles(source) {
  return [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
}
function extractScripts(source) {
  return [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=|\btype\s*=\s*["'](?:application\/(?:ld\+json|json)|text\/json)["']/i.test(attrs))
    .map(([, , body]) => body.trim())
    .filter(Boolean)
    .join('\n\n');
}
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
for (const [source, name] of pages) {
  const input = await readFile(path.join(root, source), 'utf8');
  await writeFile(path.join(outDir, `${name}.html`), cleanBody(input));
  await writeFile(path.join(outDir, `${name}.css`), scopeCss(extractStyles(input)));
  await writeFile(path.join(outDir, `${name}.js`), extractScripts(input));
}
console.log(`Prepared ${pages.length} legacy apps into public/_legacy.`);
