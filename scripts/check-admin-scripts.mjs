// Compile every inline JavaScript block in the admin HTML during builds.
// This catches parse failures that otherwise prevent the entire admin workspace
// from initializing, even when individual Supabase endpoints are healthy.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('admin');
const pages = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(file);
    } else if (entry.isFile() && file.endsWith('.html')) {
      pages.push(file);
    }
  }
}

await walk(root);

let checked = 0;
const failures = [];

for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];

  for (let index = 0; index < blocks.length; index += 1) {
    const [, attributes = '', source = ''] = blocks[index];
    if (/\bsrc\s*=/i.test(attributes) || !source.trim()) continue;
    if (/\btype\s*=\s*["']module["']/i.test(attributes)) {
      failures.push(`${path.relative(process.cwd(), file)}: module script requires a module-aware parser.`);
      continue;
    }

    checked += 1;
    try {
      // Compile only. Never execute admin page code during a build.
      new Function(source);
    } catch (error) {
      const preceding = html.slice(0, blocks[index].index);
      const line = preceding.split('\n').length;
      failures.push(`${path.relative(process.cwd(), file)} (script ${index + 1}, HTML line ${line}): ${error.message}`);
    }
  }
}

if (failures.length) {
  console.error('Admin inline JavaScript syntax check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Admin inline JavaScript syntax check passed: ${checked} block(s) across ${pages.length} HTML page(s).`);
}
