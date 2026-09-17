// Football Centre content managed by the admin panel.
// Keep presentation/interaction logic in FootballCentre.astro; this file holds editable content only.
export const FOOTBALL_CENTRE_CONTENT = {
  clubs: {
    mu: { name: 'Manchester United', short: 'Man United', logo: 'https://media.api-sports.io/football/teams/33.png' },
    mc: { name: 'Manchester City', short: 'Man City', logo: 'https://media.api-sports.io/football/teams/50.png' },
    ren: { name: 'Stade Rennais FC', short: 'Stade Rennais', logo: 'https://media.api-sports.io/football/teams/94.png' },
    mar: { name: 'Olympique de Marseille', short: 'Marseille', logo: 'https://media.api-sports.io/football/teams/81.png' },
    ars: { name: 'Arsenal', short: 'Arsenal', logo: 'https://media.api-sports.io/football/teams/42.png' },
    liv: { name: 'Liverpool', short: 'Liverpool', logo: 'https://media.api-sports.io/football/teams/40.png' },
    bar: { name: 'FC Barcelona', short: 'Barcelona', logo: 'https://media.api-sports.io/football/teams/529.png' },
    rma: { name: 'Real Madrid', short: 'Real Madrid', logo: 'https://media.api-sports.io/football/teams/541.png' },
    bay: { name: 'Bayern Munich', short: 'Bayern', logo: 'https://media.api-sports.io/football/teams/157.png' },
    dor: { name: 'Borussia Dortmund', short: 'Dortmund', logo: 'https://media.api-sports.io/football/teams/165.png' },
    psg: { name: 'Paris Saint-Germain', short: 'PSG', logo: 'https://media.api-sports.io/football/teams/85.png' },
    lyon: { name: 'Olympique Lyonnais', short: 'Lyon', logo: 'https://media.api-sports.io/football/teams/80.png' },
    inter: { name: 'Inter Milan', short: 'Inter', logo: 'https://media.api-sports.io/football/teams/505.png' },
    milan: { name: 'AC Milan', short: 'AC Milan', logo: 'https://media.api-sports.io/football/teams/489.png' },
    juve: { name: 'Juventus', short: 'Juventus', logo: 'https://media.api-sports.io/football/teams/496.png' },
    nap: { name: 'Napoli', short: 'Napoli', logo: 'https://media.api-sports.io/football/teams/492.png' }
  },
  matches: [
    { id: 'showdown-01', week: 1, home: 'mu', away: 'mc' },
    { id: 'showdown-02', week: 1, home: 'ren', away: 'mar' },
    { id: 'showdown-03', week: 2, home: 'ars', away: 'liv' },
    { id: 'showdown-04', week: 2, home: 'bar', away: 'rma' },
    { id: 'showdown-05', week: 3, home: 'bay', away: 'dor' },
    { id: 'showdown-06', week: 3, home: 'psg', away: 'lyon' },
    { id: 'showdown-07', week: 4, home: 'inter', away: 'milan' },
    { id: 'showdown-08', week: 4, home: 'juve', away: 'nap' }
  ],
  videoEmbedUrl: 'https://www.youtube.com/embed/KvgulT3RtFE',
  videoWatchUrl: 'https://www.youtube.com/watch?v=KvgulT3RtFE'
};
