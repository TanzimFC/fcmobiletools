import {
  $, $$, api, esc, money, emblem, toast, busy, copyText, countdown, countUp, confetti, stagger, store, signedIn, signInUrl,
  fmtDate, short, reduced, cardHtml, winnersHtml, STATUS_LABEL, ENTRY_LABEL, spotlight, scramble, calendarUrl, downloadIcs
} from './giveaway-ui.js';
import { sha256Hex, entriesHash, rankEntries } from '../lib/giveawayDraw.js';

const IC = {
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>'
};
const when = (iso) => fmtDate(iso);
// The server's overall `passed` also needs the Discord name and screenshots, which do not exist yet
// before someone enters. For "can I start?" only the automatic requirements matter.
const autoOk = (reqs, eligibility) => reqs.filter((r) => r.input === 'auto').every((r) => !r.required || eligibility.results.find((x) => x.id === r.id)?.ok);
const unavailable = (host, msg) => { host.innerHTML = '<div class="gw-empty"><strong>Giveaways are warming up</strong>' + esc(msg || 'We could not load this right now. Please try again in a moment.') + '</div>'; };

// ═══════════════════════════ HUB ═══════════════════════════
export async function initHub() {
  const grid = $('#gwGrid');
  grid.innerHTML = '<div class="gw-skel"></div><div class="gw-skel"></div>';
  let data, wall = { winners: [], totalPaidCents: 0 };
  try { [data, wall] = await Promise.all([api('/api/giveaways/public', { cache: 'default' }), api('/api/giveaways/winners', { cache: 'default' }).catch(() => wall)]); }
  catch (e) { return unavailable(grid, e.message); }
  const list = data.giveaways || [];
  const featured = list.find((g) => g.slug === 'ballon-dor-star-pass-giveaway');
  const featuredArt = $('#gwFeaturedArt');
  const featuredCover = $('#gwFeatureCover');
  if (featured?.coverUrl && featuredArt && featuredCover) {
    featuredCover.addEventListener('load', () => {
      featuredCover.hidden = false;
      featuredArt.classList.add('has-cover');
    }, { once: true });
    featuredCover.addEventListener('error', () => {
      featuredCover.hidden = true;
      featuredArt.classList.remove('has-cover');
    }, { once: true });
    featuredCover.src = featured.coverUrl;
  }
  const live = list.filter((g) => g.status === 'live' || g.status === 'upcoming');
  const past = list.filter((g) => !live.includes(g));
  const shown = [...live, ...past];
  const paintGrid = (kind) => {
    const pick = kind === 'live' ? shown.filter((g) => g.status === 'live') : kind === 'upcoming' ? shown.filter((g) => g.status === 'upcoming') : kind === 'past' ? past : shown;
    grid.innerHTML = pick.length ? pick.map((g, i) => cardHtml(g, i)).join('') : '<div class="gw-empty" style="grid-column:1/-1"><strong>' + (shown.length ? 'Nothing in this view' : 'No giveaways right now') + '</strong>' + (shown.length ? 'Try another filter.' : 'The next one is coming soon. Join our Discord so you do not miss it.') + '</div>';
  };
  paintGrid('all');
  const chips = $('#gwFilters');
  if (chips && shown.length > 1) {
    const counts = { all: shown.length, live: shown.filter((g) => g.status === 'live').length, upcoming: shown.filter((g) => g.status === 'upcoming').length, past: past.length };
    chips.hidden = false;
    chips.innerHTML = [['all', 'All'], ['live', 'Live now'], ['upcoming', 'Opening soon'], ['past', 'Past draws']].filter(([k]) => k === 'all' || counts[k]).map(([k, l], i) => '<button type="button" role="tab" aria-selected="' + (i === 0) + '" data-f="' + k + '">' + l + '<b>' + counts[k] + '</b></button>').join('');
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      $$('[data-f]', chips).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      paintGrid(b.dataset.f);
    });
  }
  const lastDraw = list.find((g) => g.results?.winners?.length);
  const theatre = $('#gwLastDraw');
  if (theatre && lastDraw) {
    theatre.hidden = false;
    theatre.innerHTML = '<span class="gw-ld-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5v14l11-7z"/></svg></span><div><strong>Watch the last draw</strong><span>' + esc(lastDraw.title) + ' · ' + lastDraw.results.winners.length + (lastDraw.results.winners.length === 1 ? ' winner' : ' winners') + ' · verified in your browser</span></div><a class="gw-btn gw-btn-gold gw-btn-sm" href="/giveaways/' + esc(lastDraw.slug) + '/draw/">Watch the draw</a>';
  }
  spotlight();
  const entries = list.reduce((n, g) => n + g.stats.entries, 0);
  const rewardsAvailable = live.filter((g) => g.status === 'live').reduce((n, g) => n + g.winners.total, 0);
  countUp($('#gwStatLive'), live.filter((g) => g.status === 'live').length);
  countUp($('#gwStatEntries'), entries);
  countUp($('#gwStatPool'), rewardsAvailable);
  countUp($('#gwStatPaid'), wall.totalDelivered || wall.winners?.length || 0);
  const w = $('#gwWall');
  if (w) {
    if (wall.winners?.length) { w.innerHTML = winnersHtml(wall.winners.map((x) => ({ ...x, status: 'paid', giveaway: x.giveaway }))); }
    else w.innerHTML = '<div class="gw-empty"><strong>Be our first winner</strong>Winners appear here with a masked name once reward delivery is confirmed.</div>';
  }
  fillOfficial(data.official);
  if (await signedIn()) myBanner();
}

async function myBanner() {
  try {
    const mine = await api('/api/giveaways/mine');
    const host = $('#gwBanner'); if (!host) return;
    const prize = mine.prizes.find((p) => ['awaiting_claim', 'code_verified'].includes(p.status));
    const fix = mine.entries.find((e) => e.status === 'needs_proof');
    if (prize) host.innerHTML = '<div class="gw-banner"><span style="font-size:26px">🏆</span><div><strong>You won ' + esc(prize.prize) + ' in the ' + esc(prize.giveaway?.title || 'giveaway') + '!</strong><div class="gw-note">Open your claim page to get your secret claim code.</div></div><a class="gw-btn gw-btn-gold" style="margin-left:auto" href="/giveaways/claim/">Claim my prize</a></div>';
    else if (fix) host.innerHTML = '<div class="gw-banner"><span style="font-size:26px">📸</span><div><strong>Action needed on your entry</strong><div class="gw-note">' + esc(fix.review_reason || 'Please upload a corrected screenshot.') + '</div></div><a class="gw-btn gw-btn-gold" style="margin-left:auto" href="/giveaways/' + esc(fix.giveaway?.slug) + '/enter/">Fix my entry</a></div>';
    else if (mine.ban) host.innerHTML = '<div class="gw-banner" style="border-color:rgba(255,143,134,.5)"><span style="font-size:26px">⏸</span><div><strong>Your giveaway entries are paused' + (mine.ban.permanent ? '' : ' until ' + esc(when(mine.ban.endsAt))) + '</strong><div class="gw-note">' + esc(mine.ban.reason) + '</div></div></div>';
  } catch { /* banner is optional */ }
}

function fillOfficial(o) {
  if (!o) return;
  $$('[data-gw-discord]').forEach((a) => { if (o.discordInvite) { a.href = o.discordInvite; a.hidden = false; } });
  $$('[data-gw-handles]').forEach((el) => {
    const bits = [];
    if (o.discordHandle) bits.push('Discord: <strong>' + esc(o.discordHandle) + '</strong>');
    if (o.instagramHandle) bits.push('Instagram: <strong>@' + esc(o.instagramHandle) + '</strong>');
    el.innerHTML = bits.length ? bits.join(' &nbsp;·&nbsp; ') : 'Official handles will be listed here before the first draw.';
  });
}

