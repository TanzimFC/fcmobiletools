import { PLAYSTYLES } from './playstyles.js';

export const PLAYSTYLE_POSITIONS = [
  { code: 'ST', label: 'Striker', detail: 'ST', profileGroup: 'attack' },
  { code: 'LW', label: 'Left wing', detail: 'LW', profileGroup: 'wingAttack' },
  { code: 'RW', label: 'Right wing', detail: 'RW', profileGroup: 'wingAttack' },
  { code: 'CAM', label: 'Attacking midfield', detail: 'CAM', profileGroup: 'midfield' },
  { code: 'CM', label: 'Central midfield', detail: 'CM', profileGroup: 'midfield' },
  { code: 'CDM', label: 'Defensive midfield', detail: 'CDM', profileGroup: 'midfield' },
  { code: 'LM', label: 'Left midfield', detail: 'LM', profileGroup: 'wideMidfield' },
  { code: 'RM', label: 'Right midfield', detail: 'RM', profileGroup: 'wideMidfield' },
  { code: 'LB', label: 'Left back', detail: 'LB', profileGroup: 'fullback' },
  { code: 'RB', label: 'Right back', detail: 'RB', profileGroup: 'fullback' },
  { code: 'CB', label: 'Centre back', detail: 'CB', profileGroup: 'defence' },
  { code: 'GK', label: 'Goalkeeper', detail: 'GK', profileGroup: 'goalkeeper' }
];

// These are relevance hints, not restrictions. A player's chosen job can outweigh
// the usual role fit, but the position still affects the final ranking.
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

