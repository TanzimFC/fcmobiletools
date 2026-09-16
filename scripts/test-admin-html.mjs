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
const script = html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
if (!script) throw new Error('CMS admin browser script could not be extracted');
try {
  new Function(script);
} catch (error) {
  throw new Error(`CMS admin browser script has invalid JavaScript: ${error.message}`);
}

console.log(`CMS admin HTML test passed (${scriptCount} script tag(s)).`);
