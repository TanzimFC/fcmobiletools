// Compile every inline JavaScript block in admin HTML during builds.
// Classic scripts are parsed as scripts; module scripts are parsed as .mjs files.
// This is a syntax-only check. It never executes admin page code.
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
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
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'fcm-admin-script-check-'));

try {
  for (const file of pages) {
    const html = await readFile(file, 'utf8');
    const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];

    for (let index = 0; index < blocks.length; index += 1) {
      const [, attributes = '', source = ''] = blocks[index];
      if (/\bsrc\s*=/i.test(attributes) || !source.trim()) continue;

      checked += 1;
      const preceding = html.slice(0, blocks[index].index);
      const line = preceding.split('\n').length;
      const relativeFile = path.relative(process.cwd(), file);
      const isModule = /\btype\s*=\s*["']module["']/i.test(attributes);

      try {
        if (isModule) {
          const temporaryFile = path.join(temporaryDirectory, `inline-${checked}.mjs`);
          await writeFile(temporaryFile, source, 'utf8');
          // Node parses .mjs in module mode. --check does not evaluate imports or execute code.
          await exec(process.execPath, ['--check', temporaryFile], { maxBuffer: 4 * 1024 * 1024 });
        } else {
          // Compile only. Never execute admin page code during a build.
          new Function(source);
        }
      } catch (error) {
        const detail = String(error.stderr || error.message || 'Syntax check failed').trim();
        failures.push(`${relativeFile} (script ${index + 1}, HTML line ${line}): ${detail}`);
      }
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Admin inline JavaScript syntax check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Admin inline JavaScript syntax check passed: ${checked} block(s) across ${pages.length} HTML page(s).`);
}
