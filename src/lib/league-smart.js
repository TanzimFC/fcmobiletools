// The "brain" of Find a League. Pure functions, no DOM, no network, so the same logic runs in the
// browser, in the Worker and in tests. Everything here answers one question for a real person:
// "what should I do next?"

import { FREQ, COMMIT, divisionByKey, APPLICATION_SHOT_DAYS, TAGLINE_MAX, NOTE_MAX, LISTING_EXPIRY_DAYS } from '../data/leagueConfig.js';

const DAY = 864e5;
const HOUR = 36e5;
export const KICKOFF_COOLDOWN_MS = 6 * HOUR;
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
const ts = (iso) => { const n = Date.parse(iso || ''); return Number.isFinite(n) ? n : 0; };
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'; };

// ───────────────────────────── fit engine ─────────────────────────────

export const STYLE_COMMIT = {
  'Competitive': ['competitive'], 'Active and relaxed': ['regular'], 'Casual': ['casual'],
  'Quest focused': ['casual', 'regular'], 'Building a new team': ['casual', 'regular', 'competitive']
};
export const ALL_FREQ = ['daily', 'most_days', 'several_weekly', 'weekly', 'occasional'];
export const AVAIL_FREQ = {
  'Daily': ['daily', 'most_days', 'several_weekly'], 'Most days': ['daily', 'most_days', 'several_weekly', 'weekly'],
  'Weekends': ['weekly', 'occasional', 'several_weekly'], 'Evenings': ALL_FREQ, 'Flexible': ALL_FREQ, 'Casual / whenever': ['weekly', 'occasional']
};

// How well does this player suit this league? Works with a full player card or just an OVR number.
// Missing profile fields are neutral (partial credit), never punished.
export function fitFor(profile, league) {
  if (!profile || !league) return null;
  const reasons = [], gaps = [];
  let score = 0;
  const ovr = Number(profile.ovr || 0), min = Number(league.minOvr || 0);
  const qualifies = ovr >= min;
  const ovrGap = Math.max(0, min - ovr);
  if (qualifies) { score += 35; reasons.push('Meets ' + min + '+ OVR'); }
  else if (ovrGap <= 3) { score += 16; gaps.push(ovrGap + ' OVR short, close'); }
  else gaps.push('Needs ' + ovrGap + ' more OVR');

  const region = profile.region_server || profile.regionServer || '';
  if (league.regionServer === 'Worldwide') { score += 20; reasons.push('Open to every region'); }
  else if (!region) score += 8;
  else if (same(region, league.regionServer)) { score += 20; reasons.push('Same region'); }
  else gaps.push('Based in ' + league.regionServer);

  const langs = profile.preferred_languages || profile.preferredLanguages || [];
  const sharedLang = (league.preferredLanguages || []).filter(l => langs.includes(l));
  if (!langs.length) score += 6;
  else if (sharedLang.length) { score += 15; reasons.push('Speaks ' + sharedLang[0]); }
  else gaps.push('No shared language');

  const sizes = profile.tournament_sizes || profile.tournamentSizes || [];
  const sharedSize = (league.tournamentSizes || []).filter(s => sizes.includes(s));
  if (!sizes.length) score += 8;
  else if (sharedSize.length) { score += 15; reasons.push('Plays ' + sharedSize[0]); }
  else gaps.push('Different tournament sizes');

  const style = profile.play_style || profile.playStyle || '';
  if (!style) score += 5;
  else if ((STYLE_COMMIT[style] || []).includes(league.playerCommitment)) { score += 10; reasons.push('Matching style'); }

  const avail = profile.availability || '';
  if (!avail) score += 3;
  else if ((AVAIL_FREQ[avail] || ALL_FREQ).includes(league.tournamentFrequency)) { score += 5; reasons.push('Schedule suits you'); }
  else gaps.push('Plays more often than you');

  score = Math.max(0, Math.min(100, score));
  const near = !qualifies && ovrGap <= 3;
  const tone = !qualifies ? (near ? 'near' : 'low') : score >= 80 ? 'great' : score >= 60 ? 'good' : 'low';
  const label = !qualifies ? (near ? 'Just below minimum' : 'Below minimum OVR') : score >= 80 ? 'Great fit' : score >= 60 ? 'Good fit' : 'Partial fit';
  return { score, qualifies, near, ovrGap, gaps, reasons, tone, label };
}

