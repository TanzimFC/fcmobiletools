import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const publicDir = path.join(root, 'public');

await mkdir(path.join(publicDir, 'assets'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(publicDir, 'assets'), { recursive: true, force: true });
await rm(path.join(publicDir, 'trivia'), { recursive: true, force: true });

const redeemJson = path.join(root, 'src', 'data', 'redeem-codes.json');
const redeemModule = path.join(root, 'src', 'data', 'redeemCodes.js');
try {
  const codes = JSON.parse(await readFile(redeemJson, 'utf8'));
  const publicCodes = Array.isArray(codes) ? codes.filter(x => !x.deleted) : [];
  const moduleText = `// Generated compatibility module. Source of truth: redeem-codes.json.\nexport const REDEEM_CODES = ${JSON.stringify(publicCodes, null, 2)};\nexport const REDEEM_STATUS = { active:{label:'Active',className:'active'}, expired:{label:'Expired',className:'expired'}, reported:{label:'Reported',className:'reported'}, unknown:{label:'Unknown',className:'unknown'} };\n`;
  await writeFile(redeemModule, moduleText, 'utf8');
} catch (error) {
  console.warn('Redeem-code compatibility sync skipped:', error?.message || error);
}

await exec('node', ['scripts/prepare-legacy.mjs'], { cwd: root });
await exec('astro', ['build'], { cwd: root });
console.log('Astro build complete. A Nation\'s Story is served by the new Astro architecture.');
