// Generates the house ad artwork in public/assets/ads/.
// Run: node scripts/make-ad-art.mjs
//
// Every theme is drawn in three sizes so one artwork set fits every slot:
//   <slug>-wide.svg    1200 x 400   desktop banners and strips (focal point on the right, text goes left)
//   <slug>-card.svg     800 x 450   mobile cards and in-article cards (focal point centred)
//   <slug>-square.svg   400 x 400   compact thumbnails
// The art has no text in it on purpose. The headline and button are real page text, so they translate,
// fill live values and stay readable by screen readers.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'ads');
mkdirSync(OUT, { recursive: true });

const SIZES = {
  wide: { w: 1200, h: 400, fx: 880, fy: 200, s: 1.3 },
  card: { w: 800, h: 450, fx: 400, fy: 222, s: 1.42 },
  square: { w: 400, h: 400, fx: 200, fy: 204, s: 1.14 }
};

function rng(seed) {
  let a = [...seed].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const f = (n) => Math.round(n * 10) / 10;
const sparkle = (x, y, r, o = 0.9) => `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="#fff" opacity="${o}"/>`;
const star = (cx, cy, R, r, fill, extra = '') => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rad = i % 2 ? r : R; return `${f(cx + rad * Math.cos(a))},${f(cy + rad * Math.sin(a))}`; }).join(' ');
  return `<polygon points="${pts}" fill="${fill}" ${extra}/>`;
};

