// Pre-match analysis for the Premier League Matchday 7 captain tracker.
//
// What lives here: modelled chances, fixture info and written analysis.
// What does NOT live here: completed / failed statuses. Those stay in the
// Football Centre admin editor (footballCentre.js -> captainTracker.players).
//
// All percentages are plain numbers (24.8 means 24.8%).
// To refresh after new team news, edit the numbers below and redeploy.

export const CAPTAIN_ANALYSIS = {
  updated: '2026-10-08',
  updatedLabel: '8 Oct 2026',
  matchday: 7,
  baseOvr: 116,
  ceiling: 121,
  simulations: 7000000,
  pick: {
    id: 'fernandes',
    name: 'Bruno Fernandes',
    headline: 'Bruno is the only captain with a real route to 121.',
    chance: 0.43,
    why: 'Three goal contributions is the gate. Bruno is modelled at 2.4%. Everybody else is effectively 0%. Combined with corners, penalties and a ~40% United win, he is the only name whose 121 chance is not rounding error.',
  },

  taskOrder: ['minutes', 'win', 'cleanSheet', 'setPiece', 'contributions'],
  tasks: {
    minutes: {
      short: '60 min, no card',
      title: '+1 OVR by playing 60 minutes or more in the next match without getting booked',
    },
    win: { short: 'Club wins', title: '+1 OVR when the club wins the next match' },
    cleanSheet: { short: 'Clean sheet', title: '+1 OVR by keeping a clean sheet' },
    setPiece: { short: 'Set-piece goal', title: '+1 OVR by contributing to a set-piece goal' },
    contributions: { short: '3 goal contributions', title: '+1 OVR by getting 3 goal contributions' },
  },

  matches: {
    'everton-chelsea': {
      id: 'everton-chelsea',
      home: 'Everton',
      away: 'Chelsea',
      kickoff: '2026-10-17T11:30:00Z',
      ukTime: 'Sat 17 Oct, 12:30 BST',
      venue: 'Hill Dickinson Stadium',
      probs: { home: 32.4, draw: 25.2, away: 42.4 },
      goals: { home: 1.25, away: 1.46 },
    },
    'brentford-liverpool': {
      id: 'brentford-liverpool',
      home: 'Brentford',
      away: 'Liverpool',
      kickoff: '2026-10-17T14:00:00Z',
      ukTime: 'Sat 17 Oct, 15:00 BST',
      venue: 'Brentford Community Stadium',
      probs: { home: 28.7, draw: 22.5, away: 48.7 },
      goals: { home: 1.3, away: 1.77 },
    },
    'newcastle-villa': {
      id: 'newcastle-villa',
      home: 'Newcastle United',
      away: 'Aston Villa',
      kickoff: '2026-10-17T16:30:00Z',
      ukTime: 'Sat 17 Oct, 17:30 BST',
      venue: "St James' Park",
      probs: { home: 43.3, draw: 24.5, away: 32.1 },
      goals: { home: 1.55, away: 1.3 },
    },
    'leeds-united': {
      id: 'leeds-united',
      home: 'Leeds United',
      away: 'Manchester United',
      kickoff: '2026-10-18T13:00:00Z',
      ukTime: 'Sun 18 Oct, 14:00 BST',
      venue: 'Elland Road',
      probs: { home: 36.0, draw: 24.2, away: 39.9 },
      goals: { home: 1.4, away: 1.48 },
      note: 'Bruno and Ampadu play each other. Only one of them can collect the win condition, and a 0-0 would give both a clean sheet.',
    },
    'brighton-palace': {
      id: 'brighton-palace',
      home: 'Brighton',
      away: 'Crystal Palace',
      kickoff: '2026-10-18T13:00:00Z',
      ukTime: 'Sun 18 Oct, 14:00 BST',
      venue: 'Amex Stadium',
      probs: { home: 57.0, draw: 22.0, away: 21.0 },
      goals: { home: 1.87, away: 1.04 },
    },
  },

  players: {
    fernandes: {
      match: ['fernandes', 'bruno'],
      name: 'Bruno Fernandes',
      club: 'Manchester United',
      matchId: 'leeds-united',
      side: 'away',
      verdict: 'The only captain with a route to 121.',
      summary:
        'Bruno is the one captain whose profile fits all five conditions. He takes United\'s corners and penalties, and last season he was involved in 30 league goals in 35 games. The catch is the same for everyone: 121 needs a clean sheet and three goal contributions, which means United winning by three or more without conceding. He plays away at Leeds, where the public models make the game close to even.',
      climb: [88.06, 47.41, 22.83, 5.86, 0.43],
      outcomes: [11.94, 40.65, 24.58, 16.98, 5.43, 0.43],
      marginal: { minutes: 75.3, win: 39.5, cleanSheet: 24.8, setPiece: 22.6, contributions: 2.4 },
      notes: {
        minutes:
          'Five starts and five full 90s this season. The risk is a knock he has been managing since the Champions League win over Sabah. He sat out Portugal\'s game in Norway as a precaution, then played against Denmark. His card record is light, so fitness is the main worry.',
        win: 'Slight favourites at Elland Road in the pre-match projections, about 40% against 36% for Leeds. United have gone three league games without a win.',
        cleanSheet:
          'United have not kept a clean sheet in five league games, and Leeds have scored in four of their five. The model gives Leeds about 1.4 expected goals.',
        setPiece:
          'The best chance in the group by a distance. He has taken 23 of United\'s 36 corners this season, delivers the free kicks and takes the penalties. Ten of his 20 assists last season came from set pieces.',
        contributions:
          'He averaged 0.86 league goal involvements a game last season and has 4 in 5 this season. Three in one match needs United to score at least three, so this is the condition that decides whether 121 is real. Roughly 1 in 40.',
      },
      risks: [
        'A managed knock, with United short in other positions.',
        'No clean sheet in five league games this season.',
        'A Leeds win closes the win and clean sheet conditions together.',
      ],
      upside: 'A United win to nil would clear three conditions at once.',
      confidence: 'Medium',
      form: 'Manchester United: W1 D2 L2, no clean sheet. Leeds: W2 D3 L0, three conceded.',
      stats: [
        { k: 'League 2026-27', v: '3 goals, 1 assist, 5 starts' },
        { k: 'League 2025-26', v: '9 goals, 21 assists, 35 games' },
        { k: 'Corners taken', v: '23 of 36 this season' },
        { k: 'Cards', v: '3 yellows in 2,257 minutes (to mid-March 2026)' },
      ],
      model: [
        { k: 'Chance he is fit to play', v: '97%' },
        { k: 'Cards per 90 minutes', v: '0.15' },
        { k: 'Share of United goals he is part of', v: '44%' },
        { k: 'Share of set-piece goals he is part of', v: '55%' },
      ],
    },

    james: {
      match: ['reece james', 'james'],
      name: 'Reece James',
      club: 'Chelsea',
      matchId: 'everton-chelsea',
      side: 'away',
      verdict: 'Fitness decides everything.',
      summary:
        'Reece James is first on Chelsea\'s corner and cross list and Chelsea are favourites at Everton, but he has a recurring hamstring problem. He missed the 3-0 defeat at Brentford and is only pencilled in to return against Bournemouth on 10 October. If he is declared fit and starts that game, his minutes chance moves from about 49% to about 69%.',
      climb: [74.54, 37.33, 13.0, 1.25, 0.01],
      outcomes: [25.46, 37.21, 24.33, 11.75, 1.25, 0.01],
      marginal: { minutes: 49.2, win: 42.2, cleanSheet: 28.8, setPiece: 6.0, contributions: 0.03 },
      notes: {
        minutes:
          'Mostly an availability number. The model gives him a 75% chance of being fit for Everton and 55% to go the full 90 once back. He has one yellow in 292 league minutes this season and four in 1,960 last season.',
        win: 'Chelsea are about 42% to win, Everton 32%. Chelsea have lost two of five and Everton are unbeaten, so this is no formality.',
        cleanSheet:
          'Chelsea have conceded 12 in five league games with no clean sheet. The models still price Everton at about 1.25 goals, so the chance sits near 29%.',
        setPiece:
          'He is listed first for Chelsea\'s corners and crosses and took seven corners against Hull. The chance is held down by his minutes and by other Chelsea players sharing set-piece duty.',
        contributions:
          'A right-back with six goal involvements in 29 league games last season. Three in one match is close to impossible.',
      },
      risks: [
        'Hamstring relapse on 10 October would end his chances.',
        'Alonso may manage his minutes after three weeks out.',
        'Chelsea have not kept a clean sheet this season.',
      ],
      upside: 'If he starts on 10 October and looks sharp, his numbers move up by roughly 20 points on the first condition.',
      swingLine: 'Fitness news on 10 Oct moves his minutes chance from 49% to about 69%',
      confidence: 'Low',
      form: 'Chelsea: W2 D1 L2, 12 conceded. Everton: W2 D3 L0.',
      stats: [
        { k: 'League 2026-27', v: '4 games, 292 minutes, 1 yellow' },
        { k: 'League 2025-26', v: '2 goals, 4 assists, 4 yellows, 1,960 minutes' },
        { k: 'Corners', v: '7 against Hull on 12 Sep' },
        { k: 'Injury', v: 'Hamstring, return pencilled for 10 Oct' },
      ],
      model: [
        { k: 'Chance he is fit to play', v: '75%' },
        { k: 'Cards per 90 minutes', v: '0.20' },
        { k: 'Share of Chelsea goals he is part of', v: '10%' },
        { k: 'Share of set-piece goals he is part of', v: '22%' },
      ],
    },

    vandijk: {
      match: ['van dijk', 'vandijk', 'virgil'],
      name: 'Virgil van Dijk',
      club: 'Liverpool',
      matchId: 'brentford-liverpool',
      side: 'away',
      verdict: 'The safest floor on the board.',
      summary:
        'Van Dijk has played every minute of Liverpool\'s league season, rarely gets booked and plays for the side that is favourite away at Brentford. He is a realistic target for 118 or 119, but there is no path to three goal contributions.',
      climb: [91.98, 50.77, 22.77, 2.45, 0.01],
      outcomes: [8.02, 41.21, 28.01, 20.32, 2.45, 0.01],
      marginal: { minutes: 82.1, win: 48.4, cleanSheet: 27.2, setPiece: 10.2, contributions: 0.03 },
      notes: {
        minutes:
          'He has played every minute of Liverpool\'s five league games and all 38 last season, with four yellows in 3,420 minutes. The one real risk is a rest day for a 35-year-old.',
        win: 'Liverpool are about 49% to win at Brentford, who are unbeaten but have drawn three of five.',
        cleanSheet:
          'Three clean sheets in five league games this season. Brentford still carry about 1.3 expected goals at home, so the number stays under 30%.',
        setPiece:
          'He is a header target on corners, not a taker. His chance is his share of Liverpool\'s set-piece goals, which the model puts at about one in five.',
        contributions: 'Centre-backs do not produce three involvements in a match. Effectively zero.',
      },
      risks: [
        'Iraola could rest him after five full matches.',
        'Liverpool have drawn three of their five league games.',
        'Brentford are unbeaten and beat Chelsea 3-0 before the break.',
      ],
      upside: 'A narrow win to nil with a header from a corner takes him to 120.',
      confidence: 'High',
      form: 'Liverpool: W2 D3 L0, three clean sheets. Brentford: W2 D3 L0.',
      stats: [
        { k: 'League 2026-27', v: '5 starts, 450 minutes, 1 yellow' },
        { k: 'League 2025-26', v: '38 games, 3,420 minutes, 4 yellows' },
        { k: 'Clean sheets', v: '3 in 5 league games for Liverpool' },
        { k: 'Age', v: '35' },
      ],
      model: [
        { k: 'Chance he is fit to play', v: '96%' },
        { k: 'Cards per 90 minutes', v: '0.11' },
        { k: 'Share of Liverpool goals he is part of', v: '7%' },
        { k: 'Share of set-piece goals he is part of', v: '20%' },
      ],
    },

    dunk: {
      match: ['dunk'],
      name: 'Lewis Dunk',
      club: 'Brighton',
      matchId: 'brighton-palace',
      side: 'home',
      verdict: 'Best home fixture, worst card record.',
      summary:
        'The best home fixture and the best clean-sheet chance, wrapped around the worst card record in the group. Brighton are third, have scored 16 in five and face a Palace side that has won one of five. Dunk should start, so the question is whether he stays out of the book: he picked up 10 yellows in 33 league games last season.',
      climb: [87.43, 52.74, 21.97, 1.39, 0.0],
      outcomes: [12.57, 34.69, 30.78, 20.58, 1.39, 0.0],
      marginal: { minutes: 65.8, win: 56.8, cleanSheet: 35.4, setPiece: 5.5, contributions: 0.01 },
      notes: {
        minutes:
          'Starting is not in doubt. Staying unbooked is: 10 yellows in 33 league games last season means about one match in four ends with a card for him.',
        win: 'The best win chance of the six, at home to a Palace side with one league win in five.',
        cleanSheet:
          'The highest in the group. Palace\'s expected goals are the lowest of any opponent here, around one. Brighton did concede three at Chelsea, so it is not a lock.',
        setPiece:
          'His route is a header from a corner or free kick, which is how most of his Premier League goals have come. He scores about one a season, so even with Brighton scoring freely the chance is small.',
        contributions:
          'Brighton are scoring freely, but Dunk takes a very small share of those goals. Three involvements is out of reach.',
      },
      risks: [
        'Highest card rate of the six.',
        'He is 34, so a late rest is possible if the game is won early.',
        'Brighton have conceded in four of five league games.',
      ],
      upside: 'Win to nil without a booking is three conditions, and the model gives that route a real chance.',
      confidence: 'High',
      form: 'Brighton: W3 D1 L1, 16 scored. Palace: W1 D1 L3.',
      stats: [
        { k: 'League 2026-27', v: '4 starts, 1 goal, 1 yellow (to 13 Sep)' },
        { k: 'League 2025-26', v: '33 games, 1 goal, 10 yellows' },
        { k: 'Brighton league form', v: '16 scored, 5 conceded in 5' },
        { k: 'Age', v: '34' },
      ],
      model: [
        { k: 'Chance he is fit to play', v: '95%' },
        { k: 'Cards per 90 minutes', v: '0.30' },
        { k: 'Share of Brighton goals he is part of', v: '4.5%' },
        { k: 'Share of set-piece goals he is part of', v: '12%' },
      ],
    },

    mcginn: {
      match: ['mcginn', 'mc ginn'],
      name: 'John McGinn',
      club: 'Aston Villa',
      matchId: 'newcastle-villa',
      side: 'away',
      verdict: 'A tough fixture with a thin route.',
      summary:
        'Villa have one win in five and a minus five goal difference, and they travel to a Newcastle side that is favoured in the pre-match projections. McGinn starts every game and has two assists already, but his card record and Villa\'s defence cap four of the five conditions.',
      climb: [76.53, 30.41, 10.46, 0.46, 0.01],
      outcomes: [23.47, 46.12, 19.95, 10.0, 0.46, 0.01],
      marginal: { minutes: 61.7, win: 32.0, cleanSheet: 21.2, setPiece: 2.9, contributions: 0.11 },
      notes: {
        minutes:
          'Five starts in five, 87 minutes on average, so the 60-minute mark is likely. Two yellows in five league games this season, at Brighton and against Arsenal, drag the chance down.',
        win: 'Villa are the underdogs at St James\' Park, about 32% against 43% for Newcastle.',
        cleanSheet:
          'Newcastle carry about 1.55 expected goals, the highest opposition figure for any captain here, and Villa have conceded nine in five league games.',
        setPiece:
          'Modelled as a box runner rather than a deliverer, so he needs a second ball or a knock-down to fall to him.',
        contributions:
          'The most productive of the non-Bruno group, with nine goals and assists in 30 league games last season. Villa\'s low expected goals still keep three in one match close to zero.',
      },
      risks: [
        'Villa have conceded nine in their last five league games.',
        'Two yellows already this season.',
        'Villa also play in the Champions League, so rotation is possible.',
      ],
      upside: 'A Villa away win would be a shock, and it would open the clean sheet as well.',
      confidence: 'High',
      form: 'Aston Villa: W1 D1 L3, nine conceded. Newcastle: W2 D2 L1.',
      stats: [
        { k: 'League 2026-27', v: '5 starts, 436 minutes, 2 assists, 2 yellows' },
        { k: 'League 2025-26', v: '30 games, 5 goals, 4 assists, 5 yellows' },
        { k: 'Villa league form', v: 'W1 D1 L3, goal difference -5' },
        { k: 'Age', v: '31' },
      ],
      model: [
        { k: 'Chance he is fit to play', v: '96%' },
        { k: 'Cards per 90 minutes', v: '0.26' },
        { k: 'Share of Villa goals he is part of', v: '17%' },
        { k: 'Share of set-piece goals he is part of', v: '10%' },
      ],
    },

    ampadu: {
      match: ['ampadu'],
      name: 'Ethan Ampadu',
      club: 'Leeds United',
      matchId: 'leeds-united',
      side: 'home',
      verdict: 'A floor pick with no upside.',
      summary:
        'Ampadu starts and finishes every game for a Leeds side that is unbeaten, so the first three conditions are live. His set-piece and goal-involvement numbers are close to zero, and a 10-yellow season means the card is always in play.',
      climb: [82.36, 34.95, 12.78, 0.45, 0.0],
      outcomes: [17.64, 47.42, 22.16, 12.33, 0.45, 0.0],
      marginal: { minutes: 69.5, win: 35.7, cleanSheet: 22.7, setPiece: 2.7, contributions: 0.0 },
      notes: {
        minutes:
          'Five starts and five full 90s. Last season he picked up 10 yellows in 35 league games, and a heated fixture against United raises the chance of a card.',
        win: 'Leeds are about 36% to win at home, a shade behind United\'s 40%. Bruno and Ampadu play each other, so only one of them can collect this condition.',
        cleanSheet:
          'Leeds have two clean sheets in five league games, against Forest and Palace, and have conceded three in total. A 0-0 would give Ampadu and Bruno one each.',
        setPiece:
          'He sits in front of the back line and is not modelled as a corner or free-kick taker, so the chance is small.',
        contributions: 'One goal and one assist in 35 league games last season.',
      },
      risks: [
        'Highest card rate among the midfielders in the group.',
        'Leeds draw a lot, with three draws in five.',
        'Almost no route to the last two conditions.',
      ],
      upside: 'A Leeds win to nil without a card gets him to 119, which is as far as he can realistically go.',
      confidence: 'High',
      form: 'Leeds: W2 D3 L0, three conceded. Manchester United: W1 D2 L2.',
      stats: [
        { k: 'League 2026-27', v: '5 starts, 450 minutes, no cards yet' },
        { k: 'League 2025-26', v: '35 games, 3,123 minutes, 10 yellows' },
        { k: 'Leeds league form', v: '7 scored, 3 conceded in 5' },
        { k: 'Role', v: 'Holding midfielder' },
      ],
      model: [
        { k: 'Chance he is fit to play', v: '97%' },
        { k: 'Cards per 90 minutes', v: '0.28' },
        { k: 'Share of Leeds goals he is part of', v: '4%' },
        { k: 'Share of set-piece goals he is part of', v: '7%' },
      ],
    },
  },

  reads: [
    {
      title: 'Condition five decides everything',
      body: 'Three goal contributions is the hardest task by a wide margin. Bruno Fernandes has about a 2.4% chance of it and nobody else is above 0.2%. That one condition is why 121 is a long shot for the whole board.',
    },
    {
      title: 'Win and clean sheet land together',
      body: 'Both come from the same scoreline. Once a club keeps a clean sheet, it wins between 73% and 85% of the time, depending on how many goals it is expected to score. Treat them as one big result rather than two coin flips.',
    },
    {
      title: 'Plan for 119, not 121',
      body: 'Bruno Fernandes, Virgil van Dijk and Lewis Dunk are level at roughly 22% to reach 119 or better. For the defenders, the best realistic finish is 120, and that sits between 1% and 2.5%.',
    },
  ],

  method: [
    {
      title: 'Match probabilities',
      body: 'Win and draw chances are pre-match projections that are converted into expected goals for each side.',
    },
    {
      title: 'Simulation',
      body: 'Each captain gets 7,000,000 simulated matches. Every one draws the score, whether he is fit, how long he plays, whether he is booked and which goals he is part of. All five conditions are read from the same match, so win, clean sheet and goal involvement move together.',
    },
    {
      title: 'Player factors',
      body: 'Minutes, card rates, set-piece roles, team involvement and recent form are used to build the player projections.',
    },
  ],

  assumptions: [
    'Win and clean sheet are counted for the club.',
    'A set-piece contribution is scoring or assisting a goal from a corner, free kick or penalty.',
    'Goal contributions are goals plus assists, and three are needed in the same match.',
    'For 60 minutes without a booking, a yellow or red at any point ends the condition.',
  ],

  caveat:
    'Lineups arrive about an hour before kickoff and can move any number here. Chances are estimates and can change with team news, lineups and match conditions.',
};
