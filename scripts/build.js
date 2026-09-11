#!/usr/bin/env node
/**
 * Injects shared partials (nav, footer) into every HTML file under src/
 * and writes the result to the matching path at the repo root.
 *
 * In each src/*.html file, mark where a partial goes with a pair of
 * comments like this:
 *
 *   <!-- BUILD:INCLUDE nav -->
 *   <!-- END:INCLUDE nav -->
 *
 * Anything between the two markers gets replaced with the contents of
 * partials/nav.html. Re-running the build is safe — it always replaces
 * whatever is currently between the markers, so it won't duplicate content.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const PARTIALS_DIR = path.join(ROOT, 'partials');

function loadPartial(name) {
  const file = path.join(PARTIALS_DIR, `${name}.html`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8').trim();
}

const partialCache = {};
function getPartial(name) {
  if (!(name in partialCache)) partialCache[name] = loadPartial(name);
  return partialCache[name];
}

function injectPartials(html, filePath) {
  return html.replace(
    /<!--\s*BUILD:INCLUDE\s+([\w-]+)\s*-->[\s\S]*?<!--\s*END:INCLUDE\s+\1\s*-->/g,
    (match, name) => {
      const partial = getPartial(name);
      if (partial === null) {
        console.warn(`  ! No partials/${name}.html found (in ${filePath}) — left as-is.`);
        return match;
      }
      return `<!-- BUILD:INCLUDE ${name} -->\n${partial}\n<!-- END:INCLUDE ${name} -->`;
    }
  );
}

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, callback);
    } else if (entry.name.endsWith('.html')) {
      callback(full);
    }
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`No src/ directory found at ${SRC}. Nothing to build.`);
  process.exit(1);
}

let changed = 0;
let total = 0;

walk(SRC, (file) => {
  total++;
  const rel = path.relative(SRC, file);
  const outPath = path.join(ROOT, rel);
  const original = fs.readFileSync(file, 'utf8');
  const built = injectPartials(original, rel);

  const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
  if (existing !== built) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, built);
    changed++;
    console.log(`Built ${rel} -> ${path.relative(ROOT, outPath)}`);
  }
});

console.log(`\n${changed}/${total} file(s) updated.`);
