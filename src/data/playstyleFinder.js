import { PLAYSTYLES } from './playstyles.js';

/* ==========================================================================
   PlayStyle Finder engine (v2)
   --------------------------------------------------------------------------
   The old finder asked people to pick a PlayStyle description and then handed
   the same description back. v2 asks about *situations* instead. Every answer
   adds points to hidden play-traits (pace, read, strength, curve...). Every
   PlayStyle has a trait profile. We score the two, weigh position fit and the
   community meta lightly, and explain the result using the player's own words.
   ========================================================================== */

/* x / y place the badge on the landscape pitch (attack runs left to right).
   The portrait pitch is derived from them in the page. */
export const PLAYSTYLE_POSITIONS = [
  { code: 'ST', label: 'Striker', detail: 'ST', profileGroup: 'attack', noun: 'Striker', x: 88, y: 50 },
  { code: 'LW', label: 'Left wing', detail: 'LW', profileGroup: 'wingAttack', noun: 'Winger', x: 77, y: 17 },
  { code: 'RW', label: 'Right wing', detail: 'RW', profileGroup: 'wingAttack', noun: 'Winger', x: 77, y: 83 },
  { code: 'CAM', label: 'Attacking midfield', detail: 'CAM', profileGroup: 'midfield', noun: 'Playmaker', x: 67, y: 50 },
  { code: 'CM', label: 'Central midfield', detail: 'CM', profileGroup: 'midfield', noun: 'Midfielder', x: 51, y: 50 },
  { code: 'CDM', label: 'Defensive midfield', detail: 'CDM', profileGroup: 'midfield', noun: 'Holding Midfielder', x: 37, y: 50 },
  { code: 'LM', label: 'Left midfield', detail: 'LM', profileGroup: 'wideMidfield', noun: 'Wide Midfielder', x: 55, y: 13 },
  { code: 'RM', label: 'Right midfield', detail: 'RM', profileGroup: 'wideMidfield', noun: 'Wide Midfielder', x: 55, y: 87 },
  { code: 'LB', label: 'Left back', detail: 'LB', profileGroup: 'fullback', noun: 'Full-Back', x: 29, y: 15 },
  { code: 'RB', label: 'Right back', detail: 'RB', profileGroup: 'fullback', noun: 'Full-Back', x: 29, y: 85 },
  { code: 'CB', label: 'Centre back', detail: 'CB', profileGroup: 'defence', noun: 'Centre-Back', x: 22, y: 50 },
  { code: 'GK', label: 'Goalkeeper', detail: 'GK', profileGroup: 'goalkeeper', noun: 'Keeper', x: 7, y: 50 }
];

// Relevance hints, not restrictions. A style that does not fit the position is
// still allowed, but its score is reduced (see OFF_POSITION_FACTOR).
export const PLAYSTYLE_POSITION_FIT = {
  'Rapid': ['ST', 'LW', 'RW', 'CAM', 'LM', 'RM'],
  'Trickster': ['ST', 'LW', 'RW', 'CAM', 'LM', 'RM'],
  'Anticipate': ['CB', 'LB', 'RB', 'CDM', 'CM'],
  'Guardian': ['CB', 'LB', 'RB', 'CDM'],
  'Slide Tackle': ['CB', 'LB', 'RB', 'CDM'],
  'Precision Header': ['ST', 'CB'],
  'Chip Shot': ['ST', 'CAM', 'LW', 'RW'],
  'Clinical Finisher': ['ST', 'LW', 'RW', 'CAM', 'CM'],
  'Dead Ball': ['ST', 'LW', 'RW', 'CAM', 'CM', 'CDM', 'LM', 'RM', 'LB', 'RB', 'CB'],
  'Finesse Shot': ['ST', 'LW', 'RW', 'CAM', 'CM'],
  'Penalty Expert': ['ST', 'CAM'],
  'Power Shot': ['ST', 'CAM', 'CM', 'CDM'],
  'Bullet Pass': ['CAM', 'CM', 'CDM', 'CB', 'LB', 'RB', 'LM', 'RM'],
  'Driven Lob Through': ['CAM', 'CM', 'CDM'],
  'Incisive Through': ['ST', 'CAM', 'CM', 'CDM'],
  'Tiki Taka': ['CAM', 'CM', 'CDM', 'LM', 'RM'],
  'Whipped Crosser': ['LW', 'RW', 'LM', 'RM', 'LB', 'RB'],
  'Deflector': ['GK'],
  'Super Rush': ['GK'],
  'Accelerator': ['ST', 'LW', 'RW', 'CAM', 'CM', 'LM', 'RM', 'LB', 'RB'],
  'Bruiser': ['CB', 'CDM', 'ST'],
  'Relentless Stamina': ['CB', 'LB', 'RB', 'CDM', 'CM', 'LM', 'RM']
};

export const OFF_POSITION_FACTOR = 0.62;

/* Community meta: what FC Mobile guides were recommending per position in
   Jul-Oct 2026 (fcmobileuniverse, fcmobilesquad, FC Mobile 27 guides). It only
   nudges the score a little and powers the "Community pick" badge. Wide
   midfielders had no consistent consensus, so they are left out on purpose. */
export const PLAYSTYLE_META = {
  GK: { picks: ['Deflector', 'Super Rush'], note: 'Deflector is the usual first choice; Super Rush suits aggressive, sweeping keepers.' },
  LB: { picks: ['Accelerator', 'Bruiser', 'Anticipate', 'Relentless Stamina'], note: 'Accelerator for attacking full-backs, Bruiser or Anticipate for defensive ones.' },
  RB: { picks: ['Accelerator', 'Bruiser', 'Anticipate', 'Relentless Stamina'], note: 'Accelerator for attacking full-backs, Bruiser or Anticipate for defensive ones.' },
  CB: { picks: ['Anticipate', 'Bruiser', 'Guardian', 'Precision Header'], note: 'Anticipate + Bruiser is the most-quoted combo; Guardian suits aggressive defenders.' },
  CDM: { picks: ['Anticipate', 'Guardian', 'Bruiser'], note: 'Ball-winning styles lead the guides for holding midfielders.' },
  CM: { picks: ['Tiki Taka', 'Bullet Pass'], note: 'Short-passing styles are the consensus for circulation and progression.' },
  CAM: { picks: ['Tiki Taka', 'Finesse Shot', 'Trickster'], note: 'Chance creation, finesse shooting and tight control.' },
  LW: { picks: ['Rapid', 'Finesse Shot', 'Trickster', 'Whipped Crosser'], note: 'Rapid is the winger default; finishers add Finesse Shot.' },
  RW: { picks: ['Rapid', 'Finesse Shot', 'Trickster', 'Whipped Crosser'], note: 'Rapid is the winger default; finishers add Finesse Shot.' },
  ST: { picks: ['Clinical Finisher', 'Trickster', 'Finesse Shot', 'Rapid'], note: 'Clean finishing plus a tool to beat your marker.' }
};
export const META_BONUS = 0.7;

