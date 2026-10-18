// Markup builders for league cards. Pure string functions, so the server (SSR for SEO and first paint)
// and the browser (live board) render exactly the same cards.

import { divisionByKey, divisionIcon, divisionRange, ACCENTS, JOIN_METHODS, FREQ, COMMIT } from '../data/leagueConfig.js';

export const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (v) => Number(v || 0).toLocaleString('en-US');
export const initials = (v) => String(v || 'FC').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || 'FC';
export const ts = (iso) => { const n = Date.parse(iso || ''); return Number.isFinite(n) ? n : 0; };
export const accentColor = (key) => ACCENTS[key] || ACCENTS.cyan;
export const freqLabel = (v) => FREQ[v] || 'Schedule varies';
export const commitLabel = (v) => COMMIT[v] || 'Regular';

export function timeAgo(iso, now = Date.now()) {
  const t = ts(iso); if (!t) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 90) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : d < 30 ? d + ' days ago' : new Date(t).toISOString().slice(0, 10);
}

// One small icon set, stroke-based so it inherits colour from the text around it.
const svg = (d) => '<svg class="lg-i" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
export const ICON = {
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  heart: svg('<path d="M12 20.5s-7.5-4.6-9.4-9.3C1.3 7.9 3.3 4.5 6.7 4.5c2 0 3.6 1.1 5.3 3 1.7-1.9 3.3-3 5.3-3 3.4 0 5.4 3.4 4.1 6.7-1.9 4.7-9.4 9.3-9.4 9.3Z"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  pin: svg('<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>'),
  users: svg('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M16 5.6a3 3 0 0 1 0 5.8M18 14.4c1.7.6 2.9 2.1 3.2 4.6"/>'),
  bolt: svg('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
  search: svg('<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>'),
  image: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4"/>'),
  upload: svg('<path d="M12 16V5m-4 4 4-4 4 4"/><path d="M20 16.5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-2"/>'),
  spark: svg('<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16Z"/>'),
  shield: svg('<path d="M12 3 4.5 6v5.5c0 4.5 3.1 8 7.5 9.5 4.4-1.5 7.5-5 7.5-9.5V6L12 3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
  inbox: svg('<path d="M4 13.5 6.5 5h11L20 13.5V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4.5Z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>'),
  chat: svg('<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5v-8Z"/>'),
  flag: svg('<path d="M5 21V4m0 1h12l-2.2 3.5L17 12H5"/>'),
  share: svg('<circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="m8.1 10.9 7.3-3.8M8.1 13.1l7.3 3.8"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),
  compare: svg('<rect x="3.5" y="5" width="7" height="14" rx="2"/><rect x="13.5" y="5" width="7" height="14" rx="2"/>'),
  crown: svg('<path d="m4 8 4.2 3.6L12 5l3.8 6.6L20 8l-1.4 10H5.4L4 8Z"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>'),
  eye: svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="9.5" rx="2.4"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  copy: svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.3"/><path d="M15.5 8.5V6.3A1.8 1.8 0 0 0 13.7 4.5H6.3A1.8 1.8 0 0 0 4.5 6.3v7.4a1.8 1.8 0 0 0 1.8 1.8h2.2"/>'),
  trash: svg('<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7"/>')
};
// Back-compat names used by older call sites.
export const CHECK = ICON.check;
export const HEART = ICON.heart;

export function crest(url, name, cls) {
  return '<div class="' + cls + '"><span>' + esc(initials(name)) + '</span>' +
    (url ? '<img src="' + esc(url) + '" alt="" width="64" height="64" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</div>';
}

export function divisionBadge(key, { range = false } = {}) {
  const d = divisionByKey(key);
  if (!d) return '';
  return '<span class="lg-div" title="' + esc(d.label + ' division · ' + divisionRange(d)) + '">' +
    '<img src="' + divisionIcon(key) + '" alt="" width="22" height="22" loading="lazy" decoding="async"><b>' + esc(d.label) + '</b>' +
    (range ? '<small>' + esc(divisionRange(d)) + '</small>' : '') + '</span>';
}

// Reviewed listing and verified club are different things and are always labelled differently.
export function trustBadge(r) {
  if (r.isSample) return '<span class="lg-badge amber" title="Made for testing. Not a real club.">Sample club</span>';
  if (r.verified) return '<span class="lg-badge cyan" title="Confirmed as a real, active club by FCMobiletools"><span class="lg-verified">' + CHECK + '</span>Verified club</span>';
  if (r.reviewed) return '<span class="lg-badge" title="The team looked at this listing. It is not a club verification.">Reviewed</span>';
  const age = Date.now() - ts(r.createdAt);
  return age < 7 * 864e5 ? '<span class="lg-badge mint">New</span>' : '';
}

export function joinChips(r) {
  return (r.joinMethods || ['apply']).map(m => '<span class="lg-join j-' + esc(m) + '">' + esc(JOIN_METHODS[m] || m) + '</span>').join('');
}

export function scheduleLine(r) {
  const parts = [freqLabel(r.tournamentFrequency), (r.tournamentSizes || []).join(' / '), r.activeHours].filter(Boolean);
  return parts.join(' · ');
}

export function activityLine(r) {
  const bits = [];
  if (r.confirmations7d > 0) bits.push(r.confirmations7d + ' confirmed active this week');
  if (!bits.length) bits.push(r.lastActiveAt ? 'Last confirmed ' + timeAgo(r.lastActiveAt) : 'Listed ' + (timeAgo(r.createdAt) || 'recently'));
  return { hot: r.confirmations7d > 0, text: bits.join(' · ') };
}

export function ring(m, small = true) {
  return '<div class="lg-ring ' + m.tone + '" style="--p:' + m.score + '" title="' + esc(m.label) + '"><b>' + m.score + '</b>' + (small ? '<small>fit</small>' : '') + '</div>';
}

// Open spots as seats on a bench: you see at a glance whether there is room.
export function seatPips(n, max = 10) {
  const open = Math.max(0, Math.min(max, n));
  let h = '';
  for (let i = 0; i < max; i++) h += '<i class="' + (i < open ? 'on' : '') + '" style="--d:' + i * 35 + 'ms"></i>';
  return '<span class="lg-pips" aria-hidden="true">' + h + '</span>';
}

export function leagueHref(r) { return '/leagues/' + encodeURIComponent(r.slug || '') + '/'; }

// Media is shown on a public card only once the team has reviewed the listing, so a card never
// carries an image nobody has looked at. The league page itself always shows its own gallery.
export const cardMedia = (r) => (r.reviewed || r.verified) && r.galleryUrls && r.galleryUrls[0] ? r.galleryUrls[0] : '';

// opts: { match, index, preview, showSave, spotlight, compare }
export function leagueCard(r, opts = {}) {
  const m = opts.match || null;
  const preview = Boolean(opts.preview);
  const full = r.openSpots <= 0;
  const act = activityLine(r);
  const href = preview ? '#' : leagueHref(r);
  const below = m && !m.qualifies;
  const badges = [];
  const trust = trustBadge(r);
  if (trust) badges.push(trust);
  if (r.kickoffActive) badges.push('<span class="lg-badge live"><i class="lg-pulse"></i>Kickoff</span>');
  if (opts.spotlight || r.featured) badges.push('<span class="lg-badge gold">' + ICON.spark + (opts.spotlight ? 'Spotlight' : 'Featured') + '</span>');
  if (r.isMine) badges.push('<span class="lg-badge mint">Your league</span>');
  if (r.expiringSoon && r.expiresInDays != null && r.isMine) badges.push('<span class="lg-badge lg-expiry" title="Press Kickoff to keep this listing live">Expires in ' + r.expiresInDays + 'd</span>');
  const tools = (preview || r.isMine ? '' : (opts.compare === false ? '' :
    '<button type="button" class="lg-tool' + (r.comparing ? ' on' : '') + '" data-compare="' + esc(r.id) + '" aria-pressed="' + (r.comparing ? 'true' : 'false') + '" aria-label="Compare this league" title="Compare">' + ICON.compare + '</button>') +
    (opts.showSave === false ? '' :
      '<button type="button" class="lg-tool lg-heart' + (r.saved ? ' on' : '') + '" data-save="' + esc(r.id) + '" aria-pressed="' + (r.saved ? 'true' : 'false') +
      '" aria-label="' + (r.saved ? 'Remove from saved' : 'Save league') + '" title="' + (r.saved ? 'Saved' : 'Save') + '">' + HEART + '</button>'));
  const media = cardMedia(r);
  const emblem = r.division ? '<img class="lg-card-emblem" src="' + divisionIcon(r.division) + '" alt="" width="120" height="120" loading="lazy" decoding="async">' : '';
  const reasons = m && !preview && !r.isMine && m.reasons?.length
    ? '<div class="lg-reasons">' + m.reasons.slice(0, 2).map(x => '<span>' + ICON.check + esc(x) + '</span>').join('') + (below ? '<span class="warn">' + esc(m.gaps[0] || m.label) + '</span>' : '') + '</div>'
    : (below && !preview ? '<div class="lg-reasons"><span class="warn">' + esc(m.gaps[0] || m.label) + '</span></div>' : '');
  return '<article class="lg-card' + (preview ? ' is-preview' : '') + (full ? ' is-full' : '') + (r.featured ? ' is-feat' : '') + (opts.spotlight ? ' is-spot' : '') + '" style="--ac:' + accentColor(r.accent) +
    ';--i:' + Math.min(opts.index || 0, 12) + '" data-league="' + esc(r.id || '') + '">' +
    '<div class="lg-card-banner">' + (media ? '<img class="lg-card-bn" src="' + esc(media) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + emblem +
    '<div class="lg-badges">' + badges.join('') + '</div><div class="lg-card-tools">' + tools + '</div></div>' +
    '<div class="lg-card-body">' +
    '<div class="lg-card-head">' + crest(r.logoUrl, r.name, 'lg-crest') +
    '<div class="lg-card-id"><h3>' + (preview ? esc(r.name || 'Your league name') : '<a href="' + href + '">' + esc(r.name) + '</a>') + '</h3>' +
    '<div class="lg-card-sub"><span>' + ICON.pin + esc(r.regionServer || 'Region') + '</span>' + (r.division ? divisionBadge(r.division) : '') + '</div></div>' +
    (m && !preview && !r.isMine && !m.lite ? ring(m) : '') + '</div>' +
    (r.tagline ? '<p class="lg-tagline">' + esc(r.tagline) + '</p>' : '<p class="lg-tagline mute">' + (preview ? 'Your one-line pitch appears here.' : '') + '</p>') +
    '<div class="lg-vac">' +
      '<div class="lg-seats ' + (full ? 'none' : 'open') + '"><span class="lg-k">Open spots</span><div>' + seatPips(r.openSpots) + '<strong>' + (full ? 'Full' : fmt(r.openSpots)) + '</strong></div></div>' +
      '<div class="lg-ovrplate' + (below ? ' warn' : '') + '"><span class="lg-k">Min OVR</span><strong>' + fmt(r.minOvr) + '+</strong></div>' +
    '</div>' +
    '<p class="lg-sched">' + ICON.clock + '<span>' + esc(scheduleLine(r) || 'Schedule not set') + '</span></p>' + reasons +
    '<div class="lg-joinrow"><span class="lg-k">How to join</span>' + joinChips(r) + '</div>' +
    '<div class="lg-card-foot"><div class="lg-signal"><i class="' + (act.hot ? 'hot' : '') + '"></i><span>' + esc(preview ? 'Preview' : act.text) + '</span></div>' +
    (preview ? '' : '<a class="lg-btn lg-btn-primary lg-btn-sm" href="' + href + '">' + (full ? 'View' : 'View league') + ICON.arrow + '</a>') + '</div>' +
    '</div></article>';
}

// Slim card for the Community Spotlight rail: who is active right now, at a glance.
export function spotCard(r, opts = {}) {
  const full = r.openSpots <= 0, act = activityLine(r);
  return '<a class="lg-spot-card" href="' + leagueHref(r) + '" style="--ac:' + accentColor(r.accent) + ';--i:' + Math.min(opts.index || 0, 8) + '" data-league="' + esc(r.id) + '">' +
    crest(r.logoUrl, r.name, 'lg-crest sm') +
    '<span class="lg-spot-main"><b>' + esc(r.name) + '</b><span class="lg-spot-sig"><i></i>' + esc(act.text) + '</span>' +
    '<span class="lg-spot-meta">' + (r.division ? divisionBadge(r.division) : '') + '<em>' + fmt(r.minOvr) + '+ OVR</em></span></span>' +
    '<span class="lg-spot-open ' + (full ? 'none' : '') + '"><strong>' + (full ? 'Full' : fmt(r.openSpots)) + '</strong><small>' + (full ? 'spots' : r.openSpots === 1 ? 'spot' : 'spots') + '</small></span></a>';
}

// Guide copy used by the "i" buttons. Plain language, written for players and owners.
export const INFO = {
  ovr: ['Minimum OVR', 'The lowest team OVR a player needs to join. Your OVR is shown on your player card.'],
  spots: ['Open spots', 'How many players the league can take right now. Owners update this when someone joins.'],
  division: ['Divisions', 'Leagues are grouped by division: Bronze 1,050 to 2,000, Silver 2,100 to 4,000, World Class 4,100 to 6,000, Legendary 6,100 to 8,000, FC Champions 8,100 to 10,000.'],
  joining: ['How to join', '<b>Apply here</b>: send an application with your team screenshot. <b>Join Discord</b>: open the league\u2019s server. <b>Search in game</b>: find the league by its ID inside FC Mobile.'],
  trust: ['Verified, reviewed, new', '<b>Verified club</b>: confirmed as a real, active club by FCMobiletools. <b>Reviewed</b>: the team checked the listing. <b>New</b>: listed in the last 7 days.'],
  activity: ['Activity', '“Confirmed active” means players from that league have confirmed they played recently. New leagues may not have activity yet.'],
  kickoff: ['Kickoff', 'Kickoff puts a league near the top of the board for 6 hours. The owner or an approved Leaguemate can activate it; the whole league shares one 6-hour cooldown. It also resets the 30-day listing timer.'],
  confirm: ['Confirm activity', 'Played in this league lately? Tap it. It tells other players the league is active. One tap per day.'],
  sharing: ['Your UID and Discord', 'They are never public. A league only sees them if you tick the box when you apply, or turn on sharing in your player card.'],
  apply: ['Applying', 'Add a clear screenshot of your current team so the owner can check your squad. Your screenshot is deleted automatically after 7 days. Owners can shortlist you, invite you in game, or decline.'],
  spotlight: ['Community Spotlight', 'A separate board for leagues with recent community activity. Sample listings are excluded.'],
  region: ['Worldwide regions', 'Choose Worldwide if your league recruits across servers or accepts players from any region. Otherwise, select the main region your players use.'],
  saved: ['Saved leagues', 'Keep up to 3 leagues bookmarked. Saved listings stay here while they are publicly available. Remove one bookmark to save another.'],
  inbox: ['League inbox', 'Message a league owner about an application, or reply to a player who applied to your league. Keep personal contact details private unless you choose to share them.'],
  appeal: ['Suspension appeal', 'Explain why a suspended league should be restored. Include the changes you have made; an admin will review the appeal.'],
  listing: ['Listing a league', 'Anyone can list one league for free. Keep it short and true: your division, minimum OVR, open spots, schedule and how to join. You can edit it any time.'],
  pitch: ['One-line pitch', 'One short line players read first. Example: “Daily 8v8, friendly and active.” Long text is not needed.'],
  media: ['Images', '<b>Crest and league screenshots are permanent</b> and stay with your listing. <b>Applicant team screenshots are deleted automatically after 7 days.</b> Never upload other players\u2019 private details.'],
  fit: ['Fit score', 'How well your player card matches this league: OVR, region, language, tournament sizes, style and schedule. It is a guide, the owner always decides.']
};
export const infoBtn = (topic) => '<button type="button" class="lg-info" data-info="' + topic + '" aria-label="' + esc((INFO[topic] || ['Help'])[0]) + '">i</button>';
