// Football Centre content managed by the admin panel.
// Keep this file JSON-compatible because the Worker reads and validates it before committing updates.
export const FOOTBALL_CENTRE_CONTENT = {
  "cycle": {
    "id": "2026-09",
    "label": "SEPTEMBER 2026 · ACTIVE CYCLE",
    "title": "Football Centre progress",
    "description": "Eight Showdowns across four weeks. Earn 80 points for each played match, +20 for World Class and +400 for a correct team prediction.",
    "matchesPerWeek": 2
  },
  "clubs": {
    "mu": {
      "name": "Manchester United",
      "short": "Man United",
      "logo": "https://media.api-sports.io/football/teams/33.png"
    },
    "mc": {
      "name": "Manchester City",
      "short": "Man City",
      "logo": "https://media.api-sports.io/football/teams/50.png"
    },
    "ren": {
      "name": "Stade Rennais FC",
      "short": "Stade Rennais",
      "logo": "https://media.api-sports.io/football/teams/94.png"
    },
    "mar": {
      "name": "Olympique de Marseille",
      "short": "Marseille",
      "logo": "https://media.api-sports.io/football/teams/81.png"
    },
    "ars": {
      "name": "Arsenal",
      "short": "Arsenal",
      "logo": "https://media.api-sports.io/football/teams/42.png"
    },
    "liv": {
      "name": "Liverpool",
      "short": "Liverpool",
      "logo": "https://media.api-sports.io/football/teams/40.png"
    },
    "bar": {
      "name": "FC Barcelona",
      "short": "Barcelona",
      "logo": "https://media.api-sports.io/football/teams/529.png"
    },
    "rma": {
      "name": "Real Madrid",
      "short": "Real Madrid",
      "logo": "https://media.api-sports.io/football/teams/541.png"
    },
    "bay": {
      "name": "Bayern Munich",
      "short": "Bayern",
      "logo": "https://media.api-sports.io/football/teams/157.png"
    },
    "dor": {
      "name": "Borussia Dortmund",
      "short": "Dortmund",
      "logo": "https://media.api-sports.io/football/teams/165.png"
    },
    "psg": {
      "name": "Paris Saint-Germain",
      "short": "PSG",
      "logo": "https://media.api-sports.io/football/teams/85.png"
    },
    "lyon": {
      "name": "Olympique Lyonnais",
      "short": "Lyon",
      "logo": "https://media.api-sports.io/football/teams/80.png"
    },
    "inter": {
      "name": "Inter Milan",
      "short": "Inter",
      "logo": "https://media.api-sports.io/football/teams/505.png"
    },
    "milan": {
      "name": "AC Milan",
      "short": "AC Milan",
      "logo": "https://media.api-sports.io/football/teams/489.png"
    },
    "juve": {
      "name": "Juventus",
      "short": "Juventus",
      "logo": "https://media.api-sports.io/football/teams/496.png"
    },
    "nap": {
      "name": "Napoli",
      "short": "Napoli",
      "logo": "https://media.api-sports.io/football/teams/492.png"
    }
  },
  "matches": [
    {
      "id": "showdown-01",
      "week": 1,
      "home": "mu",
      "away": "mc"
    },
    {
      "id": "showdown-02",
      "week": 1,
      "home": "ren",
      "away": "mar"
    },
    {
      "id": "showdown-03",
      "week": 2,
      "home": "ars",
      "away": "liv"
    },
    {
      "id": "showdown-04",
      "week": 2,
      "home": "bar",
      "away": "rma"
    },
    {
      "id": "showdown-05",
      "week": 3,
      "home": "bay",
      "away": "dor"
    },
    {
      "id": "showdown-06",
      "week": 3,
      "home": "psg",
      "away": "lyon"
    },
    {
      "id": "showdown-07",
      "week": 4,
      "home": "inter",
      "away": "milan"
    },
    {
      "id": "showdown-08",
      "week": 4,
      "home": "juve",
      "away": "nap"
    }
  ],
  "analysis": {
    "label": "MATCH ANALYSIS",
    "title": "Think before you pick",
    "warning": "⚠ Pick at your own risk. Analysis is informational only and is not a guarantee. Football is unpredictable. No prediction here is certain.",
    "videoEmbedUrl": "https://www.youtube.com/embed/KvgulT3RtFE",
    "videoWatchUrl": "https://www.youtube.com/watch?v=KvgulT3RtFE",
    "videoTitle": "Release timing video",
    "videoBody": "This video contains information about the expected timing of the TOTW release. The content shown may not be in the game yet.",
    "videoWarning": "Do not treat timing as a confirmed in-game release until the content is actually available."
  },
  "totw": {
    "label": "TEAM OF THE WEEK",
    "title": "TOTW release tracker",
    "description": "Use the analysis video for timing context. This page does not claim a TOTW is live until the content is actually available.",
    "chip": "LIVE CHECK",
    "statusLabel": "RELEASE STATUS",
    "statusTitle": "Check before claiming",
    "statusBody": "There is no fake player list here. When the official TOTW content is confirmed, this section can be populated without changing the Football Centre scoring system.",
    "safetyLabel": "SAFETY NOTE",
    "safetyTitle": "No guaranteed predictions",
    "safetyBody": "Analysis and timing information are informational only. Football Centre rewards are based on your recorded match outcomes."
  },
  "settings": {
    "cycleId": "2026-09",
    "startingBalance": 0,
    "scoring": {
      "played": 80,
      "worldClass": 20,
      "correctPrediction": 400
    }
  },
  "videoEmbedUrl": "https://www.youtube.com/embed/KvgulT3RtFE",
  "videoWatchUrl": "https://www.youtube.com/watch?v=KvgulT3RtFE",
  "id": "2026-09",
  "label": "SEPTEMBER 2026 · ACTIVE CYCLE",
  "title": "Football Centre progress",
  "matchesPerWeek": 2,
  "description": "Eight Showdowns across four weeks. Earn 80 points for each played match, +20 for World Class and +400 for a correct team prediction.",
  "eventCountdown": {
    "enabled": true,
    "title": "FC Mobile Anniversary Event",
    "subtitle": "The Anniversary Event starts with the September 24 season update",
    "banner": "https://res.cloudinary.com/b0qikv7n/image/upload/v1789672979/fc-mobile-tools/wio7rwhdmnyawoa4j4zq.jpg",
    "startUtc": "2026-09-24T01:00:00.000Z",
    "endUtc": "",
    "accent": "ANNIVERSARY EVENT"
  },
  "divisionRivalsReset": {
    "enabled": true,
    "title": "Division Rivals Reset",
    "anchorUtc": "2026-09-24T01:00:00.000Z",
    "cycleDays": 28,
    "label": "28-day Division Rivals season reset",
    "note": "The next reset is anchored to Thursday, September 24 at 01:00 UTC and repeats every 28 days. The schedule is configurable from the admin panel."
  }
};
