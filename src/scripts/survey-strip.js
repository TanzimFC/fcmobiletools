// Small "surveys are open" banner shared by the Quests, Rewards and Profile pages.
// A page opts in by rendering <div id="surveyStrip"></div>. The banner stays
// hidden for guests, unverified accounts, and when no survey is open.
import '../styles/survey-strip.css';
import { accountAuth, accountApi, escapeHtml as esc } from '../lib/account-client.js';

let mounting = false;

async function mount(el) {
  if (mounting || el.dataset.svMounted) return;
  mounting = true;
  try {
    const session = await accountAuth.auth.getSession();
    if (!session.data?.session) return;
    const res = await accountApi('/api/account/surveys');
    if (!res.ok) return;
    const body = await res.json().catch(() => null);
    const open = (body?.surveys || []).filter((s) => s.state === 'available');
    el.dataset.svMounted = '1';
    if (!open.length) return;
    const xp = open.reduce((n, s) => n + Number(s.rewardXp || 0), 0);
    const tk = open.reduce((n, s) => n + Number(s.rewardTokens || 0), 0);
    const parts = [];
    if (xp > 0) parts.push('+' + xp.toLocaleString() + ' XP');
    if (tk > 0) parts.push('+' + tk.toLocaleString() + ' Tokens');
    el.innerHTML =
      '<a class="svs" href="/surveys/">' +
      '<span class="svs-ico"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="17" rx="2.5"/><path d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7M9.5 11h5M9.5 15h3"/></svg></span>' +
      '<span class="svs-text"><strong>' + esc(open.length === 1 ? '1 survey is open' : open.length + ' surveys are open') + '</strong>' +
      '<small>' + esc(parts.length ? 'Answer honestly and earn ' + parts.join(' and ') + '.' : 'Tell us what you think.') + '</small></span>' +
      '<span class="svs-go">Take survey</span></a>';
    el.classList.add('svs-on');
  } catch {
    // The banner is optional. Never break the host page.
  } finally {
    mounting = false;
  }
}

function scan() {
  const el = document.getElementById('surveyStrip');
  if (el && !el.dataset.svMounted) mount(el);
}

scan();
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
