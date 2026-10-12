# Player-card database import

This folder contains the first backend-ingestion stage for the FC Mobile player database. It is deliberately separate from the live frontend and should be run only after the SQL migration has been applied.

## Storage split

- Supabase stores player identities, each distinct card (including OVR/program/art differences), stats, traits, and asset metadata/links.
- Backblaze B2 stores the binary image files. The uploader uses content hashes as object keys, so identical bytes are uploaded only once even when multiple cards reuse the same image.
- Public pages can query the read-only Supabase tables and load image URLs from B2.

The individual card identifier is sourceCardId; it is never replaced by the player identity key. Two cards for the same footballer, even at different OVRs, remain separate rows in player_cards.

## Files to prepare

Put the collected JSON at data/player-cards.json and extract the complete image collection into data/assets/. Keep the image names from the collector, such as player-image-<assetKey>.png.

The supplied card-assembly-samples.zip is only a sample pack. It contains 13 of the 415 asset keys referenced by the currently supplied JSON, so it is not enough for a strict first import. One player-image record is already marked as a source HTTP 404; that image is retained as unavailable instead of being assigned a made-up URL.

## 1. Apply the schema

Run supabase/migrations/20261013120000_player_cards_v2.sql in the Supabase SQL Editor, or apply the migration using your existing Supabase CLI workflow. This creates four public-read tables:

- players: one identity row per source player ID.
- player_cards: one row per individual card.
- player_assets: one row per asset key, with the B2 object/public URL and file status.
- player_card_assets: links cards to renders, logos, flags, and background choices.

Row-level security permits public reads only. The importer uses a server-side Supabase secret/service-role key for writes.

## 2. Validate locally

No network calls or writes happen in dry-run mode.

    npm run test:player-db
    node scripts/player-database/import-player-cards.mjs --dry-run --json data/player-cards.json --assets-dir data/assets

For metadata-only/testing when the supplied image folder is incomplete:

    node scripts/player-database/import-player-cards.mjs --dry-run --allow-missing-assets --json data/player-cards.json --assets-dir data/assets

Do not use --allow-missing-assets for the production seed unless you intentionally accept cards with pending images.

## 3. Configure secrets

Set these in your local terminal session; do not commit them to GitHub:

- SUPABASE_URL
- SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)
- B2_APPLICATION_KEY_ID
- B2_APPLICATION_KEY
- B2_BUCKET_ID
- B2_PUBLIC_BASE_URL

Use a Backblaze application key restricted to the target bucket with file-write access. Configure the bucket for public reads, or use the public custom-domain base already configured for that bucket. B2_PUBLIC_BASE_URL should be the base URL directly before the object path, for example https://f005.backblazeb2.com/file/YOUR_PUBLIC_BUCKET only if that is the actual public URL for your bucket.

PowerShell example (replace every placeholder in your own terminal):

    $env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
    $env:SUPABASE_SECRET_KEY = "YOUR_SERVER_SIDE_SECRET"
    $env:B2_APPLICATION_KEY_ID = "YOUR_B2_KEY_ID"
    $env:B2_APPLICATION_KEY = "YOUR_B2_APPLICATION_KEY"
    $env:B2_BUCKET_ID = "YOUR_B2_BUCKET_ID"
    $env:B2_PUBLIC_BASE_URL = "YOUR_BUCKET_PUBLIC_BASE_URL"

Never use the Supabase secret/service-role key in browser code or frontend environment variables.

## 4. Import

After the migration is applied and the full asset set passes validation:

    node scripts/player-database/import-player-cards.mjs --apply --json data/player-cards.json --assets-dir data/assets

The uploader writes files under player-database/sha256/ in B2 and saves an upload manifest under your home-directory cache. This manifest helps resume interrupted uploads without needing to upload the same content again. Supabase writes are idempotent upserts in batches.

If assets are intentionally omitted, add --allow-missing-assets; omitted images will be stored with pending status. Source-side image failures are stored with unavailable status. No fallback URL is fabricated.

## Notes

- The script checks source SHA-256 hashes and file sizes before upload.
- Signed/temporary per-image sourceUrl query strings and local file paths are stripped from stored raw JSON; stable canonical source URLs and asset metadata are retained.
- The script does not deploy the site or expose a player database page. The next stage is to build the read-only search/detail UI against these tables, then test it with real imported records.
