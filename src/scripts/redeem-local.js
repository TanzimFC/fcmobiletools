// Everything the redeem page remembers on the player's own device. No DOM in here, so it can be
// unit-tested with a fake storage (scripts/test-redeem-local.mjs).
//
//   redeemed   "I already used this code" ticks
//   seen       the active codes at the last visit, to show "N new since your last visit"
//   votes      my own Worked / Didn't work votes (instant UI, and the buttons stay pressed)
//   attempt    codes I copied or opened EA for, so we can ask "how did it go?" when I come back
//   device     a random anonymous id so two players behind one mobile IP stay two voters
//
// Storage can be blocked (private mode, strict settings) or full: every call degrades to an
// in-memory copy and never throws.

export const KEYS = Object.freeze({
  redeemed: 'fcmt:rx:redeemed:v1',
  seen: 'fcmt:rx:seen:v1',
  votes: 'fcmt:rx:votes:v1',
  attempt: 'fcmt:rx:attempt:v1',
  device: 'fcmt:rx:device:v1',
});

const DAY = 86_400_000;
const LIMITS = Object.freeze({
  redeemedMax: 400,
  redeemedKeepMs: 90 * DAY,
  votesKeepMs: 3 * DAY,
  attemptWindowMs: 90 * 60_000, // how long after copying we still ask "how did it go?"
  askCooldownMs: 6 * 3_600_000,
  seenMax: 200,
});

const normalize = (code) => String(code || '').trim().toUpperCase();

