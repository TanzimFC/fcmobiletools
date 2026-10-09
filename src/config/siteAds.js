// Central ad configuration managed by the FC Mobile Tools admin panel.
// Public ad formats are controlled from /admin. Keep private and excluded routes out of the ad layer.
export const SITE_ADS = {
  "enabled": false,
  "provider": "Monetag + HilltopAds",
  "popunder": {
    "enabled": false,
    "zone": "11875908",
    "src": "https://al5sm.com/tag.min.js"
  },
  "push": {
    "enabled": false,
    "zone": "11875910",
    "src": "https://5gvci.com/act/files/tag.min.js",
    "delayMs": 10000
  },
  "videoSlider": {
    "enabled": false,
    "zone": "7503133",
    "src": "https://conventionalresponse.com/b.XvV/sQddGflB0WYKWacr/SeEmA9tuCZwUllWkyP/T/cl1ZM/D/MdxUM-zeMntFN/zYU/w/M/zoEIzINewF"
  },
  "excludedPathPrefixes": [
    "/admin",
    "/api",
    "/creator/login",
    "/fc-mobile-27"
  ]
};