export function rankLeagues(leagues, profile, { limit = 3, openOnly = true, qualifiesOnly = true } = {}) {
  if (!profile) return [];
  return (leagues || [])
    .filter(l => !l.isMine && !l.isSample && (!openOnly || (l.openSpots > 0 && l.recruitingOpen !== false)))
    .map(l => ({ league: l, fit: fitFor(profile, l) }))
    .filter(x => x.fit && (!qualifiesOnly || x.fit.qualifies))
    .sort((a, b) => b.fit.score - a.fit.score || (b.league.activityScore || 0) - (a.league.activityScore || 0))
    .slice(0, limit);
}

export function similarLeagues(league, all, n = 3) {
  const sizes = new Set(league.tournamentSizes || []);
  return (all || []).filter(l => l.id !== league.id && !l.isSample).map(l => {
    let s = 0;
    if (l.division && l.division === league.division) s += 3;
    if (l.regionServer === league.regionServer || l.regionServer === 'Worldwide' || league.regionServer === 'Worldwide') s += 2;
    s += (l.tournamentSizes || []).filter(x => sizes.has(x)).length;
    if ((l.preferredLanguages || []).some(x => (league.preferredLanguages || []).includes(x))) s += 1;
    if (l.openSpots > 0) s += 1.5;
    if (Math.abs((l.minOvr || 0) - (league.minOvr || 0)) <= 6) s += 1;
    return { l, s: s + (l.activityScore || 0) / 100 };
  }).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.l);
}

// ───────────────────────────── applications ─────────────────────────────

export function screenshotState(app, now = Date.now()) {
  const none = { has: false, expired: false, daysLeft: 0, hoursLeft: 0, expiresAt: 0 };
  if (!app) return none;
  const born = ts(app.screenshotAt || app.createdAt);
  const expiresAt = born + APPLICATION_SHOT_DAYS * DAY;
  // The Worker blanks the link once it is past retention; an old application with no link is treated the same way.
  if (app.screenshotExpired || (!app.screenshotUrl && born && now >= expiresAt)) return { ...none, has: true, expired: true, expiresAt };
  if (!app.screenshotUrl) return none;
  const expired = Boolean(expiresAt) && now >= expiresAt;
  return { has: true, expired, expiresAt, daysLeft: expired ? 0 : Math.max(0, Math.ceil((expiresAt - now) / DAY)), hoursLeft: expired ? 0 : Math.max(0, Math.ceil((expiresAt - now) / HOUR)) };
}

// A quick, honest strength meter for an application. It nudges, it never blocks.
export function applicationStrength({ hasShot, note = '', sharedUid, sharedDiscord, fit, hasUid, hasDiscord }) {
  const tips = [];
  let score = 10; // the player card itself
  if (hasShot) score += 40; else tips.push({ id: 'shot', text: 'Add a team screenshot. Owners check your squad first.' });
  if (String(note).trim().length >= 20) score += 20; else tips.push({ id: 'note', text: 'Add a short note with when you usually play.' });
  if (sharedUid || sharedDiscord) score += 15; else if (hasUid || hasDiscord) tips.push({ id: 'share', text: 'Share your UID or Discord so the owner can invite you faster.' });
  else tips.push({ id: 'card', text: 'Add your UID or Discord in your player card to be invited faster.' });
  if (fit?.qualifies) score += 15;
  score = Math.min(100, score);
  return { score, label: score >= 80 ? 'Strong' : score >= 55 ? 'Good' : 'Basic', tone: score >= 80 ? 'great' : score >= 55 ? 'good' : 'low', tips };
}

