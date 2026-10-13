// ---------------------------------------------------------------------------
// Season Recap (Challenge) — Extra Time trivia, FC Mobile 27.
//
// Static, locally hosted answer bank. No database, no API call and no runtime
// fetch: the pages are generated from this file at build time.
//
// HOW TO UPDATE
//   1. Add / fix a line in SEASON_RECAP_RAW below.
//        Format:  Question text :: Answer            (single answer)
//                 Question text :: Answer / Answer   (several valid answers)
//   2. Bump SEASON_RECAP_META.verified.
//   3. `npm run test:trivia` checks duplicates, categories and counts.
//
// Several questions legitimately have more than one correct answer: the game
// shows two options and exactly one of them is valid, so e.g. every club that
// qualified for the Champions League is listed on that one question.
//
// Sources (reconciled Oct 11, 2026):
//   - FIFAMobileGuide "Season Recap (Challenge) Trivia Answers" (updated Oct 10)
//   - SportsDunia "Season Recap Trivia Challenge" Day 2 list (Oct 9)
// ---------------------------------------------------------------------------
import { buildExtraTimeQuestions } from '../lib/triviaExtraTime.js';

export const SEASON_RECAP_META = {
  slug: 'season-recap',
  name: 'Season Recap (Challenge)',
  shortName: 'Season Recap',
  event: 'FC Mobile 27 · 3rd Anniversary',
  coverage: '2025/26 season recap · 2026/27 transfers',
  // Edit when EA changes the schedule. Shown as plain text, not a live countdown.
  window: { start: '2026-10-08', end: '2026-10-15', label: 'Oct 8 – Oct 15, 2026' },
  verified: '2026-10-11',
  verifiedLabel: 'Oct 11, 2026',
  format: { perRound: 30, options: 2 },
  // Versioned Cloudinary URLs are browser/CDN-cacheable and avoid depending on
  // image files that are not present in the repository.
  banner: {
    webp: 'https://res.cloudinary.com/b0qikv7n/image/upload/v1791739595/fc-mobile-tools/tra319zimnvlfas22fj8.webp',
    jpg: 'https://res.cloudinary.com/b0qikv7n/image/upload/v1791739595/fc-mobile-tools/tra319zimnvlfas22fj8.jpg',
    width: 1024,
    height: 572,
    alt: 'FC Mobile Season Recap Challenge trivia banner'
  },
  // Cumulative score tiers (points → Extra Time: Season Recap Tokens).
  rewards: [
    { tier: 1, points: 7000, reward: '200 Season Recap Tokens' },
    { tier: 2, points: 10500, reward: '200 Season Recap Tokens' },
    { tier: 3, points: 14000, reward: '300 Season Recap Tokens' },
    { tier: 4, points: 17500, reward: '300 Season Recap Tokens' },
    { tier: 5, points: 21000, reward: '500 Season Recap Tokens' },
    { tier: 6, points: 28000, reward: '500 Season Recap Tokens' },
    { tier: 7, points: 35000, reward: '1,000 Season Recap Tokens' },
    { tier: 8, points: 42000, reward: '1,750 Season Recap Tokens' },
    { tier: 9, points: 49000, reward: '1× FC Draft Voucher' },
    { tier: 10, points: 60000, reward: '3,250 Season Recap Tokens' }
  ],
  sources: [
    { name: 'FIFAMobileGuide', url: 'https://www.fifamobileguide.com/season-recap-daily-trivia-answers' },
    { name: 'SportsDunia', url: 'https://www.sportsdunia.com/esports/ea-fc-mobile-season-recap-trivia-challenge' }
  ]
};

