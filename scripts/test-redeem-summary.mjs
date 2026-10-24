import assert from 'node:assert/strict';
import { summarizeRedeemPayload } from '../src/lib/redeem-summary.js';

const summary = summarizeRedeemPayload({
  serverDate: '2026-10-25',
  generatedAt: '2026-10-25T02:00:00.000Z',
  updatedAt: '2026-10-25T01:58:00.000Z',
  codes: [
    {
      code: 'OLD_ACTIVE',
      reward: 'Older reward',
      status: 'active',
      releaseDate: '2026-10-01',
      expiryDate: null,
      lastVerified: '2026-10-15'
    },
    {
      code: 'NEW_ACTIVE',
      reward: 'Newer reward',
      status: 'active',
      releaseDate: '2026-10-24',
      expiryDate: '2026-10-25',
      lastVerified: '2026-10-25'
    },
    {
      code: 'PAST_EXPIRY',
      reward: 'Expired by date',
      status: 'active',
      releaseDate: '2026-10-23',
      expiryDate: '2026-10-24',
      lastVerified: '2026-10-24'
    },
    {
      code: 'SCHEDULED',
      reward: 'Future reward',
      status: 'scheduled',
      releaseDate: '2026-10-26',
      expiryDate: null,
      lastVerified: '2026-10-24'
    },
    {
      code: 'ARCHIVED',
      reward: 'Archived reward',
      status: 'expired',
      releaseDate: '2026-09-30',
      expiryDate: '2026-10-10',
      lastVerified: '2026-10-20'
    }
  ]
});

assert.equal(summary.version, 1);
assert.equal(summary.total, 5);
assert.equal(summary.activeCount, 2, 'codes past their expiry date must not count as active');
assert.equal(summary.newestActive?.code, 'NEW_ACTIVE', 'newest active code must be selected by release date');
assert.deepEqual(summary.recentCodes.map((code) => code.code), [
  'SCHEDULED',
  'NEW_ACTIVE',
  'PAST_EXPIRY'
], 'recent items must be ordered by release date, not source-array order');
assert.equal(summary.lastVerified, '2026-10-25');
assert.equal(summary.generatedAt, '2026-10-25T02:00:00.000Z');

console.log('Shared redeem-code summary tests passed.');
