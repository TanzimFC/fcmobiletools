// Bahasa Indonesia. Istilah game (Team OVR, PlayStyle, Rank Up, Gauntlet, Star Shards,
// Football Centre) tetap dalam bahasa Inggris, seperti di FC Mobile.
import redeem from './pages/redeem.id.js';
import consent from './pages/consent.id.js';
import investment from './pages/investment.id.js';
import shards from './pages/shards.id.js';
import push from './pages/push.id.js';

export default {
  redeem,
  consent,
  investment,
  shards,
  push,
  common: {
    skipToContent: 'Lewati ke konten',
    home: 'Beranda',
    homeMeta: 'Mulai dari sini',
    free: 'Gratis',
    mostPopular: 'Terpopuler',
    openPage: 'Buka halaman',
    more: 'Lainnya',
    update: 'Pembaruan',
    codes: 'Kode',
    events: 'Event',
    account: 'Akun',
    login: 'Masuk',
    myProfile: 'Profil Saya',
    myAccount: 'Akun Saya',
    accountProfile: 'Akun & Profil',
    accountMeta: 'Identitas, progres XP & komunitas',
    profileMeta: 'Profil, progres, dan hadiah',
    levelShort: 'Lv. {n}',
    levelLong: 'Level {n}',
    signInAria: 'Masuk ke akun FCMobiletools Anda',
    openProfileAria: 'Buka profil FCMobiletools Anda',
    homeAria: 'Beranda FCMobiletools',
    search: 'Cari halaman',
    searchPlaceholder: 'Cari alat, event, kode...',
    jumpAnywhere: 'Lompat ke mana saja',
    noMatches: 'Tidak ada hasil. Coba “kode”, “event” atau “pembaruan”.',
    primaryNav: 'Navigasi utama',
    quickNav: 'Navigasi cepat',
    siteMenu: 'Menu situs',
    openMenu: 'Buka menu',
    closeMenu: 'Tutup menu',
    accountMenu: {
      aria: 'Menu akun',
      signedInAs: 'Masuk sebagai',
      xp: 'XP',
      tokens: 'Tokens',
      streak: 'Streak',
      streakDays: '{n} hr',
      signOut: 'Keluar',
      profile: 'Profil', profileMeta: 'Kartu pemain Anda',
      quests: 'Misi', questsMeta: 'Harian dan mingguan',
      surveys: 'Survei', surveysMeta: 'Bagikan pendapat Anda',
      achievements: 'Pencapaian', achievementsMeta: 'Lencana dan tonggak',
      leaderboard: 'Papan Peringkat', leaderboardMeta: 'Pemain teratas',
      rewards: 'Hadiah', rewardsMeta: 'Klaim dan gunakan',
      settings: 'Pengaturan', settingsMeta: 'Akun dan privasi'
    },
    accountNav: {
      breadcrumb: 'Jejak navigasi',
      account: 'Akun',
      sections: 'Bagian akun',
      guestLead: 'Akun opsional · ',
      guestCta: 'Masuk atau gabung →'
    }
  },
  nav: {
    groups: { tools: 'Alat', live: 'Live', community: 'Komunitas' },
    update: { label: 'Pembaruan FC Mobile 27', meta: 'Musim 27 · 24 Sep', blurb: 'Perubahan Musim 27, panduan fitur, dan instalasi Android resmi.' },
    giveawaysSheetMeta: 'Menangkan hadiah. Terverifikasi dan aman',
    items: {
      'team-ovr': { label: 'Team OVR', meta: 'Rating skuad' },
      playstyle: { label: 'Panduan PlayStyle', meta: 'Kemampuan pemain' },
      'playstyle-finder': { label: 'Pencari PlayStyle', meta: 'Pencocokan cerdas berdasarkan peran' },
      training: { label: 'Kalkulator Training', meta: 'Perencana XP' },
      rank: { label: 'Kalkulator Rank Up', meta: 'Biaya rank' },
      investment: { label: 'Kalkulator Investasi', meta: 'Perencanaan pasar' },
      gauntlet: { label: 'Perencana Gauntlet', meta: 'Rotasi skuad' },
      shards: { label: 'Penghitung Shards', meta: 'Target Star Shards' },
      events: { label: 'Event', meta: 'Hitung mundur' },
      codes: { label: 'Kode Redeem', meta: 'Hadiah terbaru' },
      centre: { label: 'Football Centre', meta: 'Pusat live' },
      tracker: { label: 'Captain OVR Tracker', meta: 'Analisis Matchday 7' },
      trivia: { label: 'Trivia', meta: "Extra Time & A Nation's Story" },
      tournaments: { label: 'Turnamen', meta: 'Kompetisi komunitas' },
      leagues: { label: 'Cari Liga', meta: 'Temukan klub atau rekrut pemain' },
      giveaways: { label: 'Giveaway', meta: 'Menangkan hadiah. Gratis untuk ikut' },
      articles: { label: 'Artikel', meta: 'Berita, bocoran, panduan' }
    }
  },
  footer: {
    aria: { tools: 'Alat', live: 'Live', articles: 'Artikel', legal: 'Informasi dan legal' },
    brand: 'Alat FC Mobile, sumber daya live, kalkulator, dan panduan agar semua yang berguna ada di satu tempat.',
    note: 'Dibuat oleh penggemar • Tidak berafiliasi dengan EA SPORTS FC Mobile.',
    built: 'Dibuat untuk komunitas FC Mobile.',
    cols: { tools: 'ALAT', live: 'LIVE', articles: 'ARTIKEL', legal: 'INFO & LEGAL' },
    links: {
      triviaAnswers: 'Jawaban Trivia',
      allArticles: 'Semua artikel',
      updates: 'Pembaruan',
      leaks: 'Bocoran',
      guides: 'Panduan',
      analysis: 'Analisis',
      reviews: 'Ulasan',
      about: 'Tentang',
      changelog: 'Catatan perubahan',
      privacy: 'Privasi',
      terms: 'Ketentuan',
      disclaimer: 'Disklaimer',
      contact: 'Kontak',
      privacyChoices: 'Pilihan privasi',
      pushAlerts: 'Notifikasi push'
    }
  },
  switcher: {
    label: 'Bahasa',
    aria: 'Ganti bahasa',
    title: 'Pilih bahasa Anda',
    subtitle: 'Halaman tanpa terjemahan dibuka dalam bahasa Inggris.',
    englishOnly: 'Hanya Inggris',
    current: 'Bahasa saat ini'
  }
};