/* ---------------- motifs: drawn around (0,0), roughly 240 x 240 ---------------- */
const M = {
  gift: () => `
    <rect x="-62" y="-6" width="124" height="82" rx="12" fill="url(#acc)"/>
    <rect x="-62" y="-6" width="124" height="82" rx="12" fill="url(#glass)"/>
    <rect x="-74" y="-42" width="148" height="38" rx="10" fill="url(#acc)"/>
    <rect x="-74" y="-42" width="148" height="38" rx="10" fill="url(#glass)" stroke="#fff" stroke-opacity=".3"/>
    <rect x="-11" y="-42" width="22" height="118" fill="#fff" opacity=".92"/>
    <path d="M0 -42C-24 -96 -78 -80 -44 -46Z" fill="#fff" opacity=".95"/>
    <path d="M0 -42C24 -96 78 -80 44 -46Z" fill="#fff" opacity=".82"/>
    <circle cx="0" cy="-44" r="10" fill="url(#acc)" stroke="#fff" stroke-width="3"/>
    ${[[-96, -70, 14, -20], [92, -58, 12, 25], [-108, 20, 10, 40], [104, 30, 14, -35], [-30, -112, 10, 15], [48, -108, 12, -10]]
      .map(([x, y, s, r], i) => `<rect x="${x}" y="${y}" width="${s}" height="${s * 0.45}" rx="2" fill="${i % 2 ? 'var(--c2)' : '#fff'}" transform="rotate(${r} ${x} ${y})" opacity=".9"/>`).join('')}
    ${sparkle(-84, -40, 11)}${sparkle(88, 8, 9)}${sparkle(70, -92, 8, .7)}`,

  ticket: () => `
    <mask id="tk"><rect x="-120" y="-70" width="240" height="140" fill="#fff"/><circle cx="-100" cy="0" r="17" fill="#000"/><circle cx="100" cy="0" r="17" fill="#000"/></mask>
    <g transform="rotate(-6)">
      <g mask="url(#tk)"><rect x="-100" y="-56" width="200" height="112" rx="16" fill="url(#acc)"/><rect x="-100" y="-56" width="200" height="112" rx="16" fill="url(#glass)"/></g>
      <rect x="-100" y="-56" width="200" height="112" rx="16" fill="none" stroke="#fff" stroke-opacity=".35" mask="url(#tk)"/>
      <line x1="46" y1="-44" x2="46" y2="44" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-dasharray="5 7"/>
      <rect x="-76" y="-34" width="96" height="14" rx="7" fill="#fff" opacity=".95"/>
      <rect x="-76" y="-8" width="66" height="14" rx="7" fill="#fff" opacity=".55"/>
      <rect x="-76" y="18" width="80" height="14" rx="7" fill="#fff" opacity=".32"/>
      <circle cx="73" cy="0" r="20" fill="#fff"/>
      <path d="M63 1l8 8 14-17" fill="none" stroke="var(--c1)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <g transform="translate(-76 84) rotate(8)"><rect x="-44" y="-15" width="88" height="30" rx="15" fill="url(#glass)" stroke="#fff" stroke-opacity=".3"/><rect x="-30" y="-4" width="40" height="8" rx="4" fill="#fff" opacity=".8"/></g>
    <g transform="translate(92 -88) rotate(-10)"><rect x="-40" y="-14" width="80" height="28" rx="14" fill="url(#glass)" stroke="#fff" stroke-opacity=".3"/><rect x="-26" y="-4" width="34" height="8" rx="4" fill="#fff" opacity=".8"/></g>
    ${sparkle(-104, -64, 12)}${sparkle(112, 66, 9)}`,

  bell: () => `
    ${[0, 1, 2].map((i) => `<path d="M${74 + i * 22} -${26 + i * 16}Q${96 + i * 22} 0 ${74 + i * 22} ${26 + i * 16}" fill="none" stroke="var(--c1)" stroke-width="7" stroke-linecap="round" opacity="${0.75 - i * 0.22}"/><path d="M-${74 + i * 22} -${26 + i * 16}Q-${96 + i * 22} 0 -${74 + i * 22} ${26 + i * 16}" fill="none" stroke="var(--c1)" stroke-width="7" stroke-linecap="round" opacity="${0.75 - i * 0.22}"/>`).join('')}
    <path d="M0 -74C-42 -74 -58 -38 -58 0V26L-74 48H74L58 26V0C58 -38 42 -74 0 -74Z" fill="url(#acc)"/>
    <path d="M0 -74C-42 -74 -58 -38 -58 0V26L-74 48H74L58 26V0C58 -38 42 -74 0 -74Z" fill="url(#glass)" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
    <path d="M-34 -30C-30 -50 -14 -60 6 -62" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="6" stroke-linecap="round"/>
    <circle cx="0" cy="-82" r="9" fill="url(#acc)" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <path d="M-17 54a17 17 0 0034 0Z" fill="#fff" opacity=".92"/>
    <circle cx="46" cy="-52" r="22" fill="#ff5d6c" stroke="#0a131c" stroke-width="6"/>
    <rect x="41" y="-64" width="10" height="16" rx="5" fill="#fff"/><circle cx="46" cy="-38" r="5" fill="#fff"/>
    ${sparkle(-98, -70, 11)}${sparkle(100, 56, 9)}`,

  trophy: () => `
    <path d="M-58 -64H58V-12C58 24 32 44 0 44C-32 44 -58 24 -58 -12Z" fill="url(#acc)"/>
    <path d="M-58 -64H58V-12C58 24 32 44 0 44C-32 44 -58 24 -58 -12Z" fill="url(#glass)" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
    <path d="M-58 -50H-92C-92 -8 -78 12 -52 14M58 -50H92C92 -8 78 12 52 14" fill="none" stroke="var(--c1)" stroke-width="12" stroke-linecap="round"/>
    <rect x="-12" y="44" width="24" height="34" fill="url(#acc)"/>
    <rect x="-46" y="76" width="92" height="22" rx="8" fill="url(#acc)" stroke="#fff" stroke-opacity=".35"/>
    ${star(0, -20, 30, 13, '#fff', 'opacity=".95"')}
    <path d="M-40 -52C-34 -30 -26 -10 -10 4" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="6" stroke-linecap="round"/>
    ${sparkle(-100, -82, 12)}${sparkle(102, -70, 10)}${sparkle(92, 66, 8, .7)}${sparkle(-96, 58, 8, .7)}`,

  radar: () => {
    const pt = (i, r) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [f(r * Math.cos(a)), f(r * Math.sin(a))]; };
    const ring = (r) => Array.from({ length: 6 }, (_, i) => pt(i, r).join(',')).join(' ');
    const vals = [88, 70, 96, 62, 84, 76];
    const poly = vals.map((v, i) => pt(i, v).join(',')).join(' ');
    return `
    <polygon points="${ring(104)}" fill="url(#glass)" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>
    <polygon points="${ring(70)}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>
    <polygon points="${ring(36)}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="2"/>
    ${Array.from({ length: 6 }, (_, i) => `<line x1="0" y1="0" x2="${pt(i, 104)[0]}" y2="${pt(i, 104)[1]}" stroke="#fff" stroke-opacity=".16"/>`).join('')}
    <polygon points="${poly}" fill="url(#acc)" fill-opacity=".62" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    ${vals.map((v, i) => `<circle cx="${pt(i, v)[0]}" cy="${pt(i, v)[1]}" r="7" fill="#fff" stroke="var(--c1)" stroke-width="3"/>`).join('')}
    <circle cx="0" cy="0" r="22" fill="#0a131c" stroke="url(#acc)" stroke-width="5"/>
    <path d="M-9 0l7 7 13-15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${sparkle(-118, -70, 11)}${sparkle(116, 72, 9)}`;
  },

  bolt: () => `
    <rect x="-8" y="-72" width="128" height="26" rx="13" fill="url(#glass)" stroke="#fff" stroke-opacity=".28"/>
    <rect x="-8" y="-72" width="88" height="26" rx="13" fill="url(#acc)"/>
    <rect x="-8" y="-12" width="128" height="26" rx="13" fill="url(#glass)" stroke="#fff" stroke-opacity=".28"/>
    <rect x="-8" y="-12" width="56" height="26" rx="13" fill="url(#acc)" opacity=".85"/>
    <rect x="-8" y="48" width="128" height="26" rx="13" fill="url(#glass)" stroke="#fff" stroke-opacity=".28"/>
    <rect x="-8" y="48" width="112" height="26" rx="13" fill="url(#acc)"/>
    ${[[96, -59], [66, 1], [124, 61]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff" opacity=".9"/>`).join('')}
    <circle cx="-62" cy="0" r="62" fill="#0a131c" stroke="url(#acc)" stroke-width="6"/>
    <circle cx="-62" cy="0" r="62" fill="url(#glass)"/>
    <polygon points="-52,-44 -86,6 -64,6 -74,46 -38,-8 -60,-8" fill="url(#acc)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
    ${sparkle(-124, -72, 10)}${sparkle(122, -92, 9)}`,

  chevrons: () => `
    <path d="M0 -104L84 -66V12C84 56 44 90 0 106C-44 90 -84 56 -84 12V-66Z" fill="url(#glass)" stroke="#fff" stroke-opacity=".32" stroke-width="2"/>
    ${[0, 1, 2].map((i) => `<path d="M-46 ${-6 + i * 34}L0 ${-48 + i * 34}L46 ${-6 + i * 34}" fill="none" stroke="url(#acc)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" opacity="${1 - i * 0.28}"/>`).join('')}
    ${star(0, -82, 16, 7, '#fff')}
    ${star(-104, -30, 9, 4, '#fff', 'opacity=".7"')}${star(106, 20, 7, 3, '#fff', 'opacity=".6"')}
    ${sparkle(100, -78, 10)}${sparkle(-98, 70, 9)}`,

  crystal: () => `
    <polygon points="0,-110 44,-34 28,76 -28,76 -44,-34" fill="url(#acc)"/>
    <polygon points="0,-110 44,-34 0,-18" fill="#fff" opacity=".5"/>
    <polygon points="0,-110 -44,-34 0,-18" fill="#fff" opacity=".22"/>
    <polygon points="-44,-34 0,-18 -28,76" fill="#000" opacity=".16"/>
    <polygon points="44,-34 0,-18 28,76" fill="#fff" opacity=".12"/>
    <polygon points="0,-18 28,76 -28,76" fill="url(#glass)"/>
    <polygon points="0,-110 44,-34 28,76 -28,76 -44,-34" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linejoin="round"/>
    <g transform="translate(-74 34)"><polygon points="0,-58 26,-14 16,44 -16,44 -26,-14" fill="url(#acc)" opacity=".85"/><polygon points="0,-58 26,-14 0,-4" fill="#fff" opacity=".4"/><polygon points="0,-58 26,-14 16,44 -16,44 -26,-14" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/></g>
    <g transform="translate(76 46)"><polygon points="0,-44 20,-10 12,34 -12,34 -20,-10" fill="url(#acc)" opacity=".8"/><polygon points="0,-44 20,-10 0,-2" fill="#fff" opacity=".4"/><polygon points="0,-44 20,-10 12,34 -12,34 -20,-10" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/></g>
    ${sparkle(-34, -100, 12)}${sparkle(100, -40, 10)}${sparkle(-110, -30, 8, .7)}${sparkle(40, 100, 9, .8)}`,

  route: () => `
    <path d="M-104 62C-60 62 -66 -2 -22 -2C22 -2 18 -62 64 -62C86 -62 96 -52 104 -44" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="16" stroke-linecap="round"/>
    <path d="M-104 62C-60 62 -66 -2 -22 -2C22 -2 18 -62 64 -62C86 -62 96 -52 104 -44" fill="none" stroke="url(#acc)" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 16"/>
    ${[[-104, 62, 15], [-22, -2, 19], [64, -62, 23]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#0a131c" stroke="url(#acc)" stroke-width="6"/><circle cx="${x}" cy="${y}" r="${r * 0.38}" fill="#fff"/>`).join('')}
    <g transform="translate(106 -50)"><rect x="-3" y="-60" width="6" height="64" rx="3" fill="#fff"/><path d="M3 -60L50 -46L3 -30Z" fill="url(#acc)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></g>
    ${sparkle(-104, -60, 11)}${sparkle(20, 74, 9)}${sparkle(112, 60, 8, .7)}`,

  armband: () => `
    <rect x="-108" y="-46" width="216" height="92" rx="22" fill="url(#acc)"/>
    <rect x="-108" y="-46" width="216" height="92" rx="22" fill="url(#glass)" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
    <rect x="-108" y="-46" width="30" height="92" rx="14" fill="#000" opacity=".2"/><rect x="78" y="-46" width="30" height="92" rx="14" fill="#000" opacity=".2"/>
    <circle cx="0" cy="0" r="40" fill="#0a131c" opacity=".9"/>
    <path d="M24 -20A30 30 0 1 0 24 20" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/>
    ${star(0, -78, 17, 7, '#fff')}${star(-44, -70, 9, 4, '#fff', 'opacity=".6"')}${star(44, -70, 9, 4, '#fff', 'opacity=".6"')}
    <rect x="-70" y="62" width="140" height="10" rx="5" fill="#fff" opacity=".18"/>
    ${sparkle(-116, -62, 11)}${sparkle(118, 56, 9)}`,

  candles: () => {
    const c = [[-98, 34, 72, 14, 1], [-66, 18, 70, 14, 0], [-34, 4, 54, 12, 1], [-2, -10, 36, 14, 1], [30, -34, 24, 12, 0], [62, -62, 20, 14, 1], [94, -88, 18, 12, 1]];
    return `
    <path d="M-106 52C-66 36 -40 22 -4 -2C26 -22 48 -42 108 -92" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3" stroke-dasharray="6 8"/>
    ${c.map(([x, top, bot, w, up]) => `<line x1="${x}" y1="${top - 14}" x2="${x}" y2="${top + bot * 0.0 + 38 + 8}" stroke="${up ? 'var(--c1)' : '#ff6b78'}" stroke-width="4" stroke-linecap="round" transform="translate(0 ${top > 0 ? 6 : 0})"/><rect x="${x - w / 2}" y="${top}" width="${w}" height="${34 + (up ? 12 : 0)}" rx="4" fill="${up ? 'url(#acc)' : '#ff6b78'}" stroke="#fff" stroke-opacity=".3"/>`).join('')}
    <circle cx="96" cy="-100" r="22" fill="#0a131c" stroke="url(#acc)" stroke-width="5"/>
    ${star(96, -100, 12, 5, '#fff')}
    ${sparkle(-116, -60, 11)}${sparkle(112, 70, 9)}`;
  },

  calendar: () => `
    <rect x="-90" y="-80" width="180" height="170" rx="22" fill="url(#glass)" stroke="#fff" stroke-opacity=".32" stroke-width="2"/>
    <path d="M-90 -58C-90 -70 -80 -80 -68 -80H68C80 -80 90 -70 90 -58V-30H-90Z" fill="url(#acc)"/>
    <rect x="-52" y="-98" width="12" height="32" rx="6" fill="#fff"/><rect x="40" y="-98" width="12" height="32" rx="6" fill="#fff"/>
    ${Array.from({ length: 12 }, (_, i) => { const x = -57 + (i % 4) * 38, y = -2 + Math.floor(i / 4) * 32; return i === 6 ? `<circle cx="${x}" cy="${y}" r="17" fill="url(#acc)" stroke="#fff" stroke-width="3"/>` : `<circle cx="${x}" cy="${y}" r="5" fill="#fff" opacity="${i % 3 ? 0.4 : 0.65}"/>`; }).join('')}
    <circle cx="82" cy="72" r="38" fill="#0a131c" stroke="url(#acc)" stroke-width="6"/>
    <path d="M82 50V73L98 83" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    ${sparkle(-108, -70, 11)}${sparkle(112, -52, 9)}`,

  megaphone: () => `
    <path d="M-74 -22L52 -78V78L-74 22Z" fill="url(#acc)" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linejoin="round"/>
    <path d="M-74 -22L52 -78V78L-74 22Z" fill="url(#glass)"/>
    <rect x="-106" y="-26" width="36" height="52" rx="12" fill="#fff" opacity=".95"/>
    <rect x="52" y="-90" width="16" height="180" rx="8" fill="#fff" opacity=".92"/>
    <path d="M-58 26L-40 82H-6L-20 32Z" fill="url(#acc)" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linejoin="round"/>
    ${[0, 1, 2].map((i) => `<path d="M${88 + i * 20} -${22 + i * 16}Q${108 + i * 20} 0 ${88 + i * 20} ${22 + i * 16}" fill="none" stroke="var(--c1)" stroke-width="7" stroke-linecap="round" opacity="${0.8 - i * 0.24}"/>`).join('')}
    ${[[-30, 92, 14], [-10, 78, 28], [10, 62, 44]].map(([x, y, h]) => `<rect x="${x + 90}" y="${y + 18 - h}" width="14" height="${h}" rx="4" fill="#fff" opacity=".55"/>`).join('')}
    ${sparkle(-90, -74, 11)}${sparkle(108, 86, 9)}`,

  crown: () => `
    <path d="M-92 52L-104 -50L-48 -6L0 -76L48 -6L104 -50L92 52Z" fill="url(#acc)" stroke="#fff" stroke-opacity=".4" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M-92 52L-104 -50L-48 -6L0 -76L48 -6L104 -50L92 52Z" fill="url(#glass)"/>
    <path d="M-48 -6L-24 52M48 -6L24 52M0 -76V52" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>
    <rect x="-92" y="52" width="184" height="30" rx="12" fill="url(#acc)" stroke="#fff" stroke-opacity=".4" stroke-width="2"/>
    ${[[-104, -56], [0, -86], [104, -56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#fff"/>`).join('')}
    ${[-52, 0, 52].map((x) => `<circle cx="${x}" cy="67" r="8" fill="#0a131c" stroke="#fff" stroke-width="3"/>`).join('')}
    ${sparkle(-118, -88, 13)}${sparkle(120, -14, 10)}${sparkle(-110, 62, 9, .7)}${sparkle(40, -104, 9, .8)}`,

  pitch: () => `
    <g transform="matrix(1 0 -0.28 0.78 0 4)">
      <rect x="-112" y="-78" width="224" height="156" rx="14" fill="url(#acc)" opacity=".92"/>
      <rect x="-112" y="-78" width="224" height="156" rx="14" fill="url(#glass)" stroke="#fff" stroke-opacity=".5" stroke-width="2.5"/>
      <g fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3">
        <line x1="0" y1="-78" x2="0" y2="78"/><circle cx="0" cy="0" r="26"/>
        <rect x="-112" y="-40" width="42" height="80"/><rect x="70" y="-40" width="42" height="80"/>
        <rect x="-112" y="-18" width="16" height="36"/><rect x="96" y="-18" width="16" height="36"/>
      </g>
    </g>
    <circle cx="58" cy="-46" r="24" fill="#fff"/><circle cx="58" cy="-46" r="24" fill="url(#glass)" stroke="#0a131c" stroke-width="3"/>
    <polygon points="58,-58 69,-50 65,-37 51,-37 47,-50" fill="#0a131c"/>
    ${sparkle(-110, -82, 11)}${sparkle(112, 70, 9)}`
};

const SETS = [
  { slug: 'redeem-codes', motif: 'ticket', c1: '#f5c451', c2: '#ff9a3c' },
  { slug: 'alerts', motif: 'bell', c1: '#4cc9ff', c2: '#7a8cff' },
  { slug: 'giveaways', motif: 'gift', c1: '#9a8cff', c2: '#f5c451' },
  { slug: 'giveaway-trophy', motif: 'trophy', c1: '#f5c451', c2: '#ff7a3c' },
  { slug: 'team-ovr', motif: 'radar', c1: '#4cc9ff', c2: '#3d7bff' },
  { slug: 'training', motif: 'bolt', c1: '#47d16c', c2: '#4cc9ff' },
  { slug: 'rank-up', motif: 'chevrons', c1: '#f5c451', c2: '#ff7a3c' },
  { slug: 'shards', motif: 'crystal', c1: '#9a8cff', c2: '#4cc9ff' },
  { slug: 'gauntlet', motif: 'route', c1: '#4cc9ff', c2: '#47d16c' },
  { slug: 'captain', motif: 'armband', c1: '#f5c451', c2: '#ffdf8a' },
  { slug: 'investment', motif: 'candles', c1: '#47d16c', c2: '#2bb3a3' },
  { slug: 'events', motif: 'calendar', c1: '#4cc9ff', c2: '#9a8cff' },
  { slug: 'advertise', motif: 'megaphone', c1: '#9a8cff', c2: '#ff6fb0' },
  { slug: 'premium', motif: 'crown', c1: '#f5c451', c2: '#ffdf8a' },
  { slug: 'football-centre', motif: 'pitch', c1: '#3ddc84', c2: '#1fa0a0' }
];

function svg(set, name, { w, h, fx, fy, s }) {
  const r = rng(set.slug + name);
  const wide = name === 'wide';
  const dots = Array.from({ length: wide ? 46 : 28 }, () => {
    const x = r() * w, y = r() * h;
    const near = Math.hypot(x - fx, y - fy) < 90 * s;
    return near ? '' : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.8 + r() * 2.2)}" fill="#fff" opacity="${f(0.1 + r() * 0.4)}"/>`;
  }).join('');
  const rings = [1.5, 2.3, 3.2].map((k, i) => `<circle cx="${fx}" cy="${fy}" r="${f(70 * s * k)}" fill="none" stroke="url(#acc)" stroke-opacity="${f(0.2 - i * 0.05)}" stroke-width="${2 - i * 0.4}"/>`).join('');
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-hidden="true" style="--c1:${set.c1};--c2:${set.c2}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#060c13"/><stop offset=".55" stop-color="#0a1824"/><stop offset="1" stop-color="#0d2233"/></linearGradient>
  <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${set.c1}"/><stop offset="1" stop-color="${set.c2}"/></linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity=".14"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${set.c1}" stop-opacity=".62"/><stop offset=".45" stop-color="${set.c2}" stop-opacity=".2"/><stop offset="1" stop-color="${set.c2}" stop-opacity="0"/></radialGradient>
  <radialGradient id="glow2" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4cc9ff" stop-opacity=".22"/><stop offset="1" stop-color="#4cc9ff" stop-opacity="0"/></radialGradient>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#fff" stroke-opacity=".04"/></pattern>
  <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <filter id="drop" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".5"/></filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#bg)"/>
<rect width="${w}" height="${h}" fill="url(#grid)"/>
<circle cx="${wide ? 120 : w * 0.12}" cy="${h * 0.9}" r="${h * 0.9}" fill="url(#glow2)"/>
<circle cx="${fx}" cy="${fy}" r="${f(h * 1.05)}" fill="url(#glow)"/>
<polygon points="${f(w * 0.35)},0 ${f(w * 0.5)},0 ${f(w * 0.3)},${h} ${f(w * 0.15)},${h}" fill="url(#sweep)"/>
${rings}
${dots}
<g transform="translate(${fx} ${fy}) scale(${s})" filter="url(#drop)">${M[set.motif]()}</g>
<rect width="${w}" height="${h}" fill="none" stroke="#fff" stroke-opacity=".06"/>
</svg>
`;
  return out.replace(/var\(--c1\)/g, set.c1).replace(/var\(--c2\)/g, set.c2);
}

let count = 0;
for (const set of SETS) for (const [name, size] of Object.entries(SIZES)) {
  writeFileSync(join(OUT, `${set.slug}-${name}.svg`), svg(set, name, size));
  count += 1;
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(SETS.map(({ slug, motif, c1, c2 }) => ({ slug, motif, c1, c2 })), null, 2) + '\n');
console.log(`Wrote ${count} artwork files to ${OUT}`);
