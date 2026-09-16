import { adminHtml } from '../src/cms/admin-runtime.mjs';

const html = adminHtml('posts');
const required = [
  '<div id="app"></div>',
  'const S=',
  '/api/auth/me',
  '/api/posts',
  'Workspace pulse',
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`CMS admin HTML missing marker: ${marker}`);
}

// The final article editor is intentionally a single self-contained browser script.
// Keep this gate structural and do not reintroduce the removed editor-era bridge checks.
const scriptCount = html.split('<script').length - 1;
if (scriptCount < 1) throw new Error(`CMS admin HTML contains too few scripts: ${scriptCount}`);

console.log(`CMS admin HTML test passed (${scriptCount} script tag(s)).`);
