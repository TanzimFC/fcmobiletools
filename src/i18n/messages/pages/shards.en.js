// Shards counter. English is copied verbatim from the original page. Preset targets and the
// currency label come from the admin-managed data file and are never translated.
export default {
  meta: { title: 'FC Mobile Shards Counter', description: 'Track your FC Mobile Star Shards, set a target and see exactly how many remain.' },
  hero: {
    eyebrow: 'FC MOBILE / SHARDS LAB', h1a: 'Shards ', h1em: 'Counter',
    points: ['Live counter', 'Preset targets', 'Saves in this browser'],
    balance: 'Current balance', progress: 'Progress'
  },
  counter: {
    label: 'SHARDS TRACKER', title: 'Track your next reward',
    lead: 'Choose a preset managed from the admin panel or enter your own target.',
    inputsAria: 'Shards inputs', preset: 'PRESET TARGET', custom: 'Custom target', target: 'TARGET SHARDS', targetPh: 'Enter target',
    current: 'CURRENT SHARDS', daily: 'DAILY RATE', optional: 'optional',
    quickAdd: 'QUICK ADD', quickHint: 'Add shards as you earn them', minus: '−1 shard', reset: 'Reset counter'
  },
  result: {
    remaining: 'REMAINING', target: 'TARGET', current: 'CURRENT', over: 'OVER TARGET', days: 'DAYS LEFT',
    statusTitle: 'Set a target', statusDetail: 'Add a preset or enter the number of shards you want to reach.',
    footer: 'PLAYER-SIDE COUNTER', clear: 'CLEAR SAVED DATA ↺'
  },
  guide: {
    eyebrow: 'HOW IT WORKS', h2a: 'Simple counter. ', h2em: 'Clear target.',
    lead: "Preset targets are maintained by the site's admin panel, while your balance stays local to your browser.",
    cards: [
      { t: 'Set your target', d: 'Pick an admin-managed preset or enter any custom shard target.' },
      { t: 'Count what you earn', d: 'Type your current balance or use the quick-add buttons while you play.' },
      { t: 'Know the gap', d: 'The counter shows remaining shards, progress and optional days-to-target.' }
    ]
  },
  ui: {
    custom: 'Custom target', enterTarget: 'Enter a target to start', setTarget: 'Set a target',
    pickPreset: 'Pick a preset or enter your own shard target.', enterNumber: 'Enter the number of shards you want to reach.',
    over: '{n} over target', reached: 'Target reached', secured: 'Target secured',
    securedDetail: 'You have enough shards for this target with room to spare.', reachedDetail: 'You have reached your selected shard target.',
    remaining: '{n} remaining', keepGoing: 'Keep going',
    daysOne: 'At your daily rate, about {n} day remains.', daysMany: 'At your daily rate, about {n} days remain.',
    quickHint: 'Use the quick-add buttons as you earn more shards.'
  }
};
