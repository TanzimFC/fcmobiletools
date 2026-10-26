import assert from 'node:assert/strict';
import {
  TOPIC_KEYS, TOPICS, AUTOMATIONS, normalizeTopicState, topicStateToTags, topicsToBits, bitsToTopics, isSubscriptionId,
  safeSiteUrl, safeImageUrl, validateCopy, renderTemplate, resolveAutomation, authHeaderFor, buildOneSignalPayload, formatSendAfter,
  idempotencyKey, dailyResetDue, nextRivalsReset, rivalsReminderDue, eventsStartingNow, eventsEndingSoon, codesExpiringSoon,
  expiryWhenText, whenText, promptCooldownMs, shouldShowPrompt, explainSendError, platformFromUserAgent, COMPOSE_TEMPLATES,
} from '../src/lib/pushCore.js';
import { FOOTBALL_CENTRE_CONTENT } from '../src/data/footballCentre.js';

let count = 0;
const test = (name, fn) => { fn(); count += 1; };
const ID = '0f1c2d3e-4a5b-4c6d-8e7f-a1b2c3d4e5f6';

test('topics: tags stay compatible with the original tag names', () => {
  assert.equal(TOPICS.redeem_codes.tag, 'notify_redeem_codes');
  assert.equal(TOPICS.live_events.tag, 'notify_live_events');
  assert.equal(TOPICS.giveaways.tag, 'notify_giveaways');
  assert.equal(TOPICS.site_updates.tag, 'notify_site_updates');
});
test('topics: old saved choices (tag keyed) are read, new topics use defaults', () => {
  const state = normalizeTopicState({ notify_redeem_codes: false, notify_live_events: true });
  assert.equal(state.redeem_codes, false);
  assert.equal(state.live_events, true);
  assert.equal(state.daily_reset, false);
  assert.equal(state.giveaways, true);
});
test('topics: tags and bit packing round trip', () => {
  const state = normalizeTopicState({ redeem_codes: true, daily_reset: true, giveaways: false, live_events: false });
  const tags = topicStateToTags(state);
  assert.equal(tags.notify_daily_reset, 'true');
  assert.equal(tags.notify_giveaways, 'false');
  assert.deepEqual(bitsToTopics(topicsToBits(state)), state);
  assert.equal(TOPIC_KEYS.length, Object.keys(tags).length);
});
test('validation: subscription ids, links and images', () => {
  assert.ok(isSubscriptionId(ID));
  assert.ok(!isSubscriptionId('abc'));
  assert.equal(safeSiteUrl('/events/'), 'https://fcmobiletools.online/events/');
  assert.equal(safeSiteUrl('https://www.fcmobiletools.online/blog/'), 'https://fcmobiletools.online/blog/');
  assert.throws(() => safeSiteUrl('https://evil.example/x'));
  assert.throws(() => safeSiteUrl('http://fcmobiletools.online/'));
  assert.equal(safeImageUrl(''), '');
  assert.throws(() => safeImageUrl('https://evil.example/a.png'));
  assert.ok(safeImageUrl('https://res.cloudinary.com/x/a.png'));
});
test('copy: length limits and the em dash rule', () => {
  assert.throws(() => validateCopy({ title: 'ab', message: 'long enough message' }));
  assert.throws(() => validateCopy({ title: 'Fine title', message: 'Has an em dash \u2014 here ok' }));
  assert.deepEqual(validateCopy({ title: ' Fine title ', message: 'A proper message.' }), { title: 'Fine title', message: 'A proper message.' });
});
test('templates: placeholders render and unknown ones disappear cleanly', () => {
  assert.equal(renderTemplate('{count} {codeWord} expiring {when}.', { count: 2, codeWord: 'codes', when: 'today' }), '2 codes expiring today.');
  assert.equal(renderTemplate('Hello {nope} world', {}), 'Hello world');
});
test('templates: every default automation and compose template passes validation', () => {
  const sample = { reward: '2 Vouchers', count: 3, codeWord: 'codes', when: 'tomorrow', event: 'Ballon d\u2019Or', summary: 'Starts now.', label: 'Draft B', detail: '124 CB Beckenbauer and more' };
  for (const key of Object.keys(AUTOMATIONS)) {
    const auto = resolveAutomation(key, null);
    validateCopy({ title: renderTemplate(auto.title, sample), message: renderTemplate(auto.message, sample) });
    if (auto.bulkTitle) validateCopy({ title: renderTemplate(auto.bulkTitle, sample), message: renderTemplate(auto.bulkMessage, sample) });
    assert.ok(TOPICS[auto.topic], key);
  }
  for (const tpl of COMPOSE_TEMPLATES) { assert.ok(tpl.title.length <= 65 && tpl.message.length <= 178, tpl.id); assert.ok(!/\u2014/.test(tpl.title + tpl.message)); }
});
test('automations: stored overrides merge over defaults and config is clamped', () => {
  const auto = resolveAutomation('daily_reset', { enabled: true, title: 'Reset!', config: { hoursBefore: 999 } });
  assert.equal(auto.enabled, true);
  assert.equal(auto.title, 'Reset!');
  assert.equal(auto.config.hoursBefore, 168);
  assert.equal(resolveAutomation('daily_reset', { enabled: null }).enabled, false);
  assert.equal(resolveAutomation('nope', {}), null);
});
test('onesignal: key style picks the right header scheme', () => {
  assert.equal(authHeaderFor('os_v2_app_abc'), 'Key os_v2_app_abc');
  assert.equal(authHeaderFor('NGEwMGZmMjItY2NkNy0xMWUzLTk5ZDUtMDAwYzI5NDBlNjJj'), 'Basic NGEwMGZmMjItY2NkNy0xMWUzLTk5ZDUtMDAwYzI5NDBlNjJj');
  assert.equal(authHeaderFor('abc', 'Basic'), 'Basic abc');
});
test('onesignal: payload targets by tag, segment or explicit ids', () => {
  const base = { title: 'T title', message: 'A message here', launchUrl: 'https://fcmobiletools.online/', topic: 'redeem_codes' };
  const byTag = buildOneSignalPayload('app', base);
  assert.deepEqual(byTag.filters, [{ field: 'tag', key: 'notify_redeem_codes', relation: '=', value: 'true' }]);
  assert.equal(byTag.included_segments, undefined);
  const all = buildOneSignalPayload('app', { ...base, topic: 'all' });
  assert.deepEqual(all.included_segments, ['Subscribed Users']);
  const ids = buildOneSignalPayload('app', { ...base, topic: 'all' }, { subscriptionIds: [ID] });
  assert.deepEqual(ids.include_subscription_ids, [ID]);
  assert.equal(ids.included_segments, undefined);
  assert.throws(() => buildOneSignalPayload('app', base, { subscriptionIds: ['bad'] }));
  assert.throws(() => buildOneSignalPayload('app', { ...base, topic: 'nope' }));
  const rich = buildOneSignalPayload('app', { ...base, imageUrl: 'https://res.cloudinary.com/a.png', collapseId: 'daily-reset', scheduleAt: '2026-10-27T09:30:00Z', ttlHours: 6, label: 'Name' });
  assert.equal(rich.chrome_web_image, 'https://res.cloudinary.com/a.png');
  assert.equal(rich.web_push_topic, 'daily-reset');
  assert.equal(rich.send_after, '2026-10-27 09:30:00 GMT+0000');
  assert.equal(rich.ttl, 21600);
  assert.equal(rich.name, 'Name');
});
test('onesignal: schedule format and idempotency key are stable', async () => {
  assert.equal(formatSendAfter('2026-01-02T03:04:05Z'), '2026-01-02 03:04:05 GMT+0000');
  assert.throws(() => formatSendAfter('not a date'));
});
const key1 = await idempotencyKey('daily_reset:2026-10-27:0');
assert.equal(key1, await idempotencyKey('daily_reset:2026-10-27:0'));
assert.notEqual(key1, await idempotencyKey('daily_reset:2026-10-28:0'));
assert.match(key1, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
count += 1;

test('timing: daily reset fires only in the reset hour, with an optional lead time', () => {
  const schedule = { dailyResetUtc: '01:00' };
  assert.equal(dailyResetDue(new Date('2026-10-27T01:00:05Z'), schedule, 0), true);
  assert.equal(dailyResetDue(new Date('2026-10-27T02:00:05Z'), schedule, 0), false);
  assert.equal(dailyResetDue(new Date('2026-10-27T00:00:05Z'), schedule, 1), true);
  assert.equal(dailyResetDue(new Date('2026-10-26T23:00:05Z'), schedule, 2), true);
});
test('timing: division rivals reminder fires once, in the hour that is 24h before the reset', () => {
  const rivals = { enabled: true, anchorUtc: '2026-10-01T00:00:00Z', cycleDays: 28 };
  const next = nextRivalsReset(rivals, new Date('2026-10-05T00:00:00Z'));
  assert.equal(next.toISOString(), '2026-10-29T00:00:00.000Z');
  assert.ok(rivalsReminderDue(rivals, new Date('2026-10-28T00:00:10Z'), 24));
  assert.equal(rivalsReminderDue(rivals, new Date('2026-10-28T01:00:10Z'), 24), null);
  assert.equal(rivalsReminderDue(rivals, new Date('2026-10-27T23:00:10Z'), 24), null);
  assert.equal(rivalsReminderDue({ ...rivals, enabled: false }, new Date('2026-10-28T00:00:10Z'), 24), null);
});
test('timing: events starting now and ending soon use the hour window', () => {
  const catalog = [
    { id: 'a', title: 'A', startUtc: '2026-10-27T10:00:00Z', endUtc: '2026-10-29T10:00:00Z' },
    { id: 'b', title: 'B', startUtc: '2026-10-20T10:00:00Z', endUtc: '2026-10-28T09:30:00Z' },
  ];
  assert.deepEqual(eventsStartingNow(catalog, new Date('2026-10-27T10:00:30Z')).map((e) => e.id), ['a']);
  assert.deepEqual(eventsStartingNow(catalog, new Date('2026-10-27T12:00:30Z')).map((e) => e.id), []);
  assert.deepEqual(eventsEndingSoon(catalog, new Date('2026-10-27T10:00:00Z'), 24).map((e) => e.id), ['b']);
  assert.deepEqual(eventsEndingSoon(catalog, new Date('2026-10-27T11:00:00Z'), 24).map((e) => e.id), []);
});
test('timing: the real football data produces no malformed events', () => {
  for (const event of FOOTBALL_CENTRE_CONTENT.eventsCatalog || []) {
    assert.ok(event.id && event.title, 'event needs an id and title');
    if (event.startUtc) assert.ok(!Number.isNaN(new Date(event.startUtc).getTime()), event.id);
  }
  assert.ok(nextRivalsReset(FOOTBALL_CENTRE_CONTENT.divisionRivalsReset, new Date()), 'rivals anchor');
});
test('codes: expiring window uses the end of the expiry day and ignores open ended codes', () => {
  const now = new Date('2026-10-27T00:00:10Z');
  const codes = [
    { code: 'A', status: 'active', expiryDate: '2026-10-27' },
    { code: 'B', status: 'active', expiryDate: '2026-10-29' },
    { code: 'C', status: 'active', expiryDate: '' },
    { code: 'D', status: 'expired', expiryDate: '2026-10-27' },
  ];
  assert.deepEqual(codesExpiringSoon(codes, now, 24).map((c) => c.code), ['A']);
  assert.deepEqual(codesExpiringSoon(codes, now, 72).map((c) => c.code), ['A', 'B']);
  assert.equal(expiryWhenText('2026-10-27', now), 'today');
  assert.equal(expiryWhenText('2026-10-28', now), 'tomorrow');
  assert.equal(expiryWhenText('2026-10-31', now), 'on Oct 31');
  assert.equal(whenText('2026-10-28T00:00:00Z', now), 'tomorrow');
  assert.equal(whenText('2026-10-27T05:00:00Z', now), 'in 5 hours');
  assert.equal(whenText('2026-10-27T01:00:00Z', now), 'in 1 hour');
});
test('prompt: cooldowns grow and "no thanks" is permanent', () => {
  assert.equal(promptCooldownMs(0), 0);
  assert.ok(promptCooldownMs(2) > promptCooldownMs(1));
  const now = Date.now();
  const base = { state: 'available', pageViews: 3, now };
  assert.equal(shouldShowPrompt({ ...base, dismissals: 0, lastDismissedAt: 0 }), true);
  assert.equal(shouldShowPrompt({ ...base, dismissals: 1, lastDismissedAt: now - 1000 }), false);
  assert.equal(shouldShowPrompt({ ...base, dismissals: 1, lastDismissedAt: now - 4 * 86400000 }), true);
  assert.equal(shouldShowPrompt({ ...base, optedOutForever: true }), false);
  assert.equal(shouldShowPrompt({ ...base, state: 'enabled' }), false);
  assert.equal(shouldShowPrompt({ ...base, state: 'denied' }), false);
  assert.equal(shouldShowPrompt({ ...base, pageViews: 1, minPageViews: 2 }), false);
});
test('errors and platforms: friendly text', () => {
  assert.match(explainSendError(401), /REST API Key/);
  assert.match(explainSendError(0, 'not configured'), /ONESIGNAL_REST_API_KEY/);
  assert.match(explainSendError(200, 'All included players are not subscribed'), /Nobody in this audience/);
  assert.equal(platformFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios');
  assert.equal(platformFromUserAgent('Mozilla/5.0 (Linux; Android 14)'), 'android');
  assert.equal(platformFromUserAgent('Mozilla/5.0 (Windows NT 10.0)'), 'windows');
});

console.log(`Push checks passed: ${count} groups.`);
