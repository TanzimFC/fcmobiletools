// FC Mobile redeem-code system — shared server logic.
//
// Codes live in Cloudflare D1 (table `redeem_codes`), so an admin save is public
// within seconds, with no GitHub commit and no site rebuild. The old
// src/data/redeemCodes.js file is now only the one-time seed for a fresh database
// (and a fallback for local `astro dev`).
//
// This module has no Worker-only or Node-only APIs so the Astro build can import
// it too (the page uses REDEEM_FAQ and redeemJsonLd).

import { namespace, pathForLocale, hasLocalizedPage, LOCALES } from '../i18n/index.js';
import { REDEEM_CODES as SEED_CODES } from '../data/redeemCodes.js';

export const STATUSES = ['active', 'scheduled', 'expired'];
export const EA_REDEEM_URL = 'https://redeem.fcm.ea.com/';

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LIMITS = { reward: 160, region: 40, notes: 240, bulk: 100 };

export class RedeemError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);

const isRealDate = (value) => {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

/* ------------------------------------------------------------------ */
/* Schema + one-time seed                                              */
/* ------------------------------------------------------------------ */

let schemaReady = null; // memoised per isolate

export function ensureRedeemSchema(db) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS redeem_codes (
          code TEXT PRIMARY KEY,
          reward TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','scheduled','expired')),
          release_date TEXT NOT NULL,
          expiry_date TEXT,
          region TEXT NOT NULL DEFAULT 'Global',
          last_verified TEXT,
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          updated_by TEXT NOT NULL DEFAULT 'system'
        )`),
        db.prepare('CREATE INDEX IF NOT EXISTS idx_redeem_status_release ON redeem_codes(status, release_date DESC)'),
        db.prepare('CREATE TABLE IF NOT EXISTS redeem_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
      ]);

      const seeded = await db.prepare("SELECT value FROM redeem_meta WHERE key='seeded'").first();
      if (!seeded) {
        const insert = db.prepare(`INSERT OR IGNORE INTO redeem_codes
          (code,reward,status,release_date,expiry_date,region,last_verified,notes,created_at,updated_at,updated_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,'seed')`);
        const statements = SEED_CODES.map((c) => insert.bind(
          String(c.code).toUpperCase(),
          c.reward,
          STATUSES.includes(c.status) ? c.status : 'expired',
          c.releaseDate,
          c.expiryDate || null,
          c.region || 'Global',
          c.lastVerified || null,
          c.notes || '',
          `${c.releaseDate}T00:00:00.000Z`,
          `${c.lastVerified || c.releaseDate}T00:00:00.000Z`,
        ));
        for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50));
        await db.prepare("INSERT OR REPLACE INTO redeem_meta (key,value) VALUES ('seeded',?)").bind(new Date().toISOString()).run();
      }

      // One-time migrations keep the live D1 database in sync with new codes
      // without replaying the full seed or overwriting admin edits.
      const migrationVersion = '2026-10-15-code-status-refresh';
      const migration = await db.prepare("SELECT value FROM redeem_meta WHERE key='seed-migrations'").first();
      if (migration?.value !== migrationVersion) {
        const now = new Date().toISOString();
        const refreshedCodes = [
          {
            code: 'PUMPKINSPICEPACK',
            reward: '116–119 OVR 3rd Anniversary Player Item (community-reported)',
            status: 'active',
            releaseDate: '2026-10-13',
            expiryDate: null,
            region: 'Global',
            lastVerified: '2026-10-15',
            notes: 'Reported active by recent FC Mobile code trackers on October 15, 2026. No expiry date published; community-reported reward is a 116–119 OVR Anniversary Player Item.',
          },
          {
            code: 'GARUDAJUARA',
            reward: '2,000 Gems',
            status: 'active',
            releaseDate: '2026-10-07',
            expiryDate: null,
            region: 'Global / Indonesia promo',
            lastVerified: '2026-10-14',
            notes: '2,000 Gems. ZenithFCM listed this as active globally on October 14; some other trackers list it as expired. Status is disputed; test on EA redemption before relying on it.',
          },
          {
            code: 'MULLERTIME',
            reward: '115 OVR Thomas Müller CAM Player Item',
            status: 'active',
            releaseDate: '2026-10-11',
            expiryDate: null,
            region: 'Global',
            lastVerified: '2026-10-15',
            notes: '115 OVR Thomas Müller CAM Player Item. Status disputed on October 15: some trackers still list it active, while ZenithFCM lists an October 14 expiry. Treat as unconfirmed and try the official redemption portal.',
          },
          {
            code: '3RDANNIVERSARY',
            reward: '1x Draft Voucher + 100x Rank Up Tokens',
            status: 'expired',
            releaseDate: '2026-10-04',
            expiryDate: '2026-10-11',
            region: 'Global',
            lastVerified: '2026-10-15',
            notes: 'Archived as expired by recent code trackers; reported expiry date October 11, 2026.',
          },
          {
            code: 'BANCAPNHATSN1TUOI',
            reward: '2 FC Draft Vouchers + 100M Coins + 300 Rank Up Points',
            status: 'active',
            releaseDate: '2026-10-15',
            expiryDate: '2026-10-19',
            region: 'Vietnam only',
            lastVerified: '2026-10-15',
            notes: 'Official EA SPORTS FC Mobile Vietnam post: available Oct 15–19, 2026. Vietnam version only; not for the global game.',
          },
        ];

        // Insert missing rows, then refresh only these explicitly rechecked records.
        // This leaves unrelated codes and admin-maintained records untouched.
        for (const c of refreshedCodes) {
          await db.prepare([
            "INSERT OR IGNORE INTO redeem_codes",
            "  (code,reward,status,release_date,expiry_date,region,last_verified,notes,created_at,updated_at,updated_by)",
            "  VALUES (?,?,?,?,?,?,?,?,?,?,'seed-migration')",
          ].join("\n")).bind(
            c.code, c.reward, c.status, c.releaseDate, c.expiryDate,
            c.region, c.lastVerified, c.notes,
            c.releaseDate + 'T00:00:00.000Z', now,
          ).run();

          await db.prepare([
            "UPDATE redeem_codes",
            "SET reward=?, status=?, release_date=?, expiry_date=?, region=?,",
            "    last_verified=?, notes=?, updated_at=?, updated_by='seed-migration'",
            "WHERE code=?",
          ].join("\n")).bind(
            c.reward, c.status, c.releaseDate, c.expiryDate, c.region,
            c.lastVerified, c.notes, now, c.code,
          ).run();
        }

        // Add explicit expiry dates for older codes that trackers have archived.
        const knownExpired = [
          ['27UPDATE', '2026-10-04', 'Expired. Recent code trackers report an October 4, 2026 expiry.'],
          ['ZLATANWORLDPREMIERE', '2026-09-25', 'Expired; code trackers report an expiry date of September 25, 2026.'],
          ['ONEMOREDRAFT', '2026-09-16', 'Expired; code trackers report an expiry date of September 16, 2026.'],
          ['BOMBAGOL', '2026-09-16', 'Expired; code trackers report an expiry date of September 16, 2026.'],
          ['AUFGEHTS', '2026-09-05', 'Expired; code trackers report an expiry date of September 5, 2026.'],
          ['NUMEROUNO', '2026-09-05', 'Expired; code trackers report an expiry date of September 5, 2026.'],
          ['CLEANSLATE', '2026-09-05', 'Expired; code trackers report an expiry date of September 5, 2026.'],
          ['POWEROFFOOTBALL', '2026-08-21', 'Expired; code trackers report an expiry date of August 21, 2026.'],
          ['MIDSEASONFINALDAY', '2026-08-12', 'Expired; code trackers report an expiry date of August 12, 2026.'],
          ['CHAMPIONSGO', '2026-08-12', 'Expired; code trackers report an expiry date of August 12, 2026.'],
          ['MIDSEASONBANGKOK', '2026-08-12', 'Expired; code trackers report an expiry date of August 12, 2026.'],
          ['MIDSEASONKICKOFF', '2026-08-12', 'Expired; code trackers report an expiry date of August 12, 2026.'],
          ['FIESTAMX', '2026-08-06', 'Expired; code trackers report an expiry date of August 6, 2026.'],
          ['GOLDENERA', '2026-08-05', 'Expired; code trackers report an expiry date of August 5, 2026.'],
          ['CHAMPSWEEKEND', '2026-08-05', 'Expired; code trackers report an expiry date of August 5, 2026.'],
          ['NATIONALPRIDE', '2026-07-28', 'Expired; code trackers report an expiry date of July 28, 2026.'],
          ['LAFINAL', '2026-07-28', 'Expired; code trackers report an expiry date of July 28, 2026.'],
          ['CHASETHEGLORY', '2026-07-27', 'Expired; code trackers report an expiry date of July 27, 2026.'],
          ['ALLORNOTHING', '2026-07-24', 'Expired; code trackers report an expiry date of July 24, 2026.'],
        ];
        for (const [code, expiryDate, notes] of knownExpired) {
          await db.prepare([
            "UPDATE redeem_codes",
            "SET status='expired', expiry_date=?, last_verified='2026-10-15', notes=?,",
            "    updated_at=?, updated_by='seed-migration'",
            "WHERE code=?",
          ].join("\n")).bind(expiryDate, notes, now, code).run();
        }

        await db.prepare("INSERT OR REPLACE INTO redeem_meta (key,value) VALUES ('seed-migrations',?)")
          .bind(migrationVersion)
          .run();
      }
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

// A code marked "active" whose expiry date has passed is reported as expired,
// so a forgotten admin update can never leave a dead code on the live page.
export function effectiveStatus(row, today = todayISO()) {
  if (row.status === 'active' && row.expiry_date && row.expiry_date < today) return 'expired';
  return row.status;
}

const maskCode = (code) => code.slice(0, 1) + '•'.repeat(Math.max(code.length - 1, 3));

function toAdminCode(row, today) {
  return {
    code: row.code,
    reward: row.reward,
    status: effectiveStatus(row, today),
    storedStatus: row.status,
    releaseDate: row.release_date,
    expiryDate: row.expiry_date || null,
    region: row.region,
    lastVerified: row.last_verified || null,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function toPublicCode(row, today) {
  const status = effectiveStatus(row, today);
  const scheduled = status === 'scheduled';
  return {
    // Codes that are not released yet are masked so they cannot leak early.
    code: scheduled ? maskCode(row.code) : row.code,
    masked: scheduled || undefined,
    reward: row.reward,
    status,
    releaseDate: row.release_date,
    expiryDate: row.expiry_date || null,
    region: row.region,
    lastVerified: row.last_verified || null,
    notes: row.notes || '',
  };
}

export function summarize(codes, today = todayISO()) {
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 2);
  const soonISO = soon.toISOString().slice(0, 10);
  const out = { total: codes.length, active: 0, scheduled: 0, expired: 0, expiringSoon: 0, autoExpired: 0 };
  for (const c of codes) {
    out[c.status] += 1;
    if (c.status === 'active' && c.expiryDate && c.expiryDate <= soonISO) out.expiringSoon += 1;
    if (c.storedStatus === 'active' && c.status === 'expired') out.autoExpired += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

const ORDER = 'ORDER BY release_date DESC, updated_at DESC, code ASC';

export async function listAdminCodes(db) {
  await ensureRedeemSchema(db);
  const today = todayISO();
  const { results } = await db.prepare(`SELECT * FROM redeem_codes ${ORDER}`).all();
  const codes = (results || []).map((row) => toAdminCode(row, today));
  return { codes, stats: summarize(codes, today), serverDate: today };
}

export async function publicPayload(db) {
  await ensureRedeemSchema(db);
  const today = todayISO();
  const { results } = await db.prepare(`SELECT * FROM redeem_codes ${ORDER}`).all();
  const rows = results || [];
  const codes = rows.map((row) => toPublicCode(row, today));
  const updatedAt = rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), '');
  return {
    codes,
    stats: summarize(codes, today),
    serverDate: today,
    updatedAt: updatedAt || null,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function normalizeCodeInput(input = {}, today = todayISO()) {
  const code = String(input.code ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!CODE_RE.test(code)) throw new RedeemError('Code must be 2–40 characters using letters, numbers, dashes or underscores.');

  const reward = clean(input.reward, LIMITS.reward);
  if (!reward) throw new RedeemError(`Add the reward for ${code}.`);

  const status = String(input.status ?? 'active');
  if (!STATUSES.includes(status)) throw new RedeemError('Status must be active, scheduled or expired.');

  const releaseDate = String(input.releaseDate || today);
  if (!isRealDate(releaseDate)) throw new RedeemError(`Release date for ${code} is not a valid date.`);

  const expiryDate = input.expiryDate ? String(input.expiryDate) : null;
  if (expiryDate && !isRealDate(expiryDate)) throw new RedeemError(`Expiry date for ${code} is not a valid date.`);
  if (expiryDate && expiryDate < releaseDate) throw new RedeemError(`Expiry date for ${code} cannot be before its release date.`);

  const lastVerified = String(input.lastVerified || today);
  if (!isRealDate(lastVerified)) throw new RedeemError(`Last-verified date for ${code} is not a valid date.`);

  return {
    code,
    reward,
    status,
    releaseDate,
    expiryDate,
    region: clean(input.region, LIMITS.region) || 'Global',
    lastVerified,
    notes: clean(input.notes, LIMITS.notes),
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

const UPSERT_SQL = `INSERT INTO redeem_codes
  (code,reward,status,release_date,expiry_date,region,last_verified,notes,created_at,updated_at,updated_by)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(code) DO UPDATE SET
    reward=excluded.reward, status=excluded.status, release_date=excluded.release_date,
    expiry_date=excluded.expiry_date, region=excluded.region, last_verified=excluded.last_verified,
    notes=excluded.notes, updated_at=excluded.updated_at, updated_by=excluded.updated_by`;

const upsertStatement = (db, c, actor, now) => db.prepare(UPSERT_SQL).bind(
  c.code, c.reward, c.status, c.releaseDate, c.expiryDate, c.region, c.lastVerified, c.notes, now, now, actor,
);

export async function saveCode(db, input, actor) {
  await ensureRedeemSchema(db);
  const today = todayISO();
  const code = normalizeCodeInput(input, today);
  const now = new Date().toISOString();
  const original = input.originalCode ? String(input.originalCode).trim().toUpperCase() : null;

  // Rename: the code text is the primary key, so move the record.
  if (original && original !== code.code) {
    const clash = await db.prepare('SELECT 1 AS x FROM redeem_codes WHERE code=?').bind(code.code).first();
    if (clash) throw new RedeemError(`${code.code} already exists. Edit that record instead.`, 409);
    const moved = await db.prepare(`UPDATE redeem_codes SET code=?, reward=?, status=?, release_date=?, expiry_date=?, region=?,
      last_verified=?, notes=?, updated_at=?, updated_by=? WHERE code=?`).bind(
      code.code, code.reward, code.status, code.releaseDate, code.expiryDate, code.region, code.lastVerified, code.notes, now, actor, original,
    ).run();
    if (!moved.meta?.changes) throw new RedeemError(`${original} no longer exists.`, 404);
    return { action: 'renamed', code: code.code };
  }

  const existing = await db.prepare('SELECT 1 AS x FROM redeem_codes WHERE code=?').bind(code.code).first();
  await upsertStatement(db, code, actor, now).run();
  return { action: existing ? 'updated' : 'created', code: code.code };
}

export async function bulkCreate(db, items, actor) {
  await ensureRedeemSchema(db);
  if (!Array.isArray(items) || !items.length) throw new RedeemError('Add at least one code.');
  if (items.length > LIMITS.bulk) throw new RedeemError(`Add at most ${LIMITS.bulk} codes at a time.`);

  const today = todayISO();
  const errors = [];
  const seen = new Set();
  const normalized = [];
  items.forEach((item, index) => {
    try {
      const c = normalizeCodeInput(item, today);
      if (seen.has(c.code)) throw new RedeemError(`${c.code} is listed twice.`);
      seen.add(c.code);
      normalized.push(c);
    } catch (error) {
      errors.push({ index, code: String(item?.code ?? ''), message: error.message });
    }
  });
  if (errors.length) throw new RedeemError(`${errors.length} code(s) need attention.`, 400, { errors });

  const placeholders = normalized.map(() => '?').join(',');
  const { results } = await db.prepare(`SELECT code FROM redeem_codes WHERE code IN (${placeholders})`).bind(...normalized.map((c) => c.code)).all();
  const existing = new Set((results || []).map((r) => r.code));
  const now = new Date().toISOString();
  await db.batch(normalized.map((c) => upsertStatement(db, c, actor, now)));
  return { created: normalized.length - existing.size, updated: existing.size };
}

function cleanCodeList(codes) {
  if (!Array.isArray(codes) || !codes.length) throw new RedeemError('Select at least one code.');
  if (codes.length > LIMITS.bulk) throw new RedeemError(`Select at most ${LIMITS.bulk} codes at a time.`);
  return [...new Set(codes.map((c) => String(c).trim().toUpperCase()))];
}

export async function bulkAction(db, action, codes, actor) {
  await ensureRedeemSchema(db);
  const list = cleanCodeList(codes);
  const today = todayISO();
  const now = new Date().toISOString();
  let statements;

  if (action === 'expire') {
    // Record the day it ended, unless the code has not been released yet.
    statements = list.map((code) => db.prepare(`UPDATE redeem_codes SET status='expired',
      expiry_date=CASE WHEN release_date<=?1 AND (expiry_date IS NULL OR expiry_date>?1) THEN ?1 ELSE expiry_date END,
      updated_at=?2, updated_by=?3 WHERE code=?4`).bind(today, now, actor, code));
  } else if (action === 'activate') {
    statements = list.map((code) => db.prepare(`UPDATE redeem_codes SET status='active', last_verified=?, updated_at=?, updated_by=? WHERE code=?`)
      .bind(today, now, actor, code));
  } else if (action === 'verify') {
    statements = list.map((code) => db.prepare('UPDATE redeem_codes SET last_verified=?, updated_at=?, updated_by=? WHERE code=?')
      .bind(today, now, actor, code));
  } else if (action === 'delete') {
    statements = list.map((code) => db.prepare('DELETE FROM redeem_codes WHERE code=?').bind(code));
  } else {
    throw new RedeemError('Unknown action.');
  }

  const results = await db.batch(statements);
  const changed = results.reduce((sum, r) => sum + (r.meta?.changes || 0), 0);
  return { changed };
}

export async function deleteCode(db, code) {
  await ensureRedeemSchema(db);
  const result = await db.prepare('DELETE FROM redeem_codes WHERE code=?').bind(String(code).trim().toUpperCase()).run();
  if (!result.meta?.changes) throw new RedeemError('That code no longer exists.', 404);
  return { deleted: 1 };
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

// Cells that start with = + - @ would run as formulas in Excel/Sheets.
const csvCell = (value) => {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function codesToCsv(codes) {
  const head = ['code', 'reward', 'status', 'releaseDate', 'expiryDate', 'region', 'lastVerified', 'notes'];
  return [head.join(','), ...codes.map((c) => head.map((k) => csvCell(c[k])).join(','))].join('\n');
}

/* ------------------------------------------------------------------ */
/* Page content shared by the Astro page and the Worker                */
/* ------------------------------------------------------------------ */

// FAQ copy lives in the i18n dictionaries (English is the source), so every language shares one list.
export const redeemFaq = (locale = 'en') => namespace(locale, 'redeem').faq.items;
export const REDEEM_FAQ = redeemFaq('en');

export function redeemJsonLd(codes, origin = 'https://fcmobiletools.online', dateModified, locale = 'en') {
  const active = codes.filter((c) => c.status === 'active' && !c.masked);
  const m = namespace(locale, 'redeem').meta;
  const pageUrl = `${origin}${pathForLocale('/redeem-codes/', locale)}`;
  // Link home in the same language only once a translated home page exists.
  const homeUrl = `${origin}${hasLocalizedPage('/', locale) ? pathForLocale('/', locale) : '/'}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        name: m.ldName,
        description: m.ldDescription,
        inLanguage: LOCALES[locale]?.htmlLang || 'en',
        url: pageUrl,
        ...(dateModified ? { dateModified } : {}),
        publisher: { '@type': 'Organization', name: 'FCMOBILETOOLS' },
        mainEntity: {
          '@type': 'ItemList',
          name: m.ldList,
          numberOfItems: active.length,
          itemListElement: active.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.code, description: c.reward })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'FCMOBILETOOLS', item: homeUrl },
          { '@type': 'ListItem', position: 2, name: m.ldCrumb, item: pageUrl },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: redeemFaq(locale).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };
}

// JSON that is safe to embed inside a <script> element.
// JSON embedded in script elements must not be able to close the element via untrusted text.
export const safeScriptJson = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029')
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