/* ---------- Traits: the hidden vocabulary the questions speak ---------- */
export const PLAYSTYLE_AXES = [
  { id: 'pace', label: 'Pace' },
  { id: 'skill', label: 'Skill' },
  { id: 'shooting', label: 'Shooting' },
  { id: 'creation', label: 'Creation' },
  { id: 'defending', label: 'Defending' },
  { id: 'physical', label: 'Physical' }
];

export const PLAYSTYLE_TRAITS = {
  pace: { axis: 'pace', label: 'Explosive carrying', adjective: 'Lightning', tagline: 'You live in the gap between a defender\u2019s reaction and your first step.' },
  offball: { axis: 'pace', label: 'Runs without the ball', adjective: 'Phantom', tagline: 'You win the moment before you touch the ball, arriving where defenders aren\u2019t looking.' },
  dribble: { axis: 'skill', label: 'Close control', adjective: 'Silk', tagline: 'The ball stays glued to your boot and defenders end up guessing.' },
  finish: { axis: 'shooting', label: 'Composed finishing', adjective: 'Clinical', tagline: 'When a chance falls to you, it rarely goes to waste.' },
  curve: { axis: 'shooting', label: 'Curled shots', adjective: 'Curling', tagline: 'You see the far corner as a lane, not a target.' },
  power: { axis: 'shooting', label: 'Hard, early shots', adjective: 'Thunder', tagline: 'You back yourself to beat keepers on sheer pace of shot.' },
  chip: { axis: 'shooting', label: 'Lifting it over keepers', adjective: 'Audacious', tagline: 'A keeper charging off his line is an invitation, not a threat.' },
  freekick: { axis: 'shooting', label: 'Free kicks', adjective: 'Set-Piece', tagline: 'Give you a dead ball in range and the wall starts to worry.' },
  penalty: { axis: 'shooting', label: 'Penalties', adjective: 'Ice-Cold', tagline: 'Pressure is exactly where you do your best work.' },
  tempo: { axis: 'creation', label: 'Quick combinations', adjective: 'Metronome', tagline: 'You set the beat and the whole team plays at your tempo.' },
  zip: { axis: 'creation', label: 'Driven passing', adjective: 'Laser', tagline: 'Your passes arrive before defenders can react.' },
  thread: { axis: 'creation', label: 'Through balls', adjective: 'Needle', tagline: 'You thread passes through gaps other players never see.' },
  lob: { axis: 'creation', label: 'Lofted through balls', adjective: 'Architect', tagline: 'You build chances over the top of the defensive line.' },
  cross: { axis: 'creation', label: 'Crossing and corners', adjective: 'Crossing', tagline: 'Wide areas are your launch pad and the box is your target.' },
  read: { axis: 'defending', label: 'Reading the play', adjective: 'Cerebral', tagline: 'You win the ball by being in the right place a beat early.' },
  aggro: { axis: 'defending', label: 'Aggressive tackling', adjective: 'Ferocious', tagline: 'You step in first and make attackers regret taking the ball near you.' },
  recover: { axis: 'defending', label: 'Recovery and slides', adjective: 'Last-Ditch', tagline: 'No chance is lost until you have slid in to stop it.' },
  strength: { axis: 'physical', label: 'Strength in duels', adjective: 'Immovable', tagline: 'Opponents bounce off you and the ball stays yours.' },
  aerial: { axis: 'physical', label: 'Aerial power', adjective: 'Aerial', tagline: 'Every ball in the air is yours until someone proves otherwise.' },
  stamina: { axis: 'physical', label: 'Endurance', adjective: 'Tireless', tagline: 'Your motor has no fourth quarter. Minute 90 looks like minute 1.' },
  parry: { axis: 'defending', label: 'Safe saves', adjective: 'Shot-Stopping', tagline: 'You do not just save shots, you take the danger out of the rebound.' },
  rush: { axis: 'pace', label: 'Sweeping off the line', adjective: 'Sweeping', tagline: 'Your goal line is a suggestion. You win the ball before the shot arrives.' }
};

/* ---------- PlayStyle profiles ----------
   Weights are 0-3 (3 = defining trait). role / family / altNote drive the
   pairing logic and the "pick this instead if..." copy. */