export const PLAYSTYLE_GOALS = [
  { id: 'sprint-dribble', label: 'Carry the ball at speed', hint: 'Burst forward while keeping control.', positionCodes: ['ST', 'LW', 'RW', 'CAM', 'LM', 'RM'], styleNames: ['Rapid'] },
  { id: 'skill-moves', label: 'Beat a marker one-on-one', hint: 'Keep the ball close while using skill moves.', positionCodes: ['ST', 'LW', 'RW', 'CAM', 'LM', 'RM'], styleNames: ['Trickster'] },
  { id: 'off-ball-runs', label: 'Make runs into space', hint: 'Accelerate when moving without the ball.', positionCodes: ['ST', 'LW', 'RW', 'CAM', 'CM', 'LM', 'RM', 'LB', 'RB'], styleNames: ['Accelerator'] },

  { id: 'quick-passes', label: 'Move the ball quickly', hint: 'Play fast, accurate ground passes and combinations.', positionCodes: ['CAM', 'CM', 'CDM', 'LM', 'RM', 'LB', 'RB', 'CB'], styleNames: ['Bullet Pass', 'Tiki Taka'] },
  { id: 'ground-through', label: 'Split the defence on the ground', hint: 'Send quicker through balls into space.', positionCodes: ['ST', 'CAM', 'CM', 'CDM'], styleNames: ['Incisive Through'] },
  { id: 'lob-through', label: 'Play lower, faster lobbed through balls', hint: 'Find runners over a line of defenders.', positionCodes: ['CAM', 'CM', 'CDM'], styleNames: ['Driven Lob Through'] },
  { id: 'crosses', label: 'Deliver crosses from wide areas', hint: 'Improve pace, curve and accuracy on crosses.', positionCodes: ['LW', 'RW', 'LM', 'RM', 'LB', 'RB'], styleNames: ['Whipped Crosser'] },

  { id: 'regular-shots', label: 'Finish regular shots', hint: 'Improve close- and mid-range shots.', positionCodes: ['ST', 'LW', 'RW', 'CAM', 'CM'], styleNames: ['Clinical Finisher'] },
  { id: 'finesse-shots', label: 'Curl shots around the goalkeeper', hint: 'Add curve, speed and accuracy to finesse shots.', positionCodes: ['ST', 'LW', 'RW', 'CAM', 'CM'], styleNames: ['Finesse Shot'] },
  { id: 'power-shots', label: 'Hit stronger power shots', hint: 'Improve power-shot speed and accuracy.', positionCodes: ['ST', 'CAM', 'CM', 'CDM'], styleNames: ['Power Shot'] },
  { id: 'chip-shots', label: 'Chip the goalkeeper', hint: 'Use a dipping chip shot with improved accuracy.', positionCodes: ['ST', 'CAM', 'LW', 'RW'], styleNames: ['Chip Shot'] },
  { id: 'free-kicks', label: 'Take direct free kicks', hint: 'Improve free-kick accuracy, pace and movement.', positionCodes: ['ST', 'LW', 'RW', 'CAM', 'CM', 'CDM', 'LM', 'RM', 'LB', 'RB', 'CB'], styleNames: ['Dead Ball'] },
  { id: 'penalties', label: 'Take penalties', hint: 'Improve penalty accuracy and shot speed.', positionCodes: ['ST', 'CAM'], styleNames: ['Penalty Expert'] },
  { id: 'headers', label: 'Win headers and aerial balls', hint: 'Improve headed shots, passes and clearances.', positionCodes: ['ST', 'CB'], styleNames: ['Precision Header'] },

  { id: 'standing-tackles', label: 'Win standing tackles', hint: 'Improve tackle reach, speed and clean ball wins.', positionCodes: ['CB', 'LB', 'RB', 'CDM', 'CM'], styleNames: ['Anticipate'] },
  { id: 'hard-tackles', label: 'Step in with stronger tackles', hint: 'Improve hard-tackle range and speed.', positionCodes: ['CB', 'LB', 'RB', 'CDM'], styleNames: ['Guardian'] },
  { id: 'slide-tackles', label: 'Make slide tackles and recover', hint: 'Improve slide-tackle coverage, control and recovery.', positionCodes: ['CB', 'LB', 'RB', 'CDM'], styleNames: ['Slide Tackle'] },

  { id: 'physical-duels', label: 'Win physical duels', hint: 'Use strength when shielding or challenging an opponent.', positionCodes: ['ST', 'CB', 'CDM'], styleNames: ['Bruiser'] },
  { id: 'stamina', label: 'Keep running late in the match', hint: 'Reduce fatigue and improve half-time recovery.', positionCodes: ['CM', 'CDM', 'LM', 'RM', 'LB', 'RB', 'CB'], styleNames: ['Relentless Stamina'] },

  { id: 'keeper-parries', label: 'Push saves away from danger', hint: 'Direct parries into safer areas.', positionCodes: ['GK'], styleNames: ['Deflector'] },
  { id: 'keeper-rush', label: 'Rush off the goal line', hint: 'Close down attackers faster when leaving the line.', positionCodes: ['GK'], styleNames: ['Super Rush'] }
];

