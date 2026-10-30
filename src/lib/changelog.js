// Reads CHANGELOG.md (the file at the repo root) and turns it into structured releases for the
// /changelog page and the About page. CHANGELOG.md stays the one place to write updates.
//
// Format it understands:
//
//   ## 27–29 October 2026          a release: "11 September 2026", "27–29 October 2026"
//                                  or "28 September – 2 October 2026"
//   One plain sentence here.       optional summary, shown as the release headline
//   ### 🚀 New                     a group: New, Improvements or Fixes (emoji is optional)
//   - **Title:** What changed.     an item with a title
//   - Plain sentence.              an item without a title (handy for fixes)
//
// Anything it cannot read is skipped and reported in `errors`, so a typo never breaks the site
// build. `npm run test:changelog` fails on those errors so they get fixed before release.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1));

export const KINDS = [
  { id: 'new', label: 'New', plural: 'New' },
  { id: 'improved', label: 'Improvements', plural: 'Improvements' },
  { id: 'fixed', label: 'Fixes', plural: 'Fixes' }
];

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// "27", "27 October", "27 October 2026" -> { day, month?, year? }
function parseDatePart(text) {
  const m = String(text).trim().match(/^(\d{1,2})(?:\s+([A-Za-z]+))?(?:\s+(\d{4}))?$/);
  if (!m) return null;
  const month = m[2] ? MONTHS.indexOf(m[2].toLowerCase()) + 1 : 0;
  if (m[2] && !month) return null;
  return { day: Number(m[1]), month: month || null, year: m[3] ? Number(m[3]) : null };
}

