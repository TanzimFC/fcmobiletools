// Central ad configuration managed by the FC Mobile Tools admin panel.
// Third-party Monetag formats may run only on public giveaway hub/detail pages, after ad consent.
// All formats are OFF by default. Homepage, admin, entry, draw, claims, rules, and all other pages are excluded.
// HilltopAds referrer meta is installed in the page head; the supplied zone 7503133 is a MultiTag that includes popunder behavior, so no Hilltop ad script is configured.
export const SITE_ADS = {
  "enabled": false,
  "provider": "Monetag",
  "placementMode": "public_giveaway_pages",
  "frequencyCapMinutes": 30,
  "vignette": { "enabled": false, "zone": "12079211", "src": "https://n6wxm.com/vignette.min.js", "delayMs": 30000 },
  "push": { "enabled": false, "zone": "12079218", "src": "https://5gvci.com/act/files/tag.min.js", "delayMs": 20000 },
  "inPagePush": { "enabled": false, "zone": "12079223", "src": "https://nap5k.com/tag.min.js", "delayMs": 25000 },
  "excludedPathPrefixes": ["/admin", "/api", "/creator/login", "/fc-mobile-27", "/account"]
};
