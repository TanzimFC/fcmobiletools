# FCMobiletools Notification Studio

## Required Cloudflare secret

The OneSignal REST API key must be configured as a Cloudflare Worker secret named `ONESIGNAL_REST_API_KEY`. Never put it in `src/config/siteNotifications.js`, a browser script, or Git.

From the repository with Wrangler authenticated to the production Cloudflare account:

```sh
npx wrangler secret put ONESIGNAL_REST_API_KEY
```

Paste the REST API key from the OneSignal app's Keys & IDs page. The public App ID is already configured in the Worker. Do not use a user auth key or expose the REST API key in any build-time public variable.

## Admin workflow

- Open `/admin/notification-studio.html` from the admin sidebar.
- Select the audience. Category audiences use the topic tags already synced from `/notifications/`; all-subscriber sends target subscribed push users.
- Send a test only to one subscription ID. This does not broadcast to the selected audience.
- Campaigns and failures are recorded in the Cloudflare D1 `notification_campaigns` table.
- Sending is owner-admin-only. Worker and creator sessions cannot call the endpoint.

## Redeem-code automation

- Creating a new active code whose release date is today or earlier triggers one alert to the redeem-code topic.
- A bulk create that adds new active codes sends one combined alert.
- Editing, renaming, expiring, verifying, deleting, or updating existing codes does not trigger an alert.
- Automatic alerts are skipped until `ONESIGNAL_REST_API_KEY` is configured.
- Automated messages link directly to `https://fcmobiletools.online/redeem-codes/`.

## Suggested message copy

Single code:
- Title: `⚽ New FC Mobile redeem code`
- Body: `A new code is live for [reward]. Check the region and expiry, then claim your rewards.`

Bulk:
- Title: `🎁 New FC Mobile codes are live`
- Body: `[N] new codes added. Check rewards, region and expiry, then claim yours.`
