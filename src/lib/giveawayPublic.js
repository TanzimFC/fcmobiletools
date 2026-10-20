// Public (signed-out safe) giveaway data. Used by the Worker API and by the server-rendered pages,
// so both always show the same thing. Nothing here returns a secret: the draw seed is only
// included after an admin publishes the results, and claim codes never leave the Worker.
import { requirementsFor, cleanMilestones, unlockedMilestones, money, KINDS } from '../data/giveawayConfig.js';
import { maskName } from './giveawayDraw.js';

export const PUBLIC_COLUMNS = [
  'id', 'slug', 'kind', 'title', 'tagline', 'description', 'status', 'prize_label', 'prize_cents',
  'bonus_prize_cents', 'currency', 'winner_count', 'alternate_count', 'cover_url', 'accent', 'starts_at',
  'ends_at', 'proof_ttl_hours', 'claim_window_hours', 'requirements', 'milestones', 'bonus', 'rules_version',
  'seed_commit', 'entries_hash', 'drawn_at', 'results_published_at', 'seed_revealed_at', 'created_at'
].join(',');

const VISIBLE = '(live,closed,drawn,completed)';
const OPEN_WINNER = ['awaiting_claim', 'code_verified', 'paid'];

export function effectiveStatus(row, now = Date.now()) {
  if (row.status === 'live') {
    if (row.starts_at && Date.parse(row.starts_at) > now) return 'upcoming';
    if (row.ends_at && Date.parse(row.ends_at) <= now) return 'closed';
  }
  return row.status;
}

export async function loadOfficial(env, rest) {
  try {
    const rows = await rest(env, 'giveaway_settings?key=eq.official&select=value&limit=1');
    const v = rows?.[0]?.value || {};
    return {
      discordInvite: /^https:\/\//i.test(v.discord_invite || '') ? v.discord_invite : '',
      discordHandle: String(v.discord_handle || '').slice(0, 64),
      instagramHandle: String(v.instagram_handle || '').slice(0, 64),
      instagramUrl: /^https:\/\//i.test(v.instagram_url || '') ? v.instagram_url : '',
      notice: String(v.notice || '').slice(0, 300)
    };
  } catch {
    return { discordInvite: '', discordHandle: '', instagramHandle: '', instagramUrl: '', notice: '' };
  }
}

async function entryCount(env, rest, id) {
  try {
    const out = await rest(env, 'rpc/giveaway_public_stats', { method: 'POST', body: JSON.stringify({ p_giveaway: id }) });
    return Number(out?.entries || 0);
  } catch { return 0; }
}

export function shapeGiveaway(row, entries, official, now = Date.now()) {
  const status = effectiveStatus(row, now);
  const ms = unlockedMilestones(row.milestones, entries);
  const baseWinners = Number(row.winner_count || 1);
  const bonusWinners = ms.bonusWinners;
  const kind = KINDS[row.kind] || KINDS.custom;
  const revealed = Boolean(row.seed_revealed_at);
  return {
    id: row.id, slug: row.slug, kind: row.kind, kindLabel: kind.label, title: row.title, tagline: row.tagline,
    description: row.description, status, rawStatus: row.status,
    prize: {
      label: Number(row.prize_cents || 0) > 0 ? row.prize_label : 'In-game reward · no real cash value',
      cents: row.prize_cents, bonusCents: row.bonus_prize_cents, currency: row.currency,
      display: Number(row.prize_cents || 0) > 0 ? money(row.prize_cents, row.currency) : String(row.prize_label || 'In-game reward').split(' · ')[0],
      bonusDisplay: Number(row.bonus_prize_cents || 0) > 0 ? money(row.bonus_prize_cents, row.currency) : ''
    },
    winners: { base: baseWinners, bonus: bonusWinners, total: baseWinners + bonusWinners, alternates: Number(row.alternate_count || 0) },
    coverUrl: row.cover_url || '', accent: row.accent || kind.accent,
    startsAt: row.starts_at, endsAt: row.ends_at, createdAt: row.created_at,
    proofTtlHours: row.proof_ttl_hours, claimWindowHours: row.claim_window_hours,
    requirements: requirementsFor(row.requirements),
    milestones: {
      list: cleanMilestones(row.milestones).map((m) => ({ ...m, unlocked: entries >= m.entries })),
      next: ms.next
    },
    bonus: { daily: false, dailyCap: 0, referral: false, referralCap: 0 },
    stats: { entries },
    rulesVersion: row.rules_version,
    fairness: {
      seedCommit: row.seed_commit || '', entriesHash: row.entries_hash || '', drawnAt: row.drawn_at,
      resultsPublished: Boolean(row.results_published_at), seedRevealed: revealed
    },
    official
  };
}

function winnerRows(rows, nameById, prizeLabel = 'In-game reward') {
  return rows
    .filter((w) => OPEN_WINNER.includes(w.status))
    .sort((a, b) => (a.slot || 0) - (b.slot || 0))
    .map((w) => ({
      slot: w.slot, rank: w.rank_position, name: maskName(nameById.get(w.account_id) || 'player'),
      prize: Number(w.prize_cents || 0) > 0 ? money(w.prize_cents, w.currency || 'USD') : prizeLabel,
      status: w.status === 'paid' ? 'paid' : w.status === 'code_verified' ? 'verified' : 'awaiting',
      paidAt: w.paid_at || null, proofUrl: w.payout_proof_url || ''
    }));
}

