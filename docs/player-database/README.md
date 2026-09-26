# Player database status and import

The player catalog is served by the existing Astro site and its Cloudflare Worker. Supabase/Postgres stores the full records; the browser only receives an indexed, paginated slice from `GET /api/players` (48 by default, 100 maximum). Individual SEO pages are generated from the small `src/data/playerPageCatalog.json` route index and load the current record from `GET /api/players/:slug`.

## Initial catalog

The first populated slice contains 580 Star Signings players with player/asset ID, name, OVR, position, alternate positions, program, Star Shard requirement, and a player-card image URL. The source catalog advertised 580 rows; duplicate IDs and required-field validation passed. The observation date recorded in Supabase is September 16, 2026. The public source is [FC Mobile Squad's Star Shards catalog](https://fcmobilesquad.com/star-signings-players).

Source-reported values are kept as dated observations with their source URL. Missing information stays null; no player stats, rank modifiers, PlayStyles, traits, club details, or coin prices were fabricated. The first slice is useful for browsing the Star Signings roster, not a complete all-card database.

## Routes and API

- `/players/` — paginated search, position/event/OVR filters, and OVR/name sorting.
- `/player/<slug>/` — statically rendered title/description/canonical metadata for each indexed player, with record details fetched from the API.
- `GET /api/players` — search, filters, sort, limit/offset pagination, image mapping, and latest shard/price observations.
- `GET /api/players/filters` — supported positions.
- `GET /api/players/:slug` — metadata, stats, ranks, abilities, assets, and latest observations.

The Worker uses the project's Supabase publishable key, never a service-role key. Postgres RLS limits public reads to active player rows and associated public records; admin writes require the `app_metadata.role=admin` claim.

## Import tools

```sh
node scripts/player-data/fetch-star-shards.mjs /tmp/star-shards.json
node scripts/player-data/normalize-player-import.mjs /tmp/star-shards.json /tmp/star-shards-preview.json
```

Fetch is sequential and throttled. The normalizer validates IDs, slugs, OVR, positions, URLs, source attribution, permissions, stats objects, prices, and shard costs. Review normalized output before any import. Initial rows were loaded in batches into Supabase after validation; the public admin CRUD/import interface is not included yet.

## Price freshness

The schema supports current sell-price and history observations separately from shard requirements. No verified FC Mobile coin price feed is connected yet, so the UI says when current sell-price data is unavailable rather than substituting shard costs or generating estimates. Add price observations only with an approved data feed and its source/update timestamp.

## Deployment

The normal Cloudflare deployment workflow builds the Astro static site and Worker on `main`. The player-database pull request includes a build check for the 580 generated SEO pages. Production routes become available after that check passes and the pull request is merged.