export const PLAYSTYLE_PROFILES = {
  attack: [
    { id: 'burst', label: 'Burst past defenders', hint: 'Speed, close control and skill moves.', styleNames: ['Rapid', 'Trickster', 'Accelerator'] },
    { id: 'finishing', label: 'Make chances count', hint: 'A stronger end product in front of goal.', styleNames: ['Clinical Finisher', 'Finesse Shot', 'Power Shot', 'Chip Shot', 'Penalty Expert'] },
    { id: 'aerial', label: 'Win the physical battle', hint: 'Strength and an edge in the air.', styleNames: ['Precision Header', 'Bruiser'] },
    { id: 'creator', label: 'Create for teammates', hint: 'Move the ball quickly and find runners.', styleNames: ['Incisive Through', 'Driven Lob Through', 'Bullet Pass', 'Tiki Taka', 'Whipped Crosser'] },
    { id: 'set-pieces', label: 'Handle set pieces', hint: 'Free kicks, penalties and power.', styleNames: ['Dead Ball', 'Penalty Expert', 'Power Shot'] }
  ],
  wingAttack: [
    { id: 'burst', label: 'Beat the fullback', hint: 'Explode into space or win a one-on-one.', styleNames: ['Rapid', 'Trickster', 'Accelerator'] },
    { id: 'cut-inside', label: 'Cut inside and shoot', hint: 'Turn wide possession into a shot.', styleNames: ['Finesse Shot', 'Clinical Finisher', 'Power Shot', 'Chip Shot'] },
    { id: 'delivery', label: 'Create from wide areas', hint: 'Cross accurately and keep combinations sharp.', styleNames: ['Whipped Crosser', 'Bullet Pass', 'Tiki Taka'] },
    { id: 'combination', label: 'Link up with nearby players', hint: 'Quick passing and through balls.', styleNames: ['Tiki Taka', 'Incisive Through', 'Bullet Pass'] },
    { id: 'defend-wide', label: 'Help win the ball back', hint: 'Be more useful when tracking back.', styleNames: ['Anticipate', 'Guardian', 'Slide Tackle', 'Relentless Stamina'] }
  ],
  midfield: [
    { id: 'controller', label: 'Control possession', hint: 'Reliable short passing and quick combinations.', styleNames: ['Tiki Taka', 'Bullet Pass'] },
    { id: 'line-breaker', label: 'Break defensive lines', hint: 'Find runners with through balls.', styleNames: ['Incisive Through', 'Driven Lob Through'] },
    { id: 'ball-winner', label: 'Win the ball back', hint: 'Tackling, recovery and physical pressure.', styleNames: ['Anticipate', 'Guardian', 'Slide Tackle', 'Bruiser'] },
    { id: 'engine', label: 'Cover ground all match', hint: 'Keep moving and arrive in space.', styleNames: ['Relentless Stamina', 'Accelerator', 'Rapid'] },
    { id: 'late-shooter', label: 'Threaten from distance', hint: 'Give the player another shooting option.', styleNames: ['Power Shot', 'Finesse Shot', 'Clinical Finisher', 'Dead Ball'] },
    { id: 'carry-midfield', label: 'Carry through midfield', hint: 'Turn space into forward momentum.', styleNames: ['Rapid', 'Trickster', 'Accelerator'] }
  ],
  wideMidfield: [
    { id: 'wide-delivery', label: 'Deliver from wide areas', hint: 'Crossing and quick passes down the flank.', styleNames: ['Whipped Crosser', 'Bullet Pass'] },
    { id: 'wide-engine', label: 'Keep moving for 90 minutes', hint: 'Cover ground and recover stamina.', styleNames: ['Relentless Stamina', 'Accelerator'] },
    { id: 'wide-carry', label: 'Carry past opponents', hint: 'Use speed and skill moves.', styleNames: ['Rapid', 'Trickster'] },
    { id: 'wide-combine', label: 'Combine with short passes', hint: 'Keep the ball moving under pressure.', styleNames: ['Tiki Taka', 'Bullet Pass'] },
    { id: 'wide-defend', label: 'Track back and defend', hint: 'Improve tackles and work late in the match.', styleNames: ['Anticipate', 'Guardian', 'Slide Tackle', 'Relentless Stamina'] }
  ],
  defence: [
    { id: 'read-defend', label: 'Read the play and tackle cleanly', hint: 'Prioritise standing-tackle range and control.', styleNames: ['Anticipate'] },
    { id: 'step-in', label: 'Step in aggressively', hint: 'Use stronger challenges and physical presence.', styleNames: ['Guardian', 'Bruiser'] },
    { id: 'recover', label: 'Recover after a challenge', hint: 'Slide-tackle control and stamina.', styleNames: ['Slide Tackle', 'Relentless Stamina'] },
    { id: 'aerial-defence', label: 'Own the air', hint: 'Improve headers and physical contests.', styleNames: ['Precision Header', 'Bruiser'] },
    { id: 'build-up', label: 'Start attacks with the ball', hint: 'Play cleaner, faster passes from the back.', styleNames: ['Bullet Pass', 'Tiki Taka'] }
  ],
  fullback: [
    { id: 'lockdown', label: 'Lock down the winger', hint: 'Win tackles and keep the flank secure.', styleNames: ['Anticipate', 'Guardian', 'Slide Tackle'] },
    { id: 'overlap', label: 'Overlap and deliver crosses', hint: 'Support attacks without fading late.', styleNames: ['Whipped Crosser', 'Relentless Stamina', 'Accelerator'] },
    { id: 'recycle', label: 'Recycle possession', hint: 'Keep build-up passes clean and quick.', styleNames: ['Bullet Pass', 'Tiki Taka'] },
    { id: 'fullback-engine', label: 'Stay effective late', hint: 'Reduce fatigue over the match.', styleNames: ['Relentless Stamina', 'Accelerator'] },
    { id: 'duels', label: 'Win physical duels', hint: 'Stand up to strong runners.', styleNames: ['Bruiser', 'Guardian'] }
  ],
  goalkeeper: [
    { id: 'safe-parries', label: 'Keep rebounds away from danger', hint: 'Direct saves into safer areas.', styleNames: ['Deflector'] },
    { id: 'sweeper', label: 'Play higher and rush out', hint: 'Close attackers down off the line.', styleNames: ['Super Rush'] }
  ]
};