// ═══════════════════════════ DETAIL ═══════════════════════════
export async function initDetail() {
  if (!$('#gwDyn')) return; // giveaway not found: the server already rendered the message
  const root = $('.gw-root'); const slug = root.dataset.slug;
  const ref = (new URLSearchParams(location.search).get('ref') || '').toLowerCase().slice(0, 24);
  if (/^[a-z0-9._-]{3,24}$/.test(ref)) store.set('gw:ref', ref);
  let g;
  try { g = await api('/api/giveaways/' + encodeURIComponent(slug), { cache: 'default' }); }
  catch (e) { return unavailable($('#gwDyn'), e.status === 404 ? 'This giveaway is not available.' : e.message); }
  if (!store.session('gw:view:' + slug)) { store.session('gw:view:' + slug, '1'); fetch('/api/giveaways/' + slug + '/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'view' }) }).catch(() => {}); }
  paintPublic(g);
  fillOfficial(g.official);
  if (await signedIn()) {
    try { paintMe(g, await api('/api/giveaways/' + encodeURIComponent(slug) + '/me')); } catch { /* signed-out view still works */ }
  } else {
    $('#gwMe').innerHTML = '<div class="gw-callout cyan"><div><strong>Sign in to take part.</strong> Browsing is open to everyone. You need a free account to enter, so we can check your profile, survey and quest and keep prizes safe.</div></div>';
  }
}

function paintPublic(g) {
  const live = g.status === 'live';
  $('#gwStatus').textContent = STATUS_LABEL[g.status] || g.status;
  $('#gwStatus').className = 'gw-pill ' + (live ? 'live' : '');
  countUp($('#gwEntries'), g.stats.entries);
  $('#gwWinnersN').textContent = g.winners.total + (g.winners.total === 1 ? ' winner' : ' winners');
  const cd = $('#gwCount');
  if (live || g.status === 'upcoming') countdown(cd, live ? g.endsAt : g.startsAt, () => location.reload());
  else cd.innerHTML = '<div style="min-width:0;padding:12px 18px"><strong style="font-size:18px">' + esc(STATUS_LABEL[g.status]) + '</strong></div>';
  const href = '/giveaways/' + g.slug + '/enter/';
  const ctaHtml = live ? '<a class="gw-btn gw-btn-gold gw-btn-lg" href="' + href + '">Enter this giveaway</a>' : '';
  const drawn = g.status === 'drawn' || g.status === 'completed';
  const calAt = live ? g.endsAt : g.status === 'upcoming' ? g.startsAt : '';
  $('#gwCta').innerHTML = ctaHtml + (drawn ? '<a class="gw-btn gw-btn-gold gw-btn-lg" href="/giveaways/' + esc(g.slug) + '/draw/">Watch the draw</a>' : '') + '<a class="gw-btn gw-btn-lg" href="#gwFair">How the draw works</a>' +
    (calAt && Date.parse(calAt) > Date.now() ? '<button class="gw-btn gw-btn-lg gw-btn-cal" type="button" id="gwCal" aria-haspopup="true">Add to calendar</button>' : '');
  $('#gwCal')?.addEventListener('click', () => {
    const ev = { title: g.title + (live ? ': entries close' : ': entries open'), start: calAt, details: 'Free FC Mobile giveaway on FCMobiletools. ' + g.prize.display + ' up for grabs.', url: location.origin + '/giveaways/' + g.slug + '/' };
    downloadIcs(ev); toast('Calendar file downloaded. Google Calendar link opens in a new tab.'); window.open(calendarUrl(ev), '_blank', 'noopener');
  });
  spotlight();
  const sticky = $('#gwSticky'); if (sticky) sticky.innerHTML = live ? '<a class="gw-btn gw-btn-gold" href="' + href + '">Enter this giveaway</a>' : '';

  $('#gwReqs').innerHTML = g.requirements.map((r) => '<li class="gw-req" data-req="' + esc(r.id) + '"><span class="ic">' + (g.requirements.indexOf(r) + 1) + '</span><div><h4>' + esc(r.label) + '</h4><p>' + esc(r.help) + '</p>' +
    (r.link ? '<a href="' + esc(r.link) + '"' + (r.link.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : '') + '>Open</a>' : '') + '</div><span class="st"></span></li>').join('');

  // milestone track
  const ms = g.milestones.list;
  if (ms.length) {
    const max = ms[ms.length - 1].entries;
    const p = Math.min(100, (g.stats.entries / max) * 100);
    $('#gwTrack').innerHTML = '<div class="gw-track" style="--p:' + p + '%"><div class="rail"><i></i></div>' + ms.map((m) => {
      const left = Math.min(94, Math.max(6, (m.entries / max) * 100));
      return '<div class="gw-ms ' + (m.unlocked ? 'on' : '') + '" style="left:' + left + '%"><span>' + (m.unlocked ? '✓' : '★') + '</span><small><b>' + m.entries.toLocaleString() + ' entries</b>' + esc(m.label) + '</small></div>';
    }).join('') + '</div><div style="height:56px"></div>';
    $('#gwTrackNote').textContent = g.milestones.next ? (g.milestones.next.entries - g.stats.entries).toLocaleString() + ' more entries unlock: ' + g.milestones.next.label + '. Share the giveaway to get there faster.' : 'Every milestone is unlocked. Extra winners are in the draw.';
  } else $('#gwTrackWrap').hidden = true;

  // Fairness panel reflects the actual source of the published winner.
  if (g.livestreamResult) {
    const fair = $('#gwFair');
    const eyebrow = fair?.querySelector('.gw-eyebrow');
    const heading = fair?.querySelector('h3');
    const copy = fair?.querySelector('p');
    if (eyebrow) eyebrow.textContent = 'LIVESTREAM WHEEL RESULT';
    if (heading) heading.textContent = 'How the winner was selected';
    if (copy) copy.textContent = 'The participant wheel was spun during the livestream. This page records that result; the website’s seeded ranking is not presented as verification of the livestream spin.';
    const commit = $('#gwCommit');
    if (commit) {
      commit.hidden = true;
      if (commit.previousElementSibling) commit.previousElementSibling.hidden = true;
    }
    const hashRow = $('#gwHashRow');
    if (hashRow) hashRow.hidden = true;
    $('#gwVerify')?.remove();
  } else {
    $('#gwCommit').textContent = g.fairness.seedCommit || 'Published when the giveaway goes live.';
    $('#gwHashRow').hidden = !g.fairness.entriesHash;
    $('#gwHash').textContent = g.fairness.entriesHash || '';
  }

  if (g.results) {
    $('#gwResultsWrap').hidden = false;
    paintResults(g);
  }
  $('#gwDyn').classList.add('ready');
}

function paintResults(g) {
  const winners = g.results.winners;
  const host = $('#gwResults');
  if (!winners.length) { host.innerHTML = '<div class="gw-empty"><strong>Results are being finalised</strong>Winners are confirmed by an admin before they are announced.</div>'; return; }
  if (g.results.source === 'livestream-wheel' || g.livestreamResult) {
    const winner = g.livestreamResult?.winnerName || winners[0]?.name || 'Winner';
    const prize = winners[0]?.prize || g.prize.display;
    const note = g.results.note || g.livestreamResult?.note || 'The winner was selected by the participant wheel during the livestream.';
    host.innerHTML = '<div class="gw-panel" style="border-color:rgba(246,196,83,.38);background:linear-gradient(145deg,rgba(246,196,83,.09),rgba(13,24,35,.82))">' +
      '<div class="gw-eyebrow">LIVESTREAM WHEEL WINNER</div>' +
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:10px">' +
      '<span aria-hidden="true" style="display:grid;place-items:center;width:54px;height:54px;border:1px solid rgba(246,196,83,.42);border-radius:16px;color:#f6c453;font-size:27px">🏆</span>' +
      '<div><h3 style="margin:0;color:#ffe7a6;font:700 clamp(25px,4vw,38px)/1.1 var(--gw-display,inherit)">' + esc(winner) + '</h3>' +
      '<p style="margin:7px 0 0;color:var(--gw-muted,#a7b4c3)">' + esc(prize) + '</p></div></div>' +
      '<p style="margin:16px 0 0;white-space:pre-line;color:var(--gw-muted,#a7b4c3)">' + esc(note) + '</p>' +
      '<div class="gw-note" style="margin-top:14px">To claim the prize, contact the official giveaway handle listed on this page. The website claim-code flow is not used for this livestream result. Never share your password or pay a fee to claim.</div>' +
      '</div>';
    return;
  }
  const key = 'gw:reel:' + g.slug;
  const first = winners[0];
  const fillers = ['ma****rt', 'jo****hn', 'al****ex', 'sa****ra', 'ni****ck', 'ka****ri', 'ra****ul', 'em****ly'];
  const html = '<div class="gw-reel" id="gwReel"><div></div></div><div id="gwWinList">' + winnersHtml(winners) + '</div>' +
    '<div class="gw-note" style="margin-top:12px">Names are masked to protect winners. Winners must claim with their secret claim code. If you did not win, nothing is needed from you.</div>';
  host.innerHTML = html;
  const reel = $('#gwReel div'); const list = $('#gwWinList');
  if (store.session(key) || reduced()) { $('#gwReel').hidden = true; return; }
  store.session(key, '1');
  list.style.opacity = '0';
  const seq = [...fillers.sort(() => Math.random() - .5), first.name];
  reel.innerHTML = seq.map((n) => '<span>' + esc(n) + '</span>').join('');
  requestAnimationFrame(() => requestAnimationFrame(() => { reel.style.transform = 'translateY(-' + (seq.length - 1) * 62 + 'px)'; }));
  setTimeout(() => { $('#gwReel').hidden = true; list.style.transition = 'opacity .6s'; list.style.opacity = '1'; confetti(); }, 3500);
}

function paintMe(g, me) {
  const host = $('#gwMe');
  const e = me.entry;
  const rejected = Boolean(e && ['rejected', 'disqualified', 'withdrawn'].includes(e.status));
  const fixMeta = e && e.status === 'needs_proof' ? String(e.reviewReason || '').match(/^\[Requirement: ([^\]]+)\]\s*([\s\S]*)$/) : null;
  const fixTarget = fixMeta?.[1] || '';
  const reviewerText = fixMeta ? fixMeta[2] : String(e?.reviewReason || '');
  const fixAll = !fixTarget || fixTarget === 'Multiple requirements / whole entry';
  // Automatic requirements are green as soon as the site's records confirm them.
  // Discord membership and subscription screenshots require a human, so a valid
  // submitted proof stays yellow until approved and turns red if rejected.
  for (const r of me.eligibility.results) {
    const li = $('[data-req="' + r.id + '"]'); if (!li) continue;
    const config = (g.requirements || []).find((item) => item.id === r.id);
    const manual = Boolean(config && ['text', 'image'].includes(config.input));
    const pending = manual && Boolean(e) && e.status === 'provisional' && r.ok;
    // Approval records that a human has accepted the proof. Keep that green
    // status even if temporary screenshot links expire later.
    const verified = manual ? Boolean(e && e.status === 'approved') : r.ok;
    const rejectedManual = manual && rejected;
    const needsFix = manual && Boolean(e && e.status === 'needs_proof') && (fixAll || r.label === fixTarget);
    const failed = manual ? (!e ? false : (rejectedManual || needsFix || (!r.ok && e.status !== 'needs_proof'))) : !r.ok;
    li.classList.toggle('ok', verified);
    li.classList.toggle('pending', pending);
    li.classList.toggle('bad', failed);
    const neutralManual = manual && Boolean(e && e.status === 'needs_proof') && !needsFix;
    $('.ic', li).innerHTML = verified || pending ? IC.check : manual && (!e || neutralManual) ? '•' : '!';
    $('.st', li).textContent = pending ? 'Awaiting manual review'
      : verified ? 'Approved' : rejectedManual ? 'Entry rejected' : needsFix ? 'Correction needed — see reviewer note'
        : manual && e?.status === 'needs_proof' ? 'Not flagged for correction'
          : manual && !e ? 'Complete in entry form' : r.detail;
  }
  if (me.ban) { host.innerHTML = '<div class="gw-callout bad"><div><strong>Your account is paused from giveaways' + (me.ban.permanent ? '' : ' until ' + esc(when(me.ban.endsAt))) + '.</strong><br>' + esc(me.ban.reason) + '</div></div>'; return; }
  if (!e) {
    host.innerHTML = g.status === 'live'
      ? '<div class="gw-panel"><h3>' + (autoOk(g.requirements, me.eligibility) ? 'You meet the automatic requirements' : 'Your entry') + '</h3><p>' + (autoOk(g.requirements, me.eligibility) ? 'Add your Discord name and your two proof screenshots to finish.' : 'Complete the steps above, then come back. We check them for you.') + '</p><a class="gw-btn gw-btn-gold" href="/giveaways/' + esc(g.slug) + '/enter/">Start my entry</a></div>'
      : '';
    return;
  }
  const [label, tone] = ENTRY_LABEL[e.status] || [e.status, ''];
  const shareUrl = location.origin + '/giveaways/' + g.slug + '/';
  host.innerHTML = '<div class="gw-panel gw-entry-status"><div class="gw-entry-top"><span class="gw-tag ' + (tone === 'paid' ? 'paid' : '') + '">' + esc(label) + '</span><span class="gw-note">Submitted ' + esc(when(e.createdAt)) + '</span></div>' +
    (e.reviewReason ? '<div class="gw-callout ' + (tone === 'bad' ? 'bad' : 'cyan') + ' gw-review-note"><div><strong>' + (fixTarget ? 'Correction needed: ' + esc(fixTarget) : 'Reviewer note') + '</strong><p>' + esc(reviewerText) + '</p>' + (e.status === 'needs_proof' ? '<span>Use the correction button below. The requested requirement is also marked in the checklist.</span>' : '') + '</div></div>' : '') +
    (e.status === 'needs_proof' ? '<div class="gw-entry-action-row"><a class="gw-btn gw-btn-gold" href="/giveaways/' + esc(g.slug) + '/enter/">Correct my proof</a><span class="gw-note">Your entry remains out of the draw if the deadline passes without a correction.</span></div>' : '') +
    '<div class="gw-entry-fair-card"><div><small>YOUR DRAW WEIGHT</small><strong>1 entry</strong><span>The same weight as every other eligible person.</span></div><div class="gw-entry-seal"><span>✓</span> EQUAL WEIGHT</div></div>' +
    '<p class="gw-note gw-entry-fair-note">No daily boosts, referral entries or share bonuses. Sharing is optional and never changes your chance of winning.</p>' +
    (g.status === 'live' && ['provisional', 'approved'].includes(e.status) ? '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><button class="gw-btn" id="gwShare">Share giveaway</button></div>' : '') + '</div>' +
    (me.events.length ? '<div class="gw-panel" style="margin-top:14px"><h3>Your entry timeline</h3><ul class="gw-tl">' + me.events.map((ev) => '<li class="' + esc(ev.actor) + '"><b>' + esc(ev.action.replace(/_/g, ' ')) + '</b>' + (ev.reason ? '<p>' + esc(ev.reason) + '</p>' : '') + '<time>' + esc(when(ev.created_at)) + '</time></li>').join('') + '</ul></div>' : '');
  $('#gwShare')?.addEventListener('click', async () => {
    const data = { title: g.title, text: 'Free to enter: ' + g.title + ' on FCMobiletools. ' + g.prize.display + ' up for grabs.', url: shareUrl };
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } } else copyText(shareUrl);
    fetch('/api/giveaways/' + g.slug + '/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'share' }) }).catch(() => {});
  });
}

