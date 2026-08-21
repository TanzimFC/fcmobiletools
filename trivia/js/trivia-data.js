const TRIVIA_DATA = {
    mexico: {
        name: "Mexico",
        flag: "🇲🇽",
        background:
            "https://tanzimfc.fcmobiletools.workers.dev/assets/images/mexico_BG.png.png",

        levels: {
            beginner: {
                name: "Beginner",
                color: "green",
                days: [
                    {
                        day: 1,
                        challenge: "Challenge I",
                        questions: [
                            {
                                question: "Mexico's first-ever World Cup match: what year?",
                                options: ["1930", "1934", "1950", "1954"],
                                correctAnswer: "1930",
                                explanation:
                                    "Mexico made its first appearance at the FIFA World Cup in 1930, the tournament's inaugural edition."
                            },
                            {
                                question:
                                    "Who was the first player to appear in five World Cups, earning the nickname “El Cinco Copas”?",
                                options: [
                                    "Hugo Sánchez",
                                    "Antonio Carbajal",
                                    "Rafael Márquez",
                                    "Jorge Campos"
                                ],
                                correctAnswer: "Antonio Carbajal",
                                explanation:
                                    "Antonio Carbajal became the first player to appear in five FIFA World Cups."
                            },
                            {
                                question: "What stage did Mexico reach at the 1970 World Cup?",
                                options: [
                                    "Round of 16",
                                    "Quarter-finals",
                                    "Semi-finals",
                                    "Final"
                                ],
                                correctAnswer: "Quarter-finals",
                                explanation:
                                    "Mexico reached the quarter-finals at the 1970 World Cup, which was hosted in Mexico."
                            }
                        ]
                    },

                    {
                        day: 2,
                        challenge: "Challenge II",
                        questions: [
                            {
                                question:
                                    "Who scored the famous scissor-kick goal against Bulgaria at the 1986 World Cup?",
                                options: [
                                    "Hugo Sánchez",
                                    "Manuel Negrete",
                                    "Jared Borgetti",
                                    "Cuauhtémoc Blanco"
                                ],
                                correctAnswer: "Manuel Negrete",
                                explanation:
                                    "Manuel Negrete scored one of the most memorable goals of the 1986 World Cup with an acrobatic scissor kick."
                            },
                            {
                                question:
                                    "How many consecutive Round-of-16 eliminations did Mexico suffer from 1994 to 2018?",
                                options: ["5", "6", "7", "8"],
                                correctAnswer: "Seven consecutive Round-of-16 eliminations",
                                explanation:
                                    "Mexico reached the Round of 16 in seven consecutive World Cups from 1994 through 2018."
                            },
                            {
                                question:
                                    "Who did Mexico defeat 1–0 in its opening match at the 2018 World Cup?",
                                options: [
                                    "Brazil",
                                    "Germany",
                                    "Argentina",
                                    "Spain"
                                ],
                                correctAnswer: "Germany",
                                explanation:
                                    "Mexico opened the 2018 World Cup with a famous 1–0 victory over the defending champions Germany."
                            }
                        ]
                    },

                    {
                        day: 3,
                        challenge: "Challenge III",
                        questions: [
                            {
                                question:
                                    "Which player was involved in the controversial 2014 “No era penal” incident?",
                                options: [
                                    "Arjen Robben",
                                    "Robin van Persie",
                                    "Wesley Sneijder",
                                    "Klaas-Jan Huntelaar"
                                ],
                                correctAnswer: "Arjen Robben",
                                explanation:
                                    "Arjen Robben was involved in the controversial penalty incident during Mexico's 2014 World Cup elimination by the Netherlands."
                            },
                            {
                                question:
                                    "Which team eliminated Mexico in the 2002 Round of 16?",
                                options: [
                                    "Brazil",
                                    "USA",
                                    "Germany",
                                    "Spain"
                                ],
                                correctAnswer: "USA",
                                explanation:
                                    "The United States defeated Mexico 2–0 in the Round of 16 at the 2002 World Cup."
                            },
                            {
                                question:
                                    "Who did Mexico face in the 1999 Confederations Cup final?",
                                options: [
                                    "Brazil",
                                    "Argentina",
                                    "USA",
                                    "France"
                                ],
                                correctAnswer: "Brazil",
                                explanation:
                                    "Mexico defeated Brazil in the 1999 FIFA Confederations Cup final."
                            }
                        ]
                    }
                ]
            },

            medium: {
                name: "Medium",
                color: "yellow",
                days: [
                    {
                        day: 4,
                        challenge: "Challenge I",
                        questions: [
                            {
                                question:
                                    "What is the nickname of the Mexico national team?",
                                options: [
                                    "El Tri",
                                    "La Roja",
                                    "Los Aztecas",
                                    "El Verde"
                                ],
                                correctAnswer: "El Tri",
                                explanation:
                                    "Mexico's national team is commonly known as El Tri, referring to the three colours of the Mexican flag."
                            },
                            {
                                question:
                                    "Which Mexican player scored in three consecutive World Cups: 2010, 2014 and 2018?",
                                options: [
                                    "Javier Hernández",
                                    "Hugo Sánchez",
                                    "Rafael Márquez",
                                    "Carlos Vela"
                                ],
                                correctAnswer: "Javier “Chicharito” Hernández",
                                explanation:
                                    "Javier Hernández, commonly known as Chicharito, scored for Mexico at the 2010, 2014 and 2018 World Cups."
                            },
                            {
                                question:
                                    "Which team was listed as one of Mexico's Group A opponents for the 2026 World Cup?",
                                options: [
                                    "South Africa",
                                    "Japan",
                                    "Croatia",
                                    "Portugal"
                                ],
                                correctAnswer: "South Africa",
                                explanation:
                                    "South Africa was listed alongside Mexico in Group A for the 2026 World Cup."
                            },
                            {
                                question:
                                    "Who coached Mexico at the 2014 World Cup and was nicknamed “El Piojo”?",
                                options: [
                                    "Miguel Herrera",
                                    "Ricardo La Volpe",
                                    "Javier Aguirre",
                                    "Juan Carlos Osorio"
                                ],
                                correctAnswer: "Miguel Herrera",
                                explanation:
                                    "Miguel Herrera coached Mexico at the 2014 World Cup and was widely known as El Piojo."
                            }
                        ]
                    },

                    {
                        day: 5,
                        challenge: "Challenge II",
                        questions: [
                            {
                                question:
                                    "Which team did Luis Hernández score against to equalize 2–2 in 1998?",
                                options: [
                                    "Netherlands",
                                    "Germany",
                                    "Belgium",
                                    "France"
                                ],
                                correctAnswer: "Netherlands",
                                explanation:
                                    "Luis Hernández scored Mexico's second goal against the Netherlands in their 1998 group-stage match."
                            },
                            {
                                question:
                                    "What is Mexico's historic home stadium?",
                                options: [
                                    "Estadio Jalisco",
                                    "Estadio Azteca",
                                    "Estadio BBVA",
                                    "Estadio Olímpico"
                                ],
                                correctAnswer: "Estadio Azteca",
                                explanation:
                                    "Estadio Azteca in Mexico City has been the iconic home of the Mexico national team."
                            },
                            {
                                question:
                                    "When did Mexico record its first World Cup victory?",
                                options: [
                                    "1958 vs Sweden",
                                    "1962 vs Czechoslovakia",
                                    "1966 vs France",
                                    "1970 vs Belgium"
                                ],
                                correctAnswer: "1962 vs Czechoslovakia",
                                explanation:
                                    "Mexico recorded its first World Cup win by defeating Czechoslovakia 3–1 in 1962."
                            },
                            {
                                question:
                                    "Which Mexican goalkeeper was famous for his colorful self-designed jerseys?",
                                options: [
                                    "Guillermo Ochoa",
                                    "Jorge Campos",
                                    "Oswaldo Sánchez",
                                    "Antonio Carbajal"
                                ],
                                correctAnswer: "Jorge Campos",
                                explanation:
                                    "Jorge Campos became famous for his distinctive goalkeeper kits, many of which he designed himself."
                            }
                        ]
                    },

                    {
                        day: 6,
                        challenge: "Challenge III",
                        questions: [
                            {
                                question:
                                    "Who did Mexico face in the 2012 Olympic football final?",
                                options: [
                                    "Brazil",
                                    "Argentina",
                                    "Spain",
                                    "Germany"
                                ],
                                correctAnswer: "Brazil",
                                explanation:
                                    "Mexico defeated Brazil 2–1 in the gold-medal match at the 2012 London Olympics."
                            },
                            {
                                question:
                                    "How many times had Mexico hosted the World Cup before 2026?",
                                options: ["1", "2", "3", "4"],
                                correctAnswer: "2",
                                explanation:
                                    "Mexico hosted the World Cup in 1970 and 1986 before becoming a co-host for 2026."
                            },
                            {
                                question:
                                    "Who was the Argentine coach of Mexico at the 2006 World Cup?",
                                options: [
                                    "Ricardo La Volpe",
                                    "Marcelo Bielsa",
                                    "Gerardo Martino",
                                    "Jorge Sampaoli"
                                ],
                                correctAnswer: "Ricardo La Volpe",
                                explanation:
                                    "Argentine manager Ricardo La Volpe coached Mexico at the 2006 World Cup."
                            },
                            {
                                question:
                                    "Which Mexican player scored the famous header against Italy in 2002?",
                                options: [
                                    "Jared Borgetti",
                                    "Luis Hernández",
                                    "Cuauhtémoc Blanco",
                                    "Rafael Márquez"
                                ],
                                correctAnswer: "Jared Borgetti",
                                explanation:
                                    "Jared Borgetti scored a memorable header for Mexico against Italy at the 2002 World Cup."
                            }
                        ]
                    }
                ]
            },

            difficult: {
                name: "Difficult",
                color: "red",
                days: [
                    {
                        day: 7,
                        challenge: "Challenge I",
                        questions: [
                            {
                                question:
                                    "What achievement did Guillermo Ochoa record against Poland at the 2022 World Cup?",
                                options: [
                                    "Scored a goal",
                                    "Saved Robert Lewandowski's penalty",
                                    "Made an assist",
                                    "Kept two clean sheets"
                                ],
                                correctAnswer:
                                    "Saved Robert Lewandowski's penalty",
                                explanation:
                                    "Guillermo Ochoa saved Robert Lewandowski's penalty during Mexico's opening match at the 2022 World Cup."
                            },
                            {
                                question:
                                    "Which player is associated with the “Cuauhtemiña” trick?",
                                options: [
                                    "Hugo Sánchez",
                                    "Cuauhtémoc Blanco",
                                    "Rafael Márquez",
                                    "Jorge Campos"
                                ],
                                correctAnswer: "Cuauhtémoc Blanco",
                                explanation:
                                    "The Cuauhtemiña is the famous football trick associated with Mexican star Cuauhtémoc Blanco."
                            },
                            {
                                question:
                                    "How many points did Mexico earn at the 1978 World Cup?",
                                options: ["0", "1", "2", "3"],
                                correctAnswer: "0",
                                explanation:
                                    "Mexico lost all three of its group matches at the 1978 World Cup and finished with zero points."
                            },
                            {
                                question:
                                    "How many World Cups did Rafa Márquez captain Mexico at?",
                                options: ["3", "4", "5", "6"],
                                correctAnswer: "5",
                                explanation:
                                    "Rafael Márquez captained Mexico at five different World Cups."
                            },
                            {
                                question:
                                    "How many CONCACAF Gold Cup titles had Mexico won as of 2025?",
                                options: ["8", "9", "10", "11"],
                                correctAnswer: "10",
                                explanation:
                                    "Mexico had won 10 CONCACAF Gold Cup titles as of 2025."
                            }
                        ]
                    },

                    {
                        day: 8,
                        challenge: "Challenge II",
                        questions: [
                            {
                                question:
                                    "Who scored Argentina's extra-time goal that eliminated Mexico in 2006?",
                                options: [
                                    "Lionel Messi",
                                    "Maxi Rodríguez",
                                    "Hernán Crespo",
                                    "Javier Saviola"
                                ],
                                correctAnswer: "Maxi Rodríguez",
                                explanation:
                                    "Maxi Rodríguez scored the spectacular extra-time winner that eliminated Mexico in the 2006 World Cup Round of 16."
                            },
                            {
                                question:
                                    "Who was the first Mexican player to score at a World Cup?",
                                options: [
                                    "Antonio Carbajal",
                                    "Juan Carreño",
                                    "Hugo Sánchez",
                                    "Manuel Negrete"
                                ],
                                correctAnswer: "Juan Carreño",
                                explanation:
                                    "Juan Carreño became the first Mexican player to score at a World Cup during the 1930 tournament."
                            },
                            {
                                question:
                                    "What did Mexico need in 2022 to have a chance of advancing?",
                                options: [
                                    "A draw",
                                    "A win by a large goal difference",
                                    "A clean sheet",
                                    "A one-goal win"
                                ],
                                correctAnswer:
                                    "A win by a large goal difference",
                                explanation:
                                    "Mexico needed a sufficiently large victory against Saudi Arabia to have a realistic chance of progressing."
                            },
                            {
                                question:
                                    "Who scored Mexico's free-kick goal against Saudi Arabia in 2022?",
                                options: [
                                    "Luis Chávez",
                                    "Hirving Lozano",
                                    "Alexis Vega",
                                    "Henry Martín"
                                ],
                                correctAnswer: "Luis Chávez",
                                explanation:
                                    "Luis Chávez scored a spectacular free kick against Saudi Arabia at the 2022 World Cup."
                            },
                            {
                                question:
                                    "Against whom did Mexico earn its first World Cup point?",
                                options: [
                                    "Wales",
                                    "France",
                                    "Sweden",
                                    "Belgium"
                                ],
                                correctAnswer: "Wales",
                                explanation:
                                    "Mexico earned its first World Cup point with a draw against Wales at the 1958 World Cup."
                            }
                        ]
                    },

                    {
                        day: 9,
                        challenge: "Challenge III",
                        questions: [
                            {
                                question:
                                    "Which Real Madrid legend scored for Mexico at the 1986 World Cup?",
                                options: [
                                    "Hugo Sánchez",
                                    "Rafael Márquez",
                                    "Jorge Campos",
                                    "Luis García"
                                ],
                                correctAnswer: "Hugo Sánchez",
                                explanation:
                                    "Hugo Sánchez, one of Real Madrid's greatest Mexican players, scored for Mexico at the 1986 World Cup."
                            },
                            {
                                question:
                                    "What happened to Mexico at the 2022 World Cup, ending its long Round-of-16 streak?",
                                options: [
                                    "Lost in the Round of 16",
                                    "Failed to advance from the group stage",
                                    "Lost in the quarter-finals",
                                    "Finished as runners-up"
                                ],
                                correctAnswer:
                                    "Failed to advance from the group stage",
                                explanation:
                                    "Mexico were eliminated in the group stage in 2022, ending their run of seven consecutive Round-of-16 appearances."
                            },
                            {
                                question:
                                    "Which host nation did Mexico face in its opening match at the 2010 World Cup?",
                                options: [
                                    "Brazil",
                                    "South Africa",
                                    "Germany",
                                    "Argentina"
                                ],
                                correctAnswer: "South Africa",
                                explanation:
                                    "Mexico opened the 2010 World Cup against hosts South Africa."
                            },
                            {
                                question:
                                    "Which Mexican defender played for Barcelona and won two Champions Leagues?",
                                options: [
                                    "Rafael Márquez",
                                    "Héctor Moreno",
                                    "Carlos Salcido",
                                    "Javier Rodríguez"
                                ],
                                correctAnswer: "Rafael Márquez",
                                explanation:
                                    "Rafael Márquez played for Barcelona and won the UEFA Champions League twice with the club."
                            },
                            {
                                question:
                                    "Which two countries are Mexico's co-hosts for the 2026 World Cup?",
                                options: [
                                    "Brazil and Argentina",
                                    "USA and Canada",
                                    "Spain and Portugal",
                                    "England and France"
                                ],
                                correctAnswer: "USA and Canada",
                                explanation:
                                    "Mexico, the United States and Canada are jointly hosting the 2026 FIFA World Cup."
                            }
                        ]
                    }
                ]
            }
        }
    }
};