export function createLocalStore(storage, clock = () => Date.now()) {
  const memory = new Map();

  const read = (key, fallback) => {
    let raw = null;
    try { raw = storage ? storage.getItem(key) : null; } catch { raw = null; }
    if (raw == null) raw = memory.get(key) ?? null;
    if (raw == null) return fallback;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' ? value : fallback;
    } catch { return fallback; }
  };
  const write = (key, value) => {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try { if (storage) storage.setItem(key, raw); } catch { /* full or blocked: memory copy still works */ }
  };

  /* ───────── redeemed ticks ───────── */
  const redeemedItems = () => {
    const data = read(KEYS.redeemed, null);
    return data && data.items && typeof data.items === 'object' ? { ...data.items } : {};
  };
  const redeemed = {
    has: (code) => Boolean(redeemedItems()[normalize(code)]),
    set(code, on) {
      const items = redeemedItems();
      const key = normalize(code);
      if (!key) return false;
      if (on) items[key] = clock(); else delete items[key];
      write(KEYS.redeemed, { v: 1, items });
      return Boolean(on);
    },
    count: (codes) => (codes || []).filter((c) => Boolean(redeemedItems()[normalize(c)])).length,
    clear(codes) {
      const items = redeemedItems();
      for (const c of codes || []) delete items[normalize(c)];
      write(KEYS.redeemed, { v: 1, items });
    },
    /** Forget ticks for codes that left the list long ago, and cap the size. */
    prune(knownCodes) {
      const known = new Set((knownCodes || []).map(normalize));
      const items = redeemedItems();
      const now = clock();
      let entries = Object.entries(items).filter(([code, at]) => known.has(code) || now - Number(at) < LIMITS.redeemedKeepMs);
      if (entries.length > LIMITS.redeemedMax) entries = entries.sort((a, b) => b[1] - a[1]).slice(0, LIMITS.redeemedMax);
      const next = Object.fromEntries(entries);
      if (entries.length !== Object.keys(items).length) write(KEYS.redeemed, { v: 1, items: next });
    },
  };

  /* ───────── new since last visit ───────── */
  const seen = {
    baseline() {
      const data = read(KEYS.seen, null);
      return data && Array.isArray(data.codes) ? { codes: new Set(data.codes.map(normalize)), at: Number(data.at) || 0 } : null;
    },
    /**
     * Compares the live codes with what this player saw last time. The very first visit has no
     * baseline, so nothing is "new" (everything would be). Codes already ticked as redeemed are
     * never "new": the player clearly knows them.
     */
    diff(activeCodes) {
      const base = seen.baseline();
      if (!base) return { firstVisit: true, fresh: [] };
      const fresh = (activeCodes || []).map(normalize).filter((c) => !base.codes.has(c) && !redeemed.has(c));
      return { firstVisit: false, fresh };
    },
    commit(activeCodes) {
      const codes = [...new Set((activeCodes || []).map(normalize).filter(Boolean))].slice(0, LIMITS.seenMax);
      write(KEYS.seen, { v: 1, codes, at: clock() });
    },
  };

  /* ───────── my votes ───────── */
  const voteItems = () => {
    const data = read(KEYS.votes, null);
    return data && data.items && typeof data.items === 'object' ? { ...data.items } : {};
  };
  const votes = {
    get(code, resetAt) {
      const item = voteItems()[normalize(code)];
      if (!item || (item.v !== 'worked' && item.v !== 'failed')) return null;
      // An admin re-check wipes the crowd's evidence, so an older vote of mine no longer shows as
      // "current": the buttons come back and I can confirm again.
      const reset = Date.parse(resetAt || '');
      if (Number.isFinite(reset) && item.t < reset) return null;
      return item;
    },
    set(code, verdict, at = clock()) {
      const items = voteItems();
      const key = normalize(code);
      if (verdict === 'worked' || verdict === 'failed') items[key] = { v: verdict, t: at };
      else delete items[key];
      const now = clock();
      for (const [k, item] of Object.entries(items)) if (now - Number(item.t) > LIMITS.votesKeepMs) delete items[k];
      write(KEYS.votes, { v: 1, items });
    },
    /** Merge votes the server remembers for my account (a second device). Newer side wins. */
    merge(serverVotes) {
      const items = voteItems();
      for (const [code, v] of Object.entries(serverVotes || {})) {
        const key = normalize(code);
        const at = Date.parse(v?.at || '');
        if (!Number.isFinite(at) || (v.verdict !== 'worked' && v.verdict !== 'failed')) continue;
        if (!items[key] || items[key].t < at) items[key] = { v: v.verdict, t: at };
      }
      write(KEYS.votes, { v: 1, items });
    },
  };

  /* ───────── "how did it go?" prompts ───────── */
  const attemptData = () => {
    const data = read(KEYS.attempt, null);
    return {
      items: data && data.items && typeof data.items === 'object' ? { ...data.items } : {},
      asked: data && data.asked && typeof data.asked === 'object' ? { ...data.asked } : {},
    };
  };
  const attempts = {
    mark(code) {
      const data = attemptData();
      data.items[normalize(code)] = clock();
      write(KEYS.attempt, { v: 1, ...data });
    },
    /** The most recent attempt still worth asking about, or null. */
    pending() {
      const { items, asked } = attemptData();
      const now = clock();
      let best = null;
      for (const [code, t] of Object.entries(items)) {
        if (now - Number(t) > LIMITS.attemptWindowMs) continue;
        if (now - Number(asked[code] || 0) < LIMITS.askCooldownMs) continue;
        if (!best || t > best.at) best = { code, at: Number(t) };
      }
      return best;
    },
    asked(code) {
      const data = attemptData();
      const key = normalize(code);
      data.asked[key] = clock();
      delete data.items[key];
      const now = clock();
      for (const [k, t] of Object.entries(data.asked)) if (now - Number(t) > 2 * DAY) delete data.asked[k];
      write(KEYS.attempt, { v: 1, ...data });
    },
  };

  /* ───────── anonymous device id ───────── */
  const device = {
    id(generate) {
      let raw = null;
      try { raw = storage ? storage.getItem(KEYS.device) : null; } catch { raw = null; }
      raw = raw || memory.get(KEYS.device) || null;
      if (raw && /^[0-9a-f-]{16,64}$/i.test(raw)) return raw;
      const fresh = String(generate ? generate() : '');
      if (!/^[0-9a-f-]{16,64}$/i.test(fresh)) return '';
      memory.set(KEYS.device, fresh);
      try { if (storage) storage.setItem(KEYS.device, fresh); } catch { /* keep the in-memory id */ }
      return fresh;
    },
  };

  return { redeemed, seen, votes, attempts, device, LIMITS };
}

/**
 * Order for the live cards. Codes players report as dead sink to the bottom, and codes I have
 * already redeemed sit below the ones I still have to try. The sort is stable, so the server's
 * "newest first" order is kept inside each group.
 */
export function rankActive(codes, { isRedeemed = () => false } = {}) {
  const weight = (c) => (c.community?.state === 'possibly_expired' ? 2 : 0) + (isRedeemed(c.code) ? 1 : 0);
  return codes.map((c, i) => ({ c, i, w: weight(c) })).sort((a, b) => a.w - b.w || a.i - b.i).map((x) => x.c);
}

/** The hero ticket should never advertise a code players say is dead (unless nothing else exists). */
export function pickTicket(codes) {
  return codes.find((c) => c.community?.state !== 'possibly_expired') || codes[0] || null;
}
