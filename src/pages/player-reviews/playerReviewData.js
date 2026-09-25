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
    shortName: 'Stoichkov',
    ovr: 121,
    position: 'ST',
    alternatePositions: ['RW', 'LW'],
    event: 'Numero 8',
    program: 'Numero 8 Icon Player',
    nation: 'Bulgaria',
    foot: 'Left',
    weakFoot: 4,
    skillMoves: 4,
    workRate: 'High / Medium',
    height: '178 cm',
    weight: '73 kg',
    starShards: 22080,
    auctionable: false,
    addedOn: '16 September 2026',
    cardImage: 'https://assets.fcmobilesquad.com/players/cards/v2/26/30920646-96b6e49b72c964dd.png',
    stats: {
      pace: 153,
      shooting: 152,
      passing: 141,
      dribbling: 150,
      defending: 95,
      physical: 144
    },
    substats: [
      ['Acceleration', 152],
      ['Sprint Speed', 154],
      ['Finishing', 156],
      ['Long Shot', 152],
      ['Shot Power', 154],
      ['Positioning', 146],
      ['Volley', 153],
      ['Short Passing', 142],
      ['Long Passing', 139],
      ['Vision', 140],
      ['Crossing', 142],
      ['Curve', 149],
      ['Dribbling', 151],
      ['Balance', 143],
      ['Agility', 150],
      ['Reactions', 152],
      ['Ball Control', 152],
      ['Strength', 143],
      ['Aggression', 151],
      ['Jumping', 138],
      ['Stamina', 83],
      ['Heading', 146]
    ],
    playstyles: [
      { name: 'Rapid', level: 1, description: 'More explosive acceleration for sprint dribble and knock-ons.' },
      { name: 'Clinical Finisher', level: 1, description: 'More accurate placement from close to mid-range shooting distance.' }
    ],
    traits: ['Roulette', 'Twist Flip', 'Powerful Driven Free Kick', 'Finesse Shot', 'Flair'],
    review: {
      overall: 9.2,
      summary: 'A high-output attacking profile built around pace, finishing and clean close control.',
      verdict: 'The card reads as a direct scoring option first: quick acceleration, strong finishing numbers and a dribbling profile that supports attacking movement. Its clearest trade-offs are the 4★ weak foot and 83 stamina.',
      strengths: [
        { title: 'Explosive pace', detail: '153 Pace is backed by 152 Acceleration and 154 Sprint Speed.' },
        { title: 'Finishing profile', detail: '156 Finishing and 154 Shot Power give the card a clear scoring identity.' },
        { title: 'Strong close control', detail: '150 Dribbling, 150 Agility, 152 Reactions and 152 Ball Control form a strong attacking package.' },
        { title: 'Role flexibility', detail: 'ST is the primary position, with RW and LW available as alternate positions.' }
      ],
      weaknesses: [
        { title: '83 stamina', detail: 'The lowest headline physical value and the clearest statistical concern for longer matches.' },
        { title: '4★ weak foot', detail: 'Useful, but below the flexibility of a 5★ weak-foot striker.' },
        { title: 'Passing is secondary', detail: '141 Passing is useful for combinations, but creation is not the core reason to choose the card.' },
        { title: 'Limited defensive value', detail: 'The defensive profile does not add meaningful value to this attacking role.' }
      ],
      categories: [
        ['Pace', 9.5, '153 Pace with 152 Acceleration and 154 Sprint Speed.'],
        ['Shooting', 9.5, '152 Shooting with 156 Finishing, 154 Shot Power and strong supporting shooting attributes.'],
        ['Passing', 8.5, '141 Passing is reliable for combination play without being the headline strength.'],
        ['Dribbling', 9.3, '150 Dribbling with 150 Agility, 152 Reactions and 152 Ball Control.'],
        ['Physical', 8.8, '144 Physical and 143 Strength are strong, while 83 Stamina is the caveat.'],
        ['Defending', 4.8, 'Not a meaningful part of the card’s attacking value.']
      ],
      bestFor: 'Direct attacking play, runs behind the defence and finishing around the box.',
      bestUse: 'Start at ST. Use RW or LW only when squad structure or positional flexibility calls for it.',
      dataNote: 'Rating is an editorial judgement based on the current card data, role, PlayStyles, traits and position.',
      sources: [
        ['RenderZ — 121 OVR Stoichkov', 'https://renderz.app/player/30920646-stoichkov'],
        ['FC Mobile Squad — Star Signings players', 'https://fcmobilesquad.com/star-signings-players']
      ]
    }
  }
];

export const getPlayerReview = (slug) => playerReviews.find((player) => player.slug === slug);
