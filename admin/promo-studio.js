// FCMobiletools Promo Studio
// Masked redeem code banners, premium promo images and ready to paste captions.
// 100% client side (canvas). No server code, so it runs as a plain static asset on Cloudflare Workers.
const SITE = 'fcmobiletools.online', HOME = 'https://fcmobiletools.online/', CODES = 'https://fcmobiletools.online/redeem-codes/';
const EA = 'https://redeem.fcm.ea.com/', DC = 'discord.gg/nRzsqCurUb', XH = 'x.com/TanzimFC', YT = 'youtube.com/@tanzimfc';
const FD = 'Sora,"Space Grotesk",system-ui,sans-serif', FB = 'Manrope,Inter,system-ui,sans-serif', FMONO = '"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace';
const LG = { x: 190, y: 240, w: 1385, h: 350 }; // crop of /assets/images/logo.png
const TH = {
  cyan: { n: 'Cyan', a: '#4cc9ff', b: '#bff0ff', c: '#1f6bff', bg: ['#040b16', '#0b2545', '#050e1a'], h: 0 },
  gold: { n: 'Gold', a: '#f6c453', b: '#fff0c2', c: '#ff9a2e', bg: ['#0a0806', '#2b1d08', '#0b0805'], h: -165 },
  violet: { n: 'Violet', a: '#a98bff', b: '#e4dbff', c: '#5b6cff', bg: ['#06051a', '#1c1145', '#09071a'], h: 60 },
  emerald: { n: 'Emerald', a: '#3ee6a0', b: '#c4ffe6', c: '#12b886', bg: ['#03110e', '#08382c', '#04140f'], h: -50 }
};
const FM = {
  sq: { n: 'Square', w: 1080, h: 1080, s: 1, al: 'c', pad: 72, lg: 96 },
  ls: { n: 'Landscape', w: 1600, h: 900, s: .92, al: 'l', pad: 80, lg: 96, cw: .6 },
  st: { n: 'Story', w: 1080, h: 1920, s: 1.3, al: 'c', pad: 80, lg: 120 },
  wd: { n: 'Wide', w: 1500, h: 500, s: .56, al: 'l', pad: 52, lg: 66, cw: .62, wd: 1 },
  og: { n: 'Social card', w: 1200, h: 630, s: .8, al: 'l', pad: 60, lg: 78, cw: .62 }
};
const TPL = {
  brand: { n: 'Brand', bd: 'ALL IN ONE', ey: 'FC MOBILE COMPANION HUB', h: 'Everything FC Mobile. One place.', s: 'Live events, redeem codes, calculators, planners and guides.', ch: ['Redeem Codes', 'Events & Resets', 'Team OVR', 'Training Calculator', 'Rank Up Calculator', 'Shards Counter'], cta: 'VISIT FCMOBILETOOLS.ONLINE', url: HOME, obj: 'gem' },
  codes: { n: 'Redeem codes', bd: 'REDEEM CODES', ey: 'FREE REWARDS', h: 'Fresh FC Mobile redeem codes', s: 'Active and upcoming codes with rewards and expiry dates in one list.', ch: ['Active codes', 'Rewards', 'Expiry dates', 'One tap copy'], cta: 'SEE THE CODES', url: CODES, obj: 'ticket' },
  tools: { n: 'All tools', bd: 'FREE TOOLS', ey: 'CALCULATORS AND PLANNERS', h: 'Plan smarter. Upgrade faster.', s: 'Free tools built for FC Mobile players.', ch: ['Team OVR', 'Training', 'Rank Up', 'Investment', 'Gauntlet Planner', 'Shards Counter'], cta: 'OPEN THE TOOLS', url: HOME, obj: 'shield' },
  teamovr: { n: 'Team OVR', bd: 'TEAM OVR', ey: 'SQUAD CHECK', h: 'Check your Team OVR', s: 'Build your squad and see your rating.', ch: ['Squad rating', 'Free tool', 'Mobile friendly'], cta: 'OPEN TEAM OVR', url: HOME + 'team-ovr/', obj: 'shield' },
  training: { n: 'Training calculator', bd: 'TRAINING', ey: 'PLAYER TRAINING', h: 'Training made simple', s: 'Plan your player training before you spend.', ch: ['Training', 'Planner', 'Free tool'], cta: 'OPEN THE CALCULATOR', url: HOME + 'training-calculator/', obj: 'coin' },
  rankup: { n: 'Rank Up calculator', bd: 'RANK UP', ey: 'LEVEL PLANNER', h: 'Plan your Rank Up', s: 'Work out what you need for the next level.', ch: ['Rank Up', 'Points planner', 'Free tool'], cta: 'OPEN THE CALCULATOR', url: HOME + 'rank-up-calculator/', obj: 'gem' },
  invest: { n: 'Investment calculator', bd: 'INVESTMENT', ey: 'COIN PLANNER', h: 'Invest smarter', s: 'Plan your coin moves before you buy.', ch: ['Investment', 'Coin planner', 'Free tool'], cta: 'OPEN THE CALCULATOR', url: HOME + 'investment-calculator/', obj: 'coin' },
  gauntlet: { n: 'Gauntlet planner', bd: 'GAUNTLET', ey: 'RUN PLANNER', h: 'Plan your Gauntlet', s: 'Map out your run before you start.', ch: ['Gauntlet', 'Planner', 'Free tool'], cta: 'OPEN THE PLANNER', url: HOME + 'gauntlet-planner/', obj: 'trophy' },
  shards: { n: 'Shards counter', bd: 'SHARDS', ey: 'PROGRESS TRACKER', h: 'Count your shards', s: 'Track your shard progress in one place.', ch: ['Shards', 'Tracker', 'Free tool'], cta: 'OPEN THE COUNTER', url: HOME + 'shards-counter/', obj: 'gem' },
  events: { n: 'Events and resets', bd: 'LIVE EVENTS', ey: 'EVENTS AND RESETS', h: 'Never miss an event', s: 'Live event dates and reset countdowns.', ch: ['Live events', 'Reset timers', 'Countdowns'], cta: 'SEE THE EVENTS', url: HOME + 'events/', obj: 'ticket' },
  centre: { n: 'Football Centre', bd: 'FOOTBALL CENTRE', ey: 'SHOWDOWN TRACKER', h: 'Football Centre guide', s: 'Track your progress and plan your picks.', ch: ['Showdowns', 'Points', 'Planning'], cta: 'OPEN FOOTBALL CENTRE', url: HOME + 'football-centre/', obj: 'trophy' },
  captain: { n: 'Captain tracker', bd: 'CAPTAIN OVR', ey: 'WEEKLY TRACKER', h: 'Captain OVR Tracker', s: 'Follow captain ratings week by week.', ch: ['Captains', 'Weekly OVR', 'Tracker'], cta: 'OPEN THE TRACKER', url: HOME + 'captain-tracker/', obj: 'shield' },
  trivia: { n: 'Trivia answers', bd: 'TRIVIA', ey: 'ANSWERS AND PRACTICE', h: 'Trivia answers, fast', s: 'Search answers and practice before you play.', ch: ['Answers', 'Practice', 'Search'], cta: 'OPEN TRIVIA', url: HOME + 'trivia/', obj: 'key' },
  giveaways: { n: 'Giveaways', bd: 'GIVEAWAYS', ey: 'COMMUNITY REWARDS', h: 'Join the giveaways', s: 'Read the rules and enter in a few taps.', ch: ['Giveaways', 'Rules', 'Safe entry'], cta: 'SEE THE GIVEAWAYS', url: HOME + 'giveaways/', obj: 'gift' },
  blog: { n: 'News and guides', bd: 'NEWS', ey: 'UPDATES, LEAKS AND GUIDES', h: 'News, leaks and guides', s: 'Read the latest FC Mobile updates and analysis.', ch: ['Updates', 'Leaks', 'Guides', 'Analysis'], cta: 'READ THE ARTICLES', url: HOME + 'blog/', obj: 'key' },
  fc27: { n: 'FC Mobile 27', bd: 'SEASON 27', ey: 'FC MOBILE 27 HUB', h: 'Your FC Mobile 27 hub', s: 'Update details, guides and events for the new season.', ch: ['Update details', 'Guides', 'Events'], cta: 'OPEN THE HUB', url: HOME + 'fc-mobile-27/', obj: 'gem' },
  leagues: { n: 'Leagues and tournaments', bd: 'COMPETE', ey: 'LEAGUES AND TOURNAMENTS', h: 'Host or join a tournament', s: 'Community leagues, brackets and standings.', ch: ['Leagues', 'Tournaments', 'Brackets'], cta: 'SEE THE LEAGUES', url: HOME + 'leagues/', obj: 'trophy' },
  rewards: { n: 'Rewards and missions', bd: 'REWARDS', ey: 'MISSIONS AND ACHIEVEMENTS', h: 'Earn rewards as you play', s: 'Missions, achievements and a leaderboard.', ch: ['Missions', 'Achievements', 'Rewards', 'Leaderboard'], cta: 'OPEN REWARDS', url: HOME + 'rewards/', obj: 'coin' },
  join: { n: 'Community', bd: 'JOIN US', ey: 'JOIN THE COMMUNITY', h: 'Never miss a code drop', s: 'Follow for new codes, events and guides.', ch: ['Discord', 'X', 'YouTube'], cta: 'JOIN THE DISCORD', url: 'https://' + DC, obj: 'gift' },
  daily: { n: 'Daily codes update', bd: 'TODAY', ey: 'DAILY UPDATE', h: 'New FC Mobile codes today', s: 'Check the full list of active codes and rewards.', ch: ['Active codes', 'New today', 'Copy fast'], cta: 'SEE TODAY CODES', url: CODES, obj: 'ticket' },
  eventlive: { n: 'Event is live', bd: 'LIVE NOW', ey: 'NEW EVENT', h: 'A new event is live', s: 'Check the dates, rewards and tips.', ch: ['Live now', 'Rewards', 'Guide'], cta: 'SEE THE EVENT', url: HOME + 'events/', obj: 'trophy' },
  eventend: { n: 'Event ending soon', bd: 'ENDING SOON', ey: 'LAST CHANCE', h: 'Ending soon. Do not miss it', s: 'Finish your tasks before the timer ends.', ch: ['Last chance', 'Check the timer'], cta: 'SEE THE TIMER', url: HOME + 'events/', obj: 'shield' },
  reset: { n: 'Weekly reset', bd: 'RESET', ey: 'WEEKLY RESET', h: 'Weekly reset is here', s: 'See what changed and plan your week.', ch: ['Reset', 'What is new', 'Plan ahead'], cta: 'SEE THE DETAILS', url: HOME + 'events/', obj: 'coin' },
  newpost: { n: 'New article', bd: 'NEW POST', ey: 'FRESH ON THE BLOG', h: 'A new article is up', s: 'Read the full breakdown on the site.', ch: ['Guide', 'News', 'Analysis'], cta: 'READ IT NOW', url: HOME + 'blog/', obj: 'key' },
  newtool: { n: 'New tool', bd: 'NEW TOOL', ey: 'JUST LAUNCHED', h: 'A new tool just dropped', s: 'Try it free on FCMobiletools.', ch: ['New tool', 'Free', 'Mobile friendly'], cta: 'TRY IT NOW', url: HOME, obj: 'gem' },
  update: { n: 'Site update notes', bd: 'UPDATE', ey: 'WHAT IS NEW', h: 'Update notes are live', s: 'Here is what is new and what changed.', ch: ['What is new', 'Fixes', 'Improvements'], cta: 'READ THE NOTES', url: HOME + 'blog/', obj: 'shield' },
  giveaway: { n: 'Giveaway announcement', bd: 'GIVEAWAY', ey: 'NOW OPEN', h: 'A new giveaway is open', s: 'Read the rules and enter before it closes.', ch: ['How to enter', 'Rules', 'Ends soon'], cta: 'ENTER NOW', url: HOME + 'giveaways/', obj: 'gift' },
  winners: { n: 'Giveaway winners', bd: 'WINNERS', ey: 'CONGRATULATIONS', h: 'Giveaway winners are in', s: 'Congratulations to everyone who won. Check your name.', ch: ['Winners', 'Congrats', 'Thank you'], cta: 'SEE THE WINNERS', url: HOME + 'giveaways/', obj: 'trophy' },
  tournament: { n: 'Tournament sign ups', bd: 'SIGN UPS', ey: 'TOURNAMENT', h: 'Tournament sign ups are open', s: 'Join now and check the brackets.', ch: ['Sign up', 'Brackets', 'Rules'], cta: 'JOIN NOW', url: HOME + 'leagues/', obj: 'trophy' },
  expired: { n: 'Code expired notice', bd: 'EXPIRED', ey: 'CODE UPDATE', h: 'This code has expired', s: 'Check the site for fresh active codes.', ch: ['Expired', 'See new codes'], cta: 'SEE ACTIVE CODES', url: CODES, obj: 'ticket' },
  notice: { n: 'Maintenance notice', bd: 'NOTICE', ey: 'SHORT NOTICE', h: 'Short maintenance today', s: 'Some pages may be slow for a short time. Thanks for waiting.', ch: ['Maintenance', 'Back soon'], cta: 'VISIT THE SITE', url: HOME, obj: 'shield' },
  thanks: { n: 'Thank you milestone', bd: 'THANK YOU', ey: 'COMMUNITY', h: 'Thank you for the support', s: 'We could not do it without this community.', ch: ['Community', 'Thank you'], cta: 'JOIN THE COMMUNITY', url: 'https://' + DC, obj: 'trophy' },
  question: { n: 'Community question', bd: 'POLL', ey: 'YOUR VOICE', h: 'What do you think?', s: 'Tell us in the comments or on Discord.', ch: ['Comment', 'Share', 'Vote'], cta: 'JOIN THE TALK', url: 'https://' + DC, obj: 'gem' },
  reminder: { n: 'Daily reminder', bd: 'REMINDER', ey: 'QUICK REMINDER', h: 'Do not forget your daily tasks', s: 'A quick reminder to claim your rewards today.', ch: ['Daily tasks', 'Rewards', 'Check in'], cta: 'OPEN THE SITE', url: HOME, obj: 'coin' },
  triviatoday: { n: 'Trivia answers today', bd: 'TRIVIA', ey: 'TODAY', h: 'Trivia answers for today', s: 'Fresh answers and practice in one place.', ch: ['Answers', 'Practice', 'Search'], cta: 'OPEN TRIVIA', url: HOME + 'trivia/', obj: 'key' },
  breaking: { n: 'Breaking news', bd: 'BREAKING', ey: 'BREAKING', h: 'Breaking FC Mobile news', s: 'Read the latest details on the site.', ch: ['News', 'Leaks', 'Details'], cta: 'READ THE NEWS', url: HOME + 'blog/', obj: 'gem' }
};
const REG = ['daily', 'eventlive', 'eventend', 'reset', 'newpost', 'newtool', 'update', 'giveaway', 'winners', 'tournament', 'expired', 'notice', 'thanks', 'question', 'reminder', 'triviatoday', 'breaking'];
const chipsOf = (S, tp) => S.chips != null ? S.chips.split(',').map(x => clean(x)).filter(Boolean).slice(0, 8) : tp.ch;
const REV = [['0,0', 'Hide all'], ['2,0', 'Show first 2'], ['2,1', 'First 2 + last 1'], ['3,2', 'First 3 + last 2'], ['full', 'Show full code']];
const PL = [['x', 'X'], ['fb', 'Facebook'], ['wa', 'WhatsApp'], ['dc', 'Discord'], ['yt', 'YouTube']];

