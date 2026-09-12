// A Nation's Story answer database.
// Source research: FIFAMobileGuide and Mr. Believer Hub. Verify question/answer updates before changing published data.
// Keep this dataset factual and answer-first. The UI is intentionally not a quiz-first experience.

const q = (question, answer, hint = '') => ({ question, answer, ...(hint ? { hint } : {}) });
const day = (id, title, questions, level = null) => ({ id, title, level, questions });

export const NATIONS_STORY = [
  {
    slug: 'japan', name: 'Japan', flag: '🇯🇵', part: 'Chronicles Part I',
    source: 'FIFAMobileGuide.com', sourceUrl: 'https://www.fifamobileguide.com/a-nations-story-japan',
    description: 'FC Mobile A Nation\'s Story Japan answers, covering the Beginner, Medium and Difficult trivia challenges.',
    days: [
      day('day-1','Beginner · Challenge I',[q('How many times has Japan won the AFC Asian Cup (as of 2025)?','4'),q('In which year did Japan make their first-ever FIFA World Cup appearance?','1998'),q('Japan hosted the 1992 AFC Asian Cup. Who did they defeat in the final?','Saudi Arabia')],'Beginner'),
      day('day-2','Beginner · Challenge II',[q('In the 2018 FIFA World Cup, Japan defeated which team in their opening match?','Colombia'),q('Which Japanese player was named MVP of the 2000 AFC Asian Cup?','Hiroshi Nanami'),q('During the 2002 FIFA World Cup, Japan achieved their first-ever FIFA World Cup win by beating which nation?','Russia')],'Beginner'),
      day('day-3','Beginner · Challenge III',[q('In the 2011 Asian Cup final, who scored Japan’s winning goal against Australia?','Tadanari Lee'),q('In the 2010 FIFA World Cup, Japan defeated Denmark to qualify for the Round of 16. Who scored a stunning free-kick in that match?','Keisuke Honda'),q('Which coach led the Japanese national team to the 2011 AFC Asian Cup title?','Alberto Zaccheroni')],'Beginner'),
      day('day-4','Medium · Challenge I',[q('In the 2022 FIFA World Cup, Japan came back to beat Germany 2-1. Who scored Japan’s first goal?','Ritsu Doan'),q('Japan reached the final of the 2019 AFC Asian Cup but lost to which team?','Qatar'),q('In the 2002 FIFA World Cup, who scored Japan’s goal in the 1-1 draw with Belgium?','Takayuki Suzuki'),q('Who was Japan’s top scorer at the 2011 AFC Asian Cup?','Keisuke Honda')],'Medium'),
      day('day-5','Medium · Challenge II',[q('Japan’s 2018 FIFA World Cup Round of 16 loss to Belgium ended 3-2. Who scored Japan’s second goal?','Takashi Inui'),q('Japan won their first AFC Asian Cup title in which year?','1992'),q('In the 2002 FIFA World Cup, which team did Japan defeat 2-1 to top their group?','Spain'),q('Which Japanese player scored the winning goal in the 1992 Asian Cup final?','Takuya Takagi')],'Medium'),
      day('day-6','Medium · Challenge III',[q('In the 2010 FIFA World Cup, who scored Japan’s only goal in the 1-0 win over Cameroon?','Keisuke Honda'),q('Japan defeated which country in the final to win the 2004 AFC Asian Cup?','China'),q('In the 2002 FIFA World Cup Round of 16, Japan lost to which team?','Turkey'),q('Who was Japan’s coach during the 2018 FIFA World Cup?','Akira Nishino')],'Medium'),
      day('day-7','Difficult · Challenge I',[q('Which Japanese player scored the winning penalty in a tense 1-0 quarterfinal victory over Vietnam at the 2019 AFC Asian Cup?','Ritsu Doan'),q('Which Japanese player scored against Spain in the 2022 FIFA World Cup?','Ao Tanaka'),q('Who was Japan’s captain at the 2010 FIFA World Cup?','Makoto Hasebe'),q('Japan’s 4th AFC Asian Cup title came in 2011. Where was the tournament held?','Qatar'),q('During the 2006 FIFA World Cup, Japan’s group stage match against Croatia ended scoreless. Who was Japan’s goalkeeper that saved a crucial penalty in that game?','Yoshikatsu Kawaguchi')],'Difficult'),
      day('day-8','Difficult · Challenge II',[q('Who was the manager when Japan reached the Round of 16 in the 2002 FIFA World Cup?','Phillippe Troussier'),q('Which Japanese player was nicknamed King Kazu?','Kazuyoshi Miura'),q('In the 2010 FIFA World Cup, Japan’s Round of 16 match against Paraguay ended how?','0-0 Japan lost on penalties'),q('Who scored the decisive goal for Japan in the 2004 AFC Asian Cup semifinal vs. Bahrain?','Keiji Tamada'),q('Which 2 players scored both goals for Japan in their 2-1 comeback win over Germany in the 2022 FIFA World Cup?','Ritsu Doan and Takuma Asano')],'Difficult'),
      day('day-9','Difficult · Challenge III',[q('In the 1998 FIFA World Cup, who scored Japan’s first-ever goal in the competition?','Masashi Nakayama'),q('Which Japanese player won the AFC Asian International Player of the Year award in 2013?','Yuto Nagatomo'),q('In the 2010 FIFA World Cup match against Denmark, Japan scored two stunning free-kick goals. Which two players were the scorers?','Keisuke Honda and Yasuhito Endo'),q('Japan made their first appearance in the Copa America as a guest team in which year?','1999'),q('Who was Japan’s manager at the 2022 FIFA World Cup?','Hajime Moriyasu')],'Difficult')
    ]
  },
  {
    slug: 'netherlands', name: 'Netherlands', flag: '🇳🇱', part: 'Chronicles Part I',
    source: 'FIFAMobileGuide.com', sourceUrl: 'https://www.fifamobileguide.com/a-nations-story-netherlands',
    description: 'FC Mobile A Nation\'s Story Netherlands answers for all nine Oranje Moments questions.',
    days: [
      day('day-1','Oranje Moment I',[q('In which city did Johan Cruyff score his goal against Argentina in the 1974 FIFA World Cup?','Gelsenkirchen')]),
      day('day-2','Oranje Moment II',[q('Who scored the famous winning goal for the Netherlands in the UEFA EURO 1988 final?','Marco van Basten')]),
      day('day-3','Oranje Moment III',[q('In which stage of the 1998 FIFA World Cup did Dennis Bergkamp score his famous goal against Argentina?','Quarter Final')]),
      day('day-4','Oranje Moment IV',[q('Which team did Wesley Sneijder score against in the UEFA EURO 2008?','Italy')]),
      day('day-5','Oranje Moment V',[q('Who scored for the Netherlands in their quarter-final match versus Argentina at the 2022 FIFA World Cup?','Wout Weghorst')]),
      day('day-6','Oranje Moment VI',[q('Against which team did Robin van Persie score his famous Flying Dutchman header in the 2014 FIFA World Cup?','Spain')]),
      day('day-7','Oranje Moment VII',[q('Who scored the Netherlands’ goal in the UEFA EURO 2024 semi-final against England?','Xavi Simons')]),
      day('day-8','Oranje Moment VIII',[q('Which player scored for Netherlands in the 3-2 win over Ukraine in the UEFA EURO 2020?','Denzel Dumfries')]),
      day('day-9','Oranje Moment IX',[q('Which player scored the first goal for Netherlands in their 3-0 win over Romania at EURO 2024?','Cody Gakpo')])
    ]
  },
  {
    slug: 'mexico', name: 'Mexico', flag: '🇲🇽', part: 'Chronicles Part II',
    source: 'FIFAMobileGuide.com', sourceUrl: 'https://www.fifamobileguide.com/a-nations-story-mexico',
    description: 'FC Mobile A Nation\'s Story Mexico answers across Beginner, Medium and Difficult challenges.',
    days: [
      day('day-1','Beginner · Challenge I',[q('In which year did Mexico play in the very first match of the first-ever FIFA World Cup?','1930'),q('Which legendary Mexican goalkeeper was the first player in history to appear in five FIFA World Cups?','Antonio Carbajal'),q('Mexico hosted the FIFA World Cup in 1970. Which stage did they reach?','Quarter-finals')],'Beginner'),
      day('day-2','Beginner · Challenge II',[q('Who scored the acrobatic scissor kick goal against Bulgaria in the 1986 FIFA World Cup, often voted the most beautiful goal in Mexico’s history?','Manuel Negrete'),q('Between 1994 and 2018, Mexico achieved a consistent but frustrating record. What was it?','They were eliminated in the Round of 16 seven consecutive times'),q('Who did Mexico defeat 1-0 in their opening game of the 2018 FIFA World Cup?','Germany')],'Beginner'),
      day('day-3','Beginner · Challenge III',[q('In the 2014 FIFA World Cup, Mexico was eliminated by the Netherlands after a controversial foul called on which player in stoppage time?','Arjen Robben'),q('Which team eliminated Mexico in the Round of 16 at the 2002 FIFA World Cup?','USA'),q('Mexico won the FIFA Confederations Cup in 1999. Who did they beat in the final?','Brazil')],'Beginner'),
      day('day-4','Medium · Challenge I',[q('What is the nickname of the Mexico National Team?','El Tri'),q('Which Mexican player scored in three consecutive FIFA World Cups (2010, 2014, 2018)?','Javier “Chicharito” Hernández'),q('Which team was in the same group with Mexico in the 2026 FIFA World Cup?','South Africa'),q('Who was the coach of Mexico during the 2014 FIFA World Cup known for his passionate sideline celebrations?','Miguel Herrera')],'Medium'),
      day('day-5','Medium · Challenge II',[q('In 1998, Luis Hernandez scored a dramatic stoppage-time equalizer to secure qualification to the next round against which team?','Netherlands'),q('Which stadium is the historic home of the Mexico National Team?','Estadio Azteca'),q('What was Mexico’s first-ever victory in a FIFA World Cup match?','1962 vs Czechoslovakia'),q('Which Mexican goalkeeper became famous for his colorful, self-designed jerseys in the 1994 and 1998 FIFA World Cups?','Jorge Campos')],'Medium'),
      day('day-6','Medium · Challenge III',[q('Mexico won the Olympic Gold Medal in football in 2012. Who did they defeat in the final?','Brazil'),q('How many times has Mexico hosted the FIFA World Cup prior to 2026?','2'),q('Which Argentine coach led Mexico during the 2006 FIFA World Cup?','Ricardo La Volpe'),q('Who scored a header goal against Italy in the 2002 FIFA World Cup group stage?','Jared Borgetti')],'Medium'),
      day('day-7','Difficult · Challenge I',[q('In the 2022 FIFA World Cup in Qatar, what did Guillermo Ochoa achieve in the match against Poland?','He saved a penalty from Robert Lewandowski'),q('Which player is known for the Cuauhtemina, a trick where he hopped with the ball between his ankles to evade defenders?','Cuauhtemoc Blanco'),q('How many points did Mexico score in the 1978 FIFA World Cup?','0'),q('Rafa Marquez shares the record for captaining a national team in the most FIFA World Cups. How many?','5'),q('As of 2025, how many times has Mexico won the CONCACAF Gold Cup?','10')],'Difficult'),
      day('day-8','Difficult · Challenge II',[q('In the 2006 FIFA World Cup Round of 16 match against Argentina, who scored the extra-time screamer that eliminated Mexico?','Maxi Rodriguez'),q('Who was the first Mexican player to score in a FIFA World Cup in 1930?','Juan Carreno'),q('In what scenario would Mexico have advanced from the group in 2022 after their last group match against Saudi Arabia?','A win by a large goal difference'),q('Who scored the incredible free-kick goal against Saudi Arabia in the 2022 FIFA World Cup?','Luis Chavez'),q('Against which team did Mexico secure their first-ever FIFA World Cup point, a draw, in 1958?','Wales')],'Difficult'),
      day('day-9','Difficult · Challenge III',[q('Which Real Madrid legend scored in the 1986 FIFA World Cup for Mexico?','Hugo Sanchez'),q('What happened to Mexico in the 2022 FIFA World Cup for the first time since 1978?','They failed to advance past the Group Stage'),q('In 2010, Mexico opened the FIFA World Cup against the host nation. Who was it?','South Africa'),q('Which Mexican defender played for Barcelona and won the Champions League twice?','Rafael Marquez'),q('Mexico will co-host the 2026 FIFA World Cup. Which two countries are they co-hosting with?','USA and Canada')],'Difficult')
    ]
  },
  {
    slug: 'france', name: 'France', flag: '🇫🇷', part: 'Chronicles Part III',
    source: 'FIFAMobileGuide.com', sourceUrl: 'https://www.fifamobileguide.com/a-nations-story-france',
    description: 'FC Mobile A Nation\'s Story France answers for all nine daily trivia challenges.',
    days: [
      day('day-1','Beginner · Challenge I',[q('In which year did France first win the World Cup?','1998'),q('Who was France’s captain during their 1998 World Cup triumph?','Didier Deschamps'),q('Which French striker won the Golden Boot at the 1998 World Cup?','None')],'Beginner'),
      day('day-2','Beginner · Challenge II',[q('Which team did France defeat in the 2018 World Cup final?','Croatia'),q('Who scored a hat-trick for France against Germany in the 1958 World Cup semi-final?','Just Fontaine'),q('Which city hosted the 1998 World Cup final?','Paris')],'Beginner'),
      day('day-3','Beginner · Challenge III',[q('How many times has France hosted the World Cup?','2'),q('Who scored twice for France in the 1998 World Cup final?','Zinedine Zidane'),q('What is the nickname of the France national football team?','Les Bleus')],'Beginner'),
      day('day-4','Medium · Challenge I',[q('Which French club did Didier Deschamps play for?','Marseille'),q('In which stadium did France defeat Portugal in the UEFA EURO 1984 semi-final?','Stade Velodrome'),q('Who scored France’s only goal in the 2006 World Cup final?','Zinedine Zidane'),q('Who was France’s coach during their 2018 World Cup victory?','Didier Deschamps')],'Medium'),
      day('day-5','Medium · Challenge II',[q('France lost to which country in the UEFA EURO 2016 final?','Portugal'),q('How many UEFA European Championships has France won as of 2024?','2'),q('Who scored the golden goal for France in the UEFA EURO 2000 final?','David Trezeguet'),q('France finished as runners-up in which major tournament in 2016?','UEFA EURO')],'Medium'),
      day('day-6','Medium · Challenge III',[q('Who scored a hat-trick for France in the 2022 World Cup final?','Kylian Mbappe'),q('Who scored a brace for France against Argentina in the 2018 World Cup?','Kylian Mbappe'),q('Who was France’s goalkeeper during their 2018 World Cup win?','Hugo Lloris'),q('What role has Thierry Henry taken on in recent years?','Head coach of the France U21 and youth teams')],'Medium'),
      day('day-7','Difficult · Challenge I',[q('In which year did Michel Platini score 9 goals in a single UEFA EURO Tournament?','1984'),q('Which player missed a penalty for France in the 2006 World Cup final shootout?','David Trezeguet'),q('Who managed France during their 1998 World Cup win?','Aime Jacquet'),q('France lost to which underdog in the 2002 World Cup group stage?','Senegal'),q('Who scored France’s winner in the 2018 World Cup Round of 16 against Argentina?','Kylian Mbappe')],'Difficult'),
      day('day-8','Difficult · Challenge II',[q('How many goals did France score in the 1998 World Cup final?','3'),q('In which year did France fail to progress from the group stage despite being defending champions?','2002'),q('What shirt number is most associated with Zinedine Zidane in the national team?','10'),q('Who scored the winning goal in France’s UEFA EURO 2016 semi-final against Germany?','Antoine Griezmann'),q('Where did France play the 2018 World Cup final?','Moscow')],'Difficult'),
      day('day-9','Difficult · Challenge III',[q('Who did France face in the 1998 World Cup semi-final?','Croatia'),q('Who is France’s record appearance maker?','Hugo Lloris'),q('Who scored for France in the 2018 World Cup final?','Mbappe, Griezmann, Pogba, Mandzukic (own goal)'),q('Which French player won the Ballon d’Or in 1991?','Jean-Pierre Papin'),q('Who scored the winning penalty for France in the 1998 World Cup quarter-final against Italy?','Laurent Blanc')],'Difficult')
    ]
  },
  {
    slug: 'brazil', name: 'Brazil', flag: '🇧🇷', part: 'Chronicles Part II',
    source: 'FIFAMobileGuide.com', sourceUrl: 'https://www.fifamobileguide.com/a-nations-story-brazil',
    description: 'FC Mobile A Nation\'s Story Brazil answers, one Samba Moment per day.',
    days: [
      day('day-1','Samba Moment I',[q('In which country did Brazil win its first FIFA World title?','Sweden')]),
      day('day-2','Samba Moment II',[q('Which Brazilian player is famously known as O Rei, The King?','Pelé')]),
      day('day-3','Samba Moment III',[q('How many times has Brazil won the World Cup, as of April 2026?','5')]),
      day('day-4','Samba Moment IV',[q('Who was Brazil’s captain when they won the 1994 World Cup?','Dunga')]),
      day('day-5','Samba Moment V',[q('Which player was nicknamed The Doctor because he earned a medical degree during his playing career?','Sócrates')]),
      day('day-6','Samba Moment VI',[q('Who scored a spectacular free kick against England in the 2002 World Cup?','Ronaldinho')]),
      day('day-7','Samba Moment VII',[q('In which Olympics did Brazil win their first football gold medal?','2016 Rio de Janeiro')]),
      day('day-8','Samba Moment VIII',[q('Which country hosted the 2019 Copa America, won by Brazil?','Brazil')]),
      day('day-9','Samba Moment IX',[q('How many Copa America tournaments has Brazil won as of 2024?','9')])
    ]
  }
];

export const NATIONS_STORY_BY_SLUG = Object.fromEntries(NATIONS_STORY.map((nation) => [nation.slug, nation]));
export const NATIONS_STORY_QUESTION_COUNT = NATIONS_STORY.reduce((total, nation) => total + nation.days.reduce((sum, d) => sum + d.questions.length, 0), 0);

export function getNation(slug) { return NATIONS_STORY_BY_SLUG[slug] || null; }
export function getDay(nation, daySlug) { return nation?.days.find((d) => d.id === daySlug) || null; }
export function searchNationQuestions(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];
  return NATIONS_STORY.flatMap((nation) => nation.days.flatMap((d) => d.questions.map((question, index) => ({ nation, day: d, question, index }))))
    .filter(({ nation, day, question }) => `${nation.name} ${day.title} ${question.question} ${question.answer} ${question.hint || ''}`.toLowerCase().includes(needle));
}
