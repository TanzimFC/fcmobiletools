// Shared giveaway configuration. Used by the Worker, the public pages and the tests.
// Nothing here is secret.

export const SITE_ORIGIN = 'https://fcmobiletools.online';
export const RULES_VERSION = '2026-10-18';

export const KINDS = Object.freeze({
  ballon_dor: { label: "Ballon d'Or Giveaway", short: "Ballon d'Or", accent: '#f6c453' },
  star_pass: { label: 'Star Pass Giveaway', short: 'Star Pass', accent: '#4cc9ff' },
  custom: { label: 'Special Giveaway', short: 'Special', accent: '#9a8cff' }
});

export const OFFICIAL_YOUTUBE = Object.freeze([
  { id: 'yt_ashverse', name: 'Ashverse United', url: 'https://youtube.com/@ashverseunited' },
  { id: 'yt_tanzimfc', name: 'TanzimFC', url: 'https://youtube.com/@tanzimfc' }
]);

// Requirement types:
//   auto  : checked from our own records (profile, survey, quest). No input needed.
//   text  : the entrant types something (Discord username). Reviewed by a human.
//   image : the entrant uploads a screenshot. Stored as a temporary image, reviewed by a human.
export const DEFAULT_REQUIREMENTS = Object.freeze([
  { id: 'profile', type: 'profile_complete', input: 'auto', required: true, label: 'Complete your profile',
    help: 'Add your FC Mobile UID, in-game name and server in your profile.', link: '/profile/' },
  { id: 'survey', type: 'survey_complete', input: 'auto', required: true, label: 'Complete one survey',
    help: 'Finish any survey on FCMobiletools. It takes about two minutes.', link: '/surveys/' },
  { id: 'quest', type: 'quest_complete', input: 'auto', required: true, label: 'Complete one quest',
    help: 'Finish any quest from your Missions page.', link: '/missions/' },
  { id: 'discord', type: 'discord_join', input: 'text', required: true, label: 'Join the official Discord',
    help: 'Join our server, then type your exact Discord username here.', link: '' },
  { id: 'yt_ashverse', type: 'youtube_subscribe', input: 'image', required: true, label: 'Subscribe to Ashverse United',
    help: 'Upload a screenshot that shows the Subscribed button on this channel.', link: 'https://youtube.com/@ashverseunited' },
  { id: 'yt_tanzimfc', type: 'youtube_subscribe', input: 'image', required: true, label: 'Subscribe to TanzimFC',
    help: 'Upload a screenshot that shows the Subscribed button on this channel.', link: 'https://youtube.com/@tanzimfc' }
]);

const REQ_TYPES = new Set(['profile_complete', 'survey_complete', 'quest_complete', 'discord_join', 'youtube_subscribe', 'custom_text', 'custom_image']);
const INPUT_FOR = { profile_complete: 'auto', survey_complete: 'auto', quest_complete: 'auto', discord_join: 'text', youtube_subscribe: 'image', custom_text: 'text', custom_image: 'image' };

// Always returns a clean list. Bad or missing config falls back to the defaults.
export function requirementsFor(raw) {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_REQUIREMENTS.map((r) => ({ ...r }));
  const seen = new Set();
  const out = [];
  for (const item of raw.slice(0, 12)) {
    const id = String(item?.id || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 32);
    const type = String(item?.type || '');
    if (!id || seen.has(id) || !REQ_TYPES.has(type)) continue;
    seen.add(id);
    let link = String(item.link || '').trim().slice(0, 300);
    if (link && !/^https:\/\//i.test(link) && !link.startsWith('/')) link = '';
    out.push({
      id, type, input: INPUT_FOR[type], required: item.required !== false,
      label: String(item.label || id).trim().slice(0, 90),
      help: String(item.help || '').trim().slice(0, 240),
      link
    });
  }
  return out.length ? out : DEFAULT_REQUIREMENTS.map((r) => ({ ...r }));
}

// Penalty ladder for confirmed rule breaking. null means permanent.
export const BAN_LADDER_DAYS = Object.freeze([14, 60, 180, null]);
export function banDaysForStrike(strike) {
  const i = Math.max(1, Math.floor(Number(strike) || 1)) - 1;
  return i >= BAN_LADDER_DAYS.length ? null : BAN_LADDER_DAYS[i];
}

export const BONUS_DEFAULTS = Object.freeze({ daily: true, dailyCap: 7, referral: true, referralCap: 10 });

// Milestones: [{ entries, label, bonus_winners }]. Unlocked when the entry count reaches them.
export function cleanMilestones(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).map((m) => ({
    entries: Math.max(1, Math.min(10000000, Math.floor(Number(m?.entries) || 0))),
    label: String(m?.label || '').trim().slice(0, 80),
    bonus_winners: Math.max(0, Math.min(20, Math.floor(Number(m?.bonus_winners) || 0)))
  })).filter((m) => m.entries > 0 && m.label).sort((a, b) => a.entries - b.entries);
}
export function unlockedMilestones(milestones, entryCount) {
  const list = cleanMilestones(milestones);
  const done = list.filter((m) => entryCount >= m.entries);
  const next = list.find((m) => entryCount < m.entries) || null;
  return { done, next, bonusWinners: done.reduce((n, m) => n + m.bonus_winners, 0) };
}

export const ENTRY_STATUS = Object.freeze({
  provisional: 'In the draw, awaiting review',
  approved: 'Approved',
  needs_proof: 'Corrected proof needed',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  disqualified: 'Disqualified'
});

export const WINNER_STATUS = Object.freeze({
  alternate: 'Alternate',
  selected: 'Selected, under review',
  awaiting_claim: 'Awaiting claim',
  code_verified: 'Claim verified',
  paid: 'Paid',
  forfeited: 'Forfeited',
  replaced: 'Replaced'
});

export const FAQ = Object.freeze([
  ['Is it really free to enter?', 'Yes. You never pay to enter, and you never need to watch, click or interact with any advertisement. Every requirement is a free action: complete your profile, finish a survey and a quest, join our Discord and subscribe to two channels.'],
  ['How are winners chosen?', 'By a provably fair draw. Before entries open we publish a fingerprint of a secret seed. After the draw we reveal the seed, and anyone can re-run the draw on the giveaway page to confirm the result. Extra tickets from daily boosts and referrals improve your odds but never guarantee a win.'],
  ['What is the secret claim code?', 'When you win, your account shows a private claim code. You send that code to our official Discord or Instagram account, and only our admins can check it. Nobody can claim your prize without it, so never share it with anyone else.'],
  ['How do I get paid?', 'Prizes are paid outside this website, using a method agreed with you in a private chat on our official Discord or Instagram. We never ask for passwords, card numbers, one-time codes or fees.'],
  ['Why are my screenshots deleted after 24 hours?', 'Proof screenshots are uploaded as temporary images that delete themselves, so we keep as little of your data as possible. If a proof expires before review, we ask you to upload it again.'],
  ['What happens if I cheat?', 'Fake or reused proof, duplicate accounts and bots lead to removal and a pause from all giveaways, longer each time. Read the full Rules for the exact penalties.']
]);

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (cents, cur = 'USD') => {
  const n = Number(cents || 0) / 100;
  const whole = Number.isInteger(n);
  return (cur === 'USD' ? '$' : cur + ' ') + n.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
};
