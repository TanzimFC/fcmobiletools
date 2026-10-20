// Central ad configuration managed by the FC Mobile Tools admin panel.
// Third-party formats are allowed only on the public giveaway hub and public giveaway detail pages. Home, admin, entry, draw, claim, rules, and other routes are excluded. No popunder format is configured.
export const SITE_ADS = {
  "enabled": true,
  "provider": "Monetag + HilltopAds",
  "placementMode": "public_giveaway_pages",
  "frequencyCapMinutes": 20,
  "vignette": {
    "enabled": true,
    "zone": "12079211",
    "src": "https://n6wxm.com/vignette.min.js",
    "delayMs": 5000
  },
  "push": {
    "enabled": true,
    "zone": "12079218",
    "src": "https://5gvci.com/act/files/tag.min.js",
    "delayMs": 10000
  },
  "inPagePush": {
    "enabled": true,
    "zone": "12079223",
    "src": "https://nap5k.com/tag.min.js",
    "delayMs": 10000
  },
  "excludedPathPrefixes": [
    "/admin",
    "/api",
    "/creator/login",
    "/fc-mobile-27",
    "/account"
  ]
};
