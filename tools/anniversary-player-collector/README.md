# FCMobiletools — Anniversary Player Collector

This is an **independent local tool**. It does not run in Cloudflare Workers and has no GitHub Actions workflow. Collection output is intentionally ignored by Git and stays on the computer running the script.

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

This visits the listing pages at a conservative pace and saves `data/anniversary-listing.json`. It does not crawl each player's detail page or download images. The later pilot commands reuse this saved listing, so you don't repeatedly revisit all seven listing pages.

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

Downloads images identified on the detail page as `Player Card Background`, `Action shot`, `Club`, `League`, or `Nation`. They are stored as reusable, hashed local assets, so identical images can be shared across players instead of saving duplicate copies. The exact available asset types depend on what RenderZ exposes on that page.

## Step 5 — Collect the entire Anniversary program

Only after the pilot's stats, progression behavior, and image matches have been manually checked:

```powershell
npm run collect
```

This is an explicit action that visits all discovered cards sequentially, saves one base stat record per card, and downloads the available image assets. It does not capture every training level/rank variant for every player. Training XP thresholds belong in one shared table; trained attribute changes must be verified from source behavior before a universal formula is used. Rank skill trees and actual skill allocations are kept as a separate layer. This is not run by the website or by GitHub Actions.

Optional flags:

- `--limit 5`: set a pilot size
- `--all`: opt into all discovered cards
- `--discover`: refresh and save the listing only
- `--refresh-listing`: force a fresh listing crawl before collecting detail pages
- `--download-images`: download selected image assets
- `--capture-progression`: opt into rank/training state sampling
- `--player-url <url>`: test a single known RenderZ player page instead of selecting cards from the listing
- `--keep-source-text`: retain the raw source text in each record for debugging (off by default)
- `--delay-ms 1800`: change the delay between page visits; the script enforces a minimum of 1200 ms
- `--help`: show options

## Local outputs

```text
data/
  anniversary-listing.json
  anniversary-3rd-2026.json
  checkpoint.json
  assets/
    player-card-background-<asset-hash>.<ext>
    player-image-<asset-hash>.<ext>
    club-logo-<asset-hash>.<ext>
    league-logo-<asset-hash>.<ext>
    nation-flag-<asset-hash>.<ext>
```

No records, images, cookies or session credentials are committed. Raw page text is omitted from records by default so the output stays focused on usable fields; use `--keep-source-text` only when debugging a specific extraction problem. Review the output before publication.

## Next milestone

Validate five cards against RenderZ, including OVR, primary position, unique card ID, action-shot image and card background. After that, build a separate Backblaze B2 uploader and the small Worker read endpoint. Do not publish the full catalogue until the pilot passes.