export function getPlaystyleGoalsForPosition(positionCode) {
  return PLAYSTYLE_GOALS.filter((goal) => goal.positionCodes.includes(positionCode));
}

export function getPlaystyleProfileChoices(positionCode) {
  const position = PLAYSTYLE_POSITIONS.find((item) => item.code === positionCode);
  return position ? (PLAYSTYLE_PROFILES[position.profileGroup] || []) : [];
}

export function getPlaystyleRecommendations({ position, goalId, profileId } = {}) {
  const positionInfo = PLAYSTYLE_POSITIONS.find((item) => item.code === position);
  const goal = PLAYSTYLE_GOALS.find((item) => item.id === goalId && item.positionCodes.includes(position));
  const profile = getPlaystyleProfileChoices(position).find((item) => item.id === profileId);
  if (!positionInfo || !goal || !profile) return [];

  const goalStyles = new Set(goal.styleNames);
  const profileStyles = new Set(profile.styleNames);
  const candidates = PLAYSTYLES
    .filter((style) => position === 'GK' ? style.category === 'Goalkeeper' : style.category !== 'Goalkeeper')
    .map((style, sourceIndex) => {
      const fitsPosition = (PLAYSTYLE_POSITION_FIT[style.name] || []).includes(position);
      const matchesGoal = goalStyles.has(style.name);
      const matchesProfile = profileStyles.has(style.name);
      const score = (matchesGoal ? 12 : 0) + (matchesProfile ? 8 : 0) + (fitsPosition ? 6 : 0);
      const matchTags = [];
      if (matchesGoal) matchTags.push(goal.label);
      if (matchesProfile) matchTags.push(profile.label);
      if (fitsPosition) matchTags.push('Position fit');

      let reason = 'A strong fit for the ' + positionInfo.label.toLowerCase() + ' role.';
      if (matchesGoal && matchesProfile) {
        reason = 'Matches both your main job and preferred player type.';
      } else if (matchesGoal) {
        reason = 'Direct match for your main job: ' + goal.label.toLowerCase() + '.';
      } else if (matchesProfile) {
        reason = 'Matches your preferred player type: ' + profile.label.toLowerCase() + '.';
      }

      return {
        ...style,
        score,
        sourceIndex,
        fitsPosition,
        matchesGoal,
        matchesProfile,
        reason,
        matchTags
      };
    })
    .sort((a, b) => b.score - a.score || Number(b.fitsPosition) - Number(a.fitsPosition) || a.sourceIndex - b.sourceIndex);

  return candidates.slice(0, position === 'GK' ? 1 : 2);
}
