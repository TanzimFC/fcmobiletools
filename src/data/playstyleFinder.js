import { PLAYSTYLES } from './playstyles.js';

// Match these goals to the descriptions in playstyles.js. No hidden stats or
// invented ratings are used; each result is tied to the action the player chose.
export const PLAYSTYLE_GOALS = [
  { id: 'sprint-dribble', group: 'With the ball', label: 'Sprint with the ball', hint: 'Get moving faster while carrying the ball.', styleNames: ['Rapid'] },
  { id: 'skill-moves', group: 'With the ball', label: 'Use skill moves in one-on-ones', hint: 'Keep the ball close while using skill moves.', styleNames: ['Trickster'] },
  { id: 'off-ball-runs', group: 'With the ball', label: 'Make runs into open space', hint: 'Pick up speed while moving without the ball.', styleNames: ['Accelerator'] },

  { id: 'quick-passes', group: 'Passing and crossing', label: 'Play quick ground passes', hint: 'Move the ball quickly and accurately along the ground.', styleNames: ['Bullet Pass', 'Tiki Taka'] },
  { id: 'ground-through', group: 'Passing and crossing', label: 'Send a ground through ball behind defenders', hint: 'Play a quicker, more accurate pass into space.', styleNames: ['Incisive Through'] },
  { id: 'lob-through', group: 'Passing and crossing', label: 'Play a faster, lower lobbed through ball', hint: 'Use a lobbed through pass that stays lower.', styleNames: ['Driven Lob Through'] },
  { id: 'crosses', group: 'Passing and crossing', label: 'Deliver better crosses and corners', hint: 'Add pace, accuracy and curve to crosses.', styleNames: ['Whipped Crosser'] },

  { id: 'regular-shots', group: 'Shooting', label: 'Improve regular shots near goal', hint: 'Help close- and mid-range shots reach the target.', styleNames: ['Clinical Finisher'] },
  { id: 'finesse-shots', group: 'Shooting', label: 'Curl shots around the goalkeeper', hint: 'Get more curve and accuracy on finesse shots.', styleNames: ['Finesse Shot'] },
  { id: 'power-shots', group: 'Shooting', label: 'Hit stronger power shots', hint: 'Improve power-shot speed and accuracy.', styleNames: ['Power Shot'] },
  { id: 'chip-shots', group: 'Shooting', label: 'Chip the goalkeeper', hint: 'Use a dipping chip shot with better speed and accuracy.', styleNames: ['Chip Shot'] },
  { id: 'free-kicks', group: 'Shooting', label: 'Take free kicks', hint: 'Improve direct free-kick shots.', styleNames: ['Dead Ball'] },
  { id: 'penalties', group: 'Shooting', label: 'Take penalties', hint: 'Improve penalty accuracy and shot speed.', styleNames: ['Penalty Expert'] },
  { id: 'headers', group: 'Shooting', label: 'Win headers and improve headed passes', hint: 'Make headers faster and more accurate.', styleNames: ['Precision Header'] },

  { id: 'standing-tackles', group: 'Defending', label: 'Win standing tackles', hint: 'Improve tackle range and speed.', styleNames: ['Anticipate'] },
  { id: 'hard-tackles', group: 'Defending', label: 'Make stronger hard tackles', hint: 'Improve the reach and speed of hard tackles.', styleNames: ['Guardian'] },
  { id: 'slide-tackles', group: 'Defending', label: 'Improve slide tackles', hint: 'Improve coverage, ball control and recovery.', styleNames: ['Slide Tackle'] },

  { id: 'physical-duels', group: 'Stamina and physical play', label: 'Win shoulder battles and shield the ball', hint: 'Get more strength in physical contests.', styleNames: ['Bruiser'] },
  { id: 'stamina', group: 'Stamina and physical play', label: 'Keep stamina for longer', hint: 'Lose less stamina and recover more at half-time.', styleNames: ['Relentless Stamina'] },

  { id: 'keeper-parries', group: 'Goalkeeping', label: 'Push saves away from danger', hint: 'Direct parries towards safer areas.', styleNames: ['Deflector'] },
  { id: 'keeper-rush', group: 'Goalkeeping', label: 'Rush out to meet attackers', hint: 'Help the goalkeeper move off the line faster.', styleNames: ['Super Rush'] }
];

export const PLAYSTYLE_GOAL_GROUPS = [...new Set(PLAYSTYLE_GOALS.map((goal) => goal.group))];

export function getPlaystyleRecommendations(selectedGoalIds = []) {
  const selected = new Set(
    (Array.isArray(selectedGoalIds) ? selectedGoalIds : [])
      .filter((id) => PLAYSTYLE_GOALS.some((goal) => goal.id === id))
  );
  if (!selected.size) return [];

  return PLAYSTYLES.map((style, sourceIndex) => {
    const goals = PLAYSTYLE_GOALS.filter(
      (goal) => selected.has(goal.id) && goal.styleNames.includes(style.name)
    );
    return goals.length ? { ...style, goals, matchCount: goals.length, sourceIndex } : null;
  })
    .filter(Boolean)
    .sort((a, b) => b.matchCount - a.matchCount || a.sourceIndex - b.sourceIndex);
}
