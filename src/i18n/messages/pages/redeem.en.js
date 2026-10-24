// Redeem codes page. English is copied verbatim from the original page so English output is unchanged.
// Code values, reward text, region names and notes come from the data feed and are never translated.
export default {
  meta: {
    title: 'FC Mobile Redeem Codes | Working Codes & Rewards',
    description: 'Live FC Mobile redeem codes with rewards, expiry status and the official EA redemption steps. Copy a code in one tap and redeem on FCMOBILETOOLS.',
    ldName: 'FC Mobile Redeem Codes | Working Codes & Rewards | FCMOBILETOOLS',
    ldDescription: 'Live FC Mobile redeem codes with rewards, expiry status and the official EA redemption steps.',
    ldList: 'Working FC Mobile redeem codes',
    ldCrumb: 'FC Mobile Redeem Codes'
  },
  hero: {
    connecting: 'Connecting…',
    titleLead: 'FC Mobile',
    titleGrad: 'Redeem Codes',
    lede: "Every working code in one place. Copy it in a tap, jump to EA's official page, and watch this list update itself the moment a new one drops.",
    ctaLive: 'See live codes',
    ctaEa: 'Open EA redemption',
    statActive: 'Active now',
    statUpcoming: 'Upcoming',
    statTotal: 'Codes tracked'
  },
  live: {
    kicker: 'Live now',
    title: 'Working FC Mobile codes',
    sub: "Tap a code to copy it. Redeem copies it and opens EA's page in one go.",
    activePill: '{n} active',
    // Optional singular form. Languages that need one (for example Portuguese) provide it.
    activePillOne: '{n} active',
    noscriptPre: 'Live codes need JavaScript. You can still open ',
    noscriptLink: "EA's redemption page",
    noscriptPost: ' directly.'
  },
  soon: {
    kicker: 'Coming soon',
    title: 'Codes on the way',
    sub: 'Announced but not live yet. The code is revealed the moment it drops.'
  },
  archive: {
    kicker: 'Archive',
    title: 'Every code, searchable',
    sub: 'Search by code, reward or region. Filter by status or reward type.',
    searchPlaceholder: 'Search codes or rewards…',
    searchAria: 'Search redeem codes',
    clearAria: 'Clear search',
    statusAria: 'Filter by status',
    sortLabel: 'Sort',
    sortAria: 'Sort codes',
    sortNew: 'Newest first',
    sortOld: 'Oldest first',
    sortAz: 'A → Z',
    typesAria: 'Filter by reward type',
    showMoreInitial: 'Show more'
  },
  how: {
    kicker: 'How it works',
    title: 'Redeem a code in three steps',
    steps: [
      { t: 'Copy the code', d: 'Tap any active code. It goes straight to your clipboard.' },
      { t: "Open EA's redeem page", d: "Hit Redeem and EA's official site opens in a new tab with your code ready to paste." },
      { t: 'Sign in and claim', d: 'Use the EA Account linked to FC Mobile. Rewards land in your in-game inbox.' }
    ],
    troubleKicker: 'Code not working?',
    checks: [
      'Enter it exactly as shown. Tapping Copy avoids typos.',
      'Check the status badge. Expired codes can no longer be redeemed.',
      'Sign in with the same EA Account that is linked to your FC Mobile game.',
      'Some codes have a usage limit and can run out before their expiry.'
    ],
    toolsKicker: 'More FC Mobile tools',
    tools: [
      { t: 'Events & Reset', d: 'Live countdowns' },
      { t: 'Team OVR', d: 'Squad rating' },
      { t: 'Rank Up Calculator', d: 'Plan your points' },
      { t: 'Football Centre', d: 'Showdowns & points' }
    ]
  },
  faq: {
    kicker: 'FAQ',
    title: 'Common questions',
    items: [
      { q: 'What are FC Mobile redeem codes?', a: "FC Mobile redeem codes are promotional codes you enter on EA's official FC Mobile redemption website to claim in-game rewards such as Gems, Coins, Player Items or Packs." },
      { q: 'How do I redeem an FC Mobile code?', a: 'Open the official EA redemption page, sign in with the EA Account linked to your FC Mobile game, enter the code and select Redeem. Successful rewards are delivered to your in-game inbox.' },
      { q: 'Why is my FC Mobile code not working?', a: 'Check that the code is entered exactly as shown, has not expired or reached its usage limit, and that you are signed in with the same EA Account that is linked to your FC Mobile game.' },
      { q: 'How often is this list updated?', a: 'This page syncs live. When a new code is added or an old one ends, it appears here within about a minute without you needing to refresh. Codes that pass their listed expiry date are marked expired automatically.' },
      { q: 'What does the region tag mean?', a: 'Each code shows the region it was announced for. Global codes are announced for all players; if a code is limited to a region, the tag tells you before you try it.' }
    ]
  },
  about: {
    title: 'About these FC Mobile redeem codes',
    p1: 'FCMOBILETOOLS tracks every FC Mobile redeem code in one searchable list, with the reward, the date it was added, its expiry and when it was last verified. Codes that pass their expiry date are marked expired automatically, so what you see under "Working codes" is what is still worth trying.',
    p2: "Rewards are claimed on EA's official redemption website, never here. We never ask for your EA login. If a code is rejected, it has most likely expired or reached its usage limit."
  },
  // Strings used by the client script (src/scripts/redeem-page.js).
  ui: {
    kinds: { gems: 'Gems', coins: 'Coins', rankup: 'Rank Up', shards: 'Shards', voucher: 'Draft Vouchers', player: 'Players', pack: 'Packs', kit: 'Cosmetics', other: 'Other' },
    status: { active: 'Active', scheduled: 'Upcoming', expired: 'Expired', unknown: 'Unknown', all: 'All' },
    allRewards: 'All rewards',
    age: { today: 'today', yesterday: 'yesterday', daysAgo: '{n} days ago' },
    expiry: {
      none: 'No expiry listed',
      ended: 'Ended {date}',
      lastDay: 'Last day — expires today',
      tomorrow: 'Expires tomorrow',
      inDays: 'Expires in {n} days',
      on: 'Expires {date}'
    },
    ticket: {
      brand: 'FC MOBILE REWARD',
      live: 'LIVE',
      newest: 'NEWEST CODE',
      latest: 'LATEST CODE',
      copyAria: 'Copy code {code}',
      added: 'Added',
      status: 'Status',
      tapToCopy: 'Tap to copy',
      waiting: 'WAITING',
      none: 'NO ACTIVE CODE',
      checkBack: 'Check back soon',
      idleNote: 'New codes land with events and updates. This page refreshes by itself the moment one goes live.'
    },
    card: {
      isNew: 'NEW',
      global: 'Global',
      verified: 'Verified {when}',
      copy: 'Copy code',
      redeem: 'Redeem'
    },
    empty: {
      title: 'No active codes right now',
      text: 'New codes usually arrive with events and updates. Leave this tab open — it refreshes on its own and shows a notice when one goes live.',
      mostRecent: ' The most recent code, <b>{code}</b>, has ended.',
      browse: 'Browse recent codes'
    },
    soon: { hiddenAria: 'Code hidden until release', drops: 'Drops {date}' },
    archive: {
      added: 'Added',
      redeem: 'Redeem',
      copyAria: 'Copy {code}',
      noMatchTitle: 'No codes match',
      noMatchText: 'Try a different word, or clear the filters to see every code.',
      reset: 'Reset filters',
      showing: 'Showing {shown} of {total}',
      filteredFrom: ' (filtered from {total})',
      showMore: 'Show {n} more'
    },
    sync: {
      offline: 'Offline — showing the last codes we loaded',
      justNow: 'Live · synced just now',
      seconds: 'Live · synced {n}s ago',
      minutes: 'Live · synced {n} min ago'
    },
    toast: {
      newCode: 'New code live: {code}',
      newMore: ' (+{n} more)',
      quest: 'Redeem Code Quest completed · +{n} Tokens',
      copied: '{code} copied',
      copyBlocked: 'Copy was blocked — select the code and copy it manually',
      redeemCopied: "{code} copied — paste it on the EA page if it isn't filled in",
      copiedButton: 'Copied'
    },
    error: {
      title: "Couldn't load the codes",
      text: "Check your connection and try again. You can also open EA's redemption page directly.",
      retry: 'Try again'
    }
  }
};
