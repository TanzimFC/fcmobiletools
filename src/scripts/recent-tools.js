// "Pick up where you left off": remembers which tools a visitor opened, in their own browser only.
// Nothing is sent anywhere. The homepage shows the list when there is one.
import { TOOLS, ACCENTS, iconSvg } from '../data/siteTools.js';

const KEY = 'fcmt.recent-tools.v1';
const MAX = 4;

const read = () => {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((id) => TOOLS.some((t) => t.id === id)).slice(0, MAX) : [];
  } catch { return []; }
};
const write = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* storage can be blocked */ } };

const normalise = (path) => (path.replace(/^\/(bn|id|pt-br)(?=\/)/, '').replace(/\/+$/, '') || '/');
const here = normalise(location.pathname);

// Record a visit to a tool page (not the directory pages themselves).
const current = TOOLS.find((t) => normalise(t.href) === here && !['giveaways', 'tournaments', 'leagues'].includes(t.id));
if (current) write([current.id, ...read().filter((id) => id !== current.id)]);

// Render on the homepage.
const host = document.querySelector('[data-recent-tools]');
if (host) {
  const items = read().map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean);
  if (items.length) {
    const list = host.querySelector('[data-recent-list]');
    list.replaceChildren(...items.map((t) => {
      const a = document.createElement('a');
      a.href = t.href;
      a.style.setProperty('--ac', ACCENTS[t.accent] || ACCENTS.cyan);
      a.innerHTML = `<span class="hx-recent__ico">${iconSvg(t.icon)}</span><span></span>`;
      a.lastChild.textContent = t.name;
      return a;
    }));
    host.hidden = false;
  }
}
