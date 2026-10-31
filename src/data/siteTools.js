// One catalogue of tools and resources, shared by the homepage, /tools and /start.
// Edit here and every page follows.

/** 24px stroke icons (Lucide-style paths). Use iconSvg(name). */
export const ICONS = {
  ovr: '<path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4z"/><path d="m9 12 2 2 4-4"/>',
  training: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  rank: '<path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/>',
  gauntlet: '<path d="M5 4h14v6a7 7 0 0 1-14 0V4z"/><path d="M9 20h6M12 17v3"/>',
  playstyle: '<path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4L12 2z"/>',
  finder: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6M8 11h6"/>',
  investment: '<path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 3 6-7"/>',
  shards: '<path d="m12 3 8 6-8 12L4 9l8-6z"/><path d="M4 9h16M12 3l-3 6 3 12 3-12-3-6"/>',
  events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  codes: '<path d="M3 9a2 2 0 0 0 0 6v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  centre: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
  tracker: '<path d="M4 19V5M4 19h16"/><path d="M8 15l3-3 3 2 5-6"/>',
  trivia: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  season: '<path d="M13 2 4.5 13H11l-1 9L19.5 11H13z"/>',
  giveaway: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  tournament: '<path d="M7 3h10l-1 5a4 4 0 0 1-8 0L7 3z"/><path d="M7 6H4a4 4 0 0 0 4 4M17 6h3a4 4 0 0 1-4 4M10 12v4h4M9 20h6"/>',
  league: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  article: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 11h6M9 15h6M9 7h3"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z"/>',
};

