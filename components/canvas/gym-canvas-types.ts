export type ElementCategory =
  | "groot_materiaal"
  | "klein_materiaal"
  | "ballen"
  | "spelers_veld"
  | "lijnen_pijlen";

export const ELEMENT_CATEGORIES: ElementCategory[] = [
  "groot_materiaal",
  "klein_materiaal",
  "ballen",
  "spelers_veld",
  "lijnen_pijlen",
];

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  groot_materiaal: "Groot materiaal",
  klein_materiaal: "Klein materiaal",
  ballen: "Ballen",
  spelers_veld: "Spelers & veld",
  lijnen_pijlen: "Lijnen & pijlen",
};

export type ElementType =
  // Groot materiaal
  | "kast_klein"
  | "kast_groot"
  | "turnbank"
  | "mat_dik"
  | "mat_klein"
  | "wandrek"
  | "trampoline"
  | "korf"
  | "doel"
  // Klein materiaal
  | "pion"
  | "lint"
  | "hoepel"
  | "springtouw"
  // Ballen
  | "bal_voetbal"
  | "bal_basketbal"
  | "bal_korfbal"
  | "bal_foam"
  | "bal_trefbal"
  | "bal_volleybal"
  // Spelers & veld
  | "speler_rood"
  | "speler_blauw"
  | "scheidsrechter"
  | "team_a"
  | "team_b"
  // Lijnen & pijlen
  | "looplijn"
  | "looprichting_pijl"
  | "balbaan_pijl"
  | "aanvalszone";

export type ElementDef = {
  label: string;
  category: ElementCategory;
  width: number;
  height: number;
};

export const ELEMENT_DEFS: Record<ElementType, ElementDef> = {
  kast_klein: { label: "Kast klein", category: "groot_materiaal", width: 60, height: 40 },
  kast_groot: { label: "Kast groot", category: "groot_materiaal", width: 100, height: 46 },
  turnbank: { label: "Turnbank", category: "groot_materiaal", width: 110, height: 20 },
  mat_dik: { label: "Dikke mat", category: "groot_materiaal", width: 70, height: 70 },
  mat_klein: { label: "Kleine matjes", category: "groot_materiaal", width: 50, height: 50 },
  wandrek: { label: "Wandrek", category: "groot_materiaal", width: 18, height: 130 },
  trampoline: { label: "Trampoline", category: "groot_materiaal", width: 74, height: 74 },
  korf: { label: "Korf / Basket", category: "groot_materiaal", width: 34, height: 34 },
  doel: { label: "Doel", category: "groot_materiaal", width: 90, height: 44 },

  pion: { label: "Pion / Markeerhoedje", category: "klein_materiaal", width: 22, height: 22 },
  lint: { label: "Lintje", category: "klein_materiaal", width: 22, height: 30 },
  hoepel: { label: "Hoepel", category: "klein_materiaal", width: 32, height: 32 },
  springtouw: { label: "Springtouw", category: "klein_materiaal", width: 54, height: 14 },

  bal_voetbal: { label: "Voetbal", category: "ballen", width: 24, height: 24 },
  bal_basketbal: { label: "Basketbal", category: "ballen", width: 24, height: 24 },
  bal_korfbal: { label: "Korfbal", category: "ballen", width: 24, height: 24 },
  bal_foam: { label: "Foamball", category: "ballen", width: 22, height: 22 },
  bal_trefbal: { label: "Trefbal", category: "ballen", width: 22, height: 22 },
  bal_volleybal: { label: "Volleybal", category: "ballen", width: 24, height: 24 },

  speler_rood: { label: "Speler rood", category: "spelers_veld", width: 28, height: 28 },
  speler_blauw: { label: "Speler blauw", category: "spelers_veld", width: 28, height: 28 },
  scheidsrechter: { label: "Scheidsrechter / Docent", category: "spelers_veld", width: 28, height: 28 },
  team_a: { label: "Team A (groepje)", category: "spelers_veld", width: 46, height: 40 },
  team_b: { label: "Team B (groepje)", category: "spelers_veld", width: 46, height: 40 },

  looplijn: { label: "Looplijn (gestippeld)", category: "lijnen_pijlen", width: 90, height: 4 },
  looprichting_pijl: { label: "Looprichting pijl", category: "lijnen_pijlen", width: 90, height: 4 },
  balbaan_pijl: { label: "Balbaan pijl (gecurveerd)", category: "lijnen_pijlen", width: 90, height: 40 },
  aanvalszone: { label: "Aanvalszone", category: "lijnen_pijlen", width: 100, height: 70 },
};

export type ViewMode = "top" | "side";

export type DiagramElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

export type DiagramData = {
  width: number;
  height: number;
  /** Absent on older saved diagrams — treat as "top". */
  viewMode?: ViewMode;
  elements: DiagramElement[];
};
