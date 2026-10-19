// Giveaway API.
//
// Public:  /api/giveaways/public, /api/giveaways/winners, /api/giveaways/:slug, /api/giveaways/:slug/draw-proof
// Member:  /api/giveaways/:slug/me|proof|enter|entry|boost|track, /api/giveaways/mine, /api/giveaways/claims/*
// Admin:   /api/admin/giveaways/*   (Worker admin session, checked by worker.mjs before it gets here)
//
// Needs supabase/migrations/20261018120000_giveaway_system.sql and one Worker secret,
// GIVEAWAY_CODE_KEY (32 or more random characters). Without the key nothing can go live,
// so claim codes can never be created in a weak state.

import {
  sha256Hex, randomSeed, entriesHash, rankEntries, generateClaimCode, canonicalClaimCode, isValidClaimCodeShape
} from './lib/giveawayDraw.js';
import {
  RULES_VERSION, SITE_ORIGIN, requirementsFor, cleanMilestones, unlockedMilestones, BONUS_DEFAULTS,
  banDaysForStrike, money, KINDS
} from './data/giveawayConfig.js';
import {
  PUBLIC_COLUMNS, loadPublicList, loadPublicOne, loadWinnersWall, loadOfficial, effectiveStatus
} from './lib/giveawayPublic.js';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp('^' + UUID + '$', 'i');
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
const RESERVED_SLUGS = new Set(['public', 'winners', 'mine', 'claims', 'settings', 'health', 'bans', 'audit', 'verify-code']);
const BLOCKED_ACCOUNT_STATES = new Set(['closed', 'fraud_removed', 'frozen', 'restricted']);
const IMAGE_HOST = /^i\.ibb\.co(?:\.com)?$/i;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACTIVE_WINNER = ['selected', 'awaiting_claim', 'code_verified'];

const clean = (v, max = 200) => String(v ?? '').trim().replace(/\u0000/g, '').slice(0, max);
const q = encodeURIComponent;
const nowIso = () => new Date().toISOString();
const utcDay = () => new Date().toISOString().slice(0, 10);
const addHours = (h, from = Date.now()) => new Date(from + h * 3600 * 1000).toISOString();

class Fail extends Error {
  constructor(message, status = 400, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

// ───────────── secrets ─────────────
const hexToBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

function keyConfigured(env) { return String(env.GIVEAWAY_CODE_KEY || '').trim().length >= 32; }
function requireKey(env) {
  if (!keyConfigured(env)) throw new Fail('The private giveaway security key is unavailable. Try again shortly.', 503);
}
async function hmacHex(env, label, data) {
  requireKey(env);
  const master = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(env.GIVEAWAY_CODE_KEY).trim()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sub = await crypto.subtle.sign('HMAC', master, new TextEncoder().encode('fcm-giveaway:' + label));
  const key = await crypto.subtle.importKey('raw', sub, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}
async function aesKey(env) {
  const raw = hexToBytes(await hmacHex(env, 'aes', 'claim-code-key'));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function sealCode(env, code) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), new TextEncoder().encode(code));
  return b64u(iv) + '.' + b64u(ct);
}
async function openCode(env, sealed) {
  const [iv, ct] = String(sealed || '').split('.');
  if (!iv || !ct) throw new Fail('This claim code cannot be read. Contact an admin.', 500);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv) }, await aesKey(env), unb64u(ct));
  return new TextDecoder().decode(plain);
}
const codeHash = (env, code) => hmacHex(env, 'code', canonicalClaimCode(code));
const proofSig = (env, p) => hmacHex(env, 'proof', [p.accountId, p.giveawayId, p.slot, p.url, p.sha256, p.expiresAt].join('|'));
async function networkHash(env, request) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!ip || !keyConfigured(env)) return null;
  return (await hmacHex(env, 'net', ip)).slice(0, 32);
}

// ───────────── database helpers ─────────────
function makeDb(env, supabaseRest) {
  const rest = (path, options) => supabaseRest(env, path, options);
  const insert = (table, row, { many = false } = {}) => rest(table, {
    method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row)
  }).then((r) => (many ? r : r?.[0]));
  const patch = (table, filter, values) => rest(table + '?' + filter, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(values)
  });
  const rpc = (name, args) => rest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) });
  const rest3 = (_env, path, options) => rest(path, options);
  return { rest, rest3, insert, patch, rpc };
}

// The encryption and signing key is generated with crypto.getRandomValues() and stored
// in the private giveaway_settings table. It is never returned by the settings API.
// This removes the need to configure a separate GIVEAWAY_CODE_KEY Worker secret.
async function ensureInternalSecurityKey(db) {
  const read = async () => (await db.rest('giveaway_settings?key=eq.internal_security&select=value&limit=1'))?.[0] || null;
  let row = await read();
  let key = String(row?.value?.claim_key || '');
  if (/^[a-f0-9]{64}$/.test(key)) return key;
  const candidate = randomSeed();
  if (row) {
    await db.patch('giveaway_settings', 'key=eq.internal_security', { value: { claim_key: candidate }, updated_at: nowIso() });
  } else {
    await db.rest('giveaway_settings?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'internal_security', value: { claim_key: candidate }, updated_at: nowIso() })
    });
  }
  row = await read();
  key = String(row?.value?.claim_key || '');
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Fail('The private giveaway security key could not be initialized.', 503);
  return key;
}

async function audit(db, giveawayId, action, detail = {}, actor = 'admin') {
  try { await db.insert('giveaway_audit', { giveaway_id: giveawayId || null, actor, action, detail }); } catch { /* audit is best effort */ }
}
async function entryEvent(db, entry, actor, action, reason = '', meta = {}) {
  await db.insert('giveaway_entry_events', { entry_id: entry.id, giveaway_id: entry.giveaway_id, actor, action, reason: clean(reason, 600), meta });
}
async function accountMap(db, ids) {
  const map = new Map();
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return map;
  for (const a of (await db.rest('accounts?id=in.(' + unique.join(',') + ')&select=id,username,display_name,avatar_url,state')) || []) map.set(a.id, a);
  return map;
}
async function activeBan(db, accountId, giveawayId) {
  const rows = await db.rest('giveaway_bans?account_id=eq.' + accountId + '&lifted_at=is.null&starts_at=lte.' + q(nowIso()) +
    '&or=(ends_at.is.null,ends_at.gt.' + q(nowIso()) + ')&select=id,reason,ends_at,giveaway_id,strike&order=ends_at.desc.nullsfirst&limit=5');
  return (rows || []).find((b) => !b.giveaway_id || b.giveaway_id === giveawayId) || null;
}
async function getGiveawayBySlug(db, slug, columns = '*') {
  if (!SLUG_RE.test(slug)) return null;
  return (await db.rest('giveaways?slug=eq.' + q(slug) + '&select=' + columns + '&limit=1'))?.[0] || null;
}
async function getGiveawayById(db, id, columns = '*') {
  if (!UUID_RE.test(id)) return null;
  return (await db.rest('giveaways?id=eq.' + id + '&select=' + columns + '&limit=1'))?.[0] || null;
}
async function bump(db, giveawayId, event) {
  try { await db.rpc('giveaway_bump_metric', { p_giveaway: giveawayId, p_event: event }); } catch { /* metrics are best effort */ }
}

// ───────────── automated checks ─────────────
async function checkImage(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !IMAGE_HOST.test(u.hostname)) return 'unreachable';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    let res = await fetch(url, { method: 'HEAD', signal: ctl.signal, redirect: 'follow' });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { headers: { range: 'bytes=0-0' }, signal: ctl.signal });
    clearTimeout(timer);
    if (res.status === 404 || res.status === 410) return 'expired';
    if (!res.ok && res.status !== 206) return 'unreachable';
    return /^image\//i.test(res.headers.get('content-type') || '') ? 'ok' : 'unreachable';
  } catch { return 'unreachable'; }
}

