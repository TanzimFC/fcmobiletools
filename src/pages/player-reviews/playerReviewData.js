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

  {
    "slug": "frank-rijkaard-122-numero-8",
    "name": "Frank Rijkaard",
    "ovr": 122,
    "position": "CDM",
    "alternatePositions": [
      "CM",
      "CB"
    ],
    "event": "Numero 8",
    "program": "Numero 8",
    "nation": "Netherlands",
    "foot": "Right",
    "weakFoot": 4,
    "skillMoves": 3,
    "workRate": "Medium / High",
    "height": "187 cm",
    "weight": "85 kg",
    "starShards": 54625,
    "auctionable": false,
    "cardImage": "https://static.wixstatic.com/media/233dc5_8582f4bae34d4543a874f1fd1fc44836~mv2.png/v1/fill/w_443,h_547,al_c/20260316_213117.png",
    "stats": {
      "pace": 143,
      "shooting": 131,
      "passing": 147,
      "dribbling": 143,
      "defending": 151,
      "physical": 146
    },
    "substats": [
      [
        "Acceleration",
        145
      ],
      [
        "Sprint Speed",
        142
      ],
      [
        "Finishing",
        120
      ],
      [
        "Long Shot",
        142
      ],
      [
        "Shot Power",
        146
      ],
      [
        "Positioning",
        130
      ],
      [
        "Short Passing",
        154
      ],
      [
        "Long Passing",
        151
      ],
      [
        "Vision",
        150
      ],
      [
        "Crossing",
        140
      ],
      [
        "Dribbling",
        143
      ],
      [
        "Balance",
        139
      ],
      [
        "Agility",
        133
      ],
      [
        "Reactions",
        147
      ],
      [
        "Ball Control",
        154
      ],
      [
        "Marking",
        152
      ],
      [
        "Standing Tackle",
        155
      ],
      [
        "Sliding Tackle",
        151
      ],
      [
        "Awareness",
        154
      ],
      [
        "Heading",
        145
      ],
      [
        "Strength",
        152
      ],
      [
        "Aggression",
        144
      ],
      [
        "Jumping",
        140
      ],
      [
        "Stamina",
        89
      ]
    ],
    "playstyles": [
      {
        "name": "Anticipate",
        "level": 2,
        "description": "Adds stronger stand-tackle proficiency and defensive reliability."
      },
      {
        "name": "Bullet Pass",
        "level": 1,
        "description": "Improves driven ground-pass speed and accuracy."
      }
    ],
    "traits": [
      "Roulette",
      "Front Flip",
      "Long Passer",
      "Outside Foot Shot",
      "Acrobatic Clearance"
    ],
    "review": {
      "overall": 9.5,
      "summary": "A complete defensive-midfield profile combining elite defending, passing range, size and strong ball security.",
      "verdict": "Rijkaard is built around defensive control and distribution. The major trade-off is that the card is less dangerous as a pure attacking creator and the 89 Stamina is lower than the rest of the profile.",
      "categories": [
        [
          "Pace",
          9,
          "143 Pace with 145 Acceleration and 142 Sprint Speed."
        ],
        [
          "Shooting",
          7.4,
          "131 Shooting is functional, with 146 Shot Power and 142 Long Shot."
        ],
        [
          "Passing",
          9.7,
          "147 Passing with 154 Short Passing, 151 Long Passing and 150 Vision."
        ],
        [
          "Dribbling",
          9.1,
          "143 Dribbling with 147 Reactions and 154 Ball Control."
        ],
        [
          "Physical",
          9.2,
          "146 Physical and 152 Strength provide a strong midfield frame."
        ],
        [
          "Defending",
          9.8,
          "151 Defending with 152 Marking, 155 Standing Tackle and 154 Awareness."
        ]
      ],
      "strengths": [
        [
          "Defensive control",
          "151 Defending and 155 Standing Tackle anchor the profile."
        ],
        [
          "Distribution",
          "154 Short Passing, 151 Long Passing and 150 Vision give excellent range."
        ],
        [
          "Presence",
          "187 cm, 85 kg and 152 Strength give the card a strong physical frame."
        ],
        [
          "Position flexibility",
          "CDM is primary, with CM and CB available as alternatives."
        ]
      ],
      "weaknesses": [
        [
          "Stamina",
          "89 Stamina is lower than the rest of the card and can be the clearest late-match limitation."
        ],
        [
          "Attacking output",
          "131 Shooting is useful rather than a defining strength."
        ],
        [
          "Skill moves",
          "3★ Skill Moves are more limited than attacking-focused midfield options."
        ]
      ],
      "bestFor": "Holding midfield, defensive coverage, tempo control and progressive passing.",
      "bestUse": "Start at CDM. CM and CB are alternative placements when squad structure calls for them."
    }
  },
  {
    "slug": "socrates-122-numero-8",
    "name": "Sócrates",
    "ovr": 122,
    "position": "CM",
    "alternatePositions": [
      "CAM"
    ],
    "event": "Numero 8",
    "program": "Numero 8",
    "nation": "Brazil",
    "foot": "Right",
    "weakFoot": 5,
    "skillMoves": 4,
    "workRate": "High / Medium",
    "height": "192 cm",
    "weight": "79 kg",
    "starShards": null,
    "auctionable": false,
    "cardImage": "https://static.wixstatic.com/media/233dc5_67c838370a8d4a8ea6c28db6a55347b4~mv2.png/v1/fill/w_443,h_547,al_c/20260216_024256.png",
    "stats": null,
    "substats": [],
    "playstyles": [
      {
        "name": "Tiki Taka",
        "level": 2,
        "description": "Higher-level short-passing rhythm for combinations and circulation."
      },
      {
        "name": "Finesse Expert",
        "level": 1,
        "description": "Improves curled shooting through accuracy, curve and ball speed."
      }
    ],
    "traits": [
      "Lane Change",
      "Bow",
      "Powerful Driven Free Kick",
      "Finesse Shot",
      "Flair",
      "Long Passer",
      "Long Shot Taker",
      "Outside Foot Shot"
    ],
    "review": {
      "overall": 9.4,
      "summary": "A tall, two-footed midfield creator profile built around passing, shooting options and technical versatility.",
      "verdict": "Sócrates profiles as a high-end creative CM/CAM. The 5★ weak foot and dual PlayStyle package give him a broad attacking toolkit, while his height adds physical presence through midfield.",
      "categories": [],
      "strengths": [
        [
          "5★ weak foot",
          "Equal-footed distribution and shooting give the card broad attacking angles."
        ],
        [
          "Creative profile",
          "Tiki Taka, Long Passer and playmaker-oriented traits support a creator role."
        ],
        [
          "Finishing tools",
          "Finesse Expert, Finesse Shot and Long Shot Taker cover multiple shooting situations."
        ],
        [
          "Physical presence",
          "192 cm height gives the profile significant size for a CM/CAM."
        ]
      ],
      "weaknesses": [
        [
          "Turn profile",
          "A very tall frame can feel less agile in the smallest spaces."
        ],
        [
          "Primary role",
          "The card is more naturally suited to creative midfield roles than defensive screening."
        ]
      ],
      "bestFor": "Creative midfield, chance creation and shooting from central or edge-of-box positions.",
      "bestUse": "CM is the primary placement; CAM is the alternative when the squad needs more attacking freedom.",
      "statsPending": "Core attribute numbers are not yet published in the verified data set used for this review entry; no numbers have been invented."
    }
  },
  {
    "slug": "steven-gerrard-119-numero-8",
    "name": "Steven Gerrard",
    "ovr": 119,
    "position": "CM",
    "alternatePositions": [
      "CDM"
    ],
    "event": "Numero 8",
    "program": "Numero 8",
    "nation": "England",
    "foot": "Right",
    "weakFoot": 4,
    "skillMoves": 4,
    "workRate": "High / Medium",
    "height": "183 cm",
    "weight": "83 kg",
    "starShards": 6400,
    "auctionable": false,
    "cardImage": "https://images-v2.renderz.app/Screenshot_20251121_214405_com_ea_gp_fifamobile_eba4747717.jpg?verify=1771067764-%2BwX2B1gEi1%2BWe15EGkitFY8pYeMNjDYz0GWVljZyDUc%3D",
    "stats": {
      "pace": 136,
      "shooting": 138,
      "passing": 142,
      "dribbling": 139,
      "defending": 124,
      "physical": 125
    },
    "substats": [
      [
        "Acceleration",
        135
      ],
      [
        "Sprint Speed",
        137
      ],
      [
        "Finishing",
        138
      ],
      [
        "Long Shot",
        144
      ],
      [
        "Shot Power",
        142
      ],
      [
        "Positioning",
        136
      ],
      [
        "Short Passing",
        146
      ],
      [
        "Long Passing",
        142
      ],
      [
        "Vision",
        144
      ],
      [
        "Crossing",
        142
      ],
      [
        "Dribbling",
        141
      ],
      [
        "Balance",
        136
      ],
      [
        "Agility",
        134
      ],
      [
        "Reactions",
        142
      ],
      [
        "Ball Control",
        145
      ],
      [
        "Marking",
        128
      ],
      [
        "Standing Tackle",
        131
      ],
      [
        "Sliding Tackle",
        110
      ],
      [
        "Awareness",
        139
      ],
      [
        "Heading",
        110
      ],
      [
        "Strength",
        130
      ],
      [
        "Aggression",
        131
      ],
      [
        "Jumping",
        110
      ],
      [
        "Stamina",
        87
      ]
    ],
    "playstyles": [
      {
        "name": "Tiki Taka",
        "level": 1,
        "description": "Faster, more accurate ground-passing rhythm for midfield combinations."
      }
    ],
    "traits": [
      "Roulette",
      "Floor Spin",
      "Long Passer",
      "Long Shot Taker",
      "Play Maker",
      "Outside Foot Shot"
    ],
    "review": {
      "overall": 8.8,
      "summary": "A balanced box-to-box CM profile with useful shooting, passing range and enough defending to contribute in both phases.",
      "verdict": "Gerrard is a two-phase midfielder rather than a specialist. Passing and shooting give him attacking value, while 124 Defending makes him more involved defensively than a pure creator.",
      "categories": [
        [
          "Pace",
          8.4,
          "136 Pace with 135 Acceleration and 137 Sprint Speed."
        ],
        [
          "Shooting",
          8.7,
          "138 Shooting with 144 Long Shot and 142 Shot Power."
        ],
        [
          "Passing",
          9,
          "142 Passing with 146 Short Passing and 144 Vision."
        ],
        [
          "Dribbling",
          8.5,
          "139 Dribbling with 145 Ball Control and 142 Reactions."
        ],
        [
          "Physical",
          8.2,
          "125 Physical and 130 Strength are useful for midfield work."
        ],
        [
          "Defending",
          7.8,
          "124 Defending adds two-way value, although he is not a pure defensive midfielder."
        ]
      ],
      "strengths": [
        [
          "Two-phase output",
          "The card contributes on both sides of midfield rather than specializing in one phase."
        ],
        [
          "Passing range",
          "146 Short Passing, 142 Long Passing and 144 Vision form a useful distribution base."
        ],
        [
          "Shooting",
          "144 Long Shot and 142 Shot Power provide a clear distance threat."
        ],
        [
          "Work rate",
          "High / Medium supports an active attacking midfield role."
        ]
      ],
      "weaknesses": [
        [
          "Stamina",
          "87 Stamina is the clearest physical limitation in the verified base data."
        ],
        [
          "Specialization",
          "The profile is balanced rather than elite in one single core area."
        ],
        [
          "Weak foot",
          "4★ Weak Foot is solid, but less flexible than a 5★ option."
        ]
      ],
      "bestFor": "Two-way CM roles, midfield progression and secondary long-range scoring.",
      "bestUse": "Start at CM. CDM is the alternative placement when you want additional passing from a deeper role."
    }
  },
  {
    "slug": "gennaro-gattuso-118-numero-8",
    "name": "Gennaro Gattuso",
    "ovr": 118,
    "position": "CDM",
    "alternatePositions": [
      "CM"
    ],
    "event": "Numero 8",
    "program": "Numero 8",
    "nation": "Italy",
    "foot": "Right",
    "weakFoot": 3,
    "skillMoves": 2,
    "workRate": "Medium / High",
    "height": "177 cm",
    "weight": "77 kg",
    "starShards": null,
    "auctionable": false,
    "cardImage": null,
    "stats": null,
    "substats": [],
    "playstyles": [
      {
        "name": "Guardian",
        "level": 1,
        "description": "Higher hard-tackle proficiency and success rate."
      }
    ],
    "traits": [
      "Stepover and Exit",
      "Standing Archer"
    ],
    "review": {
      "overall": 8.5,
      "summary": "A defense-first CDM profile centered on tackling, physical pressure and defensive work rate.",
      "verdict": "Gattuso is built around defensive disruption rather than attacking flair. The CDM profile, Medium / High work rate and Guardian PlayStyle point to a specialist ball-winning role.",
      "categories": [],
      "strengths": [
        [
          "Defensive identity",
          "CDM is the primary role and the card is built around Holding, Physical and Defending."
        ],
        [
          "Guardian",
          "The signature PlayStyle reinforces hard-tackle reliability."
        ],
        [
          "Work rate",
          "Medium / High keeps the profile naturally defensive."
        ]
      ],
      "weaknesses": [
        [
          "Skill moves",
          "2★ Skill Moves limit attacking variety under pressure."
        ],
        [
          "Weak foot",
          "3★ Weak Foot is functional but restrictive compared with four- and five-star options."
        ],
        [
          "Attack contribution",
          "The design is clearly defense-first rather than built around chance creation."
        ]
      ],
      "bestFor": "Defensive midfield, ball winning and protecting the space in front of the back line.",
      "bestUse": "Start at CDM. CM is the alternative placement.",
      "statsPending": "Core attribute numbers are not yet published in the verified data set used for this review entry; no numbers have been invented."
    }
  }

export const getPlayerReview = (slug) => playerReviews.find((player) => player.slug === slug);
