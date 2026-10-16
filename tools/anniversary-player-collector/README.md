# FCMobiletools — Multi-program Player Collector

This is an **independent local tool**. It does not run in Cloudflare Workers and has no GitHub Actions workflow. Collection output is intentionally ignored by Git and stays on the computer running the script.

For importing the combined multi-event export, follow [MULTI_EVENT_IMPORT.md](./MULTI_EVENT_IMPORT.md) and use `npm run import:events:dry` before `npm run import:events -- --commit`. The older `import:catalog` command is Anniversary-only and must not be pointed at `player-cards-all-events.json`.

## Multi-program event coverage

The original Anniversary collector now supports a curated sweep covering **TOTS 26 through 3rd Anniversary**, plus the newly released Unbreakable, Classics, and CONMEBOL Libertadores programs. Program URLs and collection order live in `programs.json`.

Icon and Hero cards are identified from their player detail labels and exported as a separate **subset** of those event records. The pipeline does not crawl a separate full-site Icons or Heroes page. Each program gets its own listing cache, records file, checkpoint, and report; the shared asset library remains deduplicated.

### Multi-program commands

```powershell
# Verify program listing pagination only; no player details are collected
npm run programs:discover

# Small pilot for one event
npm run programs:pilot -- --program tots-26

# Full collection across the catalog, in order
npm run programs:collect

# Full collection for one event
npm run programs:collect -- --program anniversary-3rd-2026

# Full collection from TOTS 26 through 3rd Anniversary
npm run programs:collect -- --from tots-26 --to anniversary-3rd-2026

# Rebuild combined outputs and inspect per-event coverage
npm run programs:export
npm run programs:coverage

# Force a refresh of previously verified detail records (use sparingly)
npm run programs:collect -- --refresh-existing
```

The pilot and full-collection npm commands refresh source listings before collecting details, so a cached older Anniversary listing cannot silently limit a new full run. The multi-program runner resumes detail records by default: it skips an existing card only when its stats are complete, its Icon/Hero category is recognized, and (when image downloads are enabled) every referenced image has a saved local file. Partially parsed records are retried. Use `--refresh-existing` to re-visit verified records, or `--fresh` for a deliberate single-program reset before a full run.

The runner processes one program at a time and retains checkpoints. A full sweep requires the explicit `--all` option (included in the `programs:collect` npm script). It stops on an HTTP 403/429 or challenge page and does not try to bypass restrictions. Use it only within RenderZ's permission and request limits.

Combined outputs are written locally under `data/` and remain git-ignored:
- `player-cards-all-events.json` — deduplicated cards with all source-program associations.
- `icons-and-heroes.json` — cards classified as Icons or Heroes within the selected event window.
- `coverage-report.json` — listing completeness, missing detail URLs, stat coverage, and Icon/Hero counts.

These commands only collect and export local JSON. They do not import or publish the combined dataset to Supabase or to the website.


## Scope