export const SEASON_RECAP_RAW = `
Which of these teams qualified for the 2026/27 UEFA Champions League? :: Como 1907 / AS Roma / Atletico de Madrid / Paris Saint-Germain / Liverpool / Manchester United / Manchester City / Arsenal / Real Madrid / Villarreal CF / LOSC Lille / Real Betis / FC Bayern Munchen / Aston Villa / RC Lens / RB Leipzig / SSC Napoli / VfB Stuttgart
How many hat-tricks were scored in the 2025/26 Serie A season? :: 1
Which player won the LALIGA EA Sports Player of the Month award three times during the 2025/26 season? :: Lamine Yamal
How many goals did Toni Martinez score in the 2025/26 LALIGA EA Sports season? :: 14
Who scored the first goal of the 2025/26 Ligue 1 season? :: Ludovic Blas
Who finished as the top goalscorer of the 2025/26 Ligue 1 season? :: Esteban Lepaul
Who won the 2025/26 LALIGA EA Sports U23 Player of the Season award? :: Carlos Espi
How many goals did Marcus Thuram score in the 2025/26 Serie A season? :: 13
Which team won the 2025/26 Liga Portugal title? :: FC Porto
How many goals did Viktor Gyokeres score in the 2025/26 Premier League season? :: 14
How many clean sheets did Ivan Provedel keep in the 2025/26 Serie A season? :: 12
What was the longest winning run in the 2025/26 Bundesliga season? :: 9
How many goals did Ante Budimir score in the 2025/26 LALIGA EA Sports season? :: 17
How many different players scored a hat-trick in the 2025/26 Bundesliga season? :: 8
What was the longest unbeaten run in the 2025/26 Premier League season? :: 18
How many goals did Wesley Said score in the 2025/26 Ligue 1 season? :: 12
Which team had the longest unbeaten run in the 2025/26 Bundesliga season? :: FC Bayern Munchen
Which of these teams will compete in the 2026/27 UEFA Europa League? :: Olympique Lyonnais
How many clean sheets did Jean Butez keep in the 2025/26 LALIGA EA Sports season? :: 19
How many clean sheets did Gregor Kobel keep in the 2025/26 Bundesliga season? :: 15
How many clean sheets did Berke Ozer keep in the 2025/26 Ligue 1 season? :: 13
Who won the 2025/26 Premier League Player of the Season award? :: Bruno Fernandes
Who won the 2025/26 Premier League Save of the Season award? :: Jordan Pickford
Which of these players scored a hat-trick in the 2025/26 LALIGA EA Sports season? :: Julian Alvarez / Vedat Muriqi / Tajon Buchanan / Gonzalo
How many hat-tricks were scored in the 2025/26 Ligue 1 season? :: 4
How many goals did Esteban Lepaul score in the 2025/26 Ligue 1 season? :: 21
Who won the 2025/26 Serie A Coach of the Season award? :: Cesc Fabregas
How many hat-tricks were scored in the 2025/26 Bundesliga season? :: 11
Who finished as the top goalscorer of the 2025/26 LALIGA EA Sports season? :: Kylian Mbappe
Which of these players scored a hat-trick in the 2025/26 Premier League season? :: Kevin Schade / Joao Pedro / Morgan Gibbs-White
Who won the 2025/26 LALIGA EA Sports Goal of the Season award? :: Arda Guler
Against which team did Raphinha score a hat-trick? :: Sevilla FC
How many clean sheets did Marco Carnesecchi keep in the 2025/26 Serie A season? :: 13
How many goals did Nikola Krstovic score in the 2025/26 Serie A season? :: 10
Which of these teams qualified for the 2026/27 UEFA Europa League? :: Juventus / Crystal Palace / Bayer 04 Leverkusen / TSG Hoffenheim / RC Celta / AFC Bournemouth / Stade Rennais FC / Sunderland
Which player scored for or more goals in a single match during the 2025/26 Ligue 1 season? :: Mason Greenwood
Who won the 2025/26 Ligue 1 Young Player of the Season award? :: Desire Doue
How many clean sheets did Emil Audero keep in the 2025/26 Serie A season? :: 11
How many clean sheets did Mile Svilar keep in the 2025/26 Serie A season? :: 18
How many goals did Corentin Tolisso score in the 2025/26 Ligue 1 season? :: 11
What was the longest unbeaten run in the 2025/26 Ligue 1 season? :: 13
Who won the 2025/26 Serie A Most Valuable Player award? :: Federico Dimarco
How many clean sheets did Wladimiro Falcone keep in the 2025/26 Serie A season? :: 10
How many goals did Igor Thiago score in the 2025/26 Premier League season? :: 22
Which team had the longest unbeaten run in the 2025/26 Premier League season? :: AFC Bournemouth
Which team had the longest unbeaten run in the 2025/26 Ligue 1 season? :: LOSC Lille
Against which team did Eberechi Eze score a hat-trick? :: Tottenham Hotspur
Who won the 2025/26 Ligue 1 Manager of the Season award? :: Pierre Sage
Against which team did Cole Palmer score a hat-trick? :: Wolverhampton Wanderers
Which of these teams qualified for the 2026/27 UEFA Conference League? :: Getafe CF / Brighton & Hove Albion / Sport-Club Freiburg / AS Monaco
Which team won the 2025/26 Ligue 1 title? :: Paris Saint-Germain
Which team won the 2025/26 Premier League title? :: Arsenal
Which team won the 2025/26 Serie A title? :: Inter Milan
Which team won the 2025/26 Bundesliga title? :: FC Bayern Munchen
Which team won the 2025/26 LALIGA EA Sports title? :: FC Barcelona
Which Paris Saint-Germain player scored a hat-trick in the 2025/26 Ligue 1 season? :: Joao Neves
How many goals did Odsonne Edouard score in the 2025/26 Ligue 1 season? :: 12
Which team won the 2025/26 Scottish Premiership title? :: Celtic
How many goals did Dominic Calvert-Lewin score in the 2025/26 season? :: 14
How many clean sheets did Dean Henderson keep in the 2025/26 Premier League season? :: 11
How many goals did Erling Haaland score in the 2025/26 Premier League season? :: 27
How many goals did Kylian Mbappe score in the 2025/26 LALIGA EA Sports season? :: 25
Who won the 2025/26 Premier League Playmaker of the Season award? :: Bruno Fernandes
How many goals did Giovanni Simeone score in the 2025/26 Serie A season? :: 11
Which team had the longest winning run in the 2025/26 Bundesliga season? :: FC Bayern Munchen
Which team won the 2025/26 ROSHN Saudi League title? :: Al Nassr
Who scored the first goal of the 2025/26 LALIGA EA Sports season? :: De Frutos
How many goals did Donyell Malen score in the 2025/26 Serie A season? :: 14
How many goals did Ansu Fati score in the 2025/26 Ligue 1 season? :: 11
Who won the 2025/26 Ligue 1 Goal of the Season award? :: Ousmane Dembele
How many goals did Vedat Muriqi score in the 2025/26 LALIGA EA Sports season? :: 23
What was the longest unbeaten run in the 2025/26 LALIGA EA Sports season? :: 13
Against which team did Robert Lewandowski score a hat-trick? :: RC Celta
How many goals did Rasmus Hojlund score in the 2025/26 Serie A season? :: 12
What was the longest unbeaten run in the 2025/26 Serie A season? :: 24
How many goals did Mason Greenwood score in the 2025/26 Ligue 1 season? :: 16
How many goals did Deniz Undav score in the 2025/26 Bundesliga season? :: 19
Who won the 2025/26 LALIGA EA Sports Save of the Season award? :: Joan Garcia
Who finished as the top goalscorer of the 2025/26 Premier League season? :: Erling Haaland
Who won the 2025/26 Bundesliga Goal of the Season award? :: Ragnar Ache
How many goals did Lamine Yamal score in the 2025/26 LALIGA EA Sports season? :: 16
Which team had the longest unbeaten run in the 2025/26 LALIGA EA Sports season? :: Atletico de Madrid
How many hat-tricks were scored in the 2025/26 LALIGA EA Sports season? :: 8
How many goals did Joaquin Panichelli score in the 2025/26 Ligue 1 season? :: 16
How many goals did Tasos Douvikas score in the 2025/26 Serie A season? :: 14
How many goals did Joao Pedro score in the 2025/26 Premier League season? :: 15
How many clean sheets did Robin Risser keep in the 2025/26 Ligue 1 season? :: 11
How many goals did Bradley Barcola score in the 2025/26 season? :: 11
How many clean sheets did Yann Sommer keep in the 2025/26 Serie A season? :: 15
What was the longest winning run in the 2025/26 Serie A season? :: 8
Who won the 2025/26 Premier League Goal of the Season award? :: Harrison Reed
Who won the 2025/26 Premier League Manager of the Season award? :: Mikel Arteta
How many different FC Bayern Munchen players scored a hat-trick in the 2025/26 Bundesliga season? :: 2
Against which team did Igor Thiago score a hat-trick? :: Everton
How many goals did Scott McTominay score in the 2025/26 Serie A season? :: 10
How many goals did Lautaro Martinez score in the 2025/26 Serie A season? :: 17
How many clean sheets did Vanja Milinkovic-Savic keep in the 2025/26 Serie A season? :: 11
Who won the 2025/26 LALIGA EA Sports Coach of the Season award? :: Hansi Flick
How many goals did Haris Tabakovic score in the 2025/26 Bundesliga season? :: 13
Which goalkeeper was awarded the Zamora Trophy for the 2025/26 LALIGA EA Sports season? :: Joan Garcia
Who won the 2025/26 Premier League Young Player of the Season award? :: Nico O’Reilly
Against which team did Lamine Yamal score a hat-trick? :: Villarreal CF
How many goals did Robert Lewandowski score in the 2025/26 LALIGA EA Sports season? :: 14
Which team had the longest winning run in the 2025/26 Premier League season? :: Aston Villa
Which of these players scored more goals in the 2025/26 LALIGA EA Sports season? :: Vedat Muriqi
How many hat-tricks were scored in the 2025/26 Premier League season? :: 7
How many goals did Said El Mala score in the 2025/26 Bundesliga season? :: 13
How many goals did Ferran Torres score in the 2025/26 LALIGA EA Sports season? :: 16
How many goals did Harry Kane score in the 2025/26 Bundesliga season? :: 36
How many clean sheets did Mike Maignan keep in the 2025/26 Serie A season? :: 14
Which of these players scored a hat-trick in the 2025/26 Bundesliga season? :: Oliver Burke / Dzenan Pejcinovic / Yan Diomande / Andrej Kramaric / Patrik Schick / Deniz Undav
What was the longest winning run in the 2025/26 Premier League season? :: 8
How many goals did Folarin Balogun score in the 2025/26 Ligue 1 season? :: 13
How many goals did Florian Thauvin score in the 2025/26 Ligue 1 season? :: 11
Who won the 2025/26 Serie A Goal of the Season award? :: Francisco Conceicao
How many goals did Oyarzabal score in the 2025/26 LALIGA EA Sports season? :: 15
How many goals did Danny Welbeck score in the 2025/26 Premier League season? :: 13
How many goals did Keinan Davis score in the 2025/26 Serie A season? :: 10
Which player scored four or more goals in a single match during the 2025/26 Ligue 1 season? :: Mason Greenwood
How many goals did Jonathan Burkardt score in the 2025/26 Bundesliga season? :: 13
How many goals did Federico Bonazzoli score in the 2025/26 Serie A season? :: 10
How many clean sheets did Alexander Nubel keep in the 2025/26 Bundesliga season? :: 11
Who won the 2025/26 Bundesliga Player of the Season award? :: Michael Olise
Who finished as the top goalscorer of the 2025/26 Bundesliga season? :: Harry Kane
Who won the 2025/26 Serie A Rising Star award? :: Nico Paz
How many goals did Kenan Yildiz score in the 2025/26 Serie A season? :: 10
How many goals did Pavel Sulc score in the 2025/26 Ligue 1 season? :: 11
Who finished as the top goalscorer of the 2025/26 Serie A season? :: Lautaro Martinez
How many goals did Michael Olise score in the 2025/26 Bundesliga season? :: 15
How many clean sheets did Matvey Safonov keep in the 2025/26 Ligue 1 season? :: 8
How many goals did Vini Jr. score in the 2025/26 LALIGA EA Sports season? :: 16
How many clean sheets did Michele Di Gregorio keep in the 2025/26 Serie A season? :: 14
How many clean sheets did De Gea keep in the 2025/26 Serie A season? :: 10
How many goals did Nico Paz score in the 2025/26 Serie A season? :: 12
Which of these players scored a hat-trick in the 2025/26 Serie A season? :: Donyell Malen
How many goals did Andrej Kramaric score in the 2025/26 Bundesliga season? :: 14
Who won the 2025/26 LALIGA EA Sports Player of the Season award? :: Lamine Yamal
Who won the 2025/26 Bundesliga Rookie of the Season award? :: Yan Diomande
How many clean sheets did Maduka Okoye keep in the 2025/26 Serie A season? :: 10
Who scored the last goal of the 2025/26 Ligue 1 season? :: Alimami Gory
How many hat-tricks did Harry Kane score in the 2025/26 Bundesliga season? :: 4
How many goals did Riccardo Orsolini score in the 2025/26 Serie A season? :: 10
How many goals did Lassine Sinayoko score in the 2025/26 Ligue 1 season? :: 12
How many goals did Gianluca Scamacca score in the 2025/26 Serie A season? :: 10
How many clean sheets did David Raya keep in the 2025/26 Premier League season? :: 19
How many clean sheets did Gianluigi Donnarumma keep in the 2025/26 Premier League season? :: 15
Who won the 2025/26 Ligue 1 Goalkeeper of the Season award? :: Robin Risser
Which team won the 2025/26 Eredivisie title? :: PSV
How many goals did Borja Iglesias score in the 2025/26 LALIGA EA Sports season? :: 14
How many goals did Antoine Semenyo score in the 2025/26 Premier League season? :: 17
Which goalkeeper kept the most clean sheets in the 2025/26 Premier League season? :: David Raya
How many goals did Morgan Gibbs-White score in the 2025/26 Premier League season? :: 15
Against which team did Ferran Torres score a hat-trick? :: Real Betis
Which team had the longest winning run in the 2025/26 Ligue 1 season? :: RC Lens
How many goals did Patrik Schick score in the 2025/26 Bundesliga season? :: 16
Which goalkeeper kept the most clean sheets in the 2025/26 Bundesliga season? :: Gregor Kobel
How many goals did Christoph Baumgartner score in the 2025/26 Bundesliga season? :: 13
Which goalkeeper kept the most clean sheets in the 2025/26 Ligue 1 season? :: Berke Ozer
What was the longest unbeaten run in the 2025/26 Bundesliga season? :: 18
Which goalkeeper kept the most clean sheets in the 2025/26 Serie A season? :: Jean Butez
How many goals did Ollie Watkins score in the 2025/26 Premier League season? :: 16
How many clean sheets did Moritz Nicolas keep in the 2025/26 Bundesliga season? :: 13
Who scored the last goal of the 2025/26 LALIGA EA Sports season? :: Ayoze Perez
How many clean sheets did Mike Penders keep in the 2025/26 Ligue 1 season? :: 8
What was the longest winning run in the 2025/26 LALIGA EA Sports season? :: 11
Which team won the 2025/26 Super Lig title? :: Galatasaray SK
Which Serie A club signed Trevoh Chalobah ahead of the 26/27 season? :: Como 1907
Which Premier League team signed Sandro Tonali ahead of the 26/27 season? :: Tottenham Hotspur
Which LALIGA EA SPORTS team signed Couhaib Driouech ahead of the 26/27 season? :: RC Celta
Which Bundesliga team signed Rocco Reitz ahead of the 26/27 season? :: RB Leipzig
Which Premier League team signed Luka Vuskovic ahead of the 26/27 season? :: Brighton & Hove Albion
Which Ligue 1 team signed Karim Coulibaly ahead of the 26/27 season? :: RC Strasbourg Alsace
Which Bundesliga team signed Neil El Aynaoui ahead of the 26/27 season? :: RB Leipzig
Which LALIGA EA SPORTS team signed Fran Garcia ahead of the 26/27 season? :: Real Betis
Which Premier League team signed Johan Manzambi ahead of the 26/27 season? :: Aston Villa
Which Premier League team signed Jan Paul van Hecke ahead of the 26/27 season? :: Tottenham Hotspur
How many goals did Luis Diaz score in the 2025/26 Bundesliga season? :: 15
Which Serie A team signed Christ Ravynel ahead of the 26/27 season? :: Fiorentina
Which Bundesliga team signed Patrick Wimmer ahead of the 26/27 season? :: TSG Hoffenheim
Which LALIGA EA SPORTS team signed Agirrezabala ahead of the 26/27 season? :: Real Racing Club
Which Bundesliga team signed Zakaria El Ouahdi ahead of the 26/27 season? :: Hamburger SV
Which Bundesliga team signed Miguel Gutierrez ahead of the 26/27 season? :: Bayer 04 Leverkusen
Which team signed Iliman Ndiaye ahead of the 26/27 season? :: Manchester City
Which Premier League team signed Marco Palestra ahead of the 26/27 season? :: Chelsea
Which LALIGA EA SPORTS team signed Facundo Bernal ahead of the 26/27 season? :: Real Betis
Which Serie A team signed Rodrigo Mora ahead of the 26/27 season? :: AS Roma
Which LALIGA EA SPORTS team signed Leo Roman ahead of the 26/27 season? :: RC Deportivo
Which LALIGA EA SPORTS team signed Bernardo Silva ahead of the 26/27 season? :: Real Madrid
Which Premier League team signed Marcos Senesi ahead of the 26/27 season? :: Tottenham Hotspur
Which Premier League team signed Morgan Rogers ahead of the 26/27 season? :: Chelsea
Which Premier League team signed Maxence Lacroix ahead of the 26/27 season? :: Chelsea
Which Premier League team signed Danny Welbeck ahead of the 26/27 season? :: Chelsea
Which Premier League team signed Andrew Robertson ahead of the 26/27 season? :: Tottenham Hotspur
Which Premier League team signed Mamadou Sangare ahead of the 26/27 season? :: Brentford
Which LALIGA EA SPORTS team signed Carlos Espi ahead of the 26/27 season? :: Real Madrid
Which Premier League team signed Aladji Bamba ahead of the 26/27 season? :: Newcastle United
Which Premier League team signed Lukas Hornicek ahead of the 26/27 season? :: Newcastle United
Which LALIGA EA SPORTS team signed Marc Cucurella ahead of the 26/27 season? :: Real Madrid
Which Serie A team signed Kerim Alajbegovic ahead of the 26/27 season? :: Juventus
Which Premier League team signed Tarik Muharemovic ahead of the 26/27 season? :: Leeds United
Which Serie A team signed Randal Kolo Muani ahead of the 26/27 season? :: Juventus
Which Premier League team signed Joao Gomes ahead of the 26/27 season? :: Aston Villa
Which Premier League team signed Valentin Barco ahead of the 26/27 season? :: Chelsea
Which LALIGA EA SPORTS team signed Morten Hjulmand ahead of the 2026/27 season? :: Atletico de Madrid
Which Super Lig team signed Lesley Ugochukwu ahead of the 2026/27 season? :: Galatasaray SK
Which Bundesliga team signed Ismael Saibari ahead of the 2026/27 season? :: FC Bayern Munchen
Which Serie A team signed Nahuel Molina ahead of the 2026/27 season? :: AS Roma
Which LALIGA EA SPORTS team signed Peter Gulacsi ahead of the 2026/27 season? :: Villarreal CF
Which LALIGA EA SPORTS team signed Marc Cucurella ahead of the 2026/27 season? :: Real Madrid
Which Ukrainian Premier League team signed Bruninho ahead of the 2026/27 season? :: Shakhtar Donetsk
Which Premier League team signed Elliot Anderson ahead of the 2026/27 season? :: Manchester City
Which Ligue 1 team signed Tanguy Nianzou ahead of the 2026/27 season? :: LOSC Lille
Which Liga Portugal team signed Altimira ahead of the 2026/27 season? :: Sporting CP
Which Ligue 1 team signed Ferran Torres ahead of the 2026/27 season? :: Paris Saint-Germain
Which Eredivisie team signed Charles Vanhoutte ahead of the 2026/27 season? :: Feyenoord
Which Ligue 1 team signed Mika Godts ahead of the 2026/27 season? :: Paris Saint-Germain
Which Serie A team signed Luis Milla ahead of the 2026/27 season? :: Como 1907
Which Bundesliga team signed Dzenan Pejcinovic ahead of the 2026/27 season? :: VfB Stuttgart
Which Ligue 1 team signed Maghnes Akliouche ahead of the 2026/27 season? :: Paris Saint-Germain
Which Liga Portugal team signed Issa Doumbia ahead of the 2026/27 season? :: Sporting CP
Which LALIGA EA SPORTS team signed Yan Diomande ahead of the 2026/27 season? :: Real Madrid
Which Belgian Pro League team signed Freddie Potts ahead of the 2026/27 season? :: Club Brugge
Which LALIGA EA SPORTS team signed Grimaldo ahead of the 2026/27 season? :: Atletico de Madrid
Which Liga Portugal team signed Andre Silva ahead of the 2026/27 season? :: FC Porto
Which Eredivisie team signed Filip Kostic ahead of the 2026/27 season? :: PSV
Which LALIGA EA SPORTS team signed Cristian Romero ahead of the 2026/27 season? :: Atletico de Madrid
Which Liga Portugal team signed Jakub Kiwior ahead of the 2026/27 season? :: FC Porto
Which Ligue 1 team signed Lucas Digne ahead of the 2026/27 season? :: Paris Saint-Germain
Which LALIGA EA SPORTS team signed Lee Kang In ahead of the 2026/27 season? :: Atletico de Madrid
Which LALIGA EA SPORTS team signed Carlos Espi ahead of the 2026/27 season? :: Real Madrid
Which Ukrainian Premier League team signed Oleksandr Karavaev ahead of the 2026/27 season? :: Shakhtar Donetsk
Which LALIGA EA SPORTS team signed Ibrahima Konate ahead of the 2026/27 season? :: Real Madrid
Which Bundesliga team signed Bilal El Khannouss ahead of the 2026/27 season? :: VfB Stuttgart
Which Premier League team signed Victor Munoz ahead of the 2026/27 season? :: Liverpool
Which Premier League team signed Joao Gomes ahead of the 2026/27 season? :: Aston Villa
Which Ligue 1 team signed Basar Onal ahead of the 2026/27 season? :: LOSC Lille
Which Serie A team signed Vanja Milinkovic-Savic ahead of the 2026/27 season? :: SSC Napoli
Which LALIGA EA SPORTS team signed Denzel Dumfries ahead of the 2026/27 season? :: Real Madrid
Which Belgian Pro League team signed Jan Virgili ahead of the 2026/27 season? :: Club Brugge
Which Eredivisie team signed Nacho Ferri ahead of the 2026/27 season? :: Feyenoord
Which Premier League team signed Geronimo Rulli ahead of the 2026/27 season? :: Manchester City
Which Eredivisie team signed Kodai Sano ahead of the 2026/27 season? :: PSV
Which Liga Portugal team signed Rodrigo Zalazar ahead of the 2026/27 season? :: Sporting CP
Which Serie A team signed Santiago Castro ahead of the 2026/27 season? :: AS Roma
Which Ligue 1 team signed Jacobo Ortega ahead of the 2026/27 season? :: RC Strasbourg Alsace
Which Premier League team signed Nicolas Jackson ahead of the 2026/27 season? :: Aston Villa
Which LALIGA EA SPORTS team signed Nathan-Dylan Saliba ahead of the 2026/27 season? :: Villarreal CF
Which Premier League team signed James Trafford ahead of the 2026/27 season? :: Leeds United
Which Ligue 1 team signed Timothy Weah ahead of the 2026/27 season? :: Olympique de Marseille
How many goals did Serhou Guirassy score in the 2025/26 Bundesliga season? :: 17
Which Bundesliga team signed Kennet Eichhorn ahead of the 2026/27 season? :: Bayer 04 Leverkusen
Which Serie A team signed Konstantinos Koulierakis ahead of the 2026/27 season? :: AS Roma
Which LALIGA EA SPORTS team signed Mario Martin ahead of the 2026/27 season? :: Getafe CF
Which Ligue 1 team signed Deivid Washington ahead of the 2026/27 season? :: RC Strasbourg Alsace
Which Bundesliga team signed Afonso Moreira ahead of the 2026/27 season? :: Bayer 04 Leverkusen
Which Ligue 1 team signed Luca Warrick Koleosho ahead of the 2026/27 season? :: Paris FC
Which Serie A team signed Robert Sanchez ahead of the 2026/27 season? :: Como 1907
Which Bundesliga team signed Moussa Diaby ahead of the 2026/27 season? :: Bayer 04 Leverkusen
Which Serie A team signed Rasmus Hojlund ahead of the 2026/27 season? :: SSC Napoli
Which Serie A team signed Samuele Ricci ahead of the 2026/27 season? :: Como 1907
Which Ligue 1 team signed Matthis Abline ahead of the 2026/27 season? :: AS Monaco
Which Bundesliga team signed Nathaniel Brown ahead of the 2026/27 season? :: FC Bayern Munchen
Which LALIGA EA SPORTS team signed Hector Fort ahead of the 2026/27 season? :: Real Sociedad
Which Ligue 1 team signed Pablo Pagis ahead of the 2026/27 season? :: Paris FC
Which Bundesliga team signed Facundo Medina ahead of the 2026/27 season? :: Bayer 04 Leverkusen
Which Serie A team signed Moise Kean ahead of the 2026/27 season? :: Como 1907
Which Premier League team signed Liam Delap ahead of the 2026/27 season? :: Nottingham Forest
Which Ligue 1 team signed Ansu Fati ahead of the 2026/27 season? :: AS Monaco
Which Premier League team signed Ayyoub Bouaddi ahead of the 2026/27 season? :: Manchester City
Which Premier League team signed Ibrahim Mbaye ahead of the 2026/27 season? :: Aston Villa
Which Ligue 1 team signed Julien Duranville ahead of the 2026/27 season? :: Olympique Lyonnais
`;

