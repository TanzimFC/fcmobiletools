# Archived league-finder implementation

These files were uploaded as a separate Find a League application and are intentionally kept outside Astro's live route tree and Supabase's migration directory.

They are **not the production implementation**. Do not import `app.js`, link `leagues.css`, or run the archived SQL migration.

The live implementation remains:
- UI and page styling: `src/pages/leagues/index.astro`
- Authenticated same-origin API: `src/worker.mjs` and `src/leagueWorker.mjs`
- Existing account-backed schema: `league_profiles` and `league_listings`, with migrations in `supabase/migrations/` such as `20261009182335_league_finder.sql` and `20261010120000_league_premium.sql`

The archived app instead uses browser-side direct Supabase RPC calls, `FL_CONFIG`, and a separate `fl_*` schema tied to `auth.users`. That does not match the live account/API flow. This archive is retained only for recovery/reference.

The public page's current visual markup, styles, and client behavior were not changed by this cleanup.