// Re-runs the draw in the browser from the revealed seed. Returns [{ ok, text }].
export async function verifyChecks(p) {
  const checks = [];
  checks.push({ ok: await sha256Hex(p.seed) === p.seedCommit, text: 'Seed matches the fingerprint published before entries opened' });
  checks.push({ ok: await entriesHash(p.giveawayId, p.entries) === p.entriesHash, text: 'Frozen entry list (' + p.entries.length.toLocaleString() + ' entries) matches its fingerprint' });
  const ranking = await rankEntries(p.seed, p.entriesHash, p.entries);
  const bad = p.winners.filter((w) => ranking.indexOf(w.entryId) + 1 !== w.rank);
  checks.push({ ok: bad.length === 0, text: 'Every winner and alternate sits where the re-run ranking puts them' });
  return checks;
}

// "Verify this draw" button on the detail page.
export function initVerify() {
  const btn = $('#gwVerify'); if (!btn) return;
  btn.addEventListener('click', () => busy(btn, async () => {
    const out = $('#gwVerifyOut'); out.innerHTML = '';
    const slug = $('.gw-root').dataset.slug;
    let p;
    try { p = await api('/api/giveaways/' + slug + '/draw-proof', { cache: 'default' }); }
    catch (e) { out.innerHTML = '<div class=\"gw-callout\">' + esc(e.message) + '</div>'; return; }
    const checks = await verifyChecks(p);
    out.innerHTML = checks.map((c, i) => '<div class=\"gw-callout ' + (c.ok ? 'ok' : 'bad') + ' gw-verify-row\" style=\"margin-top:8px;--i:' + i + '\">' + (c.ok ? '✓ ' : '✗ ') + esc(c.text) + '.</div>').join('');
    if (checks.every((c) => c.ok)) confetti({ power: .6 });
  }));
}