/** "27–29 October 2026" -> { start: '2026-10-27', end: '2026-10-29' } or null. */
export function parseDateHeading(text) {
  const parts = String(text).split(/\s*[–-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return null;
  const right = parseDatePart(parts[parts.length - 1]);
  if (!right || !right.month || !right.year) return null;
  let left = right;
  if (parts.length === 2) {
    const l = parseDatePart(parts[0]);
    if (!l) return null;
    left = { day: l.day, month: l.month || right.month, year: l.year || right.year };
  }
  const start = iso(left.year, left.month, left.day);
  const end = iso(right.year, right.month, right.day);
  // Reject impossible dates such as 31 September.
  for (const value of [start, end]) {
    const d = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  }
  if (start > end) return null;
  return { start, end };
}

const splitIso = (value) => value.split('-').map(Number);

/** "2026-10-27","2026-10-29" -> "27–29 Oct"; same day -> "11 Sep"; across months -> "28 Sep – 2 Oct". */
export function formatRange(start, end) {
  const [, sm, sd] = splitIso(start);
  const [, em, ed] = splitIso(end);
  if (start === end) return `${sd} ${MONTH_SHORT[sm - 1]}`;
  if (sm === em) return `${sd}–${ed} ${MONTH_SHORT[em - 1]}`;
  return `${sd} ${MONTH_SHORT[sm - 1]} – ${ed} ${MONTH_SHORT[em - 1]}`;
}

/** "2026-10-29" -> "29 October 2026". */
export function formatLongDate(value) {
  const [y, m, d] = splitIso(value);
  return `${d} ${MONTH_LONG[m - 1]} ${y}`;
}

/** "2026-10" -> "October 2026". */
export function formatMonth(key) {
  const [y, m] = splitIso(key + '-01');
  return `${MONTH_LONG[m - 1]} ${y}`;
}

const stripLeadingSymbols = (text) => String(text).replace(/^[^\p{L}\p{N}]+/u, '').trim();

function kindFor(heading) {
  const text = stripLeadingSymbols(heading).toLowerCase();
  if (text.startsWith('new') || text.startsWith('added')) return 'new';
  if (text.startsWith('improve') || text.startsWith('chang') || text.startsWith('updated')) return 'improved';
  if (text.startsWith('fix')) return 'fixed';
  return null;
}

function parseItem(raw) {
  const text = raw.replace(/\s+/g, ' ').trim();
  const m = text.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/);
  if (!m) return { title: '', text };
  return { title: m[1].replace(/:\s*$/, '').trim(), text: m[2].trim() };
}

/** Parses the raw text of CHANGELOG.md. Always returns { title, intro, note, releases, errors }. */
export function parseChangelog(raw) {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n');
  const result = { title: '', intro: '', note: '', releases: [], errors: [] };
  let release = null;
  let group = null;
  let item = null;
  let afterRule = false;
  let skipRelease = false;
  const introLines = [];
  const noteLines = [];
  const summaryLines = [];

  const finishSummary = () => {
    if (release && summaryLines.length) release.summary = summaryLines.join(' ').replace(/\s+/g, ' ').trim();
    summaryLines.length = 0;
  };

  for (const line of lines) {
    if (/^# /.test(line)) { result.title = line.slice(2).trim(); continue; }

    if (/^## /.test(line)) {
      finishSummary();
      item = null; group = null; afterRule = false;
      const heading = line.slice(3).trim();
      const dates = parseDateHeading(heading);
      if (!dates) {
        result.errors.push(`Could not read the date in the heading "${heading}". Use "11 September 2026", "27–29 October 2026" or "28 September – 2 October 2026".`);
        release = null; skipRelease = true;
        continue;
      }
      skipRelease = false;
      release = { id: dates.start, heading, start: dates.start, end: dates.end, month: dates.end.slice(0, 7), summary: '', groups: [], itemCount: 0 };
      result.releases.push(release);
      continue;
    }

    if (/^---+\s*$/.test(line)) { finishSummary(); afterRule = true; release = null; group = null; item = null; skipRelease = false; continue; }

    if (/^### /.test(line)) {
      if (!release) continue;
      finishSummary();
      item = null;
      const heading = line.slice(4).trim();
      const kind = kindFor(heading);
      if (!kind) { result.errors.push(`Release ${release.heading}: unknown group "${heading}". Use New, Improvements or Fixes.`); group = null; continue; }
      group = release.groups.find((g) => g.kind === kind) || null;
      if (!group) { group = { kind, items: [] }; release.groups.push(group); }
      continue;
    }

    if (/^- /.test(line)) {
      if (!release || !group) { if (release) result.errors.push(`Release ${release.heading}: a bullet appears before any group heading.`); continue; }
      item = parseItem(line.slice(2));
      group.items.push(item);
      release.itemCount += 1;
      continue;
    }

    if (/^\s{2,}\S/.test(line) && item) { // wrapped continuation of the previous bullet
      const extra = line.trim();
      item.text = (item.text + ' ' + extra).trim();
      continue;
    }

    if (!line.trim()) continue;

    if (afterRule) noteLines.push(line.trim());
    else if (!release && !skipRelease) introLines.push(line.trim());
    else if (release && !group) summaryLines.push(line.trim());
  }
  finishSummary();

  result.intro = introLines.join(' ');
  result.note = noteLines.join(' ');
  // Keep the groups in a steady order: New, Improvements, Fixes.
  const order = KINDS.map((k) => k.id);
  for (const r of result.releases) r.groups.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  result.releases.sort((a, b) => (a.end === b.end ? b.start.localeCompare(a.start) : b.end.localeCompare(a.end)));
  return result;
}

/** Groups releases (already newest first) by calendar month of their end date. */
export function groupByMonth(releases) {
  const months = [];
  for (const r of releases) {
    let bucket = months[months.length - 1];
    if (!bucket || bucket.key !== r.month) { bucket = { key: r.month, label: formatMonth(r.month), releases: [] }; months.push(bucket); }
    bucket.releases.push(r);
  }
  return months;
}

/** Counts items per kind across all releases, for the filter chips. */
export function countByKind(releases) {
  const counts = { new: 0, improved: 0, fixed: 0 };
  for (const r of releases) for (const g of r.groups) counts[g.kind] += g.items.length;
  return counts;
}
