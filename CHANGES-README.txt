FCMOBILETOOLS REVAMP: CHANGED FILES
====================================

This zip contains only the files that were changed or added (paths match the repo).

HOW TO APPLY
  Option A: copy the folders in this zip over your repo (src/, scripts/, public/, CHANGELOG.md).
  Option B: from the repo root run:  git apply revamp.patch

NEW FILES (5)
  src/data/siteTools.js
  src/lib/teamOvrExport.js
  src/pages/start.astro
  src/scripts/fx.js
  src/scripts/recent-tools.js

MODIFIED FILES (18)
  CHANGELOG.md
  public/assets/ads-preview.css
  scripts/test-team-ovr.mjs
  src/components/Breadcrumb.astro
  src/components/ConsentBanner.astro
  src/components/Footer.astro
  src/components/Navbar.astro
  src/config/adSlots.js
  src/i18n/messages/pages/consent.en.js
  src/layouts/BaseLayout.astro
  src/lib/teamOvr.js
  src/pages/index.astro
  src/pages/team-ovr.astro
  src/pages/tools/index.astro
  src/scripts/ads-engine.js
  src/scripts/team-ovr.js
  src/styles/ads.css
  src/styles/system.css

AFTER APPLYING
  npm ci
  npm test          (all suites pass)
  npm run build

NOTES
  - The user-facing changelog entry (31 October 2026) is already in CHANGELOG.md.
  - public/assets/ads-preview.css must stay identical to src/styles/ads.css (a test enforces it).
  - Formation list: ids 433, 442, 4231, 352, 532 are unchanged so old share links keep working.
    Compare the 28 formations against the in-game list and edit src/lib/teamOvr.js if one differs.
