// বাংলা। গেমের পরিভাষা (Team OVR, PlayStyle, Rank Up, Gauntlet, Star Shards, Football Centre)
// FC Mobile-এর মতোই ইংরেজিতে রাখা হয়েছে।
import redeem from './pages/redeem.bn.js';
import consent from './pages/consent.bn.js';
import investment from './pages/investment.bn.js';
import shards from './pages/shards.bn.js';

export default {
  redeem,
  consent,
  investment,
  shards,
  common: {
    skipToContent: 'মূল কনটেন্টে যান',
    home: 'হোম',
    homeMeta: 'এখান থেকে শুরু করুন',
    free: 'ফ্রি',
    mostPopular: 'সবচেয়ে জনপ্রিয়',
    openPage: 'পেজ খুলুন',
    more: 'আরও',
    update: 'আপডেট',
    codes: 'কোড',
    events: 'ইভেন্ট',
    account: 'অ্যাকাউন্ট',
    login: 'লগইন',
    myProfile: 'আমার প্রোফাইল',
    myAccount: 'আমার অ্যাকাউন্ট',
    accountProfile: 'অ্যাকাউন্ট ও প্রোফাইল',
    accountMeta: 'পরিচয়, XP অগ্রগতি ও কমিউনিটি',
    profileMeta: 'প্রোফাইল, অগ্রগতি ও পুরস্কার',
    levelShort: 'লেভেল {n}',
    levelLong: 'লেভেল {n}',
    signInAria: 'আপনার FCMobiletools অ্যাকাউন্টে সাইন ইন করুন',
    openProfileAria: 'আপনার FCMobiletools প্রোফাইল খুলুন',
    homeAria: 'FCMobiletools হোম',
    search: 'পেজ খুঁজুন',
    searchPlaceholder: 'টুল, ইভেন্ট, কোড খুঁজুন...',
    jumpAnywhere: 'যেকোনো জায়গায় যান',
    noMatches: 'কিছু পাওয়া যায়নি। “কোড”, “ইভেন্ট” বা “আপডেট” লিখে দেখুন।',
    primaryNav: 'প্রধান নেভিগেশন',
    quickNav: 'দ্রুত নেভিগেশন',
    siteMenu: 'সাইট মেনু',
    openMenu: 'মেনু খুলুন',
    closeMenu: 'মেনু বন্ধ করুন',
    accountMenu: {
      aria: 'অ্যাকাউন্ট মেনু',
      signedInAs: 'সাইন ইন করা আছে',
      xp: 'XP',
      tokens: 'Tokens',
      streak: 'স্ট্রিক',
      streakDays: '{n} দিন',
      signOut: 'সাইন আউট',
      profile: 'প্রোফাইল', profileMeta: 'আপনার প্লেয়ার কার্ড',
      quests: 'কোয়েস্ট', questsMeta: 'দৈনিক ও সাপ্তাহিক',
      surveys: 'সার্ভে', surveysMeta: 'আপনার মতামত জানান',
      achievements: 'অর্জন', achievementsMeta: 'ব্যাজ ও মাইলফলক',
      leaderboard: 'লিডারবোর্ড', leaderboardMeta: 'সেরা খেলোয়াড়',
      rewards: 'পুরস্কার', rewardsMeta: 'নিন ও খরচ করুন',
      settings: 'সেটিংস', settingsMeta: 'অ্যাকাউন্ট ও গোপনীয়তা'
    },
    accountNav: {
      breadcrumb: 'ব্রেডক্রাম্ব',
      account: 'অ্যাকাউন্ট',
      sections: 'অ্যাকাউন্টের বিভাগ',
      guestLead: 'ঐচ্ছিক অ্যাকাউন্ট · ',
      guestCta: 'সাইন ইন করুন বা যোগ দিন →'
    }
  },
  nav: {
    groups: { tools: 'টুলস', live: 'লাইভ', community: 'কমিউনিটি' },
    update: { label: 'FC Mobile 27 আপডেট', meta: 'সিজন ২৭ · ২৪ সেপ্টেম্বর', blurb: 'সিজন ২৭-এর পরিবর্তন, ফিচার গাইড এবং অফিসিয়াল অ্যান্ড্রয়েড ইনস্টল।' },
    giveawaysSheetMeta: 'পুরস্কার জিতুন। যাচাইকৃত ও নিরাপদ',
    items: {
      'team-ovr': { label: 'Team OVR', meta: 'স্কোয়াডের রেটিং' },
      playstyle: { label: 'PlayStyle গাইড', meta: 'খেলোয়াড়ের দক্ষতা' },
      'playstyle-finder': { label: 'PlayStyle ফাইন্ডার', meta: 'পজিশন অনুযায়ী স্মার্ট বাছাই' },
      training: { label: 'ট্রেনিং ক্যালকুলেটর', meta: 'XP পরিকল্পনা' },
      rank: { label: 'Rank Up ক্যালকুলেটর', meta: 'র‍্যাঙ্কের খরচ' },
      investment: { label: 'ইনভেস্টমেন্ট ক্যালকুলেটর', meta: 'মার্কেট পরিকল্পনা' },
      gauntlet: { label: 'Gauntlet প্ল্যানার', meta: 'স্কোয়াড রোটেশন' },
      shards: { label: 'Shards কাউন্টার', meta: 'Star Shards লক্ষ্য' },
      events: { label: 'ইভেন্ট', meta: 'কাউন্টডাউন' },
      codes: { label: 'রিডিম কোড', meta: 'সর্বশেষ পুরস্কার' },
      centre: { label: 'Football Centre', meta: 'লাইভ হাব' },
      tracker: { label: 'Captain OVR Tracker', meta: 'Matchday 7 বিশ্লেষণ' },
      trivia: { label: 'ট্রিভিয়া', meta: "Extra Time ও A Nation's Story" },
      tournaments: { label: 'টুর্নামেন্ট', meta: 'কমিউনিটি প্রতিযোগিতা' },
      leagues: { label: 'লিগ খুঁজুন', meta: 'আপনার ক্লাব খুঁজুন বা খেলোয়াড় নিন' },
      giveaways: { label: 'গিভঅ্যাওয়ে', meta: 'পুরস্কার জিতুন। অংশগ্রহণ বিনামূল্যে' },
      articles: { label: 'আর্টিকেল', meta: 'খবর, লিক, গাইড' }
    }
  },
  footer: {
    aria: { tools: 'টুলস', live: 'লাইভ', articles: 'আর্টিকেল', legal: 'তথ্য ও আইনি তথ্য' },
    brand: 'FC Mobile-এর টুল, লাইভ তথ্য, ক্যালকুলেটর ও গাইড, সবকিছু এক জায়গায়।',
    note: 'ফ্যানদের তৈরি • EA SPORTS FC Mobile-এর সঙ্গে কোনো সম্পর্ক নেই।',
    built: 'FC Mobile কমিউনিটির জন্য তৈরি।',
    cols: { tools: 'টুলস', live: 'লাইভ', articles: 'আর্টিকেল', legal: 'তথ্য ও আইনি' },
    links: {
      triviaAnswers: 'ট্রিভিয়ার উত্তর',
      allArticles: 'সব আর্টিকেল',
      updates: 'আপডেট',
      leaks: 'লিক',
      guides: 'গাইড',
      analysis: 'বিশ্লেষণ',
      reviews: 'রিভিউ',
      about: 'পরিচিতি',
      privacy: 'গোপনীয়তা',
      terms: 'শর্তাবলি',
      disclaimer: 'দাবিত্যাগ',
      contact: 'যোগাযোগ',
      privacyChoices: 'গোপনীয়তার পছন্দ',
      pushAlerts: 'পুশ অ্যালার্ট'
    }
  },
  switcher: {
    label: 'ভাষা',
    aria: 'ভাষা পরিবর্তন করুন',
    title: 'আপনার ভাষা বেছে নিন',
    subtitle: 'অনুবাদ না থাকা পেজ ইংরেজিতে খুলবে।',
    englishOnly: 'শুধু ইংরেজি',
    current: 'বর্তমান ভাষা'
  }
};
