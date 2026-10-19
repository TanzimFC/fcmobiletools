// Original placeholder artwork for giveaway thumbnails. Replace any of these by setting a
// cover image on the giveaway in the admin panel. No licensed logos or trophies are used.

const defs = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;

// A golden football for the "Ballon d'Or" giveaway.
const ball = `<svg viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs('gwb', '#fff0c4', '#d9972b')}
<ellipse cx="100" cy="206" rx="52" ry="8" fill="#000" opacity=".35"/>
<path d="M66 196h68l-8-22H74z" fill="url(#gwb)" opacity=".9"/>
<circle cx="100" cy="92" r="74" fill="url(#gwb)"/>
<circle cx="100" cy="92" r="74" stroke="#fff6d6" stroke-opacity=".7" stroke-width="2"/>
<path d="M100 58l30 22-11 35H81L70 80z" fill="#a9701a" opacity=".55"/>
<path d="M100 58V20M130 80l36-10M119 115l22 30M81 115l-22 30M70 80L34 70" stroke="#a9701a" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="74" cy="56" rx="22" ry="12" fill="#fff" opacity=".35" transform="rotate(-30 74 56)"/></svg>`;

// A star-in-ticket mark for the "Star Pass" giveaway.
const star = `<svg viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs('gws', '#c9f1ff', '#2aa6e8')}
<path d="M24 40a12 12 0 0112-12h148a12 12 0 0112 12v26a14 14 0 000 28v66a12 12 0 01-12 12H36a12 12 0 01-12-12V94a14 14 0 000-28z" fill="#0d2a3d" stroke="url(#gws)" stroke-width="3"/>
<path d="M110 52l14.6 29.6 32.7 4.8-23.7 23 5.6 32.5L110 126.6l-29.2 15.3 5.6-32.5-23.7-23 32.7-4.8z" fill="url(#gws)"/>
<path d="M60 160h100" stroke="#4cc9ff" stroke-opacity=".5" stroke-width="3" stroke-dasharray="3 7" stroke-linecap="round"/></svg>`;

// A gift for anything else.
const gift = `<svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs('gwg', '#e1dbff', '#8576f0')}
<rect x="30" y="76" width="140" height="30" rx="8" fill="url(#gwg)"/>
<rect x="40" y="106" width="120" height="76" rx="10" fill="#241a52" stroke="url(#gwg)" stroke-width="3"/>
<path d="M100 76v106" stroke="url(#gwg)" stroke-width="12"/>
<path d="M100 76C80 76 62 68 66 52s30-4 34 24zM100 76c20 0 38-8 34-24s-30-4-34 24z" fill="url(#gwg)"/></svg>`;

export const emblem = (kind) => (kind === 'ballon_dor' ? ball : kind === 'star_pass' ? star : gift);