/* ---------- helpers ---------- */
const R = {}; let loading = null;
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
const loadAll = () => loading || (loading = Promise.all([
  loadImg('/assets/images/logo.png'), loadImg('/assets/images/hero-home.webp'), loadImg('/assets/images/hero-striker.webp'),
  document.fonts ? Promise.all(['800 40px Sora', '700 20px Manrope', '600 20px Manrope', '700 40px "IBM Plex Mono"'].map(f => document.fonts.load(f).catch(() => 0))) : 0
]).then(([l, s, k]) => { R.logo = l; R.stadium = s; R.striker = k; }));
const al = (h, a) => h + Math.round(a * 255).toString(16).padStart(2, '0');
const rng = seed => { let x = 0; for (const ch of String(seed)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296; };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const clean = s => String(s || '').replace(/\s*[—–]\s*/g, ', ').trim();
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
function maskCode(code, rev) {
  if (rev === 'full') return code;
  let [a, b] = rev.split(',').map(Number); const n = code.length, min = Math.ceil(n / 2);
  while (n - a - b < min && (a || b)) { if (b > 0 && b >= a) b--; else a--; }
  return code.slice(0, a) + '•'.repeat(Math.max(0, n - a - b)) + (b ? code.slice(n - b) : '');
}
function T(c, s, x, y, z, col, o = {}) {
  let sz = z; const w = o.w || 700, f = o.f || FD, set = () => { c.font = `${w} ${sz}px ${f}`; };
  c.letterSpacing = (o.ls || 0) + 'px'; set();
  if (o.max) while (c.measureText(s).width > o.max && sz > 9) { sz -= 2; set(); }
  c.fillStyle = col; c.textAlign = o.al || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y);
}
function wrap(c, s, max) {
  const L = []; let l = '';
  for (const w of s.split(' ')) { const t = l ? l + ' ' + w : w; if (c.measureText(t).width > max && l) { L.push(l); l = w; } else l = t; }
  if (l) L.push(l); return L;
}
function pill(c, x, y, h, s, z, o) {
  c.letterSpacing = (o.ls || 0) + 'px'; c.font = `${o.w || 700} ${z}px ${o.f || FB}`;
  const w = c.measureText(s).width + h * .9, px = o.al === 'c' ? x - w / 2 : o.al === 'r' ? x - w : x;
  rr(c, px, y - h / 2, w, h, h / 2);
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = h * .8; }
  if (o.fill) { c.fillStyle = typeof o.fill === 'function' ? o.fill(px, w) : o.fill; c.fill(); }
  c.shadowBlur = 0;
  if (o.st) { c.strokeStyle = o.st; c.lineWidth = o.lw || 2; c.stroke(); }
  c.fillStyle = o.col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, px + w / 2, y + z * .04);
  return w;
}
function flow(c, a, x, y, max, h, z, al_, o, draw) {
  c.letterSpacing = '0px'; c.font = `700 ${z}px ${FB}`;
  const g = h * .32, ws = a.map(s => c.measureText(s).width + h * .9), rows = []; let r = [], rw = 0;
  ws.forEach((w, i) => { if (r.length && rw + g + w > max) { rows.push([r, rw]); r = []; rw = 0; } rw += (r.length ? g : 0) + w; r.push(i); });
  if (r.length) rows.push([r, rw]);
  if (draw) rows.forEach(([ids, w], ri) => { let px = al_ === 'center' ? x - w / 2 : x; ids.forEach(i => { pill(c, px, y + ri * (h + g) + h / 2, h, a[i], z, { ...o, al: 'l' }); px += ws[i] + g; }); });
  return rows.length * (h + g) - g;
}
function lock(c, x, y, k, col) {
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 5 * k;
  c.beginPath(); c.arc(x, y - 5 * k, 11 * k, Math.PI, 0); c.stroke();
  rr(c, x - 17 * k, y - 5 * k, 34 * k, 28 * k, 6 * k); c.fill(); c.restore();
}

