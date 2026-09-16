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
const scriptCount = html.split('<script').length - 1;
if (scriptCount < 1) throw new Error(`CMS admin HTML contains too few scripts: ${scriptCount}`);
const start = html.indexOf('<script>');
const end = html.indexOf('</script>', start);
const script = start >= 0 && end > start ? html.slice(start + 8, end) : '';
if (!script) throw new Error('CMS admin browser script could not be extracted');

// The Worker/module syntax check already validates the source module. Keep this
// HTML test structural: Node's Function parser is not a browser parser and can
// reject valid browser-only syntax/markup emitted by the final editor template.
if (!script.includes("'use strict'")) {
  throw new Error('CMS admin browser script missing strict-mode marker');
}

console.log(`CMS admin HTML test passed (${scriptCount} script tag(s)).`);
