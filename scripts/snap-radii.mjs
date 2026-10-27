// One-off codemod: snaps every hard-coded px border-radius to the three design tokens.
//   5-9px  -> var(--r-sm)   (controls)
//   10-15  -> var(--r-md)   (buttons, cards)
//   16-98  -> var(--r-lg)   (large panels)
//   <=4px and >=99px (pills) and percentages stay as they are.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['src', 'styles.css'];
const skip = new Set(['node_modules', 'system.css']);
const exts = new Set(['.astro', '.css']);
let files = 0, changes = 0;

const snap = (n) => (n <= 4 || n >= 99 ? null : n <= 9 ? 'var(--r-sm)' : n <= 15 ? 'var(--r-md)' : 'var(--r-lg)');

async function walk(p) {
  const out = [];
  let st;
  try { st = await readdir(p, { withFileTypes: true }); } catch { return [p]; }
  for (const e of st) {
    if (skip.has(e.name)) continue;
    const full = path.join(p, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (exts.has(path.extname(e.name))) out.push(full);
  }
  return out;
}

for (const r of roots) {
  for (const f of await walk(r)) {
    if (!exts.has(path.extname(f))) continue;
    const src = await readFile(f, 'utf8');
    let n = 0;
    const next = src.replace(/(border-radius\s*:\s*)([^;}"'\n]+)/g, (m, head, val) => {
      if (/var\(|%|\//.test(val)) return m; // leave tokens, ellipses and elliptical radii alone
      const v2 = val.replace(/(\d+(?:\.\d+)?)px/g, (mm, num) => {
        const t = snap(parseFloat(num));
        if (t) { n++; return t; }
        return mm;
      });
      return head + v2;
    });
    if (n) { await writeFile(f, next); files++; changes += n; }
  }
}
console.log(`snapped ${changes} radii in ${files} files`);
