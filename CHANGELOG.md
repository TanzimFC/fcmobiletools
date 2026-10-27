# FCMOBILETOOLS Changelog

A dated history of the major changes made to FCMOBILETOOLS, reconstructed from the repository's Git history.

**Coverage:** 16 August 2026 to 27 October 2026. Dates follow the repository commit dates. The repository does not use formal versioned releases, so these are development milestones rather than version-numbered releases. Small copy edits, repeated uploads, content-only updates, and every individual bug fix are not listed separately.

## 16 to 26 August 2026: First prototype

- Started the repository around the Football Centre tool, its calculator/progression interface, and supporting FC Mobile card and event assets.
- Built out the first homepage and creator page.
- Developed the early Trivia experience, including country-based quiz content and assets for Brazil, France, and Mexico.
- Iterated on the Football Centre and early beta pages as the first set of public tools took shape.

## 11 September 2026: Shared Astro website and core tools

- Began the Astro site architecture and established a shared page shell, navigation, footer, theme, and static build.
- Integrated the existing Football Centre, Creator, and Trivia experiences into direct site routes instead of relying on embedded pages. Added route handling, a custom 404 page, and Cloudflare static-asset deployment support.
- Moved the blog toward structured Markdown content, with a searchable index, article templates, metadata, and a repeatable authoring workflow.
- Added the first full set of legal and policy pages, including privacy, terms, disclaimer, contact, cookie, and intellectual-property pages.
- Built standalone Team OVR, Training, and Rank Up calculators, with dedicated calculation logic, configuration data, UI, and automated tests.
- Introduced a structured Redeem Codes archive with search, filtering, pagination, navigation links, and last-updated information.
- Reworked the Football Centre dashboard, analysis, TOTW, match, history, and settings sections, while improving the shared visual system.

## 12 to 17 September 2026: Trivia rebuild, calculator work, and brand system

- Rebuilt the country quiz experience into **A Nation's Story**, with nation pages, day-based challenge routes, answer options, and a new searchable hub.
- Reworked Training and Rank Up calculator engines, data, result displays, affordability calculations, fodder comparisons, and regression tests for FC Mobile 26.
- Improved blog search, navigation, homepage tool discovery, and article content structure.
- Consolidated the public brand as **FCMOBILETOOLS** across navigation, footer, page metadata, redeem pages, and social previews.
- Redesigned the Redeem Codes experience and its live status presentation, including a more structured archive and improved search behavior.
- Began a major admin and CMS rebuild after earlier admin implementations proved unstable. The work separated public routes from admin routes and added a more direct dashboard and article-editing surface.

## 16 to 23 September 2026: Publishing tools and live event hub

- Reworked the admin article editor and its publishing flow, including draft handling, article media insertion, a Cloudinary-backed media library, authentication, and Worker-backed APIs.
- Added creator-management capabilities, including creator profiles, account controls, article ownership, trash controls, and D1-backed content management.
- Introduced Argon2id password hashing for creator authentication.
- Added the Shards Counter tool and admin controls for its content.
- Combined separate event and reset pages into a unified **Events & Reset** hub.
- Added schedule-driven event data and a public timing feed, then improved local-time display, Bangladesh time support, and automatic reset timing.
- Expanded Football Centre content controls and continued stabilizing the public redeem-code and editorial workflows.

## 26 to 30 September 2026: Tool expansion, admin settings, performance, and deployment

- Added the Gauntlet Mode Planner and connected it to the site's navigation and homepage.
- Expanded the Team OVR calculator with formation and substitute handling, clearer bottleneck analysis, and mobile-layout fixes.
- Added a centralized admin workspace and API for site advertising settings.
- Improved shared loading states, Redeem Codes search, Events & Reset status displays, and mobile navigation.
- Optimized critical rendering, font loading, homepage image discovery, analytics loading, and deferred sections.
- Disabled third-party advertising for the AdSense review period.
- Stabilized local/static article rendering, the homepage and blog data flow, Worker routing, production redirects, and Cloudflare custom-domain configuration.

## 30 September to 4 October 2026: Content reliability and player-card tools

- Improved the Football Centre content editor, including video archive validation, TOTW fields, unsaved edit preservation, and analysis metadata.
- Fixed Markdown article tables, formatting, responsive layouts, and article media behavior.
- Improved the player-card interface with more consistent card geometry and support for rank, training, skill, and PlayStyle details.
- Added a faster production build path so ordinary site builds would not need to repeat heavier player-data preparation.
- Continued improving calculator reliability and regression checks.

## 3 to 7 October 2026: Tournament management and member accounts

- Built out tournament publishing and results management, including editable batches, draft-versus-publish separation, public snapshots, and safer result corrections.
- Fixed progression across multi-stage and two-leg knockout ties, including later-round advancement and scheduled-match states.
- Integrated Supabase Auth into public account flows.
- Added public profile routes, protected account administration, profile privacy controls, and account API routing through the Worker.
- Added the foundations for quests, achievements, rewards, leaderboard data, activity tracking, and member history.
- Improved UTC check-in behavior, including the 24-hour cooldown and the cross-reset safety window.
- Added account-gated Captain Tracker voting and improved how quest completion and activity updates appear in profiles.

## 8 to 15 October 2026: Community features and moderation

- Added authenticated screenshot and image-upload flows for community submissions, with temporary upload handling and server-side validation.
- Added screenshot attachments to community reports and admin review tools.
- Improved account and quest review workflows, including manual review for selected reward tasks.
- Continued work on Captain Tracker voting, live vote counts, return-state behavior, and public results.
- Hardened tournament progression and submission handling, including the ability to correct and resubmit rejected listings.
- Refined Playstyle Finder behavior and interface details.

## 20 to 23 October 2026: Giveaway operations, staff access, and monetization controls

- Built the Ballon d'Or giveaway entry and proof-review flow, with a one-entry-per-person rule, requirement-specific correction requests, clearer fairness messaging, and admin review states.
- Stabilized giveaway result publication and the winner-reveal animation, including separate replay behavior and consistent public results.
- Added controls for advertising and tested restricted placements before disabling third-party ads and AdSense loading site-wide.
- Added restricted Worker staff authentication and API permissions, with a separate staff dashboard and limited access to protected admin functions.

## 24 to 26 October 2026: Push notifications and proprietary licensing

- Removed Monetag push advertising and enabled OneSignal Web Push.
- Added the admin **Notification Studio**, a protected server-side OneSignal endpoint, reusable templates, subscription diagnostics, and push setup documentation.
- Added redeem-code alert automation and safeguards to avoid duplicate notifications or block code publishing when an alert fails.
- Moved Promo Studio access into the admin sidebar and removed inactive controls from the notification interface.
- Added Safari web-push configuration and improved permission, initialization, and subscription failure handling.
- Added a strict proprietary license for FCMOBILETOOLS.

## 27 October 2026: Indexing and sitemap corrections

- Adjusted indexability for public community profiles and the public alert-signup page.
- Kept the noindex Match Center out of the sitemap so its sitemap status matches its indexing directive.

---

## Notes on this history

This document summarizes the main product and infrastructure milestones visible in Git history. It is not a claim that every feature listed here remained enabled or unchanged after its first commit. Advertising experiments, admin implementations, and several interfaces were revised or removed as the project developed.
