// Central ad configuration managed by the FC Mobile Tools admin panel.
// All third-party advertising formats are intentionally disabled site-wide.
export const SITE_ADS = {
  "enabled": false,
  "provider": "Monetag",
  "placementMode": "disabled",
  "frequencyCapMinutes": 30,
  "vignette": {
    "enabled": false,
    "zone": "12079211",
    "src": "https://n6wxm.com/vignette.min.js",
    "delayMs": 60000
  },
  "push": {
    "enabled": false,
    "zone": "12079218",
    "src": "https://5gvci.com/act/files/tag.min.js",
    "delayMs": 30000
  },
  "inPagePush": {
    "enabled": true,
    "zone": "12079223",
    "src": "https://nap5k.com/tag.min.js",
    "delayMs": 8000
  },
  "excludedPathPrefixes": [
    "/admin",
    "/api",
    "/creator/login",
    "/fc-mobile-27",
    "/account"
  ]
};
