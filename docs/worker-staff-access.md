# Restricted Worker Staff Access

This staff account uses a separate Cloudflare Worker session. It does not use the owner's `ADMIN_USERNAME` / `ADMIN_PASSWORD` credentials and is never treated as an owner session.

## Configure Worker secrets

Set these secrets for the production Worker using the existing Cloudflare/Wrangler project:

```sh
npx wrangler secret put WORKER_USERNAME
npx wrangler secret put WORKER_PASSWORD
npx wrangler secret put WORKER_SESSION_SECRET
```

Enter the value when Wrangler prompts. Use a dedicated username that is different from `ADMIN_USERNAME`, a unique strong password, and a randomly generated session secret (at least 32 random bytes). Do not commit these values to the repository or place them in client-side code.

Optional display label:

```sh
npx wrangler secret put WORKER_DISPLAY_NAME
```

After configuring the secrets, deploy through the project's normal review/build/deploy process. The Worker login is available from the usual `/admin/` sign-in screen; staff use the same form with the Worker credentials. Sessions last up to eight hours. Rotate `WORKER_SESSION_SECRET` to invalidate existing Worker sessions after a suspected compromise.

## Worker permissions

The Worker dashboard keeps restricted items visible in the sidebar and marks them as locked. Trying to open a locked item shows a restricted-area screen. The server checks permissions too; this is not a UI-only lock.

Allowed:
- Redeem codes: list, create, edit, verify, expire/activate, bulk operations and CSV export. Delete operations are denied to Worker role.
- Football Centre and Events & Resets: read and update supported content through the existing validated APIs.
- Media Library: browse assets and request the existing signed upload configuration.
- Rank Up, Training data and FC Mobile 27 release data: use their validated admin tools.
- Worker overview and database health status.

Denied:
- Ad settings, including the advertising master switch.
- Accounts and Account System, XP/token balances, user state, suspensions, bans, closures and fraud removal.
- Staff/creator management, article publishing/inbox, surveys, giveaways, leagues and tournament controls.
- All other API endpoints and direct admin pages not explicitly allowed above.

## Security notes

- Owner authentication remains separate and unchanged in its authorization boundary.
- The Worker role is checked against a strict route-and-method allowlist before restricted API handlers run.
- A Worker session cannot gain owner rights by visiting `/api/admin/*` directly.
- Redeem-code deletion is prohibited by the redeem API's role check as well as the Worker endpoint allowlist.
- This is one shared Worker account. Actions are labelled with the configured Worker username, not a separate personal identity for each staff member. Create a separate per-person staff system if individual attribution is needed.
