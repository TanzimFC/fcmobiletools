# Ads system

One engine fills every ad slot on the site. For each slot it tries, in this order:

1. A paying **sponsor** ad that matches the page.
2. The ad network (**AdSense**), only when switched on, the visitor agreed to advertising, the page has enough content and the slot has an ad unit ID.
3. A **house ad**, which is one of our own promos (redeem alerts, giveaways, premium, "Advertise here").
4. Nothing. An empty slot takes no space.

Until AdSense is approved, steps 1 and 3 do all the work. House ads earn nothing, but they test the whole engine and grow push subscribers.

## Where things live

| What | File |
| --- | --- |
| Admin screen | `admin/ads-studio.html` (Admin workspace, Growth, Ads Studio) |
| Slots and which pages may show ads | `src/config/adSlots.js` |
| Rules shared by server and browser | `src/lib/adsCore.js` |
| Worker routes, database, hourly learning | `src/adsWorker.mjs` |
| Browser engine | `src/scripts/ads-engine.js`, `src/styles/ads.css` |
| Public advertiser page | `src/pages/advertise/index.astro` |
| Private sponsor report | `src/pages/advertise/report.astro` |
| Tests | `scripts/test-ads.mjs` (`npm run test:ads`) |

Data lives in D1 (tables `ads_creatives`, `ads_stats`, `ads_settings`, `ads_inquiries`, `ads_rate`). The tables and the starter ads are created on first use. Nothing needs a migration.

## Daily use

* **Change an ad:** Ads Studio, Ads, Edit. Visitors see the change within a minute.
* **Why is an ad not showing:** open it and use "Why is it not showing?". It lists what blocks it.
* **Test on a real page:** add `?adsdebug=1` to any article, scroll down. The browser console shows which ads were eligible for each slot and why the others were not.
* **Turn everything off:** Slots and rules, switch "All ads on the site" off.

## Starter ads

Created once, all editable: two versions of the redeem alert ad (so the engine can learn which wording works), alert ads in Indonesian, Portuguese (BR) and Bangla, a live redeem code count, a giveaway ad that only runs while a giveaway is live, a giveaway alerts ad, and "Advertise here". A Premium ad is created as a **draft**. Point its link at your real premium page, then switch it on.

Ad text can include live values: `{codes.active}`, `{codes.expiringSoon}`, `{giveaway.title}`, `{giveaway.prize}`, `{giveaway.timeLeft}`. If a value is missing (no giveaway running), that ad simply does not run.

## How it learns

Every hour the Worker compares each ad's click rate with the average. Ads with at least 200 views get a weight multiplier between 0.5 and 2. A small share of picks (10 percent by default) ignore the multiplier so new ads are always tried. Sponsors always go first.

## Sponsors

1. Someone fills in the form on `/advertise/`. It appears in Ads Studio, Advertisers.
2. Reply on the contact they gave. Agree wording, dates and price outside the site.
3. "Create a draft sponsor ad", write the final text, set start and end dates, switch it on.
4. Open the ad and copy the **sponsor report link**. It shows only that campaign: views, clicks, click rate by day.

Sponsor links get `rel="sponsored nofollow noopener"`. Sponsor ads cannot contain HTML or scripts, and images must be hosted on Cloudinary or this site.

## Going live with AdSense

1. Wait for Google approval.
2. In AdSense, create display ad units and note each numeric ID.
3. Ads Studio, AdSense: paste the IDs next to the slots you want, set how often the network goes first, switch it on.
4. Watch Overview. Slots the network leaves empty are filled by house ads automatically.

No Google script loads while AdSense is off, and none loads for a visitor who has not agreed to advertising.

## What protects visitors

* Pages are blocked by default. Only the pages listed in `src/config/adSlots.js` can show ads. Account, giveaway, rewards, legal, notification, advertise and admin pages never do.
* Ads are inserted only below the visible screen, so the page never jumps while someone reads.
* At most 2 ads per page (3 on long articles).
* Every ad has a hide button. Hidden ads stay hidden for 7 days. After 2 hides in one visit, ads go quiet for that visit.
* A visitor who clicked an ad does not see it again for 14 days.
* Visitors with Save-Data turned on get text only.
* The network is held back on a visitor's first page, on thin pages, and without advertising consent.
* No popups, no popunders, no full screen takeovers, no push ads. Monetag and HilltopAds code has been removed.

## Privacy

Counts are totals per ad, slot and day. They are not tied to a person. What a visitor hid or clicked is stored on their device because it is their choice. How often they saw an ad is stored on their device only with advertising consent, otherwise for the current visit only. The cookie policy describes this.

## Premium

`adFreeForPremium` is on. The engine hides all ads when `window.FCMT_ADFREE === true`. When premium exists, set that flag for premium accounts and ads disappear for them.
