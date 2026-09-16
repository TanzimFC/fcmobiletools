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

// The stable CMS runtime embeds the enhancement script inside adminHtml.
// The old editor-era bridge ordering assertion is intentionally removed:
// article-editor layers are no longer part of the admin runtime.
const scriptCount = html.split('<script').length - 1;
if (scriptCount < 2) throw new Error(`CMS admin HTML contains too few scripts: ${scriptCount}`);

console.log(`CMS admin HTML test passed (${scriptCount} script tag(s)).`);