// ═══════════════════════════ DRAW THEATRE ═══════════════════════════
const SAMPLE_NAMES = ['ta****fc', 'jo****hn', 'ma****rt', 'sa****ra', 'ni****ck', 'ka****ri', 'ra****ul', 'em****ly'];
const loadStage = () => { const url = '/giveaway-stage/stage.js'; return import(/* @vite-ignore */ url); };

export async function initDrawPage() {
  const root = $('.gw-root'); if (!$('#gwTheatre')) return;
  const slug = root.dataset.slug; const watch = $('#gwWatch'); const preview = $('#gwPreview');
  let g;
  try { g = await api('/api/giveaways/' + encodeURIComponent(slug), { cache: 'default' }); }
  catch (e) { watch.textContent = 'Draw unavailable'; $('#gwThNote').textContent = e.message; return; }
  const q = new URLSearchParams(location.search);
  const winners = g.results?.winners || [];
  const ready = winners.length > 0;
  const opt = { speed: ['quick', 'standard', 'epic'].includes(q.get('speed')) ? q.get('speed') : 'standard', sound: q.get('sound') === '1', clean: q.get('clean') === '1' };
  $('#gwThStatus').textContent = g.livestreamResult ? 'Winner announced' : (STATUS_LABEL[g.status] || g.status);
  $('#gwThStatus').className = 'gw-pill ' + (g.livestreamResult || ready ? 'gold' : g.status === 'live' ? 'live' : '');
  if (g.livestreamResult) {
    $('#gwThOpts').hidden = true;
    watch.hidden = true;
    preview.hidden = true;
    $('#gwThLede').textContent = g.livestreamResult.winnerName + ' won the Ballon d’Or Star Pass after the participant wheel was spun during the livestream.';
    $('#gwThNote').textContent = 'Official result from the livestream participant wheel.';
    $('#gwThResultsWrap').hidden = false;
    const winner = g.livestreamResult.winnerName;
    const prize = g.results?.winners?.[0]?.prize || g.prize.display;
    $('#gwThResults').innerHTML = '<div class="gw-panel" style="border-color:rgba(246,196,83,.38);background:linear-gradient(145deg,rgba(246,196,83,.09),rgba(13,24,35,.82))"><div class="gw-eyebrow">LIVESTREAM WHEEL WINNER</div><h2 style="margin:12px 0 6px;color:#ffe7a6">' + esc(winner) + '</h2><p class="gw-sub">' + esc(prize) + '</p><p class="gw-note">' + esc(g.livestreamResult.note || 'Selected by the participant wheel during the livestream.') + '</p><p class="gw-note" style="margin-top:12px">To claim, contact the official giveaway handle on the giveaway page. The website claim-code flow does not apply to this result.</p></div>';
    spotlight();
    return;
  }
  $('#gwThOpts').hidden = false; preview.hidden = false;
  $$('[data-speed]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.speed === opt.speed)));
  $('#gwThSound').checked = opt.sound; $('#gwThClean').checked = opt.clean;
  $('#gwThOpts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-speed]'); if (!b) return;
    opt.speed = b.dataset.speed; $$('[data-speed]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  });
  $('#gwThSound').addEventListener('change', (e) => { opt.sound = e.target.checked; });
  $('#gwThClean').addEventListener('change', (e) => { opt.clean = e.target.checked; });

  let proofP = null;
  const proof = () => (proofP ||= api('/api/giveaways/' + encodeURIComponent(slug) + '/draw-proof', { cache: 'default' }));
  const base = () => ({ title: g.title, prize: g.prize.display, speed: opt.speed, sound: opt.sound, clean: opt.clean, seedCommit: g.fairness.seedCommit });

  async function play() {
    const S = await loadStage();
    S.openDrawStage({
      ...base(), mode: 'replay', entries: g.stats.entries, winnersTotal: winners.length, verifyUrl: '/giveaways/' + g.slug + '/#gwFair',
      prepare: async () => {
        let p = null; try { p = await proof(); } catch { /* the show still works without the proof */ }
        return { entries: p?.entries?.length || g.stats.entries, entriesHash: p?.entriesHash || g.fairness.entriesHash, winners: winners.map((w) => ({ slot: w.slot, name: w.name, prize: w.prize })), alternates: Array.from({ length: g.winners.alternates || 0 }, () => '') };
      },
      verify: g.fairness.seedRevealed ? async () => ({ checks: await verifyChecks(await proof()) }) : undefined
    });
  }
  async function rehearse() {
    const S = await loadStage(); const n = Math.max(1, Math.min(8, g.winners.total || 3)); const total = Math.max(120, g.stats.entries);
    S.openDrawStage({
      ...base(), mode: 'rehearsal', entries: total, winnersTotal: n, seedCommit: g.fairness.seedCommit,
      prepare: async () => ({ entries: total, entriesHash: '', winners: Array.from({ length: n }, (_, i) => ({ slot: i + 1, name: SAMPLE_NAMES[i], prize: g.prize.display })), alternates: ['', ''] })
    });
  }
  watch.addEventListener('click', () => busy(watch, play));
  preview.addEventListener('click', () => busy(preview, rehearse));

  if (ready) {
    watch.disabled = false; watch.textContent = 'Watch the draw';
    $('#gwThLede').textContent = 'Replay how the winners were picked, with a real check of the seed and entry list running in your browser.';
    $('#gwThNote').textContent = 'Tip: press S for sound, H to hide controls, F for full screen and Space to pause.';
    $('#gwThResultsWrap').hidden = false; $('#gwThResults').innerHTML = winnersHtml(winners);
    if (q.get('autoplay') === '1') play();
  } else {
    const drawn = g.status === 'drawn';
    watch.textContent = drawn ? 'Results coming soon' : g.status === 'live' ? 'Draw happens after entries close' : 'Draw not run yet';
    $('#gwThLede').textContent = drawn ? 'The draw has run. Winners are confirmed by an admin before the show can be replayed.' : 'The draw has not happened yet. You can preview the show with sample names while you wait.';
    if (g.status === 'live' && g.endsAt) { $('#gwThNote').innerHTML = 'Entries close ' + esc(when(g.endsAt)) + '. <a href=\"/giveaways/' + esc(g.slug) + '/\" style=\"color:var(--gw-cyan)\">Go to the giveaway</a>'; }
    if (q.get('preview') === '1') rehearse();
  }
  spotlight();
}

// ═══════════════════════════ ENTER ═══════════════════════════
export async function initEnter() {
  const root = $('.gw-root'); const slug = root.dataset.slug; const host = $('#gwFlow');
  if (!(await signedIn())) {
    host.innerHTML = '<div class="gw-panel"><h3>Sign in to enter</h3><p>Entering needs a free FCMobiletools account. It lets us check your profile, survey and quest automatically, and it keeps your prize safe from impersonators.</p><a class="gw-btn gw-btn-gold gw-btn-lg" href="' + signInUrl() + '">Sign in or create an account</a></div>';
    return;
  }
  let g, me;
  try { [g, me] = await Promise.all([api('/api/giveaways/' + slug, { cache: 'default' }), api('/api/giveaways/' + slug + '/me')]); }
  catch (e) { return unavailable(host, e.message); }
  fetch('/api/giveaways/' + slug + '/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'start' }) }).catch(() => {});
  $('#gwTitle').textContent = g.title;
  fillOfficial(g.official);
  if (me.ban) { host.innerHTML = '<div class="gw-callout bad"><div><strong>Your account is paused from giveaways' + (me.ban.permanent ? '' : ' until ' + esc(when(me.ban.endsAt))) + '.</strong><br>' + esc(me.ban.reason) + '</div></div>'; return; }
  if (!me.verifiedEmail) { host.innerHTML = '<div class="gw-callout"><div><strong>Verify your email first.</strong> Check your inbox for the confirmation link, then come back.</div></div>'; return; }
  const fixing = me.entry && me.entry.status === 'needs_proof';
  const fixMeta = fixing ? String(me.entry.reviewReason || '').match(/^\[Requirement: ([^\]]+)\]\s*([\s\S]*)$/) : null;
  const fixTarget = fixMeta?.[1] || '';
  const fixNote = fixMeta ? fixMeta[2] : String(me.entry?.reviewReason || 'An administrator requested corrected proof.');
  if (me.entry && !fixing) { location.replace('/giveaways/' + slug + '/'); return; }
  if (g.status !== 'live' && !fixing) { host.innerHTML = '<div class="gw-empty"><strong>' + esc(STATUS_LABEL[g.status] || 'Closed') + '</strong>Entries are not open for this giveaway.</div>'; return; }

  const reqs = g.requirements;
  const auto = reqs.filter((r) => r.input === 'auto'), text = reqs.filter((r) => r.input === 'text'), imgs = reqs.filter((r) => r.input === 'image');
  const targetReq = fixing ? reqs.find((r) => r.label === fixTarget) : null;
  const fixAll = fixing && (!fixTarget || fixTarget === 'Multiple requirements / whole entry');
  const stale = (id) => { const p = me.entry?.proof.find((x) => x.slot === id); return !p || p.state !== 'ok' || Date.parse(p.expiresAt) <= Date.now(); };
  const needProofs = () => fixing ? imgs.filter((r) => fixAll || r.id === targetReq?.id || stale(r.id)) : imgs;
  const needsDiscordFix = Boolean(fixing && text.length && (fixAll || targetReq?.input === 'text'));
  const steps = [];
  if (auto.length && !fixing) steps.push('account');
  if (text.length && (!fixing || needsDiscordFix)) steps.push('discord');
  if (imgs.length && (!fixing || needProofs().length)) steps.push('proof');
  steps.push('review');
  const st = { i: 0, discord: me.entry?.discordUsername || '', proofs: {}, previews: {}, errors: {}, ack: false, eligibility: me.eligibility, uploading: new Set() };

  const render = () => {
    const step = steps[st.i];
    const bar = '<div class="gw-stepper" aria-hidden="true">' + steps.map((_, k) => '<i class="' + (k <= st.i ? 'on' : '') + '"></i>').join('') + '</div>';
    let body = '';
    if (step === 'account') {
      body = '<h3>Your account</h3><p>We check these for you automatically.</p><ul class="gw-reqs">' + auto.map((r) => {
        const c = st.eligibility.results.find((x) => x.id === r.id) || {};
        return '<li class="gw-req ' + (c.ok ? 'ok' : 'bad') + '"><span class="ic">' + (c.ok ? IC.check : '!') + '</span><div><h4>' + esc(r.label) + '</h4><p>' + esc(c.ok ? r.help : (c.detail || r.help)) + '</p>' + (!c.ok && r.link ? '<a href="' + esc(r.link) + '">Do this now</a>' : '') + '</div></li>';
      }).join('') + '</ul><button class="gw-btn" id="gwRecheck" style="margin-top:14px">I finished them, check again</button>';
    } else if (step === 'discord') {
      const o = g.official;
      body = '<h3>Join our Discord</h3><p>Join the official server, then type your exact Discord username below. An admin checks that you are a member.</p>' +
        (o.discordInvite ? '<a class="gw-btn" target="_blank" rel="noopener noreferrer" href="' + esc(o.discordInvite) + '">Open our Discord server</a>' : '<div class="gw-callout">The invite link is being added. Check back shortly.</div>') +
        '<div class="gw-field" style="margin-top:16px"><label for="gwDiscord">Your Discord username</label><input class="gw-input" id="gwDiscord" autocomplete="off" spellcheck="false" maxlength="40" placeholder="for example tanzim_fc" value="' + esc(st.discord) + '"><span class="gw-hint">Your username, not your display name. No spaces.</span></div>';
    } else if (step === 'proof') {
      const need = needProofs();
      body = '<h3>' + (fixing ? 'Replace the requested screenshot' : 'Subscribe and show proof') + '</h3><p>' +
        (fixing ? 'The reviewer note identifies what needs changing. Upload the screenshot for each requirement shown below; other valid screenshots stay attached.' :
          'Subscribe to each channel, then upload a screenshot showing the <strong>Subscribed</strong> button. Screenshots are temporary images that delete themselves after ' + g.proofTtlHours + ' hours.') + '</p>' +
        (fixing ? '<div class="gw-callout bad gw-fix-callout" style="margin-bottom:16px"><div><strong>Requirement to correct: ' + esc(fixTarget || 'Review the note below') + '</strong><p>' + esc(fixNote) + '</p></div></div>' : '') +
        need.map((r) => '<div class="gw-field gw-proof-field"><label>' + esc(r.label) + (r.link ? ' · <a href="' + esc(r.link) + '" target="_blank" rel="noopener noreferrer" style="color:var(--gw-cyan)">open channel</a>' : '') + '</label>' +
          '<div class="gw-drop ' + (st.proofs[r.id] ? 'done' : '') + '" data-drop="' + esc(r.id) + '">' + (st.previews[r.id] ? '<img src="' + esc(st.previews[r.id]) + '" alt="Your screenshot preview">' : '<span class="gw-upload-icon">↑</span><strong>' + (fixing ? 'Choose a replacement screenshot' : 'Add a screenshot') + '</strong><span>JPG, PNG or WebP · maximum 8 MB</span>') +
          '<label class="gw-btn gw-btn-sm gw-upload-select" for="gwFile-' + esc(r.id) + '">Choose photo</label><input id="gwFile-' + esc(r.id) + '" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Upload screenshot for ' + esc(r.label) + '">' +
          '</div><span class="gw-hint">' + (st.uploading.has(r.id) ? 'Uploading your image…' : st.proofs[r.id] ? '✓ Uploaded. Choose photo to replace it.' : 'Make sure the screenshot shows your account and the Subscribed button.') + '</span>' +
          (st.errors[r.id] ? '<span class="gw-upload-error" role="alert">' + esc(st.errors[r.id]) + '</span>' : '') + '</div>').join('');
    } else {
      body = '<h3>Review and submit</h3><p>You are about to enter <strong>' + esc(g.title) + '</strong>.</p><ul class="gw-reqs" style="margin-bottom:16px">' +
        reqs.map((r) => {
          const check = st.eligibility.results.find((x) => x.id === r.id) || {};
          if (r.input === 'auto') return '<li class="gw-req ' + (check.ok ? 'ok' : 'bad') + '"><span class="ic">' + (check.ok ? IC.check : '!') + '</span><div><h4>' + esc(r.label) + '</h4><p>' + esc(check.ok ? 'Verified from your account records' : (check.detail || 'Not completed yet')) + '</p></div></li>';
          const proofReady = r.input === 'text'
            ? Boolean(st.discord.trim())
            : Boolean(st.proofs[r.id] || me.entry?.proof.some((p) => p.slot === r.id && p.state === 'ok' && Date.parse(p.expiresAt) > Date.now()));
          return '<li class="gw-req ' + (proofReady ? 'pending' : 'bad') + '"><span class="ic">' + (proofReady ? IC.check : '!') + '</span><div><h4>' + esc(r.label) + '</h4><p>' + esc(proofReady ? 'Human review after submission' : (r.input === 'text' ? 'Enter your Discord username' : 'Upload the required screenshot')) + '</p></div></li>';
        }).join('') + '</ul>' +
        '<div class="gw-callout cyan"><div>Your account checks are automatic. Discord membership and subscription screenshots enter the human review queue. Your entry can be drawn while review is pending, but rejection removes it from the draw. Selected winners must be approved before results can be published.</div></div>' +
        '<label class="gw-check"><input type="checkbox" id="gwAck" ' + (st.ack ? 'checked' : '') + '><span>I am 18 or older (or my parent or guardian agrees for me) and I accept the <a href="/giveaways/rules/" target="_blank" style="color:var(--gw-cyan)">Giveaway Rules</a>.</span></label>';
    }
    const last = st.i === steps.length - 1;
    host.innerHTML = '<div class="gw-panel">' + bar + body + '<div style="display:flex;gap:10px;margin-top:22px;flex-wrap:wrap">' + (st.i > 0 ? '<button class="gw-btn" id="gwBack">Back</button>' : '') + '<button class="gw-btn gw-btn-gold" id="gwNext" style="margin-left:auto">' + (last ? (fixing ? 'Submit corrected proof' : 'Submit my entry') : 'Continue') + '</button></div></div>';
    bind(step);
  };

  const recheck = async () => { me = await api('/api/giveaways/' + slug + '/me'); st.eligibility = me.eligibility; render(); };
  const need = () => (fixing ? imgs.filter((r) => stale(r.id)) : imgs);

  function bind(step) {
    $('#gwBack')?.addEventListener('click', () => { st.i -= 1; render(); });
    $('#gwRecheck')?.addEventListener('click', (e) => busy(e.currentTarget, async () => { try { await recheck(); toast(autoOk(reqs, st.eligibility) ? 'All automatic checks passed.' : 'Some steps are still open.'); } catch (err) { toast(err.message, true); } }));
    $('#gwDiscord')?.addEventListener('input', (e) => { st.discord = e.target.value.trim(); });
    $('#gwAck')?.addEventListener('change', (e) => { st.ack = e.target.checked; });
    $$('[data-drop]').forEach((drop) => {
      const id = drop.dataset.drop; const input = $('input[type="file"]', drop);
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => { if (e.dataTransfer?.files?.[0]) upload(id, e.dataTransfer.files[0]); });
      drop.addEventListener('click', (e) => { if (!e.target.closest('label') && !e.target.closest('input') && !e.target.closest('a')) input.click(); });
      input.addEventListener('change', () => { if (input.files[0]) upload(id, input.files[0]); });
    });
    $('#gwNext')?.addEventListener('click', (e) => busy(e.currentTarget, () => next(step)));
  }

  async function upload(id, file) {
    if (file.type && !/^image\//.test(file.type)) {
      st.errors[id] = 'This file does not look like an image. Choose a JPG, PNG, WebP or GIF photo.';
      render(); return;
    }
    if (file.size > 8 * 1024 * 1024) {
      st.errors[id] = 'This image is larger than 8 MB. Choose a smaller photo.';
      render(); return;
    }
    if (st.previews[id]?.startsWith('blob:')) URL.revokeObjectURL(st.previews[id]);
    st.previews[id] = URL.createObjectURL(file); delete st.errors[id]; st.uploading.add(id); render();
    try {
      const form = new FormData(); form.append('slot', id); form.append('file', file);
      const r = await api('/api/giveaways/' + slug + '/proof', { method: 'POST', body: form });
      st.proofs[id] = r.proof;
      delete st.errors[id];
    } catch (err) {
      if (st.previews[id]?.startsWith('blob:')) URL.revokeObjectURL(st.previews[id]);
      delete st.previews[id];
      const message = err.status === 503
        ? 'The upload service is unavailable right now. Your screenshot was not saved. Try again later; do not submit until the upload shows as complete.'
        : err.status === 429
          ? 'You have reached the temporary upload limit. Wait a little before trying again.'
          : err.status === 413
            ? 'The server rejected this file as too large. Choose a smaller image under 8 MB.'
            : err.message || 'The image could not be uploaded. Please choose it again.';
      st.errors[id] = message;
      toast(st.errors[id], true);
    }
    st.uploading.delete(id); render();
  }

  async function next(step) {
    if (step === 'account') {
      await recheck();
      if (!autoOk(reqs, st.eligibility)) return toast('Finish the open steps first, then check again.', true);
    }
    if (step === 'discord' && !/^[A-Za-z0-9_.]{2,32}(#\d{4})?$/.test(st.discord.replace(/^@/, ''))) return toast('Enter your Discord username exactly as it appears. No spaces.', true);
    if (step === 'proof') {
      const missing = needProofs().find((r) => !st.proofs[r.id]);
      if (missing) return toast('Choose a screenshot for: ' + missing.label, true);
    }
    if (step !== 'review') { st.i += 1; render(); return; }
    if (!st.ack) return toast('Accept the Giveaway Rules to continue.', true);
    try {
      const payload = { proofs: st.proofs, discord: st.discord, ack: true, ref: store.get('gw:ref') || undefined };
      if (fixing) await api('/api/giveaways/' + slug + '/entry', { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/api/giveaways/' + slug + '/enter', { method: 'POST', body: JSON.stringify(payload) });
      confetti(); done();
    } catch (err) {
      if (err.body?.eligibility) { st.eligibility = err.body.eligibility; st.i = 0; if (steps[0] !== 'account') st.i = steps.length - 1; }
      toast(err.message, true); render();
    }
  }

  function done() {
    host.innerHTML = '<div class=\"gw-panel gw-done\"><div class=\"gw-stubcard\" style=\"--c:' + esc(g.accent) + '\"><div class=\"gw-stubcard-l\"><small>Entry</small><b>✓</b></div><div class=\"gw-stubcard-r\"><strong>' + esc(g.title) + '</strong><span>' + esc(g.prize.display) + ' · ' + (fixing ? 'corrected proof sent' : 'in the draw') + '</span></div></div>' +
      '<h3 style=\"font-size:26px;margin:22px 0 6px\">' + (fixing ? 'Corrected proof sent' : 'You are in the draw!') + '</h3>' +
      '<p>An admin will review your entry. You can check the status and every decision, with its reason, on the giveaway page.</p>' +
      '<div class=\"gw-callout ok\" style=\"text-align:left\"><div><strong>Fair draw:</strong> every eligible person receives exactly one entry. Your entry has the same weight as every other eligible person.</div></div>' +
      '<div style=\"display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px\"><a class=\"gw-btn gw-btn-gold\" href=\"/giveaways/' + esc(slug) + '/\">See my entry</a><a class=\"gw-btn\" href=\"/giveaways/\">More giveaways</a></div></div>';
  }
  render();
}

// ═══════════════════════════ CLAIM CENTRE ═══════════════════════════
export async function initClaim() {
  const host = $('#gwClaim');
  if (!(await signedIn())) {
    host.innerHTML = '<div class="gw-panel"><h3>Sign in to see your prizes</h3><p>Your entries, review notes and winner claim forms live in this private area.</p><a class="gw-btn gw-btn-gold" href="' + signInUrl() + '">Sign in or create account</a></div>';
    return;
  }
  let mine, pub;
  try {
    [mine, pub] = await Promise.all([
      api('/api/giveaways/mine'),
      api('/api/giveaways/public', { cache: 'default' }).catch(() => ({ official: {} }))
    ]);
  } catch (e) { return unavailable(host, e.message); }
  const official = pub.official || {};
  fillOfficial(official);
  const handles = [
    official.discordHandle && 'Discord: <strong>' + esc(official.discordHandle) + '</strong>',
    official.instagramHandle && 'Instagram: <strong>@' + esc(official.instagramHandle) + '</strong>'
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');
  let tab = mine.prizes.length ? 'prizes' : 'entries';

  const prizeCard = (p) => {
    const isClaimable = ['awaiting_claim', 'code_verified'].includes(p.status);
    const hasDetails = Boolean(p.contact_handle && /^\d{6,20}$/.test(String(p.fc_uid || '')));
    const steps = [
      ['Winner selected and checked', ['awaiting_claim', 'code_verified', 'paid'].includes(p.status)],
      ['Discord username and FC Mobile UID saved', hasDetails],
      ['Private claim code viewed', Number(p.code_reveals || 0) > 0],
      ['Reward delivery confirmed', p.status === 'paid']
    ];
    const left = p.claim_deadline ? Date.parse(p.claim_deadline) - Date.now() : null;
    const readOnly = p.status !== 'awaiting_claim';
    return '<article class="gw-panel" data-prize="' + esc(p.id) + '" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">' +
        '<div><span class="gw-eyebrow">YOUR REWARD</span><h3 style="font-size:clamp(24px,4vw,32px);margin:8px 0 4px">You won ' + esc(p.prize) + '</h3>' +
          '<p class="gw-note" style="margin:0">' + esc(p.giveaway?.title || 'FCMobiletools giveaway') + ' · In-game reward · No real cash value</p></div>' +
        '<span class="gw-tag ' + (p.status === 'paid' ? 'paid' : '') + '">' + esc(({ awaiting_claim:'Claim details needed', code_verified:'Claim verified', paid:'Reward delivered', forfeited:'Forfeited' })[p.status] || p.status) + '</span>' +
      '</div>' +
      (p.status === 'awaiting_claim' && left !== null ? '<div class="gw-callout ' + (left < 0 ? 'bad' : 'cyan') + '" style="margin-top:16px"><div>' +
        (left < 0 ? '<strong>Your displayed claim deadline has passed.</strong> Contact the official Discord through the link below as soon as possible.' :
          'Claim deadline: <strong>' + esc(when(p.claim_deadline)) + '</strong> <span style="white-space:nowrap">(' + esc(short(left)) + ' remaining)</span>') +
      '</div></div>' : '') +
      '<div class="gw-stepper" aria-label="Claim progress" style="margin-top:20px">' +
        steps.map((s) => '<i class="' + (s[1] ? 'on' : '') + '"></i>').join('') +
      '</div>' +
      '<ol class="gw-tl" style="margin:0 0 20px">' + steps.map(([label, done], i) =>
        '<li class="' + (done ? 'admin' : '') + '"><b style="text-transform:none">' + (done ? '✓ ' : (i + 1) + '. ') + esc(label) + '</b></li>'
      ).join('') + '</ol>' +
      (isClaimable ? '<section class="gw-vault" style="padding:18px;border:1px solid rgba(76,201,255,.2);border-radius:16px;background:rgba(76,201,255,.035)">' +
        '<div class="gw-eyebrow">SECURE WINNER VERIFICATION</div><h3 style="margin:7px 0 6px">Confirm your game and Discord details</h3>' +
        '<p class="gw-note" style="line-height:1.7;margin-bottom:16px">We use these details to check that the person contacting the official team is the selected winner. Never enter your game password or verification codes.</p>' +
        (readOnly ? '<div class="gw-cols" style="margin-bottom:10px"><div class="gw-field"><label>Discord username</label><input class="gw-input" readonly value="' + esc(p.contact_handle || '') + '"></div><div class="gw-field"><label>FC Mobile UID</label><input class="gw-input" readonly value="' + esc(p.fc_uid || '') + '"></div></div>' :
          '<div class="gw-cols" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px">' +
            '<div class="gw-field"><label for="gwClaimDiscord">Discord username</label><input class="gw-input" id="gwClaimDiscord" autocomplete="off" spellcheck="false" maxlength="32" placeholder="Your exact Discord username" value="' + esc(p.contact_handle || '') + '" required><span class="gw-hint">Use the username you will message us from, not a server nickname.</span></div>' +
            '<div class="gw-field"><label for="gwClaimUid">FC Mobile UID</label><input class="gw-input" id="gwClaimUid" inputmode="numeric" autocomplete="off" maxlength="20" pattern="[0-9]{6,20}" placeholder="6 to 20 digits" value="' + esc(p.fc_uid || '') + '" required><span class="gw-hint">Your in-game UID only. Never send your password.</span></div>' +
          '</div>' +
          '<button class="gw-btn gw-btn-gold" data-save-claim type="button">Save details securely</button> <span class="gw-hint" data-save-hint>Required before your claim code can be shown.</span>') +
        '<div class="gw-callout cyan" style="margin-top:16px"><div><strong>Continue through official Discord only.</strong> ' +
          (official.discordInvite ? '<a href="' + esc(official.discordInvite) + '" target="_blank" rel="noopener noreferrer" style="color:var(--gw-cyan);font-weight:750">Open the official server ↗</a>' : 'Use the official Discord invite shown on the Giveaway Safety page.') +
          (handles ? '<div class="gw-note" style="margin-top:6px">Published claim contacts: ' + handles + '</div>' : '') +
        '</div></div>' +
        '<div class="gw-vault" style="margin-top:16px;padding:16px;background:rgba(5,14,23,.55)"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div class="gw-eyebrow">PRIVATE CLAIM CODE</div><strong style="display:block;margin-top:6px">Keep this code to yourself</strong></div>' +
          (hasDetails ? '<span class="gw-tag paid">Details saved</span>' : '<span class="gw-tag">Form required</span>') +
        '</div>' +
        '<div class="gw-code hidden" data-code style="margin-top:14px">FCM-XXXX-XXXX-XXXX</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
          '<button class="gw-btn gw-btn-gold" data-reveal ' + (hasDetails ? '' : 'disabled') + ' type="button">' + (hasDetails ? 'Reveal my claim code' : 'Save details to unlock code') + '</button>' +
          '<button class="gw-btn" data-copy hidden type="button">Copy code</button>' +
        '</div>' +
        '<p class="gw-note" style="line-height:1.7;margin:12px 0 0">Only your signed-in claim centre and authorised admins can access this code. It hides again after 30 seconds. Send it only through the official contact route, never post it publicly.</p></div>' +
      '</section>' : '') +
      (p.status === 'paid' ? '<div class="gw-callout ok" style="margin-top:14px"><div><strong>Reward delivered.</strong> Confirmed on ' + esc(when(p.paid_at)) + (p.payout_method ? ' via ' + esc(p.payout_method) : '') + '.</div></div>' : '') +
    '</article>';
  };

  const entryCard = (e) => {
    const [label, tone] = ENTRY_LABEL[e.status] || [e.status, ''];
    return '<article class="gw-panel" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">' + esc(e.giveaway?.title || 'Giveaway') + '</h3><span class="gw-tag ' + (tone === 'paid' ? 'paid' : '') + '">' + esc(label) + '</span></div>' +
      (e.review_reason ? '<p style="margin:10px 0 0;color:var(--gw-mut)"><strong style="color:#fff">Reviewer note:</strong> ' + esc(e.review_reason) + '</p>' : '') +
      (e.status === 'needs_proof' ? '<a class="gw-btn gw-btn-gold gw-btn-sm" style="margin-top:12px" href="/giveaways/' + esc(e.giveaway?.slug) + '/enter/">Upload corrected proof</a>' + (e.fix_deadline ? ' <span class="gw-note">by ' + esc(when(e.fix_deadline)) + '</span>' : '') : '') +
      (e.events.length ? '<ul class="gw-tl" style="margin-top:16px">' + e.events.map((ev) => '<li class="' + esc(ev.actor) + '"><b>' + esc(ev.action.replace(/_/g, ' ')) + '</b>' + (ev.reason ? '<p>' + esc(ev.reason) + '</p>' : '') + '<time>' + esc(when(ev.created_at)) + '</time></li>').join('') + '</ul>' : '') + '</article>';
  };

  const paint = () => {
    const ban = mine.ban ? '<div class="gw-callout bad" style="margin-bottom:18px"><div><strong>Your account is paused from giveaways' + (mine.ban.permanent ? '' : ' until ' + esc(when(mine.ban.endsAt))) + '.</strong><br>' + esc(mine.ban.reason) + '</div></div>' : '';
    host.innerHTML = ban + '<div class="gw-tabs" role="tablist"><button class="' + (tab === 'prizes' ? 'on' : '') + '" data-tab="prizes">My prizes' + (mine.prizes.length ? ' (' + mine.prizes.length + ')' : '') + '</button><button class="' + (tab === 'entries' ? 'on' : '') + '" data-tab="entries">My entries (' + mine.entries.length + ')</button></div>' +
      (tab === 'prizes' ? (mine.prizes.length ? mine.prizes.map(prizeCard).join('') : '<div class="gw-empty"><strong>No prizes yet</strong>Your winner claim form will appear here if your entry is selected and results are published.</div>') :
        (mine.entries.length ? mine.entries.map(entryCard).join('') : '<div class="gw-empty"><strong>No entries yet</strong><p>Browse active giveaways and enter with your free account.</p><a class="gw-btn gw-btn-gold" style="margin-top:12px" href="/giveaways/">Browse giveaways</a></div>'));
    $$('[data-tab]', host).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; paint(); }));
    $$('[data-prize]', host).forEach(bindPrize);
  };

  function bindPrize(card) {
    const id = card.dataset.prize;
    const save = $('[data-save-claim]', card);
    save?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
      const discord = $('#gwClaimDiscord', card)?.value.trim() || '';
      const uid = $('#gwClaimUid', card)?.value.replace(/\s+/g, '') || '';
      if (!/^[A-Za-z0-9_.]{2,32}$/.test(discord)) return toast('Enter a valid Discord username (2 to 32 letters, numbers, dots or underscores).', true);
      if (!/^\d{6,20}$/.test(uid)) return toast('FC Mobile UID must be 6 to 20 digits.', true);
      try {
        await api('/api/giveaways/claims/' + id + '/contact', { method: 'POST', body: JSON.stringify({ handle: discord, fcUid: uid }) });
        toast('Winner details saved. Your claim code is now unlocked.');
        mine = await api('/api/giveaways/mine');
        paint();
      } catch (err) { toast(err.message, true); }
    }));
    const codeEl = $('[data-code]', card);
    let timer;
    $('[data-reveal]', card)?.addEventListener('click', (e) => busy(e.currentTarget, async () => {
      try {
        const r = await api('/api/giveaways/claims/' + id + '/reveal', { method: 'POST' });
        codeEl.classList.remove('hidden'); codeEl.classList.add('decrypting');
        await scramble(codeEl, r.code, 900); codeEl.classList.remove('decrypting');
        const cp = $('[data-copy]', card);
        cp.hidden = false;
        cp.onclick = () => copyText(r.code);
        clearTimeout(timer);
        timer = setTimeout(() => {
          codeEl.classList.add('hidden');
          codeEl.textContent = 'FCM-XXXX-XXXX-XXXX';
          cp.hidden = true;
        }, 30000);
      } catch (err) { toast(err.message, true); }
    }));
  }
  paint();
}

// ═══════════════════════════ STATIC PAGES ═══════════════════════════
// Safety and rules pages only need the official handles filled in.
export async function initOfficial() {
  try { const d = await api('/api/giveaways/public', { cache: 'default' }); fillOfficial(d.official); }
  catch { fillOfficial(null); const el = $('[data-gw-handles]'); if (el) el.textContent = 'Official handles are listed on our Discord and YouTube channels.'; }
}