export function noteSuggestions(profile = {}, league = {}) {
  const out = [];
  const sizes = (profile.tournament_sizes || []).slice(0, 2).join(' / ');
  if (profile.availability) out.push('I can play ' + profile.availability.toLowerCase() + (sizes ? ' and usually join ' + sizes + ' tournaments.' : '.'));
  if (league.activeHours) out.push('Happy to follow your schedule (' + league.activeHours + ') and play every tournament.');
  out.push('Active player, ' + (profile.ovr ? 'OVR ' + profile.ovr + ', ' : '') + 'ready to join today and help keep the league active.');
  out.push('Looking for a ' + (COMMIT[league.playerCommitment] || 'regular').toLowerCase() + ' league like yours. I will Kickoff when I can.');
  return [...new Set(out.map(x => clip(x, NOTE_MAX)))].slice(0, 4);
}

export const PIPELINE = [['new', 'Sent'], ['shortlisted', 'Shortlisted'], ['invited', 'Invited'], ['joined', 'Joined']];
export function pipeline(status) {
  const idx = PIPELINE.findIndex(([k]) => k === status);
  const steps = PIPELINE.map(([key, label], i) => ({ key, label, state: idx < 0 ? 'todo' : i < idx ? 'done' : i === idx ? (status === 'joined' ? 'done' : 'now') : 'todo' }));
  const hints = {
    new: 'Waiting for the owner. Most owners reply within a couple of days.',
    shortlisted: 'You are on the shortlist. An invite could come any time.',
    invited: 'Open FC Mobile, go to Leagues and accept the invite.',
    joined: 'You are in. Confirm activity on the league page to help it rank.',
    declined: 'Not this time. Similar leagues below may suit you better.',
    withdrawn: 'You withdrew this application.'
  };
  return { steps, hint: hints[status] || '', closed: ['declined', 'withdrawn'].includes(status) };
}

// An application that has sat unanswered for a few days deserves a nudge.
export function applicationNudge(app, now = Date.now()) {
  if (!app || !['new', 'shortlisted'].includes(app.status)) return null;
  const days = Math.floor((now - ts(app.statusChangedAt || app.createdAt)) / DAY);
  if (days >= 5) return { tone: 'warn', text: 'No reply in ' + days + ' days. Message the owner, or apply to a similar league while you wait.' };
  if (days >= 2) return { tone: 'info', text: 'Sent ' + days + ' days ago. A short message to the owner can speed things up.' };
  return null;
}

// Owner-side triage score: who should I look at first?
export function triageApplications(apps, league, now = Date.now()) {
  const min = Number(league?.minOvr || 0);
  return (apps || []).map(a => {
    const meets = Number(a.ovr || 0) >= min;
    const shot = screenshotState(a, now);
    const region = !league?.regionServer || league.regionServer === 'Worldwide' || same(a.regionServer, league.regionServer);
    let score = 0;
    if (meets) score += 50; else score += Math.max(0, 20 - (min - Number(a.ovr || 0)));
    if (shot.has && !shot.expired) score += 20;
    if (region) score += 10;
    if (a.uid || a.discord) score += 10;
    if (a.message) score += 5;
    if (a.status === 'new') score += 5;
    const flags = [];
    flags.push(meets ? { tone: 'good', text: 'Meets ' + min + '+ OVR' } : { tone: 'warn', text: (min - Number(a.ovr || 0)) + ' OVR below minimum' });
    if (shot.has && !shot.expired) flags.push({ tone: 'good', text: 'Screenshot' });
    else if (shot.expired) flags.push({ tone: 'mute', text: 'Screenshot expired' });
    else flags.push({ tone: 'warn', text: 'No screenshot' });
    if (region && league?.regionServer && league.regionServer !== 'Worldwide') flags.push({ tone: 'good', text: 'Same region' });
    if (a.uid || a.discord) flags.push({ tone: 'good', text: 'Contact shared' });
    return { ...a, _score: Math.min(100, score), _meets: meets, _flags: flags, _shot: shot };
  });
}

