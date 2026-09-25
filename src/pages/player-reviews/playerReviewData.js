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
      summary: 'Stoichkov is an attack-first striker card with a very strong all-round scoring profile: explosive pace, elite finishing, sharp dribbling and enough physicality to stay involved through contact.',
      verdict: 'A premium attacking card whose biggest advantages are the combination of pace, finishing and close control. The 4★ weak foot is the main limitation, while 83 stamina is perfectly serviceable rather than a red flag.',
      categories: [
        ['Pace', 9.7, '152 acceleration and 154 sprint speed make the card extremely quick on paper.'],
        ['Shooting', 9.6, '156 finishing, 154 shot power, 153 volleys and 152 long shots give him a deep scoring profile.'],
        ['Passing', 8.7, '142 short passing, 140 vision, 149 curve and 147 free kick make his link play more than adequate for a striker.'],
        ['Dribbling', 9.5, '151 dribbling, 150 agility, 152 reactions and 152 ball control are a major part of the card’s appeal.'],
        ['Defending', 5.8, 'Defensive output is secondary for this card, although 104 standing tackle is useful in isolated defensive moments.'],
        ['Physical', 9.0, '143 strength, 151 aggression and 146 heading create a strong forward profile; 83 stamina remains usable.']
      ],
      strengths: [
        'Very high pace with 152 acceleration and 154 sprint speed',
        '156 finishing backed by 154 shot power and 153 volley',
        'Excellent dribbling, reactions, agility and ball control',
        'Rapid + Clinical Finisher PlayStyles fit the attacking profile',
        '4★ Skill Moves and 4★ Weak Foot',
        'RW and LW alternate positions add squad flexibility'
      ],
      weaknesses: [
        '4★ Weak Foot is the clearest attacking limitation versus 5★ forwards',
        'Passing is strong but below the card’s elite shooting and dribbling levels',
        'Defending is naturally the least relevant part of the profile'
      ],
      fit: 'Best suited to ST. The RW/LW alternatives are useful when building around flexible attacking rotations.',
      bestFor: 'Players who want a fast, direct striker with strong finishing, quick movement and enough technical quality to combine around the box.'
    }
  }
];

export const getPlayerReview = (slug) => playerReviews.find((player) => player.slug === slug);
