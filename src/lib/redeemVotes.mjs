// FC Mobile redeem codes: community votes in Cloudflare D1.
//
// Tables (created on demand, same pattern as redeem.js):
//   redeem_votes         one current vote per voter per code (voting again updates it)
//   redeem_code_signals  one derived row per code: state, counters, and the admin `epoch_start`
//   redeem_vote_rate     fixed-window request counters used for throttling
//
// The scoring lives in redeem-signal.js (pure). This file only moves data and enforces limits.
// It assumes `redeem_codes` and `redeem_meta` exist: call ensureRedeemSchema() (redeem.js) first,
// which also calls ensureVoteSchema() below.

import {
  SIGNAL, toMs, scoreVotes, decideState, isRegional, toPublicSignal, toAdminSignal,
} from './redeem-signal.js';

export class VoteError extends Error {
  constructor(message, status = 400, code = 'bad_request') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const VOTE_LIMITS = Object.freeze({
  voterPerHour: 40, // requests per voter per hour (every request counts, even rejected ones)
  networkPerHour: 150, // requests per network per hour: generous, shared mobile IPs are common
  guestsPerCodeNetwork: 4, // distinct anonymous devices per network per code
  maxChanges: 3, // how many times a voter may flip their verdict on one code
  refreshAfterMs: 10 * 60 * 1000, // re-sending the same verdict only refreshes it after this long
  retentionDays: 10, // raw votes (and their network hash) are deleted after this
});

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

let schemaReady = null;

export function ensureVoteSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS redeem_votes (
        code TEXT NOT NULL,
        voter_key TEXT NOT NULL,
        voter_kind TEXT NOT NULL CHECK (voter_kind IN ('account','guest')),
        verdict TEXT NOT NULL CHECK (verdict IN ('worked','failed')),
        base_weight REAL NOT NULL,
        net_hash TEXT,
        changes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (code, voter_key)
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_redeem_votes_code_time ON redeem_votes(code, updated_at)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_redeem_votes_voter ON redeem_votes(voter_key, updated_at)'),
      db.prepare(`CREATE TABLE IF NOT EXISTS redeem_code_signals (
        code TEXT PRIMARY KEY,
        state TEXT NOT NULL DEFAULT 'ok' CHECK (state IN ('ok','review','possibly_expired')),
        state_since TEXT,
        epoch_start TEXT NOT NULL DEFAULT '',
        worked_24h INTEGER NOT NULL DEFAULT 0,
        failed_24h INTEGER NOT NULL DEFAULT 0,
        fail_w REAL NOT NULL DEFAULT 0,
        work_w REAL NOT NULL DEFAULT 0,
        fail_sources INTEGER NOT NULL DEFAULT 0,
        work_sources INTEGER NOT NULL DEFAULT 0,
        wilson_fail REAL NOT NULL DEFAULT 0,
        wilson_work REAL NOT NULL DEFAULT 0,
        confirmed INTEGER NOT NULL DEFAULT 0,
        last_vote_at TEXT,
        last_fail_at TEXT,
        last_work_at TEXT,
        resolved_by TEXT,
        resolved_at TEXT,
        updated_at TEXT NOT NULL
      )`),
      db.prepare(`CREATE TABLE IF NOT EXISTS redeem_vote_rate (
        bucket TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        window_start INTEGER NOT NULL
      )`),
    ]).catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

/* ------------------------------------------------------------------ */
/* Identity hashing                                                    */
/* ------------------------------------------------------------------ */

// The salt is generated once, kept in D1 and never returned by any API, so stored hashes cannot
// be reversed or matched against another site's data. No Worker secret is needed.
let saltPromise = null;

function loadSalt(db) {
  if (!saltPromise) {
    saltPromise = (async () => {
      const read = () => db.prepare("SELECT value FROM redeem_meta WHERE key='vote_salt'").first();
      let row = await read();
      if (!row) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        await db.prepare("INSERT OR IGNORE INTO redeem_meta (key,value) VALUES ('vote_salt',?1)").bind(hex).run();
        row = await read();
      }
      return row.value;
    })().catch((error) => { saltPromise = null; throw error; });
  }
  return saltPromise;
}