/* ---------- drawn objects (gem, coin, trophy, shield, gift, ticket, key) ---------- */
const OC = {};
const mkC = (w, h) => globalThis.__fcCanvas ? globalThis.__fcCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
const mix = (a, b, f) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - f) + parseInt(b.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
const objFor = r => /gem|shard/i.test(r) ? 'gem' : /coin/i.test(r) ? 'coin' : /voucher|ticket/i.test(r) ? 'ticket' : /player|icon|ovr/i.test(r) ? 'trophy' : 'gift';
function makeObj(kind, t) {
  const key = kind + t.a; if (OC[key]) return OC[key];
  const N = 800, e = mkC(N, N), c = e.getContext('2d'); c.translate(N / 2, N / 2); c.scale(.8, .8);
  const lg = (y0, y1, st) => { const g = c.createLinearGradient(0, y0, 0, y1); st.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
  const metal = (y0, y1) => lg(y0, y1, [[0, t.b], [.5, t.a], [1, t.c]]);
  const poly = (pts, fill, line = 'rgba(255,255,255,.6)') => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = line; c.lineWidth = 3; c.stroke(); };
  const star = (x, y, r, fill) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r; p.push([x + Math.cos(a) * q, y + Math.sin(a) * q]); } poly(p, fill, 'rgba(255,255,255,.7)'); };
  const spark = (x, y, r) => { c.save(); c.shadowBlur = 20; c.shadowColor = '#fff'; c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill(); c.restore(); };
  const shield = () => { c.beginPath(); c.moveTo(0, -270); c.lineTo(210, -195); c.lineTo(210, 20); c.bezierCurveTo(210, 170, 105, 235, 0, 280); c.bezierCurveTo(-105, 235, -210, 170, -210, 20); c.lineTo(-210, -195); c.closePath(); };
  c.shadowColor = al(t.a, .85); c.shadowBlur = 50;
  if (kind === 'gem') {
    const A = [-250, -110], B = [-140, -230], C = [140, -230], D = [250, -110], E = [-95, -110], F = [95, -110], P = [0, 270];
    poly([B, C, F, E], mix(t.b, '#ffffff', .35)); poly([A, B, E], mix(t.b, t.a, .3)); poly([C, D, F], mix(t.a, t.b, .25));
    poly([A, E, P], t.a); poly([E, F, P], mix(t.b, t.a, .5)); poly([F, D, P], t.c); spark(-80, -170, 30); spark(150, -60, 20);
  } else if (kind === 'coin') {
    c.beginPath(); c.arc(0, 0, 250, 0, 7); c.fillStyle = metal(-250, 250); c.fill(); c.shadowBlur = 0;
    c.beginPath(); c.arc(0, 0, 208, 0, 7); c.fillStyle = lg(-208, 208, [[0, t.c], [1, t.b]]); c.fill();
    c.beginPath(); c.arc(0, 0, 188, 0, 7); c.fillStyle = lg(-188, 188, [[0, mix(t.a, '#ffffff', .35)], [1, t.a]]); c.fill();
    for (let i = 0; i < 48; i++) { c.save(); c.rotate(i * Math.PI / 24); c.fillStyle = al(t.c, .7); c.fillRect(-4, -238, 8, 20); c.restore(); }
    star(0, 0, 120, mix(t.b, '#ffffff', .5)); spark(-120, -140, 26);
  } else if (kind === 'trophy') {
    c.lineWidth = 30; c.strokeStyle = metal(-300, 0); c.beginPath(); c.arc(-175, -150, 72, Math.PI / 2, Math.PI * 1.5); c.stroke(); c.beginPath(); c.arc(175, -150, 72, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.beginPath(); c.moveTo(-175, -250); c.lineTo(175, -250); c.bezierCurveTo(175, -50, 115, 40, 42, 62); c.lineTo(-42, 62); c.bezierCurveTo(-115, 40, -175, -50, -175, -250); c.closePath(); c.fillStyle = metal(-250, 70); c.fill();
    c.fillStyle = lg(60, 160, [[0, t.a], [1, t.c]]); c.fillRect(-34, 60, 68, 100);
    c.beginPath(); c.roundRect(-150, 160, 300, 44, 14); c.fillStyle = metal(160, 205); c.fill(); c.beginPath(); c.roundRect(-190, 204, 380, 50, 14); c.fillStyle = lg(204, 254, [[0, t.a], [1, t.c]]); c.fill();
    star(0, -120, 80, mix(t.b, '#ffffff', .6)); spark(-110, -200, 24);
  } else if (kind === 'shield') {
    shield(); c.fillStyle = metal(-270, 280); c.fill(); c.save(); c.shadowBlur = 0; c.scale(.82, .82); shield(); c.fillStyle = lg(-270, 280, [[0, mix(t.c, '#000000', .35)], [1, mix(t.c, '#000000', .65)]]); c.fill(); c.restore();
    star(0, -5, 125, mix(t.b, '#ffffff', .5)); spark(-120, -150, 24);
  } else if (kind === 'gift') {
    c.beginPath(); c.roundRect(-190, -10, 380, 250, 18); c.fillStyle = lg(-10, 240, [[0, t.a], [1, t.c]]); c.fill();
    c.beginPath(); c.roundRect(-225, -95, 450, 95, 16); c.fillStyle = lg(-95, 0, [[0, t.b], [1, t.a]]); c.fill();
    c.fillStyle = mix(t.b, '#ffffff', .8); c.fillRect(-34, -95, 68, 335);
    for (const [x, r] of [[-78, -.45], [78, .45]]) { c.beginPath(); c.ellipse(x, -140, 80, 48, r, 0, 7); c.fillStyle = mix(t.b, '#ffffff', .6); c.fill(); c.strokeStyle = al(t.c, .8); c.lineWidth = 6; c.stroke(); }
    c.beginPath(); c.arc(0, -125, 36, 0, 7); c.fillStyle = '#fff'; c.fill(); spark(-150, 60, 22);
  } else if (kind === 'ticket') {
    c.beginPath(); c.roundRect(-310, -175, 620, 350, 30); c.fillStyle = lg(-175, 175, [[0, t.b], [.5, t.a], [1, t.c]]); c.fill();
    c.save(); c.globalCompositeOperation = 'destination-out'; for (const x of [-310, 310]) { c.beginPath(); c.arc(x, 0, 46, 0, 7); c.fill(); } c.restore();
    c.shadowBlur = 0; c.strokeStyle = 'rgba(4,18,27,.45)'; c.lineWidth = 5; c.setLineDash([14, 12]); c.beginPath(); c.moveTo(140, -135); c.lineTo(140, 135); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#04121b'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 110px ${FD}`; c.letterSpacing = '6px'; c.fillText('CODE', -80, 8);
    star(225, 0, 52, '#04121b'); spark(-250, -120, 20);
  } else {
    c.rotate(-.6); c.lineWidth = 54; c.strokeStyle = metal(-130, 130); c.beginPath(); c.arc(-170, 0, 100, 0, 7); c.stroke();
    c.beginPath(); c.roundRect(-70, -27, 400, 54, 12); c.fillStyle = metal(-27, 27); c.fill();
    for (const [x, h] of [[210, 80], [275, 55]]) { c.beginPath(); c.roundRect(x, 20, 46, h, 8); c.fillStyle = lg(20, 100, [[0, t.a], [1, t.c]]); c.fill(); }
    spark(-230, -90, 22);
  }
  return (OC[key] = e);
}

