// Trivia Player Finder starter dataset. Shirt numbers and positions are aligned to the current FC Mobile World Cup trivia-style squad reference and are intended for clue matching, not player-card OVR data.
export const triviaPlayers = [
  // France
  ['France','GK',1,'Brice Samba'],['France','GK',16,'Mike Maignan'],['France','DF',4,'Dayot Upamecano'],['France','DF',5,'Jules Koundé'],['France','DF',17,'William Saliba'],['France','MF',6,'Manu Koné'],['France','MF',8,'Aurélien Tchouaméni'],['France','MF',13,"N'Golo Kanté"],['France','FW',10,'Kylian Mbappé'],['France','FW',7,'Ousmane Dembélé'],['France','FW',11,'Michael Olise'],
  // England
  ['England','GK',1,'Jordan Pickford'],['England','DF',2,'Trent Alexander-Arnold'],['England','DF',5,'John Stones'],['England','DF',6,'Marc Guéhi'],['England','DF',3,'Luke Shaw'],['England','MF',4,'Declan Rice'],['England','MF',8,'Jude Bellingham'],['England','MF',10,'Conor Gallagher'],['England','FW',7,'Bukayo Saka'],['England','FW',9,'Harry Kane'],['England','FW',11,'Marcus Rashford'],
  // Germany
  ['Germany','GK',1,'Manuel Neuer'],['Germany','GK',12,'Oliver Baumann'],['Germany','DF',2,'Antonio Rüdiger'],['Germany','DF',4,'Jonathan Tah'],['Germany','DF',6,'Joshua Kimmich'],['Germany','MF',8,'Leon Goretzka'],['Germany','MF',10,'Jamal Musiala'],['Germany','MF',17,'Florian Wirtz'],['Germany','FW',7,'Kai Havertz'],['Germany','FW',11,'Nick Woltemade'],
  // Spain
  ['Spain','GK',1,'David Raya'],['Spain','GK',23,'Unai Simón'],['Spain','DF',3,'Álex Grimaldo'],['Spain','DF',4,'Eric García'],['Spain','DF',22,'Pau Cubarsí'],['Spain','MF',6,'Mikel Merino'],['Spain','MF',16,'Rodri'],['Spain','MF',20,'Pedri'],['Spain','FW',17,'Nico Williams'],['Spain','FW',19,'Lamine Yamal'],['Spain','FW',21,'Mikel Oyarzabal'],
  // Portugal
  ['Portugal','GK',1,'Diogo Costa'],['Portugal','GK',12,'José Sá'],['Portugal','DF',3,'Rúben Dias'],['Portugal','DF',5,'Diogo Dalot'],['Portugal','DF',20,'João Cancelo'],['Portugal','MF',8,'Bruno Fernandes'],['Portugal','MF',10,'Bernardo Silva'],['Portugal','MF',15,'João Neves'],['Portugal','FW',7,'Cristiano Ronaldo'],['Portugal','FW',17,'Rafael Leão'],
  // Mexico
  ['Mexico','GK',1,'Raúl Rangel'],['Mexico','GK',13,'Guillermo Ochoa'],['Mexico','DF',2,'Jorge Sánchez'],['Mexico','DF',4,'Edson Álvarez'],['Mexico','DF',5,'Johan Vásquez'],['Mexico','MF',6,'Érik Lira'],['Mexico','MF',8,'Álvaro Fidalgo'],['Mexico','MF',17,'Orbelín Pineda'],['Mexico','FW',9,'Raúl Jiménez'],['Mexico','FW',11,'Santiago Giménez'],['Mexico','FW',16,'Julián Quiñones'],
  // Belgium
  ['Belgium','GK',1,'Thibaut Courtois'],['Belgium','GK',12,'Senne Lammens'],['Belgium','DF',2,'Zeno Debast'],['Belgium','DF',5,'De Cuyper'],['Belgium','DF',21,'Timothy Castagne'],['Belgium','MF',6,'Axel Witsel'],['Belgium','MF',7,'Kevin De Bruyne'],['Belgium','MF',8,'Youri Tielemans'],['Belgium','FW',9,'Romelu Lukaku'],['Belgium','FW',11,'Jérémy Doku'],
  // Canada
  ['Canada','GK',1,'Dayne St. Clair'],['Canada','GK',16,'Maxime Crépeau'],['Canada','DF',2,'Alistair Johnston'],['Canada','DF',19,'Alphonso Davies'],['Canada','DF',23,'Niko Sigur'],['Canada','MF',7,'Stephen Eustáquio'],['Canada','MF',8,'Ismaël Koné'],['Canada','MF',14,'Jacob Shaffelburg'],['Canada','FW',9,'Cyle Larin'],['Canada','FW',10,'Jonathan David'],['Canada','FW',17,'Tajon Buchanan'],
  // Colombia
  ['Colombia','GK',1,'David Ospina'],['Colombia','GK',12,'Camilo Vargas'],['Colombia','DF',2,'Daniel Muñoz'],['Colombia','DF',13,'Yerry Mina'],['Colombia','DF',22,'Deiver Machado'],['Colombia','MF',5,'Kevin Castaño'],['Colombia','MF',6,'Richard Ríos'],['Colombia','MF',10,'James Rodríguez'],['Colombia','FW',7,'Luis Díaz'],['Colombia','FW',9,'Jhon Córdoba'],['Colombia','FW',19,'Cucho Hernández'],
  // Croatia
  ['Croatia','GK',1,'Dominik Livaković'],['Croatia','GK',12,'Ivo Grbić'],['Croatia','DF',4,'Joško Gvardiol'],['Croatia','DF',6,'Josip Šutalo'],['Croatia','DF',22,'Luka Vušković'],['Croatia','MF',8,'Mateo Kovačić'],['Croatia','MF',10,'Luka Modrić'],['Croatia','MF',15,'Mario Pašalić'],['Croatia','FW',9,'Andrej Kramarić'],['Croatia','FW',14,'Ivan Perišić'],
  // Morocco
  ['Morocco','GK',1,'Yassine Bounou'],['Morocco','DF',2,'Achraf Hakimi'],['Morocco','DF',3,'Noussair Mazraoui'],['Morocco','DF',18,'Chadi Riad'],['Morocco','MF',4,'Sofyan Amrabat'],['Morocco','MF',8,'Azzedine Ounahi'],['Morocco','MF',23,'Bilal El Khannouss'],['Morocco','FW',9,'Soufiane Rahimi'],['Morocco','FW',10,'Brahim Díaz'],['Morocco','FW',20,'Ayoub El Kaabi'],
  // USA
  ['USA','GK',1,'Matt Turner'],['USA','GK',24,'Matt Freese'],['USA','DF',2,'Sergiño Dest'],['USA','DF',5,'Antonee Robinson'],['USA','DF',13,'Tim Ream'],['USA','MF',4,'Tyler Adams'],['USA','MF',8,'Weston McKennie'],['USA','MF',17,'Malik Tillman'],['USA','FW',10,'Christian Pulisic'],['USA','FW',20,'Folarin Balogun'],['USA','FW',21,'Timothy Weah']
].map(([country, position, number, name]) => ({ country, position, number, name }));

export const triviaPlayerCountries = [...new Set(triviaPlayers.map((p) => p.country))];