export const PLAYSTYLE_PROFILE = {
  'Rapid': { traits: { pace: 3, dribble: 1 }, role: 'move', family: 'speed', altNote: 'you win races while carrying the ball rather than running off it.' },
  'Trickster': { traits: { dribble: 3 }, role: 'move', family: 'skill', altNote: 'you would rather beat defenders with skill moves than with pace.' },
  'Accelerator': { traits: { offball: 3, pace: 1 }, role: 'move', family: 'speed', altNote: 'most of your damage comes from runs made without the ball.' },
  'Anticipate': { traits: { read: 3, recover: 0.5 }, role: 'defend', family: 'tackle', altNote: 'you like holding your shape and winning the ball cleanly on the ground.' },
  'Guardian': { traits: { aggro: 3, strength: 0.5 }, role: 'defend', family: 'tackle', altNote: 'you would rather step in and make aggressive hard tackles.' },
  'Slide Tackle': { traits: { recover: 3, aggro: 0.5 }, role: 'defend', family: 'tackle', altNote: 'you are often recovering after being beaten and need the slide to land.' },
  'Precision Header': { traits: { aerial: 3 }, role: 'finish', family: 'air', altNote: 'aerial duels, headed clearances and headed chances decide your matches.' },
  'Chip Shot': { traits: { chip: 3 }, role: 'finish', family: 'shot', altNote: 'charging keepers are your favourite target.' },
  'Clinical Finisher': { traits: { finish: 3 }, role: 'finish', family: 'shot', altNote: 'you want every regular close-to-mid-range shot to be dependable.' },
  'Dead Ball': { traits: { freekick: 3 }, role: 'finish', family: 'setpiece', altNote: 'you take the direct free kicks.' },
  'Finesse Shot': { traits: { curve: 3, finish: 0.5 }, role: 'finish', family: 'shot', altNote: 'you cut inside and curl shots into the far corner.' },
  'Penalty Expert': { traits: { penalty: 3 }, role: 'finish', family: 'setpiece', altNote: 'you are the designated penalty taker.' },
  'Power Shot': { traits: { power: 3 }, role: 'finish', family: 'shot', altNote: 'you shoot early and hard.' },
  'Bullet Pass': { traits: { zip: 3, tempo: 0.5 }, role: 'create', family: 'pass', altNote: 'you play firm, driven ground passes.' },
  'Driven Lob Through': { traits: { lob: 3, thread: 0.5 }, role: 'create', family: 'pass', altNote: 'you play lobbed through balls over the defensive line.' },
  'Incisive Through': { traits: { thread: 3 }, role: 'create', family: 'pass', altNote: 'you split defences with ground through balls.' },
  'Tiki Taka': { traits: { tempo: 3, zip: 0.5 }, role: 'create', family: 'pass', altNote: 'you live on quick one-twos and short combinations.' },
  'Whipped Crosser': { traits: { cross: 3 }, role: 'create', family: 'pass', altNote: 'you deliver from wide areas and take the corners.' },
  'Deflector': { traits: { parry: 3 }, role: 'keeper', family: 'keeper', altNote: 'you want every parry pushed to safety.' },
  'Super Rush': { traits: { rush: 3 }, role: 'keeper', family: 'keeper', altNote: 'you sweep, rush off your line and smother one-on-ones.' },
  'Bruiser': { traits: { strength: 3 }, role: 'body', family: 'body', altNote: 'you win with strength: shielding the ball and shoulder battles.' },
  'Relentless Stamina': { traits: { stamina: 3 }, role: 'body', family: 'body', altNote: 'you want to be running at full pace in the 90th minute.' }
};

/* ---------- Questions ----------
   Scenario based. Each option adds trait points and carries a `because`
   phrase that the results page quotes back to the player as evidence. */