async function namesFor(env, rest, ids) {
  const map = new Map();
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return map;
  const rows = await rest(env, 'accounts?id=in.(' + unique.join(',') + ')&select=id,username');
  for (const r of rows || []) map.set(r.id, r.username);
  return map;
}

export async function loadWinners(env, rest, giveawayId, currency, prizeLabel = 'In-game reward') {
  const rows = await rest(env, 'giveaway_winners?giveaway_id=eq.' + giveawayId +
    '&status=in.(awaiting_claim,code_verified,paid)&select=slot,rank_position,status,prize_cents,paid_at,payout_proof_url,account_id&order=slot.asc');
  const names = await namesFor(env, rest, (rows || []).map((r) => r.account_id));
  return winnerRows((rows || []).map((r) => ({ ...r, currency })), names, prizeLabel);
}

const PREVIEW_SLUG = 'ballon-dor-star-pass-giveaway';

function publicPreview(row, g) {
  if (row.status === 'draft' && row.slug === PREVIEW_SLUG) {
    g.status = 'upcoming';
    g.rawStatus = 'upcoming';
    g.previewOnly = true;
    g.tagline = 'Entry opens soon. The Ballon d’Or Star Pass is an in-game reward with no real cash value.';
  }
  return g;
}

export async function loadPublicList(env, rest) {
  const [visibleRows, previewRows, official] = await Promise.all([
    rest(env, 'giveaways?status=in.' + VISIBLE + '&select=' + PUBLIC_COLUMNS + '&order=created_at.desc&limit=30'),
    rest(env, 'giveaways?slug=eq.' + PREVIEW_SLUG + '&status=eq.draft&select=' + PUBLIC_COLUMNS + '&limit=1').catch(() => []),
    loadOfficial(env, rest)
  ]);
  // Only this explicitly named campaign can appear while draft. Other drafts remain private.
  // The entry API still checks the stored status and rejects all entries until the admin opens it.
  const rows = [...(visibleRows || []), ...(previewRows || [])];
  const list = await Promise.all(rows.map(async (row) => {
    const g = publicPreview(row, shapeGiveaway(row, await entryCount(env, rest, row.id), official));
    if (row.results_published_at) {
      try { g.results = { winners: await loadWinners(env, rest, row.id, row.currency, row.prize_label) }; } catch { g.results = { winners: [] }; }
    }
    return g;
  }));
  return { giveaways: list, official, serverTime: new Date().toISOString() };
}

export async function loadPublicOne(env, rest, slug) {
  let rows = await rest(env, 'giveaways?slug=eq.' + encodeURIComponent(slug) + '&status=in.' + VISIBLE + '&select=' + PUBLIC_COLUMNS + '&limit=1');
  let row = rows?.[0];
  if (!row && slug === PREVIEW_SLUG) {
    rows = await rest(env, 'giveaways?slug=eq.' + PREVIEW_SLUG + '&status=eq.draft&select=' + PUBLIC_COLUMNS + '&limit=1').catch(() => []);
    row = rows?.[0];
  }
  if (!row) return null;
  const [entries, official] = await Promise.all([entryCount(env, rest, row.id), loadOfficial(env, rest)]);
  const g = publicPreview(row, shapeGiveaway(row, entries, official));
  if (row.results_published_at) {
    g.results = { winners: await loadWinners(env, rest, row.id, row.currency, row.prize_label) };
  }
  return g;
}

// Hall of fame across all giveaways: most recent paid winners first.
export async function loadWinnersWall(env, rest, limit = 12) {
  const rows = await rest(env, 'giveaway_winners?status=eq.paid&select=giveaway_id,account_id,prize_cents,paid_at,payout_proof_url&order=paid_at.desc&limit=' + Math.min(40, limit));
  const ids = [...new Set((rows || []).map((r) => r.giveaway_id))];
  const gmap = new Map();
  if (ids.length) {
    for (const g of (await rest(env, 'giveaways?id=in.(' + ids.join(',') + ')&results_published_at=not.is.null&select=id,title,slug,currency,prize_label')) || []) gmap.set(g.id, g);
  }
  const names = await namesFor(env, rest, (rows || []).map((r) => r.account_id));
  const totalPaid = (rows || []).reduce((n, r) => n + (r.prize_cents || 0), 0);
  const totalDelivered = (rows || []).filter((r) => gmap.has(r.giveaway_id)).length;
  return {
    totalPaidCents: totalPaid, totalDelivered,
    winners: (rows || []).filter((r) => gmap.has(r.giveaway_id)).map((r) => ({
      name: maskName(names.get(r.account_id) || 'player'), prize: Number(r.prize_cents || 0) > 0 ? money(r.prize_cents, gmap.get(r.giveaway_id).currency) : (gmap.get(r.giveaway_id).prize_label || 'In-game reward'),
      giveaway: gmap.get(r.giveaway_id).title, slug: gmap.get(r.giveaway_id).slug, paidAt: r.paid_at, proofUrl: r.payout_proof_url || ''
    }))
  };
}