export function cleanDiscord(value) {
  const v = clean(value, 64).replace(/^@/, '');
  return /^[A-Za-z0-9_.]{2,32}(#\d{4})?$/.test(v) ? v : '';
}

// Runs every check we can do without a human. Returns { passed, results[], flags[] }.
async function runAutoChecks(db, env, giveaway, accountId, entry, { fresh = false } = {}) {
  const reqs = requirementsFor(giveaway.requirements);
  const results = [];
  const needAuto = reqs.some((r) => r.input === 'auto');
  let gp = null, acct = null, survey = false, quest = false;
  if (needAuto) {
    [gp, acct, survey, quest] = await Promise.all([
      db.rest('account_game_profiles?account_id=eq.' + accountId + '&select=fc_mobile_uid,in_game_username,region_server&limit=1').then((r) => r?.[0] || {}),
      db.rest('accounts?id=eq.' + accountId + '&select=onboarding_complete&limit=1').then((r) => r?.[0] || {}),
      db.rest('survey_responses?account_id=eq.' + accountId + '&select=id&limit=1').then((r) => r.length > 0),
      db.rest('task_attempts?account_id=eq.' + accountId + '&status=eq.accepted&select=id&limit=1').then((r) => r.length > 0)
    ]);
  }
  const proofBySlot = new Map((entry?.proof || []).map((p) => [p.slot, p]));
  for (const r of reqs) {
    let ok = false, detail = '';
    if (r.type === 'profile_complete') {
      ok = Boolean(clean(gp.fc_mobile_uid) && clean(gp.in_game_username) && clean(gp.region_server)) && acct.onboarding_complete !== false;
      detail = ok ? 'Profile complete' : 'Add your UID, in-game name and server';
    } else if (r.type === 'survey_complete') {
      ok = survey; detail = ok ? 'Survey completed' : 'No completed survey found yet';
    } else if (r.type === 'quest_complete') {
      ok = quest; detail = ok ? 'Quest completed' : 'No completed quest found yet';
    } else if (r.input === 'text') {
      const v = entry?.discord_username || '';
      ok = Boolean(cleanDiscord(v)); detail = ok ? 'Username provided' : 'Enter your Discord username';
    } else if (r.input === 'image') {
      const p = proofBySlot.get(r.id);
      if (!p) { detail = 'Upload a screenshot'; }
      else {
        const state = fresh ? await checkImage(p.url) : (p.state || 'ok');
        if (fresh) { p.state = state; p.checked_at = nowIso(); }
        ok = state === 'ok' && Date.parse(p.expires_at) > Date.now();
        detail = ok ? 'Screenshot available' : state === 'expired' || Date.parse(p.expires_at) <= Date.now() ? 'Screenshot has expired' : 'Screenshot could not be loaded';
        if (!ok && p.state === 'ok' && Date.parse(p.expires_at) <= Date.now()) p.state = 'expired';
      }
    }
    results.push({ id: r.id, label: r.label, required: r.required, ok, detail });
  }
  const passed = results.every((r) => r.ok || !r.required);
  return { passed, results };
}

async function duplicateFlags(db, giveawayId, accountId, entry, ipHash) {
  const flags = new Set();
  const found = [];
  const hashes = entry.proof_hashes || [];
  if (hashes.length) {
    const rows = await db.rest('giveaway_entries?giveaway_id=eq.' + giveawayId + '&account_id=neq.' + accountId +
      '&proof_hashes=ov.' + q('{' + hashes.join(',') + '}') + '&select=id,account_id&limit=5');
    if (rows?.length) { flags.add('dup_image'); found.push(...rows.map((r) => ({ type: 'image', entry_id: r.id, account_id: r.account_id }))); }
  }
  if (entry.discord_norm) {
    const rows = await db.rest('giveaway_entries?giveaway_id=eq.' + giveawayId + '&account_id=neq.' + accountId +
      '&discord_norm=eq.' + q(entry.discord_norm) + '&select=id,account_id&limit=5');
    if (rows?.length) { flags.add('dup_discord'); found.push(...rows.map((r) => ({ type: 'discord', entry_id: r.id, account_id: r.account_id }))); }
  }
  if (ipHash) {
    const rows = await db.rest('giveaway_entries?giveaway_id=eq.' + giveawayId + '&account_id=neq.' + accountId +
      '&ip_hash=eq.' + q(ipHash) + '&select=id,account_id&limit=5');
    if (rows?.length) { flags.add('shared_network'); found.push(...rows.map((r) => ({ type: 'network', entry_id: r.id, account_id: r.account_id }))); }
  }
  return { flags: [...flags], found };
}

// ───────────── winners ─────────────
function winnerPublicFields() {
  // Public and member payloads omit claim_code_hash and claim_code_enc.
  // fc_uid is visible only in authenticated member/admin responses using this selector.
  return 'id,giveaway_id,entry_id,account_id,slot,rank_position,status,prize_cents,code_reveals,claim_attempts,last_revealed_at,contact_channel,contact_handle,fc_uid,' +
    'contact_set_at,announced_at,claim_deadline,overdue_flagged,verified_at,verified_by,verified_handle,handle_matched,paid_at,paid_by,' +
    'payout_method,payout_proof_url,notes,created_at,updated_at';
}

async function eligibleList(db, g) {
  const bonus = { ...BONUS_DEFAULTS, ...(g.bonus || {}) };
  const rows = await db.rpc('giveaway_eligible_tickets', {
    p_giveaway: g.id, p_daily_cap: bonus.daily ? bonus.dailyCap : 0, p_ref_cap: bonus.referral ? bonus.referralCap : 0
  });
  return (rows || []).map((r) => ({ id: r.entry_id, accountId: r.account_id, tickets: r.tickets }));
}

async function newClaimCode(env) {
  const code = generateClaimCode();
  return { code, hash: await codeHash(env, code), enc: await sealCode(env, code) };
}

// Picks the next entry down the frozen ranking. Used for the first draw and for every reroll.
async function promoteNext(db, env, g, slot, rowsUsed) {
  const snap = g.draw_snapshot?.entries || [];
  const ranking = await rankEntries(g.draw_seed, g.entries_hash, snap);
  const eligible = new Set((await eligibleList(db, g)).map((e) => e.id));
  const used = new Set(rowsUsed.map((w) => w.entry_id));
  const next = ranking.find((id) => !used.has(id) && eligible.has(id));
  if (!next) return null;
  const entry = (await db.rest('giveaway_entries?id=eq.' + next + '&select=id,account_id&limit=1'))?.[0];
  if (!entry) return null;
  const prize = slot > g.winner_count ? (g.bonus_prize_cents || g.prize_cents) : g.prize_cents;
  const base = { giveaway_id: g.id, entry_id: next, account_id: entry.account_id, slot, rank_position: ranking.indexOf(next) + 1, status: 'selected', prize_cents: prize };
  const row = await db.insert('giveaway_winners', base);
  rowsUsed.push(row);
  return row;
}

async function topUpAlternates(db, env, g, rowsUsed) {
  const have = rowsUsed.filter((w) => w.status === 'alternate').length;
  const need = Math.max(0, g.alternate_count - have);
  if (!need) return;
  const snap = g.draw_snapshot?.entries || [];
  const ranking = await rankEntries(g.draw_seed, g.entries_hash, snap);
  const eligible = new Set((await eligibleList(db, g)).map((e) => e.id));
  const used = new Set(rowsUsed.map((w) => w.entry_id));
  const picks = ranking.filter((id) => !used.has(id) && eligible.has(id)).slice(0, need);
  for (const id of picks) {
    const entry = (await db.rest('giveaway_entries?id=eq.' + id + '&select=id,account_id&limit=1'))?.[0];
    if (!entry) continue;
    rowsUsed.push(await db.insert('giveaway_winners', {
      giveaway_id: g.id, entry_id: id, account_id: entry.account_id, slot: null, rank_position: ranking.indexOf(id) + 1, status: 'alternate', prize_cents: 0
    }));
  }
}

// Gives the freed slot to the best alternate still in good standing, or else the next entry down
// the frozen ranking. Alternates that are no longer eligible are retired in order.
async function fillSlot(db, env, g, slot) {
  const rows = (await db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&select=' + winnerPublicFields())) || [];
  const alts = rows.filter((w) => w.status === 'alternate').sort((a, b) => a.rank_position - b.rank_position);
  const prize = slot > g.winner_count ? (g.bonus_prize_cents || g.prize_cents) : g.prize_cents;
  let result = null;
  if (alts.length) {
    const eligible = new Set((await eligibleList(db, g)).map((e) => e.id));
    for (const alt of alts) {
      if (eligible.has(alt.entry_id)) {
        result = (await db.patch('giveaway_winners', 'id=eq.' + alt.id, { status: 'selected', slot, prize_cents: prize }))?.[0];
        break;
      }
      await db.patch('giveaway_winners', 'id=eq.' + alt.id, { status: 'forfeited', notes: 'Removed as alternate: no longer eligible.' });
    }
  }
  if (!result) result = await promoteNext(db, env, g, slot, (await db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&select=id,entry_id,status')) || []);
  if (result) await topUpAlternates(db, env, g, (await db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&select=id,entry_id,status')) || []);
  return result;
}

// ───────────── member side ─────────────
async function member(request, env, accountContext, { verified = true } = {}) {
  const ctx = await accountContext(request, env);
  if (!ctx) throw new Fail('Sign in to continue.', 401);
  if (BLOCKED_ACCOUNT_STATES.has(ctx.account.state)) throw new Fail('This account cannot take part in giveaways.', 403);
  if (verified && !ctx.user.email_confirmed_at) throw new Fail('Verify your email address before entering giveaways.', 403);
  return ctx;
}

const memberEntry = (e) => e && ({
  id: e.id, status: e.status, discordUsername: e.discord_username, checksPassed: e.checks_passed,
  proof: (e.proof || []).map((p) => ({ slot: p.slot, url: p.url, state: p.state, expiresAt: p.expires_at })),
  reviewReason: e.review_reason || '', reviewedAt: e.reviewed_at, fixDeadline: e.fix_deadline, createdAt: e.created_at
});

function assertOpen(g) {
  const s = effectiveStatus(g);
  if (s === 'upcoming') throw new Fail('This giveaway has not opened yet.', 409);
  if (s !== 'live') throw new Fail('Entries are closed for this giveaway.', 409);
}

async function ticketsFor(db, g, accountId) {
  const bonus = { ...BONUS_DEFAULTS, ...(g.bonus || {}) };
  const [days, refs] = await Promise.all([
    db.rest('giveaway_checkins?giveaway_id=eq.' + g.id + '&account_id=eq.' + accountId + '&select=day&order=day.desc&limit=60'),
    db.rest('giveaway_referrals?giveaway_id=eq.' + g.id + '&referrer_account_id=eq.' + accountId + '&status=eq.counted&select=id&limit=200')
  ]);
  const daily = bonus.daily ? Math.min(days.length, bonus.dailyCap) : 0;
  const referral = bonus.referral ? Math.min(refs.length, bonus.referralCap) : 0;
  return {
    base: 1, daily, referral, total: 1 + daily + referral,
    dailyCap: bonus.dailyCap, referralCap: bonus.referralCap, referrals: refs.length,
    boostedToday: days.some((d) => d.day === utcDay()), boostsEnabled: Boolean(bonus.daily), referralsEnabled: Boolean(bonus.referral)
  };
}

async function meApi(db, env, g, ctx) {
  const entry = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&account_id=eq.' + ctx.account.id + '&select=*&limit=1'))?.[0] || null;
  const [ban, tickets, events, checks] = await Promise.all([
    activeBan(db, ctx.account.id, g.id),
    ticketsFor(db, g, ctx.account.id),
    entry ? db.rest('giveaway_entry_events?entry_id=eq.' + entry.id + '&select=actor,action,reason,created_at&order=created_at.desc&limit=30') : [],
    runAutoChecks(db, env, g, ctx.account.id, entry)
  ]);
  return {
    entry: memberEntry(entry), eligibility: checks, tickets, events: events || [],
    ban: ban ? { reason: ban.reason, endsAt: ban.ends_at, permanent: !ban.ends_at } : null,
    verifiedEmail: Boolean(ctx.user.email_confirmed_at),
    referral: { username: ctx.account.username, link: SITE_ORIGIN + '/giveaways/' + g.slug + '/?ref=' + ctx.account.username },
    status: effectiveStatus(g), rulesVersion: RULES_VERSION
  };
}

async function proofUpload(request, env, url, db, g, ctx, reserveImageUploadQuota) {
  assertOpen(g);
  requireKey(env);
  if (!String(env.IMAGEBB_API_KEY || '').trim()) throw new Fail('Image uploads are temporarily unavailable. Please try again later.', 503);
  if (await activeBan(db, ctx.account.id, g.id)) throw new Fail('Your account is paused from giveaways.', 403);
  const originHeader = request.headers.get('origin');
  if (originHeader) { try { if (new URL(originHeader).origin !== url.origin) throw 1; } catch { throw new Fail('Request not allowed.', 403); } }
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('multipart/form-data')) throw new Fail('Choose an image file to upload.', 415);
  if (Number(request.headers.get('content-length') || 0) > MAX_IMAGE_BYTES + 128 * 1024) throw new Fail('Choose an image smaller than 8 MB.', 413);
  let fields;
  try { fields = await request.formData(); } catch { throw new Fail('The upload could not be read. Please choose the image again.', 400); }
  const slot = clean(fields.get('slot'), 40);
  const req = requirementsFor(g.requirements).find((r) => r.id === slot && r.input === 'image');
  if (!req) throw new Fail('That step does not need a screenshot.', 400);
  const file = fields.get('file');
  if (!file || typeof file.arrayBuffer !== 'function' || !(file.size > 0)) throw new Fail('Choose an image file to upload.', 400);
  if (file.size > MAX_IMAGE_BYTES) throw new Fail('Choose an image smaller than 8 MB.', 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectType(bytes);
  if (!type) throw new Fail('Use a JPG, PNG, WebP or GIF image.', 415);
  if (!(await reserveImageUploadQuota(env, ctx.account.id))) throw new Fail('You have reached the upload limit. Please try again later.', 429);
  const sha256 = toHex(await crypto.subtle.digest('SHA-256', bytes));
  const seconds = Math.max(3600, Math.min(15552000, g.proof_ttl_hours * 3600));
  const out = new FormData();
  out.append('image', new File([bytes], 'proof-' + slot + '.' + type.split('/')[1], { type }));
  let upstream, result;
  try {
    const ep = new URL('https://api.imgbb.com/1/upload');
    ep.searchParams.set('key', String(env.IMAGEBB_API_KEY).trim());
    ep.searchParams.set('expiration', String(seconds));
    upstream = await fetch(ep.toString(), { method: 'POST', body: out });
    result = await upstream.json().catch(() => null);
  } catch { throw new Fail('The image could not be uploaded. Please try again.', 503); }
  const image = result?.data;
  let direct;
  try { direct = new URL(String(image?.url || '')); if (direct.protocol !== 'https:' || !IMAGE_HOST.test(direct.hostname)) throw 1; } catch { throw new Fail('The image could not be uploaded. Please try again.', 503); }
  if (!upstream.ok || result?.success !== true || !(Number(image.expiration) >= 60)) throw new Fail('The image could not be uploaded with temporary storage. Please try again.', 503);
  const proof = { slot, url: direct.toString(), sha256, expiresAt: new Date(Date.now() + Number(image.expiration) * 1000).toISOString() };
  const sig = await proofSig(env, { ...proof, accountId: ctx.account.id, giveawayId: g.id });
  return { ok: true, proof: { ...proof, sig }, ttlHours: g.proof_ttl_hours };
}

function detectType(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 6 && String.fromCharCode(...b.slice(0, 4)) === 'GIF8') return 'image/gif';
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

// Turns what the browser sent into stored proof, but only if we signed it ourselves.
async function readProofs(env, g, accountId, input) {
  const reqs = requirementsFor(g.requirements).filter((r) => r.input === 'image');
  const proof = [];
  for (const r of reqs) {
    const p = input?.[r.id];
    if (!p) continue;
    const item = { slot: r.id, url: clean(p.url, 600), sha256: clean(p.sha256, 64), expiresAt: clean(p.expiresAt, 40) };
    const good = (await proofSig(env, { ...item, accountId, giveawayId: g.id })) === clean(p.sig, 80);
    if (!good) throw new Fail('One of your screenshots was not uploaded through this page. Upload it again.', 400);
    proof.push({ slot: r.id, url: item.url, sha256: item.sha256, uploaded_at: nowIso(), expires_at: item.expiresAt, state: 'ok', checked_at: nowIso() });
  }
  const hashes = proof.map((p) => p.sha256);
  if (new Set(hashes).size !== hashes.length) throw new Fail('Use a different screenshot for each step.', 422);
  return proof;
}

async function enterApi(request, env, db, g, ctx) {
  assertOpen(g);
  requireKey(env);
  const body = await request.json().catch(() => ({}));
  if (body.ack !== true) throw new Fail('You must accept the Giveaway Rules to enter.', 422);
  if (await activeBan(db, ctx.account.id, g.id)) throw new Fail('Your account is paused from giveaways.', 403);
  const existing = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&account_id=eq.' + ctx.account.id + '&select=id&limit=1'))?.[0];
  if (existing) throw new Fail('You have already entered this giveaway.', 409);

  const discord = cleanDiscord(body.discord);
  const proof = await readProofs(env, g, ctx.account.id, body.proofs);
  const draft = { discord_username: discord, discord_norm: discord.toLowerCase(), proof, proof_hashes: proof.map((p) => p.sha256) };
  const checks = await runAutoChecks(db, env, g, ctx.account.id, draft);
  if (!checks.passed) throw new Fail('Some requirements are not complete yet.', 422, { eligibility: checks });

  const ipHash = await networkHash(env, request);
  const dup = await duplicateFlags(db, g.id, ctx.account.id, draft, ipHash);
  const expiry = proof.length ? proof.map((p) => p.expires_at).sort()[0] : null;

  let entry;
  try {
    entry = await db.insert('giveaway_entries', {
      giveaway_id: g.id, account_id: ctx.account.id, status: 'provisional', ...draft,
      proof_expires_at: expiry, checks: checks.results, checks_passed: true, checks_at: nowIso(), flags: dup.flags,
      ip_hash: ipHash, rules_version: RULES_VERSION
    });
  } catch (error) {
    if (/duplicate|unique/i.test(String(error?.message))) throw new Fail('You have already entered this giveaway.', 409);
    throw error;
  }
  await entryEvent(db, entry, 'system', 'automated_checks', 'All automated checks passed: ' + checks.results.map((r) => r.label).join(', ') + '.', { flags: dup.flags });
  await entryEvent(db, entry, 'user', 'entered', 'Entry submitted. Waiting for human review.');
  await bump(db, g.id, 'entry');

  // Referral: counts only when the new entrant passed every check, and never from the same network.
  const ref = clean(body.ref, 24).toLowerCase();
  if (/^[a-z0-9._-]{3,24}$/.test(ref) && ref !== ctx.account.username) {
    try {
      const refAccount = (await db.rest('accounts?username=eq.' + q(ref) + '&select=id&limit=1'))?.[0];
      const refEntry = refAccount && (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&account_id=eq.' + refAccount.id +
        '&status=in.(provisional,approved)&select=id,ip_hash&limit=1'))?.[0];
      if (refEntry) {
        const sameNet = ipHash && refEntry.ip_hash === ipHash;
        await db.insert('giveaway_referrals', { giveaway_id: g.id, referrer_account_id: refAccount.id, referred_account_id: ctx.account.id, status: sameNet ? 'void' : 'counted' });
        await db.patch('giveaway_entries', 'id=eq.' + entry.id, { referred_by: refAccount.id, flags: sameNet ? [...new Set([...dup.flags, 'ref_shared_network'])] : dup.flags });
        await bump(db, g.id, 'referral');
      }
    } catch { /* a failed referral must never block an entry */ }
  }
  return { ok: true, entry: memberEntry(entry) };
}

async function fixApi(request, env, db, g, ctx) {
  const s = effectiveStatus(g);
  if (!['live', 'closed'].includes(s)) throw new Fail('This giveaway is no longer open for changes.', 409);
  requireKey(env);
  const entry = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&account_id=eq.' + ctx.account.id + '&select=*&limit=1'))?.[0];
  if (!entry) throw new Fail('You have not entered this giveaway.', 404);
  if (!['needs_proof', 'provisional'].includes(entry.status)) throw new Fail('This entry can no longer be changed.', 409);
  if (entry.status === 'needs_proof' && entry.fix_deadline && Date.parse(entry.fix_deadline) < Date.now()) throw new Fail('The deadline to correct this proof has passed.', 409);
  if (s === 'closed' && entry.status !== 'needs_proof') throw new Fail('Entries are closed for this giveaway.', 409);
  if (await activeBan(db, ctx.account.id, g.id)) throw new Fail('Your account is paused from giveaways.', 403);
  const body = await request.json().catch(() => ({}));
  const discord = body.discord !== undefined ? cleanDiscord(body.discord) : entry.discord_username;
  const fresh = await readProofs(env, g, ctx.account.id, body.proofs);
  const merged = new Map((entry.proof || []).map((p) => [p.slot, p]));
  for (const p of fresh) merged.set(p.slot, p);
  const proof = [...merged.values()];
  const draft = { discord_username: discord, discord_norm: discord.toLowerCase(), proof, proof_hashes: proof.map((p) => p.sha256) };
  if (new Set(draft.proof_hashes).size !== draft.proof_hashes.length) throw new Fail('Use a different screenshot for each step.', 422);
  const checks = await runAutoChecks(db, env, g, ctx.account.id, draft);
  if (!checks.passed) throw new Fail('Some requirements are not complete yet.', 422, { eligibility: checks });
  const dup = await duplicateFlags(db, g.id, ctx.account.id, draft, entry.ip_hash);
  const [updated] = await db.patch('giveaway_entries', 'id=eq.' + entry.id, {
    ...draft, status: 'provisional', fix_deadline: null, checks: checks.results, checks_passed: true, checks_at: nowIso(),
    flags: dup.flags, proof_expires_at: proof.map((p) => p.expires_at).sort()[0] || null
  });
  await entryEvent(db, entry, 'user', 'proof_updated', 'Corrected proof submitted. Back in review.');
  return { ok: true, entry: memberEntry(updated) };
}

async function boostApi(db, g, ctx) {
  assertOpen(g);
  const bonus = { ...BONUS_DEFAULTS, ...(g.bonus || {}) };
  if (!bonus.daily) throw new Fail('Daily boosts are not enabled for this giveaway.', 409);
  const entry = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&account_id=eq.' + ctx.account.id + '&select=id,status&limit=1'))?.[0];
  if (!entry || !['provisional', 'approved'].includes(entry.status)) throw new Fail('Enter the giveaway first to use boosts.', 409);
  const t = await ticketsFor(db, g, ctx.account.id);
  if (t.boostedToday) throw new Fail('You already boosted today. Come back tomorrow.', 409);
  if (t.daily >= bonus.dailyCap) throw new Fail('You have reached the maximum of ' + bonus.dailyCap + ' daily boosts.', 409);
  try {
    await db.rest('giveaway_checkins', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ giveaway_id: g.id, account_id: ctx.account.id, day: utcDay() }) });
  } catch (error) {
    if (/duplicate|unique/i.test(String(error?.message))) throw new Fail('You already boosted today. Come back tomorrow.', 409);
    throw error;
  }
  await bump(db, g.id, 'boost');
  return { ok: true, tickets: await ticketsFor(db, g, ctx.account.id) };
}

async function withdrawApi(db, g, ctx) {
  const entry = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&account_id=eq.' + ctx.account.id + '&select=*&limit=1'))?.[0];
  if (!entry || !['provisional', 'approved', 'needs_proof'].includes(entry.status)) throw new Fail('Nothing to withdraw.', 404);
  if (!['live', 'closed'].includes(effectiveStatus(g))) throw new Fail('The draw has started, so this entry can no longer be withdrawn.', 409);
  await db.patch('giveaway_entries', 'id=eq.' + entry.id, { status: 'withdrawn' });
  await entryEvent(db, entry, 'user', 'withdrawn', 'Entry withdrawn by the entrant.');
  return { ok: true };
}

async function mineApi(db, ctx) {
  const entries = (await db.rest('giveaway_entries?account_id=eq.' + ctx.account.id + '&select=id,giveaway_id,status,review_reason,reviewed_at,fix_deadline,created_at&order=created_at.desc&limit=40')) || [];
  const winners = (await db.rest('giveaway_winners?account_id=eq.' + ctx.account.id + '&status=in.(selected,awaiting_claim,code_verified,paid,forfeited)&select=' + winnerPublicFields() + '&order=created_at.desc&limit=20')) || [];
  const ids = [...new Set([...entries.map((e) => e.giveaway_id), ...winners.map((w) => w.giveaway_id)])];
  const gmap = new Map();
  if (ids.length) for (const g of (await db.rest('giveaways?id=in.(' + ids.join(',') + ')&select=id,slug,title,kind,accent,status,results_published_at,currency,prize_cents,prize_label')) || []) gmap.set(g.id, g);
  const events = entries.length ? (await db.rest('giveaway_entry_events?entry_id=in.(' + entries.map((e) => e.id).join(',') + ')&select=entry_id,actor,action,reason,created_at&order=created_at.desc&limit=120')) || [] : [];
  const ban = await activeBan(db, ctx.account.id, null);
  return {
    entries: entries.map((e) => ({ ...e, giveaway: gmap.get(e.giveaway_id) || null, events: events.filter((ev) => ev.entry_id === e.id).slice(0, 8) })),
    // A selected winner stays hidden until an admin has reviewed the entry and announced results.
    prizes: winners.filter((w) => ['awaiting_claim', 'code_verified', 'paid'].includes(w.status) && gmap.get(w.giveaway_id)?.results_published_at)
      .map((w) => ({ ...w, giveaway: gmap.get(w.giveaway_id), prize: Number(w.prize_cents || 0) > 0 ? money(w.prize_cents, gmap.get(w.giveaway_id)?.currency) : (gmap.get(w.giveaway_id)?.prize_label || 'In-game reward') })),
    ban: ban ? { reason: ban.reason, endsAt: ban.ends_at, permanent: !ban.ends_at } : null
  };
}

async function ownWinner(db, ctx, id) {
  if (!UUID_RE.test(id)) throw new Fail('Prize not found.', 404);
  const w = (await db.rest('giveaway_winners?id=eq.' + id + '&account_id=eq.' + ctx.account.id + '&select=' + winnerPublicFields() + ',claim_code_enc&limit=1'))?.[0];
  if (!w) throw new Fail('Prize not found.', 404);
  return w;
}

async function claimContact(request, db, ctx, id) {
  const w = await ownWinner(db, ctx, id);
  if (w.status !== 'awaiting_claim') throw new Fail('Your claim details are locked for this prize.', 409);
  const body = await request.json().catch(() => ({}));
  const handle = clean(body.handle, 64).replace(/^@/, '');
  const fcUid = clean(body.fcUid, 32).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9_.]{2,32}$/.test(handle)) throw new Fail('Enter your Discord username exactly as it appears on Discord.', 422);
  if (!/^\d{6,20}$/.test(fcUid)) throw new Fail('Enter a valid FC Mobile UID using 6 to 20 digits.', 422);
  await db.patch('giveaway_winners', 'id=eq.' + w.id, { contact_channel: 'discord', contact_handle: handle, fc_uid: fcUid, contact_set_at: nowIso() });
  await audit(db, w.giveaway_id, 'winner_claim_details_saved', { winner: w.id, channel: 'discord' }, 'user');
  return { ok: true, saved: true };
}