- Source program: [RenderZ 3rd Anniversary](https://renderz.app/programs/PROGRAM_ANN27-3rd-anniversary)
- Collect the event's listing links first, then visit player detail pages sequentially.
- Default pilot: 5 player cards.
- Full event collection is opt-in using `--all`.
- Player data is saved locally; image downloads are opt-in.
- No stealth plugins, proxy rotation, CAPTCHA bypass or request parallelism are included.

Use this only within the written permission and request limits granted by RenderZ. If the site returns HTTP 403/429 or a challenge page, the script stops rather than trying to bypass the block.

## Requirements

- Node.js 20 or newer
- npm
- Internet access from the local computer
- RenderZ permission covering the pages and data you intend to collect

## Setup (Windows PowerShell)

```powershell
cd tools/anniversary-player-collector
npm install
npx playwright install chromium
```

If this is a fresh checkout, first ensure you're on the `feature/anniversary-player-pipeline` branch.

## Step 1 — Discover the listing

```powershell
npm run discover
```

This visits the listing pages at a conservative pace and saves `data/anniversary-listing.json`. It does not crawl each player's detail page or download images. The later pilot commands reuse this saved listing, so you don't repeatedly revisit all seven listing pages. Player pages share one browser context, so browser cache can reuse common resources across cards.

## Step 2 — Collect a five-card pilot

```powershell
npm run pilot
```

The collector parses six outfield stat groups (28 substats) and has a separate goalkeeper schema for goalkeeper-specific attributes. Each record has a coverage status so missing stats are visible instead of being filled with invented values. It waits briefly for stats to hydrate. RenderZ may also expose unresolved localization keys for club, league, nation, skill-tree labels, or traits; those remain null or are stored as source keys until a reliable translation mapping is available.

Records are saved to `data/anniversary-3rd-2026.json`. The script checkpoints after each successful player page, so it can preserve work if interrupted. Re-running the pilot refreshes the selected records; it doesn't duplicate records by URL.

## Step 3 — Test rank and training progression

```powershell
npm run pilot:progression
```

This opt-in test attempts to capture the stats available for each rank and each training level exposed by that rank's RenderZ selector, including the displayed “skill points to spend” count. It discovers the visible training options instead of assuming all ranks expose the same levels. It only counts snapshots as valid when rank selection and the selected training level can be verified and all stat groups parse successfully. This records the current/default skill-tree state at each rank; it does **not** enumerate every possible skill-point allocation. Inspect `progression.status`, `trainingLevelsByRank`, `controls`, and `rankTrainingSnapshots` before treating the progression as complete.

To test a particular player page that visibly shows stats (instead of the first five cards in the listing):

```powershell
node collector.mjs --player-url "https://renderz.app/player/PASTE-PLAYER-SLUG-HERE" --capture-progression
```

Copy the real player URL from RenderZ. Do not leave the example slug in place.

## Step 4 — Test images for the pilot

```powershell
npm run pilot:assets
```

Downloads images identified on the detail page as card backgrounds, player artwork, club logos, league logos, and nation flags. The collector first captures the actual bytes requested by the browser, then falls back to the same browser context for binary downloads. This handles image hosts that return images as `application/octet-stream`, and avoids relying on expired or restricted direct Node fetches. Content signatures are checked before files are saved.

Assets use a stable key based on asset type plus canonical URL (the short-lived signature query is excluded). A persistent `data/asset-library.json` manifest records each distinct downloaded asset once. Player records reference those keys and paths; shared backgrounds and crests do not need separate physical copies for every player. Player artwork remains per-card because its source image differs.

## Step 5 — Collect the entire Anniversary program

After the pilot's stats and image matches have been manually checked, collect all discovered cards sequentially:

```powershell
npm run collect
```

That command preserves existing records and is useful for resuming or refreshing a dataset. For the first clean full collection, use:

```powershell
npm run collect:fresh
```

The fresh command deletes prior player records, checkpoint, and stale reports before starting. It preserves the verified listing cache and shared asset library/files to avoid downloading known shared backgrounds and logos again. It saves one base-stat record per card and downloads available images. Rank/training snapshots are deliberately out of scope for this stage; the base record still stores the `Skill Points to Spend` value when the page exposes it. Training XP thresholds and trained attribute changes can be integrated as a separate, verified layer later. This tool is not run by the website or by GitHub Actions.

Optional flags:

- `--limit 5`: set a pilot size
- `--all`: opt into all discovered cards
- `--discover`: refresh and save the listing only
- `--refresh-listing`: force a fresh listing crawl before collecting detail pages
- `--download-images`: download selected image assets
- `--capture-progression`: experimental rank/training sampling (not part of base collection)
- `--fresh`: with `--all`, clear existing player records/checkpoint/reports before a clean full run, preserving listing and shared assets
- `--player-url <url>`: test a single known RenderZ player page instead of selecting cards from the listing
- `--keep-source-text`: retain filtered source text in each record for debugging (off by default)
- `--delay-ms 900`: change the delay between player pages; the script enforces a minimum of 600 ms
- `--help`: show options

## Local outputs

```text
data/
  anniversary-listing.json
  anniversary-3rd-2026.json
  asset-library.json
  checkpoint.json
  assets/
    player-card-background-<asset-hash>.<ext>
    player-image-<asset-hash>.<ext>
    club-logo-<asset-hash>.<ext>
    league-logo-<asset-hash>.<ext>
    nation-flag-<asset-hash>.<ext>
```

No records, images, cookies or session credentials are committed. Raw page text is omitted from records by default so the output stays focused on usable fields; use `--keep-source-text` only when debugging a specific extraction problem. Review the output before publication.

## Step 6 — Legacy Anniversary-only import into Backblaze B2 and Supabase

> **Important:** the `import:catalog` flow below targets the old single-program Anniversary preview and requires the Anniversary-specific image templates. Do not use it to import the combined multi-event export. For the new event catalog, use `MULTI_EVENT_IMPORT.md` and the `import:events` commands, which import complete-stat card records as unpublished and do not upload or rewrite image assets.


The card renderer uses a split storage model:

- **Backblaze B2** stores image files. Shared logos and the two Anniversary templates are uploaded once, with stable object keys under `fc-mobile/anniversary-3rd-2026/`.
- **Supabase** stores searchable player data, structured stats, card tier/template keys, and the public URLs/asset keys. Browser clients can read published records only; importing requires the server-only service-role key in a local `.env`.

The schema migration is in `supabase/migrations/20261013_fc_player_catalog.sql`. It creates `fc_player_assets` and `fc_player_cards`, enables row-level security, grants public read access only, and reserves writes for the server-side import credential.

Copy `.env.example` to `.env` and fill the actual B2 values from your account. Do not commit `.env` or put the service-role/application keys in browser code.

```powershell
Copy-Item .env.example .env
# Fill .env with real values, then validate paths/assets first:
npm run import:catalog:dry
# Upload selected unique images to B2 and upsert asset/player metadata:
npm run import:catalog
```

The importer uses the card-specific Anniversary background when the source metadata identifies it. If it is missing, it uses the observed OVR rule (default 117+ = LIVE, below 117 = BASE); change `ANNIVERSARY_LIVE_MIN_OVR` in `.env` if later verification establishes a different cutoff. Both shared template files must exist locally before an import can proceed. Records are published only when stats are complete and the player image, club, league and nation assets are present; incomplete cards remain unpublished and are reported.

## Step 7 — Preview and assemble cards

After the import completes, open `/anniversary-player-preview/` on the branch build. The page queries published rows from Supabase and composes each card in the browser using the B2 URLs. It includes search, position filtering, separate LIVE/BASE filter options, stats, metadata, and missing-image diagnostics. The preview is intentionally `noindex` and is not linked in public navigation.

Review a higher-tier card and a lower-tier card, plus at least one goalkeeper, before adding a public Player Database route. Training formula/rank progression stays separate for a later phase.
