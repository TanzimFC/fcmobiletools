export const REVIEW_TIERS = [
  { min: 9, max: 10, name: 'Elite', color: 'green' },
  { min: 8, max: 8.9, name: 'Strong', color: 'green' },
  { min: 7, max: 7.9, name: 'Solid', color: 'yellow' },
  { min: 6, max: 6.9, name: 'Mixed', color: 'red' },
  { min: 5, max: 5.9, name: 'Weak', color: 'red' },
];

export function getTier(score) {
  const value = Number(score);
  return REVIEW_TIERS.find((tier) => value >= tier.min && value <= tier.max) || REVIEW_TIERS[REVIEW_TIERS.length - 1];
}

export const playerReviews = [
  {
    slug: 'hristo-stoichkov-121-numero-8',
    name: 'Hristo Stoichkov',
    ovr: 121,
    position: 'ST',
    alternativePositions: ['RW', 'LW'],
    event: 'Numero 8',
    program: 'Numero 8 Icon Player',
    nation: 'Bulgaria',
    strongFoot: 'Left',
    weakFoot: 4,
    skillMoves: 4,
    workRate: 'High / Medium',
    height: '178 cm',
    weight: '73 kg',
    starShards: 22080,
    auctionable: false,
    cardImage: 'https://assets.fcmobilesquad.com/players/cards/v2/26/30920646-96b6e49b72c964dd.png',
    stats: {
      pace: 153,
      shooting: 152,
      passing: 141,
      dribbling: 150,
      defending: 95,
      physical: 144
    },
    detailedStats: [
      ['Acceleration', 152], ['Sprint Speed', 154], ['Finishing', 156], ['Long Shot', 152],
      ['Shot Power', 154], ['Positioning', 146], ['Short Passing', 142], ['Long Passing', 139],
      ['Vision', 140], ['Crossing', 142], ['Dribbling', 151], ['Balance', 143],
      ['Agility', 150], ['Reactions', 152], ['Ball Control', 152], ['Strength', 143],
      ['Aggression', 151], ['Jumping', 138], ['Stamina', 83], ['Heading', 146]
    ],
    playStyles: [['Rapid', 1], ['Clinical Finisher', 1]],
    traits: ['Roulette', 'Twist Flip', 'Powerful Driven Free Kick', 'Finesse Shot', 'Flair'],
    review: {
      overall: 9.2,
      summary: 'A high-end attacking profile with elite pace, finishing and dribbling numbers. The main statistical compromise is stamina.',
      method: 'Editorial card-data analysis based on the current card attributes, position, PlayStyles, traits, work rate and skill profile.',
      categories: [
        ['Pace', 9.5, '153 pace with 152 acceleration and 154 sprint speed.'],
        ['Shooting', 9.5, '152 shooting with 156 finishing and 154 shot power.'],
        ['Passing', 8.5, '141 passing is solid for a striker and supports combination play.'],
        ['Dribbling', 9.3, '150 dribbling with 150 agility, 152 reactions and 152 ball control.'],
        ['Physical', 8.8, '144 physical and 143 strength are strong; 83 stamina is the main caveat.'],
        ['Defending', 4.8, 'Defending is not a meaningful reason to select this attacking card.']
      ],
      strengths: [
        '153 pace with very strong acceleration and sprint speed',
        '156 finishing and 154 shot power',
        '4★ Skill Moves and 4★ Weak Foot',
        'Rapid and Clinical Finisher PlayStyles',
        'RW and LW alternate positions'
      ],
      weaknesses: [
        '83 stamina is the clearest statistical weakness',
        '4★ Weak Foot rather than 5★',
        'Defensive attributes add little value in this role',
        'Passing is useful but not the headline strength'
      ],
      bestUse: 'ST is the natural starting point. RW and LW are useful alternate positions when the squad needs flexibility.',
      sourceChecked: '25 September 2026'
    }
  }
];

export const getPlayerReview = (slug) => playerReviews.find((player) => player.slug === slug);