const Q = {
  attack: [
    {
      id: 'shot', kicker: 'Instinct', prompt: 'A cut-back lands 18 yards out and a defender is sprinting at you.', hint: 'What is your first instinct?',
      options: [
        { id: 'a', label: 'Hit it first time, before he gets there', because: 'you shoot early before defenders can set', traits: { power: 2.5, finish: 0.5 } },
        { id: 'b', label: 'Open the body and bend it into the far corner', because: 'you bend shots around goalkeepers', traits: { curve: 3 } },
        { id: 'c', label: 'Settle it, then pick my spot calmly', because: 'you take composed, placed finishes', traits: { finish: 3 } },
        { id: 'd', label: 'Sell the shot and drive past him', because: 'you beat the last defender before you shoot', traits: { dribble: 2, pace: 1.5 } }
      ]
    },
    {
      id: 'keeper', kicker: 'One-on-one', prompt: 'You are through on goal and the keeper charges out.', hint: 'What do you do?',
      options: [
        { id: 'a', label: 'Lift it over him', because: 'you lift the ball over rushing goalkeepers', traits: { chip: 3 } },
        { id: 'b', label: 'Take it round him', because: 'you dribble around goalkeepers', traits: { dribble: 2.5, pace: 1 } },
        { id: 'c', label: 'Slot it low and early', because: 'you finish early and low', traits: { finish: 2.5, power: 0.5 } },
        { id: 'd', label: 'Whip it round him with curl', because: 'you curl chances around the keeper', traits: { curve: 2.5, finish: 0.5 } }
      ]
    },
    {
      id: 'movement', kicker: 'Movement', prompt: 'How do you usually find the end of a chance?', hint: 'Pick the one you do most.',
      options: [
        { id: 'a', label: 'Sprint in behind the line the moment we win it', because: 'you attack the space behind the defence', traits: { offball: 3, pace: 0.5 } },
        { id: 'b', label: 'Back into my marker and hold him off', because: 'you win battles with your back to goal', traits: { strength: 3 } },
        { id: 'c', label: 'Drop in, combine, then arrive late', because: 'you link play before arriving in the box', traits: { tempo: 2.5, thread: 0.5 } },
        { id: 'd', label: 'Attack crosses and corners in the air', because: 'you attack the ball in the air', traits: { aerial: 3 } }
      ]
    },
    {
      id: 'deadball', kicker: 'Dead balls', prompt: 'Free kick on the edge of the box. Penalty later on. Where are you?', hint: 'Be honest about your role.',
      options: [
        { id: 'a', label: 'Over the free kick, every time', because: 'you take the direct free kicks', traits: { freekick: 3 } },
        { id: 'b', label: 'On the penalty spot, ice in my veins', because: 'you step up for penalties', traits: { penalty: 3 } },
        { id: 'c', label: 'In the box, waiting for the rebound', because: 'you live for rebounds and scrappy chances', traits: { finish: 1.5, strength: 1, aerial: 0.5 } },
        { id: 'd', label: 'Not my job. I want open play', because: 'you do your damage in open play', traits: { pace: 1.5, dribble: 1, offball: 0.5 } }
      ]
    },
    {
      id: 'pain', kicker: 'Reality check', prompt: 'What is costing you the most goals right now?', hint: 'Pick the one that hurts.',
      options: [
        { id: 'a', label: 'I am not explosive enough when I carry the ball', because: 'explosive dribbling is your biggest gap', traits: { pace: 3 } },
        { id: 'b', label: 'I cannot beat my man in tight spaces', because: 'tight-space 1v1s are your biggest gap', traits: { dribble: 3 } },
        { id: 'c', label: 'I miss too many chances inside the box', because: 'close-range finishing is your biggest gap', traits: { finish: 3 } },
        { id: 'd', label: 'I get bullied off the ball', because: 'you lose too many physical battles', traits: { strength: 3 } },
        { id: 'e', label: 'I am always a step late arriving', because: 'you are often a step late into space', traits: { offball: 3 } }
      ]
    }
  ],

  wingAttack: [
    {
      id: 'wide', kicker: 'Wide play', prompt: 'The ball reaches you on the touchline and the full-back is standing off.', hint: 'What is your move?',
      options: [
        { id: 'a', label: 'Knock it past him and race', because: 'you win races down the flank', traits: { pace: 3, dribble: 0.5 } },
        { id: 'b', label: 'Beat him with skill moves', because: 'you beat full-backs with skill moves', traits: { dribble: 3 } },
        { id: 'c', label: 'Play a quick one-two and go again', because: 'you combine quickly rather than going alone', traits: { tempo: 3 } },
        { id: 'd', label: 'Get to the byline and whip it in', because: 'you deliver from wide areas', traits: { cross: 3 } }
      ]
    },
    {
      id: 'cutin', kicker: 'Cutting in', prompt: 'You have cut inside onto your stronger foot at the edge of the box.', hint: 'How does the move end?',
      options: [
        { id: 'a', label: 'Curl it into the far corner', because: 'you curl shots into the far corner', traits: { curve: 3 } },
        { id: 'b', label: 'Hit it hard and low', because: 'you hit shots hard and low', traits: { power: 2.5, finish: 0.5 } },
        { id: 'c', label: 'Place it with a calm, clean finish', because: 'you place the ball with a composed finish', traits: { finish: 3 } },
        { id: 'd', label: 'Slide the runner in instead', because: 'you slide teammates through rather than shooting', traits: { thread: 3 } }
      ]
    },
    {
      id: 'offball', kicker: 'Off the ball', prompt: 'The ball is on the opposite flank. What are you doing?', hint: 'Your habit, not your best day.',
      options: [
        { id: 'a', label: 'Making a diagonal run behind the line', because: 'you make diagonal runs in behind', traits: { offball: 3 } },
        { id: 'b', label: 'Drifting into the half-space to link up', because: 'you drift inside to combine', traits: { tempo: 2, thread: 1 } },
        { id: 'c', label: 'Holding the touchline to stretch them', because: 'you hold the width and wait for the switch', traits: { cross: 1.5, dribble: 1 } },
        { id: 'd', label: 'Tracking back to help my full-back', because: 'you work back to help defensively', traits: { stamina: 2.5, recover: 0.5 } }
      ]
    },
    {
      id: 'deadball', kicker: 'Dead balls', prompt: 'A set piece is awarded in a dangerous area. What is your job?', hint: 'Your usual role.',
      options: [
        { id: 'a', label: 'Take the corner or the wide free kick', because: 'you take the corners and wide free kicks', traits: { cross: 3 } },
        { id: 'b', label: 'Shoot the direct free kick', because: 'you shoot the direct free kicks', traits: { freekick: 3 } },
        { id: 'c', label: 'Take the penalty', because: 'you take the penalties', traits: { penalty: 3 } },
        { id: 'd', label: 'Attack the box when someone else delivers', because: 'you attack the box on set pieces', traits: { finish: 1.5, offball: 1.5 } }
      ]
    },
    {
      id: 'pain', kicker: 'Reality check', prompt: 'What is holding your wing play back the most?', hint: 'Pick the one that hurts.',
      options: [
        { id: 'a', label: 'Recovering defenders always catch me', because: 'you get caught by recovering defenders', traits: { pace: 3 } },
        { id: 'b', label: 'My skill moves get read or stripped', because: 'your skill moves are not sharp enough yet', traits: { dribble: 3 } },
        { id: 'c', label: 'My shots from the edge do not trouble keepers', because: 'your shots from the edge lack bite', traits: { curve: 1.5, finish: 1.5, power: 1 } },
        { id: 'd', label: 'My crosses keep getting cleared', because: 'your crosses are not finding their target', traits: { cross: 3 } },
        { id: 'e', label: 'I am gassed by minute 70', because: 'your legs fade late in matches', traits: { stamina: 3 } }
      ]
    }
  ],

  midfield: [
    {
      id: 'receive', kicker: 'Under pressure', prompt: 'You receive between the lines with a marker tight on your back.', hint: 'What do you do?',
      options: [
        { id: 'a', label: 'One touch away, then move', because: 'you play one-touch and move', traits: { tempo: 3 } },
        { id: 'b', label: 'Turn and carry it forward', because: 'you turn and carry the ball forward', traits: { dribble: 2, pace: 1.5 } },
        { id: 'c', label: 'Look for the sharpest forward pass', because: 'you look for the sharpest forward pass', traits: { thread: 3 } },
        { id: 'd', label: 'Shield it until support arrives', because: 'you shield the ball under pressure', traits: { strength: 3 } }
      ]
    },
    {
      id: 'pass', kicker: 'Final ball', prompt: 'Your striker starts a run in behind. What is the pass?', hint: 'The one you reach for first.',
      options: [
        { id: 'a', label: 'A quick ground ball into his stride', because: 'you play ground through balls into the runner\u2019s stride', traits: { thread: 3 } },
        { id: 'b', label: 'A lob over the top', because: 'you play lobbed balls over the top', traits: { lob: 3 } },
        { id: 'c', label: 'A firm, driven pass to feet', because: 'you drive firm passes to feet', traits: { zip: 3 } },
        { id: 'd', label: 'Keep it short and let the move build', because: 'you let moves develop with short passes', traits: { tempo: 2.5, zip: 0.5 } }
      ]
    },
    {
      id: 'transition', kicker: 'Transition', prompt: 'Your team loses the ball. What is your reaction?', hint: 'Your instinct in the first second.',
      options: [
        { id: 'a', label: 'Hold my position, read the pass, tackle clean', because: 'you read the pass and tackle cleanly', traits: { read: 3 } },
        { id: 'b', label: 'Go in hard and win it back right now', because: 'you press and tackle aggressively', traits: { aggro: 3 } },
        { id: 'c', label: 'Chase back and slide in to recover', because: 'you chase back and recover with slides', traits: { recover: 3 } },
        { id: 'd', label: 'Close down everything, all game', because: 'you press relentlessly all match', traits: { stamina: 3 } },
        { id: 'e', label: 'Stay high and think about the counter', because: 'you stay high for the counter-attack', traits: { offball: 2.5, thread: 0.5 }, only: ['CAM', 'CM'] }
      ]
    },
    {
      id: 'range', kicker: 'Range', prompt: 'You are 25 yards from goal with room to shoot.', hint: 'What do you do?',
      options: [
        { id: 'a', label: 'Hit it hard', because: 'you hit it hard from range', traits: { power: 3 } },
        { id: 'b', label: 'Curl it away from the keeper', because: 'you curl shots from range', traits: { curve: 3 } },
        { id: 'c', label: 'Carry it closer first', because: 'you carry it into a better shooting position', traits: { dribble: 1.5, finish: 1.5 } },
        { id: 'd', label: 'Pass. It is not my game', because: 'you prefer to pass than shoot from range', traits: { tempo: 1, thread: 1.5 } },
        { id: 'e', label: 'I take the free kicks anyway', because: 'you take the free kicks', traits: { freekick: 3 } }
      ]
    },
    {
      id: 'pain', kicker: 'Reality check', prompt: 'What is holding your midfield play back the most?', hint: 'Pick the one that hurts.',
      options: [
        { id: 'a', label: 'My passes are too slow or arrive loose', because: 'your passing pace and accuracy need a lift', traits: { zip: 2, tempo: 1.5 } },
        { id: 'b', label: 'My through balls keep getting blocked', because: 'your through balls are getting blocked', traits: { thread: 2, lob: 1.5 } },
        { id: 'c', label: 'I lose physical duels in midfield', because: 'you lose too many physical duels', traits: { strength: 3 } },
        { id: 'd', label: 'I cannot win the ball back reliably', because: 'you struggle to win the ball back', traits: { read: 1.5, aggro: 1.5, recover: 1 } },
        { id: 'e', label: 'I run out of gas', because: 'you run out of energy', traits: { stamina: 3 } }
      ]
    }
  ],

  wideMidfield: [
    {
      id: 'wide', kicker: 'Wide play', prompt: 'The ball arrives on the touchline with plenty of room ahead.', hint: 'What is your move?',
      options: [
        { id: 'a', label: 'Knock it ahead and sprint', because: 'you knock it ahead and race', traits: { pace: 3 } },
        { id: 'b', label: 'Skill past the full-back', because: 'you beat full-backs with skill', traits: { dribble: 3 } },
        { id: 'c', label: 'Cross it early', because: 'you cross early', traits: { cross: 3 } },
        { id: 'd', label: 'Play it inside and overlap', because: 'you combine and overlap', traits: { tempo: 2, offball: 1.5 } }
      ]
    },
    {
      id: 'transition', kicker: 'Transition', prompt: 'Your team loses the ball in midfield.', hint: 'Your instinct.',
      options: [
        { id: 'a', label: 'Sprint back and cover every blade of grass', because: 'you cover huge amounts of ground', traits: { stamina: 3 } },
        { id: 'b', label: 'Track the winger and tackle cleanly', because: 'you stand up to wingers and tackle cleanly', traits: { read: 3 } },
        { id: 'c', label: 'Go in hard', because: 'you go in hard', traits: { aggro: 3 } },
        { id: 'd', label: 'Stay forward for the counter', because: 'you stay forward for counters', traits: { offball: 3 } }
      ]
    },
    {
      id: 'link', kicker: 'Link play', prompt: 'How do you help your team build attacks?', hint: 'Most of the time.',
      options: [
        { id: 'a', label: 'Quick short-pass combinations', because: 'you combine with quick short passes', traits: { tempo: 3 } },
        { id: 'b', label: 'Firm driven passes into midfield', because: 'you drive passes into midfield', traits: { zip: 3 } },
        { id: 'c', label: 'Slip a ball in behind', because: 'you slip balls in behind', traits: { thread: 3 } },
        { id: 'd', label: 'Shoot from range', because: 'you shoot from range', traits: { power: 1.5, curve: 1.5 } }
      ]
    },
    {
      id: 'deadball', kicker: 'Dead balls', prompt: 'A set piece is awarded in a dangerous area.', hint: 'Your usual role.',
      options: [
        { id: 'a', label: 'Take the corner', because: 'you take the corners', traits: { cross: 3 } },
        { id: 'b', label: 'Take the free kick', because: 'you take the free kicks', traits: { freekick: 3 } },
        { id: 'c', label: 'Take the penalty', because: 'you take the penalties', traits: { penalty: 3 } },
        { id: 'd', label: 'Hold my position and stay safe', because: 'you hold your position on set pieces', traits: { strength: 1.5, stamina: 1 } }
      ]
    },
    {
      id: 'pain', kicker: 'Reality check', prompt: 'What is holding your wide play back the most?', hint: 'Pick the one that hurts.',
      options: [
        { id: 'a', label: 'I cannot get away from defenders when I carry it', because: 'you cannot separate from defenders with the ball', traits: { pace: 3 } },
        { id: 'b', label: 'I lose my 1v1s', because: 'you lose too many 1v1s', traits: { dribble: 3 } },
        { id: 'c', label: 'My crosses are not dangerous', because: 'your crosses are not dangerous enough', traits: { cross: 3 } },
        { id: 'd', label: 'I cannot keep my tackles clean', because: 'your tackling needs to be cleaner', traits: { read: 2, aggro: 1 } },
        { id: 'e', label: 'I am exhausted late on', because: 'you fade late in matches', traits: { stamina: 3 } }
      ]
    }
  ],

  fullback: [
    {
      id: 'attack', kicker: 'Going forward', prompt: 'Your winger drifts inside and the whole flank opens up.', hint: 'What do you do?',
      options: [
        { id: 'a', label: 'Overlap at full speed', because: 'you overlap at full speed', traits: { offball: 3, stamina: 0.5 } },
        { id: 'b', label: 'Take it down the line and cross', because: 'you deliver crosses from the flank', traits: { cross: 3 } },
        { id: 'c', label: 'Recycle simply and keep possession', because: 'you keep possession simple and safe', traits: { tempo: 2.5, zip: 0.5 } },
        { id: 'd', label: 'Stay home and cover', because: 'you stay home and cover', traits: { read: 1.5, recover: 1.5 } }
      ]
    },
    {
      id: 'duel', kicker: 'Defending 1v1', prompt: 'A pacey winger is running straight at you.', hint: 'How do you stop him?',
      options: [
        { id: 'a', label: 'Hold the line, wait, then tackle clean', because: 'you wait and tackle cleanly', traits: { read: 3 } },
        { id: 'b', label: 'Jump in and win it hard', because: 'you step in with hard tackles', traits: { aggro: 3 } },
        { id: 'c', label: 'Let him go, then slide to recover', because: 'you recover with slides', traits: { recover: 3 } },
        { id: 'd', label: 'Get tight and out-muscle him', because: 'you out-muscle wingers', traits: { strength: 3 } }
      ]
    },
    {
      id: 'build', kicker: 'On the ball', prompt: 'You win it back deep. What is your first action?', hint: 'Most of the time.',
      options: [
        { id: 'a', label: 'Drive a firm pass into midfield', because: 'you drive passes into midfield', traits: { zip: 3 } },
        { id: 'b', label: 'Play a quick short combination', because: 'you play quick short combinations', traits: { tempo: 3 } },
        { id: 'c', label: 'Carry it up the pitch myself', because: 'you carry it forward yourself', traits: { pace: 2, dribble: 1 } },
        { id: 'd', label: 'Look for a ball in behind', because: 'you look for balls in behind', traits: { thread: 2, lob: 1 } }
      ]
    },
    {
      id: 'late', kicker: 'Late game', prompt: 'You have been up and down the flank for 80 minutes.', hint: 'What do you need most?',
      options: [
        { id: 'a', label: 'Fresh legs. I want to keep running', because: 'you need your legs to last 90 minutes', traits: { stamina: 3 } },
        { id: 'b', label: 'Burst when a gap opens', because: 'you need burst when gaps open', traits: { offball: 2.5, pace: 0.5 } },
        { id: 'c', label: 'Strength for the late duels', because: 'you need strength for late duels', traits: { strength: 2, aggro: 1 } },
        { id: 'd', label: 'Clean tackles. No lunging', because: 'you need to stay clean in the tackle', traits: { read: 2.5, recover: 0.5 } }
      ]
    },
    {
      id: 'pain', kicker: 'Reality check', prompt: 'What is costing your team the most through your side?', hint: 'Pick the one that hurts.',
      options: [
        { id: 'a', label: 'Wingers are getting past me', because: 'wingers get past you too easily', traits: { read: 2, recover: 1, aggro: 0.5 } },
        { id: 'b', label: 'I am not creating anything going forward', because: 'you create too little going forward', traits: { cross: 2, offball: 1.5 } },
        { id: 'c', label: 'I lose physical battles', because: 'you lose physical battles', traits: { strength: 3 } },
        { id: 'd', label: 'My passes break up our build-up', because: 'your build-up passing breaks down', traits: { zip: 1.5, tempo: 1.5 } },
        { id: 'e', label: 'I am out of position late on', because: 'you fade late and get out of position', traits: { stamina: 3 } }
      ]
    }
  ],

  defence: [
    {
      id: 'duel', kicker: 'Defending 1v1', prompt: 'A striker receives the ball with his back to you.', hint: 'What do you do?',
      options: [
        { id: 'a', label: 'Stay on my feet, read it, tackle clean', because: 'you stay patient and tackle cleanly', traits: { read: 3 } },
        { id: 'b', label: 'Step in aggressively', because: 'you step in aggressively', traits: { aggro: 3 } },
        { id: 'c', label: 'Lean on him and win the battle', because: 'you win the physical battle', traits: { strength: 3 } },
        { id: 'd', label: 'Wait for a loose touch and intercept', because: 'you intercept loose touches', traits: { read: 2, recover: 0.5 } }
      ]
    },
    {
      id: 'air', kicker: 'In the air', prompt: 'A high ball is dropping into your box.', hint: 'How do you deal with it?',
      options: [
        { id: 'a', label: 'Attack it and head it clear', because: 'you attack high balls and head them clear', traits: { aerial: 3 } },
        { id: 'b', label: 'Box him out with my body', because: 'you use your body to win aerial duels', traits: { strength: 2.5, aerial: 0.5 } },
        { id: 'c', label: 'Step up and cut it out early', because: 'you cut out balls before they arrive', traits: { read: 2.5 } },
        { id: 'd', label: 'Cover the second ball', because: 'you cover the second ball', traits: { recover: 1.5, stamina: 1.5 } }
      ]
    },
    {
      id: 'cover', kicker: 'Caught out', prompt: 'A through ball splits you and a striker is breaking clear.', hint: 'What now?',
      options: [
        { id: 'a', label: 'Slide in and win it before he is through', because: 'you slide in to stop breaks', traits: { recover: 3 } },
        { id: 'b', label: 'Chase and stay tight until help arrives', because: 'you chase and stay tight until help arrives', traits: { stamina: 2, recover: 1 } },
        { id: 'c', label: 'Hard challenge. He is not scoring', because: 'you make forceful tackles to stop attacks', traits: { aggro: 3 } },
        { id: 'd', label: 'Angle him wide and stay in control', because: 'you angle attackers wide and stay in control', traits: { read: 2.5 } }
      ]
    },
    {
      id: 'build', kicker: 'On the ball', prompt: 'You win it back. What is your next move?', hint: 'Most of the time.',
      options: [
        { id: 'a', label: 'Drive a firm pass into midfield', because: 'you drive passes out of defence', traits: { zip: 3 } },
        { id: 'b', label: 'Play a quick short combination', because: 'you play short combinations out of the back', traits: { tempo: 3 } },
        { id: 'c', label: 'Lift a ball over the top', because: 'you play lofted balls over the top', traits: { lob: 2, thread: 1 } },
        { id: 'd', label: 'Clear it. Safety first', because: 'you clear first and worry later', traits: { aerial: 1.5, strength: 1 } }
      ]
    },
    {
      id: 'pain', kicker: 'Reality check', prompt: 'What is costing you the most goals conceded?', hint: 'Pick the one that hurts.',
      options: [
        { id: 'a', label: 'Strikers beat me in physical duels', because: 'strikers beat you in physical duels', traits: { strength: 2.5, aggro: 0.5 } },
        { id: 'b', label: 'I get dribbled past when I stand up', because: 'you get dribbled past when you stand up', traits: { read: 3 } },
        { id: 'c', label: 'My slides and recoveries miss', because: 'your slides and recoveries miss', traits: { recover: 3 } },
        { id: 'd', label: 'I lose aerial duels', because: 'you lose aerial duels', traits: { aerial: 3 } },
        { id: 'e', label: 'My passes out of defence get intercepted', because: 'your passes out of defence get cut out', traits: { zip: 1.5, tempo: 1.5 } }
      ]
    }
  ],

  goalkeeper: [
    {
      id: 'rebound', kicker: 'Shot-stopping', prompt: 'A fierce shot arrives and you cannot hold it.', hint: 'What do you want to happen next?',
      options: [
        { id: 'a', label: 'Push it wide, away from the striker', because: 'you want parries pushed away from danger', traits: { parry: 3 } },
        { id: 'b', label: 'Direct it to a free teammate', because: 'you want parries to reach a teammate', traits: { parry: 3 } },
        { id: 'c', label: 'I would rather have been off my line already', because: 'you would rather be off your line already', traits: { rush: 3 } },
        { id: 'd', label: 'I rely on positioning, not luck', because: 'you rely on positioning over reactions', traits: { parry: 1, rush: 1 } }
      ]
    },
    {
      id: 'oneonone', kicker: 'One-on-one', prompt: 'A striker is through and running at you.', hint: 'How do you play it?',
      options: [
        { id: 'a', label: 'Charge out and close the angle', because: 'you charge out to close the angle', traits: { rush: 3 } },
        { id: 'b', label: 'Hold my line and react to the shot', because: 'you hold your line and react', traits: { parry: 2.5 } },
        { id: 'c', label: 'Rush only if the ball runs loose', because: 'you rush only when the ball runs loose', traits: { rush: 1.5, parry: 1 } }
      ]
    },
    {
      id: 'pain', kicker: 'Reality check', prompt: 'What is going wrong most often?', hint: 'Pick the one that hurts.',
      options: [
        { id: 'a', label: 'Rebounds drop to attackers', because: 'rebounds are dropping to attackers', traits: { parry: 3 } },
        { id: 'b', label: 'Through balls beat my line', because: 'through balls are beating your line', traits: { rush: 3 } },
        { id: 'c', label: 'I am too slow to close attackers down', because: 'you are too slow closing attackers down', traits: { rush: 2.5 } },
        { id: 'd', label: 'I get beaten by saveable shots', because: 'you get beaten by shots you should save', traits: { parry: 2 } }
      ]
    }
  ]
};

