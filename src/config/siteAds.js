// Central ad configuration managed by the FC Mobile Tools admin panel.
// Only the Monetag Vignette format remains available. Browser push ads and
// In-Page Push are removed from configuration and rejected by the Worker.
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
  "excludedPathPrefixes": [
    "/admin",
    "/api",
    "/creator/login",
    "/fc-mobile-27",
    "/account"
  ]
};
