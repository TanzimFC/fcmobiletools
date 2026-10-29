// FC Mobile redeem codes: community signal engine.
//
// Pure functions only (no I/O, no clock reads, no Worker or Node APIs), so the same logic
// is used by the Worker and by the unit tests.
//
// What this module decides
// ------------------------
// Players report "Worked" / "Didn't work" on a code. A report is only EVIDENCE, never a verdict:
//
//   1. Admin outranks the crowd. Votes can never change a code's `status`. They only produce a
//      signal (`ok` / `review` / `possibly_expired`) that the page shows as a warning and the
//      admin dashboard shows as a review queue. An admin check resets the evidence (see `epoch`).
//   2. Recent data wins. Every vote decays with a half-life, so a fresh report outweighs many
//      stale ones. Votes older than the window are ignored.
//   3. One vote proves nothing. A code is only flagged when enough independent, recent reports
//      agree, and the agreement is statistically confident (Wilson lower bound on the weighted
//      failure share), not merely a majority.
//   4. Not all voters are equal. Verified accounts count more than anonymous devices, and a
//      single network (one shared mobile IP, one household, one bot farm) can only ever
//      contribute a capped amount of guest weight.
//   5. Flags are sticky but safe. Once flagged, a code stays flagged until the community
//      confirms it works again or an admin acts, so a dead code does not flicker back to
//      "fine" just because the reports aged out.

export const SIGNAL = Object.freeze({
  windowHours: 48, // votes older than this are ignored completely
  halfLifeHours: 6, // a vote's weight halves every 6 hours
  recentHours: 24, // window for the public "worked / failed" counters
  weights: Object.freeze({
    account: 1, // signed in, email verified
    accountUnverified: 0.6, // signed in, email not verified yet
    guest: 0.4, // anonymous device
  }),
  guestNetworkCap: 0.8, // max guest weight one network can contribute per side
  networkCap: 2, // max total weight (accounts and guests together) one network can contribute per side
  newAccountFloor: 0.5, // a brand new account starts at half weight...
  newAccountDays: 7, // ...and reaches full weight after a week
  z: 1.645, // ~95% one-sided confidence
  zRegional: 2.05, // stricter for region-locked codes (players abroad see failures)
  dead: Object.freeze({ voters: 3, votersRegional: 4, sources: 2 }),
  review: Object.freeze({ voters: 2, sources: 2, weight: 1.2, share: 0.5 }),
  working: Object.freeze({ voters: 2, sources: 2 }),
  reviewLapseHours: 48, // an unattended `review` flag lapses after this long without a new failure
});

export const STATES = Object.freeze(['ok', 'review', 'possibly_expired']);
export const VERDICTS = Object.freeze(['worked', 'failed']);

const HOUR_MS = 3_600_000;

export const toMs = (value) => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const ms = Date.parse(String(value ?? ''));
  return Number.isFinite(ms) ? ms : NaN;
};

/** Exponential decay: 1 for a brand new vote, 0.5 after one half-life, and so on. */
export function decay(ageMs, halfLifeHours = SIGNAL.halfLifeHours) {
  if (!(ageMs > 0)) return 1;
  return Math.pow(0.5, ageMs / (halfLifeHours * HOUR_MS));
}

/**
 * Lower bound of the Wilson score interval for a proportion `p` observed over `n` (weighted)
 * trials. It answers: "even being cautious, what share of players really see this outcome?".
 * With unanimous reports it reaches 0.5 only once n >= z^2 (about 2.7 weighted votes).
 */
export function wilsonLower(p, n, z = SIGNAL.z) {
  if (!(n > 0)) return 0;
  const clamped = Math.min(1, Math.max(0, p));
  const z2 = z * z;
  const centre = clamped + z2 / (2 * n);
  const margin = z * Math.sqrt((clamped * (1 - clamped) + z2 / (4 * n)) / n);
  return Math.max(0, Math.min(1, (centre - margin) / (1 + z2 / n)));
}

