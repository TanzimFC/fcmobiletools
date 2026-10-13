const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const ICONS = {
  search: s('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 'class="mag"'),
  arrow: s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  copy: s('<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'),
  finder: s('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8.5 11l1.8 1.8 3.2-3.6"/>'),
  cards: s('<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>'),
  quiz: s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
  bolt: s('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>')
};
