// Calculator redesign deployment marker — keep training data as the source of truth
export const TRAINING_LEVELS = [
  0, 100, 250, 450, 700, 1000, 1600, 2400, 3400, 4600, 6000,
  7800, 10000, 12600, 15600, 19000, 23000, 27600, 32800, 38600, 45000,
  52000, 60000, 69000, 79000, 90000, 102000, 115000, 129000, 144000, 160000,
];

export const FODDER = [
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
  { id: '95+', label: '95+ OVR', xp: 1000 },
];

export const MAX_TRAINING_LEVEL = 30;
export const TRAINING_TRANSFER_RATE = 0.9;