/** A code is "regional" unless its region label starts with "Global" (an empty label means Global). */
export const isRegional = (region) => {
  const label = String(region ?? '').trim();
  return label !== '' && !/^global/i.test(label);
};

/**
 * Stable, privacy-friendly network key. IPv4 is used as is, IPv6 is reduced to its /64 prefix
 * because one household rotates through the whole /64 with privacy addresses.
 * The Worker hashes this value with a private salt before storing it.
 */
export function networkKey(ip) {
  const raw = String(ip ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (!raw.includes(':')) return raw;
  const mapped = raw.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  const sides = raw.split('::');
  if (sides.length > 2) return `v6:${raw}`;
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides.length === 2 && sides[1] ? sides[1].split(':') : [];
  let groups;
  if (sides.length === 2) {
    const missing = 8 - left.length - right.length;
    if (missing < 0) return `v6:${raw}`;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else groups = left;
  if (groups.length !== 8) return `v6:${raw}`;
  return `v6:${groups.slice(0, 4).map((g) => g.padStart(4, '0')).join(':')}`;
}

/**
 * How much one signed-in player's report is worth. Verified email counts fully, unverified
 * counts less, and a brand new account counts half until it is a week old, so a freshly made
 * account cannot swing a verdict.
 */
export function accountWeight({ verified = false, createdAt = null, now = Date.now() } = {}) {
  const created = toMs(createdAt);
  const ageDays = Number.isFinite(created) ? Math.max(0, (toMs(now) - created) / 86_400_000) : SIGNAL.newAccountDays / 2;
  const ramp = SIGNAL.newAccountFloor + (1 - SIGNAL.newAccountFloor) * Math.min(1, ageDays / SIGNAL.newAccountDays);
  const base = verified ? SIGNAL.weights.account : SIGNAL.weights.accountUnverified;
  return Math.round(base * ramp * 1000) / 1000;
}

const clampWeight = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : SIGNAL.weights.guest;
};

function emptySide() {
  return { nets: new Map(), keys: new Set(), recent: new Set(), lastMs: 0 };
}

function finishSide(side) {
  let weight = 0;
  for (const group of side.nets.values()) {
    // One network (a household, a shared mobile IP, a bot farm) can only ever add a limited
    // amount of weight, whoever is behind it. Anonymous devices are capped harder than accounts.
    const guests = Math.min(group.guestWeight, SIGNAL.guestNetworkCap);
    weight += Math.min(group.accountWeight + guests, SIGNAL.networkCap);
  }
  return {
    weight,
    voters: side.keys.size,
    // Independent sources = distinct networks. Ten accounts on one IP are one source.
    sources: side.nets.size,
    recentVoters: side.recent.size,
    lastMs: side.lastMs,
  };
}

/**
 * Turns raw vote rows into numbers.
 * Each vote row: { voter_key, voter_kind: 'account'|'guest', verdict, base_weight, net_hash, updated_at }.
 * `epoch` (ms) is the moment an admin last reset the evidence: older votes are ignored.
 */
export function scoreVotes(votes, { now, epoch = 0, regional = false } = {}) {
  const nowMs = toMs(now);
  const epochMs = Number.isFinite(toMs(epoch)) ? toMs(epoch) : 0;
  const floor = Math.max(epochMs, nowMs - SIGNAL.windowHours * HOUR_MS);
  const sides = { worked: emptySide(), failed: emptySide() };

  for (const v of votes || []) {
    const side = sides[v?.verdict];
    if (!side) continue;
    const t = toMs(v.updated_at ?? v.updatedAt);
    // Ignore stale votes and anything dated in the future (clock skew or tampering).
    if (!Number.isFinite(t) || t < floor || t > nowMs + 60_000) continue;

    const key = String(v.voter_key || '');
    if (!key) continue;
    const w = clampWeight(v.base_weight ?? v.weight) * decay(nowMs - t);

    const net = String(v.net_hash || key);
    const group = side.nets.get(net) || { accountWeight: 0, guestWeight: 0 };
    if (v.voter_kind === 'guest') group.guestWeight += w; else group.accountWeight += w;
    side.nets.set(net, group);
    side.keys.add(key);
    if (nowMs - t <= SIGNAL.recentHours * HOUR_MS) side.recent.add(key);
    if (t > side.lastMs) side.lastMs = t;
  }

  const worked = finishSide(sides.worked);
  const failed = finishSide(sides.failed);
  const total = worked.weight + failed.weight;
  const failShare = total > 0 ? failed.weight / total : 0;
  const z = regional ? SIGNAL.zRegional : SIGNAL.z;

  return {
    worked,
    failed,
    total,
    failShare,
    regional: Boolean(regional),
    wilsonFail: wilsonLower(failShare, total, z),
    wilsonWork: wilsonLower(total > 0 ? 1 - failShare : 0, total, z),
    lastVoteMs: Math.max(worked.lastMs, failed.lastMs),
  };
}

/**
 * State machine. `previous` is the persisted state; the result adds hysteresis so a flag does
 * not flicker: a flagged code only clears when players confirm it works again (or, for the
 * softer `review` flag, when nobody has reported a failure for a long time).
 */
export function decideState(score, { previous = 'ok', now } = {}) {
  const nowMs = toMs(now);
  const { failed, worked } = score;

  const minDead = score.regional ? SIGNAL.dead.votersRegional : SIGNAL.dead.voters;
  const dead = failed.voters >= minDead && failed.sources >= SIGNAL.dead.sources && score.wilsonFail >= 0.5;
  const review = failed.voters >= SIGNAL.review.voters
    && failed.sources >= SIGNAL.review.sources
    && failed.weight >= SIGNAL.review.weight
    && score.failShare >= SIGNAL.review.share;
  const working = worked.voters >= SIGNAL.working.voters
    && worked.sources >= SIGNAL.working.sources
    && score.wilsonWork >= 0.5;

  const candidate = dead ? 'possibly_expired' : review ? 'review' : 'ok';
  const prev = STATES.includes(previous) ? previous : 'ok';
  const quietHours = failed.lastMs ? (nowMs - failed.lastMs) / HOUR_MS : Infinity;

  let state;
  if (candidate === 'possibly_expired') state = 'possibly_expired';
  else if (prev === 'possibly_expired') state = working ? 'ok' : 'possibly_expired';
  else if (candidate === 'review') state = 'review';
  else if (prev === 'review') state = working || quietHours >= SIGNAL.reviewLapseHours ? 'ok' : 'review';
  else state = 'ok';

  return { state, candidate, working };
}

/* ------------------------------------------------------------------ */
/* Row mapping (persisted signal row -> API shapes)                    */
/* ------------------------------------------------------------------ */

const DEFAULT_ROW = Object.freeze({ state: 'ok' });

/**
 * What the public page may see. Deliberately tiny: a label, a freshness time, and when an admin
 * last re-checked. No counts, no weights, no voter data, so nothing here can be gamed by
 * watching numbers, and the page can speak in plain words.
 */
export function toPublicSignal(row) {
  const r = row || DEFAULT_ROW;
  const state = STATES.includes(r.state) ? r.state : 'ok';
  return {
    state,
    confirmed: state === 'ok' && Number(r.confirmed) === 1,
    lastAt: r.last_vote_at || null,
    resetAt: r.epoch_start || null,
  };
}

/** What the admin dashboard sees: the evidence behind the flag. */
export function toAdminSignal(row) {
  const r = row || DEFAULT_ROW;
  return {
    ...toPublicSignal(row),
    worked: Number(r.worked_24h) || 0,
    failed: Number(r.failed_24h) || 0,
    since: r.state_since || null,
    failWeight: Number(r.fail_w) || 0,
    workWeight: Number(r.work_w) || 0,
    failSources: Number(r.fail_sources) || 0,
    workSources: Number(r.work_sources) || 0,
    confidence: Number(r.wilson_fail) || 0,
    lastFailAt: r.last_fail_at || null,
    lastWorkAt: r.last_work_at || null,
    resolvedBy: r.resolved_by || null,
    resolvedAt: r.resolved_at || null,
  };
}
