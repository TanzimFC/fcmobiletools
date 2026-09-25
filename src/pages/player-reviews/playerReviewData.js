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
    program: 'Numero 8 Icons',
    event: 'Numero 8',
    nation: 'Bulgaria',
    foot: 'Left',
    weakFoot: 4,
    skillMoves: 4,
    workRate: 'High / Medium',
    cardImage: 'https://assets.fcmobilesquad.com/players/cards/v2/26/30920646-96b6e49b72c964dd.png',
    playstyles: ['Rapid', 'Clinical Finisher'],
    review: {
      overall: 9.2,
      summary: 'A direct attacking striker built around pace, finishing and close control.',
      verdict: 'Stoichkov is easiest to understand as a fast scorer: he gets into dangerous areas quickly, finishes well and stays clean on the ball. The main compromise is the 4★ weak foot.',
      strengths: [
        {
          title: 'Explosive',
          detail: 'Built for direct attacking movement and quick runs behind the defence.'
        },
        {
          title: 'Elite finishing',
          detail: 'The attacking profile is heavily geared toward converting chances.'
        },
        {
          title: 'Sharp dribbling',
          detail: 'Strong close-control traits make him comfortable around the box.'
        },
        {
          title: 'Flexible',
          detail: 'ST is the natural role, with RW and LW available as alternatives.'
        }
      ],
      weaknesses: [
        {
          title: '4★ weak foot',
          detail: 'The clearest limitation versus forwards with a 5★ weak foot.'
        },
        {
          title: 'Not a creator first',
          detail: 'Passing is useful, but playmaking is not the reason to use this card.'
        },
        {
          title: 'Defensive value is limited',
          detail: 'This is an attack-focused card and should be treated that way.'
        }
      ],
      fit: 'Best at ST · RW / LW as alternatives.',
      bestFor: 'Direct attacking play, runs behind the defence and finishing around the box.'
    }
  }
];

export const getPlayerReview = (slug) => playerReviews.find((player) => player.slug === slug);
