import { adminHtml } from '../src/cms/admin-runtime.mjs';

const html = adminHtml('posts');
const required = [
  '<div id="app"></div>',
  'const S=',
  '/api/auth/me',
  '/api/posts',
  'Articles',
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`CMS admin HTML missing marker: ${marker}`);
}

// /admin now intentionally renders the stable CMS hub. The standalone article
// editor is exposed at /admin/articles, so do not require editor-only markup here.
const scriptCount = html.split('<script').length - 1;
if (scriptCount < 1) throw new Error(`CMS admin HTML contains too few scripts: ${scriptCount}`);
const start = html.indexOf('<script>');
const end = html.indexOf('</script>', start);
const script = start >= 0 && end > start ? html.slice(start + 8, end) : '';
if (!script) throw new Error('CMS admin browser script could not be extracted');

console.log(`CMS admin HTML test passed (${scriptCount} script tag(s)).`);