/** HMAC-SHA256(salt, `${namespace}:${value}`), shortened to 32 hex characters. */
export async function hashIdentity(db, namespace, value) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(await loadSalt(db)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${namespace}:${value}`)));
  return Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* Throttling                                                          */
/* ------------------------------------------------------------------ */

async function underLimit(db, bucket, limit, windowSec, nowSec) {
  const windowStart = nowSec - windowSec;
  const row = await db.prepare(`INSERT INTO redeem_vote_rate (bucket, count, window_start) VALUES (?1, 1, ?2)
    ON CONFLICT(bucket) DO UPDATE SET
      count = CASE WHEN redeem_vote_rate.window_start < ?3 THEN 1 ELSE redeem_vote_rate.count + 1 END,
      window_start = CASE WHEN redeem_vote_rate.window_start < ?3 THEN ?2 ELSE redeem_vote_rate.window_start END
    RETURNING count`).bind(bucket, nowSec, windowStart).first();
  return Number(row?.count || 1) <= limit;
}

async function throttle(db, voterKey, netHash, nowMs) {
  const nowSec = Math.floor(nowMs / 1000);
  if (!(await underLimit(db, `v:${voterKey}`, VOTE_LIMITS.voterPerHour, 3600, nowSec))
    || (netHash && !(await underLimit(db, `n:${netHash}`, VOTE_LIMITS.networkPerHour, 3600, nowSec)))) {
    throw new VoteError('You are sending reports too quickly. Try again in a little while.', 429, 'rate_limited');
  }
}

/* ------------------------------------------------------------------ */
/* Eligibility                                                         */
/* ------------------------------------------------------------------ */

// Mirrors effectiveStatus() in redeem.js (a unit test keeps the two in step). Kept local so this
// module does not import redeem.js, which imports this one.
export function isVotable(row, today) {
  if (!row || row.status !== 'active') return false;
  if (row.expiry_date && row.expiry_date < today) return false;
  return row.release_date <= today;
}

const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Recompute                                                           */
/* ------------------------------------------------------------------ */

const iso = (ms) => (ms > 0 ? new Date(ms).toISOString() : null);

const UPSERT_SIGNAL = `INSERT INTO redeem_code_signals
  (code,state,state_since,epoch_start,worked_24h,failed_24h,fail_w,work_w,fail_sources,work_sources,
   wilson_fail,wilson_work,confirmed,last_vote_at,last_fail_at,last_work_at,updated_at)
  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)
  ON CONFLICT(code) DO UPDATE SET
    state=excluded.state, state_since=excluded.state_since,
    worked_24h=excluded.worked_24h, failed_24h=excluded.failed_24h,
    fail_w=excluded.fail_w, work_w=excluded.work_w,
    fail_sources=excluded.fail_sources, work_sources=excluded.work_sources,
    wilson_fail=excluded.wilson_fail, wilson_work=excluded.wilson_work, confirmed=excluded.confirmed,
    last_vote_at=excluded.last_vote_at, last_fail_at=excluded.last_fail_at, last_work_at=excluded.last_work_at,
    updated_at=excluded.updated_at`;

const round = (n, places = 3) => Math.round(n * 10 ** places) / 10 ** places;

/**
 * Re-scores one code from its votes and stores the result. Returns the stored row plus whether
 * anything players can see on the public page changed (so the Worker knows to purge its cache).
 */
export async function recomputeSignal(db, code, nowMs = Date.now(), codeRow = null) {
  const prev = await db.prepare('SELECT * FROM redeem_code_signals WHERE code=?1').bind(code).first();
  const region = codeRow ? codeRow.region : (await db.prepare('SELECT region FROM redeem_codes WHERE code=?1').bind(code).first())?.region;

  const epochMs = Number.isFinite(toMs(prev?.epoch_start)) ? toMs(prev.epoch_start) : 0;
  const floorMs = Math.max(epochMs, nowMs - SIGNAL.windowHours * HOUR_MS);
  const { results } = await db.prepare(`SELECT voter_key, voter_kind, verdict, base_weight, net_hash, updated_at
    FROM redeem_votes WHERE code=?1 AND updated_at>=?2`).bind(code, new Date(floorMs).toISOString()).all();

  const score = scoreVotes(results || [], { now: nowMs, epoch: epochMs, regional: isRegional(region) });
  const decision = decideState(score, { previous: prev?.state || 'ok', now: nowMs });
  const nowIso = new Date(nowMs).toISOString();
  const stateSince = decision.state !== (prev?.state || 'ok') ? nowIso : (prev?.state_since || nowIso);

  await db.prepare(UPSERT_SIGNAL).bind(
    code, decision.state, stateSince, prev?.epoch_start || '',
    score.worked.recentVoters, score.failed.recentVoters,
    round(score.failed.weight), round(score.worked.weight),
    score.failed.sources, score.worked.sources,
    round(score.wilsonFail), round(score.wilsonWork), decision.working ? 1 : 0,
    iso(score.lastVoteMs), iso(score.failed.lastMs), iso(score.worked.lastMs), nowIso,
  ).run();

  const row = await db.prepare('SELECT * FROM redeem_code_signals WHERE code=?1').bind(code).first();
  const before = toPublicSignal(prev);
  const after = toPublicSignal(row);
  return { row, before, after, publicChanged: before.state !== after.state || before.confirmed !== after.confirmed };
}

/* ------------------------------------------------------------------ */
/* Casting a vote                                                      */
/* ------------------------------------------------------------------ */

/**
 * voter: { key, kind: 'account'|'guest', weight }, netHash: hashed network key or ''.
 * verdict: 'worked' | 'failed' | 'clear' (retract my vote).
 */
export async function castVote(db, { code, verdict, voter, netHash = '', now = Date.now() }) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!CODE_RE.test(normalized)) throw new VoteError('That is not a valid code.', 400, 'bad_code');
  if (!['worked', 'failed', 'clear'].includes(verdict)) throw new VoteError('Choose "Worked" or "Didn\'t work".', 400, 'bad_verdict');
  if (!voter?.key || !['account', 'guest'].includes(voter.kind)) throw new VoteError('Could not identify the voter.', 400, 'bad_voter');

  const nowMs = toMs(now);
  const nowIso = new Date(nowMs).toISOString();
  await throttle(db, voter.key, netHash, nowMs);

  const row = await db.prepare('SELECT code,status,release_date,expiry_date,region FROM redeem_codes WHERE code=?1').bind(normalized).first();
  if (!row) throw new VoteError('That code no longer exists.', 404, 'not_found');

  const existing = await db.prepare('SELECT verdict, changes, updated_at FROM redeem_votes WHERE code=?1 AND voter_key=?2')
    .bind(normalized, voter.key).first();
  let changed = false;

  if (verdict === 'clear') {
    if (existing) {
      await db.prepare('DELETE FROM redeem_votes WHERE code=?1 AND voter_key=?2').bind(normalized, voter.key).run();
      changed = true;
    }
  } else {
    if (!isVotable(row, dayOf(nowMs))) throw new VoteError('This code is not active right now.', 409, 'inactive');
    const weight = Math.min(1, Math.max(0, Number(voter.weight) || SIGNAL.weights.guest));

    if (!existing) {
      if (voter.kind === 'guest' && netHash) {
        const crowd = await db.prepare(`SELECT COUNT(*) AS n FROM redeem_votes
          WHERE code=?1 AND voter_kind='guest' AND net_hash=?2 AND updated_at>=?3`)
          .bind(normalized, netHash, new Date(nowMs - SIGNAL.windowHours * HOUR_MS).toISOString()).first();
        if (Number(crowd?.n || 0) >= VOTE_LIMITS.guestsPerCodeNetwork) {
          throw new VoteError('Enough reports have already come from your network for this code.', 429, 'network_limit');
        }
      }
      await db.prepare(`INSERT INTO redeem_votes
        (code,voter_key,voter_kind,verdict,base_weight,net_hash,changes,created_at,updated_at)
        VALUES (?1,?2,?3,?4,?5,?6,0,?7,?7)`).bind(normalized, voter.key, voter.kind, verdict, weight, netHash || null, nowIso).run();
      changed = true;
    } else if (existing.verdict !== verdict) {
      if (Number(existing.changes) >= VOTE_LIMITS.maxChanges) {
        throw new VoteError('You have already changed your report on this code a few times.', 429, 'locked');
      }
      await db.prepare(`UPDATE redeem_votes SET verdict=?3, base_weight=?4, net_hash=?5, changes=changes+1, updated_at=?6
        WHERE code=?1 AND voter_key=?2`).bind(normalized, voter.key, verdict, weight, netHash || null, nowIso).run();
      changed = true;
    } else if (nowMs - toMs(existing.updated_at) >= VOTE_LIMITS.refreshAfterMs) {
      // Same verdict again. If it has gone stale (for example an admin re-checked the code since),
      // this is fresh evidence, so it counts again. Within the refresh window it is a no-op.
      await db.prepare('UPDATE redeem_votes SET updated_at=?3, net_hash=?4 WHERE code=?1 AND voter_key=?2')
        .bind(normalized, voter.key, nowIso, netHash || null).run();
      changed = true;
    }
  }

  const result = await recomputeSignal(db, normalized, nowMs, row);
  return {
    vote: verdict === 'clear' ? null : verdict,
    at: nowIso,
    changed,
    signal: result.after,
    publicChanged: result.publicChanged,
  };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function loadSignals(db) {
  const { results } = await db.prepare('SELECT * FROM redeem_code_signals').all();
  return new Map((results || []).map((row) => [row.code, row]));
}

/** My recent votes (signed-in voters only), so a second device shows the same pressed buttons. */
export async function myVotes(db, voterKey, nowMs = Date.now()) {
  const floor = new Date(nowMs - SIGNAL.windowHours * HOUR_MS).toISOString();
  const { results } = await db.prepare('SELECT code, verdict, updated_at FROM redeem_votes WHERE voter_key=?1 AND updated_at>=?2')
    .bind(voterKey, floor).all();
  const votes = {};
  for (const r of results || []) votes[r.code] = { verdict: r.verdict, at: r.updated_at };
  return votes;
}

/** Has this account voted on this code lately? Used to verify the quest event server side. */
export async function hasRecentVote(db, voterKey, code, nowMs = Date.now(), withinMs = DAY_MS) {
  const row = await db.prepare('SELECT 1 AS x FROM redeem_votes WHERE voter_key=?1 AND code=?2 AND updated_at>=?3')
    .bind(voterKey, String(code).toUpperCase(), new Date(nowMs - withinMs).toISOString()).first();
  return Boolean(row);
}

/* ------------------------------------------------------------------ */
/* Admin priority                                                      */
/* ------------------------------------------------------------------ */

/**
 * An admin looked at these codes. Clear every flag and start the evidence from zero: votes cast
 * before this moment are ignored from now on, so the crowd has to produce FRESH reports to
 * contradict the admin. Returns the number of codes reset.
 */
export async function resetSignals(db, codes, actor = 'admin', nowMs = Date.now()) {
  const list = [...new Set((codes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
  if (!list.length) return 0;
  const nowIso = new Date(nowMs).toISOString();
  const stmt = db.prepare(`INSERT INTO redeem_code_signals (code,state,state_since,epoch_start,resolved_by,resolved_at,updated_at)
    VALUES (?1,'ok',?2,?2,?3,?2,?2)
    ON CONFLICT(code) DO UPDATE SET
      state='ok', state_since=?2, epoch_start=?2,
      worked_24h=0, failed_24h=0, fail_w=0, work_w=0, fail_sources=0, work_sources=0,
      wilson_fail=0, wilson_work=0, confirmed=0,
      last_vote_at=NULL, last_fail_at=NULL, last_work_at=NULL,
      resolved_by=?3, resolved_at=?2, updated_at=?2`);
  for (let i = 0; i < list.length; i += 50) {
    await db.batch(list.slice(i, i + 50).map((code) => stmt.bind(code, nowIso, String(actor))));
  }
  return list.length;
}

export async function deleteVotesFor(db, codes) {
  const list = [...new Set((codes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
  for (let i = 0; i < list.length; i += 40) {
    const slice = list.slice(i, i + 40);
    await db.batch(slice.flatMap((code) => [
      db.prepare('DELETE FROM redeem_votes WHERE code=?1').bind(code),
      db.prepare('DELETE FROM redeem_code_signals WHERE code=?1').bind(code),
    ]));
  }
  return list.length;
}

/* ------------------------------------------------------------------ */
/* Maintenance (hourly cron)                                           */
/* ------------------------------------------------------------------ */

/** Decay moves on even when nobody votes, so re-score every code that has recent activity. */
export async function refreshSignals(db, nowMs = Date.now(), limit = 120) {
  const floor = new Date(nowMs - SIGNAL.windowHours * HOUR_MS).toISOString();
  const { results } = await db.prepare(`SELECT code FROM redeem_votes WHERE updated_at>=?1
    UNION SELECT code FROM redeem_code_signals WHERE state!='ok' OR confirmed=1 OR worked_24h>0 OR failed_24h>0
    LIMIT ?2`).bind(floor, limit).all();
  let checked = 0;
  let stateChanges = 0;
  for (const { code } of results || []) {
    const exists = await db.prepare('SELECT code,region FROM redeem_codes WHERE code=?1').bind(code).first();
    if (!exists) { await deleteVotesFor(db, [code]); continue; }
    const out = await recomputeSignal(db, code, nowMs, exists);
    checked += 1;
    if (out.before.state !== out.after.state) stateChanges += 1;
  }
  return { checked, stateChanges };
}

/** Raw votes (and their network hash) are short-lived. Counters and states live on in signals. */
export async function pruneVotes(db, nowMs = Date.now()) {
  const votes = await db.prepare('DELETE FROM redeem_votes WHERE updated_at<?1')
    .bind(new Date(nowMs - VOTE_LIMITS.retentionDays * DAY_MS).toISOString()).run();
  const rates = await db.prepare('DELETE FROM redeem_vote_rate WHERE window_start<?1')
    .bind(Math.floor(nowMs / 1000) - 2 * 3600).run();
  const orphans = await db.prepare('DELETE FROM redeem_code_signals WHERE code NOT IN (SELECT code FROM redeem_codes)').run();
  return { votes: votes.meta?.changes || 0, rates: rates.meta?.changes || 0, signals: orphans.meta?.changes || 0 };
}

export { toPublicSignal, toAdminSignal };
