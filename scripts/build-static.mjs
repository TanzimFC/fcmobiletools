import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const publicDir = path.join(root, 'public');

await mkdir(path.join(publicDir, 'assets'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(publicDir, 'assets'), { recursive: true, force: true });

await exec('node', ['scripts/prepare-legacy.mjs'], { cwd: root });
await exec('astro', ['build'], { cwd: root });

console.log('Astro build complete with isolated legacy app assets.');
