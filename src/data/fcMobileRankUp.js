export const RANKS = [
  { "value": 0, "name": "Base" },
  { "value": 1, "name": "Green" },
  { "value": 2, "name": "Blue" },
  { "value": 3, "name": "Purple" },
  { "value": 4, "name": "Red" },
  { "value": 5, "name": "Orange" }
];

export const RANK_COSTS = [
  { "min": 110, "max": null, "label": "110+", "costs": [140, 280, 420, 560, 700] },
  { "min": 105, "max": 109, "label": "105–109", "costs": [120, 240, 360, 480, 600] },
  { "min": 100, "max": 104, "label": "100–104", "costs": [100, 200, 300, 400, 500] },
  { "min": 95, "max": 99, "label": "95–99", "costs": [80, 160, 240, 320, 400] },
  { "min": 90, "max": 94, "label": "90–94", "costs": [60, 120, 180, 240, 300] },
  { "min": 85, "max": 89, "label": "85–89", "costs": [40, 80, 120, 160, 200] },
  { "min": 0, "max": 84, "label": "84 or lower", "costs": [20, 40, 60, 80, 100] }
];

export function getRankBracket(baseOVR) {
  const value = Number(baseOVR);
  if (!Number.isInteger(value) || value < 0) return null;
  return RANK_COSTS.find((item) => value >= item.min && (item.max === null || value <= item.max)) ?? null;
}
