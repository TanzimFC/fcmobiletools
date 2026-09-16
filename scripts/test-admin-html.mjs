import { adminHtml } from '../src/cms/admin-runtime.mjs';

for (const section of ['posts', 'articles', 'redeem']) {
  const html = adminHtml(section);
  const required = section === 'redeem'
    ? ['<div id="app"></div>', '/api/auth/me', '/api/redeem-codes', 'Redeem codes']
    : ['<div id="app"></div>', '/api/auth/me', '/api/posts', 'fcmobiletools CMS'];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`CMS admin HTML missing marker for ${section}: ${marker}`);
  }
  const scriptCount = html.split('<script').length - 1;
  if (scriptCount < 1) throw new Error(`CMS admin HTML contains too few scripts for ${section}: ${scriptCount}`);
  const start = html.indexOf('<script>');
  const end = html.indexOf('</script>', start);
  const script = start >= 0 && end > start ? html.slice(start + 8, end) : '';
  if (!script) throw new Error(`CMS admin browser script could not be extracted for ${section}`);
  if (!script.includes('const state=')) throw new Error(`CMS admin browser state missing for ${section}`);
}

console.log('CMS admin HTML test passed for /admin, /admin/articles, and /admin/redeem-codes.');