export const PLAYSTYLE_QUESTION_BANK = Q;

/* ---------- Pair synergy copy ---------- */
const SYNERGY = {
  'finish|move': '{move} gets you into the picture, {fin} makes the moment count.',
  'create|move': '{move} gets you into space and {cre} turns that space into chances.',
  'create|finish': '{cre} creates the chance and {fin} sharpens the end product.',
  'body|move': '{move} wins you the space, {body} protects it when someone gets close.',
  'body|finish': '{fin} is your edge in front of goal and {body} keeps you in the game when the contact comes.',
  'body|create': '{cre} is how you build, and {body} lets you keep doing it late on and under pressure.',
  'body|defend': '{def} wins the ball and {body} keeps you on top of the duel.',
  'defend|move': '{def} wins it back and {move} turns recoveries into attacks.',
  'create|defend': '{def} wins the ball and {cre} gets it moving again.',
  'defend|finish': '{def} is your foundation and {fin} gives you something extra when you go forward.',
  'defend|defend': 'Two defensive tools that cover different moments of a match, so they rarely overlap.',
  'create|create': 'Two passing tools that give you more than one way to break a line.',
  'finish|finish': 'Two finishing tools that cover different kinds of shot, so you stay dangerous from more angles.',
  'move|move': 'Two movement tools: one for the moment you carry the ball, one for the runs you make without it.',
  'body|body': 'Strength and endurance together: you win the contact and keep winning it deep into the match.',
  'keeper|keeper': 'Two keeper tools for two very different styles.'
};

