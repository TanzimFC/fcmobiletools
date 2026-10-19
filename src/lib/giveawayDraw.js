// Provably fair draw engine and claim code helpers.
// Pure functions on Web Crypto only, so the Worker and the public "Verify this draw"
// widget run the exact same code and always reach the same result.
//
// How a draw works:
//   1. When a giveaway goes live the server creates a secret seed and publishes only
//      its SHA-256 fingerprint (the commit). The seed cannot change afterwards.
//   2. When entries close, the list of entries and their tickets is frozen and hashed.
//   3. Every entry gets a score from SHA-256(seed | entries hash | entry id | block).
//      An entry with N tickets takes the lowest of N scores, so one extra ticket is one
//      extra chance. Lowest score wins. The full ranking is fixed by the seed alone,
//      so a reroll is simply "the next eligible entry down the list".
//   4. The seed is revealed after the draw. Anyone can recompute the ranking.

const enc = new TextEncoder();

export async function sha256Hex(text) {
  const bytes = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  let out = '';
  for (const b of new Uint8Array(bytes)) out += b.toString(16).padStart(2, '0');
  return out;
}

export function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

// entries: [{ id, tickets }]. Order independent, so the same entries always give the same hash.
export async function entriesHash(giveawayId, entries) {
  const lines = entries
    .map((e) => String(e.id) + ':' + Math.max(1, Math.floor(Number(e.tickets) || 1)))
    .sort();
  return sha256Hex(String(giveawayId) + '\n' + lines.join('\n'));
}

async function entryScore(seed, hash, id, tickets) {
  const t = Math.max(1, Math.min(64, Math.floor(Number(tickets) || 1)));
  let best = null;
  for (let block = 0; block * 4 < t; block += 1) {
    const digest = await sha256Hex(seed + '|' + hash + '|' + id + '|' + block);
    for (let lane = 0; lane < 4 && block * 4 + lane < t; lane += 1) {
      const value = digest.slice(lane * 16, lane * 16 + 16);
      if (best === null || value < best) best = value;
    }
  }
  return best;
}

// Returns entry ids from best to worst. Ties (probability about 2^-64) break on the id.
export async function rankEntries(seed, hash, entries) {
  const scored = [];
  const CHUNK = 200;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const part = entries.slice(i, i + CHUNK);
    const scores = await Promise.all(part.map((e) => entryScore(seed, hash, e.id, e.tickets)));
    part.forEach((e, k) => scored.push({ id: String(e.id), score: scores[k] }));
  }
  scored.sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : a.id < b.id ? -1 : 1));
  return scored.map((s) => s.id);
}

// ───────────── claim code ─────────────
// 30 symbols: no 0, 1, I, L, O or U, so a code read aloud or from a screenshot is hard to misread.
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_PREFIX = 'FCM';

function checkChar(body) {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) sum += (CODE_ALPHABET.indexOf(body[i]) + 1) * (i + 3);
  return CODE_ALPHABET[sum % CODE_ALPHABET.length];
}

// Format: FCM-XXXX-XXXX-XXXX where the last character is a checksum, so typos are caught
// before anything touches the database.
export function generateClaimCode() {
  let body = '';
  while (body.length < 11) {
    // Rejection sampling: 240 is the largest multiple of 30 below 256, so every symbol is equally likely.
    for (const b of crypto.getRandomValues(new Uint8Array(24))) {
      if (b < 240 && body.length < 11) body += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  const full = body + checkChar(body);
  return CODE_PREFIX + '-' + full.slice(0, 4) + '-' + full.slice(4, 8) + '-' + full.slice(8, 12);
}

export function normalizeClaimCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^FCM/, '');
}

export function isValidClaimCodeShape(input) {
  const body = normalizeClaimCode(input);
  if (body.length !== 12) return false;
  for (const ch of body) if (!CODE_ALPHABET.includes(ch)) return false;
  return checkChar(body.slice(0, 11)) === body[11];
}

export function canonicalClaimCode(input) {
  const body = normalizeClaimCode(input);
  return CODE_PREFIX + '-' + body.slice(0, 4) + '-' + body.slice(4, 8) + '-' + body.slice(8, 12);
}

// ───────────── public masking ─────────────
// Public pages never show a full username. "tanzimfc" becomes "ta****fc".
export function maskName(name) {
  const s = String(name || '').trim();
  if (s.length <= 2) return '**';
  if (s.length <= 4) return s[0] + '*'.repeat(s.length - 1);
  return s.slice(0, 2) + '*'.repeat(Math.min(6, s.length - 4)) + s.slice(-2);
}
