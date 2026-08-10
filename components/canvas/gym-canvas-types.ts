export type ElementType =
  | "kast_klein"
  | "kast_groot"
  | "mat_klein"
  | "mat_lang"
  | "bank"
  | "pion"
  | "bal_foam"
  | "bal_korfbal"
  | "bal_voetbal"
  | "speler_rood"
  | "speler_blauw"
  | "pijl";

export type ElementShape = "rect" | "circle" | "triangle" | "arrow";

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
  elements: DiagramElement[];
};

export type ElementCategory =
  | "Meubilair"
  | "Markeringen"
  | "Ballen"
  | "Spelers"
  | "Pijlen";

export type ElementDef = {
  label: string;
  category: ElementCategory;
  shape: ElementShape;
  width: number;
  height: number;
  fill: string;
};

export const ELEMENT_CATEGORIES: ElementCategory[] = [
  "Meubilair",
  "Markeringen",
  "Ballen",
  "Spelers",
  "Pijlen",
];

export const ELEMENT_DEFS: Record<ElementType, ElementDef> = {
  kast_klein: {
    label: "Kast klein",
    category: "Meubilair",
    shape: "rect",
    width: 60,
    height: 40,
    fill: "#a97142",
  },
  kast_groot: {
    label: "Kast groot",
    category: "Meubilair",
    shape: "rect",
    width: 100,
    height: 40,
    fill: "#8b5e34",
  },
  mat_klein: {
    label: "Mat klein",
    category: "Meubilair",
    shape: "rect",
    width: 50,
    height: 50,
    fill: "#4c6ef5",
  },
  mat_lang: {
    label: "Mat lang",
    category: "Meubilair",
    shape: "rect",
    width: 130,
    height: 40,
    fill: "#4c6ef5",
  },
  bank: {
    label: "Bank",
    category: "Meubilair",
    shape: "rect",
    width: 110,
    height: 18,
    fill: "#c99a52",
  },
  pion: {
    label: "Pion",
    category: "Markeringen",
    shape: "triangle",
    width: 22,
    height: 22,
    fill: "#ff5a1f",
  },
  bal_foam: {
    label: "Foamball",
    category: "Ballen",
    shape: "circle",
    width: 22,
    height: 22,
    fill: "#f4c10a",
  },
  bal_korfbal: {
    label: "Korfbal",
    category: "Ballen",
    shape: "circle",
    width: 22,
    height: 22,
    fill: "#e8590c",
  },
  bal_voetbal: {
    label: "Voetbal",
    category: "Ballen",
    shape: "circle",
    width: 22,
    height: 22,
    fill: "#1b1d21",
  },
  speler_rood: {
    label: "Speler rood",
    category: "Spelers",
    shape: "circle",
    width: 28,
    height: 28,
    fill: "#e03131",
  },
  speler_blauw: {
    label: "Speler blauw",
    category: "Spelers",
    shape: "circle",
    width: 28,
    height: 28,
    fill: "#1c7ed6",
  },
  pijl: {
    label: "Pijl",
    category: "Pijlen",
    shape: "arrow",
    width: 90,
    height: 4,
    fill: "#14171a",
  },
};