async function claimReveal(env, db, ctx, id) {
  const w = await ownWinner(db, ctx, id);
  if (!['awaiting_claim', 'code_verified'].includes(w.status)) throw new Fail('There is no claim code to show for this prize.', 409);
  if (!w.contact_handle || !/^\d{6,20}$/.test(String(w.fc_uid || ''))) {
    throw new Fail('Complete the Discord username and FC Mobile UID form before revealing your code.', 409);
  }
  if (w.code_reveals >= 30) throw new Fail('Too many reveals. Contact an admin through the official Discord.', 429);
  const code = await openCode(env, w.claim_code_enc);
  await db.patch('giveaway_winners', 'id=eq.' + w.id, { code_reveals: w.code_reveals + 1, last_revealed_at: nowIso() });
  return { ok: true, code };
}

// ───────────── admin: giveaways ─────────────
const httpsOrEmpty = (v) => { const s = clean(v, 600); return /^https:\/\//i.test(s) ? s : ''; };
const isoOrNull = (v) => { if (!v) return null; const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString() : undefined; };
const intIn = (v, min, max, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };

function cleanGiveawayInput(body, existing) {
  const out = {};
  const locked = existing && existing.status !== 'draft';
  const set = (k, v) => { if (v !== undefined) out[k] = v; };
  if (body.title !== undefined) { const t = clean(body.title, 120); if (t.length < 3) throw new Fail('Title needs at least 3 characters.'); set('title', t); }
  if (body.tagline !== undefined) set('tagline', clean(body.tagline, 200));
  if (body.description !== undefined) set('description', clean(body.description, 4000));
  if (body.prizeLabel !== undefined) set('prize_label', clean(body.prizeLabel, 80) || 'In-game reward');
  if (body.bonusPrizeCents !== undefined) set('bonus_prize_cents', intIn(body.bonusPrizeCents, 0, 100000000, 0));
  if (body.alternateCount !== undefined) set('alternate_count', intIn(body.alternateCount, 0, 50, 3));
  if (body.coverUrl !== undefined) set('cover_url', httpsOrEmpty(body.coverUrl) || null);
  if (body.accent !== undefined) set('accent', /^#[0-9a-fA-F]{6}$/.test(body.accent) ? body.accent : '#f6c453');
  if (body.claimWindowHours !== undefined) set('claim_window_hours', intIn(body.claimWindowHours, 1, 720, 72));
  if (body.startsAt !== undefined) { const v = isoOrNull(body.startsAt); if (v === undefined) throw new Fail('Start date is not valid.'); set('starts_at', v); }
  if (body.endsAt !== undefined) { const v = isoOrNull(body.endsAt); if (v === undefined) throw new Fail('End date is not valid.'); set('ends_at', v); }
  if (body.milestones !== undefined) set('milestones', cleanMilestones(body.milestones));
  if (body.bonus !== undefined) {
    const b = body.bonus || {};
    set('bonus', { daily: b.daily !== false, dailyCap: intIn(b.dailyCap, 0, 30, 7), referral: b.referral !== false, referralCap: intIn(b.referralCap, 0, 50, 10) });
  }
  const lockedFields = {
    kind: () => set('kind', KINDS[body.kind] ? body.kind : 'custom'),
    prizeCents: () => set('prize_cents', intIn(body.prizeCents, 0, 100000000, 0)),
    currency: () => set('currency', /^[A-Z]{3}$/.test(body.currency) ? body.currency : 'USD'),
    winnerCount: () => set('winner_count', intIn(body.winnerCount, 1, 50, 1)),
    proofTtlHours: () => set('proof_ttl_hours', intIn(body.proofTtlHours, 1, 720, 24)),
    requirements: () => set('requirements', requirementsFor(body.requirements))
  };
  for (const [field, apply] of Object.entries(lockedFields)) {
    if (body[field] === undefined) continue;
    if (locked) throw new Fail('"' + field + '" cannot change after the giveaway has gone live, because entrants already relied on it.', 409);
    apply();
  }
  const s = out.starts_at ?? existing?.starts_at, e = out.ends_at ?? existing?.ends_at;
  if (s && e && Date.parse(e) <= Date.parse(s)) throw new Fail('The end date must be after the start date.');
  return out;
}

async function adminList(db) {
  const [rows, counts, wins] = await Promise.all([
    db.rest('giveaways?select=' + PUBLIC_COLUMNS + ',draw_seed&order=created_at.desc&limit=60'),
    db.rpc('giveaway_admin_counts'),
    db.rest('giveaway_winners?status=in.(selected,awaiting_claim,code_verified,paid)&select=giveaway_id,status&limit=2000')
  ]);
  return (rows || []).map((g) => {
    const { draw_seed, ...rest } = g;
    const byStatus = {};
    for (const c of counts || []) if (c.giveaway_id === g.id) byStatus[c.status] = Number(c.n);
    const w = {};
    for (const x of wins || []) if (x.giveaway_id === g.id) w[x.status] = (w[x.status] || 0) + 1;
    return { ...rest, requirements: requirementsFor(g.requirements), effectiveStatus: effectiveStatus(g), entryCounts: byStatus, winnerCounts: w, hasSeed: Boolean(draw_seed) };
  });
}

async function createGiveaway(db, body) {
  const slug = clean(body.slug, 64).toLowerCase();
  if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) throw new Fail('Use a slug with 3 to 64 lowercase letters, numbers and hyphens.');
  const input = cleanGiveawayInput({ kind: 'custom', title: body.title, ...body }, null);
  if (!input.title) throw new Fail('Title needs at least 3 characters.');
  try {
    const row = await db.insert('giveaways', { slug, requirements: requirementsFor(body.requirements), ...input });
    await audit(db, row.id, 'giveaway_created', { slug });
    return row;
  } catch (error) {
    if (/duplicate|unique/i.test(String(error?.message))) throw new Fail('That slug is already used.', 409);
    throw error;
  }
}

async function setStatus(db, env, g, to) {
  const from = g.status;
  const ok = {
    draft: ['live', 'cancelled'], live: ['closed', 'cancelled'], closed: ['live', 'cancelled'],
    drawn: ['completed'], completed: [], cancelled: []
  };
  if (!ok[from]?.includes(to)) throw new Fail('A ' + from + ' giveaway cannot move to ' + to + '.', 409);
  const values = { status: to };
  const warnings = [];
  if (to === 'live') {
    requireKey(env);
    if (!g.ends_at || Date.parse(g.ends_at) <= Date.now()) throw new Fail('Set an end date in the future before going live.', 409);
    const reqs = requirementsFor(g.requirements);
    const official = await loadOfficial(env, db.rest3);
    if (reqs.some((r) => r.type === 'discord_join') && !official.discordInvite) throw new Fail('Add your official Discord invite link in Settings first. Entrants need it to join.', 409);
    if (!official.discordHandle && !official.instagramHandle) warnings.push('No official claim handle is set in Settings. Winners will not know where to send their code.');
    if (!g.seed_commit) { const seed = randomSeed(); values.draw_seed = seed; values.seed_commit = await sha256Hex(seed); }
    if (!g.starts_at) values.starts_at = nowIso();
    values.rules_version = RULES_VERSION;
  }
  if (to === 'completed') {
    const open = await db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&status=in.(selected,awaiting_claim,code_verified)&select=id&limit=1');
    if (open.length) throw new Fail('Some winners still have rewards pending delivery or unresolved claims.', 409);
  }
  const row = (await db.patch('giveaways', 'id=eq.' + g.id + '&status=eq.' + from, values))?.[0];
  if (!row) throw new Fail('The giveaway changed while you were working. Reload and try again.', 409);
  await audit(db, g.id, 'status_' + to, { from });
  return { row, warnings };
}

// ───────────── admin: entries ─────────────
async function applyBan(db, accountId, giveawayId, reason, mode = {}, issuedBy = 'admin') {
  const prior = await db.rest('giveaway_bans?account_id=eq.' + accountId + '&select=id');
  const strike = prior.length + 1;
  let days;
  if (mode.permanent) days = null;
  else if (mode.days !== undefined && mode.days !== null && mode.days !== '') days = intIn(mode.days, 1, 3650, 14);
  else days = banDaysForStrike(strike);
  const ban = await db.insert('giveaway_bans', {
    account_id: accountId, giveaway_id: giveawayId || null, strike, reason: clean(reason, 600) || 'Rule violation',
    ends_at: days ? addHours(days * 24) : null, issued_by: issuedBy
  });
  await audit(db, giveawayId, 'ban_issued', { account: accountId, strike, days });
  return ban;
}

async function decideEntry(db, g, entry, body) {
  const decision = clean(body.decision, 20);
  let reason = clean(body.reason, 600);
  const active = await db.rest('giveaway_winners?entry_id=eq.' + entry.id + '&status=in.(selected,awaiting_claim,code_verified,paid)&select=id&limit=1');
  if (active.length) throw new Fail('This entrant is a winner. Use the Winners tab to change that.', 409);
  const patch = { reviewed_at: nowIso(), reviewed_by: 'admin' };
  let action;
  if (decision === 'approve') {
    patch.status = 'approved'; patch.fix_deadline = null; reason = reason || 'Proof checked and approved.'; action = 'approved';
  } else if (decision === 'reject') {
    if (reason.length < 5) throw new Fail('Give the entrant a reason (at least 5 characters).');
    patch.status = body.ban ? 'disqualified' : 'rejected'; action = body.ban ? 'disqualified' : 'rejected';
  } else if (decision === 'request_fix') {
    if (reason.length < 5) throw new Fail('Tell the entrant what to correct (at least 5 characters).');
    patch.status = 'needs_proof'; patch.fix_deadline = addHours(intIn(body.hours, 1, 168, 24)); action = 'proof_requested';
  } else throw new Fail('Unknown decision.');
  patch.review_reason = reason;
  const [row] = await db.patch('giveaway_entries', 'id=eq.' + entry.id, patch);
  await entryEvent(db, entry, 'admin', action, reason, decision === 'request_fix' ? { deadline: patch.fix_deadline } : {});
  if (decision === 'reject') {
    await db.patch('giveaway_referrals', 'giveaway_id=eq.' + g.id + '&referred_account_id=eq.' + entry.account_id, { status: 'void' });
    if (body.ban) await applyBan(db, entry.account_id, body.ban.thisGiveawayOnly ? g.id : null, reason, body.ban);
  }
  await audit(db, g.id, 'entry_' + action, { entry: entry.id });
  return row;
}

async function recheckEntry(db, env, g, entry) {
  const draft = { ...entry, proof: JSON.parse(JSON.stringify(entry.proof || [])) };
  const checks = await runAutoChecks(db, env, g, entry.account_id, draft, { fresh: true });
  const dup = await duplicateFlags(db, g.id, entry.account_id, entry, entry.ip_hash);
  const flags = new Set([...dup.flags]);
  if (draft.proof.some((p) => p.state !== 'ok')) flags.add('proof_unavailable');
  const [row] = await db.patch('giveaway_entries', 'id=eq.' + entry.id, {
    proof: draft.proof, checks: checks.results, checks_passed: checks.passed, checks_at: nowIso(), flags: [...flags]
  });
  await entryEvent(db, entry, 'system', 'rechecked', checks.passed ? 'Automated re-check passed.' : 'Automated re-check found: ' + checks.results.filter((r) => !r.ok).map((r) => r.label + ' (' + r.detail + ')').join('; ') + '.');
  return row;
}

async function listEntries(db, g, url) {
  const p = url.searchParams;
  const parts = ['giveaway_id=eq.' + g.id];
  const status = clean(p.get('status'), 20);
  if (status && status !== 'all') parts.push('status=eq.' + q(status));
  const flag = clean(p.get('flag'), 24);
  if (flag === 'any') parts.push('flags=not.eq.' + q('{}'));
  else if (/^[a-z_]+$/.test(flag)) parts.push('flags=cs.' + q('{' + flag + '}'));
  const search = clean(p.get('q'), 40).replace(/[*(),]/g, '');
  if (search) {
    const hit = (await db.rest('accounts?username=ilike.' + q('*' + search + '*') + '&select=id&limit=60')) || [];
    const byDiscord = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&discord_norm=ilike.' + q('*' + search.toLowerCase() + '*') + '&select=account_id&limit=60')) || [];
    const ids = [...new Set([...hit.map((a) => a.id), ...byDiscord.map((a) => a.account_id)])];
    if (!ids.length) return { entries: [], total: 0 };
    parts.push('account_id=in.(' + ids.join(',') + ')');
  }
  const order = p.get('sort') === 'expiry' ? 'proof_expires_at.asc.nullslast' : 'created_at.desc';
  const limit = intIn(p.get('limit'), 1, 100, 40), offset = intIn(p.get('offset'), 0, 1000000, 0);
  const res = await db.rest('giveaway_entries?' + parts.join('&') + '&select=*&order=' + order + '&limit=' + limit + '&offset=' + offset, { returnMeta: true, headers: { Prefer: 'count=exact' } });
  const rows = res.body || [];
  const total = Number(String(res.headers.get('content-range') || '').split('/')[1]) || rows.length;
  const ids = rows.map((r) => r.account_id);
  const [accounts, profiles, bans] = await Promise.all([
    accountMap(db, ids),
    ids.length ? db.rest('account_game_profiles?account_id=in.(' + ids.join(',') + ')&select=account_id,fc_mobile_uid,in_game_username,region_server,discord_handle') : [],
    ids.length ? db.rest('giveaway_bans?account_id=in.(' + ids.join(',') + ')&select=account_id') : []
  ]);
  const gp = new Map((profiles || []).map((x) => [x.account_id, x]));
  return {
    total,
    entries: rows.map((r) => ({
      ...r, ip_hash: undefined, account: accounts.get(r.account_id) || null, profile: gp.get(r.account_id) || null,
      strikes: (bans || []).filter((b) => b.account_id === r.account_id).length
    }))
  };
}

async function entryDetail(db, g, entryId) {
  const entry = (await db.rest('giveaway_entries?id=eq.' + entryId + '&giveaway_id=eq.' + g.id + '&select=*&limit=1'))?.[0];
  if (!entry) throw new Fail('Entry not found.', 404);
  const dup = await duplicateFlags(db, g.id, entry.account_id, entry, entry.ip_hash);
  const peers = await accountMap(db, dup.found.map((f) => f.account_id));
  const [events, bans] = await Promise.all([
    db.rest('giveaway_entry_events?entry_id=eq.' + entry.id + '&select=actor,action,reason,created_at&order=created_at.asc&limit=100'),
    db.rest('giveaway_bans?account_id=eq.' + entry.account_id + '&select=id,reason,strike,starts_at,ends_at,lifted_at&order=created_at.desc&limit=10')
  ]);
  return {
    events, bans,
    peers: dup.found.map((f) => ({ type: f.type, entry_id: f.entry_id, username: peers.get(f.account_id)?.username || 'unknown' }))
  };
}

const csvCell = (v) => {
  let s = Array.isArray(v) ? v.join(' ') : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
async function entriesCsv(db, g) {
  const rows = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&select=id,account_id,status,discord_username,flags,review_reason,reviewed_at,created_at&order=created_at.asc&limit=20000')) || [];
  const accounts = await accountMap(db, rows.map((r) => r.account_id));
  const head = ['entry_id', 'username', 'status', 'discord', 'flags', 'review_reason', 'reviewed_at', 'created_at'];
  const lines = [head.join(',')].concat(rows.map((r) => [r.id, accounts.get(r.account_id)?.username, r.status, r.discord_username, r.flags, r.review_reason, r.reviewed_at, r.created_at].map(csvCell).join(',')));
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="' + g.slug + '-entries.csv"', 'cache-control': 'no-store' } });
}

// ───────────── admin: draw and winners ─────────────
async function runDraw(db, env, g) {
  requireKey(env);
  if (g.status !== 'closed') throw new Fail('Close the giveaway before drawing.', 409);
  if (!g.draw_seed || !g.seed_commit) throw new Fail('This giveaway has no committed seed, so a fair draw is not possible.', 409);
  const eligible = await eligibleList(db, g);
  if (!eligible.length) throw new Fail('There are no eligible entries to draw from.', 409);
  const snapshot = eligible.map((e) => ({ id: e.id, tickets: e.tickets }));
  const hash = await entriesHash(g.id, snapshot);
  const total = Number((await db.rpc('giveaway_public_stats', { p_giveaway: g.id }))?.entries || eligible.length);
  const bonusWinners = unlockedMilestones(g.milestones, total).bonusWinners;
  const winnersTotal = Math.min(eligible.length, g.winner_count + bonusWinners);
  const claimed = (await db.patch('giveaways', 'id=eq.' + g.id + '&status=eq.closed', {
    status: 'drawn', drawn_at: nowIso(), entries_hash: hash, draw_snapshot: { entries: snapshot, totalEntries: total, bonusWinners }
  }))?.[0];
  if (!claimed) throw new Fail('This draw was already started.', 409);
  const fresh = { ...g, ...claimed };
  try {
    const ranking = await rankEntries(g.draw_seed, hash, snapshot);
    const byId = new Map(eligible.map((e) => [e.id, e]));
    const rows = [];
    ranking.slice(0, winnersTotal + g.alternate_count).forEach((id, i) => {
      const isWinner = i < winnersTotal;
      rows.push({
        giveaway_id: g.id, entry_id: id, account_id: byId.get(id).accountId, slot: isWinner ? i + 1 : null, rank_position: i + 1,
        status: isWinner ? 'selected' : 'alternate',
        prize_cents: isWinner ? (i + 1 > g.winner_count ? (g.bonus_prize_cents || g.prize_cents) : g.prize_cents) : 0
      });
    });
    await db.insert('giveaway_winners', rows, { many: true });
    await audit(db, g.id, 'draw_completed', { entries: snapshot.length, winners: winnersTotal, alternates: rows.length - winnersTotal, entriesHash: hash });
    return { ok: true, winners: winnersTotal, alternates: rows.length - winnersTotal, entriesHash: hash, eligible: snapshot.length };
  } catch (error) {
    await db.rest('giveaway_winners?giveaway_id=eq.' + g.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});
    await db.patch('giveaways', 'id=eq.' + g.id, { status: 'closed', drawn_at: null, entries_hash: null, draw_snapshot: null }).catch(() => {});
    throw error;
  }
}

async function adminWinners(db, g) {
  const rows = (await db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&select=' + winnerPublicFields() + ',payout_reference&order=rank_position.asc')) || [];
  const [accounts, entries] = await Promise.all([
    accountMap(db, rows.map((r) => r.account_id)),
    rows.length ? db.rest('giveaway_entries?id=in.(' + rows.map((r) => r.entry_id).join(',') + ')&select=id,status,discord_username,proof,flags,checks_passed') : []
  ]);
  const em = new Map((entries || []).map((e) => [e.id, e]));
  return rows.map((w) => ({
    ...w, account: accounts.get(w.account_id) || null, entry: em.get(w.entry_id) || null,
    overdue: w.status === 'awaiting_claim' && w.claim_deadline && Date.parse(w.claim_deadline) < Date.now()
  }));
}

async function winnerAction(db, env, g, wid, body) {
  const w = (await db.rest('giveaway_winners?id=eq.' + wid + '&giveaway_id=eq.' + g.id + '&select=' + winnerPublicFields() + '&limit=1'))?.[0];
  if (!w) throw new Fail('Winner not found.', 404);
  const action = clean(body.action, 20);
  const reason = clean(body.reason, 600);
  const need = (min = 5) => { if (reason.length < min) throw new Fail('Add a reason (at least ' + min + ' characters).'); };
  const slot = w.slot;
  const entry = (await db.rest('giveaway_entries?id=eq.' + w.entry_id + '&select=id,giveaway_id,account_id,status&limit=1'))?.[0];

  if (action === 'approve') {
    if (w.status !== 'selected') throw new Fail('Only a selected winner can be approved.', 409);
    if (entry.status !== 'approved') {
      if (body.override !== true) throw new Fail('This entry has not been approved in the review queue yet. Review the proof first, or confirm the override.', 409, { needsOverride: true });
      need(5);
    }
    await db.patch('giveaway_entries', 'id=eq.' + entry.id, { status: 'approved', reviewed_at: nowIso(), reviewed_by: 'admin', review_reason: reason || 'Winner entry verified.' });
    await entryEvent(db, entry, 'admin', 'winner_approved', reason || 'Winner entry verified.');
    const sealed = await newClaimCode(env);
    const live = Boolean(g.results_published_at);
    await db.patch('giveaway_winners', 'id=eq.' + w.id, {
      status: 'awaiting_claim', claim_code_hash: sealed.hash, claim_code_enc: sealed.enc,
      announced_at: live ? nowIso() : null, claim_deadline: live ? addHours(g.claim_window_hours) : null
    });
  } else if (action === 'reject') {
    if (w.status !== 'selected') throw new Fail('Only a selected winner can be rejected.', 409);
    need();
    await db.patch('giveaway_entries', 'id=eq.' + entry.id, { status: body.ban ? 'disqualified' : 'rejected', reviewed_at: nowIso(), reviewed_by: 'admin', review_reason: reason });
    await entryEvent(db, entry, 'admin', body.ban ? 'disqualified' : 'rejected', reason);
    await db.patch('giveaway_referrals', 'giveaway_id=eq.' + g.id + '&referred_account_id=eq.' + entry.account_id, { status: 'void' });
    if (body.ban) await applyBan(db, entry.account_id, null, reason, body.ban);
    await db.patch('giveaway_winners', 'id=eq.' + w.id, { status: 'forfeited', notes: 'Rejected on review: ' + reason });
    const next = await fillSlot(db, env, g, slot);
    await audit(db, g.id, 'winner_rejected', { winner: w.id, replacement: next?.id || null });
    return { ok: true, replacement: next ? { id: next.id, rank: next.rank_position } : null };
  } else if (action === 'forfeit' || action === 'reroll') {
    if (!['selected', 'awaiting_claim', 'code_verified'].includes(w.status)) throw new Fail('This winner cannot be changed any more.', 409);
    need();
    await db.patch('giveaway_winners', 'id=eq.' + w.id, { status: action === 'reroll' ? 'replaced' : 'forfeited', notes: (action === 'reroll' ? 'Rerolled: ' : 'Forfeited: ') + reason, claim_code_enc: null, claim_code_hash: null });
    const next = await fillSlot(db, env, g, slot);
    await audit(db, g.id, 'winner_' + action, { winner: w.id, reason, replacement: next?.id || null });
    return { ok: true, replacement: next ? { id: next.id, rank: next.rank_position } : null };
  } else if (action === 'verify') {
    if (w.status !== 'awaiting_claim') throw new Fail('Only a winner who is awaiting claim can be verified.', 409);
    const handle = clean(body.handle, 64).replace(/^@/, '');
    const fcUid = clean(body.fcUid, 32).replace(/\s+/g, '');
    if (!handle) throw new Fail('Enter the Discord username the code was sent from.');
    if (!/^\d{6,20}$/.test(fcUid)) throw new Fail('Enter the winner FC Mobile UID to complete verification.');
    const handleMatch = w.contact_handle ? handle.toLowerCase() === w.contact_handle.toLowerCase() : null;
    const uidMatch = w.fc_uid ? fcUid === String(w.fc_uid) : null;
    const matched = handleMatch === true && uidMatch === true;
    if (!matched && body.force !== true) {
      const reason = handleMatch === false ? 'The Discord username does not match the winner record.'
        : uidMatch === false ? 'The FC Mobile UID does not match the winner record.'
        : 'The winner has not saved all required claim details.';
      throw new Fail(reason + ' Do not verify this claim unless you independently confirm the winner.', 409,
        { mismatch: handleMatch === false || uidMatch === false, confirmable: true, handleMatch, uidMatch });
    }
    if (!matched && body.force === true) need(5);
    await db.patch('giveaway_winners', 'id=eq.' + w.id, { status: 'code_verified', verified_at: nowIso(), verified_by: 'admin', verified_handle: handle, handle_matched: matched });
    await audit(db, g.id, 'claim_verified', { winner: w.id, matched, handleMatch, uidMatch, overrideReason: matched ? '' : reason });
  } else if (action === 'paid') {
    if (w.status !== 'code_verified') throw new Fail('Verify the claim code before marking the reward as delivered.', 409);
    const method = clean(body.method, 60);
    if (!method) throw new Fail('Enter how the in-game reward was delivered.');
    await db.patch('giveaway_winners', 'id=eq.' + w.id, {
      status: 'paid', paid_at: nowIso(), paid_by: 'admin', payout_method: method, payout_reference: clean(body.reference, 200),
      payout_proof_url: httpsOrEmpty(body.proofUrl) || null
    });
    await audit(db, g.id, 'reward_delivered', { winner: w.id, method });
  } else if (action === 'extend') {
    if (!['awaiting_claim', 'code_verified'].includes(w.status)) throw new Fail('Nothing to extend.', 409);
    const base = Math.max(Date.now(), w.claim_deadline ? Date.parse(w.claim_deadline) : Date.now());
    await db.patch('giveaway_winners', 'id=eq.' + w.id, { claim_deadline: addHours(intIn(body.hours, 1, 720, 24), base), overdue_flagged: false });
    await audit(db, g.id, 'claim_extended', { winner: w.id, hours: intIn(body.hours, 1, 720, 24) });
  } else if (action === 'rotate_code') {
    if (!['awaiting_claim', 'code_verified'].includes(w.status)) throw new Fail('Nothing to rotate.', 409);
    need();
    const sealed = await newClaimCode(env);
    await db.patch('giveaway_winners', 'id=eq.' + w.id, {
      claim_code_hash: sealed.hash, claim_code_enc: sealed.enc, status: 'awaiting_claim', verified_at: null, verified_by: null, verified_handle: null, handle_matched: null, code_reveals: 0
    });
    await audit(db, g.id, 'code_rotated', { winner: w.id, reason });
  } else if (action === 'note') {
    await db.patch('giveaway_winners', 'id=eq.' + w.id, { notes: clean(body.notes, 1000) });
  } else throw new Fail('Unknown action.');
  return { ok: true };
}

async function publishResults(db, g) {
  if (g.status !== 'drawn') throw new Fail('Draw the giveaway before publishing results.', 409);
  const pending = await db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&status=eq.selected&select=id&limit=1');
  if (pending.length) throw new Fail('Approve or replace every selected winner before publishing, so nobody is announced before their proof is checked.', 409);
  const anyone = await db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&status=in.(awaiting_claim,code_verified,paid)&select=id&limit=1');
  if (!anyone.length) throw new Fail('There are no approved winners to announce.', 409);
  const row = (await db.patch('giveaways', 'id=eq.' + g.id, { results_published_at: g.results_published_at || nowIso(), seed_revealed_at: g.seed_revealed_at || nowIso() }))?.[0];
  await db.patch('giveaway_winners', 'giveaway_id=eq.' + g.id + '&status=eq.awaiting_claim&announced_at=is.null', { announced_at: nowIso(), claim_deadline: addHours(g.claim_window_hours) });
  await audit(db, g.id, 'results_published', {});
  return row;
}

async function verifyCode(env, db, body) {
  requireKey(env);
  if (!isValidClaimCodeShape(body.code)) throw new Fail('That does not look like a valid claim code. Check for typos.', 422);
  const h = await codeHash(env, body.code);
  const w = (await db.rest('giveaway_winners?claim_code_hash=eq.' + h + '&select=' + winnerPublicFields() + '&limit=1'))?.[0];
  if (!w) { await audit(db, null, 'claim_code_no_match', {}); return { found: false }; }
  const [g, accounts] = await Promise.all([getGiveawayById(db, w.giveaway_id, 'id,title,slug,currency,prize_cents,prize_label'), accountMap(db, [w.account_id])]);
  const handle = clean(body.handle, 64).replace(/^@/, '');
  const uid = clean(body.fcUid, 32).replace(/\s+/g, '');
  const matched = handle && w.contact_handle ? handle.toLowerCase() === w.contact_handle.toLowerCase() : null;
  const uidMatched = uid && w.fc_uid ? uid === String(w.fc_uid) : null;
  if (matched === false || uidMatched === false) await db.patch('giveaway_winners', 'id=eq.' + w.id, { claim_attempts: w.claim_attempts + 1 });
  return {
    found: true, handleMatch: matched, uidMatch: uidMatched,
    winner: {
      id: w.id, giveawayId: g?.id, giveaway: g?.title, username: accounts.get(w.account_id)?.username, slot: w.slot,
      prize: Number(w.prize_cents || 0) > 0 ? money(w.prize_cents, g?.currency) : (g?.prize_label || 'In-game reward'), status: w.status, contactChannel: w.contact_channel, contactHandle: w.contact_handle, fcUid: w.fc_uid,
      deadline: w.claim_deadline, overdue: w.claim_deadline ? Date.parse(w.claim_deadline) < Date.now() : false
    }
  };
}

// ───────────── admin: settings, ROI, health ─────────────
async function getSettings(db) {
  const rows = (await db.rest('giveaway_settings?select=key,value')) || [];
  const out = { official: {}, roi: {} };
  for (const r of rows) {
    if (r.key === 'internal_security') continue;
    out[r.key] = r.value;
  }
  return out;
}
async function saveSettings(db, body) {
  if (body.official) {
    const o = body.official;
    const handle = (v) => { const s = clean(v, 64).replace(/^@/, ''); return s && /^[A-Za-z0-9_.]{2,32}$/.test(s) ? s : ''; };
    const value = {
      discord_invite: httpsOrEmpty(o.discord_invite), discord_handle: handle(o.discord_handle),
      instagram_handle: handle(o.instagram_handle), instagram_url: httpsOrEmpty(o.instagram_url), notice: clean(o.notice, 300)
    };
    await db.rest('giveaway_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'official', value, updated_at: nowIso() }) });
  }
  if (body.roi) {
    const value = { rpm_usd: Math.max(0, Math.min(1000, Number(body.roi.rpm_usd) || 0)), pages_per_entrant: Math.max(1, Math.min(200, Number(body.roi.pages_per_entrant) || 6)) };
    await db.rest('giveaway_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'roi', value, updated_at: nowIso() }) });
  }
  await audit(db, null, 'settings_saved', { keys: Object.keys(body) });
  return getSettings(db);
}

async function roiFor(db, g) {
  const [metrics, settings, stats, winners] = await Promise.all([
    db.rest('giveaway_metrics?giveaway_id=eq.' + g.id + '&select=day,event,n&order=day.asc'),
    getSettings(db),
    db.rpc('giveaway_public_stats', { p_giveaway: g.id }),
    db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&status=in.(selected,awaiting_claim,code_verified,paid)&select=prize_cents')
  ]);
  const totals = {};
  for (const m of metrics || []) totals[m.event] = (totals[m.event] || 0) + m.n;
  const entries = Number(stats?.entries || 0);
  const rpm = Number(settings.roi?.rpm_usd || 0), pages = Number(settings.roi?.pages_per_entrant || 6);
  const bonus = unlockedMilestones(g.milestones, entries);
  const baseCost = g.prize_cents * g.winner_count;
  const actualCost = (winners || []).length ? winners.reduce((n, w) => n + w.prize_cents, 0) : baseCost + bonus.bonusWinners * (g.bonus_prize_cents || g.prize_cents);
  const views = (totals.view || 0) + entries * pages;
  const revenueCents = Math.round((views / 1000) * rpm * 100);
  const perEntrantCents = (pages / 1000) * rpm * 100;
  return {
    totals, entries, funnel: { views: totals.view || 0, starts: totals.start || 0, entries, approved: Number(stats?.approved || 0) },
    cost: { baseCents: baseCost, projectedCents: actualCost, currency: g.currency },
    estimate: {
      rpmUsd: rpm, pagesPerEntrant: pages, pageviews: views, revenueCents,
      multiple: actualCost > 0 && rpm > 0 ? Math.round((revenueCents / actualCost) * 10) / 10 : null,
      entriesFor10x: perEntrantCents > 0 ? Math.ceil((actualCost * 10) / perEntrantCents) : null,
      configured: rpm > 0
    },
    daily: (metrics || []).filter((m) => m.event === 'entry' || m.event === 'view')
  };
}

async function healthFor(env, db) {
  const checks = [];
  const add = (id, label, ok, fix) => checks.push({ id, label, ok, fix: ok ? '' : fix });
  add('key', 'Server-managed cryptographic key', keyConfigured(env), 'The key is generated automatically in the private giveaway settings table. No GIVEAWAY_CODE_KEY Worker secret is required.');
  add('images', 'Image host key (IMAGEBB_API_KEY)', Boolean(String(env.IMAGEBB_API_KEY || '').trim()), 'Add the IMAGEBB_API_KEY Worker secret. Proof uploads depend on it.');
  let dbOk = false;
  try { await db.rest('giveaways?select=id&limit=1'); dbOk = true; } catch { /* reported below */ }
  add('db', 'Database tables are installed', dbOk, 'Run the migration 20261018120000_giveaway_system.sql in Supabase.');
  const official = await loadOfficial(env, db.rest3);
  add('discord', 'Official Discord invite is set', Boolean(official.discordInvite), 'Add your Discord invite link in Settings.');
  add('handle', 'An official claim handle is set (Discord or Instagram)', Boolean(official.discordHandle || official.instagramHandle), 'Add the official Discord or Instagram handle winners must send their code to.');
  return { ok: checks.every((c) => c.ok), checks, rulesVersion: RULES_VERSION };
}

// ───────────── scheduled maintenance (hourly cron) ─────────────
export async function giveawaySweep(env, supabaseRest) {
  return sweepWith(makeDb(env, supabaseRest));
}

async function sweepWith(db) {
  const out = { closed: 0, proofsExpired: 0, overdue: 0 };
  // 1. Close giveaways whose end time has passed.
  const closed = await db.patch('giveaways', 'status=eq.live&ends_at=lt.' + q(nowIso()), { status: 'closed' });
  for (const g of closed || []) { out.closed += 1; await audit(db, g.id, 'auto_closed', {}, 'system'); }
  // 2. Unreviewed entries whose proof image has expired are asked to upload it again.
  const stale = (await db.rest('giveaway_entries?status=eq.provisional&proof_expires_at=lt.' + q(nowIso()) + '&select=id,giveaway_id,account_id&limit=200')) || [];
  const gids = [...new Set(stale.map((e) => e.giveaway_id))];
  const open = new Map();
  if (gids.length) for (const g of (await db.rest('giveaways?id=in.(' + gids.join(',') + ')&status=in.(live,closed)&select=id,proof_ttl_hours')) || []) open.set(g.id, g);
  for (const e of stale) {
    const g = open.get(e.giveaway_id);
    if (!g) continue;
    await db.patch('giveaway_entries', 'id=eq.' + e.id + '&status=eq.provisional', { status: 'needs_proof', fix_deadline: addHours(g.proof_ttl_hours), review_reason: 'Your proof image expired before review. Upload it again to stay in the draw.', reviewed_at: nowIso(), reviewed_by: 'system' });
    await entryEvent(db, e, 'system', 'proof_expired', 'Your proof image expired before review. Upload it again to stay in the draw.');
    out.proofsExpired += 1;
  }
  // 3. Flag claims that passed their deadline. An admin decides what happens next.
  const late = (await db.patch('giveaway_winners', 'status=eq.awaiting_claim&overdue_flagged=eq.false&claim_deadline=lt.' + q(nowIso()), { overdue_flagged: true })) || [];
  for (const w of late) { out.overdue += 1; await audit(db, w.giveaway_id, 'claim_overdue', { winner: w.id }, 'system'); }
  return out;
}

// ───────────── routing ─────────────
function purge(ctx, url, slug) {
  try {
    const cache = caches.default;
    const keys = ['/api/giveaways/public', '/api/giveaways/winners'];
    if (slug) keys.push('/api/giveaways/' + slug);
    ctx?.waitUntil?.(Promise.all(keys.map((k) => cache.delete(new Request(url.origin + k)))));
  } catch { /* cache is best effort */ }
}

async function cached(ctx, url, ttl, build) {
  const cache = caches.default;
  const key = new Request(url.origin + url.pathname);
  const hit = await cache.match(key);
  if (hit) return hit;
  const body = await build();
  if (body === null) return null;
  const res = new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + ttl } });
  ctx?.waitUntil?.(cache.put(key, res.clone()));
  return res;
}

export async function giveawayWorkerRoute({ request, env, url, ctx, authenticated, accountContext, supabaseRest, json, reserveImageUploadQuota }) {
  const path = url.pathname;
  const isAdmin = path === '/api/admin/giveaways' || path.startsWith('/api/admin/giveaways/');
  if (!isAdmin && !path.startsWith('/api/giveaways/') && path !== '/api/giveaways') return null;
  const db = makeDb(env, supabaseRest);
  const m = request.method;
  try {
    const slugOnly = /^\/api\/giveaways\/([a-z0-9-]+)$/.exec(path);
    const publicRead = m === 'GET' && (
      path === '/api/giveaways/public' || path === '/api/giveaways/winners' ||
      (slugOnly && !RESERVED_SLUGS.has(slugOnly[1])) ||
      /^\/api\/giveaways\/[a-z0-9-]+\/draw-proof$/.test(path)
    );
    if (isAdmin && !(await authenticated(request, env))) return json({ error: 'Authentication required.' }, 401);
    if (!publicRead) {
      env = { ...env, GIVEAWAY_CODE_KEY: await ensureInternalSecurityKey(db) };
    }
    if (isAdmin) return await adminRoute(request, env, url, ctx, db, json);
    const rest = path.replace(/^\/api\/giveaways\/?/, '');
    const seg = rest.split('/').filter(Boolean);

    // ── public ──
    if (m === 'GET' && seg[0] === 'public' && seg.length === 1) {
      return (await cached(ctx, url, 30, () => loadPublicList(env, supabaseRest))) || json({ giveaways: [] });
    }
    if (m === 'GET' && seg[0] === 'winners' && seg.length === 1) {
      return (await cached(ctx, url, 60, () => loadWinnersWall(env, supabaseRest))) || json({ winners: [] });
    }
    // ── signed in, not tied to one giveaway ──
    if (seg[0] === 'mine' && m === 'GET') return json(await mineApi(db, await member(request, env, accountContext, { verified: false })));
    if (seg[0] === 'claims' && seg.length === 3 && m === 'POST') {
      const ctxm = await member(request, env, accountContext);
      if (seg[2] === 'contact') return json(await claimContact(request, db, ctxm, seg[1]));
      if (seg[2] === 'reveal') return json(await claimReveal(env, db, ctxm, seg[1]), 200, { 'cache-control': 'no-store, private' });
    }
    // ── one giveaway ──
    const slug = (seg[0] || '').toLowerCase();
    if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) return json({ error: 'Not found.' }, 404);
    const sub = seg[1] || '';

    if (m === 'GET' && !sub) {
      const res = await cached(ctx, url, 20, async () => await loadPublicOne(env, supabaseRest, slug));
      return res || json({ error: 'Giveaway not found.' }, 404);
    }
    if (m === 'GET' && sub === 'draw-proof') {
      const g = await getGiveawayBySlug(db, slug, 'id,slug,title,status,seed_commit,draw_seed,entries_hash,draw_snapshot,seed_revealed_at,winner_count,alternate_count');
      if (!g || !g.seed_revealed_at) return json({ error: 'The seed is revealed when results are published.' }, 404);
      const winners = (await db.rest('giveaway_winners?giveaway_id=eq.' + g.id + '&select=slot,rank_position,status,entry_id&order=rank_position.asc')) || [];
      return json({
        giveawayId: g.id, seedCommit: g.seed_commit, seed: g.draw_seed, entriesHash: g.entries_hash,
        entries: g.draw_snapshot?.entries || [], winners: winners.map((w) => ({ slot: w.slot, rank: w.rank_position, status: w.status, entryId: w.entry_id }))
      }, 200, { 'cache-control': 'public, max-age=60' });
    }
    if (m === 'POST' && sub === 'track') {
      const body = await request.json().catch(() => ({}));
      const ev = clean(body.event, 12);
      if (!['view', 'start', 'share'].includes(ev)) return json({ error: 'Unknown event.' }, 400);
      const g = await getGiveawayBySlug(db, slug, 'id,status');
      if (g && g.status === 'live') await bump(db, g.id, ev);
      return json({ ok: true });
    }

    // ── member actions on one giveaway ──
    const g = await getGiveawayBySlug(db, slug);
    if (!g || g.status === 'draft') return json({ error: 'Giveaway not found.' }, 404);
    if (m === 'GET' && sub === 'me') return json(await meApi(db, env, g, await member(request, env, accountContext, { verified: false })));
    if (m === 'POST' && sub === 'proof') return json(await proofUpload(request, env, url, db, g, await member(request, env, accountContext), reserveImageUploadQuota));
    if (m === 'POST' && sub === 'enter') {
      const res = await enterApi(request, env, db, g, await member(request, env, accountContext));
      purge(ctx, url, slug);
      return json(res);
    }
    if (m === 'PUT' && sub === 'entry') return json(await fixApi(request, env, db, g, await member(request, env, accountContext)));
    if (m === 'DELETE' && sub === 'entry') { const res = await withdrawApi(db, g, await member(request, env, accountContext)); purge(ctx, url, slug); return json(res); }
    if (m === 'POST' && sub === 'boost') return json(await boostApi(db, g, await member(request, env, accountContext)));
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    if (error instanceof Fail) return json({ error: error.message, ...error.extra }, error.status);
    console.error('[GIVEAWAYS]', path, error?.message || error);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}

async function adminRoute(request, env, url, ctx, db, json) {
  const m = request.method;
  const seg = url.pathname.replace(/^\/api\/admin\/giveaways\/?/, '').split('/').filter(Boolean);
  const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m) ? await request.json().catch(() => ({})) : {};
  const done = (data, slug) => { if (m !== 'GET') purge(ctx, url, slug); return json(data); };

  if (!seg.length) {
    if (m === 'GET') return json({ giveaways: await adminList(db), rulesVersion: RULES_VERSION });
    if (m === 'POST') { const row = await createGiveaway(db, body); return done({ ok: true, id: row.id, slug: row.slug }); }
  }
  if (seg[0] === 'health' && m === 'GET') return json(await healthFor(env, db));
  if (seg[0] === 'settings') {
    if (m === 'GET') return json(await getSettings(db));
    if (m === 'PUT') return done(await saveSettings(db, body));
  }
  if (seg[0] === 'verify-code' && m === 'POST') return json(await verifyCode(env, db, body));
  if (seg[0] === 'audit' && m === 'GET') {
    const gid = url.searchParams.get('giveaway');
    const filter = gid && UUID_RE.test(gid) ? 'giveaway_id=eq.' + gid + '&' : '';
    return json({ audit: (await db.rest('giveaway_audit?' + filter + 'select=id,giveaway_id,actor,action,detail,created_at&order=created_at.desc&limit=100')) || [] });
  }
  if (seg[0] === 'bans') {
    if (m === 'GET') {
      const rows = (await db.rest('giveaway_bans?select=*&order=created_at.desc&limit=100')) || [];
      const accounts = await accountMap(db, rows.map((b) => b.account_id));
      return json({ bans: rows.map((b) => ({ ...b, username: accounts.get(b.account_id)?.username || 'unknown', active: !b.lifted_at && (!b.ends_at || Date.parse(b.ends_at) > Date.now()) })) });
    }
    if (m === 'POST' && seg.length === 1) {
      const username = clean(body.username, 40).toLowerCase();
      const acct = (await db.rest('accounts?username=eq.' + q(username) + '&select=id&limit=1'))?.[0];
      if (!acct) throw new Fail('No account with that username.', 404);
      const reason = clean(body.reason, 600);
      if (reason.length < 5) throw new Fail('Add a reason (at least 5 characters).');
      return json({ ok: true, ban: await applyBan(db, acct.id, null, reason, body) });
    }
    if (m === 'POST' && seg[2] === 'lift' && UUID_RE.test(seg[1])) {
      const reason = clean(body.reason, 600);
      if (reason.length < 5) throw new Fail('Add a reason (at least 5 characters).');
      await db.patch('giveaway_bans', 'id=eq.' + seg[1], { lifted_at: nowIso(), lifted_by: 'admin', lifted_reason: reason });
      await audit(db, null, 'ban_lifted', { ban: seg[1], reason });
      return json({ ok: true });
    }
  }

  // /:id ...
  const g = await getGiveawayById(db, seg[0]);
  if (!g) throw new Fail('Giveaway not found.', 404);
  const sub = seg[1] || '';
  const { draw_seed, draw_snapshot, ...safe } = g;
  if (!sub) {
    if (m === 'GET') return json({ giveaway: { ...safe, requirements: requirementsFor(g.requirements), hasSeed: Boolean(draw_seed) } });
    if (m === 'PUT') {
      const values = cleanGiveawayInput(body, g);
      if (!Object.keys(values).length) return json({ ok: true });
      await db.patch('giveaways', 'id=eq.' + g.id, values);
      await audit(db, g.id, 'giveaway_edited', { fields: Object.keys(values) });
      return done({ ok: true }, g.slug);
    }
    if (m === 'DELETE') {
      const used = await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&select=id&limit=1');
      if (g.status !== 'draft' || used.length) throw new Fail('Only a draft with no entries can be deleted. Cancel it instead.', 409);
      await db.rest('giveaways?id=eq.' + g.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await audit(db, null, 'giveaway_deleted', { slug: g.slug });
      return done({ ok: true }, g.slug);
    }
  }
  if (sub === 'status' && m === 'POST') {
    const out = await setStatus(db, env, g, clean(body.status, 12));
    return done({ ok: true, status: out.row.status, warnings: out.warnings }, g.slug);
  }
  if (sub === 'entries') {
    if (m === 'GET' && !seg[2]) return json(await listEntries(db, g, url));
    if (m === 'GET' && seg[2] === 'export.csv') return entriesCsv(db, g);
    if (m === 'POST' && seg[2] === 'bulk') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x) => UUID_RE.test(x)).slice(0, 100);
      if (!ids.length) throw new Fail('Select at least one entry.');
      if (!['approve', 'request_fix'].includes(body.decision)) throw new Fail('Bulk actions support approve and request_fix. Reject entries one at a time.');
      const rows = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&id=in.(' + ids.join(',') + ')&status=in.(provisional,needs_proof,approved)&select=*')) || [];
      let ok = 0; const skipped = [];
      for (const e of rows) { try { await decideEntry(db, g, e, body); ok += 1; } catch (err) { skipped.push({ id: e.id, error: err.message }); } }
      return done({ ok: true, done: ok, skipped }, g.slug);
    }
    if (UUID_RE.test(seg[2] || '')) {
      if (m === 'GET' && !seg[3]) return json(await entryDetail(db, g, seg[2]));
      const entry = (await db.rest('giveaway_entries?id=eq.' + seg[2] + '&giveaway_id=eq.' + g.id + '&select=*&limit=1'))?.[0];
      if (!entry) throw new Fail('Entry not found.', 404);
      if (m === 'POST' && seg[3] === 'decision') { await decideEntry(db, g, entry, body); return done({ ok: true }, g.slug); }
      if (m === 'POST' && seg[3] === 'recheck') { const row = await recheckEntry(db, env, g, entry); return json({ ok: true, flags: row.flags, checks: row.checks, proof: row.proof, passed: row.checks_passed }); }
    }
  }
  if (sub === 'recheck-all' && m === 'POST') {
    const rows = (await db.rest('giveaway_entries?giveaway_id=eq.' + g.id + '&status=in.(provisional,needs_proof)&select=*&order=checks_at.asc.nullsfirst&limit=30')) || [];
    let failed = 0;
    for (const e of rows) { const r = await recheckEntry(db, env, g, e); if (!r.checks_passed) failed += 1; }
    return json({ ok: true, checked: rows.length, failing: failed });
  }
  if (sub === 'sweep' && m === 'POST') return done({ ok: true, ...(await sweepWith(db)) }, g.slug);
  if (sub === 'winners' && m === 'GET') return json({ winners: await adminWinners(db, g), results: { published: Boolean(g.results_published_at) } });
  if (sub === 'draw' && m === 'POST') {
    if (body.confirm !== true) throw new Fail('Confirm the draw.');
    return done(await runDraw(db, env, g), g.slug);
  }
  if (sub === 'winners' && seg[2] && seg[3] === 'code' && m === 'GET') {
    if (!UUID_RE.test(seg[2])) throw new Fail('Winner not found.', 404);
    const winner = (await db.rest('giveaway_winners?id=eq.' + seg[2] + '&giveaway_id=eq.' + g.id + '&select=id,status,claim_code_enc&limit=1'))?.[0];
    if (!winner || !['awaiting_claim', 'code_verified', 'paid'].includes(winner.status) || !winner.claim_code_enc) {
      throw new Fail('No active claim code exists for this winner.', 404);
    }
    const code = await openCode(env, winner.claim_code_enc);
    await audit(db, g.id, 'claim_code_revealed_to_admin', { winner: winner.id, status: winner.status });
    return json({ ok: true, code }, 200, { 'cache-control': 'no-store, private' });
  }
  if (sub === 'winners' && seg[2] && seg[3] === 'action' && m === 'POST') {
    const out = await winnerAction(db, env, { ...g, draw_seed, draw_snapshot }, seg[2], body);
    return done(out, g.slug);
  }
  if (sub === 'publish-results' && m === 'POST') { await publishResults(db, g); return done({ ok: true }, g.slug); }
  if (sub === 'roi' && m === 'GET') return json(await roiFor(db, g));
  return json({ error: 'Not found.' }, 404);
}
