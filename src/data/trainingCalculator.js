export const TRAINING_LEVEL_XP = [
  { level: 0, xp: 0, cumulativeXP: 0 },
  { level: 1, xp: 100, cumulativeXP: 100 },
  { level: 2, xp: 150, cumulativeXP: 250 },
  { level: 3, xp: 200, cumulativeXP: 450 },
  { level: 4, xp: 250, cumulativeXP: 700 },
  { level: 5, xp: 300, cumulativeXP: 1000 },
  { level: 6, xp: 600, cumulativeXP: 1600 },
  { level: 7, xp: 800, cumulativeXP: 2400 },
  { level: 8, xp: 1000, cumulativeXP: 3400 },
  { level: 9, xp: 1200, cumulativeXP: 4600 },
  { level: 10, xp: 1400, cumulativeXP: 6000 },
  { level: 11, xp: 1800, cumulativeXP: 7800 },
  { level: 12, xp: 2200, cumulativeXP: 10000 },
  { level: 13, xp: 2600, cumulativeXP: 12600 },
  { level: 14, xp: 3000, cumulativeXP: 15600 },
  { level: 15, xp: 3400, cumulativeXP: 19000 },
  { level: 16, xp: 4000, cumulativeXP: 23000 },
  { level: 17, xp: 4600, cumulativeXP: 27600 },
  { level: 18, xp: 5200, cumulativeXP: 32800 },
  { level: 19, xp: 5800, cumulativeXP: 38600 },
  { level: 20, xp: 6400, cumulativeXP: 45000 },
  { level: 21, xp: 7000, cumulativeXP: 52000 },
  { level: 22, xp: 8000, cumulativeXP: 60000 },
  { level: 23, xp: 9000, cumulativeXP: 69000 },
  { level: 24, xp: 10000, cumulativeXP: 79000 },
  { level: 25, xp: 11000, cumulativeXP: 90000 },
  { level: 26, xp: 12000, cumulativeXP: 102000 },
  { level: 27, xp: 13000, cumulativeXP: 115000 },
  { level: 28, xp: 14000, cumulativeXP: 129000 },
  { level: 29, xp: 15000, cumulativeXP: 144000 },
  { level: 30, xp: 16000, cumulativeXP: 160000 }
];

export const FODDER_XP = [
  { id: '47-59', label: '47–59 OVR', xp: 100 },
  { id: '60-69', label: '60–69 OVR', xp: 120 },
  { id: '70-74', label: '70–74 OVR', xp: 160 },
  { id: '75-79', label: '75–79 OVR', xp: 200 },
  { id: '80-84', label: '80–84 OVR', xp: 250 },
  { id: '85-89', label: '85–89 OVR', xp: 300 },
  { id: '90', label: '90 OVR', xp: 400 },
  { id: '91', label: '91 OVR', xp: 500 },
  { id: '92', label: '92 OVR', xp: 600 },
  { id: '93', label: '93 OVR', xp: 700 },
  { id: '94', label: '94 OVR', xp: 800 },
  { id: '95', label: '95 OVR', xp: 1000 }
];

// Rank limits and transfer rules are intentionally unconfigured until verified current in-game values are available.
export const RANK_TRAINING_LIMITS = {};
export const TRAINING_TRANSFER_RULES = { verified: false, transferPercent: null };

export function getCumulativeXP(level) {
  return TRAINING_LEVEL_XP.find((item) => item.level === Number(level))?.cumulativeXP ?? null;
}
