export const SITE_ADS = {
  // Master switch for all site advertising.
  enabled: true,

  // Monetag zones currently used by the FC Mobile 27 page.
  popunder: {
    enabled: true,
    zone: '11875908',
    src: 'https://al5sm.com/tag.min.js',
  },

  push: {
    enabled: true,
    zone: '11875910',
    src: 'https://5gvci.com/act/files/tag.min.js',
    delayMs: 30000,
  },

  // Private/admin-style routes are never monetized.
  excludedPathPrefixes: [
    '/admin',
    '/api',
    '/creator/login',
  ],
};