const CATEGORY_ROLE = { 'Ball Control': 'move', Defending: 'defend', Physical: 'body', Finishing: 'finish', Passing: 'create', Goalkeeper: 'keeper' };

const positionByCode = (code) => PLAYSTYLE_POSITIONS.find((p) => p.code === code);
const OPTION_LETTERS = 'abcde';

export function getPlaystylePosition(code) {
  return positionByCode(code) || null;
}

export function getPlaystyleByName(name) {
  return PLAYSTYLES.find((s) => s.name === name) || null;
}

export function getPlaystyleQuestions(positionCode) {
  const position = positionByCode(positionCode);
  if (!position) return [];
  const bank = Q[position.profileGroup] || [];
  return bank.map((question) => ({
    ...question,
    options: question.options.filter((option) => !option.only || option.only.includes(positionCode))
  }));
}

function chosenOption(question, answers) {
  const id = answers && answers[question.id];
  return id ? question.options.find((option) => option.id === id) || null : null;
}

function contribution(option, profile) {
  let total = 0;
  for (const [trait, points] of Object.entries(option.traits)) {
    total += points * ((profile.traits[trait] || 0) / 3);
  }
  return total;
}

function roleOf(style) {
  return PLAYSTYLE_PROFILE[style.name]?.role || CATEGORY_ROLE[style.category] || 'move';
}

