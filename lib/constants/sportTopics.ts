// Onderwerp/sport — het concrete "decor" waarbinnen een leerlijn wordt
// beoefend (bijv. de leerlijn "Honkloopspelen" wordt concreet gemaakt door
// het onderwerp "Softbal" of "Honkbal"). Dit is BEWUST een losse, aparte
// lijst van lib/constants/learningLines.ts — geen 1-op-1 koppeling met een
// specifieke leerlijn, want meerdere onderwerpen kunnen bij dezelfde
// leerlijn passen (bijv. zowel "Softbal" als "Honkbal" bij "Honkloopspelen")
// en de gebruiker kiest onderwerp en leerlijn onafhankelijk van elkaar.
//
// In tegenstelling tot LEARNING_LINE_CATEGORIES (geverifieerd tegen de echte
// activiteiten-data) is dit een nieuwe, samengestelde lijst — bewust breed
// en herkenbaar gehouden (gangbare bewegingsonderwijs-onderwerpen), niet
// bedoeld als een uitputtende/officiële taxonomie. Uitbreiden kan gewoon
// door hier een regel toe te voegen, geen migratie nodig.

export type SportTopicCategory = {
  category: string;
  topics: string[];
};

export const SPORT_TOPIC_CATEGORIES: SportTopicCategory[] = [
  {
    category: "Balspelen",
    topics: [
      "Softbal",
      "Honkbal",
      "Slagbal",
      "Trefbal",
      "Voetbal",
      "Basketbal",
      "Volleybal",
      "Handbal",
      "Korfbal",
      "Hockey",
      "Rugby",
      "Frisbee(-golf)",
    ],
  },
  {
    category: "Racketspelen",
    topics: ["Badminton", "Tennis", "Tafeltennis", "Squash"],
  },
  {
    category: "Atletiek",
    topics: ["Hardlopen", "Sprinten", "Hordelopen", "Hoogspringen", "Verspringen", "Werpen/kogelstoten"],
  },
  {
    category: "Turnen & bewegen",
    topics: ["Turnen", "Acrobatiek", "Trampolinespringen", "Bewegen op muziek", "Dans"],
  },
  {
    category: "Klimmen & balanceren",
    topics: ["Klimmen", "Klauteren", "Balanceren"],
  },
  {
    category: "Zelfverdediging & stoeien",
    topics: ["Judo", "Worstelen", "Stoeispelen"],
  },
  {
    category: "Zwemmen & water",
    topics: ["Zwemmen", "Waterpolo", "Reddend zwemmen"],
  },
  {
    category: "Overig",
    topics: ["Tikspelen", "Estafettes", "Samenwerkingsspelen", "Kennismakingsspelen"],
  },
];

export const ALL_SPORT_TOPICS: string[] = SPORT_TOPIC_CATEGORIES.flatMap((c) => c.topics);
