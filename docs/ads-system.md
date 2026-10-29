# Ads system

One engine fills every ad slot on the site. For each slot it tries, in this order:

1. A paying **sponsor** ad that matches the page.
2. The ad network (**AdSense**), only when approved, enabled, configured with a unit, eligible for the page and allowed by the visitor's optional ad choice where required.
3. A **house ad**, which is one of our own promos (redeem alerts, tools, giveaways or "Advertise here").
4. Nothing, when no eligible creative exists. The site still works normally.

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

## Placement plan

- Home pages can use a wide hero and footer strip. Lists can use a compact feed placement and footer strip. Long articles can use an early in-read card, a mid-read card, an end-of-article hero and a footer strip; the extra in-read placement is limited to articles with enough length and spacing.
- Tool pages use a square creative in a reserved desktop rail at 1280px and wider, an additional placement beneath the tool or its visible results, and a footer strip. The rail is hidden on smaller screens to protect the usable width.
- Public informational pages with enough sections can show a mid-page card and a footer strip. Account, giveaway, reward, legal, settings and other sensitive routes remain excluded.
- House creative layouts adapt to hero, compact, strip and square side-rail shapes. AdSense uses its configured fluid or auto format when it is approved and enabled.

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

No Google ad script loads while AdSense is off. Third-party requests remain separately gated by the configured unit, content thresholds, first-view grace period and applicable privacy choices. Before personalized Google ads are served in the EEA, UK or Switzerland, use a Google-certified CMP integrated with IAB TCF.

## What protects visitors

* Pages are blocked by default. Only the pages listed in `src/config/adSlots.js` can show ads. Account, giveaway, rewards, legal, notification, advertise and admin pages never do.
* Inline placements are inserted below the visible screen to avoid interrupting reading. The clearly labelled desktop tool rail can be visible alongside the first screen, with its space reserved to prevent content shifts.
* At most 3 ads per page (4 on long articles), subject to available and eligible placements.
* Every ad has a hide button. Hidden ads stay hidden for 7 days. Hiding one promotion does not switch off other promotions or sitewide ads.
* A visitor who clicked an ad does not see it again for 14 days.
* Visitors with Save-Data turned on get text only.
* The network is held back on a visitor's first page, on thin pages, without a configured unit, and without the required advertising choice. House and sponsor promos do not depend on this choice.
* No popups, no popunders, no full screen takeovers, no push ads. Monetag and HilltopAds code has been removed.

## Privacy

Counts are totals per ad, slot and day. They are not tied to a person. Without optional ad-related storage, hide, click and frequency preferences last for the current visit only; with it enabled, those preferences can persist across visits. Turning off optional storage does not hide the site's own promotions or sponsor placements. The cookie policy describes this.

## Premium

`adFreeForPremium` is on. The engine hides all ads when `window.FCMT_ADFREE === true`. Premium has not launched, and no public ad-free control is available. Do not enable the ad-free flag for ordinary visitors.
