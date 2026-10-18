// Find a League: the interactive board. Discover, compare, saved, applications, inbox,
// player search, Club HQ (owner) and the listing wizard live here. The page (index.astro)
// provides the shell and server-rendered cards; this takes over once the browser is ready.
import { accountAuth } from './account-client.js';
import {
  api, token, signInUrl, toast, openSheet, bindInfo, openProfileSheet, startApply, openRulesSheet, mountUploader, mountGallery,
  openLightbox, bindCardFx, reveal, countUp, store, $, $$, REGIONS, LANGS, SIZES, STYLES, AVAIL
} from './league-client.js';
import { leagueCard, spotCard, esc, fmt, ts, crest, ring, infoBtn, divisionBadge, trustBadge, leagueHref, timeAgo, ICON } from './league-card.js';
import { DIVISIONS, ACCENTS, JOIN_METHODS, FREQ, COMMIT, divisionIcon, divisionRange, TAGLINE_MAX } from '../data/leagueConfig.js';
import {
  fitFor, rankLeagues, similarLeagues, screenshotState, triageApplications, kickoffState, listingExpiry, listingHealth,
  ownerActions, taglineSuggestions, pipeline, applicationNudge, OWNER_REPLIES, PLAYER_REPLIES, KICKOFF_COOLDOWN_MS
} from './league-smart.js';

const APP_LABEL = { new: 'Sent', shortlisted: 'Shortlisted', invited: 'Invited in game', joined: 'Joined', declined: 'Declined', withdrawn: 'Withdrawn' };
const FILTER_KEYS = ['q', 'division', 'region', 'freq', 'size', 'lang', 'commit', 'join'];
const URL_KEYS = { q: 'q', division: 'div', region: 'region', freq: 'freq', size: 'size', lang: 'lang', commit: 'style', join: 'join' };