export const iconSvg = (name, cls = 'ic') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] ?? ''}</svg>`;

/** Accent colours per theme. Cyan is the brand; mint is live and positive; gold is rewards. */
export const ACCENTS = {
  cyan: '#4cc9ff',
  mint: '#3ddc97',
  gold: '#f5c451',
  violet: '#9a8cff',
  rose: '#ff7a9c',
};

/**
 * level: who it is for. 'easy' needs nothing, 'planner' means you enter some numbers.
 * group: squad | earn | live | community
 */
export const TOOLS = [
  { id: 'team-ovr', group: 'squad', name: 'Team OVR Calculator', href: '/team-ovr/', icon: 'ovr', accent: 'cyan', level: 'planner', tag: 'Popular',
    short: 'See your squad rating and what the next point costs.',
    text: 'Enter your squad, pick from 28 formations, and see your Team OVR with the cheapest upgrade to the next point. Save it as an image.' },
  { id: 'training', group: 'squad', name: 'Training Calculator', href: '/training-calculator/', icon: 'training', accent: 'cyan', level: 'planner',
    short: 'Plan the XP and fodder to reach a training level.',
    text: 'Plan Training XP and the materials needed to reach a target level.' },
  { id: 'rank-up', group: 'squad', name: 'Rank Up Calculator', href: '/rank-up-calculator/', icon: 'rank', accent: 'cyan', level: 'planner',
    short: 'Compare Rank Up costs with the OVR you gain.',
    text: 'Estimate Rank Up Points for the upgrade you have planned.' },
  { id: 'gauntlet', group: 'squad', name: 'Gauntlet Planner', href: '/gauntlet-planner/', icon: 'gauntlet', accent: 'violet', level: 'planner', tag: 'New',
    short: 'Plan player rotations for Gauntlet Mode.',
    text: 'Organise player rotations for Gauntlet Mode.' },
  { id: 'playstyle', group: 'squad', name: 'PlayStyle Guide', href: '/player/playstyle/', icon: 'playstyle', accent: 'violet', level: 'easy',
    short: 'What every PlayStyle does, in plain words.',
    text: 'Understand FC Mobile PlayStyles and how they shape player behaviour.' },
  { id: 'playstyle-finder', group: 'squad', name: 'PlayStyle Finder', href: '/player/playstyle-finder/', icon: 'finder', accent: 'violet', level: 'easy',
    short: 'Find the PlayStyles that fit how you play.',
    text: 'Find the PlayStyles that fit the way you play.' },
  { id: 'investment', group: 'earn', name: 'Investment Calculator', href: '/investment-calculator/', icon: 'investment', accent: 'gold', level: 'planner',
    short: 'Market tax, profit and break-even prices.',
    text: 'Work out market tax, selling proceeds, profit and break-even prices.' },
  { id: 'shards', group: 'earn', name: 'Shards Counter', href: '/shards-counter/', icon: 'shards', accent: 'gold', level: 'planner',
    short: 'Track Star Shards toward the reward you want.',
    text: 'Track Star Shards and measure progress toward a reward.' },
  { id: 'events', group: 'live', name: 'FC Mobile Events', href: '/events/', icon: 'events', accent: 'mint', level: 'easy', tag: 'Live',
    short: 'Event dates, the daily reset and countdowns.',
    text: 'Follow event dates, live content and countdowns in one place.' },
  { id: 'codes', group: 'live', name: 'Redeem Codes', href: '/redeem-codes/', icon: 'codes', accent: 'gold', level: 'easy', tag: 'Popular',
    short: 'Every code with its reward, region and status.',
    text: 'Check code status, rewards, regions and expiry information.' },
  { id: 'centre', group: 'live', name: 'Football Centre', href: '/football-centre/', icon: 'centre', accent: 'mint', level: 'easy',
    short: 'Showdown results and event progress in one place.',
    text: 'Follow Football Centre results, analysis and event progress.' },
  { id: 'captain', group: 'live', name: 'Captain OVR Tracker', href: '/captain-tracker/', icon: 'tracker', accent: 'mint', level: 'easy',
    short: 'Captain OVR objectives and matchday progress.',
    text: 'Track Captain OVR objectives and matchday progress.' },
  { id: 'trivia', group: 'live', name: 'Trivia Answers', href: '/trivia/', icon: 'trivia', accent: 'violet', level: 'easy',
    short: 'Search any Season Recap or A Nation’s Story question.',
    text: 'Find answers for A Nation’s Story and Extra Time questions.' },
  { id: 'fc27', group: 'live', name: 'FC Mobile 27 Guide', href: '/fc-mobile-27/', icon: 'season', accent: 'cyan', level: 'easy',
    short: 'Season 27 features, install guide and coverage.',
    text: 'Read the Season 27 feature guide and current game coverage.' },
  { id: 'giveaways', group: 'community', name: 'Giveaways', href: '/giveaways/', icon: 'giveaway', accent: 'gold', level: 'easy', tag: 'Free',
    short: 'Free to enter. Every winner is checked by a person.',
    text: 'Free-to-enter giveaways with proof checks and a public draw.' },
  { id: 'tournaments', group: 'community', name: 'Tournaments', href: '/tournaments/', icon: 'tournament', accent: 'rose', level: 'easy',
    short: 'Community brackets, fixtures and results.',
    text: 'Follow community tournaments, fixtures and results.' },
  { id: 'leagues', group: 'community', name: 'Leagues', href: '/leagues/', icon: 'league', accent: 'rose', level: 'easy',
    short: 'Find or run a league with other players.',
    text: 'Find a league to join, or run your own with other players.' },
];

export const TOOL_GROUPS = [
  { id: 'squad', title: 'Build your squad', note: 'Work out what an upgrade costs before you spend anything.' },
  { id: 'earn', title: 'Earn and track', note: 'Keep an eye on coins, shards and market profit.' },
  { id: 'live', title: 'Stay up to date', note: 'What is live in the game right now.' },
  { id: 'community', title: 'Play with others', note: 'Giveaways, tournaments and leagues run by the community.' },
];

export const LEVEL_LABEL = {
  easy: 'No setup, just open it',
  planner: 'You enter a few numbers',
};

/**
 * "What do you want to do?" The beginner path. Each goal points at the best first page and
 * lists the pages worth reading after it, in order.
 */
export const GOALS = [
  { id: 'free', title: 'Get free rewards', icon: 'codes', accent: 'gold',
    lead: 'Redeem codes and giveaways cost nothing.',
    first: { label: 'Open today’s redeem codes', href: '/redeem-codes/' },
    then: [{ label: 'Enter a giveaway', href: '/giveaways/' }, { label: 'Get code alerts', href: '/notifications/' }] },
  { id: 'live', title: 'See what is live right now', icon: 'events', accent: 'mint',
    lead: 'Event dates, the daily reset and countdowns.',
    first: { label: 'Open the events hub', href: '/events/' },
    then: [{ label: 'Football Centre', href: '/football-centre/' }, { label: 'FC Mobile 27 guide', href: '/fc-mobile-27/' }] },
  { id: 'squad', title: 'Improve my squad', icon: 'ovr', accent: 'cyan',
    lead: 'Start with your Team OVR, then plan the upgrades.',
    first: { label: 'Calculate my Team OVR', href: '/team-ovr/' },
    then: [{ label: 'Plan training', href: '/training-calculator/' }, { label: 'Compare rank ups', href: '/rank-up-calculator/' }] },
  { id: 'coins', title: 'Make more coins', icon: 'investment', accent: 'gold',
    lead: 'Know your profit after market tax before you buy.',
    first: { label: 'Open the investment calculator', href: '/investment-calculator/' },
    then: [{ label: 'Track Star Shards', href: '/shards-counter/' }] },
  { id: 'answers', title: 'Find an answer or a guide', icon: 'trivia', accent: 'violet',
    lead: 'Trivia answers, game updates and how-to guides.',
    first: { label: 'Search trivia answers', href: '/trivia/' },
    then: [{ label: 'Read the latest guides', href: '/blog/' }, { label: 'PlayStyle guide', href: '/player/playstyle/' }] },
  { id: 'community', title: 'Play with other players', icon: 'league', accent: 'rose',
    lead: 'Join a league or follow a community tournament.',
    first: { label: 'Browse leagues', href: '/leagues/' },
    then: [{ label: 'Tournaments', href: '/tournaments/' }, { label: 'Host a tournament', href: '/host-a-tournament/' }] },
];
