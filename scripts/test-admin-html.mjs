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

const bridge = '<script>try{window.S=S}catch(e){}</script>';
const enhancer = '<script>(function(){';
if (html.indexOf(bridge) === -1 || html.indexOf(bridge) > html.indexOf(enhancer)) {
  throw new Error('CMS admin runtime bridge is not placed before the enhancement script');
}

// Avoid a regex here: this test itself runs before the application build and
// must remain parser-safe on Cloudflare's Node/Bun build environment.
const scripts = [];
const scriptOpen = '<script';
const scriptClose = '</script>';
let cursor = 0;
while (true) {
  const open = html.indexOf(scriptOpen, cursor);
  if (open === -1) break;
  const bodyStart = html.indexOf('>', open);
  if (bodyStart === -1) throw new Error('CMS admin HTML contains an unterminated script tag');
  const close = html.indexOf(scriptClose, bodyStart + 1);
  if (close === -1) throw new Error('CMS admin HTML contains an unterminated browser script');
  scripts.push(html.slice(bodyStart + 1, close));
  cursor = close + scriptClose.length;
}
if (!scripts.length) throw new Error('CMS admin HTML contains no browser script');
for (let i = 0; i < scripts.length; i += 1) {
  try {
    new Function(scripts[i]);
  } catch (error) {
    throw new Error(`CMS admin browser script ${i + 1} failed syntax validation: ${error.message}`);
  }
}

console.log(`CMS admin HTML test passed (${scripts.length} browser script(s) parsed).`);
