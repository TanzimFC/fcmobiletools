import assert from 'node:assert/strict';
import {
  reserveImageUploadQuota,
  pruneExpiredImageUploadQuotas
} from '../src/lib/imageUploadQuota.mjs';

const BURST_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function makeMockD1() {
  const rows = new Map();
  const statements = [];
  const key = (account, window, bucket) => [account, window, bucket].join('|');

  async function runStatement(sql, args = []) {
    statements.push({ kind: 'run', sql, args });
    if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
      return { success: true, meta: { changes: 0 } };
    }
    if (sql.startsWith('DELETE FROM fcm_image_upload_rate_limits')) {
      let changes = 0;
      for (const [rowKey, value] of rows) {
        if (value.expires_at_ms <= args[0]) {
          rows.delete(rowKey);
          changes += 1;
        }
      }
      return { success: true, meta: { changes } };
    }
    throw new Error('Unexpected D1 run statement');
  }

  async function allStatement(sql, args) {
    statements.push({ kind: 'all', sql, args });
    assert.match(sql, /WITH usage AS/);
    assert.match(sql, /ON CONFLICT \(account_id, window_name, bucket\)/);
    assert.match(sql, /RETURNING window_name, upload_count/);
    const [burstAccount, burstBucket, dailyAccount, dailyBucket, nextBurstBucket, burstExpiry, nextDailyBucket, dailyExpiry, account] = args;
    assert.equal(burstAccount, dailyAccount);
    assert.equal(burstAccount, account);
    const burstKey = key(account, 'burst', burstBucket);
    const dailyKey = key(account, 'daily', dailyBucket);
    const burstCount = rows.get(burstKey)?.upload_count || 0;
    const dailyCount = rows.get(dailyKey)?.upload_count || 0;
    if (burstCount >= 10 || dailyCount >= 50) return { results: [] };

    rows.set(burstKey, { upload_count: burstCount + 1, expires_at_ms: burstExpiry });
    rows.set(dailyKey, { upload_count: dailyCount + 1, expires_at_ms: dailyExpiry });
    assert.equal(nextBurstBucket, burstBucket);
    assert.equal(nextDailyBucket, dailyBucket);
    return {
      results: [
        { window_name: 'burst', upload_count: burstCount + 1 },
        { window_name: 'daily', upload_count: dailyCount + 1 }
      ]
    };
  }

  return {
    rows,
    statements,
    prepare(sql) {
      // D1 permits parameter-free statements to be executed directly with
      // preparedStatement.run(). Bound statements use bind(...).run()/all().
      return {
        run: () => runStatement(sql),
        bind(...args) {
          return {
            run: () => runStatement(sql, args),
            all: () => allStatement(sql, args)
          };
        }
      };
    }
  };
}

const start = 1_000_000;
const burstDb = makeMockD1();
const simultaneous = await Promise.all(Array.from({ length: 30 }, () =>
  reserveImageUploadQuota(burstDb, 'account-a', start + 1000)
));
assert.equal(simultaneous.filter(Boolean).length, 10, 'only 10 simultaneous requests should reserve a burst slot');
assert.equal(burstDb.rows.get(['account-a', 'burst', Math.floor((start + 1000) / BURST_MS)].join('|')).upload_count, 10);
assert.equal(burstDb.rows.get(['account-a', 'daily', Math.floor((start + 1000) / DAY_MS)].join('|')).upload_count, 10);

const dailyDb = makeMockD1();
let allowed = 0;
for (let i = 0; i < 60; i += 1) {
  const now = start + i * BURST_MS + 1000;
  if (await reserveImageUploadQuota(dailyDb, 'account-b', now)) allowed += 1;
}
assert.equal(allowed, 50, 'the daily limit should stop uploads after 50 reservations');
assert.equal(dailyDb.rows.get(['account-b', 'daily', Math.floor(start / DAY_MS)].join('|')).upload_count, 50);

const blockedDb = makeMockD1();
for (let i = 0; i < 10; i += 1) assert.equal(await reserveImageUploadQuota(blockedDb, 'account-c', start + 1000), true);
assert.equal(await reserveImageUploadQuota(blockedDb, 'account-c', start + 1000), false);
const burstKey = ['account-c', 'burst', Math.floor((start + 1000) / BURST_MS)].join('|');
const dailyKey = ['account-c', 'daily', Math.floor((start + 1000) / DAY_MS)].join('|');
assert.equal(blockedDb.rows.get(burstKey).upload_count, 10, 'a blocked reservation must not increment burst usage');
assert.equal(blockedDb.rows.get(dailyKey).upload_count, 10, 'a blocked reservation must not increment daily usage');

const removed = await pruneExpiredImageUploadQuotas(blockedDb, start + DAY_MS);
assert.equal(removed, 2, 'expired burst and daily rows should be cleaned up');
assert.equal(blockedDb.rows.size, 0);
assert.equal(blockedDb.statements.filter((entry) => entry.kind === 'all').every((entry) => entry.sql.includes('RETURNING')), true);

console.log('Upload quota checks passed: atomic dual-window reservation shape, burst limit, daily limit and expiry cleanup.');
