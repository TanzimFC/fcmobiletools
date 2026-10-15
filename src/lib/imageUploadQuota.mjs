const BURST_WINDOW_MS = 10 * 60 * 1000;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const BURST_LIMIT = 10;
const DAILY_LIMIT = 50;

const schemaByDatabase = new WeakMap();

export async function ensureImageUploadQuotaSchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('The D1 database binding is unavailable.');
  }

  let ready = schemaByDatabase.get(db);
  if (!ready) {
    ready = (async () => {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS fcm_image_upload_rate_limits (
          account_id TEXT NOT NULL,
          window_name TEXT NOT NULL CHECK (window_name IN ('burst', 'daily')),
          bucket INTEGER NOT NULL,
          upload_count INTEGER NOT NULL CHECK (upload_count >= 1),
          expires_at_ms INTEGER NOT NULL,
          PRIMARY KEY (account_id, window_name, bucket)
        ) WITHOUT ROWID
      `).run();

      await db.prepare(`
        CREATE INDEX IF NOT EXISTS fcm_image_upload_rate_limits_expiry_idx
        ON fcm_image_upload_rate_limits (expires_at_ms)
      `).run();
    })().catch((error) => {
      schemaByDatabase.delete(db);
      throw error;
    });
    schemaByDatabase.set(db, ready);
  }

  await ready;
}

export async function reserveImageUploadQuota(db, accountId, nowMs = Date.now()) {
  const owner = String(accountId || '').trim();
  const timestamp = Number(nowMs);
  if (!owner) throw new Error('An account id is required for upload quota checks.');
  if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('A valid timestamp is required.');

  await ensureImageUploadQuotaSchema(db);

  const burstBucket = Math.floor(timestamp / BURST_WINDOW_MS);
  const dailyBucket = Math.floor(timestamp / DAILY_WINDOW_MS);
  const burstExpiresAt = (burstBucket + 1) * BURST_WINDOW_MS;
  const dailyExpiresAt = (dailyBucket + 1) * DAILY_WINDOW_MS;

  // One SQLite statement checks both limits and reserves both counters together.
  // D1 serializes writes, so parallel Workers cannot read the same old count and
  // then both claim the final slot. If either limit is reached, no row is changed.
  const statement = `
    WITH usage AS (
      SELECT
        COALESCE((
          SELECT upload_count FROM fcm_image_upload_rate_limits
          WHERE account_id = ? AND window_name = 'burst' AND bucket = ?
        ), 0) AS burst_count,
        COALESCE((
          SELECT upload_count FROM fcm_image_upload_rate_limits
          WHERE account_id = ? AND window_name = 'daily' AND bucket = ?
        ), 0) AS daily_count
    ),
    reserve_rows(window_name, bucket, expires_at_ms) AS (
      SELECT 'burst', ?, ? FROM usage
      WHERE burst_count < ${BURST_LIMIT} AND daily_count < ${DAILY_LIMIT}
      UNION ALL
      SELECT 'daily', ?, ? FROM usage
      WHERE burst_count < ${BURST_LIMIT} AND daily_count < ${DAILY_LIMIT}
    )
    INSERT INTO fcm_image_upload_rate_limits
      (account_id, window_name, bucket, upload_count, expires_at_ms)
    SELECT ?, window_name, bucket, 1, expires_at_ms
    FROM reserve_rows
    WHERE 1
    ON CONFLICT (account_id, window_name, bucket)
    DO UPDATE SET
      upload_count = fcm_image_upload_rate_limits.upload_count + 1,
      expires_at_ms = excluded.expires_at_ms
    RETURNING window_name, upload_count
  `;

  const result = await db.prepare(statement).bind(
    owner, burstBucket,
    owner, dailyBucket,
    burstBucket, burstExpiresAt,
    dailyBucket, dailyExpiresAt,
    owner
  ).all();

  return Array.isArray(result?.results) && result.results.length === 2;
}

export async function pruneExpiredImageUploadQuotas(db, nowMs = Date.now()) {
  await ensureImageUploadQuotaSchema(db);
  const result = await db.prepare(
    'DELETE FROM fcm_image_upload_rate_limits WHERE expires_at_ms <= ?'
  ).bind(Number(nowMs)).run();
  return Number(result?.meta?.changes || 0);
}