/* ---------- background scenes ---------- */
function cover(c, im, W, H, a, h) {
  const s = Math.max(W / im.width, H / im.height), w = im.width * s, hh = im.height * s;
  c.save(); c.globalAlpha = a; if (h && 'filter' in c) c.filter = `hue-rotate(${h}deg)`;
  c.drawImage(im, (W - w) * .78, (H - hh) / 2, w, hh); c.restore();
}
function background(c, W, H, t, sc, seed, F, art) {
  let g = c.createLinearGradient(0, 0, W * .5, H); g.addColorStop(0, t.bg[0]); g.addColorStop(.5, t.bg[1]); g.addColorStop(1, t.bg[2]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (sc === 'stadium' && R.stadium) {
    cover(c, R.stadium, W, H, .9, t.h);
    g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, al(t.bg[0], .55)); g.addColorStop(.5, al(t.bg[0], .72)); g.addColorStop(1, al(t.bg[0], .95));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (F.al === 'l') { g = c.createLinearGradient(0, 0, W * .75, 0); g.addColorStop(0, al(t.bg[0], .85)); g.addColorStop(1, al(t.bg[0], 0)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  }
  for (const [x, y, r, col, a] of [[.1, 0, .7, t.a, .24], [.95, 1, .65, t.c, .26]]) {
    g = c.createRadialGradient(W * x, H * y, 0, W * x, H * y, Math.max(W, H) * r); g.addColorStop(0, al(col, a)); g.addColorStop(1, al(col, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  for (const [x, w, a] of [[.1, .12, .2], [.38, .07, .12], [.66, .15, .16]]) {
    g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, al(t.b, a)); g.addColorStop(1, al(t.a, 0)); c.fillStyle = g;
    const x0 = W * x, bw = W * w; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + bw, 0); c.lineTo(x0 + bw + H * .55, H); c.lineTo(x0 + H * .55 - bw * .4, H); c.fill();
  }
  if (sc === 'pitch') {
    c.save(); c.strokeStyle = t.a; c.fillStyle = t.a; c.globalAlpha = .17; c.lineWidth = 3;
    const cx = W * .72, cy = H * .56, r = Math.min(W, H) * .22;
    c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke(); c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, H); c.stroke();
    c.beginPath(); c.arc(cx, cy, 7, 0, 7); c.fill(); c.strokeRect(W - r * 1.5, cy - r * 1.1, r * 1.5 + 20, r * 2.2); c.strokeRect(-20, cy - r * 1.1, r * 1.5, r * 2.2);
    c.globalAlpha = .035; c.fillStyle = '#fff'; for (let i = 0; i < 12; i += 2) c.fillRect(W / 12 * i, 0, W / 12, H); c.restore();
  }
  c.fillStyle = 'rgba(255,255,255,.07)';
  for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) { c.beginPath(); c.arc(x, y, 1.1, 0, 7); c.fill(); }
  const rd = rng(seed); c.fillStyle = t.b;
  for (let i = 0; i < 70; i++) { c.globalAlpha = .12 + rd() * .5; c.beginPath(); c.arc(rd() * W, rd() * H, .8 + rd() * 2.4, 0, 7); c.fill(); }
  c.globalAlpha = 1;
  const im = sc === 'striker' ? R.striker : sc === 'object' ? art : null;
  if (im) {
    const ar = im.width / im.height, wide = F.al === 'l', obj = sc === 'object', h = H * (wide ? (obj ? .74 : .8) : .62), w = h * ar;
    c.save(); c.globalAlpha = wide ? 1 : .55; c.shadowColor = t.a; c.shadowBlur = 60; if (!obj && t.h && 'filter' in c) c.filter = `hue-rotate(${t.h}deg)`;
    c.drawImage(im, W - w * (wide ? (obj ? .95 : .98) : .78), wide ? (H - h) / 2 - 24 : H * .1, w, h); c.restore();
    if (!wide) { g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, al(t.bg[0], 0)); g.addColorStop(.45, al(t.bg[0], .55)); g.addColorStop(1, al(t.bg[0], .9)); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  }
  g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .78); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, al(t.a, .8)); g.addColorStop(.5, al(t.c, .12)); g.addColorStop(1, al(t.a, .5));
  c.strokeStyle = g; c.lineWidth = 3; rr(c, 16, 16, W - 32, H - 32, 30); c.stroke();
}

