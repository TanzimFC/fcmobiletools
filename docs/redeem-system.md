# Redeem codes system

## How it works

| Piece | Where | Notes |
|---|---|---|
| Storage | Cloudflare D1, table `redeem_codes` | Created and seeded automatically on first request (`src/lib/redeem.js`). |
| Public API | `GET /api/public/redeem-codes` | ETag + 20 s edge cache. Cache is purged on every admin write. |
| Public page | `src/pages/redeem-codes.astro` + `src/scripts/redeem-page.js` | Static HTML. The Worker injects the live snapshot and JSON-LD via `HTMLRewriter`, then the page polls every 45 s. |
| Admin API | `/api/admin/redeem*` and `/api/creator/redeem*` | Admins: full access. Creators: create / edit / expire / verify. Only admins can delete. |
| Admin UI | "Redeem Codes" section of `admin/dashboard.html` | Quick publish, bulk add, bulk actions, live preview, CSV export. |

Saving a code no longer commits to GitHub or triggers a rebuild. It is public within seconds.

## Behaviour worth knowing

- **Auto-expiry.** A code marked `active` whose expiry date has passed is served as `expired`. The admin shows an "Auto-expired" hint so you can tidy it. Expiry is inclusive of the expiry date (UTC).
- **Scheduled codes are masked** in the public API (`S•••••`) so they cannot leak early. They become visible when set to Active ("Go live" button).
- **One-time seed.** On first run the table is filled from `src/data/redeemCodes.js`. After that the file is ignored in production (it is still used by `astro dev`).
- **Backup.** Admin → Redeem Codes → Export CSV.

## Local testing

`wrangler.toml` declares `[secrets] required`, so `wrangler dev` only loads that one secret from `.dev.vars`. Pass the others as flags:

```
npx wrangler dev --local --var ADMIN_USERNAME:me ADMIN_PASSWORD:pw \
  ADMIN_SESSION_SECRET:<32+ chars> CREATOR_SESSION_SECRET:<32+ chars>
```