export function startBoard() {
  const state = {
    signedIn: false, loadedPersonal: false, account: null, profile: null, suggested: {},
    leagues: [], spotlight: [], ownListings: [], ownerCrew: [], crewReady: false, galleryReady: false, myCrew: null, myApplications: [], ownerApps: null, newApplications: 0,
    inboxThreads: [], unreadMessages: 0, inboxMessages: [], activeConversationId: null, inboxLoading: false, savedCount: 0,
    canFindPlayers: false, remaining: 3, players: [], revealed: new Map(), editingId: null, tab: 'leagues', view: 'board', hqTab: 'apps', appFilter: 'all', appSort: 'fit',
    compare: [], filters: { q: '', division: '', region: '', freq: '', size: '', lang: '', commit: '', join: '', verified: false, spots: false, ovr: 0 }, sort: 'active'
  };
  const own = () => state.ownListings.find(r => r.status !== 'removed') || null;
  const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + 'h ' : '') + m + 'm'; };
  const when = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleString() : ''; };
  const empty = (title, text, action = '') => '<div class="lg-empty"><div class="lg-empty-art" aria-hidden="true"><i></i><i></i><i></i></div><h3>' + esc(title) + '</h3><p>' + text + '</p>' + action + '</div>';
  const skel = (n = 3) => '<div class="lg-skel-grid">' + '<div class="lg-skel"></div>'.repeat(n) + '</div>';
  const inboxSuspended = (e) => { state.inboxThreads = []; state.unreadMessages = 0; state.inboxMessages = []; state.activeConversationId = null; renderTabs(); renderInbox(e); };

  // ───────────── matching, filtering, sorting ─────────────
  const matchProfile = () => state.profile || (state.filters.ovr ? { ovr: state.filters.ovr } : null);
  function matchFor(r) {
    const p = matchProfile(); if (!p) return null;
    const m = fitFor(p, r); if (m && !state.profile) m.lite = true; return m;
  }
  const recency = (r) => ts(r.lastActiveAt) || ts(r.createdAt);
  const realFirst = (fn) => (a, b) => (Number(a.isSample) - Number(b.isSample)) || fn(a, b);
  const SORTERS = {
    match: realFirst((a, b) => (b._m?.score || 0) - (a._m?.score || 0) || recency(b) - recency(a)),
    active: realFirst((a, b) => Number(b.kickoffActive) - Number(a.kickoffActive) || b.activityScore - a.activityScore || recency(b) - recency(a)),
    newest: realFirst((a, b) => ts(b.createdAt) - ts(a.createdAt)),
    spots: realFirst((a, b) => b.openSpots - a.openSpots || recency(b) - recency(a)),
    ovr: realFirst((a, b) => a.minOvr - b.minOvr || recency(b) - recency(a))
  };
  function passes(r, f) {
    const q = f.q.trim().toLowerCase();
    if (q && ![r.name, r.tagline, r.regionServer, r.slug, (r.preferredLanguages || []).join(' ')].join(' ').toLowerCase().includes(q)) return false;
    if (f.division && r.division !== f.division) return false;
    if (f.region && r.regionServer !== f.region) return false;
    if (f.freq && r.tournamentFrequency !== f.freq) return false;
    if (f.size && !(r.tournamentSizes || []).includes(f.size)) return false;
    if (f.lang && !(r.preferredLanguages || []).includes(f.lang)) return false;
    if (f.commit && r.playerCommitment !== f.commit) return false;
    if (f.join && !(r.joinMethods || []).includes(f.join)) return false;
    if (f.verified && !r.verified) return false;
    if (f.spots && r.openSpots <= 0) return false;
    if (f.ovr && r.minOvr > f.ovr) return false;
    return true;
  }
  const decorate = (r) => ({ ...r, _m: matchFor(r), comparing: state.compare.includes(r.id) });
  const visible = () => state.leagues.map(decorate).filter(r => passes(r, state.filters)).sort(SORTERS[state.sort] || SORTERS.active);
  const moreCount = () => ['freq', 'size', 'lang', 'commit', 'join'].filter(k => state.filters[k]).length + (state.filters.verified ? 1 : 0);

  // ───────────── URL <-> filters (shareable searches) ─────────────
  function filtersToUrl() {
    const u = new URL(location.href);
    for (const k of FILTER_KEYS) { const v = state.filters[k]; v ? u.searchParams.set(URL_KEYS[k], v) : u.searchParams.delete(URL_KEYS[k]); }
    state.filters.spots ? u.searchParams.set('spots', '1') : u.searchParams.delete('spots');
    state.filters.verified ? u.searchParams.set('verified', '1') : u.searchParams.delete('verified');
    state.filters.ovr ? u.searchParams.set('ovr', String(state.filters.ovr)) : u.searchParams.delete('ovr');
    state.sort !== 'active' ? u.searchParams.set('sort', state.sort) : u.searchParams.delete('sort');
    history.replaceState(null, '', u);
  }
  function filtersFromUrl() {
    const sp = new URLSearchParams(location.search);
    for (const k of FILTER_KEYS) { const v = sp.get(URL_KEYS[k]); if (v) state.filters[k] = v.slice(0, 80); }
    state.filters.spots = sp.get('spots') === '1'; state.filters.verified = sp.get('verified') === '1';
    const o = Number(sp.get('ovr')); if (o >= 50 && o <= 200) state.filters.ovr = o;
    if (['match', 'active', 'newest', 'spots', 'ovr'].includes(sp.get('sort'))) state.sort = sp.get('sort');
  }

  // ───────────── static setup ─────────────
  const opt = (v, l) => '<option value="' + esc(v) + '">' + esc(l == null ? v : l) + '</option>';
  function buildOptions() {
    $('#fRegion').innerHTML = opt('', 'All regions') + REGIONS.map(r => opt(r)).join('');
    $('#fLang').innerHTML = opt('', 'Any language') + LANGS.map(r => opt(r)).join('');
    $('#fFreq').innerHTML = opt('', 'Any schedule') + Object.entries(FREQ).map(([k, v]) => opt(k, v)).join('');
    $('#fSize').innerHTML = opt('', 'Any size') + SIZES.map(r => opt(r)).join('');
    $('#fCommit').innerHTML = opt('', 'Any style') + Object.entries(COMMIT).map(([k, v]) => opt(k, v)).join('');
    $('#fJoin').innerHTML = opt('', 'Any way to join') + Object.entries(JOIN_METHODS).map(([k, v]) => opt(k, v)).join('');
    setSortOptions();
  }
  function setSortOptions() {
    const sel = $('#fSort'), keep = state.sort;
    sel.innerHTML = (matchProfile() ? '<option value="match">Best fit</option>' : '') + '<option value="active">Most active</option><option value="newest">Newest</option><option value="spots">Most open spots</option><option value="ovr">Lowest OVR needed</option>';
    if (!matchProfile() && keep === 'match') state.sort = 'active';
    sel.value = state.sort;
  }
  function syncControls() {
    const f = state.filters;
    $('#fQ').value = f.q; $('#fRegion').value = f.region; $('#fLang').value = f.lang; $('#fFreq').value = f.freq; $('#fSize').value = f.size;
    $('#fCommit').value = f.commit; $('#fJoin').value = f.join; $('#fSpots').checked = f.spots; $('#fVerified').checked = f.verified;
    if (document.activeElement !== $('#fOvr')) $('#fOvr').value = f.ovr || '';
    $('#fSort').value = state.sort;
  }

  // ───────────── hero + tabs ─────────────
  function renderHero() {
    const real = state.leagues;
    countUp($('#statLeagues'), real.length); countUp($('#statSpots'), real.reduce((n, r) => n + Number(r.openSpots || 0), 0));
    countUp($('#statRegions'), new Set(real.map(r => r.regionServer)).size);
    const me = $('#lgMe'), p = state.profile;
    if (!state.signedIn) { me.hidden = true; $('#lgListCta').firstChild.textContent = 'List your league '; return; }
    me.hidden = false;
    me.innerHTML = p
      ? crest(p.avatar_url || state.account?.avatarUrl, state.account?.displayName || p.in_game_username, 'lg-avatar') + '<div class="lg-me-txt"><b>' + esc(p.in_game_username) + '</b><small>OVR ' + fmt(p.ovr) + ' · ' + esc(p.region_server) + '</small></div><button class="lg-btn lg-btn-glass lg-btn-sm" id="lgEditProfile" type="button">Edit card</button>'
      : '<div class="lg-me-txt"><b>' + esc(state.account?.displayName || 'Signed in') + '</b><small>Add your OVR to see your best fits</small></div><button class="lg-btn lg-btn-primary lg-btn-sm" id="lgEditProfile" type="button">Add player card</button>';
    $('#lgListCta').firstChild.textContent = (own() ? 'Open my league ' : 'List your league ');
  }
  function tabList() {
    const unread = state.inboxThreads.reduce((n, t) => n + Number(t.unreadCount || 0), 0) || state.unreadMessages || 0;
    const tabs = [{ id: 'leagues', label: 'Discover', icon: 'search' }, { id: 'inbox', label: 'Inbox', icon: 'inbox', badge: unread }];
    if (!state.signedIn) return tabs;
    tabs.splice(1, 0,
      { id: 'saved', label: 'Saved', icon: 'heart', count: state.savedCount || state.leagues.filter(r => r.saved).length },
      { id: 'apps', label: 'Applications', icon: 'bolt', count: state.myApplications.filter(a => a.status !== 'withdrawn').length });
    if (state.canFindPlayers) tabs.push({ id: 'players', label: 'Find players', icon: 'users' });
    tabs.push({ id: 'owner', label: own() ? 'My league' : 'List a league', icon: 'crown', badge: state.newApplications });
    return tabs;
  }
  function renderTabs() {
    const tabs = tabList(), nav = $('#lgTabs');
    nav.hidden = tabs.length < 2;
    if (!tabs.some(t => t.id === state.tab)) state.tab = 'leagues';
    nav.innerHTML = '<span class="lg-tab-glow" aria-hidden="true"></span>' + tabs.map(t => '<button class="lg-tab' + (t.id === state.tab ? ' active' : '') + '" role="tab" type="button" data-tab="' + t.id + '" aria-selected="' + (t.id === state.tab) + '">' + ICON[t.icon] + '<span>' + esc(t.label) + '</span>' +
      (t.count ? '<em>' + fmt(t.count) + '</em>' : '') + (t.badge ? '<b class="lg-dot">' + fmt(t.badge) + '</b>' : '') + '</button>').join('');
    for (const [id, sel] of [['leagues', '#panelLeagues'], ['saved', '#panelSaved'], ['apps', '#panelApps'], ['inbox', '#panelInbox'], ['players', '#panelPlayers'], ['owner', '#panelOwner']]) $(sel).hidden = id !== state.tab;
    requestAnimationFrame(moveGlow);
    renderActivityNotice();
  }
  function moveGlow() {
    const nav = $('#lgTabs'), on = $('.lg-tab.active', nav), g = $('.lg-tab-glow', nav);
    if (!on || !g) return;
    g.style.setProperty('--x', on.offsetLeft + 'px'); g.style.setProperty('--w', on.offsetWidth + 'px'); g.classList.add('ready');
  }
  function renderActivityNotice() {
    const el = $('#lgActivityNotice');
    if (!state.signedIn) { el.hidden = true; el.innerHTML = ''; return; }
    const unread = Number(state.unreadMessages || 0);
    const newApps = state.ownListings.some(r => r.status === 'approved') ? Number(state.newApplications || 0) : 0;
    const items = [];
    if (unread > 0 && state.tab !== 'inbox') items.push('<button type="button" class="lg-activity-item" data-goto="inbox"><span class="lg-activity-count">' + fmt(unread) + '</span><span><b>' + (unread === 1 ? '1 unread message' : fmt(unread) + ' unread messages') + '</b><small>Open Inbox</small></span>' + ICON.arrow + '</button>');
    if (newApps > 0 && state.tab !== 'owner') items.push('<button type="button" class="lg-activity-item hot" data-goto="owner"><span class="lg-activity-count">' + fmt(newApps) + '</span><span><b>' + (newApps === 1 ? '1 new application' : fmt(newApps) + ' new applications') + '</b><small>Review them now</small></span>' + ICON.arrow + '</button>');
    el.innerHTML = items.join(''); el.hidden = !items.length;
  }

  // inbox safety notice is shown once, before the first use
  const inboxPolicyAccepted = () => store.get('lg-inbox-policy-v1') === 'accepted';
  function requestInboxAccess(onContinue) {
    if (!state.signedIn) { location.href = signInUrl('/leagues/?tab=inbox'); return; }
    if (inboxPolicyAccepted()) { onContinue?.(); return; }
    const sheet = openSheet(
      '<div class="lg-inbox-policy-icon" aria-hidden="true">' + ICON.shield + '</div><h3>Before you use Inbox</h3>' +
      '<p class="lg-sub">Inbox is for respectful, on-topic communication about FC Mobile league applications.</p>' +
      '<div class="lg-inbox-policy-list">' +
        '<p><b>Admins can read messages.</b> FCMOBILETOOLS moderators may review Inbox conversations and take action on misuse.</p>' +
        '<p><b>Do not share sensitive information.</b> Never send passwords, one-time or recovery codes, payment details, private account credentials or another player’s personal information.</p>' +
        '<p><b>Stay on topic.</b> Spam, harassment, scams and unrelated messages can result in Inbox suspension.</p>' +
        '<p><b>Messages expire.</b> Inbox messages are automatically deleted after 7 days.</p></div>' +
      '<div class="lg-modal-actions"><button class="lg-btn lg-btn-quiet" type="button" data-sheet-close>Not now</button><button class="lg-btn lg-btn-primary" type="button" data-inbox-policy-continue>I understand · Continue</button></div>', { label: 'Inbox safety notice', wide: true });
    $('[data-inbox-policy-continue]', sheet.el).addEventListener('click', () => { store.set('lg-inbox-policy-v1', 'accepted'); sheet.close(); onContinue?.(); });
  }
  function setTab(id) { if (id === 'inbox') { requestInboxAccess(() => activateTab('inbox')); return; } activateTab(id); }
  function activateTab(id) {
    state.tab = id; renderTabs();
    if (id === 'leagues') renderLeagues(); if (id === 'saved') renderSaved(); if (id === 'apps') renderApps();
    if (id === 'inbox') { renderInbox(); loadInbox(); if (state.activeConversationId) loadInboxMessages(); }
    if (id === 'owner') renderOwner(); if (id === 'players') renderPlayersShell();
    const u = new URL(location.href); id === 'leagues' ? u.searchParams.delete('tab') : u.searchParams.set('tab', id); history.replaceState(null, '', u);
    if (id !== 'leagues') $('#lgTabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    reveal();
  }

  // ───────────── discover ─────────────
  function renderTiers() {
    const counts = {}; for (const r of state.leagues) counts[r.division] = (counts[r.division] || 0) + 1;
    $('#lgTiers').innerHTML = '<button type="button" class="lg-tier' + (state.filters.division ? '' : ' on') + '" data-div=""><span class="lg-tier-all">' + ICON.grid + '</span><span><b>All</b><small>Every division</small></span><em>' + state.leagues.length + '</em></button>' +
      DIVISIONS.map(d => '<button type="button" class="lg-tier t-' + d.key + (state.filters.division === d.key ? ' on' : '') + '" data-div="' + d.key + '"><img src="' + divisionIcon(d.key) + '" alt="" width="30" height="30"><span><b>' + esc(d.label) + '</b><small>' + divisionRange(d) + '</small></span><em>' + (counts[d.key] || 0) + '</em></button>').join('');
  }
  function renderChips() {
    const f = state.filters, chips = [];
    if (f.q) chips.push(['q', '“' + f.q + '”']);
    if (f.division) chips.push(['division', DIVISIONS.find(d => d.key === f.division)?.label || f.division]);
    if (f.region) chips.push(['region', f.region]);
    if (f.ovr) chips.push(['ovr', 'OVR ' + f.ovr]);
    if (f.spots) chips.push(['spots', 'Open spots']);
    if (f.verified) chips.push(['verified', 'Verified']);
    if (f.freq) chips.push(['freq', FREQ[f.freq]]);
    if (f.size) chips.push(['size', f.size]);
    if (f.lang) chips.push(['lang', f.lang]);
    if (f.commit) chips.push(['commit', COMMIT[f.commit]]);
    if (f.join) chips.push(['join', JOIN_METHODS[f.join]]);
    $('#lgChips').innerHTML = chips.map(([k, l]) => '<button type="button" class="lg-fchip" data-unfilter="' + k + '">' + esc(l) + ICON.close + '</button>').join('');
    $('#lgClear').hidden = chips.length < 2;
    const n = moreCount(), badge = $('#fCount'); badge.hidden = n === 0; badge.textContent = n;
  }
  function renderForYou() {
    const el = $('#lgForYou');
    const picks = state.profile && !Object.values(state.filters).some(Boolean) ? rankLeagues(state.leagues, state.profile, { limit: 3 }) : [];
    el.hidden = !picks.length;
    if (!picks.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="lg-rail-head"><div><span class="lg-eyebrow"><i></i>PICKED FOR YOU</span><h2>Best fits for ' + esc(state.profile.in_game_username) + '</h2></div><button type="button" class="lg-info" data-info="fit" aria-label="How fit works">i</button></div>' +
      '<div class="lg-rail">' + picks.map(({ league, fit }, i) => leagueCard(decorate(league), { index: i, match: fit, showSave: true })).join('') + '</div>';
  }
  function renderSpotlight() {
    const rows = state.spotlight.map(id => state.leagues.find(l => l.id === id)).filter(Boolean);
    const sec = $('#lgSpot'); sec.hidden = !rows.length || Object.values(state.filters).some(Boolean);
    $('#lgRail').innerHTML = rows.map((r, i) => spotCard(r, { index: i })).join('');
  }
  function renderLeagues() {
    const rows = visible();
    $('#lgGrid').innerHTML = rows.map((r, i) => leagueCard(r, { index: i, match: r._m, showSave: true })).join('');
    $('#lgGrid').hidden = !rows.length; $('#lgEmpty').hidden = rows.length > 0;
    const filtering = Object.values(state.filters).some(Boolean);
    $('#lgResults').innerHTML = '<b>' + rows.length + '</b> ' + (rows.length === 1 ? 'league' : 'leagues') + (filtering ? ' match' : ' recruiting');
    const o = state.filters.ovr;
    $('#lgOvrNote').hidden = !o; if (o) $('#lgOvrNote').textContent = 'Showing leagues you qualify for with ' + o + ' OVR.';
    $('#fUseMine').hidden = !(state.profile && state.filters.ovr !== Number(state.profile.ovr));
    if (!rows.length) {
      const none = !state.leagues.length;
      $('#lgEmptyTitle').textContent = none ? 'No leagues listed yet' : 'No leagues match these filters';
      $('#lgEmptyText').textContent = none ? 'Be the first. List your league in under a minute.' : (o ? 'Try a lower OVR, a different division, or turn off open spots only.' : 'Loosen a filter or clear them all.');
      $('#lgEmptyReset').hidden = none;
    }
    renderTiers(); renderChips(); renderForYou(); renderSpotlight(); renderCompareTray(); filtersToUrl(); reveal();
  }
  const refresh = () => { renderHero(); renderTabs(); setSortOptions(); syncControls(); renderLeagues(); if (state.tab === 'saved') renderSaved(); if (state.tab === 'apps') renderApps(); if (state.tab === 'owner') renderOwner(); };

  // compare up to three leagues side by side
  function toggleCompare(id) {
    const i = state.compare.indexOf(id);
    if (i >= 0) state.compare.splice(i, 1); else if (state.compare.length >= 3) { toast('Compare up to 3 leagues at a time.', true); return; } else state.compare.push(id);
    $$('[data-compare="' + id + '"]').forEach(b => { b.classList.toggle('on', state.compare.includes(id)); b.setAttribute('aria-pressed', String(state.compare.includes(id))); });
    renderCompareTray();
  }
  function renderCompareTray() {
    let tray = $('#lgCompareTray');
    if (!tray) { tray = document.createElement('div'); tray.id = 'lgCompareTray'; tray.className = 'lg-tray'; document.body.appendChild(tray); }
    const rows = state.compare.map(id => state.leagues.find(l => l.id === id)).filter(Boolean);
    tray.classList.toggle('on', rows.length > 0);
    tray.innerHTML = rows.length ? '<div class="lg-tray-in"><div class="lg-tray-items">' + rows.map(r => '<span class="lg-tray-chip">' + crest(r.logoUrl, r.name, 'lg-crest xs') + esc(r.name) + '<button type="button" data-compare="' + esc(r.id) + '" aria-label="Remove ' + esc(r.name) + '">' + ICON.close + '</button></span>').join('') + '</div>' +
      '<button type="button" class="lg-btn lg-btn-primary lg-btn-sm" data-open-compare' + (rows.length < 2 ? ' disabled' : '') + '>' + (rows.length < 2 ? 'Pick one more' : 'Compare ' + rows.length) + '</button></div>' : '';
  }
  function openCompare() {
    const rows = state.compare.map(id => state.leagues.find(l => l.id === id)).filter(Boolean).map(decorate);
    if (rows.length < 2) return;
    const best = (fn, dir) => { const v = rows.map(fn); const t = dir === 'min' ? Math.min(...v) : Math.max(...v); return v.map(x => x === t && v.filter(y => y === t).length < v.length); };
    const row = (label, cells, hi) => '<tr><th scope="row">' + label + '</th>' + cells.map((c, i) => '<td' + (hi?.[i] ? ' class="best"' : '') + '>' + c + '</td>').join('') + '</tr>';
    const s = openSheet('<div class="lg-sheet-head"><span class="lg-eyebrow"><i></i>COMPARE</span><h3>Side by side</h3></div><div class="lg-cmp-wrap"><table class="lg-cmp"><thead><tr><td></td>' +
      rows.map(r => '<th scope="col">' + crest(r.logoUrl, r.name, 'lg-crest sm') + '<a href="' + leagueHref(r) + '">' + esc(r.name) + '</a>' + (r._m ? ring(r._m) : '') + '</th>').join('') + '</tr></thead><tbody>' +
      row('Division', rows.map(r => r.division ? divisionBadge(r.division) : '—')) +
      row('Region', rows.map(r => esc(r.regionServer))) +
      row('Minimum OVR', rows.map(r => fmt(r.minOvr) + '+'), best(r => r.minOvr, 'min')) +
      row('Open spots', rows.map(r => r.openSpots > 0 ? fmt(r.openSpots) : 'Full'), best(r => r.openSpots, 'max')) +
      row('Schedule', rows.map(r => esc(FREQ[r.tournamentFrequency] || '—') + '<small>' + esc((r.tournamentSizes || []).join(' / ')) + '</small>')) +
      row('Style', rows.map(r => esc(COMMIT[r.playerCommitment] || '—'))) +
      row('Languages', rows.map(r => esc((r.preferredLanguages || []).join(', ') || '—'))) +
      row('Activity', rows.map(r => r.confirmations7d > 0 ? r.confirmations7d + ' confirmed this week' : 'No recent confirmations'), best(r => r.confirmations7d || 0, 'max')) +
      row('How to join', rows.map(r => (r.joinMethods || []).map(m => esc(JOIN_METHODS[m] || m)).join(', '))) +
      '<tr><th></th>' + rows.map(r => '<td><a class="lg-btn lg-btn-primary lg-btn-sm" href="' + leagueHref(r) + '">View league</a></td>').join('') + '</tr></tbody></table></div>', { wide: true, label: 'Compare leagues', className: 'lg-wide-xl' });
    return s;
  }

  // ───────────── saved + applications ─────────────
  function renderSaved() {
    const rows = state.leagues.map(decorate).filter(r => r.saved).sort(SORTERS.match);
    $('#panelSaved').innerHTML = '<div class="lg-panel-head"><div><h2>Saved leagues</h2><p>Up to 3 bookmarks. They stay here while the listing is live. ' + infoBtn('saved') + '</p></div><span class="lg-meter-pill">' + rows.length + ' / 3</span></div>' +
      (rows.length ? '<div class="lg-grid">' + rows.map((r, i) => leagueCard(r, { index: i, match: r._m, showSave: true })).join('') + '</div>'
        : empty('Nothing saved yet', 'Tap the heart on a league to keep it here.', '<button class="lg-btn lg-btn-primary" data-goto="leagues" type="button">Browse leagues</button>'));
    reveal($('#panelSaved'));
  }
  function appCard(a) {
    const l = state.leagues.find(x => x.id === a.listingId), p = pipeline(a.status), nudge = applicationNudge(a);
    const steps = p.closed ? '<div class="lg-closed ' + a.status + '">' + esc(APP_LABEL[a.status]) + '</div>' :
      '<ol class="lg-track">' + p.steps.map(s => '<li class="' + s.state + '"><i>' + (s.state === 'done' ? ICON.check : '') + '</i><span>' + s.label + '</span></li>').join('') + '</ol>';
    const similar = a.status === 'declined' && l ? similarLeagues(l, state.leagues, 2) : [];
    return '<article class="lg-app" data-reveal><div class="lg-app-head">' + crest(l?.logoUrl, l?.name, 'lg-crest sm') + '<div class="lg-app-id"><b>' + (l ? '<a href="' + leagueHref(l) + '">' + esc(l.name) + '</a>' : 'League') + '</b><small>Applied ' + esc(timeAgo(a.createdAt) || 'recently') + (l ? ' · ' + esc(l.regionServer) : '') + '</small></div></div>' + steps +
      '<p class="lg-app-hint ' + (a.status === 'invited' ? 'hot' : '') + '">' + ICON.spark + esc(p.hint) + '</p>' +
      (nudge ? '<p class="lg-nudge ' + nudge.tone + '">' + esc(nudge.text) + '</p>' : '') +
      (similar.length ? '<div class="lg-similar-mini"><span class="lg-k">Try instead</span>' + similar.map(s => '<a href="' + leagueHref(s) + '">' + crest(s.logoUrl, s.name, 'lg-crest xs') + esc(s.name) + '</a>').join('') + '</div>' : '') +
      '<div class="lg-app-actions"><button class="lg-btn lg-btn-glass lg-btn-sm" data-message-listing="' + esc(a.listingId) + '" type="button">' + ICON.chat + 'Message league</button>' +
      (['new', 'shortlisted'].includes(a.status) ? '<button class="lg-btn lg-btn-quiet lg-btn-sm" data-withdraw="' + esc(a.id) + '" type="button">Withdraw</button>' : '') + '</div></article>';
  }
  function renderApps() {
    const rows = state.myApplications.filter(a => a.status !== 'withdrawn');
    const open = rows.filter(a => ['new', 'shortlisted', 'invited'].includes(a.status)).length;
    $('#panelApps').innerHTML = '<div class="lg-panel-head"><div><h2>My applications</h2><p>Follow each one from sent to joined.</p></div><span class="lg-meter-pill">' + open + ' open</span></div>' +
      (rows.length ? '<div class="lg-app-list">' + rows.map(appCard).join('') + '</div>' : empty('No applications yet', 'Open a league you like and tap Apply. It takes under a minute.', '<button class="lg-btn lg-btn-primary" data-goto="leagues" type="button">Find a league</button>'));
    reveal($('#panelApps'));
  }

  // ───────────── inbox ─────────────
  function renderInbox(suspended) {
    const el = $('#panelInbox');
    const unread = state.inboxThreads.reduce((n, t) => n + Number(t.unreadCount || 0), 0);
    const notices = [];
    for (const l of state.ownListings.filter(r => ['rejected', 'paused'].includes(r.status))) notices.push({ tone: 'bad', title: l.status === 'paused' ? 'League suspended' : 'League listing rejected', body: l.moderationNote || (l.status === 'paused' ? 'Review the moderation note and appeal if you believe this is a mistake.' : 'Edit your listing to address the rejection, then republish it.'), action: l.status === 'paused' ? '<button class="lg-btn lg-btn-glass lg-btn-sm" type="button" data-appeal-listing="' + esc(l.id) + '">Appeal</button>' : '<button class="lg-btn lg-btn-glass lg-btn-sm" type="button" data-goto="owner">Review</button>' });
    for (const a of state.myApplications.filter(r => ['declined', 'invited', 'joined'].includes(r.status))) {
      const l = state.leagues.find(r => r.id === a.listingId);
      notices.push({ tone: a.status === 'declined' ? 'mute' : 'good', title: a.status === 'declined' ? 'Application declined' : a.status === 'invited' ? 'League invitation' : 'You joined a league', body: (l?.name || 'A league') + (a.status === 'declined' ? ' declined your application.' : a.status === 'invited' ? ' invited you. Check FC Mobile for the in-game invite.' : ' marked your application as joined.'), action: l ? '<a class="lg-btn lg-btn-glass lg-btn-sm" href="' + leagueHref(l) + '">View league</a>' : '' });
    }
    const active = state.inboxThreads.find(t => t.id === state.activeConversationId);
    const mine = active && state.ownListings.some(o => o.id === active.listingId || o.name === active.listingName);
    const replies = mine ? OWNER_REPLIES : PLAYER_REPLIES;
    const threads = suspended ? '<div class="lg-empty"><h3>Inbox access suspended</h3><p>' + esc(suspended.message) + '</p>' + (suspended.body?.suspendedUntil ? '<p>Available again: ' + esc(when(suspended.body.suspendedUntil)) + '</p>' : '') + '</div>'
      : state.inboxThreads.length ? state.inboxThreads.map(t => '<button class="lg-thread' + (t.id === state.activeConversationId ? ' active' : '') + '" type="button" data-inbox-thread="' + esc(t.id) + '">' + crest(t.logoUrl, t.listingName, 'lg-crest sm') + '<span class="lg-thread-copy"><b>' + esc(t.listingName || 'League') + '</b><small>' + esc(t.participantName || 'Conversation') + '</small><span>' + esc(t.lastMessage || 'No messages yet') + '</span></span>' + (Number(t.unreadCount) > 0 ? '<i class="lg-unread">' + fmt(t.unreadCount) + '</i>' : '') + '</button>').join('')
      : empty('No conversations yet', 'Message a league from My applications, or reply to players from My league.');
    el.innerHTML = '<div class="lg-panel-head"><div><h2>Inbox ' + infoBtn('inbox') + '</h2><p>Conversations about league applications.' + (unread ? ' <b>' + unread + ' unread.</b>' : '') + '</p></div><button class="lg-btn lg-btn-glass lg-btn-sm" id="lgInboxRefresh" type="button">Refresh</button></div>' +
      (notices.length ? '<div class="lg-notices">' + notices.slice(0, 4).map(n => '<article class="lg-notice ' + n.tone + '"><div><b>' + esc(n.title) + '</b><p>' + esc(n.body) + '</p></div>' + n.action + '</article>').join('') + '</div>' : '') +
      '<div class="lg-inbox' + (active ? ' chat-open' : '') + '"><aside class="lg-threads" aria-label="Conversations">' + threads + '</aside><section class="lg-chat" aria-live="polite">' +
      (active ? '<header class="lg-chat-head"><button type="button" class="lg-icon-btn lg-chat-back" data-chat-back aria-label="Back to conversations">' + ICON.arrow + '</button>' + crest(active.logoUrl, active.listingName, 'lg-crest sm') + '<div><b>' + esc(active.listingName) + '</b><small>' + esc(active.participantName) + '</small></div></header>' +
        '<div class="lg-msgs" id="lgMsgs">' + (state.inboxMessages.length ? state.inboxMessages.map(m => { const me = m.senderAccountId === state.account?.id; return '<div class="lg-bubble' + (me ? ' mine' : '') + '"><p>' + esc(m.body || '') + '</p><time>' + esc(me ? 'You' : m.senderName || active.participantName || 'Member') + ' · ' + esc(when(m.createdAt)) + '</time></div>'; }).join('') : '<p class="lg-chat-empty">No messages yet. Say hello.</p>') + '</div>' +
        '<div class="lg-quick">' + replies.map(r => '<button type="button" data-quick="' + esc(r) + '">' + esc(r.length > 44 ? r.slice(0, 43) + '…' : r) + '</button>').join('') + '</div>' +
        '<form class="lg-composer" id="lgInboxForm"><textarea id="lgInboxInput" rows="1" maxlength="500" placeholder="Write a message…" required></textarea><button class="lg-btn lg-btn-primary lg-btn-sm" id="lgInboxSend" type="submit">Send</button></form>'
        : '<div class="lg-chat-idle">' + ICON.chat + '<b>Choose a conversation</b><small>Your messages stay inside FCMobiletools and are deleted after 7 days.</small></div>') + '</section></div>';
    const box = $('#lgMsgs'); if (box) box.scrollTop = box.scrollHeight;
    renderActivityNotice();
  }
  async function loadNotificationCount() {
    if (!state.signedIn) return;
    try { const r = await api('/api/leagues/notifications'); state.unreadMessages = Math.max(0, Number(r.unreadMessages || 0)); renderTabs(); } catch { /* the count is a nicety */ }
  }
  async function loadInbox({ silent = false } = {}) {
    if (!state.signedIn || state.inboxLoading) return;
    state.inboxLoading = true;
    try {
      const res = await api('/api/leagues/inbox');
      state.inboxThreads = res.conversations || [];
      state.unreadMessages = state.inboxThreads.reduce((n, t) => n + Number(t.unreadCount || 0), 0);
      if (state.activeConversationId && !state.inboxThreads.some(t => t.id === state.activeConversationId)) { state.activeConversationId = null; state.inboxMessages = []; }
      renderTabs(); if (state.tab === 'inbox') renderInbox();
    } catch (e) {
      if (e.body?.inboxSuspended) { inboxSuspended(e); return; }
      if (!silent) toast(e.message || 'Inbox could not be loaded.', true);
    } finally { state.inboxLoading = false; }
  }
  async function loadInboxMessages() {
    if (!state.activeConversationId) { renderInbox(); return; }
    try {
      const res = await api('/api/leagues/inbox/' + encodeURIComponent(state.activeConversationId) + '/messages');
      state.inboxMessages = res.messages || [];
      await loadInbox({ silent: true }); renderInbox();
    } catch (e) { if (e.body?.inboxSuspended) { inboxSuspended(e); return; } toast(e.message || 'Messages could not be loaded.', true); }
  }
  async function openInboxForListing(listingId, applicantId = '') {
    if (!state.signedIn) { location.href = signInUrl('/leagues/?tab=inbox'); return; }
    try {
      const res = await api('/api/leagues/listings/' + encodeURIComponent(listingId) + '/inbox', { method: 'POST', body: JSON.stringify(applicantId ? { applicantId } : {}) });
      state.activeConversationId = res.conversationId; state.inboxMessages = [];
      await loadInbox({ silent: true }); setTab('inbox'); await loadInboxMessages();
    } catch (e) { if (e.body?.inboxSuspended) { state.tab = 'inbox'; inboxSuspended(e); return; } toast(e.message || 'Conversation could not be opened.', true); }
  }
  async function sendInboxMessage(event) {
    event.preventDefault();
    const input = $('#lgInboxInput'), btn = $('#lgInboxSend'), body = input.value.trim();
    if (!state.activeConversationId || !body) return;
    btn.disabled = true;
    try { await api('/api/leagues/inbox/' + encodeURIComponent(state.activeConversationId) + '/messages', { method: 'POST', body: JSON.stringify({ body }) }); input.value = ''; await loadInboxMessages(); }
    catch (e) { if (e.body?.inboxSuspended) { inboxSuspended(e); return; } toast(e.message || 'Message could not be sent.', true); btn.disabled = false; }
  }

  // ───────────── command palette (Ctrl/⌘ K) ─────────────
  function openPalette() {
    const nav = [
      { t: 'Discover leagues', s: 'Browse the board', k: 'leagues', i: 'search' },
      ...(state.signedIn ? [{ t: 'My applications', s: 'Track where you applied', k: 'apps', i: 'bolt' }, { t: 'Saved leagues', s: 'Your bookmarks', k: 'saved', i: 'heart' }, { t: own() ? 'My league (Club HQ)' : 'List your league', s: own() ? 'Applications, Kickoff and settings' : 'Takes under a minute', k: 'owner', i: 'crown' }, { t: 'Edit my player card', s: 'OVR, region and privacy', k: '#card', i: 'shield' }] : []),
      { t: 'Inbox', s: 'Messages about applications', k: 'inbox', i: 'inbox' }
    ];
    const s = openSheet('<div class="lg-pal"><label class="lg-pal-in">' + ICON.search + '<input id="lgPalQ" autocomplete="off" placeholder="Jump to a league or action…" autofocus><kbd>esc</kbd></label><div class="lg-pal-list" id="lgPalList" role="listbox"></div></div>', { label: 'Quick search', className: 'lg-pal-card' });
    let idx = 0, items = [];
    const draw = () => {
      const q = $('#lgPalQ', s.el).value.trim().toLowerCase();
      const a = nav.filter(n => !q || n.t.toLowerCase().includes(q)).map(n => ({ ...n, kind: 'Go to' }));
      const b = q ? state.leagues.filter(l => [l.name, l.regionServer, l.tagline].join(' ').toLowerCase().includes(q)).slice(0, 6).map(l => ({ t: l.name, s: (l.regionServer || '') + ' · ' + l.openSpots + ' open · ' + l.minOvr + '+ OVR', href: leagueHref(l), i: 'trophy', kind: 'League', logo: l })) : [];
      items = [...a, ...b]; idx = Math.min(idx, Math.max(0, items.length - 1));
      $('#lgPalList', s.el).innerHTML = items.length ? items.map((n, j) => '<button type="button" role="option" class="' + (j === idx ? 'on' : '') + '" data-pi="' + j + '">' + (n.logo ? crest(n.logo.logoUrl, n.logo.name, 'lg-crest xs') : '<span class="lg-pal-ico">' + ICON[n.i] + '</span>') + '<span><b>' + esc(n.t) + '</b><small>' + esc(n.s) + '</small></span><em>' + n.kind + '</em></button>').join('') : '<p class="lg-pal-none">No matches. Try a league name.</p>';
    };
    const run = (n) => { if (!n) return; s.close(); if (n.href) location.assign(n.href); else if (n.k === '#card') openProfileSheet({ profile: state.profile, suggested: state.suggested }).then(p => { if (p) { state.profile = p; refresh(); } }); else setTab(n.k); };
    s.el.addEventListener('input', draw);
    s.el.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); draw(); $('.on', s.el)?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); $('.on', s.el)?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); run(items[idx]); }
    });
    s.el.addEventListener('click', e => { const b = e.target.closest('[data-pi]'); if (b) run(items[Number(b.dataset.pi)]); });
    draw();
  }

  // ───────────── Club HQ (owner) ─────────────
  const pill = (status, o) => {
    const m = { approved: o?.recruitingOpen ? ['Live', 'live'] : ['Hidden', 'hidden'], pending: ['Pending review', 'pending'], rejected: ['Rejected', 'bad'], paused: ['Suspended', 'bad'] }[status] || ['Not public', 'pending'];
    return '<span class="lg-status ' + m[1] + '">' + m[0] + '</span>';
  };
  function shareText(o) {
    const d = DIVISIONS.find(x => x.key === o.division)?.label || '';
    return o.name + ' is recruiting on FC Mobile.\n' + [d, o.minOvr + '+ OVR', o.openSpots + ' open ' + (o.openSpots === 1 ? 'spot' : 'spots'), FREQ[o.tournamentFrequency]].filter(Boolean).join(' · ') + '\nApply here: ' + location.origin + leagueHref(o);
  }
  function openShareKit(o) {
    const text = shareText(o);
    const s = openSheet('<div class="lg-sheet-head"><span class="lg-eyebrow"><i></i>SHARE KIT</span><h3>Get more applicants</h3><p class="lg-sub">Paste this into Discord, WhatsApp or Facebook groups.</p></div><pre class="lg-sharebox" id="lgShareText"></pre>' +
      '<div class="lg-modal-actions"><button class="lg-btn lg-btn-quiet" type="button" data-sheet-close>Close</button>' + (navigator.share ? '<button class="lg-btn lg-btn-glass" type="button" id="lgShareNative">' + ICON.share + 'Share…</button>' : '') + '<button class="lg-btn lg-btn-primary" type="button" id="lgShareCopy">' + ICON.copy + 'Copy message</button></div>', { label: 'Share your league' });
    $('#lgShareText', s.el).textContent = text;
    $('#lgShareCopy', s.el).addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); toast('Message copied.'); } catch { toast('Copy failed.', true); } });
    $('#lgShareNative', s.el)?.addEventListener('click', () => navigator.share({ title: o.name, text, url: location.origin + leagueHref(o) }).catch(() => {}));
  }

  function renderOwner() {
    const el = $('#panelOwner'), o = own();
    if (!o) {
      const crewKick = state.myCrew?.status === 'approved' ? state.leagues.find(l => l.id === state.myCrew.listingId) : null;
      el.innerHTML = '<div class="lg-onboard"><div class="lg-onboard-copy"><span class="lg-eyebrow"><i></i>FOR LEAGUE OWNERS</span><h2>Put your league on the board</h2><p>Division, minimum OVR, open spots, schedule and how to join. That is all players need. Free, live at once, and you can edit it any time.</p>' +
        '<div class="lg-hero-cta"><button class="lg-btn lg-btn-primary lg-btn-lg" data-create-listing type="button">List my league ' + ICON.arrow + '</button><button class="lg-btn lg-btn-quiet" type="button" data-info="listing">How listing works</button></div></div>' +
        '<ul class="lg-onboard-list"><li>' + ICON.users + '<b>Smart applications</b><span>Applicants arrive ranked by fit, with their team screenshot.</span></li><li>' + ICON.bolt + '<b>Kickoff</b><span>Jump to the top of the board for 6 hours.</span></li><li>' + ICON.shield + '<b>Club HQ</b><span>One place for applications, Leaguemates and listing health.</span></li></ul></div>' +
        (crewKick ? '<div class="lg-box lg-crewkick"><div><b>You are a Kickoff Leaguemate</b><small>' + esc(crewKick.name) + '</small></div>' + crewKickBtn(crewKick) + '</div>' : '');
      return;
    }
    const live = o.status === 'approved';
    const apps = state.ownerApps || [];
    const newApps = apps.length ? apps.filter(a => a.status === 'new').length : Number(state.newApplications || 0);
    const pendingCrew = state.ownerCrew.filter(m => m.status === 'pending').length;
    const health = listingHealth(o, { galleryReady: state.galleryReady });
    const todo = ownerActions({ own: o, newApps, pendingCrew, galleryReady: state.galleryReady });
    const kick = kickoffState(o), ex = listingExpiry(o);
    const nextAt = kick.nextAt;
    const note = !live ? '<div class="lg-callout red"><strong>' + (o.status === 'paused' ? 'League suspended' : o.status === 'rejected' ? 'Listing rejected' : o.status === 'pending' ? 'Pending review' : 'Hidden from the public board') + '</strong>' + esc(o.moderationNote || (o.status === 'rejected' ? 'You can edit the listing and publish it again.' : 'Review the note and contact support if you think this is a mistake.')) +
      (o.status === 'paused' ? (o.appealStatus === 'open' ? '<p>Your suspension appeal is waiting for review.</p>' : '<div class="lg-actions"><button class="lg-btn lg-btn-glass lg-btn-sm" type="button" data-appeal-listing="' + esc(o.id) + '">Appeal suspension</button></div>') : '') + (o.appealStatus === 'denied' ? '<p>Your previous appeal was declined.</p>' : '') + '</div>' : '';
    el.innerHTML = '<div class="lg-hq">' +
      '<header class="lg-hq-head">' + crest(o.logoUrl, o.name, 'lg-crest xl') + '<div class="lg-hq-id"><span class="lg-eyebrow"><i></i>CLUB HQ</span><h2>' + esc(o.name) + '</h2><div class="lg-hq-badges">' + pill(o.status, o) + trustBadge(o) + '</div></div>' +
      '<div class="lg-hq-btns"><a class="lg-btn lg-btn-glass" href="' + leagueHref(o) + '">' + ICON.eye + 'View page</a><button class="lg-btn lg-btn-glass" data-share-kit type="button">' + ICON.share + 'Share kit</button><button class="lg-btn lg-btn-primary" data-edit-listing type="button">' + (o.status === 'rejected' ? 'Edit & republish' : 'Edit listing') + '</button></div></header>' + note +
      '<div class="lg-hq-grid"><section class="lg-box lg-todo"><div class="lg-box-head"><h3>Action center</h3><span class="lg-meter-pill">' + todo.filter(t => t.tone !== 'tip').length + ' to do</span></div>' +
        (todo.length ? '<ul>' + todo.map((t, i) => '<li class="' + t.tone + '" style="--i:' + i + '"><span class="lg-todo-dot"></span><div><b>' + esc(t.title) + '</b><small>' + esc(t.text) + '</small></div>' + (t.cta ? '<button type="button" class="lg-btn ' + (t.tone === 'hot' || t.tone === 'good' ? 'lg-btn-primary' : 'lg-btn-glass') + ' lg-btn-sm" data-hq-act="' + t.act + '"' + (t.act ? '' : ' disabled') + '>' + esc(t.cta) + '</button>' : '') + '</li>').join('') + '</ul>' : '<p class="lg-note-line">All caught up. Nothing needs you right now.</p>') + '</section>' +
        '<section class="lg-box lg-health"><div class="lg-box-head"><h3>Listing health</h3></div><div class="lg-health-body"><div class="lg-ring big ' + (health.score >= 85 ? 'great' : health.score >= 65 ? 'good' : 'low') + '" style="--p:' + health.score + '"><b>' + health.score + '</b><small>/ 100</small></div><div><b>' + health.grade + '</b><small>' + (health.tips.length ? 'Next: ' + esc(health.tips[0].text.toLowerCase()) : 'Players see a complete, trustworthy listing.') + '</small></div></div>' +
        (health.tips.length ? '<ul class="lg-health-tips">' + health.tips.slice(0, 3).map(t => '<li>' + ICON.plus + esc(t.text) + '</li>').join('') + '</ul>' : '') + '</section></div>' +
      '<div class="lg-kpis" id="lgKpis">' +
        '<div class="lg-kpi"><span class="lg-k">Open spots ' + infoBtn('spots') + '</span><div class="lg-stepper"><button class="lg-icon-btn" data-spots="-1" type="button" aria-label="Fewer spots">−</button><output>' + o.openSpots + '</output><button class="lg-icon-btn" data-spots="1" type="button" aria-label="More spots">+</button></div></div>' +
        '<div class="lg-kpi"><span class="lg-k">Recruiting</span><div class="lg-kpi-row"><b>' + (o.recruitingOpen ? 'Open to applicants' : 'Hidden from the board') + '</b><button class="lg-toggle" id="lgRecruitToggle" type="button" role="switch" aria-checked="' + o.recruitingOpen + '" aria-label="Open for new members"></button></div></div>' +
        (live ? '<div class="lg-kpi kick"><span class="lg-k">Kickoff ' + infoBtn('kickoff') + '</span><div class="lg-kpi-row"><b>' + (nextAt ? 'Ready in <span data-until="' + nextAt + '">' + clock(nextAt - Date.now()) + '</span>' : 'Ready to go') + '</b><button class="lg-btn lg-btn-primary lg-btn-sm" data-kick="' + esc(o.id) + '" type="button"' + (nextAt || !o.recruitingOpen ? ' disabled' : '') + '>' + ICON.bolt + 'Kickoff</button></div></div>' : '') +
        '<div class="lg-kpi"><span class="lg-k">Listing timer</span><div class="lg-timer ' + (ex.soon ? 'warn' : '') + '"><i style="width:' + ex.pct + '%"></i></div><small>' + ex.daysLeft + ' days left · Kickoff resets it to 30</small></div></div>' +
      '<div class="lg-subtabs" role="tablist"><button type="button" data-hq="apps" class="' + (state.hqTab === 'apps' ? 'on' : '') + '">Applications' + (apps.length ? '<em>' + apps.length + '</em>' : '') + '</button><button type="button" data-hq="crew" class="' + (state.hqTab === 'crew' ? 'on' : '') + '">Leaguemates' + (pendingCrew ? '<b class="lg-dot">' + pendingCrew + '</b>' : '') + '</button><button type="button" data-hq="listing" class="' + (state.hqTab === 'listing' ? 'on' : '') + '">Listing</button></div>' +
      '<div id="lgHqPane"></div></div>';
    renderHqPane();
    if (live && state.ownerApps === null) loadOwnerApps();
  }
  function crewKickBtn(r) {
    const n = r.lastKickoffAt ? ts(r.lastKickoffAt) + KICKOFF_COOLDOWN_MS : 0, cool = n > Date.now() ? n : 0;
    return '<button class="lg-btn lg-btn-primary lg-btn-sm" type="button" data-kick="' + esc(r.id) + '"' + (cool ? ' disabled' : '') + '>' + (cool ? 'Kickoff in ' + clock(cool - Date.now()) : ICON.bolt + 'Kickoff') + '</button>';
  }
  function renderHqPane() {
    const box = $('#lgHqPane'); if (!box) return; const o = own(); if (!o) return;
    if (state.hqTab === 'apps') return renderHqApps(box, o);
    if (state.hqTab === 'crew') return renderHqCrew(box, o);
    const gal = (o.galleryUrls || []);
    box.innerHTML = '<div class="lg-hq-listing"><div><div class="lg-preview-label">How players see you</div>' + leagueCard({ ...o, isMine: true, saved: false }, { preview: true }) + '</div><div class="lg-box"><h3>League screenshots</h3>' +
      (state.galleryReady ? (gal.length ? '<div class="lg-thumbs">' + gal.map((u, i) => '<button type="button" data-lb-gallery="' + i + '"><img src="' + esc(u) + '" alt="League screenshot ' + (i + 1) + '" loading="lazy" referrerpolicy="no-referrer"></button>').join('') + '</div>' : '<p class="lg-note-line">No screenshots yet. A league table or tournament result builds trust fast.</p>') + '<div class="lg-actions"><button class="lg-btn lg-btn-glass lg-btn-sm" data-edit-listing type="button">' + ICON.image + 'Manage screenshots</button></div>' : '<p class="lg-note-line">League screenshots arrive once the latest database update is applied.</p>') + '</div></div>';
    reveal(box);
  }
  function renderHqCrew(box, o) {
    if (!state.crewReady) { box.innerHTML = '<div class="lg-box"><p class="lg-note-line">Leaguemates are not available yet.</p></div>'; return; }
    const pending = state.ownerCrew.filter(m => m.status === 'pending'), members = state.ownerCrew.filter(m => m.status === 'approved');
    const row = (m, btns) => '<div class="lg-crew-row">' + crest(m.avatarUrl, m.displayName, 'lg-crest sm') + '<div class="lg-crew-id"><b>' + esc(m.inGameUsername || m.displayName) + '</b><small>' + (m.ovr ? 'OVR ' + fmt(m.ovr) : 'Player') + '</small></div><div class="lg-crew-btns">' + btns + '</div></div>';
    const b = (a, acct, label, cls) => '<button class="lg-btn ' + cls + ' lg-btn-sm" type="button" data-crew-decide="' + a + '" data-account="' + esc(acct) + '">' + label + '</button>';
    box.innerHTML = '<div class="lg-box"><div class="lg-box-head"><h3>Kickoff Leaguemates ' + infoBtn('kickoff') + '</h3></div><p class="lg-box-sub">Approve real members so they can press Kickoff for the league too.</p>' +
      (pending.length ? '<h5 class="lg-h5">Requests · ' + pending.length + '</h5>' + pending.map(m => row(m, b('approve', m.accountId, 'Approve', 'lg-btn-primary') + b('decline', m.accountId, 'Decline', 'lg-btn-quiet'))).join('') : '') +
      '<h5 class="lg-h5">Leaguemates · ' + members.length + '</h5>' + (members.length ? members.map(m => row(m, b('remove', m.accountId, 'Remove', 'lg-btn-glass'))).join('') : '<p class="lg-note-line">No Leaguemates yet. Players can request it on your league page.</p>') + '</div>';
  }
  let hqShots = [];
  function renderHqApps(box, o) {
    if (state.ownerApps === null) { box.innerHTML = skel(2); return; }
    const all = triageApplications(state.ownerApps, o);
    const counts = { all: all.length }; for (const a of all) counts[a.status] = (counts[a.status] || 0) + 1;
    let rows = all.filter(a => state.appFilter === 'all' || a.status === state.appFilter);
    rows = rows.sort(state.appSort === 'fit' ? (a, b) => b._score - a._score || ts(b.createdAt) - ts(a.createdAt) : (a, b) => ts(b.createdAt) - ts(a.createdAt));
    hqShots = [];
    const copy = (label, v) => v ? '<span class="lg-tag">' + label + ': <b>' + esc(v) + '</b><button class="lg-copy" data-copy="' + esc(v) + '" data-label="' + label + '" type="button">Copy</button></span>' : '';
    const btn = (id, status, label, cls, cur) => '<button class="lg-btn ' + cls + ' lg-btn-sm" data-app="' + esc(id) + '" data-status="' + status + '" type="button"' + (cur === status ? ' disabled' : '') + '>' + label + '</button>';
    const card = (a, idx) => {
      let shot;
      if (a._shot.has && !a._shot.expired) {
        hqShots.push({ src: a.screenshotUrl, caption: (a.inGameUsername || 'Player') + ' · OVR ' + a.ovr + (a._shot.daysLeft <= 7 ? ' · deleted in ' + (a._shot.hoursLeft < 48 ? a._shot.hoursLeft + 'h' : a._shot.daysLeft + 'd') : '') });
        shot = '<button type="button" class="lg-shot" data-shot="' + (hqShots.length - 1) + '" aria-label="Open screenshot"><img src="' + esc(a.screenshotUrl) + '" alt="Team screenshot of ' + esc(a.inGameUsername) + '" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="lg-shot-chip' + (a._shot.daysLeft <= 2 ? ' soon' : '') + '">' + ICON.clock + (a._shot.hoursLeft < 48 ? a._shot.hoursLeft + 'h left' : a._shot.daysLeft + 'd left') + '</span></button>';
      } else if (a._shot.expired) shot = '<div class="lg-shot gone">' + ICON.image + '<b>Screenshot expired</b><small>Deleted after 7 days. Ask for a new one.</small></div>';
      else shot = '<div class="lg-shot gone">' + ICON.image + '<b>No screenshot</b><small>The player did not add one.</small></div>';
      return '<article class="lg-appx" data-reveal style="--i:' + Math.min(idx, 8) + '"><div class="lg-appx-top">' + crest(a.avatarUrl, a.displayName, 'lg-crest sm') + '<div class="lg-app-id"><b>' + esc(a.inGameUsername || a.displayName) + '</b><small>' + esc(a.regionServer || 'Region not set') + ' · ' + esc(timeAgo(a.createdAt)) + '</small></div>' +
        '<div class="lg-ovrplate ' + (a._meets ? '' : 'warn') + '"><span class="lg-k">OVR</span><strong>' + fmt(a.ovr) + '</strong></div><div class="lg-score ' + (a._score >= 75 ? 'great' : a._score >= 50 ? 'good' : 'low') + '" title="Priority score"><b>' + a._score + '</b></div></div>' +
        '<div class="lg-flags">' + a._flags.map(f => '<span class="' + f.tone + '">' + esc(f.text) + '</span>').join('') + '</div>' +
        '<div class="lg-appx-body">' + shot + '<div class="lg-appx-info">' + (a.message ? '<p class="lg-app-note">' + esc(a.message) + '</p>' : '<p class="lg-note-line">No note.</p>') + '<div class="lg-tags">' + copy('UID', a.uid) + copy('Discord', a.discord) + (!a.uid && !a.discord ? '<span class="lg-note-line">No UID or Discord shared. Message the player.</span>' : '') + '</div></div></div>' +
        '<div class="lg-app-actions"><button class="lg-btn lg-btn-glass lg-btn-sm" type="button" data-message-listing="' + esc(o.id) + '" data-applicant="' + esc(a.accountId || '') + '">' + ICON.chat + 'Message</button><span class="lg-stat ' + a.status + '">' + esc(APP_LABEL[a.status]) + '</span></div>' +
        '<div class="lg-decide">' + btn(a.id, 'shortlisted', 'Shortlist', 'lg-btn-glass', a.status) + btn(a.id, 'invited', 'Invite', 'lg-btn-primary', a.status) + btn(a.id, 'joined', 'Joined', 'lg-btn-glass', a.status) + btn(a.id, 'declined', 'Decline', 'lg-btn-danger', a.status) + '</div></article>';
    };
    const filters = [['all', 'All'], ['new', 'New'], ['shortlisted', 'Shortlisted'], ['invited', 'Invited'], ['joined', 'Joined'], ['declined', 'Declined']];
    box.innerHTML = '<div class="lg-box"><div class="lg-box-head"><div><h3>Applications</h3><p class="lg-box-sub">Best fits first. Screenshots are deleted automatically after 7 days.</p></div><label class="lg-sortsel"><span class="lg-k">Sort</span><select id="lgAppSort"><option value="fit"' + (state.appSort === 'fit' ? ' selected' : '') + '>Best fit</option><option value="new"' + (state.appSort === 'new' ? ' selected' : '') + '>Newest</option></select></label></div>' +
      '<div class="lg-pills">' + filters.map(([k, l]) => '<button type="button" data-appf="' + k + '" class="' + (state.appFilter === k ? 'on' : '') + '">' + l + '<em>' + (counts[k] || 0) + '</em></button>').join('') + '</div>' +
      (rows.length ? '<div class="lg-appx-list">' + rows.map(card).join('') + '</div>' : empty(all.length ? 'Nothing in this view' : 'No applications yet', all.length ? 'Try another filter.' : 'Share your league to get your first applicants.', all.length ? '' : '<button class="lg-btn lg-btn-primary" data-share-kit type="button">' + ICON.share + 'Open share kit</button>')) + '</div>';
    reveal(box);
  }
  async function loadOwnerApps() {
    const o = own(); if (!o || o.status !== 'approved') { state.ownerApps = []; return; }
    try {
      const d = await api('/api/leagues/listings/' + encodeURIComponent(o.id) + '/applications');
      state.ownerApps = d.applications || []; state.newApplications = state.ownerApps.filter(a => a.status === 'new').length;
      renderTabs(); if (state.tab === 'owner') renderOwner();
    } catch (e) { state.ownerApps = []; const box = $('#lgHqPane'); if (box && state.hqTab === 'apps') box.innerHTML = '<div class="lg-box"><p class="lg-note-line">' + esc(e.message) + ' <button class="lg-link" id="lgAppsRetry" type="button">Try again</button></p></div>'; }
  }
  async function decideApp(id, status, btn) {
    btn.disabled = true;
    try { await api('/api/leagues/applications/' + encodeURIComponent(id) + '/decide', { method: 'POST', body: JSON.stringify({ status }) }); toast(status === 'invited' ? 'Marked as invited. Send the invite in FC Mobile.' : 'Updated.'); if (status === 'joined') await loadPersonal(); else { state.ownerApps = null; await loadOwnerApps(); } }
    catch (e) { toast(e.message, true); btn.disabled = false; }
  }
  async function quickUpdate(patch) {
    const o = own(); if (!o) return;
    $$('#panelOwner [data-spots], #lgRecruitToggle').forEach(n => { n.disabled = true; });
    try { const res = await api('/api/leagues/listings/' + encodeURIComponent(o.id) + '/quick', { method: 'POST', body: JSON.stringify(patch) }); o.openSpots = res.openSpots; o.recruitingOpen = res.recruitingOpen; toast('Updated.'); await loadPersonal(); }
    catch (e) { toast(e.message, true); renderOwner(); }
  }
  async function doKickoff(id, btn) {
    btn && (btn.disabled = true);
    try { await api('/api/leagues/listings/' + encodeURIComponent(id) + '/kickoff', { method: 'POST', body: '{}' }); toast('Kickoff! The league is back on top.'); }
    catch (e) { toast(e.message, true); }
    await loadPersonal({ refreshPublic: true });
  }
  async function postOwner(path, body, okMsg, btn) {
    const o = own(); if (!o) return; btn && (btn.disabled = true);
    try { await api('/api/leagues/listings/' + encodeURIComponent(o.id) + '/' + path, { method: 'POST', body: JSON.stringify(body || {}) }); toast(okMsg); await loadPersonal(); }
    catch (e) { toast(e.message, true); btn && (btn.disabled = false); }
  }
  async function toggleSave(id) {
    if (!state.signedIn) { location.href = signInUrl(); return; }
    const r = state.leagues.find(x => x.id === id); if (!r || r.isMine) return;
    if (!state.profile) { const p = await openProfileSheet({ suggested: state.suggested, intro: 'Add your OVR once to save leagues and see your best fits.' }); if (!p) return; state.profile = p; }
    if (!r.saved && state.savedCount >= 3) { toast('You can save up to 3 leagues. Remove a bookmark first.', true); return; }
    const prev = r.saved; r.saved = !prev; refresh();
    try { const res = await api('/api/leagues/listings/' + encodeURIComponent(id) + '/save', { method: 'POST', body: '{}' }); r.saved = res.saved; state.savedCount = Number(res.savedCount ?? Math.max(0, state.savedCount + (r.saved ? 1 : -1))); refresh(); toast(r.saved ? 'Saved to bookmarks.' : 'Removed from saved.'); }
    catch (e) { r.saved = prev; refresh(); toast(e.message, true); }
  }
  async function openListingAppeal(id) {
    const o = state.ownListings.find(r => r.id === id); if (!o || o.status !== 'paused') return;
    const sheet = openSheet('<div class="lg-sheet-head"><h3>Appeal league suspension</h3><p class="lg-sub">Explain what happened and what you have changed. Keep it specific and respectful.</p></div><label class="lg-field"><span>Reason <b>*</b></span><textarea id="lgAppealReason" rows="5" maxlength="1200" placeholder="Describe why the suspension should be reviewed…"></textarea></label><div class="lg-msg" id="lgAppealMsg" role="alert"></div><div class="lg-modal-actions"><button class="lg-btn lg-btn-quiet" type="button" data-sheet-close>Cancel</button><button class="lg-btn lg-btn-primary" type="button" id="lgAppealSend">Send appeal</button></div>', { label: 'League suspension appeal', wide: true });
    $('#lgAppealSend', sheet.el).addEventListener('click', async (ev) => {
      const b = ev.currentTarget, reason = $('#lgAppealReason', sheet.el).value.trim(), msg = $('#lgAppealMsg', sheet.el);
      if (reason.length < 20) { msg.textContent = 'Add at least 20 characters so the review team has enough context.'; return; }
      b.disabled = true; b.textContent = 'Sending…';
      try { const r = await api('/api/leagues/listings/' + encodeURIComponent(id) + '/appeal', { method: 'POST', body: JSON.stringify({ reason }) }); o.appealStatus = r.status || 'open'; sheet.close(); toast('Appeal submitted for review.'); renderOwner(); }
      catch (e) { msg.textContent = e.message || 'The appeal could not be submitted.'; b.disabled = false; b.textContent = 'Send appeal'; }
    });
  }
  function hqAct(act, btn) {
    const o = own(); if (!o) return;
    if (act === 'apps' || act === 'crew' || act === 'listing') { state.hqTab = act; renderOwner(); $('#lgHqPane')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (act === 'controls') $('#lgKpis')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (act === 'edit') openEditor(o);
    else if (act === 'kickoff') doKickoff(o.id, btn);
    else if (act === 'recruit') quickUpdate({ recruitingOpen: true });
    else if (act === 'appeal') openListingAppeal(o.id);
  }

  // ───────────── find players (owners) ─────────────
  function renderPlayersShell() {
    const el = $('#panelPlayers'); if (!state.canFindPlayers) { el.innerHTML = ''; return; }
    if (!$('#pQ', el)) {
      el.innerHTML = '<div class="lg-panel-head"><div><h2>Find players</h2><p>Players who want a league. Unlock contact details for the ones you like.</p></div><div class="lg-allow"><span class="lg-k">Unlocks today</span><span class="lg-pips big" id="lgPips"></span><b id="lgRemaining">' + state.remaining + '</b></div></div>' +
        '<div class="lg-finder slim"><div class="lg-finder-main"><label class="lg-search">' + ICON.search + '<input id="pQ" type="search" placeholder="Search by name" autocomplete="off"></label><label class="lg-ovrbox"><span>Min OVR</span><input id="pOvr" type="number" min="50" max="200" placeholder="50"></label><select id="pRegion" aria-label="Region"></select><select id="pSize" aria-label="Size"></select><select id="pLang" aria-label="Language"></select><select id="pSort" aria-label="Sort"><option value="">Newest</option><option value="ovr">Highest OVR</option></select></div></div>' +
        '<p class="lg-results" id="lgPlayerResults"></p><div class="lg-pgrid" id="lgPlayerGrid"></div><div id="lgPlayerEmpty" hidden>' + empty('No players match', 'Loosen a filter and try again.') + '</div>';
      $('#pRegion').innerHTML = opt('', 'All regions') + REGIONS.map(r => opt(r)).join(''); $('#pLang').innerHTML = opt('', 'Any language') + LANGS.map(r => opt(r)).join(''); $('#pSize').innerHTML = opt('', 'Any size') + SIZES.map(r => opt(r)).join('');
      let t; const go = () => { clearTimeout(t); t = setTimeout(loadPlayers, 220); };
      ['pQ', 'pOvr'].forEach(id => $('#' + id).addEventListener('input', go)); ['pRegion', 'pSize', 'pLang', 'pSort'].forEach(id => $('#' + id).addEventListener('change', loadPlayers));
    }
    loadPlayers();
  }
  async function loadPlayers() {
    const grid = $('#lgPlayerGrid'); if (!grid || !state.canFindPlayers) return;
    grid.innerHTML = skel(3); $('#lgPlayerEmpty').hidden = true;
    try {
      const p = new URLSearchParams(), q = $('#pQ').value.trim(); if (q) p.set('q', q);
      for (const [id, k] of [['pRegion', 'region'], ['pSize', 'size'], ['pLang', 'lang']]) if ($('#' + id).value) p.set(k, $('#' + id).value);
      p.set('minOvr', $('#pOvr').value || '50'); if ($('#pSort').value === 'ovr') p.set('sort', 'ovr');
      state.players = (await api('/api/leagues/players?' + p)).players || []; renderPlayers();
    } catch (e) { grid.innerHTML = empty('Player search is unavailable', esc(e.message)); }
  }
  function playerCard(row) {
    const tags = (row.tournamentSizes || []).map(s => '<span class="lg-tag cyan">' + esc(s) + '</span>').join('') + (row.preferredLanguages || []).slice(0, 2).map(l => '<span class="lg-tag">' + esc(l) + '</span>').join('');
    const rev = state.revealed.get(row.accountId), unlocked = rev || row.revealed;
    const line = (label, v) => '<dt>' + label + '</dt><dd>' + esc(v || 'Not shared') + '</dd>' + (v ? '<button type="button" class="lg-copy" data-copy="' + esc(v) + '" data-label="' + label + '">Copy</button>' : '<span></span>');
    const panel = rev ? '<div class="lg-revealed"><h4>Shared details</h4><dl class="lg-kv">' + line('In-game', rev.inGameUsername) + line('UID', rev.fcMobileUid) + line('Discord', rev.discordHandle) + '</dl></div>' : '';
    return '<article class="lg-pcard" data-reveal><div class="lg-pcard-head">' + crest(row.avatarUrl, row.displayName, 'lg-crest sm') + '<div class="lg-pcard-id"><h3>' + esc(row.displayName) + '</h3><p>' + esc(row.regionServer || '') + '</p></div><div class="lg-ovrplate"><span class="lg-k">OVR</span><strong>' + fmt(row.ovr) + '</strong></div></div><div class="lg-tags">' + tags + '</div><p class="lg-pcard-note">' + esc(row.availability || 'Availability not set') + (row.playStyle ? ' · ' + esc(row.playStyle) : '') + '</p>' +
      '<button type="button" class="lg-btn ' + (unlocked ? 'lg-btn-glass' : 'lg-btn-primary') + ' lg-btn-sm" data-reveal-player="' + esc(row.accountId) + '"' + (!unlocked && state.remaining <= 0 ? ' disabled' : '') + '>' + (rev ? 'Unlocked' : unlocked ? 'View details' : state.remaining <= 0 ? 'Daily limit reached' : 'Unlock details · ' + state.remaining + ' left') + '</button>' + panel + '</article>';
  }
  function renderPlayers() {
    const rows = state.players;
    $('#lgPlayerResults').innerHTML = '<b>' + rows.length + '</b> ' + (rows.length === 1 ? 'player' : 'players');
    $('#lgRemaining').textContent = state.remaining; $('#lgPips').innerHTML = [0, 1, 2].map(i => '<i class="' + (i < state.remaining ? 'on' : '') + '"></i>').join('');
    $('#lgPlayerGrid').innerHTML = rows.map(playerCard).join(''); $('#lgPlayerGrid').hidden = !rows.length; $('#lgPlayerEmpty').hidden = rows.length > 0; reveal($('#panelPlayers'));
  }
  async function revealPlayer(id, btn) {
    btn.disabled = true;
    try {
      const res = await api('/api/leagues/players/' + encodeURIComponent(id) + '/reveal', { method: 'POST', body: '{}' });
      state.revealed.set(id, res.player); state.remaining = Number(res.remainingToday || 0);
      const row = state.players.find(p => p.accountId === id); if (row) row.revealed = true; renderPlayers();
      toast(!res.player.fcMobileUid && !res.player.discordHandle ? 'This player did not share a UID or Discord. They can still apply to you.' : 'Unlocked. Reach out kindly.');
    } catch (e) { toast(e.message, true); btn.disabled = false; if (/daily limit/i.test(e.message)) { state.remaining = 0; renderPlayers(); } }
  }

  // ───────────── listing wizard ─────────────
  const EDIT_STEPS = ['Identity', 'Level', 'Schedule', 'Join & media', 'Review'];
  const DRAFT_KEY = 'lg-listing-draft-v1';
  const chip = (name, v, on, label) => '<label class="lg-chip"><input type="checkbox" name="' + name + '" value="' + esc(v) + '"' + (on ? ' checked' : '') + '><span>' + esc(label || v) + '</span></label>';
  let crestUp = null, gallery = null, edStep = 0;

  function editorPanes(row, d) {
    const joins = d.joinMethods || ['apply'];
    return '' +
    '<section class="lg-pane" data-ed="0"><div class="lg-grid-2">' +
      '<label class="lg-field"><span>League name <b>*</b></span><input name="name" required minlength="3" maxlength="70" placeholder="Your league name" value="' + esc(d.name || '') + '"' + (row ? ' disabled' : '') + '>' + (row ? '<small class="lg-help">The name cannot be changed.</small>' : '') + '</label>' +
      '<label class="lg-field"><span>One-line pitch ' + infoBtn('pitch') + '<small class="lg-counter" id="lgPitchCount">0/' + TAGLINE_MAX + '</small></span><input name="tagline" maxlength="' + TAGLINE_MAX + '" placeholder="e.g. Daily 8v8, friendly and active" value="' + esc(d.tagline || '') + '"></label></div>' +
      '<div class="lg-sugg" data-tagsugg></div>' +
      '<div class="lg-up-slot" id="crestSlot"></div>' +
      '<fieldset class="lg-fieldset"><legend>League colour</legend><div class="lg-swatches">' + Object.entries(ACCENTS).map(([k, c]) => '<label title="' + k + '"><input type="radio" name="accent" value="' + k + '"' + ((d.accent || 'cyan') === k ? ' checked' : '') + '><span style="--sw:' + c + '"></span></label>').join('') + '</div></fieldset></section>' +
    '<section class="lg-pane" data-ed="1" hidden><fieldset class="lg-fieldset"><legend>Division <b>*</b> ' + infoBtn('division') + '</legend><div class="lg-div-pick">' + DIVISIONS.map(x => '<label><input type="radio" name="division" value="' + x.key + '"' + (d.division === x.key ? ' checked' : '') + '><span><img src="' + divisionIcon(x.key) + '" alt="" width="34" height="34" loading="lazy"><b>' + esc(x.label) + '<small>' + divisionRange(x) + '</small></b></span></label>').join('') + '</div></fieldset>' +
      '<div class="lg-grid-2"><label class="lg-field"><span>Region <b>*</b> ' + infoBtn('region') + '</span><select name="regionServer" required><option value="">Choose</option>' + REGIONS.map(r => '<option' + (d.regionServer === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label>' +
      '<label class="lg-field"><span>Open spots <b>*</b> ' + infoBtn('spots') + '</span><input name="openSpots" type="number" inputmode="numeric" min="0" max="50" required value="' + esc(d.openSpots ?? 5) + '"></label></div>' +
      '<label class="lg-field"><span>Minimum OVR <b>*</b> ' + infoBtn('ovr') + '</span><input name="minOvr" type="number" inputmode="numeric" min="50" max="200" required placeholder="e.g. 115" value="' + esc(d.minOvr ?? '') + '"></label><div class="lg-quickovr">' + [100, 110, 115, 120, 125, 130].map(n => '<button type="button" data-ovr="' + n + '">' + n + '+</button>').join('') + '</div></section>' +
    '<section class="lg-pane" data-ed="2" hidden><div class="lg-grid-2"><label class="lg-field"><span>How often do you play? <b>*</b></span><select name="tournamentFrequency" required>' + Object.entries(FREQ).map(([v, l]) => '<option value="' + v + '"' + ((d.tournamentFrequency || 'daily') === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '<label class="lg-field"><span>Usual hours</span><input name="activeHours" maxlength="60" placeholder="e.g. 18:00–23:00 UTC" value="' + esc(d.activeHours || '') + '"></label></div>' +
      '<fieldset class="lg-fieldset"><legend>Tournament sizes <b>*</b></legend><div class="lg-chips">' + SIZES.map(s => chip('tournamentSizes', s, (d.tournamentSizes || ['4v4']).includes(s))).join('') + '</div></fieldset>' +
      '<fieldset class="lg-fieldset"><legend>Style</legend><div class="lg-segr">' + Object.entries(COMMIT).map(([v, l]) => '<label><input type="radio" name="playerCommitment" value="' + v + '"' + ((d.playerCommitment || 'regular') === v ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div></fieldset>' +
      '<fieldset class="lg-fieldset"><legend>Languages</legend><div class="lg-chips">' + LANGS.map(l => chip('preferredLanguages', l, (d.preferredLanguages || ['English']).includes(l))).join('') + '</div></fieldset>' +
      '<label class="lg-field"><span>Perk or reward</span><input name="perks" maxlength="80" placeholder="e.g. Weekly prizes" value="' + esc(d.perks || '') + '"></label></section>' +
    '<section class="lg-pane" data-ed="3" hidden><fieldset class="lg-fieldset"><legend>How can players join? <b>*</b> ' + infoBtn('joining') + '</legend><div class="lg-chips">' + Object.entries(JOIN_METHODS).map(([k, l]) => chip('joinMethods', k, joins.includes(k), l)).join('') + '</div></fieldset>' +
      '<div class="lg-cond" id="condDiscord" hidden><label class="lg-field"><span>Discord invite link <b>*</b></span><input name="discordInviteUrl" type="url" maxlength="500" placeholder="https://discord.gg/…" value="' + esc(d.discordInviteUrl || '') + '"></label></div>' +
      '<div class="lg-cond" id="condGame" hidden><label class="lg-field"><span>League ID in FC Mobile <b>*</b></span><input name="leagueGameId" maxlength="64" value="' + esc(d.leagueGameId || '') + '"></label></div>' +
      '<div class="lg-grid-2"><label class="lg-field"><span>Public Discord name</span><input name="contactDiscord" maxlength="100" placeholder="@owner" value="' + esc(d.contactDiscord || '') + '"></label>' +
      '<label class="lg-switch"><input type="checkbox" name="discordRequired"' + (d.discordRequired ? ' checked' : '') + '><i></i><span><b>Discord required</b><small>Players must join your server to play</small></span></label></div>' +
      '<div class="lg-slot-head"><b>League screenshots</b> ' + infoBtn('media') + '<span class="lg-chip-note">Optional</span></div>' +
      (state.galleryReady ? '<div id="gallerySlot"></div>' : '<p class="lg-note-line">League screenshots unlock after the database update is applied.</p>') + '</section>' +
    '<section class="lg-pane" data-ed="4" hidden><div id="lgEdReview"></div>' +
      (row ? '' : '<label class="lg-check big"><input type="checkbox" name="acceptRules" id="lgAcceptRules"><span>I agree to the league rules. <button type="button" class="lg-link" id="lgReadRules">Read the rules</button></span></label>') + '</section>';
  }
  const radio = (f, n) => f.querySelector('input[name=' + n + ']:checked')?.value || '';
  const checkedVals = (f, n) => $$('input[name=' + n + ']:checked', f).map(i => i.value);
  function readDraft() {
    const f = $('#lgListingForm'), g = (n) => (f.elements[n]?.value || '').trim(), o = state.ownListings.find(r => r.id === state.editingId);
    return { name: g('name') || o?.name || '', tagline: g('tagline'), logoUrl: crestUp?.value() || '', galleryUrls: gallery ? gallery.value() : (o?.galleryUrls || []), regionServer: g('regionServer'), division: radio(f, 'division'),
      minOvr: Number(g('minOvr') || 0), openSpots: Number(g('openSpots') || 0), tournamentFrequency: g('tournamentFrequency'), tournamentSizes: checkedVals(f, 'tournamentSizes'), joinMethods: checkedVals(f, 'joinMethods'),
      discordInviteUrl: g('discordInviteUrl'), leagueGameId: g('leagueGameId'), activeHours: g('activeHours'), playerCommitment: radio(f, 'playerCommitment') || 'regular', perks: g('perks'), contactDiscord: g('contactDiscord'),
      preferredLanguages: checkedVals(f, 'preferredLanguages'), accent: radio(f, 'accent') || 'cyan', discordRequired: Boolean(f.elements.discordRequired?.checked) };
  }
  function previewRow() {
    const o = state.ownListings.find(r => r.id === state.editingId), d = readDraft();
    return { ...d, id: 'preview', slug: '', logoUrl: d.logoUrl || null, verified: Boolean(o?.verified), reviewed: false, isSample: false, isMine: true, confirmations7d: 0, matchdays7d: 0, createdAt: o?.createdAt || new Date().toISOString(), lastKickoffAt: o?.lastKickoffAt || null, recruitingOpen: true };
  }
  function renderTagSugg() {
    const d = readDraft(), list = taglineSuggestions(d), cur = $('#lgListingForm').elements.tagline.value.trim();
    $$('[data-tagsugg]').forEach(box => {
      box.innerHTML = list.length && cur.length < 15 ? '<span class="lg-k">Pitch ideas</span>' + list.map(t => '<button type="button" class="lg-sug" data-tag="' + esc(t) + '">' + esc(t) + '</button>').join('') : '';
      box.hidden = !box.innerHTML;
    });
  }
  function renderEditorSide() {
    $('#lgListingPreview').innerHTML = leagueCard(previewRow(), { preview: true });
    const draft = previewRow(), h = listingHealth({ ...draft, lastKickoffAt: draft.lastKickoffAt || new Date().toISOString(), confirmations7d: 1 }, { galleryReady: state.galleryReady });
    $('#lgEdHealth').innerHTML = '<div class="lg-ring ' + (h.score >= 85 ? 'great' : h.score >= 65 ? 'good' : 'low') + '" style="--p:' + h.score + '"><b>' + h.score + '</b><small>%</small></div><div><b>' + h.grade + '</b><small>' + (h.tips.find(t => ['crest', 'tagline', 'gallery', 'hours', 'perks'].includes(t.id))?.text || 'A complete listing gets more applications.') + '</small></div>';
    renderTagSugg();
  }
  function syncEditor() {
    const f = $('#lgListingForm'), j = checkedVals(f, 'joinMethods');
    $('#condDiscord').hidden = !j.includes('discord'); $('#condGame').hidden = !j.includes('in_game');
    $('#lgPitchCount').textContent = f.elements.tagline.value.length + '/' + TAGLINE_MAX;
    renderEditorSide();
    if (!state.editingId) store.set(DRAFT_KEY, JSON.stringify(readDraft()));
  }
  function validateStep(n) {
    const f = $('#lgListingForm'), v = (k) => (f.elements[k]?.value || '').trim();
    if (n === 0 && v('name').length < 3) return 'Give your league a name (at least 3 characters).';
    if (n === 1) { if (!radio(f, 'division')) return 'Choose your division.'; if (!v('regionServer')) return 'Choose a region.'; const o = Number(v('minOvr')); if (!(o >= 50 && o <= 200)) return 'Enter a minimum OVR between 50 and 200.'; const s = Number(v('openSpots')); if (!(s >= 0 && s <= 50)) return 'Open spots must be between 0 and 50.'; }
    if (n === 2 && !checkedVals(f, 'tournamentSizes').length) return 'Choose at least one tournament size.';
    if (n === 3) { const j = checkedVals(f, 'joinMethods'); if (!j.length) return 'Choose at least one way to join.'; if (j.includes('discord') && !/^https:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\//i.test(v('discordInviteUrl'))) return 'Add a valid Discord invite link (discord.gg/…).'; if (j.includes('in_game') && !v('leagueGameId')) return 'Add your league ID so players can search for it in game.'; if (crestUp?.busy() || gallery?.busy()) return 'An image is still uploading. Wait for it to finish.'; }
    return '';
  }
  function reviewHtml() {
    const d = readDraft(), div = DIVISIONS.find(x => x.key === d.division);
    const sum = [['Name', d.name], ['Pitch', d.tagline || '—'], ['Division', div?.label || '—'], ['Region', d.regionServer || '—'], ['Minimum OVR', d.minOvr ? d.minOvr + '+' : '—'], ['Open spots', d.openSpots], ['Schedule', [FREQ[d.tournamentFrequency], d.tournamentSizes.join(' / '), d.activeHours].filter(Boolean).join(' · ')], ['Join', d.joinMethods.map(m => JOIN_METHODS[m]).join(', ')], ['Images', (d.logoUrl ? 'Crest' : 'No crest') + (state.galleryReady ? ' · ' + d.galleryUrls.length + ' screenshot' + (d.galleryUrls.length === 1 ? '' : 's') : '')]];
    return '<dl class="lg-sum big">' + sum.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl><div class="lg-sugg" data-tagsugg></div>';
  }
  function goStep(n) {
    edStep = Math.max(0, Math.min(EDIT_STEPS.length - 1, n));
    $$('[data-ed]').forEach(p => { p.hidden = Number(p.dataset.ed) !== edStep; });
    $$('#lgEdSteps span').forEach((s, i) => { s.classList.toggle('on', i === edStep); s.classList.toggle('done', i < edStep); });
    $('#lgEdBack').textContent = edStep === 0 ? 'Cancel' : 'Back';
    const last = edStep === EDIT_STEPS.length - 1;
    $('#lgListingSave').innerHTML = last ? (state.editingId ? 'Save changes' : 'List my league') + ' ' + ICON.arrow : 'Next ' + ICON.arrow;
    $('#lgListingMsg').textContent = '';
    if (last) { $('#lgEdReview').innerHTML = reviewHtml(); renderTagSugg(); }
    $('#lgEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function showView(name) {
    state.view = name; $('#lgTabs').style.display = name === 'editor' ? 'none' : ''; $('#lgEditor').hidden = name !== 'editor'; $('#lgWorkspace').hidden = name === 'editor'; $('#lgHero').hidden = name === 'editor';
    if (name === 'editor') $('#lgActivityNotice').hidden = true; else renderActivityNotice();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function openEditor(row = null) {
    if (!state.signedIn) { location.href = signInUrl('/leagues/?tab=owner'); return; }
    if (!state.account?.emailConfirmed) { toast('Verify your email first, then list your league.', true); return; }
    state.editingId = row?.id || null;
    let d = row || {}, restored = false;
    if (!row) { try { const saved = JSON.parse(store.get(DRAFT_KEY, 'null')); if (saved && saved.name) { d = saved; restored = true; } } catch { /* ignore a broken draft */ } }
    $('#lgEditorTitle').textContent = row ? 'Edit your league' : 'List your league';
    $('#lgEdSteps').innerHTML = EDIT_STEPS.map((s, i) => '<span class="' + (i === 0 ? 'on' : '') + '"><i>' + (i + 1) + '</i>' + s + '</span>').join('');
    $('#lgEdRestored').hidden = !restored;
    const f = $('#lgListingForm'); f.innerHTML = editorPanes(row, d);
    crestUp = mountUploader($('#crestSlot', f), { label: 'League crest', hint: 'Optional · square images look best', value: d.logoUrl || '', purpose: 'crest', onChange: () => syncEditor() });
    gallery = state.galleryReady ? mountGallery($('#gallerySlot', f), { values: d.galleryUrls || [], onChange: () => syncEditor() }) : null;
    edStep = 0; syncEditor(); showView('editor'); goStep(0);
  }
  async function submitListing(event) {
    event.preventDefault();
    const f = $('#lgListingForm'), msg = $('#lgListingMsg'), btn = $('#lgListingSave');
    const err = validateStep(edStep);
    if (err) { msg.textContent = err; return; }
    if (edStep < EDIT_STEPS.length - 1) { goStep(edStep + 1); return; }
    for (let i = 0; i < EDIT_STEPS.length - 1; i++) { const e = validateStep(i); if (e) { goStep(i); $('#lgListingMsg').textContent = e; return; } }
    if (!state.editingId && !f.elements.acceptRules.checked) { msg.textContent = 'Agree to the league rules to list your league.'; return; }
    const d = readDraft();
    const payload = { name: d.name, tagline: d.tagline, division: d.division, regionServer: d.regionServer, minOvr: d.minOvr, openSpots: d.openSpots, tournamentFrequency: d.tournamentFrequency, tournamentSizes: d.tournamentSizes, joinMethods: d.joinMethods,
      discordInviteUrl: d.discordInviteUrl, leagueGameId: d.leagueGameId, logoUrl: d.logoUrl, activeHours: d.activeHours, playerCommitment: d.playerCommitment, perks: d.perks, contactDiscord: d.contactDiscord, preferredLanguages: d.preferredLanguages, accent: d.accent, discordRequired: d.discordRequired, acceptRules: !state.editingId };
    if (state.galleryReady) payload.galleryUrls = d.galleryUrls;
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await api(state.editingId ? '/api/leagues/listings/' + encodeURIComponent(state.editingId) + '/update' : '/api/leagues/listings', { method: 'POST', body: JSON.stringify(payload) });
      store.del(DRAFT_KEY); state.editingId = null; toast(res.message || 'Saved.'); state.tab = 'owner'; state.ownerApps = null; showView('board'); await loadPersonal({ refreshPublic: true });
      if (res.url) setTimeout(() => toast('Your league page: ' + location.origin + res.url), 600);
    } catch (e) { msg.textContent = e.message; btn.disabled = false; goStep(edStep); }
    btn.disabled = false;
  }

  // ───────────── data loading ─────────────
  function ingestPublic(d) { if (state.loadedPersonal) return; state.leagues = (d.leagues || []).map(l => ({ ...l, saved: false })); state.spotlight = d.spotlight || []; }
  async function loadPublic({ silent = false } = {}) {
    try { ingestPublic(await api('/api/leagues/public', { cache: 'default' })); $('#lgError').hidden = true; $('#lgWorkspace').hidden = state.view === 'editor'; refresh(); }
    catch (e) { if (silent || state.leagues.length) return; $('#lgErrorMsg').textContent = e.message; $('#lgError').hidden = false; }
  }
  async function loadPersonal() {
    if (!(await token())) { Object.assign(state, { signedIn: false, loadedPersonal: false, profile: null, ownListings: [], myApplications: [], canFindPlayers: false }); refresh(); return; }
    try {
      const d = await api('/api/leagues/bootstrap');
      Object.assign(state, { signedIn: true, account: d.account, profile: d.profile, suggested: d.suggestedProfile || {}, ownListings: d.ownListings || [], ownerCrew: d.ownerCrew || [], crewReady: Boolean(d.crewReady), galleryReady: Boolean(d.galleryReady),
        myCrew: d.myCrew || null, myApplications: d.myApplications || [], newApplications: d.newApplications || 0, canFindPlayers: Boolean(d.canFindPlayers), remaining: Number(d.outreachRemaining ?? 3), savedCount: Number(d.savedCount || 0), ownerApps: null });
      state.leagues = d.leagues || []; state.spotlight = d.spotlight || []; state.loadedPersonal = true;
      if (d.directoryFailed) toast('Some leagues could not be loaded.', true);
      refresh();
      if (state.tab === 'inbox') loadInbox({ silent: true }); else loadNotificationCount();
      if (state.tab === 'players') renderPlayersShell();
    } catch (e) { if (e.status === 401) { state.signedIn = false; refresh(); return; } toast(e.message, true); state.signedIn = true; refresh(); }
  }

  // ───────────── events ─────────────
  function bindFilters() {
    const f = state.filters;
    let t; const later = (fn) => { clearTimeout(t); t = setTimeout(fn, 140); };
    $('#fQ').addEventListener('input', e => later(() => { f.q = e.target.value; renderLeagues(); }));
    $('#fOvr').addEventListener('input', e => later(() => { const n = Number(e.target.value); f.ovr = n >= 50 && n <= 200 ? n : 0; if (f.ovr && !state.profile && state.sort === 'active') { /* keep user sort */ } setSortOptions(); renderLeagues(); }));
    $('#fUseMine').addEventListener('click', () => { if (state.profile) { f.ovr = Number(state.profile.ovr); $('#fOvr').value = f.ovr; setSortOptions(); renderLeagues(); } });
    for (const [id, key] of [['fRegion', 'region'], ['fLang', 'lang'], ['fFreq', 'freq'], ['fSize', 'size'], ['fCommit', 'commit'], ['fJoin', 'join']]) $('#' + id).addEventListener('change', e => { f[key] = e.target.value; renderLeagues(); });
    $('#fSpots').addEventListener('change', e => { f.spots = e.target.checked; renderLeagues(); });
    $('#fVerified').addEventListener('change', e => { f.verified = e.target.checked; renderLeagues(); });
    $('#fSort').addEventListener('change', e => { state.sort = e.target.value; renderLeagues(); });
    $('#fMoreBtn').addEventListener('click', () => { const p = $('#fMore'); p.hidden = !p.hidden; $('#fMoreBtn').setAttribute('aria-expanded', String(!p.hidden)); });
    const reset = () => { Object.assign(state.filters, { q: '', division: '', region: '', freq: '', size: '', lang: '', commit: '', join: '', verified: false, spots: false, ovr: 0 }); syncControls(); setSortOptions(); renderLeagues(); };
    $('#lgClear').addEventListener('click', reset); $('#lgEmptyReset').addEventListener('click', reset);
    $('#lgTiers').addEventListener('click', e => { const b = e.target.closest('[data-div]'); if (!b) return; f.division = f.division === b.dataset.div ? '' : b.dataset.div; renderLeagues(); });
    $('#lgChips').addEventListener('click', e => { const b = e.target.closest('[data-unfilter]'); if (!b) return; const k = b.dataset.unfilter; f[k] = typeof f[k] === 'boolean' ? false : k === 'ovr' ? 0 : ''; syncControls(); setSortOptions(); renderLeagues(); });
    $('#fShare').addEventListener('click', async () => { filtersToUrl(); try { await navigator.clipboard.writeText(location.href); toast('Search link copied.'); } catch { toast('Copy failed.', true); } });
    window.addEventListener('resize', () => requestAnimationFrame(moveGlow));
  }
  function bindGlobal() {
    $('#lgRetry').addEventListener('click', () => loadPublic());
    $('#lgListCta').addEventListener('click', () => {
      if (!state.signedIn) { location.href = signInUrl('/leagues/?tab=owner'); return; }
      state.tab = 'owner'; renderTabs(); renderOwner(); if (!own()) openEditor();
    });
    $('#lgEdBack').addEventListener('click', () => { if (edStep > 0) goStep(edStep - 1); else { state.editingId = null; showView('board'); } });
    $('#lgEditorBack').addEventListener('click', () => { state.editingId = null; showView('board'); });
    $('#lgEdRestartDraft').addEventListener('click', () => { store.del(DRAFT_KEY); openEditor(); toast('Started a fresh draft.'); });
    const form = $('#lgListingForm');
    form.addEventListener('submit', submitListing);
    form.addEventListener('input', syncEditor); form.addEventListener('change', syncEditor);
    form.addEventListener('click', async e => {
      if (e.target.closest('#lgReadRules')) { e.preventDefault(); if (await openRulesSheet()) { const c = $('#lgAcceptRules'); if (c) c.checked = true; } return; }
      const q = e.target.closest('[data-ovr]'); if (q) { form.elements.minOvr.value = q.dataset.ovr; syncEditor(); return; }
      const t = e.target.closest('[data-tag]'); if (t) { form.elements.tagline.value = t.dataset.tag; syncEditor(); if (edStep === 4) { $('#lgEdReview').innerHTML = reviewHtml(); renderTagSugg(); } }
    });
    // a broken league image must never leave a hole in a card
    document.addEventListener('error', e => { const t = e.target; if (t?.tagName === 'IMG' && t.closest?.('.lg-root') && !t.classList.contains('lg-up-thumb') && !t.closest('.lg-lightbox')) t.remove(); }, true);

    document.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('.lg-modal, .lg-lightbox')) return;
      const cmp = t.closest('[data-compare]'); if (cmp) { toggleCompare(cmp.dataset.compare); return; }
      if (t.closest('[data-open-compare]')) { openCompare(); return; }
      if (!t.closest('#app')) return;
      const tab = t.closest('[data-tab]'); if (tab) { setTab(tab.dataset.tab); return; }
      const go = t.closest('[data-goto]'); if (go) { setTab(go.dataset.goto); return; }
      const save = t.closest('[data-save]'); if (save) { toggleSave(save.dataset.save); return; }
      const copy = t.closest('[data-copy]'); if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copy); toast((copy.dataset.label || 'Text') + ' copied.'); } catch { toast('Copy failed.', true); } return; }
      const rev = t.closest('[data-reveal-player]'); if (rev) { revealPlayer(rev.dataset.revealPlayer, rev); return; }
      const wd = t.closest('[data-withdraw]'); if (wd) { wd.disabled = true; try { await api('/api/leagues/applications/' + encodeURIComponent(wd.dataset.withdraw) + '/withdraw', { method: 'POST', body: '{}' }); toast('Application withdrawn.'); await loadPersonal(); } catch (err) { toast(err.message, true); wd.disabled = false; } return; }
      if (t.closest('#lgEditProfile')) { const p = await openProfileSheet({ profile: state.profile, suggested: state.suggested }); if (p) { state.profile = p; refresh(); } return; }
      if (t.closest('[data-create-listing]')) { openEditor(); return; }
      if (t.closest('[data-edit-listing]')) { openEditor(own()); return; }
      if (t.closest('[data-share-kit]')) { const o = own(); if (o) openShareKit(o); return; }
      const hq = t.closest('[data-hq]'); if (hq) { state.hqTab = hq.dataset.hq; $$('[data-hq]').forEach(b => b.classList.toggle('on', b === hq)); renderHqPane(); return; }
      const act = t.closest('[data-hq-act]'); if (act && act.dataset.hqAct) { hqAct(act.dataset.hqAct, act); return; }
      const af = t.closest('[data-appf]'); if (af) { state.appFilter = af.dataset.appf; renderHqPane(); return; }
      const shot = t.closest('[data-shot]'); if (shot) { openLightbox(hqShots, Number(shot.dataset.shot)); return; }
      const lbg = t.closest('[data-lb-gallery]'); if (lbg) { openLightbox((own()?.galleryUrls || []).map(src => ({ src })), Number(lbg.dataset.lbGallery)); return; }
      const sp = t.closest('[data-spots]'); if (sp) { const o = own(), n = Math.max(0, Math.min(50, Number(o?.openSpots || 0) + Number(sp.dataset.spots))); if (o && n !== o.openSpots) quickUpdate({ openSpots: n }); return; }
      if (t.closest('#lgRecruitToggle')) { const o = own(); if (o) quickUpdate({ recruitingOpen: !o.recruitingOpen }); return; }
      const kick = t.closest('[data-kick]'); if (kick) { doKickoff(kick.dataset.kick, kick); return; }
      const ap = t.closest('[data-app]'); if (ap) { decideApp(ap.dataset.app, ap.dataset.status, ap); return; }
      const message = t.closest('[data-message-listing]'); if (message) { requestInboxAccess(() => openInboxForListing(message.dataset.messageListing, message.dataset.applicant || '')); return; }
      const conv = t.closest('[data-inbox-thread]'); if (conv) { state.activeConversationId = conv.dataset.inboxThread; state.inboxMessages = []; renderInbox(); loadInboxMessages(); return; }
      if (t.closest('[data-chat-back]')) { state.activeConversationId = null; renderInbox(); return; }
      const quick = t.closest('[data-quick]'); if (quick) { const i = $('#lgInboxInput'); if (i) { i.value = quick.dataset.quick; i.focus(); } return; }
      if (t.closest('#lgInboxRefresh')) { loadInbox(); return; }
      const appeal = t.closest('[data-appeal-listing]'); if (appeal) { openListingAppeal(appeal.dataset.appealListing); return; }
      if (t.closest('#lgAppsRetry')) { state.ownerApps = null; loadOwnerApps(); return; }
      const cd = t.closest('[data-crew-decide]'); if (cd) { postOwner('crew-decide', { accountId: cd.dataset.account, action: cd.dataset.crewDecide }, 'Updated.', cd); return; }
      const card = t.closest('.lg-card:not(.is-preview)');
      if (card && !t.closest('a,button,input,select,textarea,label,[data-info]')) { const link = card.querySelector('.lg-card-id h3 a'); if (link?.href) location.assign(link.href); }
    });
    document.addEventListener('change', e => { if (e.target.id === 'lgAppSort') { state.appSort = e.target.value; renderHqPane(); } });
    document.addEventListener('submit', e => { if (e.target.id === 'lgInboxForm') sendInboxMessage(e); });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (e.key === '/' && !typing && state.view === 'board' && !document.querySelector('.lg-modal')) { e.preventDefault(); setTab('leagues'); $('#fQ').focus(); }
      if (e.target.id === 'lgInboxInput' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#lgInboxForm').requestSubmit();
    });
    $('#lgPalBtn')?.addEventListener('click', openPalette);
    setInterval(() => {
      let expired = false;
      for (const n of $$('[data-until]')) { const left = Number(n.dataset.until) - Date.now(); if (left <= 0) expired = true; else n.textContent = clock(left); }
      if (expired && state.tab === 'owner') renderOwner();
    }, 30000);
  }

  // ───────────── start ─────────────
  buildOptions(); filtersFromUrl(); syncControls(); bindFilters(); bindGlobal(); bindInfo(); bindCardFx();
  try { const boot = JSON.parse(document.getElementById('lgBoot')?.textContent || 'null'); if (boot?.leagues) ingestPublic(boot); } catch { /* the live request below fills the board */ }
  const urlTab = new URLSearchParams(location.search).get('tab'); if (urlTab && urlTab !== 'spotlight') state.tab = urlTab;
  renderHero(); renderTabs(); renderLeagues();
  if (urlTab === 'spotlight') setTimeout(() => $('#lgSpot')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
  loadPublic({ silent: true });
  const editorOnce = () => { try { if (sessionStorage.getItem('lg-ed')) return true; sessionStorage.setItem('lg-ed', '1'); return false; } catch { return false; } };
  loadPersonal().then(() => {
    if (urlTab === 'owner' && state.signedIn) { state.tab = 'owner'; renderTabs(); renderOwner(); if (!own() && !editorOnce()) openEditor(); }
    if (['apps', 'saved', 'players'].includes(urlTab) && state.signedIn) activateTab(urlTab);
    if (urlTab === 'inbox') { if (state.signedIn) requestInboxAccess(() => activateTab('inbox')); else location.href = signInUrl('/leagues/?tab=inbox'); }
  });
  accountAuth.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') { Object.assign(state, { signedIn: false, loadedPersonal: false, profile: null, ownListings: [], inboxThreads: [], unreadMessages: 0, inboxMessages: [], activeConversationId: null, savedCount: 0 }); loadPublic({ silent: true }); refresh(); }
    if (event === 'SIGNED_IN' && !state.signedIn) loadPersonal();
  });
}
