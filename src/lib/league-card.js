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

export const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
export const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.4-9.3C1.3 7.9 3.3 4.5 6.7 4.5c2 0 3.6 1.1 5.3 3 1.7-1.9 3.3-3 5.3-3 3.4 0 5.4 3.4 4.1 6.7-1.9 4.7-9.4 9.3-9.4 9.3Z"/></svg>';

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
  return '<div class="lg-ring ' + m.tone + '" style="--p:' + m.score + '" title="' + esc(m.label) + '"><b>' + m.score + '</b>' + (small ? '<small>match</small>' : '') + '</div>';
}

export function leagueHref(r) { return '/leagues/' + encodeURIComponent(r.slug || '') + '/'; }

// opts: { match, saved, index, preview, showSave }
export function leagueCard(r, opts = {}) {
  const m = opts.match || null;
  const preview = Boolean(opts.preview);
  const full = r.openSpots <= 0;
  const act = activityLine(r);
  const href = preview ? '#' : leagueHref(r);
  const below = m && !m.qualifies;
  const badges = [trustBadge(r)];
  if (r.kickoffActive) badges.push('<span class="lg-badge cyan"><i class="lg-pulse"></i>Kickoff</span>');
  if (r.isMine) badges.push('<span class="lg-badge mint">Your league</span>');
  if (opts.spotlight) badges.push('<span class="lg-badge gold">Spotlight</span>');
  const save = (preview || r.isMine || opts.showSave === false) ? '' :
    '<button type="button" class="lg-icon-btn' + (r.saved ? ' on' : '') + '" data-save="' + esc(r.id) + '" aria-pressed="' + (r.saved ? 'true' : 'false') +
    '" aria-label="' + (r.saved ? 'Remove from saved' : 'Save league') + '">' + HEART + '</button>';
  return '<article class="lg-card' + (preview ? ' is-preview' : '') + (full ? ' is-full' : '') + '" style="--ac:' + accentColor(r.accent) +
    ';animation-delay:' + Math.min((opts.index || 0) * 40, 240) + 'ms">' +
    '<div class="lg-card-glow"></div><div class="lg-card-in">' +
    '<div class="lg-card-top">' + crest(r.logoUrl, r.name, 'lg-crest') +
    '<div class="lg-card-id"><h3>' + (preview ? esc(r.name || 'Your league name') : '<a href="' + href + '">' + esc(r.name) + '</a>') + '</h3>' +
    '<div class="lg-card-sub"><span>' + esc(r.regionServer || 'Region') + '</span>' + (r.division ? '<i class="lg-dotsep"></i>' + divisionBadge(r.division) : '') + '</div></div>' +
    (m && !preview && !r.isMine ? ring(m) : '') + '</div>' +
    '<div class="lg-badges">' + badges.join('') + '</div>' +
    '<div class="lg-vac">' +
      '<div class="lg-vac-box ' + (full ? 'none' : 'open') + '"><span>Open spots</span><strong>' + (full ? 'Full' : fmt(r.openSpots)) + '</strong></div>' +
      '<div class="lg-vac-box' + (below ? ' warn' : '') + '"><span>Min OVR</span><strong>' + fmt(r.minOvr) + '+</strong></div>' +
      '<div class="lg-vac-box wide"><span>Schedule</span><strong>' + esc(scheduleLine(r) || 'Not set') + '</strong></div>' +
    '</div>' +
    (r.tagline ? '<p class="lg-tagline">' + esc(r.tagline) + '</p>' : '') +
    '<div class="lg-joinrow"><span class="lg-joinlabel">How to join</span>' + joinChips(r) + '</div>' +
    '<div class="lg-card-foot"><div class="lg-signal"><i class="' + (act.hot ? 'hot' : '') + '"></i><span>' + esc(preview ? 'Preview' : act.text) + '</span></div>' +
    '<div class="lg-card-actions">' + save +
    (preview ? '' : '<a class="lg-btn lg-btn-primary lg-btn-sm" href="' + href + '">' + (full ? 'View' : 'View league') + '</a>') + '</div></div>' +
    '</div></article>';
}

// Guide copy used by the "i" buttons. Plain language, written for players and owners.
export const INFO = {
  ovr: ['Minimum OVR', 'The lowest team OVR a player needs to join. Your OVR is shown on your player card.'],
  spots: ['Open spots', 'How many players the league can take right now. Owners update this when someone joins.'],
  division: ['Divisions', 'Leagues are grouped by division: Bronze 1,050 to 2,000, Silver 2,100 to 4,000, World Class 4,100 to 6,000, Legendary 6,100 to 8,000, FC Champions 8,100 to 10,000.'],
  joining: ['How to join', '<b>Apply here</b>: send an application with your team screenshot. <b>Join Discord</b>: open the league\u2019s server. <b>Search in game</b>: find the league by its ID inside FC Mobile.'],
  trust: ['Verified, reviewed, new', '<b>Verified club</b>: confirmed as a real, active club by FCMobiletools. <b>Reviewed</b>: the team checked the listing. <b>New</b>: listed in the last 7 days. <b>Sample club</b>: for testing only.'],
  activity: ['Activity', '“Confirmed active” means players from that league have confirmed they played recently. New leagues may not have activity yet.'],
  kickoff: ['Kickoff', 'Kickoff puts a league near the top of the board for 6 hours. The owner or an approved Leaguemate can activate it; the whole league shares one 6-hour cooldown.'],
  confirm: ['Confirm activity', 'Played in this league lately? Tap it. It tells other players the league is active. One tap per day.'],
  sharing: ['Your UID and Discord', 'They are never public. A league only sees them if you tick the box when you apply, or turn on sharing in your player card.'],
  apply: ['Applying', 'Add a clear screenshot of your current team so the owner can check your squad. You can keep up to 3 active applications at once. Owners can shortlist you, invite you in game, or decline.'],
  spotlight: ['Community Spotlight', 'A separate board for leagues with recent community activity. Sample listings are excluded.'],
  region: ['Worldwide regions', 'Choose Worldwide if your league recruits across servers or accepts players from any region. Otherwise, select the main region your players use.'],
  saved: ['Saved leagues', 'Keep up to 3 leagues bookmarked. Saved listings stay here while they are publicly available. Remove one bookmark to save another.'],
  inbox: ['League inbox', 'Message a league owner about an application, or reply to a player who applied to your league. Keep personal contact details private unless you choose to share them.'],
  appeal: ['Suspension appeal', 'Explain why a suspended league should be restored. Include the changes you have made; an admin will review the appeal.'],
  listing: ['Listing a league', 'Anyone can list one league. Keep it short and true: your division, minimum OVR, open spots, schedule and how to join. You can edit it any time.'],
  pitch: ['One-line pitch', 'One short line players read first. Example: “Daily 8v8, friendly and active.” Long text is not needed.']
};
export const infoBtn = (topic) => '<button type="button" class="lg-info" data-info="' + topic + '" aria-label="' + esc((INFO[topic] || ['Help'])[0]) + '">i</button>';
