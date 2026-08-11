// Canonical, categorized leerlijnen taxonomy — matches the real
// `activiteiten.categorie` / `activiteiten.leerlijn` data 1:1 (verified
// against the live Kennisbank/activiteiten dataset), unlike the earlier,
// fabricated "Basisdocument" leerlijn list this replaces everywhere
// (lesbouwer, AI-prompts, filters). This is the single source of truth —
// every UI dropdown, filter, and AI-prompt in the app should read from it
// rather than hardcoding its own leerlijn list.

export type LearningLineCategory = {
  category: string;
  domain: string;
  lines: string[];
};

export const LEARNING_LINE_CATEGORIES: LearningLineCategory[] = [
  {
    category: "Atletiek",
    domain: "atletiek",
    lines: ["Lopen", "Hoog- en verspringen", "Werpen"],
  },
  {
    category: "Bewegen op muziek",
    domain: "muziek",
    lines: ["stappen/lopen", "Motieven"],
  },
  {
    category: "Klimmen",
    domain: "klimmen",
    lines: ["Klauteren", "Touwklimmen"],
  },
  {
    category: "Spel",
    domain: "spel",
    lines: [
      "Honkloopspelen",
      "Jongleren",
      "Mikken",
      "Over en weer inplaatsen",
      "Passeren en onderscheppen",
      "Tikspelen",
    ],
  },
  {
    category: "Turnen",
    domain: "turnen",
    lines: ["Balanceren", "Springen", "Zwaaien"],
  },
  {
    category: "Zelfverdediging",
    domain: "zelfverdediging",
    lines: ["Stoeispelen", "Trefspelen"],
  },
  {
    category: "Zwemmen",
    domain: "zwemmen",
    lines: [
      "Jezelf en de ander redden",
      "Onder water gaan en verplaatsen",
      "Springend te water gaan",
      "Verplaatsen",
      "Aangepaste sportspelen",
    ],
  },
  {
    category: "Overig",
    domain: "overig",
    lines: ["Kennismaken", "Samenwerken"],
  },
];

export const isGameDomain = (learningLine: string): boolean => {
  const gameCategory = LEARNING_LINE_CATEGORIES.find((c) => c.domain === "spel");
  return gameCategory ? gameCategory.lines.includes(learningLine) : false;
};

// Flat convenience list — every valid leerlijn value across all categories.
export const ALL_LEARNING_LINES: string[] = LEARNING_LINE_CATEGORIES.flatMap(
  (c) => c.lines,
);
