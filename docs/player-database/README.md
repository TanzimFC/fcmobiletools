# Player database data preparation

The player catalog uses Supabase as its normalized store. Use the SQL migration in `supabase/migrations/` to create the tables and indexes. Do not put the full catalog in a browser JSON file.

## Preview a JSON or CSV source

```sh
node scripts/player-data/normalize-player-import.mjs input.csv preview.json
```

The command maps common source aliases (`asset_id`, `overall`, `program`, `team`, and common price/shard names) into a consistent shape. It prints a row summary and validation issues, exits with status 1 if there are invalid rows, and keeps market prices and shard costs as timestamped observations. It does not write to Supabase.

Before a later import writer is enabled, review the preview for duplicate IDs/slugs, missing required fields, invalid prices, and source permission. Unverified source reuse is a blocking validation issue. The current first slice intentionally provides normalization and review only; there is no silent bulk overwrite or auto-import endpoint.

## Snapshot freshness

- Market values are observations from a source at a recorded time, not a promise that a listing will sell at that amount.
- Shard costs are scoped to an event, phase, shard type, and observation time.
- Missing price or shard values remain null; do not estimate them.

## Asset paths

The original UI icons live in `public/assets/player-ui/`. Player portraits, card backgrounds, flags, club and league badges, event art, PlayStyle, trait, and rank art need an explicit source and reuse license before copying into the repository. Record an asset through `player_assets` with a local path or stable public URL and source/license attribution.
