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

const scripts = [...html.matchAll(/<script(?:[^>]*)>([\\s\\S]*?)<\\/script>/gi)].map((m) => m[1]);
if (!scripts.length) throw new Error('CMS admin HTML contains no browser script');
for (let i = 0; i < scripts.length; i += 1) {
  try {
    new Function(scripts[i]);
  } catch (error) {
    throw new Error(`CMS admin browser script ${i + 1} failed syntax validation: ${error.message}`);
  }
}

console.log(`CMS admin HTML test passed (${scripts.length} browser script(s) parsed).`);
