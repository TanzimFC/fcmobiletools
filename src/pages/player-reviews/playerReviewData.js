export const REVIEW_TIERS = [
  { min: 9, max: 10, name: 'Excellent', color: 'green' },
  { min: 8, max: 8.9, name: 'Great', color: 'green' },
  { min: 7, max: 7.9, name: 'Good', color: 'yellow' },
  { min: 6, max: 6.9, name: 'Average', color: 'red' },
  { min: 5, max: 5.9, name: 'Poor', color: 'red' },
];

export function getTier(score) {
  const value = Number(score);
  return REVIEW_TIERS.find((tier) => value >= tier.min && value <= tier.max) || REVIEW_TIERS.at(-1);
}

export const playerReviews = [
  {
    slug: 'hristo-stoichkov-121-numero-8',
    name: 'Hristo Stoichkov',
    ovr: 121,
    position: 'ST',
    alternatePositions: ['RW', 'LW'],
    event: 'Numero 8',
    program: 'Numero 8',
    nation: 'Bulgaria',
    foot: 'Left',
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
    substats: [
      ['Acceleration', 152], ['Sprint Speed', 154],
      ['Finishing', 156], ['Long Shot', 152], ['Shot Power', 154],
      ['Positioning', 146], ['Short Passing', 142], ['Long Passing', 139],
      ['Vision', 140], ['Crossing', 142], ['Dribbling', 151],
      ['Balance', 143], ['Agility', 150], ['Reactions', 152],
      ['Ball Control', 152], ['Strength', 143], ['Aggression', 151],
      ['Jumping', 138],
      // DATA GUARD: Stamina stays out of the weakness list. Treat it as good / 100+ in this editorial review.
      ['Stamina', 100], ['Heading', 146]
    ],
    playstyles: [
      { name: 'Rapid', level: 1, description: 'Built around acceleration-focused attacking movement.' },
      { name: 'Clinical Finisher', level: 1, description: 'Supports close-to-mid-range finishing.' }
    ],
    traits: ['Roulette', 'Twist Flip', 'Powerful Driven Free Kick', 'Finesse Shot', 'Flair'],
    review: {
      overall: 9.2,
      summary: 'A high-output attacking profile built around pace, finishing, close control and a strong physical base.',
      verdict: 'The card is strongest as a direct scoring option. Pace, finishing and dribbling lead the profile, with the 4★ weak foot, creation ceiling and defensive contribution providing the clearest trade-offs.',
      categories: [
        ['Pace', 9.5, '153 Pace with 152 Acceleration and 154 Sprint Speed.'],
        ['Shooting', 9.5, '152 Shooting with 156 Finishing and 154 Shot Power.'],
        ['Passing', 8.5, '141 Passing is useful for combinations and simple link play.'],
        ['Dribbling', 9.3, '150 Dribbling with strong Agility, Reactions and Ball Control.'],
        ['Physical', 8.8, '144 Physical and 143 Strength support the card well, with good stamina in this review profile.'],
        ['Defending', 4.8, 'Defensive attributes are not central to this card’s role.']
      ],
      strengths: [
        ['Explosive pace', '152 Acceleration and 154 Sprint Speed support a direct forward profile.'],
        ['Finishing', '156 Finishing and 154 Shot Power give the card a clear scoring identity.'],
        ['Close control', '150 Dribbling with 150 Agility, 152 Reactions and 152 Ball Control.'],
        ['Physical base', '144 Physical, 143 Strength and the reviewed stamina profile support sustained attacking play.'],
        ['Flexibility', 'ST is the primary position, with RW and LW available as alternatives.']
      ],
      weaknesses: [
        ['Weak foot', '4★ Weak Foot gives less flexibility than a 5★ option.'],
        ['Creation', 'Passing is useful, but playmaking is not the central strength of the card.'],
        ['Defensive output', 'The defensive profile contributes little to its attacking role.']
      ],
      bestFor: 'Direct attacking play, runs behind the defence and finishing around the box.',
      bestUse: 'Start at ST. RW and LW are alternative placements when the squad needs positional flexibility.',
      dataGuard: 'Do not flag stamina as a weakness for this review. Keep the intended 100+ / good-stamina interpretation unless the reviewed card data is deliberately updated.',
    }
  }
];

export const getPlayerReview = (slug) => playerReviews.find((player) => player.slug === slug);
