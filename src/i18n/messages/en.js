// English source dictionary. Add a key here first, then translate it in the other files.
// Keys that a language leaves out fall back to this file.
import redeem from './pages/redeem.en.js';

export default {
  redeem,
  common: {
    skipToContent: 'Skip to content',
    home: 'Home',
    homeMeta: 'Start here',
    free: 'Free',
    mostPopular: 'Most popular',
    openPage: 'Open page',
    more: 'More',
    update: 'Update',
    codes: 'Codes',
    events: 'Events',
    account: 'Account',
    login: 'Login',
    myProfile: 'My Profile',
    myAccount: 'My Account',
    accountProfile: 'Account & Profile',
    accountMeta: 'Identity, XP progression & community',
    profileMeta: 'Profile, progression and rewards',
    levelShort: 'Lv. {n}',
    levelLong: 'Level {n}',
    signInAria: 'Sign in to your FCMobiletools account',
    openProfileAria: 'Open your FCMobiletools profile',
    homeAria: 'FCMobiletools home',
    search: 'Search pages',
    searchPlaceholder: 'Search tools, events, codes...',
    jumpAnywhere: 'Jump anywhere',
    noMatches: 'No matches. Try “codes”, “events” or “update”.',
    primaryNav: 'Primary navigation',
    quickNav: 'Quick navigation',
    siteMenu: 'Site menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu'
  },
  nav: {
    groups: { tools: 'Tools', live: 'Live', community: 'Community' },
    update: { label: 'FC Mobile 27 Update', meta: 'Season 27 · Sep 24', blurb: 'Season 27 changes, feature guide and official Android install.' },
    giveawaysSheetMeta: 'Win prizes. Verified and safe',
    items: {
      'team-ovr': { label: 'Team OVR', meta: 'Squad rating' },
      playstyle: { label: 'PlayStyle Guide', meta: 'Player abilities' },
      'playstyle-finder': { label: 'PlayStyle Finder', meta: 'Smart role-based matcher' },
      training: { label: 'Training Calculator', meta: 'XP planner' },
      rank: { label: 'Rank Up Calculator', meta: 'Rank costs' },
      investment: { label: 'Investment Calculator', meta: 'Market planning' },
      gauntlet: { label: 'Gauntlet Planner', meta: 'Squad rotation' },
      shards: { label: 'Shards Counter', meta: 'Star Shards target' },
      events: { label: 'Events', meta: 'Countdowns' },
      codes: { label: 'Redeem Codes', meta: 'Latest rewards' },
      centre: { label: 'Football Centre', meta: 'Live hub' },
      tracker: { label: 'Captain OVR Tracker', meta: 'Matchday 7 analysis' },
      trivia: { label: 'Trivia', meta: "Extra Time & A Nation's Story" },
      tournaments: { label: 'Tournaments', meta: 'Community competitions' },
      leagues: { label: 'Find a League', meta: 'Find your club or recruit players' },
      giveaways: { label: 'Giveaways', meta: 'Win prizes. Free to enter' },
      articles: { label: 'Articles', meta: 'News, leaks, guides' }
    }
  },
  footer: {
    aria: { tools: 'Tools', live: 'Live', articles: 'Articles', legal: 'Information and legal' },
    brand: 'FC Mobile tools, live resources, calculators and guides built to keep everything useful in one place.',
    note: 'Fan-made • Not affiliated with EA SPORTS FC Mobile.',
    built: 'Built for the FC Mobile community.',
    cols: { tools: 'TOOLS', live: 'LIVE', articles: 'ARTICLES', legal: 'INFO & LEGAL' },
    links: {
      triviaAnswers: 'Trivia Answers',
      allArticles: 'All Articles',
      updates: 'Updates',
      leaks: 'Leaks',
      guides: 'Guides',
      analysis: 'Analysis',
      reviews: 'Reviews',
      about: 'About',
      privacy: 'Privacy',
      terms: 'Terms',
      disclaimer: 'Disclaimer',
      contact: 'Contact',
      privacyChoices: 'Privacy Choices',
      pushAlerts: 'Push Alerts'
    }
  },
  switcher: {
    label: 'Language',
    aria: 'Change language',
    fallbackHint: 'This page is not translated into {language} yet. Opens the closest available page.'
  }
};
