import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const publicDir = path.join(root, 'public');

await mkdir(path.join(publicDir, 'assets'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(publicDir, 'assets'), { recursive: true, force: true });

// Old copied legacy Trivia assets are intentionally removed. A Nation's Story is now
// generated entirely by Astro from src/data/aNationsStory.js.
await rm(path.join(publicDir, 'trivia'), { recursive: true, force: true });

await exec('node', ['scripts/prepare-legacy.mjs'], { cwd: root });
await exec('astro', ['build'], { cwd: root });

console.log('Astro build complete. A Nation\'s Story is served by the new Astro architecture.');
