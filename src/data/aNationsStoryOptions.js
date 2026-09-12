// Official-style A-D options transcribed from the published FIFAMobileGuide question sets.
// Order matches NATIONS_STORY day/question order. Keep this separate so the answer database
// remains easy to maintain while the UI can show the complete choices.

const sets = {
  japan: [
    [['2','3','4','5'],['1994','1998','2002','2006'],['Saudi Arabia','South Korea','Iran','China']],
    [['Poland','Colombia','Senegal','Belgium'],['Hiroshi Nanami','Shunsuke Nakamura','Keisuke Honda','Shinji Kagawa'],['Russia','Tunisia','Belgium','Turkey']],
    [['Shinji Okazaki','Tadanari Lee','Keisuke Honda','Makoto Hasebe'],['Shinji Kagawa','Keisuke Honda','Yasuhito Endo','Yuto Nagamoto'],['Alberto Zaccheroni','Takeshi Okada','Ivica Osim','Philippe Troussier']],
    [['Kaoru Mitoma','Ritsu Doan','Takuma Asano','Daichi Kamada'],['South Korea','Qatar','Iran','Saudi Arabia'],['Hidetoshi Nakata','Takayuki Suzuki','Junichi Inamoto','Shinji Ono'],['Keisuke Honda','Shinji Okazaki','Ryoichi Maeda','Yuto Nagamoto']],
    [['Takashi Inui','Genki Haraguchi','Keisuke Honda','Yuya Osako'],['1988','1992','1996','2000'],['Spain','Germany','Costa Rica','Morocco'],['Kazuyoshi Miura','Takuya Takagi','Hidetoshi Nakata','Masashi Nakayama']],
    [['Shinji Kagawa','Keisuke Honda','Daisuke Matsui','Makoto Hasebe'],['Iran','Saudi Arabia','China','South Korea'],['Turkey','Mexico','Paraguay','United States'],['Akira Nishino','Hajime Moriyasu','Alberto Zaccheroni','Takeshi Okada']],
    [['Takumi Minamino','Ritsu Doan','Yuya Osako','Gaku Shibasaki'],['Ao Tanaka','Junya Ito','Kaoru Mitoma','Takuma Asano'],['Makoto Hasebe','Yasuhito Endo','Yuto Nagatomo','Keisuke Honda'],['Japan','Qatar','China','Australia'],['Seigo Narazaki','Yoshikatsu Kawaguchi','Eiji Kawashima','Shusaku Nishikawa']],
    [['Phillippe Troussier','Takeshi Okada','Alberto Zaccheroni','Ivica Osim'],['Kazuyoshi Miura','Keisuke Honda','Hidetoshi Nakata','Shinji Kagawa'],['1-0 Paraguay','0-0 Japan lost on penalties','2-1 Japan','2-0 Paraguay'],['Keiji Tamada','Takashi Fukunishi','Shunsuke Nakamura','Yuji Nakazawa'],['Ritsu Doan and Takuma Asano','Kaoru Mitoma and Takumi Minamino','Ao Tanaka and Takefusa Kubo','Maya Yoshida and Daichi Kamada']],
    [['Masashi Nakayama','Hidetoshi Nakata','Shoji Jo','Tatsuhiko Kubo'],['Keisuke Honda','Yuto Nagatomo','Makoto Hasebe','Maya Yoshida'],['Keisuke Honda and Yasuhito Endo','Shinji Kagawa and Makoto Hasebe','Ritsu Doan and Takumi Minamino','Shinji Okazaki and Yuto Nagatomo'],['2001','1999','2007','2011'],['Hajime Moriyasu','Vahid Halilhodzic','Akira Nishino','Takeshi Okada']]
  ],
  netherlands: [
    [['Munich','Gelsenkirchen','Hamburg','Hannover']],
    [['Ruud Gullit','Frank Rijkaard','Ronald Koeman','Marco van Basten']],
    [['Round of 16','Quarter Final','Semi Final','Final']],
    [['vs. Italy','vs. Germany','vs. Spain','vs. Portugal']],
    [['Memphis Depay','Steven Berghuis','Cody Gakpo','Wout Weghorst']],
    [['Australia','Brazil','Spain','Chile']],
    [['Xavi Simmons','Memphis Depay','Jeremie Frimpong','Nathan Ake']],
    [['Denzel Dumfries','Stefan de Vrij','Steven Berghuis','Frenkie de Jong']],
    [['Cody Gakpo','Donyell Malen','Memphis Depay','Virgil van Dijk']]
  ],
  mexico: [
    [['1930','1934','1950','1954'],['Guillermo Ochoa','Jorge Campos','Antonio Carbajal','Oswaldo Sanchez'],['Round of 16','Quarter-finals','Semi-finals','Final']],
    [['Hugo Sanchez','Manuel Negrete','Tomas Boy','Luis Flores'],['They were eliminated in the Group Stage every time.','They reached the Quarter-finals every time.','They were eliminated in the round of 16 seven consecutive times','They failed to qualify for the FIFA World Cup'],['Brazil','Germany','South Korea','Sweden']],
    [['Wesley Sneijder','Robin van Persie','Arjen Robben','Dirk Kuyt'],['Italy','USA','South Korea','Portugal'],['Germany','France','Brazil','USA']],
    [['La Albiceleste','La Roja','El Tri','Los Cafeteros'],['Giovani dos Santos','Javier “Chicharito” Hernández','Oribe Peralta','Carlos Vela'],['Canada','South Africa','Portugal','Norway'],['Juan Carlos Osorio','Miguel Herrera','Javier Aguirre','Ricardo La Volpe']],
    [['Belgium','South Korea','Netherlands','France'],['Estadio Akron','Estadio BBVA','Estadio Azteca','Estadio Olimpico Universitario'],['1950 vs Yugoslavia','1954 vs France','1962 vs Czechoslovakia','1966 vs Uruguay'],['Oscar Perez','Jorge Campos','Oswaldo Sanchez','Adolfo Rios']],
    [['Great Britain','Spain','Brazil','Japan'],['1','2','3','0'],['Marcelo Bielsa','Gerardo Martino','Ricardo La Volpe','Jose Pekerman'],['Jared Borgetti','Cuauhtemoc Blanco','Gerardo Torrado','Jesus Arellano']],
    [['He scored a goal','He saved a penalty from Robert Lewandowski','He got a red card','He played as a midfielder'],['Luis Hernandez','Cuauhtemoc Blanco','Ramon Ramirez','Alberto Garcia Aspe'],['0','1','3','4'],['3','4','5','6'],['7','9','6','10']],
    [['Lionel Messi','Hernan Crespo','Maxi Rodriguez','Juan Riquelme'],['Juan Carreno','Hilario Lopez','Dionisio Mejia','Manuel Rosas'],['A draw','A win by a large goal difference','A 1-0 win','Any win'],['Hirving Lozano','Edson Alvarez','Luis Chavez','Alexis Vega'],['Hungary','Wales','Sweden','USSR']],
    [['Hugo Sanchez','Luis Garcia','Zague','Carlos Hermosillo'],['They reached the Quarter-finals','They failed to advance past the Group Stage','They won all three group games','They finished last in their group'],['Germany','Brazil','South Africa','Russia'],['Carlos Salcido','Rafael Marquez','Ricardo Osorio','Hector Moreno'],['USA and Guatemala','USA and Canada','Canada and Brazil','USA and Costa Rica']]
  ],
  france: [
    [['1998','1982','2006','2018'],['Zinedine Zidane','Didier Deschamps','Thierry Henry','Laurent Blanc'],['David Trezeguet','Thierry Henry','Youri Djorkaeff','None']],
    [['Germany','Argentina','Croatia','Brazil'],['Just Fontaine','Raymond Kopa','Michael Platini','Jean Vincent'],['Marseille','Lyon','Paris','Bordeaux']],
    [['1','2','3','4'],['Zidane','Henry','Dugarry','Deschamps'],['Les Lions','Les Bleus','La Roja','Les Coqs']],
    [['Marseille','PSG','Lyon','Metz'],['Stade de France','Parc des Princes','Stade Geoffroy-Guichard','Stade Velodrome'],['Thierry Henry','Zinedine Zidane','Patrick Vieira','David Trezeguet'],['Laurent Blanc','Didier Deschamps','Raymond Domenech','Aime Jacquet']],
    [['Portugal','Italy','Spain','Germany'],['1','2','3','4'],['Henry','Zidane','Trezeguet','Blanc'],['World Cup','UEFA EURO','UEFA Nations League','Copa America']],
    [['Karim Benzema','Kylian Mbappe','Olivier Giroud','Antoine Griezmann'],['Griezmann','Mbappe','Giroud','Pogba'],['Fabien Barthez','Hugo Lloris','Steve Mandanda','Alphonse Areola'],['Head coach of the France U21 and youth teams','Head coach of France national football team','Assistant coach of France national football team','Technical director of UEFA']],
    [['1974','1980','1984','1988'],['Zidane','Wiltord','Trezeguet','Henry'],['Michel Platini','Roger Lemerre','Aime Jacquet','Gerard Houllier'],['Senegal','Norway','South Africa','South Korea'],['Pavard','Giroud','Mbappe','Griezmann']],
    [['1','2','3','4'],['1986','1998','2002','2010'],['7','10','9','11'],['Antoine Griezmann','Olivier Giroud','Paul Pogba','Dimitri Payet'],['Paris','Moscow','Berlin','Rome']],
    [['Brazil','Netherlands','Italy','Croatia'],['Barthez','Desailly','Thuram','Lloris'],['Mbappe, Griezmann, Pogba, Mandzukic (own goal)','Giroud, Pogba, Sidibe','Mbappe, Kante, Pavard','Griezmann, Matuidi, Fekir'],['Papin','Cantona','Deschamps','Blanc'],['Zidane','Henry','Blanc','Trezeguet']]
  ],
  brazil: [
    [['Italy','Sweden','Mexico','Chile']],
    [['Pelé','Zico','Garrincha','Ronaldo']],
    [['3','4','5','6']],
    [['Romario','Dunga','Bebeto','Rai']],
    [['Sócrates','Zico','Cafu','Kaka']],
    [['Rivaldo','Ronaldinho','Ronaldo','Gilberto Silva']],
    [['2008 Beijing','2012 London','2016 Rio de Janeiro','2020 Tokyo']],
    [['Argentina','Chile','Brazil','Colombia']],
    [['7','9','11','5']]
  ]
};

export function getQuestionOptions(country, dayId, questionIndex) {
  return sets[country]?.[Number(dayId.replace('day-', '')) - 1]?.[questionIndex] || [];
}
