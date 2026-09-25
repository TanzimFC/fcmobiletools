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
    height: '178 cm',
    weight: '73 kg',
    workRate: 'High / Medium',
    cardImage: 'https://assets.fcmobilesquad.com/players/cards/v2/26/30920646-96b6e49b72c964dd.png',
    starShards: 22080,
    auctionable: false,
    addedOn: '2026-09-16',

    // Current FC Mobile progression frame used by the review UI.
    // Rank 5 adds +5 displayed OVR; Training 30 is the current training cap.
    // Exact final substats depend on the selected skill-point path and are not invented here.
    maxBuild: {
      trainingLevel: 30,
      maxTrainingLevel: 30,
      rank: 5,
      skillPoints: 5,
      maxOvr: 126,
      totalTrainingXp: 160000,
      rankUpPoints: {
        costs: [140, 280, 420, 560, 700],
        total: 2100
      }
    },

    stats: {
      pace: 153,
      shooting: 152,
      passing: 141,
      dribbling: 150,
      defending: 95,
      physical: 144
    },

    substats: {
      pace: {
        acceleration: 152,
        sprint_speed: 154
      },
      shooting: {
        finishing: 156,
        long_shot: 152,
        shot_power: 154,
        positioning: 146,
        volley: 153,
        penalties: 140
      },
      passing: {
        short_passing: 142,
        long_passing: 139,
        vision: 140,
        crossing: 142,
        curve: 149,
        free_kick: 147
      },
      dribbling: {
        dribbling: 151,
        balance: 143,
        agility: 150,
        reactions: 152,
        ball_control: 152
      },
      defending: {
        marking: 76,
        standing_tackle: 104,
        sliding_tackle: 83,
        awareness: 88
      },
      physical: {
        heading: 146,
        strength: 143,
        aggression: 151,
        jumping: 138,
        stamina: 83
      }
    },

    playstyles: ['Rapid', 'Clinical Finisher'],
    traits: ['Roulette', 'Twist Flip', 'Powerful Driven Free Kick', 'Finesse Shot', 'Flair'],

    review: {
      overall: 9.2,
      summary: 'An attack-first striker profile built around explosive movement, elite finishing and sharp close control.',
      verdict: 'The card is easiest to understand as a direct scorer: pace gets him into the action, finishing converts it, and dribbling keeps the attack moving. The main compromise is the 4★ weak foot.',
      categories: [
        ['Pace', 9.7, '152 Acc · 154 Sprint'],
        ['Shooting', 9.6, '156 Fin · 154 Power'],
        ['Passing', 8.7, '142 Short · 140 Vision'],
        ['Dribbling', 9.5, '151 Drib · 152 Reactions'],
        ['Defending', 5.8, '95 overall'],
        ['Physical', 9.0, '143 Strength · 151 Aggression']
      ],
      strengths: [
        { title: 'Explosive', value: '152 Acc · 154 Sprint', detail: 'Top-end acceleration and sprint speed drive his direct striker profile.' },
        { title: 'Finisher', value: '156 Fin · 154 Power', detail: 'Finishing, shot power, volleys and long shots all sit at a high level.' },
        { title: 'Clean on the ball', value: '151 Drib · 152 Reactions', detail: 'Agility, reactions and ball control reinforce his close-control game.' },
        { title: 'Flexible attack', value: 'ST · RW · LW', detail: 'The alternate positions make him easier to fit into rotating front lines.' }
      ],
      weaknesses: [
        { title: '4★ weak foot', value: 'Left-footed · 4★ WF', detail: 'The clearest limitation compared with elite 5★ weak-foot forwards.' },
        { title: 'Passing ceiling', value: '141 Passing', detail: 'Good enough for combinations, but not the standout part of the card.' },
        { title: 'Defensive value', value: '95 Defending', detail: 'This is an attacking card; defensive contribution is naturally secondary.' }
      ],
      fit: 'Best suited to ST, with RW/LW as flexible alternatives.',
      bestFor: 'Direct attacking play, fast forward runs, finishing around the box and players who value close control.'
    }
  }
];

export const getPlayerReview = (slug) => playerReviews.find((player) => player.slug === slug);
