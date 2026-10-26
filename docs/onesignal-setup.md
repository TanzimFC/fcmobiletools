# OneSignal setup for FCMOBILETOOLS

This integration uses the OneSignal Web SDK v16 with App ID `c64e5faf-4171-4fbc-af73-8406200cee1e` and Safari Web ID `web.onesignal.auto.560021c2-877c-448b-9811-f001e7b5ec58`. The shared push client initializes the SDK once, keeps the custom `/onesignal/OneSignalSDKWorker.js` path and `/onesignal/` scope, and enables OneSignal's notification button. Browser permission is requested only after a visitor presses an enable control.

## One-time dashboard setup

1. Create a OneSignal app for **FCMOBILETOOLS** and add the Web platform using **Custom Code**.
2. Set the site origin to `https://fcmobiletools.online`. Use HTTPS and the exact production domain.
3. Keep OneSignal's automatic permission prompts disabled. FCMOBILETOOLS asks only after an intentional button click.
4. The App ID is already configured in `src/config/siteNotifications.js`. App IDs are public; never place the App API Key in website code.
5. After merging, confirm the production deployment completes and open `https://fcmobiletools.online/notifications/`.

The service worker is hosted at `/onesignal/OneSignalSDKWorker.js` and uses the `/onesignal/` scope to avoid replacing the existing root-scope worker.

## Notification topics

The Notifications page stores these OneSignal user tags as strings `true` or `false`:

- `notify_redeem_codes`
- `notify_live_events`
- `notify_giveaways`
- `notify_site_updates`

Create matching OneSignal segments before sending topic-specific alerts. Do not assume a tag is a segment until the segment has been created and tested.

## Test before launch

1. Add your own browser to Audience → Subscriptions.
2. Enable alerts on `https://fcmobiletools.online/notifications/` in a normal browser window, not private browsing.
3. Confirm the subscription appears in OneSignal and the selected topic tags are present.
4. Send a test message to your test subscription only. Confirm its click opens the intended page.
5. Test pause/resume, a denied browser permission, mobile browsers, and a fresh browser profile before promoting the page to everyone.

## Sending rules

Start with only verified redeem-code alerts, important event changes and winner announcements. Do not send a push for routine page views or every minor update. Link each message to the exact site page, use a short title and body, and include a clear reason to click. Pause any campaign that produces complaints or unsubscribes.