/* ---------- banner renderer ---------- */
function render(cv, S, fk) {
  const F = FM[fk], W = F.w, H = F.h, c = cv.getContext('2d'), t = TH[S.th], P = F.pad, s = F.s, center = F.al === 'c';
  cv.width = W; cv.height = H;
  const code = S.mode === 'code', tp = TPL[S.tpl], mk = maskCode(S.code || 'YOURCODE', S.rev);
  const art = S.sc === 'object' ? makeObj(S.obj || (code ? objFor(S.reward) : tp.obj), t) : null;
  background(c, W, H, t, S.sc, S.mode + S.code + S.tpl, F, art);
  const ax = center ? W / 2 : P, al_ = center ? 'center' : 'left', cw = center ? W - 2 * P : W * F.cw - P;
  // header
  const lh = F.lg, lw = lh * LG.w / LG.h;
  if (R.logo) c.drawImage(R.logo, LG.x, LG.y, LG.w, LG.h, P - 6, P - 4, lw, lh);
  pill(c, W - P, P + lh / 2 - 4, 48 * s, '● ' + (code ? 'NEW CODE LIVE' : tp.bd), 19 * s, { al: 'r', fill: al(t.a, .14), st: al(t.a, .7), col: t.b, ls: 2 * s, w: 800 });
  // footer
  let fbot;
  if (center) {
    T(c, SITE, W / 2, H - P - 70 * s, 40 * s, '#fff', { w: 800, al: 'center', ls: 1 });
    T(c, `${DC}    ${XH}    ${YT}`, W / 2, H - P - 28 * s, 20 * s, t.b, { f: FB, w: 600, al: 'center', max: W - 2 * P });
    T(c, 'Fan-made. Not affiliated with EA SPORTS FC Mobile.', W / 2, H - P + 8 * s, 14 * s, 'rgba(255,255,255,.45)', { f: FB, w: 500, al: 'center' });
    fbot = H - P - 104 * s;
  } else {
    const y = H - P - (F.wd ? 0 : 10);
    T(c, SITE, P, y, 34 * s, '#fff', { w: 800, ls: 1 });
    T(c, F.wd ? `${DC}   ${YT}` : `${DC}    ${XH}    ${YT}`, W - P, y, 20 * s, t.b, { f: FB, w: 600, al: 'right', max: W * .6 });
    if (!F.wd) T(c, 'Fan-made. Not affiliated with EA SPORTS FC Mobile.', P, y + 36 * s, 14 * s, 'rgba(255,255,255,.45)', { f: FB, w: 500 });
    fbot = y - 40 * s;
  }
  const ztop = P + lh + 14 * s, avail = fbot - ztop;
  // content blocks (measure, shrink if needed, then draw)
  const build = k => {
    const els = [], G = 24 * k;
    c.letterSpacing = '0px';
    const ey = clean(code ? 'NEW REDEEM CODE' + (S.note ? '  ·  ' + S.note.toUpperCase() : '') : tp.ey);
    els.push({ h: 28 * k, d: y => T(c, ey, ax, y + 14 * k, 22 * k, t.a, { f: FB, w: 800, ls: 4 * k, al: al_, max: cw }) });
    let big, rest, sub = '';
    if (code) { const p = clean(S.reward || 'Your reward').split(/\s+\+\s+/); big = p[0]; rest = p.slice(1).map(x => '+ ' + x); }
    else { big = clean(S.h || tp.h); rest = chipsOf(S, tp); sub = clean(S.s); }
    let z = (code ? 100 : 92) * k, lines;
    for (let i = 0; i < 4; i++) { c.font = `800 ${z}px ${FD}`; lines = wrap(c, code ? big.toUpperCase() : big, cw); if (lines.length <= (code ? 2 : 3)) break; z *= .82; }
    els.push({ h: lines.length * z * 1.08, d: y => lines.forEach((l, i) => {
      const yy = y + i * z * 1.08, g = c.createLinearGradient(0, yy, 0, yy + z); g.addColorStop(0, '#fff'); g.addColorStop(.55, t.b); g.addColorStop(1, t.a);
      T(c, l, ax, yy + z * .52, z, g, { w: 800, al: al_, ls: -1 * k });
    }) });
    if (sub) {
      const sz = 27 * k; c.font = `500 ${sz}px ${FB}`; const sl = wrap(c, sub, cw * .92).slice(0, 3);
      els.push({ h: sl.length * sz * 1.4, d: y => sl.forEach((l, i) => T(c, l, ax, y + sz * .7 + i * sz * 1.4, sz, '#cfe3f0', { f: FB, w: 500, al: al_ })) });
    }
    if (rest.length) {
      const ch = 46 * k, z2 = 22 * k, o = { st: al(t.a, .6), fill: al(t.a, .12), col: t.b, f: FB, w: 700 };
      els.push({ h: flow(c, rest, ax, 0, cw, ch, z2, al_, o, false), d: y => flow(c, rest, ax, y, cw, ch, z2, al_, o, true) });
    }
    if (code) {
      const ph = 150 * k, pw = Math.min(cw, 900 * k), px = center ? W / 2 - pw / 2 : P;
      els.push({ h: ph, d: y => {
        rr(c, px, y, pw, ph, 24 * k); c.fillStyle = 'rgba(4,10,20,.74)'; c.shadowColor = al(t.a, .55); c.shadowBlur = 44 * k; c.fill(); c.shadowBlur = 0;
        const g = c.createLinearGradient(px, y, px + pw, y + ph); g.addColorStop(0, t.a); g.addColorStop(1, t.c); c.strokeStyle = g; c.lineWidth = 3.5; c.stroke();
        c.setLineDash([10 * k, 9 * k]); rr(c, px + 11 * k, y + 11 * k, pw - 22 * k, ph - 22 * k, 16 * k); c.strokeStyle = al(t.a, .35); c.lineWidth = 2; c.stroke(); c.setLineDash([]);
        T(c, S.rev === 'full' ? 'REDEEM CODE' : 'CODE HIDDEN. GET IT ON THE SITE', px + pw / 2 + 26 * k, y + 34 * k, 15 * k, t.a, { f: FB, w: 800, ls: 2.5 * k, al: 'center', max: pw - 150 * k });
        lock(c, px + 56 * k, y + ph / 2 + 10 * k, k * 1.1, t.a);
        T(c, mk, px + pw / 2 + 36 * k, y + ph / 2 + 14 * k, 66 * k, '#fff', { f: FMONO, w: 700, ls: 6 * k, al: 'center', max: pw - 190 * k });
      } });
    }
    const cta = code ? 'GET THE FULL CODE  →' : clean(S.cta || tp.cta).toUpperCase(), url = (code ? CODES : tp.url).replace('https://', '');
    els.push({ h: 84 * k + 36 * k, d: y => {
      const h = 84 * k;
      pill(c, ax, y + h / 2, h, cta, 30 * k, { al: center ? 'c' : 'l', fill: (px, w) => { const g = c.createLinearGradient(px, 0, px + w, 0); g.addColorStop(0, t.b); g.addColorStop(1, t.a); return g; }, col: '#04121b', w: 800, ls: 1.5 * k, f: FD, glow: al(t.a, .55) });
      T(c, url, ax, y + h + 24 * k, 22 * k, 'rgba(255,255,255,.7)', { f: FB, w: 600, al: al_ });
    } });
    const tot = els.reduce((a, e) => a + e.h, 0) + G * (els.length - 1);
    return { els, tot, G };
  };
  let k = s, b = build(k);
  for (let i = 0; i < 3 && b.tot > avail; i++) { k *= avail / b.tot * .97; b = build(k); }
  let y = ztop + Math.max(0, (avail - b.tot) / 2);
  for (const e of b.els) { e.d(y); y += e.h + b.G; }
}

