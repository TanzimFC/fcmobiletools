# FC Mobile Training Academy implementation notes

These notes are for maintainers. Keep them in the repository; do not surface them on the public FCM TV page.

## Product boundary

- The public-facing name is FC Mobile Training Academy. Internally, the module keeps its historical FCM TV identifiers for API and data compatibility.
- Use the official YouTube embedded player with playback controls visible and retain normal YouTube attribution.
- Do not award, unlock, multiply, or condition XP/tokens, account progression, giveaways, or other compensation on a YouTube view, watch duration, playback completion, likes, comments, sharing, or subscriptions.
- The optional one-question knowledge check is an independent content interaction. It must remain skippable and must never gate playback or pay a reward.
- Do not add a watch-time endpoint or a public `/api/claim-xp` route. Client-supplied time, player state, tab focus, or quiz answers are not proof suitable for granting currency.
- Do not hide, cover, overlay, modify, or replace YouTube controls or ads. Use the official IFrame API and allow users to open the video on YouTube. Do not rename endpoints to imply they are hidden or secure: browser-visible routes are observable, so security must come from server-side session checks and validation.
- Pause on hidden tabs and when the player is out of view. On the first hidden-tab interruption during active playback, pause and show the inline “Lesson Paused” notice; on the second interruption during active playback, stop and reset to 0:00. The message and knowledge check must stay below the YouTube iframe, never over player controls. Restore playback to 1× after the player emits a rate-change event. Never autoplay on page load.
- Show the optional, skippable 15-second knowledge check only after a video ends. Keep it inline below the player, not in a modal overlay. It is an independent learning interaction and must never be used as proof to grant XP, tokens, access, or compensation.

## Admin/data flow

- Public page: `/academy/`. `/fcmtv/` redirects to `/academy/` for existing bookmarks.
- Admin section: `/admin/?section=fcmtv`.
- Public read API: `GET /api/fcmtv` exposes published videos only.
- Admin API: `GET/POST /api/admin/fcmtv` requires the existing signed admin session and reads/writes `src/data/fcmtv.js` through the existing repository writer.
- Server-side validation accepts YouTube IDs or standard YouTube URLs, normalizes to an 11-character video ID, limits text fields, checks quiz choices and unique slugs, and ensures only one featured item.
- Do not change the existing Worker session/authentication or `api()` dispatch order. The public route must never expose unpublished entries.
- The initial video is the Captain Tracker clip `eQYKSr71LsM`.

## Regression checks

- Confirm unauthenticated requests to `/api/admin/fcmtv` return 401.
- Confirm the public API omits drafts and malformed video IDs.
- Confirm saving via admin validates and writes the data source, and published changes render on FCM TV.
- Confirm normal video playback works without JavaScript; with the IFrame API, confirm tab hide pauses playback and playback-rate changes are returned to 1x.
- Confirm the quiz can be skipped, times out without blocking the player, and has no reward integration. Confirm all prompts render outside the iframe bounds.
- Run `npm run build` and the repository's worker/editorial verification scripts before merging.
