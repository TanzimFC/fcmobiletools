const UNITS = [
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
];

function cleanCompact(value) {
  return value
    .toFixed(2)
    .replace(/\.00$/, '')
    .replace(/(\.\d)0$/, '$1');
}

export function formatCoins(value, { exact = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';

  const rounded = Math.round(number);
  if (exact || Math.abs(rounded) < 1000) {
    return rounded.toLocaleString('en-US');
  }

  const abs = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';
  const unit = UNITS.find((entry) => abs >= entry.value);

  if (!unit) return rounded.toLocaleString('en-US');

  return `${sign}${cleanCompact(abs / unit.value)}${unit.suffix}`;
}

export function formatCoinsExact(value) {
  return formatCoins(value, { exact: true });
}

export function parseCoinsInput(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  const raw = String(value ?? '')
    .trim()
    .replace(/,/g, '')
    .replace(/\s+/g, '');

  if (!raw) return 0;

  const match = raw.match(/^(\d+(?:\.\d+)?)(k|m|b|t)?$/i);
  if (!match) return 0;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return 0;

  const multiplier = {
    k: 1e3,
    m: 1e6,
    b: 1e9,
    t: 1e12,
  }[(match[2] || '').toLowerCase()] || 1;

  return Math.max(0, Math.round(base * multiplier));
}
