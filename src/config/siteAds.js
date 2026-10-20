// Central ad configuration managed by the FC Mobile Tools admin panel.
// Monetag formats run on every /giveaways route after advertising consent. Homepage, admin, accounts, and every other tool are excluded. No popunder format is configured.
export const SITE_ADS = {
  "enabled": true,
  "provider": "Monetag",
  "placementMode": "giveaways_only",
  "frequencyCapMinutes": 30,
  "vignette": {
    "enabled": true,
    "zone": "12079211",
    "src": "https://n6wxm.com/vignette.min.js",
    "delayMs": 30000
  },
  "push": {
    "enabled": true,
    "zone": "12079218",
    "src": "https://5gvci.com/act/files/tag.min.js",
    "delayMs": 15000
  },
  "inPagePush": {
    "enabled": true,
    "zone": "12079223",
    "src": "https://nap5k.com/tag.min.js",
    "delayMs": 5000
  },
  "excludedPathPrefixes": [
    "/admin",
    "/api",
    "/creator/login",
    "/fc-mobile-27",
    "/account"
  ]
};