function buildDna(userTraits) {
  const sums = PLAYSTYLE_AXES.map((axis) => {
    let raw = 0;
    for (const [trait, points] of Object.entries(userTraits)) {
      if (PLAYSTYLE_TRAITS[trait]?.axis === axis.id) raw += points;
    }
    return { id: axis.id, label: axis.label, raw };
  });
  const peak = Math.max(...sums.map((item) => item.raw), 0);
  return sums.map((item) => ({
    ...item,
    value: peak > 0 ? Math.round((0.14 + 0.86 * (item.raw / peak)) * 100) / 100 : 0.14
  }));
}

function buildArchetype(positionInfo, userTraits) {
  const ranked = Object.entries(userTraits).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const top = PLAYSTYLE_TRAITS[ranked[0][0]];
  const second = ranked[1] ? PLAYSTYLE_TRAITS[ranked[1][0]] : null;
  return {
    adjective: top.adjective,
    noun: positionInfo.noun,
    title: top.adjective + ' ' + positionInfo.noun,
    tagline: top.tagline,
    topTrait: ranked[0][0],
    secondary: second && second.adjective !== top.adjective ? second.adjective : '',
    secondaryLabel: second ? second.label : ''
  };
}

export function describePair(first, second) {
  if (!first || !second) return '';
  const roles = [roleOf(first), roleOf(second)];
  const template = SYNERGY[[...roles].sort().join('|')] || 'These two cover different moments of a match, so they rarely overlap.';
  const byRole = {};
  roles.forEach((role, index) => { if (!byRole[role]) byRole[role] = index === 0 ? first.name : second.name; });
  const pick = (role) => byRole[role] || first.name;
  return template
    .replace('{move}', pick('move')).replace('{fin}', pick('finish')).replace('{cre}', pick('create'))
    .replace('{def}', pick('defend')).replace('{body}', pick('body'));
}

