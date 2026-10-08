// Inlines scripts/admin-premium.css into every admin HTML page, just before </head>.
// Idempotent: re-running replaces the previous block between the markers.
// Usage: node scripts/inject-admin-premium.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const css = (await readFile(path.join(root, 'scripts', 'admin-premium.css'), 'utf8')).trim();
const START = '<!--premium-admin:start-->';
const END = '<!--premium-admin:end-->';
const block = `${START}<style id="premium-admin-ui">\n${css}\n</style>${END}`;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.html') && e.name !== 'login.html') out.push(p);
  }
  return out;
}

for (const file of await walk(path.join(root, 'admin'))) {
  let html = await readFile(file, 'utf8');
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  if (re.test(html)) html = html.replace(re, () => block);
  else if (html.includes('</head>')) html = html.replace('</head>', () => block + '</head>');
  else { console.log('skip (no </head>):', file); continue; }
  await writeFile(file, html);
  console.log('injected', path.relative(root, file));
}