// ───────────────────────────── owner brain ─────────────────────────────

export function kickoffState(listing, now = Date.now()) {
  const last = ts(listing?.lastKickoffAt);
  const next = last ? last + KICKOFF_COOLDOWN_MS : 0;
  return { ready: !next || next <= now, nextAt: next > now ? next : 0, msLeft: Math.max(0, next - now) };
}

export function listingExpiry(listing, now = Date.now()) {
  const base = ts(listing?.lastKickoffAt) || ts(listing?.reviewedAt) || ts(listing?.createdAt) || now;
  const expiresAt = base + LISTING_EXPIRY_DAYS * DAY;
  const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / DAY));
  return { expiresAt, daysLeft, pct: Math.max(0, Math.min(100, Math.round(((expiresAt - now) / (LISTING_EXPIRY_DAYS * DAY)) * 100))), soon: daysLeft <= 5 };
}

export function listingHealth(l, { galleryReady = true, now = Date.now() } = {}) {
  const items = [
    { id: 'crest', w: 14, ok: Boolean(l.logoUrl), text: 'Add a league crest', why: 'Crests make a listing look real and easy to spot.', tab: 'edit' },
    { id: 'tagline', w: 14, ok: String(l.tagline || '').trim().length >= 15, text: 'Write a one-line pitch', why: 'It is the first thing players read.', tab: 'edit' },
    { id: 'gallery', w: 14, ok: (l.galleryUrls || []).length > 0, text: 'Add league screenshots', why: 'Show your league table or tournament results.', tab: 'edit', skip: !galleryReady },
    { id: 'hours', w: 10, ok: Boolean(l.activeHours), text: 'Add your usual hours', why: 'Players want to know when you play.', tab: 'edit' },
    { id: 'perks', w: 6, ok: Boolean(l.perks), text: 'Mention a perk or reward', why: 'Even a small perk helps you stand out.', tab: 'edit' },
    { id: 'spots', w: 14, ok: l.openSpots > 0 && l.recruitingOpen, text: 'Open spots for players', why: 'Leagues with no open spots drop out of the finder.', tab: 'controls' },
    { id: 'kick', w: 14, ok: kickoffState(l, now).ready === false || (now - ts(l.lastKickoffAt)) < 7 * DAY, text: 'Press Kickoff this week', why: 'It lifts you to the top and resets the 30-day timer.', tab: 'controls' },
    { id: 'confirm', w: 14, ok: Number(l.confirmations7d || 0) > 0, text: 'Ask leaguemates to confirm activity', why: 'Confirmed activity is what earns the Spotlight.', tab: 'crew' }
  ].filter(i => !i.skip);
  const total = items.reduce((n, i) => n + i.w, 0);
  const earned = items.filter(i => i.ok).reduce((n, i) => n + i.w, 0);
  const score = Math.round(earned / total * 100);
  return { score, grade: score >= 85 ? 'Excellent' : score >= 65 ? 'Good' : score >= 40 ? 'Getting there' : 'Needs work', tips: items.filter(i => !i.ok).sort((a, b) => b.w - a.w) };
}

