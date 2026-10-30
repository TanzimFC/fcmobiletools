// Regression checks for the production Ads Worker integration.
// Handler unit tests alone are not enough: the app Worker must actually dispatch to them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const worker = read('../src/worker.mjs');
const adsWorker = read('../src/adsWorker.mjs');
const layout = read('../src/layouts/BaseLayout.astro');
const adSlotsComponent = read('../src/components/AdSlots.astro');
const studio = read('../admin/ads-studio.html');
const pkg = JSON.parse(read('../package.json'));

assert.match(
  worker,
  /import \{\s*adsPublicRoute,\s*adsStudioRoute,\s*runAdsMaintenance\s*\} from ['"]\.\/adsWorker\.mjs['"]/,
  'the main Worker must import both Ads route handlers and scheduled maintenance'
);

const publicRoute = worker.indexOf("url.pathname === '/api/ads' || url.pathname.startsWith('/api/ads/')");
const studioRoute = worker.indexOf("url.pathname === '/api/ads-studio' || url.pathname.startsWith('/api/ads-studio/')");
const fallbackRoute = worker.indexOf('const astroResponse = await handle(manifest, app, request, env, ctx)');
assert.ok(publicRoute > 0 && publicRoute < fallbackRoute, 'public ads API must be dispatched before Astro fallback');
assert.ok(studioRoute > publicRoute && studioRoute < fallbackRoute, 'Ads Studio API must be dispatched before Astro fallback');
assert.match(worker.slice(publicRoute, publicRoute + 240), /return adsPublicRoute\(\{request,env,url,ctx,json,d1,supabaseRest\}\)/);
assert.match(worker.slice(studioRoute, studioRoute + 260), /return adsStudioRoute\(\{request,env,url,ctx,json,d1,authenticated,supabaseRest\}\)/);

const dashboardStart = worker.indexOf('async function adminDashboard(');
const dashboardEnd = worker.indexOf('\n}', dashboardStart);
assert.ok(dashboardStart >= 0 && dashboardEnd > dashboardStart, 'admin dashboard navigation patch must exist');
const dashboard = worker.slice(dashboardStart, dashboardEnd);
assert.match(dashboard, /const isOwner = await authenticated\(request,env\)/, 'Ads Studio visibility must be based on owner authentication');
assert.match(dashboard, /const adsStudioLink = isOwner \? '[^']*href="\/admin\/ads-studio\.html"/, 'Ads Studio must be linked only for the owner');
assert.match(dashboard, /\+ adsStudioLink \+ notificationLink/, 'Ads Studio must be included in the Growth navigation');

assert.match(
  worker,
  /if\(await authenticated\(request,env\)\) return env\.ASSETS\.fetch\(request\);/,
  'private admin assets, including Ads Studio, must remain behind owner authentication'
);
assert.ok(adsWorker.includes("if (!(await authenticated(request, env))) return json({ error: 'Owner sign in required.' }, 401);"), 'Ads Studio API must enforce owner authentication');
assert.match(studio, /fetch\('\/api\/ads-studio/);
assert.match(layout, /<AdSlots pageType=\{adPageType\} locale=\{locale\} \/>/);
assert.match(adSlotsComponent, /import\('\.\.\/scripts\/ads-engine\.js'\)/);
assert.match(pkg.scripts['test:ads'] || '', /test-ads\.mjs/);
assert.match(pkg.scripts.test || '', /npm run test:ads/);

console.log('  ok  production Ads routes, owner-only navigation, frontend mount and test-suite wiring');
