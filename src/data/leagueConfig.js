// Shared by the Worker API, the SSR league pages and the client. Keep it dependency free.

// Division icons never change, so they are served through /leagues/icons/<key>.webp
// (immutable, edge cached) instead of loading from Cloudinary on every visit.
const CLOUD = 'https://res.cloudinary.com/b0qikv7n/image/upload/';
export const DIVISIONS = [
  { key: 'bronze',      label: 'Bronze',      min: 1050, max: 2000,  source: CLOUD + 'v1791568728/fc-mobile-tools/uv6y99kploemufe1mvmy.png' },
  { key: 'silver',      label: 'Silver',      min: 2100, max: 4000,  source: CLOUD + 'v1791568732/fc-mobile-tools/dce4osbxce7krvdxmkm0.png' },
  { key: 'world_class', label: 'World Class', min: 4100, max: 6000,  source: CLOUD + 'v1791568737/fc-mobile-tools/pvinzecb98ev2acmqns9.png' },
  { key: 'legendary',   label: 'Legendary',   min: 6100, max: 8000,  source: CLOUD + 'v1791568741/fc-mobile-tools/nvjwi9agj5f28pybnqg6.png' },
  { key: 'fc_champions',label: 'FC Champions',min: 8100, max: 10000, source: CLOUD + 'v1791568746/fc-mobile-tools/e6wjkncjvuletbguoicz.png' }
];
export const DIVISION_KEYS = DIVISIONS.map(d => d.key);
export const divisionByKey = (key) => DIVISIONS.find(d => d.key === key) || null;
export const divisionIcon = (key) => (divisionByKey(key) ? '/leagues/icons/' + key + '.webp' : '');
export const divisionRange = (d) => d ? d.min.toLocaleString('en-US') + ' – ' + d.max.toLocaleString('en-US') : '';
// Origin URL with a small, cache-friendly transform. Used only by the icon proxy.
export const divisionOriginUrl = (key) => {
  const d = divisionByKey(key);
  return d ? d.source.replace('/upload/', '/upload/f_webp,q_auto,w_128/') : '';
};

export const ACCENTS = {
  cyan:   '#4cc9ff', gold: '#f6c453', mint: '#6ee7b7', violet: '#9a8cff',
  rose:   '#ff8fb1', orange: '#ffa35c', sky: '#7aa8ff', lime: '#b6f05a'
};
export const ACCENT_KEYS = Object.keys(ACCENTS);

export const JOIN_METHODS = {
  apply:   'Apply here',
  discord: 'Join Discord',
  in_game: 'Search in game'
};
export const JOIN_KEYS = Object.keys(JOIN_METHODS);

export const FREQ = { daily: 'Daily', most_days: 'Most days', several_weekly: '3–4 days a week', weekly: 'Weekly', occasional: 'Occasional' };
export const COMMIT = { casual: 'Casual', regular: 'Regular', competitive: 'Competitive' };

export const RULES_VERSION = '2026-10-11';
// Short, plain rules. Shown before a league can be listed.
export const LISTING_RULES = [
  'Only list a league you really run. One listing per account.',
  'Keep details true: OVR, open spots, schedule and how to join.',
  'No fake activity, no paid or fake reviews, no spam.',
  'Never post other players\u2019 UIDs, Discord names or screenshots without their consent.',
  'Be respectful. No hate, harassment, scams or adult content.',
  'Keep open spots up to date. Close recruiting when you are full.',
  'Listings that break these rules are removed without notice.'
];

export const SITE_ORIGIN = 'https://fcmobiletools.online';
