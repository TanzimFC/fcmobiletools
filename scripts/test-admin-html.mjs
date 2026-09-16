import { adminHtml } from '../src/cms/admin-runtime.mjs';

for (const section of ['posts','articles','redeem']) {
  const html = adminHtml(section);
  const required = [
    '<div id="app"></div>',
    'var S={',
    '/api/auth/me',
    '/api/posts',
    '/api/redeem-codes',
    'Approval Inbox',
    'Redeem Codes',
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`CMS admin HTML missing marker for ${section}: ${marker}`);
  }
  const scriptCount = html.split('<script').length - 1;
  if (scriptCount < 1) throw new Error(`CMS admin HTML contains too few scripts for ${section}: ${scriptCount}`);
  const start = html.indexOf('<script>');
  const end = html.indexOf('</script>', start);
  const script = start >= 0 && end > start ? html.slice(start + 8, end) : '';
  if (!script) throw new Error(`CMS admin browser script could not be extracted for ${section}`);
  if (!script.includes("'use strict'")) throw new Error(`CMS admin browser script missing strict-mode marker for ${section}`);
  if (script.includes('Viewing as')) throw new Error(`CMS admin still contains the removed role-viewing switch for ${section}`);
}

console.log('CMS admin HTML test passed for /admin, /admin/articles and /admin/redeem-codes.');
