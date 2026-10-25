// Editorial Studio — boot, routing and shell.
import { S, api, esc, $, $$, icon, toast, go, pulse, paintBadges, isStaff, initials, loadList } from './core.js';
import { homeView, libraryView, inboxView, teamView, guideView, openPalette, newArticleDialog } from './views.js';
import { writeView, leaveWrite } from './write.js';

const app = document.getElementById('app');

async function boot() {
  let me = null;
  for (const base of ['/api/admin/editorial', '/api/creator/editorial']) {
    try {
      const res = await fetch(base + '/me', { credentials: 'same-origin' });
      if (res.ok) { me = await res.json(); S.base = base; break; }
    } catch { /* try the next */ }
  }
  if (!me) {
    app.innerHTML = '<div class="page" style="max-width:520px;margin-top:12vh"><div class="card panel" style="padding:34px;text-align:center"><div class="eyebrow">Editorial Studio</div><h2 style="font:700 26px var(--display);margin:10px 0">Please sign in</h2><p style="color:var(--mute)">Your session has ended or you are not signed in yet.</p><div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap"><a class="btn primary" href="/admin/login.html">Admin sign in</a><a class="btn" href="/creator/login">Writer sign in</a></div></div></div>';
    return;
  }
  S.me = me;
  const staff = isStaff();
  const nav = [['#/', 'home', 'Home'], ['#/library', 'library', 'Articles'], ...(staff ? [['#/review', 'review', 'Review']] : []), ['#/inbox', 'inbox', 'Inbox'], ...(staff ? [['#/team', 'team', 'Team']] : []), ['#/guide', 'guide', 'Guide']];
  app.innerHTML = '<div class="shell"><nav class="rail" aria-label="Studio"><a class="rail-logo" href="#/" aria-label="Studio home">FC</a>'
    + nav.map(([h, ic, l]) => '<a class="nav" href="' + h + '" data-nav="' + h + '">' + icon(ic, 20) + '<span>' + l + '</span>' + (ic === 'inbox' ? '<b class="badge" id="badge-inbox" hidden></b>' : ic === 'review' ? '<b class="badge" id="badge-review" hidden></b>' : '') + '</a>').join('')
    + '<span class="spacer"></span><a class="nav" href="' + (staff ? '/admin/dashboard.html' : '/admin/dashboard.html') + '">' + icon('external', 20) + '<span>Admin</span></a></nav>'
    + '<div class="main"><header class="topbar"><h1 id="page-title">Editorial Studio</h1><span class="grow"></span><button class="search-btn" id="open-palette" aria-label="Search and commands">' + icon('search', 16) + '<span>Search or jump to…</span><kbd>Ctrl K</kbd></button><button class="btn primary sm" id="top-new">' + icon('plus', 15) + '<span class="hide-sm"> New</span></button><div class="me" title="' + esc(me.role) + '"><span class="avatar">' + esc(initials(me.name)) + '</span><span>' + esc(me.name) + '</span></div></header><main id="view" tabindex="-1"></main></div></div>';
  $('#open-palette').onclick = openPalette; $('#top-new').onclick = () => newArticleDialog();
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !e.defaultPrevented) { e.preventDefault(); openPalette(); } });
  window.addEventListener('hashchange', route);
  const q = new URLSearchParams(location.search);
  if (q.get('edit')) history.replaceState(null, '', location.pathname + '#/write/' + encodeURIComponent(q.get('edit')));
  else if (q.get('new')) { history.replaceState(null, '', location.pathname + '#/'); setTimeout(() => newArticleDialog(), 200); }
  await pulse(); loadList().catch(() => {});
  route();
  setInterval(async () => { if (!document.hidden) { await pulse(); } }, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pulse(); });
}

let routeSeq = 0;
async function route() {
  const seq = ++routeSeq; S.seq = seq;
  leaveWrite();
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?'); const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  const key = parts[0] || '';
  $$('.rail .nav').forEach((a) => { const h = a.dataset.nav; if (!h) return; const active = h === '#/' ? key === '' : key === h.slice(2) || (h === '#/library' && key === 'write'); a.classList.toggle('on', active); a.setAttribute('aria-current', active ? 'page' : 'false'); });
  const title = { '': 'Home', library: 'Articles', review: 'Review queue', inbox: 'Inbox', team: 'Team', guide: 'Style guide', write: 'Editor' }[key] || 'Studio';
  $('#page-title').textContent = title; document.title = title + ' · Editorial Studio';
  try {
    if (key === '') await homeView();
    else if (key === 'library') await libraryView(params);
    else if (key === 'review') { if (!isStaff()) return go('#/'); await libraryView(params, { title: 'Review', fixed: 'in_review' }); }
    else if (key === 'inbox') await inboxView();
    else if (key === 'team') await teamView();
    else if (key === 'guide') await guideView();
    else if (key === 'write' && parts[1]) { if (seq === routeSeq) await writeView(Number(parts[1])); }
    else go('#/');
  } catch (e) { console.error(e); $('#view').innerHTML = '<div class="page"><div class="empty card"><h3>Something went wrong</h3><span>' + esc(e.message) + '</span><button class="btn" onclick="location.reload()">Reload</button></div></div>'; }
  if (seq === routeSeq && key !== 'write') window.scrollTo(0, 0);
}

boot();
