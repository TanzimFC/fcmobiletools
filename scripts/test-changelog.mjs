import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseChangelog, parseDateHeading, formatRange, formatLongDate, groupByMonth, countByKind } from '../src/lib/changelog.js';

// Date headings the website understands.
assert.deepEqual(parseDateHeading('11 September 2026'), { start: '2026-09-11', end: '2026-09-11' });
assert.deepEqual(parseDateHeading('27–29 October 2026'), { start: '2026-10-27', end: '2026-10-29' });
assert.deepEqual(parseDateHeading('28 September – 2 October 2026'), { start: '2026-09-28', end: '2026-10-02' });
assert.equal(parseDateHeading('31 September 2026'), null, 'impossible dates are rejected');
assert.equal(parseDateHeading('Soon'), null);
assert.equal(formatRange('2026-10-27', '2026-10-29'), '27–29 Oct');
assert.equal(formatRange('2026-09-11', '2026-09-11'), '11 Sep');
assert.equal(formatRange('2026-09-28', '2026-10-02'), '28 Sep – 2 Oct');
assert.equal(formatLongDate('2026-10-29'), '29 October 2026');

// A small sample covers titles, untitled items, summaries and a bad heading.
const sample = parseChangelog(`# Log

Intro line.

## 2–3 March 2027

A short summary.

### 🐛 Fixes
- Fixed a thing.

### 🚀 New
- **Big tool:** Does a thing
  across two lines.

## Someday

### 🚀 New
- **Ignored:** never shown

---

Closing note.
`);
assert.equal(sample.intro, 'Intro line.');
assert.equal(sample.note, 'Closing note.');
assert.equal(sample.releases.length, 1);
assert.equal(sample.errors.length, 1, 'the unreadable heading is reported, not silently dropped');
assert.equal(sample.releases[0].summary, 'A short summary.');
assert.deepEqual(sample.releases[0].groups.map((g) => g.kind), ['new', 'fixed'], 'groups are ordered New, Improvements, Fixes');
assert.deepEqual(sample.releases[0].groups[0].items[0], { title: 'Big tool', text: 'Does a thing across two lines.' });
assert.deepEqual(sample.releases[0].groups[1].items[0], { title: '', text: 'Fixed a thing.' });

// The real CHANGELOG.md must be readable, newest first, and have no gaps in its structure.
const file = fs.readFileSync(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8');
const log = parseChangelog(file);
assert.deepEqual(log.errors, [], 'CHANGELOG.md has problems:\n' + log.errors.join('\n'));
assert.ok(log.releases.length > 0, 'CHANGELOG.md has no releases');
assert.ok(log.intro, 'CHANGELOG.md needs an intro sentence under the title');
const ids = new Set();
for (let i = 0; i < log.releases.length; i += 1) {
  const r = log.releases[i];
  assert.ok(!ids.has(r.id), `two releases start on ${r.id}`);
  ids.add(r.id);
  assert.ok(r.itemCount > 0, `release "${r.heading}" has no items`);
  assert.ok(r.summary, `release "${r.heading}" needs a one-line summary under its heading`);
  if (i > 0) assert.ok(log.releases[i - 1].end >= r.end, `release "${r.heading}" is out of order (newest first)`);
  for (const g of r.groups) for (const item of g.items) assert.ok(item.text || item.title, `release "${r.heading}" has an empty item`);
}
assert.ok(!file.includes('\u2014'), 'CHANGELOG.md should not contain em dashes');
const counts = countByKind(log.releases);
assert.equal(counts.new + counts.improved + counts.fixed, log.releases.reduce((n, r) => n + r.itemCount, 0));
assert.ok(groupByMonth(log.releases).length >= 1);
console.log(`Changelog OK: ${log.releases.length} releases, ${counts.new} new, ${counts.improved} improved, ${counts.fixed} fixed.`);