/* ---------- copy text ---------- */
function texts(S) {
  const code = S.mode === 'code', tp = TPL[S.tpl], mk = maskCode(S.code || 'YOURCODE', S.rev), e = x => S.em ? x + ' ' : '';
  const title = code ? 'New FC Mobile redeem code is live!' : clean(S.h || tp.h);
  const lines = (code ? ['Reward: ' + clean(S.reward), 'Code: ' + mk, clean(S.note)] : [clean(S.s), 'Includes: ' + chipsOf(S, tp).join(', ')]).filter(Boolean);
  const cta = code ? 'Get the full code:' : 'Visit:', link = code ? CODES : tp.url;
  const tags = code ? ['#FCMobile', '#EAFCMobile', '#FCMobileCodes', '#FCMobileTools'] : ['#FCMobile', '#EAFCMobile', '#FCMobileTools'];
  let l = [...lines]; const xs = () => `${e(code ? '🎁' : '⚽')}${title}\n${l.join('\n')}\n${cta} ${link}\n${tags.slice(0, 2).join(' ')}`;
  while (xs().length > 280 && l.length > 1) l.pop();
  const j = lines.join('\n');
  return {
    x: xs(),
    fb: `${e('🎁')}${title}\n\n${j}\n\n${e('🔑')}${cta}\n${link}\n\n${code ? 'Redeem on the official EA page: ' + EA + '\n\n' : ''}Follow FCMobiletools for more codes, events and guides.\n${tags.join(' ')}`,
    wa: `*${title}*\n\n${j}\n\n${cta} ${link}`,
    dc: `**${title}**\n${j}\n${cta} ${link}`,
    yt: `${title}\n\n${j}\n\n${cta} ${link}\n${code ? 'Official redeem page: ' + EA + '\n' : ''}\nDiscord: https://${DC}\nX: https://${XH}\nYouTube: https://${YT}\n\nFan-made site. Not affiliated with EA SPORTS FC Mobile.\n${tags.join(' ')}`
  };
}

