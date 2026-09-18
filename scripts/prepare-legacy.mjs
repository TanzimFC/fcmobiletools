import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const outDir = path.join(publicDir, '_legacy');
const pages = [
  ['football-centre', 'legacy-football-centre']
];

function extractStyles(source) {
  return [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
}

async function readReferencedAsset(src, sourceFile) {
  if (!src || /^https?:\/\//i.test(src) || src.startsWith('//')) return '';
  const clean = src.split('?')[0].split('#')[0];
  const candidates = clean.startsWith('/')
    ? [path.join(root, clean.slice(1)), path.join(publicDir, clean.slice(1))]
    : [path.resolve(root, path.dirname(sourceFile), clean), path.join(root, clean)];
  for (const candidate of candidates) {
    try { return await readFile(candidate, 'utf8'); } catch {}
  }
  return '';
}

async function extractScripts(source, sourceFile) {
  const inline = [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs]) => !/\bsrc\s*=|\btype\s*=\s*["'](?:application\/(?:ld\+json|json)|text\/json)["']/i.test(attrs))
    .map(([, , body]) => body.trim()).filter(Boolean);
  const external = [];
  for (const [, attrs] of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const match = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (match) {
      const content = await readReferencedAsset(match[1], sourceFile);
      if (content.trim()) external.push(content.trim());
    }
  }
  return [...external, ...inline].join('\n\n');
}

async function extractLinkedStyles(source, sourceFile) {
  const styles = [];
  for (const [, attrs] of source.matchAll(/<link([^>]*)>/gi)) {
    const rel = attrs.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || '';
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (/\bstylesheet\b/i.test(rel) && href) {
      const content = await readReferencedAsset(href, sourceFile);
      if (content.trim()) styles.push(content.trim());
    }
  }
  return styles.join('\n\n');
}

function cleanBody(source) {
  let body = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? source;
  body = body.replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '').replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, '');
  body = body.replace(/<header[^>]*class=["'][^"']*\btopbar\b[^"']*["'][\s\S]*?<\/header>/gi, '');
  body = body.replace(/<div[^>]*class=["'][^"']*\btopbar\b[^"']*["'][\s\S]*?<\/div>/gi, '');
  body = body.replace(/<nav[^>]*class=["'][^"']*\btool-nav\b[^"']*["'][\s\S]*?<\/nav>/gi, '');
  body = body.replace(/<nav[^>]*class=["'][^"']*\bnav\b[^"']*["'][\s\S]*?<\/nav>/gi, '');
  body = body.replace(/<footer[^>]*class=["'][^"']*\bsite-footer\b[^"']*["'][\s\S]*?<\/footer>/gi, '');
  body = body.replace(/<div[^>]*data-site-nav-placeholder[^>]*>\s*<\/div>/gi, '').replace(/<div[^>]*data-site-footer-placeholder[^>]*>\s*<\/div>/gi, '');
  return body.trim();
}

function scopeCss(css, name) {
  let normalized = css.replace(/:root\s*\{/g, ':scope{').replace(/\bbody\s*\{/g, ':scope{');
  if (name === 'legacy-football-centre') {
    normalized = normalized.replaceAll('#8b5cf6', '#38bdf8').replaceAll('#a78bfa', '#7dd3fc').replaceAll('#7c4fe0', '#0ea5e9').replaceAll('#6d3fd1', '#0284c7').replaceAll('#5b49ff', '#0ea5e9').replaceAll('#6952ff', '#38bdf8').replaceAll('#4d3ab4', '#075985');
  }
  return `@scope (.legacy-app) {\n${normalized}\n}\n`;
}

await mkdir(outDir, { recursive: true });
for (const [source, name] of pages) {
  const input = await readFile(path.join(root, source), 'utf8');
  const sourceFile = source;
  const css = [extractStyles(input), await extractLinkedStyles(input, sourceFile)].filter(Boolean).join('\n\n');
  await writeFile(path.join(outDir, `${name}.html`), cleanBody(input));
  await writeFile(path.join(outDir, `${name}.css`), scopeCss(css, name));
  await writeFile(path.join(outDir, `${name}.js`), await extractScripts(input, sourceFile));
}
console.log(`Prepared ${pages.length} legacy apps into public/_legacy.`);
