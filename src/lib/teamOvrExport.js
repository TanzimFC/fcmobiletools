/**
 * Draws a shareable squad card on a <canvas>, entirely in the browser.
 * Nothing is uploaded: the image is built from the squad on screen and handed back as a Blob,
 * so exporting costs the server nothing.
 */
import { getFormation, ovrTier, MAX_BENCH_SIZE, STARTING_XI_SIZE } from './teamOvr.js';

export const EXPORT_SIZE = { width: 1080, height: 1350 };

const TIERS = {
  gold: { a: '#f5c351', b: '#9a6516', tone: '#2a1a02', edge: 'rgba(255,236,170,.8)' },
  cyan: { a: '#2a9fd6', b: '#143f66', tone: '#f1fbff', edge: 'rgba(155,231,255,.6)' },
  mint: { a: '#2f9c7c', b: '#154c43', tone: '#ecfff8', edge: 'rgba(130,255,210,.45)' },
  slate: { a: '#53677c', b: '#2a3a4c', tone: '#eaf1f7', edge: 'rgba(255,255,255,.25)' },
  empty: { a: 'rgba(8,20,30,.55)', b: 'rgba(8,20,30,.55)', tone: 'rgba(235,245,255,.55)', edge: 'rgba(255,255,255,.28)' },
};

const DISPLAY = "'Archivo Variable', 'Archivo', system-ui, sans-serif";
const BODY = "'Instrument Sans Variable', 'Instrument Sans', system-ui, sans-serif";

const playerOvrOf = (player) =>
  Number.isFinite(player?.baseOVR) ? player.baseOVR + (Number.isFinite(player.rank) ? player.rank : 0) : null;

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawChip(ctx, cx, cy, w, h, { pos, player }) {
  const ovr = playerOvrOf(player);
  const tier = TIERS[ovr === null ? 'empty' : ovrTier(ovr)];
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  const fill = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  fill.addColorStop(0, tier.a);
  fill.addColorStop(1, tier.b);
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 2;
  ctx.strokeStyle = tier.edge;
  if (ovr === null) ctx.setLineDash([6, 6]);
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = tier.tone;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 17px ${BODY}`;
  ctx.fillText(pos, cx, y + 27);
  ctx.font = `700 ${ovr === null ? 30 : Math.round(h * 0.37)}px ${DISPLAY}`;
  ctx.fillText(ovr === null ? '--' : String(ovr), cx, y + h * 0.66);

  if (ovr !== null) {
    const rank = player.rank || 0;
    for (let i = 0; i < 5; i += 1) {
      ctx.globalAlpha = i < rank ? 1 : 0.22;
      ctx.beginPath();
      ctx.arc(cx - 24 + i * 12, y + h - 14, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawPitch(ctx, x, y, w, h) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 28);
  ctx.clip();
  const stripes = 11;
  for (let i = 0; i < stripes; i += 1) {
    ctx.fillStyle = i % 2 ? '#0c4230' : '#0f4a33';
    ctx.fillRect(x, y + (h / stripes) * i, w, h / stripes + 1);
  }
  const glow = ctx.createRadialGradient(x + w / 2, y, 10, x + w / 2, y, w * 0.8);
  glow.addColorStop(0, 'rgba(255,255,255,.09)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);

  const sx = w / 100;
  const sy = h / 140;
  ctx.strokeStyle = 'rgba(210,255,232,.3)';
  ctx.lineWidth = 2;
  const rect = (rx, ry, rw, rh) => ctx.strokeRect(x + rx * sx, y + ry * sy, rw * sx, rh * sy);
  rect(4, 4, 92, 132);
  rect(22, 4, 56, 21);
  rect(36, 4, 28, 8);
  rect(22, 115, 56, 21);
  rect(36, 128, 28, 8);
  ctx.beginPath();
  ctx.moveTo(x + 4 * sx, y + 70 * sy);
  ctx.lineTo(x + 96 * sx, y + 70 * sy);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + 50 * sx, y + 70 * sy, 12 * sx, 12 * sy, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(94,214,160,.28)';
  roundRect(ctx, x, y, w, h, 28);
  ctx.stroke();
}

/**
 * @param {object} input
 * @param {string} input.formation  formation id
 * @param {Array}  input.starters   [{ baseOVR, rank }]
 * @param {Array}  input.bench      [{ baseOVR, rank }]
 * @param {object} input.summary    result of summarizeSquad()
 * @returns {HTMLCanvasElement}
 */
export function drawSquadCard({ formation, starters, bench, summary }, doc = document) {
  const { width, height } = EXPORT_SIZE;
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#0b1d2a');
  bg.addColorStop(1, '#071018');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const aura = ctx.createRadialGradient(width * 0.82, 0, 20, width * 0.82, 0, 640);
  aura.addColorStop(0, 'rgba(76,201,255,.22)');
  aura.addColorStop(1, 'rgba(76,201,255,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#a7b4c3';
  ctx.font = `600 26px ${BODY}`;
  ctx.fillText('FC Mobile Team OVR', 64, 84);
  ctx.fillStyle = '#f5f8fb';
  ctx.font = `800 128px ${DISPLAY}`;
  const teamOvr = summary?.teamOVR ?? null;
  ctx.fillText(teamOvr === null || teamOvr === undefined ? '--' : String(teamOvr), 60, 206);

  const parts = [];
  if (summary?.exact || summary?.complete) {
    parts.push(['Base', summary.baseAverage], ['Rank', summary.rankAverage], ['Badges', summary.badgeBonus]);
  }
  let px = 64;
  ctx.font = `700 26px ${BODY}`;
  for (const [label, value] of parts) {
    const text = `${label} +${value ?? 0}`;
    const tw = ctx.measureText(text).width + 32;
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    roundRect(ctx, px, 232, tw, 46, 23);
    ctx.fill();
    ctx.fillStyle = '#d4dee7';
    ctx.fillText(text, px + 16, 263);
    px += tw + 10;
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a7b4c3';
  ctx.font = `700 30px ${DISPLAY}`;
  ctx.fillText(getFormation(formation).label, width - 64, 84);
  ctx.textAlign = 'left';

  // Pitch
  const pitchX = 64;
  const pitchY = 310;
  const pitchW = width - 128;
  const pitchH = 760;
  drawPitch(ctx, pitchX, pitchY, pitchW, pitchH);
  const slots = getFormation(formation).slots;
  const chipW = 100;
  const chipH = 112;
  for (let i = 0; i < STARTING_XI_SIZE; i += 1) {
    const slot = slots[i];
    drawChip(ctx, pitchX + (slot.x / 100) * pitchW, pitchY + (slot.y / 100) * pitchH, chipW, chipH, {
      pos: slot.pos,
      player: starters[i],
    });
  }

  // Bench
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a7b4c3';
  ctx.font = `700 22px ${BODY}`;
  ctx.fillText('Bench', 64, 1118);
  const benchW = 96;
  const gap = (width - 128 - benchW * MAX_BENCH_SIZE) / (MAX_BENCH_SIZE - 1);
  for (let i = 0; i < MAX_BENCH_SIZE; i += 1) {
    drawChip(ctx, 64 + benchW / 2 + i * (benchW + gap), 1196, benchW, 112, { pos: `SUB ${i + 1}`, player: bench[i] });
  }

  // Footer
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7f93a6';
  ctx.font = `600 24px ${BODY}`;
  ctx.fillText('Build yours at fcmobiletools.online/team-ovr', 64, 1318);

  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image export failed'))), 'image/png');
    } else {
      reject(new Error('Image export is not supported in this browser'));
    }
  });
}
