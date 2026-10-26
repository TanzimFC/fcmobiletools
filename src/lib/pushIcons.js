// Small stroke icons shared by the alert panel, the redeem page card and the alerts page.
export const PUSH_ICONS = Object.freeze({
  bell: '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a2 2 0 003.4 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  redeem_codes: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8M7.5 8a2.5 2.5 0 110-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 100-5C13 3 12 8 12 8"/>',
  live_events: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  daily_reset: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
  division_rivals: '<path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4z"/>',
  giveaways: '<path d="M7 3h10l-1 5a4 4 0 01-8 0L7 3z"/><path d="M12 12v4M9 20h6M12 16v4"/>',
  site_updates: '<path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4L12 2z"/>',
});
export const pushIcon = (name, size = 18, stroke = 1.9) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PUSH_ICONS[name] || ''}</svg>`;
