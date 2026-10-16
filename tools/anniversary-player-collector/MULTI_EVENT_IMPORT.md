# Multi-event player data import

The collector's output is local and git-ignored. Import from the combined export only after refreshing the listings and finishing detail collection.

## 1. Keep the current files

Do **not** delete `data/`, run `--fresh`, or remove the current JSON/checkpoint files. The collector is resumable and the combined exporter deduplicates player pages by canonical RenderZ player URL. Existing card IDs are upserted by `source_card_id`, not inserted as duplicates.

## 2. Finish the collection first

From PowerShell:

```powershell
git checkout feature/anniversary-player-pipeline
git pull
cd tools/anniversary-player-collector
npm install
npm run programs:collect -- --refresh-categories
npm run programs:export
npm run programs:coverage
```

The collection command refreshes listings and resumes saved detail records. Do not use `--fresh`. Stop if RenderZ returns 403/429 or a challenge; do not try to bypass it. Review `data/coverage-report.json`. It should show the recent programs and a falling missing-card count. A coverage failure means more collection is needed, not that current records should be deleted.

## 3. Apply the additive schema migration

Review and apply `supabase/migrations/20261016_fc_player_multi_program.sql` to the intended Supabase project before the import. It expands the card template/tier checks for unpublished generic event cards, adds `card_category`, and adds the many-to-many `fc_player_card_programs` table. It does not delete player rows or publish cards. Apply this migration through the project's normal reviewed migration process; do not run it against a different project.

## 4. Validate the import without writing

Put `SUPABASE_SERVICE_ROLE_KEY` only in a local `.env` file at the repository root or collector directory. The default Supabase URL points to the existing FCMobiletools project; set `SUPABASE_URL` explicitly if you are intentionally testing a different project. Never commit `.env`.

```powershell
npm run import:events:dry
```

This checks the local combined export, verifies card identity/stat quality, and writes `data/events-import-report.json`. It makes no database changes. Incomplete-stat records are skipped. The report should show zero invalid IDs and zero conflicting IDs.

## 5. Import after reviewing the dry-run report

```powershell
npm run import:events -- --commit
```

The importer is idempotent:
- It upserts by RenderZ source card ID, so re-running it updates the same card row rather than duplicating it.
- Existing card publication state, Anniversary template, card name and image asset references are preserved for matching rows. A source ID resolving to a different URL blocks the import instead of overwriting the wrong card.
- New event cards are saved with `is_published = false`, `template_key = 'event-generic'`, and `card_tier = 'event'`.
- Event membership is upserted separately, so a card can belong to more than one program.
- This phase imports card identity, base stats, details, PlayStyles, category and program membership. It **does not upload images**, write to `fc_player_assets`, or publish any new cards.

The importer reads `data/player-cards-all-events.json` and writes a report to `data/events-import-report.json`. The database becomes a private development catalog; the public site should continue showing only cards explicitly marked published. Image hosting and public rendering are a separate review step.

## Critical distinction

Do not use `npm run import:catalog` for `player-cards-all-events.json`. That older script expects the legacy single-program `anniversary-3rd-2026.json` array and Anniversary-specific background assets.