// The owner's to-do list, most urgent first.
export function ownerActions({ own, newApps = 0, pendingCrew = 0, galleryReady = true, now = Date.now() }) {
  if (!own) return [];
  const out = [];
  const live = own.status === 'approved';
  if (!live) return [{ id: 'status', tone: 'bad', title: own.status === 'paused' ? 'Your league is suspended' : own.status === 'rejected' ? 'Your listing was rejected' : 'Your league is not public', text: own.moderationNote || 'Open the moderation note below.', cta: own.status === 'paused' ? 'Appeal' : 'Edit listing', act: own.status === 'paused' ? 'appeal' : 'edit' }];
  if (newApps > 0) out.push({ id: 'apps', tone: 'hot', title: newApps + (newApps === 1 ? ' new application' : ' new applications'), text: 'Review the best fits first. Applicants wait on you.', cta: 'Review now', act: 'apps' });
  if (pendingCrew > 0) out.push({ id: 'crew', tone: 'info', title: pendingCrew + (pendingCrew === 1 ? ' Leaguemate request' : ' Leaguemate requests'), text: 'Approved Leaguemates can press Kickoff for you.', cta: 'Review', act: 'crew' });
  const ex = listingExpiry(own, now);
  const kick = kickoffState(own, now);
  if (ex.soon) out.push({ id: 'expiry', tone: 'warn', title: 'Listing expires in ' + ex.daysLeft + (ex.daysLeft === 1 ? ' day' : ' days'), text: 'Press Kickoff to keep it live for another 30 days.', cta: kick.ready ? 'Kickoff now' : 'Kickoff soon', act: kick.ready ? 'kickoff' : '' });
  else if (kick.ready && own.recruitingOpen) out.push({ id: 'kick', tone: 'good', title: 'Kickoff is ready', text: 'Move your league to the top of the board for 6 hours.', cta: 'Kickoff', act: 'kickoff' });
  if (own.recruitingOpen && own.openSpots <= 0) out.push({ id: 'full', tone: 'info', title: 'You are full', text: 'No spots left. Close recruiting, or open a spot if someone left.', cta: 'Adjust spots', act: 'controls' });
  if (!own.recruitingOpen) out.push({ id: 'hidden', tone: 'warn', title: 'Hidden from the board', text: 'Recruiting is closed, so players cannot find you.', cta: 'Reopen', act: 'recruit' });
  const h = listingHealth(own, { galleryReady, now });
  for (const t of h.tips.slice(0, 2)) out.push({ id: 'tip-' + t.id, tone: 'tip', title: t.text, text: t.why, cta: t.tab === 'edit' ? 'Edit listing' : 'Open', act: t.tab === 'edit' ? 'edit' : t.tab });
  return out;
}

// ───────────────────────────── listing wizard helpers ─────────────────────────────

export function taglineSuggestions(d = {}) {
  const f = (FREQ[d.tournamentFrequency] || '').toLowerCase();
  const size = (d.tournamentSizes || [])[0] || '';
  const vibe = { casual: 'Friendly and relaxed', regular: 'Friendly and active', competitive: 'Competitive and organised' }[d.playerCommitment || 'regular'];
  const div = divisionByKey(d.division)?.label || '';
  const out = [];
  if (f && size) out.push(f[0].toUpperCase() + f.slice(1) + ' ' + size + ' tournaments. ' + vibe + '.');
  if (div) out.push(div + ' league' + (d.openSpots > 0 ? ' with ' + d.openSpots + ' open ' + (d.openSpots === 1 ? 'spot' : 'spots') : '') + '. ' + vibe + '.');
  if (d.regionServer && size) out.push((d.regionServer === 'Worldwide' ? 'All regions' : d.regionServer + ' players') + ' welcome. ' + (f ? f[0].toUpperCase() + f.slice(1) : 'Regular') + ' ' + size + '.');
  if (d.minOvr) out.push('Active players with ' + d.minOvr + '+ OVR wanted. ' + vibe + '.');
  return [...new Set(out.map(x => clip(x, TAGLINE_MAX)))].slice(0, 4);
}

export const OWNER_REPLIES = [
  'Thanks for applying! Check FC Mobile, I just sent you an invite.',
  'Could you add a clearer screenshot of your starting team? Then I can invite you.',
  'We are full right now, but I will message you when a spot opens.',
  'Welcome to the league! Please play the tournaments and press Confirm activity.'
];
export const PLAYER_REPLIES = [
  'Hi! I just applied. I am online most days and ready to join.',
  'Thanks! I accepted the invite in FC Mobile.',
  'Is there still a spot open? Happy to play every tournament.',
  'Could you tell me the usual tournament hours?'
];

export const clipText = clip;