/* ---------- UI ---------- */
const CSS = `.ps{position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;background:#050c14f2;backdrop-filter:blur(14px);color:#f5f8fb;font:14px/1.5 Manrope,Inter,system-ui,sans-serif}
.ps *{box-sizing:border-box}.ps-h{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 22px;border-bottom:1px solid rgba(255,255,255,.08)}
.ps-h b{display:block;font:800 20px Sora,system-ui,sans-serif;letter-spacing:-.02em}.ps-h small{color:#8ea3b5}
.ps-x{width:38px;height:38px;border:1px solid rgba(255,255,255,.14);border-radius:11px;background:#0d1821;color:#cfe3f0;font-size:20px;cursor:pointer}
.ps-body{flex:1;min-height:0;display:grid;grid-template-columns:350px minmax(0,1fr);overflow:hidden}
.ps-c{overflow:auto;padding:18px 20px 30px;border-right:1px solid rgba(255,255,255,.08);display:grid;gap:14px;align-content:start}
.ps-m{overflow:auto;padding:18px 22px 40px;display:grid;gap:16px;align-content:start}
.ps-f>span{display:block;margin-bottom:6px;color:#9db2c3;font:700 11.5px Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase}
.ps input,.ps select,.ps textarea{width:100%;min-height:40px;padding:0 12px;border:1px solid rgba(255,255,255,.15);border-radius:11px;background:#07121b;color:#f5f8fb;font:500 14px Manrope,sans-serif}
.ps textarea{padding:12px;min-height:170px;line-height:1.55;resize:vertical}.ps input:focus,.ps select:focus,.ps textarea:focus{outline:0;border-color:#4cc9ff;box-shadow:0 0 0 3px rgba(76,201,255,.15)}
.ps-seg{display:flex;flex-wrap:wrap;gap:4px;padding:4px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(0,0,0,.3)}
.ps-seg button{flex:1 1 auto;min-height:34px;padding:0 10px;border:0;border-radius:9px;background:transparent;color:#9db2c3;font:700 12.5px Manrope,sans-serif;cursor:pointer;white-space:nowrap}
.ps-seg button.on{background:linear-gradient(135deg,#9fe6ff,#4cc9ff);color:#04121b}
.ps-sw{display:flex;gap:8px}.ps-sw button{width:44px;height:44px;border-radius:12px;border:2px solid transparent;cursor:pointer}.ps-sw button.on{border-color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.15)}
.ps-stage{display:grid;place-items:center;padding:18px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:repeating-conic-gradient(#0a1621 0 25%,#08121b 0 50%) 0 0/24px 24px}
.ps canvas{display:block;max-width:100%;max-height:62vh;border-radius:14px;box-shadow:0 30px 70px -20px #000}
.ps-a{display:flex;gap:8px;flex-wrap:wrap}.ps-b{min-height:42px;padding:0 16px;border:1px solid rgba(255,255,255,.16);border-radius:11px;background:#0d1821;color:#e6eef5;font:700 13px Manrope,sans-serif;cursor:pointer}
.ps-b.p{border-color:#6fd6ff;background:linear-gradient(135deg,#9fe6ff,#4cc9ff);color:#04121b}.ps-b:hover{filter:brightness(1.1)}
.ps-t{display:grid;gap:10px;padding:16px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.025)}
.ps-t h4{margin:0;font:800 15px Sora,sans-serif}.ps-n{color:#8ea3b5;font-size:12.5px}.ps-chk{display:flex;align-items:center;gap:8px;color:#cfe3f0;font-weight:600}.ps-chk input{width:18px;min-height:18px;accent-color:#4cc9ff}
@media(max-width:900px){.ps-body{grid-template-columns:1fr;overflow:auto;display:block}.ps-c{border-right:0;border-bottom:1px solid rgba(255,255,255,.08);overflow:visible}.ps-m{overflow:visible}}`;

