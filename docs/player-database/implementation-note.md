# Player database architecture note

## Repository audit (2026-09-27)

- The site is Astro 5, built as a static site, with its Cloudflare Worker in `src/worker.mjs` and static files served from `dist`.
- The Worker owns `/api/*` and `/admin/*`; it currently uses Cloudflare D1 for editorial/content data and GitHub-backed file updates for several admin-managed catalogs.
- The existing feature shell is `src/layouts/BaseLayout.astro`, `src/components/Navbar.astro`, and `src/components/Footer.astro`. Existing calculators include team OVR, rank-up, training, shard progress, and investment calculations under `src/lib/` and `src/pages/`.
- `/football-centre/players/` is already a Football Centre watchlist and should stay in place. The public database route should be `/players/`; detail routes should be `/player/<slug>/`.
- `src/lib/fcMobileShards.js` calculates shard progress but does not contain player shard prices. `src/lib/fcMobileInvestment.js` calculates market profit after tax but has no live price feed.
- The connected Supabase project is active but currently has no tables. Existing production routes do not read Supabase. Keep D1 content flows intact and add the player catalog as a separate Supabase-backed system.
- There is no checked-out Git worktree in this task directory. A feature branch has been created on the connected GitHub repository so changes can be reviewed before merge/deploy.

## Data model decisions

- `players` contains stable player/card identity and searchable fields; detailed base attributes stay in `player_stats` JSONB to accommodate season-specific fields without schema churn.
- `player_ranks` stores rank OVR and stat modifiers without cloning player metadata.
- `player_prices` stores timestamped sell-price observations by rank and region. Source and usage-policy fields make freshness and reuse status explicit.
- `player_shard_costs` stores event/phase shard costs independently from player metadata, with source provenance and observation time.
- `player_assets` maps stable asset keys to repo paths or hosted URLs, and records source, license, attribution, and checksum.
- `player_abilities` and `player_ability_links` provide flexible PlayStyle, trait, and skill data.

## Source and asset status

- Original FCMOBILETOOLS UI SVGs for coin, shard, and sell-price concepts are authored in this change and can be stored in the repository.
- Existing game card art and third-party player images, club marks, flags, and icons have no reuse license recorded in the repository. They are not mirrored by this change. `player_assets` requires the source and license to be recorded before ingestion.
- The market has no verified official public price API. Price snapshots should not be presented as real-time or guaranteed sale prices; they need an attributed, permission-reviewed input source and an `observed_at` timestamp.
- Shard costs are event-specific and can change. Import them as sourced snapshots with the event and phase attached; never infer missing costs.

## Initial implementation slice

This change adds the schema, provenance-aware JSON/CSV normalization and validation, and original local UI icons. It does not yet wire public routes, protected admin endpoints, a populated dataset, or a live external price provider. Those should be built against this audit and reviewed migration without changing the existing calculators or D1-backed content system.
