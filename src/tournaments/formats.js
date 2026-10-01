export const TOURNAMENT_FORMATS = [
  {
    key: 'single_elimination',
    category: 'Knockout',
    name: 'Single Elimination',
    summary: 'Straight knockout. Lose once and you are out.',
    participantMin: 2,
    participantMax: 5000,
    matchModes: ['single', 'home_away', 'best_of_3', 'best_of_5'],
    defaults: { matchMode: 'single', thirdPlace: false }
  },
  {
    key: 'single_elimination_two_leg',
    category: 'Knockout',
    name: 'Two-Leg Knockout',
    summary: 'Home-and-away ties decided on aggregate.',
    participantMin: 2,
    participantMax: 1024,
    matchModes: ['home_away'],
    defaults: { matchMode: 'home_away', awayGoalsRule: false, extraTimeOnSecondLeg: true, penaltiesOnSecondLeg: true }
  },
  {
    key: 'legacy_unused_double_elimination',
    category: 'Knockout',
    name: 'Double Elimination',
    summary: 'Two-loss bracket with winners and losers paths.',
    participantMin: 4,
    participantMax: 1024,
    matchModes: ['single', 'best_of_3'],
    defaults: { matchMode: 'single', grandFinalReset: false }
  },
  {
    key: 'round_robin',
    category: 'League',
    name: 'Round Robin',
    summary: 'Every participant plays every other participant once.',
    participantMin: 2,
    participantMax: 128,
    matchModes: ['single'],
    defaults: { matchMode: 'single', homeAway: false, points: { win: 3, draw: 1, loss: 0 } }
  },
  {
    key: 'home_away_round_robin',
    category: 'League',
    name: 'Home & Away League',
    summary: 'Double round robin with a home and away fixture against every opponent.',
    participantMin: 2,
    participantMax: 96,
    matchModes: ['home_away'],
    defaults: { matchMode: 'home_away', points: { win: 3, draw: 1, loss: 0 } }
  },
  {
    key: 'group_knockout',
    category: 'Hybrid',
    name: 'Groups + Knockout',
    summary: 'Flexible group stage followed by a knockout bracket.',
    participantMin: 4,
    participantMax: 5000,
    matchModes: ['single', 'home_away'],
    defaults: { groups: 4, teamsPerGroup: 4, advancePerGroup: 2, groupHomeAway: false, knockoutMatchMode: 'single' }
  },
  {
    key: 'fifa_asean_cup',
    category: 'Football Presets',
    name: 'FIFA ASEAN Cup Style',
    summary: 'Two groups with single-round matches, group winners to a final, optional third-place match.',
    participantMin: 6,
    participantMax: 64,
    matchModes: ['single'],
    defaults: { groups: 2, teamsPerGroup: 4, advancePerGroup: 1, groupHomeAway: false, thirdPlace: true, knockoutMatchMode: 'single' }
  },
  {
    key: 'asean_championship',
    category: 'Football Presets',
    name: 'ASEAN Championship Style',
    summary: 'Two groups followed by home-and-away semi-finals and a home-and-away final.',
    participantMin: 6,
    participantMax: 64,
    matchModes: ['single', 'home_away'],
    defaults: { groups: 2, teamsPerGroup: 5, advancePerGroup: 2, groupHomeAway: false, knockoutMatchMode: 'home_away' }
  },
  {
    key: 'world_cup_style',
    category: 'Football Presets',
    name: 'World Cup Style',
    summary: 'Groups followed by a seeded knockout bracket with configurable qualification.',
    participantMin: 8,
    participantMax: 5000,
    matchModes: ['single', 'home_away'],
    defaults: { groups: 8, teamsPerGroup: 4, advancePerGroup: 2, groupHomeAway: false, knockoutMatchMode: 'single' }
  },
  {
    key: 'groups_home_away_knockout',
    category: 'Hybrid',
    name: 'Groups + Two-Leg Knockout',
    summary: 'Round-robin groups followed by aggregate home-and-away knockout ties.',
    participantMin: 8,
    participantMax: 5000,
    matchModes: ['single', 'home_away'],
    defaults: { groups: 4, teamsPerGroup: 4, advancePerGroup: 2, groupHomeAway: false, knockoutMatchMode: 'home_away' }
  },
  {
    key: 'asean_cup',
    category: 'Football Presets',
    name: 'ASEAN Cup Style',
    summary: 'Qualifying play-off, groups, then two-legged semi-finals and final.',
    participantMin: 6,
    participantMax: 64,
    matchModes: ['single', 'home_away'],
    defaults: { qualifying: false, groups: 2, teamsPerGroup: 5, advancePerGroup: 2, groupHomeAway: false, knockoutMatchMode: 'home_away' }
  },
  {
    key: 'champions_league',
    category: 'Football Presets',
    name: 'Champions League Style',
    summary: 'Single league phase, limited fixtures per team, play-off path and knockout rounds.',
    participantMin: 8,
    participantMax: 500,
    matchModes: ['single', 'home_away'],
    defaults: { leagueRounds: 8, leagueMatchesPerTeam: 8, topDirect: 8, playoffFrom: 9, playoffTo: 24, playoffMatchMode: 'home_away', knockoutMatchMode: 'home_away' }
  },
  {
    key: 'legacy_unused_swiss_system',
    category: 'League',
    name: 'Swiss System',
    summary: 'Fixed number of rounds. Participants are paired by current standings.',
    participantMin: 8,
    participantMax: 2000,
    matchModes: ['single', 'home_away'],
    defaults: { rounds: 6, scoreWin: 1, scoreDraw: 0.5, scoreLoss: 0, avoidRepeatOpponents: true }
  },
  {
    key: 'legacy_unused_swiss_to_knockout',
    category: 'Hybrid',
    name: 'Swiss + Knockout',
    summary: 'Swiss rounds decide seeding for a final knockout bracket.',
    participantMin: 8,
    participantMax: 2000,
    matchModes: ['single', 'best_of_3'],
    defaults: { rounds: 6, qualifiers: 16, knockoutMatchMode: 'single' }
  },
  {
    key: 'league_to_knockout',
    category: 'Hybrid',
    name: 'League + Playoffs',
    summary: 'League phase with configurable qualification and knockout playoffs.',
    participantMin: 6,
    participantMax: 256,
    matchModes: ['single', 'home_away'],
    defaults: { qualifiers: 8, playoffLegs: 2, knockoutMatchMode: 'home_away' }
  },
  {
    key: 'best_of_series',
    category: 'Series',
    name: 'Best-of Series Knockout',
    summary: 'Knockout where each tie is best-of-3 or best-of-5.',
    participantMin: 2,
    participantMax: 512,
    matchModes: ['best_of_3', 'best_of_5'],
    defaults: { matchMode: 'best_of_3' }
  },
  {
    key: 'custom_builder',
    category: 'Custom',
    name: 'Custom Competition',
    summary: 'Build the competition from multiple configurable stages.',
    participantMin: 2,
    participantMax: 5000,
    matchModes: ['single', 'home_away', 'best_of_3', 'best_of_5'],
    defaults: { stages: [] }
  }
];

export const FORMAT_CATEGORIES = [...new Set(TOURNAMENT_FORMATS.map((x) => x.category))];

export function getTournamentFormat(key) {
  return TOURNAMENT_FORMATS.find((x) => x.key === key) || TOURNAMENT_FORMATS[0];
}