const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const blobOf = cv => new Promise(r => cv.toBlob(r, 'image/png'));
const noteOf = c => c && c.expiryDate ? 'Ends ' + new Date(c.expiryDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
const seg = (k, arr, v) => `<div class="ps-seg" data-seg="${k}">${arr.map(([a, b]) => `<button type="button" data-v="${a}" class="${a === v ? 'on' : ''}">${esc(b)}</button>`).join('')}</div>`;

export async function openPromoStudio({ codes = [], code = '', toast = () => {} } = {}) {
  document.querySelector('.ps')?.remove();
  if (!document.getElementById('ps-css')) { const st = document.createElement('style'); st.id = 'ps-css'; st.textContent = CSS; document.head.appendChild(st); }
  const order = { active: 0, scheduled: 1, expired: 2 }, list = [...codes].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  const first = list.find(x => x.code === code) || list.find(x => x.status === 'active') || list[0];
  const S = { mode: 'code', code: first?.code || '', reward: first?.reward || '', note: noteOf(first), rev: '2,1', fmt: 'sq', th: 'cyan', sc: 'stadium', tpl: 'brand', h: TPL.brand.h, s: TPL.brand.s, chips: TPL.brand.ch.join(', '), cta: TPL.brand.cta, em: true, pl: 'x' };
  const root = document.createElement('div'); root.className = 'ps'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Promo studio');
  root.innerHTML = `<div class="ps-h"><div><b>Promo Studio</b><small>Masked code banners, premium promo images and captions ready to paste</small></div><button class="ps-x" data-x aria-label="Close">×</button></div>
  <div class="ps-body"><aside class="ps-c">
   <div class="ps-f"><span>Type</span>${seg('mode', [['code', 'Masked code banner'], ['promo', 'Promo image']], S.mode)}</div>
   <div data-show="code" style="display:grid;gap:14px">
    <div class="ps-f"><span>Pick a code</span><select data-pick><option value="">Type my own</option>${list.map(c => `<option value="${esc(c.code)}" ${c.code === S.code ? 'selected' : ''}>${esc(c.code)} (${esc(c.status)})</option>`).join('')}</select></div>
    <div class="ps-f"><span>Code</span><input data-k="code" maxlength="40" autocomplete="off" spellcheck="false" value="${esc(S.code)}"></div>
    <div class="ps-f"><span>Reward (use + between items)</span><input data-k="reward" maxlength="160" value="${esc(S.reward)}"></div>
    <div class="ps-f"><span>How much of the code to show</span><select data-k="rev">${REV.map(([a, b]) => `<option value="${a}" ${a === S.rev ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
    <div class="ps-f"><span>Expiry line (optional)</span><input data-k="note" maxlength="40" value="${esc(S.note)}" placeholder="Ends Oct 30, 2026"></div>
   </div>
   <div data-show="promo" style="display:none;gap:14px">
    <div class="ps-f"><span>Template</span><select data-k="tpl"><optgroup label="Everyday posts">${REG.map(k => `<option value="${k}">${esc(TPL[k].n)}</option>`).join('')}</optgroup><optgroup label="Pages and tools">${Object.entries(TPL).filter(([k]) => !REG.includes(k)).map(([k, v]) => `<option value="${k}" ${k === S.tpl ? 'selected' : ''}>${esc(v.n)}</option>`).join('')}</optgroup></select></div>
    <div class="ps-f"><span>Headline</span><input data-k="h" maxlength="70" value="${esc(S.h)}"></div>
    <div class="ps-f"><span>Sub line</span><input data-k="s" maxlength="120" value="${esc(S.s)}"></div>
    <div class="ps-f"><span>Chips (comma separated, up to 8)</span><input data-k="chips" maxlength="160" value="${esc(S.chips)}"></div>
    <div class="ps-f"><span>Button text</span><input data-k="cta" maxlength="40" value="${esc(S.cta)}"></div>
   </div>
   <div class="ps-f"><span>Size</span>${seg('fmt', Object.entries(FM).map(([k, v]) => [k, v.n]), S.fmt)}</div>
   <div class="ps-f"><span>Color theme</span><div class="ps-sw" data-seg="th">${Object.entries(TH).map(([k, v]) => `<button type="button" data-v="${k}" title="${v.n}" class="${k === S.th ? 'on' : ''}" style="background:linear-gradient(135deg,${v.b},${v.a} 55%,${v.c})"></button>`).join('')}</div></div>
   <div class="ps-f"><span>Background</span>${seg('sc', [['stadium', 'Stadium'], ['striker', 'Striker'], ['object', 'Object'], ['pitch', 'Pitch'], ['clean', 'Clean']], S.sc)}</div>
   <label class="ps-chk"><input type="checkbox" data-k="em" checked> Use emojis in captions</label>
  </aside>
  <main class="ps-m"><div class="ps-stage"><canvas></canvas></div>
   <div class="ps-a"><button class="ps-b p" data-act="dl">Download PNG</button><button class="ps-b" data-act="copyimg">Copy image</button><button class="ps-b" data-act="all">Download all sizes</button></div>
   <section class="ps-t"><h4>Ready to paste text</h4>${seg('pl', PL, S.pl)}<textarea data-txt spellcheck="true"></textarea>
    <div class="ps-a" style="align-items:center"><button class="ps-b p" data-act="copytxt">Copy text</button><span class="ps-n" data-cnt></span></div></section>
  </main></div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), ta = root.querySelector('[data-txt]'), q = s => root.querySelector(s);
  let raf = 0;
  const refresh = () => {
    q('[data-show=code]').style.display = S.mode === 'code' ? 'grid' : 'none'; q('[data-show=promo]').style.display = S.mode === 'promo' ? 'grid' : 'none';
    root.querySelectorAll('[data-seg]').forEach(g => g.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === S[g.dataset.seg])));
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render(cv, S, S.fmt));
    ta.value = texts(S)[S.pl]; q('[data-cnt]').textContent = ta.value.length + ' characters' + (S.pl === 'x' ? (ta.value.length > 280 ? ' (over the 280 limit)' : ' (X limit 280)') : '');
  };
  const close = () => { root.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  const name = fk => `fcmobiletools-${S.mode === 'code' ? 'code-banner' : 'promo-' + S.tpl}-${S.th}-${fk}.png`;
  root.addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    S[k] = e.target.type === 'checkbox' ? e.target.checked : k === 'code' ? e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') : e.target.value;
    if (k === 'code') e.target.value = S.code;
    if (k === 'tpl') { const x = TPL[S.tpl]; Object.assign(S, { h: x.h, s: x.s, chips: x.ch.join(', '), cta: x.cta }); ['h', 's', 'chips', 'cta'].forEach(f => q(`[data-k=${f}]`).value = S[f]); }
    refresh();
  });
  root.addEventListener('change', e => {
    if (!e.target.matches('[data-pick]')) return;
    const c = list.find(x => x.code === e.target.value); if (c) { Object.assign(S, { code: c.code, reward: c.reward, note: noteOf(c) }); ['code', 'reward', 'note'].forEach(k => q(`[data-k=${k}]`).value = S[k]); refresh(); }
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-x')) return close();
    const g = b.closest('[data-seg]');
    if (g) { S[g.dataset.seg] = b.dataset.v; return refresh(); }
    const a = b.dataset.act;
    if (a === 'dl') { await loadAll(); render(cv, S, S.fmt); download(await blobOf(cv), name(S.fmt)); toast('Banner downloaded'); }
    else if (a === 'copyimg') { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': await blobOf(cv) })]); toast('Image copied'); } catch { toast('Copy not supported here. Use Download PNG.', 'error'); } }
    else if (a === 'all') {
      const tmp = document.createElement('canvas');
      for (const fk of Object.keys(FM)) { render(tmp, S, fk); download(await blobOf(tmp), name(fk)); await new Promise(r => setTimeout(r, 400)); }
      refresh(); toast('All sizes downloaded');
    } else if (a === 'copytxt') { try { await navigator.clipboard.writeText(ta.value); toast('Text copied'); } catch { ta.select(); toast('Press copy on your keyboard', 'error'); } }
  });
  await loadAll(); refresh();
}

export { render, R, TH, FM, TPL, REG, texts, makeObj, background, pill, maskCode };
