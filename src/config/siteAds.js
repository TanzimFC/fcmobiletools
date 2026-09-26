// Central ad configuration managed by the FC Mobile Tools admin panel.
// /admin, /api, and /creator/login remain excluded from ads server-side.
export const SITE_ADS = {
  "enabled": true,
  "provider": "Monetag",
  "popunder": {
    "enabled": true,
    "zone": "11875908",
    "src": "https://al5sm.com/tag.min.js"
  },
  "push": {
    "enabled": true,
    "zone": "11875910",
    "src": "https://5gvci.com/act/files/tag.min.js",
    "delayMs": 30000
  },
  "excludedPathPrefixes": [
    "/admin",
    "/api",
    "/creator/login"
  ]
};
