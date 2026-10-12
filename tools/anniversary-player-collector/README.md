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

Records are saved to `data/anniversary-3rd-2026.json`. The script checkpoints after each successful player page, so it can preserve work if interrupted. Re-running the pilot refreshes those five records; it doesn't duplicate records by URL.

## Step 3 — Test images for the pilot

```powershell
npm run pilot:assets
```

Downloads only images identified on the detail page as `Player Card Background` or `Action shot`. It writes the local asset paths into each record. This is intentionally narrow until we verify the right portrait/card layers and image matching.

## Step 4 — Collect the entire Anniversary program

Only after the pilot records and image matches have been manually checked:

```powershell
npm run collect
```

This is an explicit action that visits all discovered cards sequentially and downloads the selected image assets. It is not run by the website or by GitHub Actions.

Optional flags:

- `--limit 5`: set a pilot size
- `--all`: opt into all discovered cards
- `--discover`: refresh and save the listing only
- `--refresh-listing`: force a fresh listing crawl before collecting detail pages
- `--download-images`: download selected image assets
- `--delay-ms 1800`: change the delay between page visits; the script enforces a minimum of 1200 ms
- `--help`: show options

## Local outputs

```text
data/
  anniversary-listing.json
  anniversary-3rd-2026.json
  checkpoint.json
  assets/
    <card-id>-action-shot.<ext>
    <card-id>-player-card-background.<ext>
```

No records, images, cookies or session credentials are committed. Review the output before publication. The first pass retains source text for verification; it is not yet the final public catalogue schema.

## Next milestone

Validate five cards against RenderZ, including OVR, primary position, unique card ID, action-shot image and card background. After that, build a separate Backblaze B2 uploader and the small Worker read endpoint. Do not publish the full catalogue until the pilot passes.