// Entries on SportsDunia's Day-2 Challenge list that FIFAMobileGuide lacks.
// Kept separate so it is obvious where each line came from.
export const SEASON_RECAP_RAW_SUPPLEMENT = `
Which Serie A team signed Jhon Lucumí ahead of the 2026/27 season? :: Juventus
Which LALIGA EA SPORTS team signed Troy Parrott ahead of the 2026/27 season? :: Real Betis
Which Bundesliga team signed Guela Doue ahead of the 2026/27 season? :: Bayer 04 Leverkusen
Which Ligue 1 team signed Lassina Sinayoko ahead of the 2026/27 season? :: Paris FC
Which Serie A team signed Donyell Malen ahead of the 2026/27 season? :: AS Roma
Which Premier League team signed Bradley Barcola ahead of the 2026/27 season? :: Liverpool
Which Serie A team signed Nick Woltemade ahead of the 2026/27 season? :: Juventus
Which of these players scored a hat-trick in the 2025/26 Premier League season? :: Jean-Philippe Mateta
`;

export const SEASON_RECAP_QUESTIONS = buildExtraTimeQuestions(
  [SEASON_RECAP_RAW, SEASON_RECAP_RAW_SUPPLEMENT],
  { prefix: 'sr' }
);

export const SEASON_RECAP_QUESTION_COUNT = SEASON_RECAP_QUESTIONS.length;