/* ---------- Scoring ---------- */
const SATURATION = 2.7;
const REACH_REFERENCE = 9;
const FAMILY_REPEAT_FACTOR = 0.8;
const PARTNER_OFF_ROLE_FACTOR = 0.25;
const MAX_FIT = 98;

export function scorePlaystyles(positionCode, answers = {}) {
  const positionInfo = positionByCode(positionCode);
  if (!positionInfo) return null;
  const questions = getPlaystyleQuestions(positionCode);
  const answered = questions
    .map((question) => ({ question, option: chosenOption(question, answers) }))
    .filter((item) => item.option);
  const isKeeper = positionCode === 'GK';

  const userTraits = {};
  answered.forEach(({ option }) => {
    for (const [trait, points] of Object.entries(option.traits)) userTraits[trait] = (userTraits[trait] || 0) + points;
  });

  const meta = PLAYSTYLE_META[positionCode];
  const candidates = PLAYSTYLES
    .filter((style) => (isKeeper ? style.category === 'Goalkeeper' : style.category !== 'Goalkeeper'))
    .map((style, sourceIndex) => {
      const profile = PLAYSTYLE_PROFILE[style.name];
      let raw = 0;
      const evidence = [];
      answered.forEach(({ question, option }) => {
        const points = contribution(option, profile);
        raw += points;
        if (points >= 0.9) evidence.push({ questionId: question.id, kicker: question.kicker, text: option.because, points });
      });
      let reach = 0;
      questions.forEach((question) => {
        reach += Math.max(0, ...question.options.map((option) => contribution(option, profile)));
      });
      const reachBoost = Math.min(Math.sqrt(REACH_REFERENCE / Math.max(reach, 3)), 1.7);
      const fitsPosition = (PLAYSTYLE_POSITION_FIT[style.name] || []).includes(positionCode);
      const isMeta = Boolean(meta && meta.picks.includes(style.name));
      const positionFactor = fitsPosition ? 1 : OFF_POSITION_FACTOR;
      const evidenceScore = raw * reachBoost * positionFactor;
      const score = evidenceScore > 0 ? evidenceScore + (isMeta ? META_BONUS : 0) : 0;
      evidence.sort((a, b) => b.points - a.points);
      return {
        ...style,
        sourceIndex,
        raw,
        score,
        fitsPosition,
        isMeta,
        evidence: evidence.slice(0, 3),
        fit: Math.max(0, Math.min(MAX_FIT, Math.round(MAX_FIT * (1 - Math.exp(-score / SATURATION)))))
      };
    })
    .sort((a, b) => b.score - a.score || Number(b.fitsPosition) - Number(a.fitsPosition) || a.sourceIndex - b.sourceIndex);

  const slots = isKeeper ? 1 : 2;
  const picks = [];
  const pool = [...candidates];
  while (picks.length < slots && pool.length) {
    let bestIndex = 0;
    let bestValue = -1;
    pool.forEach((candidate, index) => {
      const repeated = picks.some((pick) => PLAYSTYLE_PROFILE[pick.name].family === PLAYSTYLE_PROFILE[candidate.name].family);
      const offRole = picks.length > 0 && !candidate.fitsPosition;
      const value = candidate.score * (repeated ? FAMILY_REPEAT_FACTOR : 1) * (offRole ? PARTNER_OFF_ROLE_FACTOR : 1);
      if (value > bestValue + 1e-9) { bestValue = value; bestIndex = index; }
    });
    picks.push(pool.splice(bestIndex, 1)[0]);
  }
  // Runner-ups: anything with evidence first, then on-role / community picks so there are always options to swap to.
  const rank = (candidate) => (candidate.score > 0 ? 2 : 0) + (candidate.fitsPosition ? 1 : 0) + (candidate.isMeta ? 0.5 : 0);
  const alternates = pool
    .filter((candidate) => candidate.score > 0 || candidate.fitsPosition)
    .sort((a, b) => rank(b) - rank(a) || b.score - a.score || a.sourceIndex - b.sourceIndex)
    .slice(0, 3);

  picks.forEach((pick) => {
    if (!pick.evidence.length && answered.length) {
      pick.evidence = [{
        questionId: 'position', kicker: 'Role',
        text: pick.isMeta ? 'community guides rate it highly for the ' + positionInfo.label.toLowerCase() : 'it suits the ' + positionInfo.label.toLowerCase() + ' role',
        points: 1
      }];
    }
  });

  return {
    position: positionInfo,
    questions,
    answeredCount: answered.length,
    totalQuestions: questions.length,
    complete: answered.length === questions.length && questions.length > 0,
    ranked: candidates,
    picks,
    alternates,
    dna: buildDna(userTraits),
    archetype: buildArchetype(positionInfo, userTraits),
    synergy: picks.length === 2 ? describePair(picks[0], picks[1]) : '',
    meta: meta ? { picks: meta.picks, note: meta.note } : null,
    userTraits
  };
}

export function getPlaystyleRecommendations({ position, answers } = {}) {
  const result = scorePlaystyles(position, answers);
  return result && result.complete ? result.picks : [];
}

export function fitLabel(fit) {
  if (fit >= 85) return 'Excellent match';
  if (fit >= 70) return 'Strong match';
  if (fit >= 50) return 'Good match';
  return 'Supporting pick';
}

/* ---------- Share links: "CB.bacda" ---------- */
export function encodeBuild(positionCode, answers = {}) {
  const questions = getPlaystyleQuestions(positionCode);
  if (!questions.length) return '';
  const letters = questions.map((question) => {
    const index = question.options.findIndex((option) => option.id === answers[question.id]);
    return index >= 0 ? OPTION_LETTERS[index] : '-';
  }).join('');
  return positionCode + '.' + letters;
}

export function decodeBuild(value) {
  if (typeof value !== 'string') return null;
  const [positionCode, letters = ''] = value.split('.');
  const questions = getPlaystyleQuestions(positionCode);
  if (!questions.length || letters.length !== questions.length) return null;
  const answers = {};
  for (let i = 0; i < questions.length; i += 1) {
    if (letters[i] === '-') continue;
    const option = questions[i].options[OPTION_LETTERS.indexOf(letters[i])];
    if (!option) return null;
    answers[questions[i].id] = option.id;
  }
  return { position: positionCode, answers };
}
