import { z } from "zod";

export const LESSON_BLOCK_TYPES = [
  "arrangement",
  "deelnemers_regels",
  "plaatje_praatje",
  "aandachtspunten",
] as const;

export const lessonBlockTypeSchema = z.enum(LESSON_BLOCK_TYPES);
export type LessonBlockType = z.infer<typeof lessonBlockTypeSchema>;

export const LESSON_BLOCK_LABELS: Record<LessonBlockType, string> = {
  arrangement: "Arrangement",
  deelnemers_regels: "Deelnemers & Regels",
  plaatje_praatje: "Plaatje & Praatje",
  aandachtspunten: "Aandachtspunten",
};

// RHF's `defaultValues` (see `createLessonDefaultValues` below) already
// seeds every field, so these are deliberately *not* `.optional()`/
// `.default()` at the zod level — that would make z.input diverge from
// z.output and break zodResolver's generic match against `useForm<T>`.
const requiredText = (message: string) => z.string().trim().min(1, message);
const textList = z.array(z.string().trim().min(1));
const optionalCount = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  z.coerce.number().int().min(0).optional(),
);

// ----------------------------------------------------------------------------
// Didactische analyse — Walinga & Koekoek (2021), de 3 L'en
// ----------------------------------------------------------------------------

export const DIDACTIC_CATEGORIES = ["loopt_het", "lukt_het", "leeft_het"] as const;
export const didacticCategorySchema = z.enum(DIDACTIC_CATEGORIES);
export type DidacticCategory = z.infer<typeof didacticCategorySchema>;

export const DIDACTIC_CATEGORY_LABELS: Record<DidacticCategory, string> = {
  loopt_het: "Loopt 't?",
  lukt_het: "Lukt 't?",
  leeft_het: "Leeft 't?",
};

export const DIDACTIC_CATEGORY_SUBTITLES: Record<DidacticCategory, string> = {
  loopt_het: "Organisatie & groepsdynamica",
  lukt_het: "Bewegingsvaardigheid & motorisch leren",
  leeft_het: "Betrokkenheid & motivatietheorie",
};

// Subthema's + specialistische invalshoeken uit de Walinga & Koekoek-matrix,
// samengevoegd tot één keuzelijst per L (de UI toont één dropdown per item).
export const DIDACTIC_SUBTHEMES: Record<DidacticCategory, string[]> = {
  loopt_het: [
    "Werkvorm",
    "Afstemming",
    "Sfeer",
    "Communicatie",
    "Leiderschap",
    "Organisatie",
    "Zelfregulatie (groep)",
    "Wisselafspraken",
  ],
  lukt_het: [
    "Haalbaarheid",
    "Uitbouwbaarheid",
    "Eigenheid",
    "Methodiek",
    "Motorisch leren",
    "Differentiatie (zwakke vs betere beweger)",
    "Deliberate play",
    "TGfU",
  ],
  leeft_het: [
    "Inbreng",
    "Succeservaring",
    "Erbij horen",
    "Motivatietheorie",
    "Reflectie",
    "Goal achievement",
    "Eigenaarschap & plezier",
  ],
};

export const didacticItemSchema = z.object({
  id: z.string(),
  category: didacticCategorySchema,
  subTheme: z.string().trim().min(1).nullable(),
  observation: requiredText("Vul in wat je ziet."),
  action: requiredText("Vul in wat je doet."),
});
export type DidacticItem = z.infer<typeof didacticItemSchema>;

// ----------------------------------------------------------------------------
// Game-Based Pedagogy — Koekoek, Dokman & Walinga
// ----------------------------------------------------------------------------

export const GAME_CATEGORIES = [
  "Invasion Games",
  "Net/Wall Games",
  "Striking/Fielding Games",
  "Target Games",
  "Overig",
] as const;
export const gameCategorySchema = z.enum(GAME_CATEGORIES);
export type GameCategory = z.infer<typeof gameCategorySchema>;

export const gameDimensionsSchema = z.object({
  space: z.string().trim(),
  equipment: z.string().trim(),
  people: z.string().trim(),
  rules: z.string().trim(),
});
export type GameDimensions = z.infer<typeof gameDimensionsSchema>;

export const EMPTY_GAME_DIMENSIONS: GameDimensions = {
  space: "",
  equipment: "",
  people: "",
  rules: "",
};

/**
 * Full lesvoorbereiding form: validated identically on the client
 * (react-hook-form + zodResolver) and on the server (createLesson action).
 */
export const createLessonInputSchema = z.object({
  // Tab 1 — Context & Thema
  title: requiredText("Titel is verplicht."),
  lessonDate: requiredText("Datum is verplicht."),
  groupName: requiredText("Groep/klas is verplicht."),
  learningLine: requiredText("Leerlijn is verplicht."),
  movementProblem: requiredText("Bewegingsprobleem is verplicht."),
  movementTheme: requiredText("Bewegingsthema is verplicht."),

  // Tab 2 — Organisatie & Materialen
  baseMaterials: textList,
  ruleMaterials: textList,
  minParticipants: optionalCount,
  participantsBench: optionalCount,
  rules: textList,

  // Tab 3 — Didactische analyse (de 3 L'en, Walinga & Koekoek 2021) +
  // Game-Based Pedagogy (Koekoek, Dokman & Walinga)
  goals: requiredText("Doelen zijn verplicht."),
  didacticItems: z.array(didacticItemSchema),
  gameCategory: z.string().trim(),
  gameDimensions: gameDimensionsSchema,
  tacticalQuestions: textList,

  // Tab 4 — Activiteitsvoorbereiding (de 4 kernelementen)
  arrangement: requiredText("Arrangement is verplicht."),
  deelnemersRegels: requiredText("Deelnemers & regels is verplicht."),
  plaatjePraatje: requiredText("Plaatje & praatje is verplicht."),
  aandachtspunten: requiredText("Aandachtspunten is verplicht."),
});

// `createLessonInputSchema` coerces `minParticipants`/`participantsBench`
// (empty string -> undefined -> number), so its z.input and z.output types
// differ. `CreateLessonFormInput` types react-hook-form's raw field values;
// `CreateLessonInput` is the parsed shape the form submits to the server
// action once zodResolver has run.
export type CreateLessonFormInput = z.input<typeof createLessonInputSchema>;
export type CreateLessonInput = z.output<typeof createLessonInputSchema>;

export const createLessonDefaultValues: CreateLessonFormInput = {
  title: "",
  lessonDate: "",
  groupName: "",
  learningLine: "",
  movementProblem: "",
  movementTheme: "",
  baseMaterials: [],
  ruleMaterials: [],
  minParticipants: undefined,
  participantsBench: undefined,
  rules: [],
  goals: "",
  didacticItems: [],
  gameCategory: "",
  gameDimensions: EMPTY_GAME_DIMENSIONS,
  tacticalQuestions: [],
  arrangement: "",
  deelnemersRegels: "",
  plaatjePraatje: "",
  aandachtspunten: "",
};

// ----------------------------------------------------------------------------
// Database row shapes
// ----------------------------------------------------------------------------

export type Lesson = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  lesson_date: string | null;
  group_name: string | null;
  movement_problem: string | null;
  movement_theme: string | null;
  learning_line: string | null;
  goals: string | null;
  points_of_attention: string | null;
  rules: string[] | null;
  min_participants: number | null;
  participants_bench: number | null;
  base_materials: string[] | null;
  rule_materials: string[] | null;
  // Loosely typed here (JSONB) — the canvas module owns the rich shape via
  // components/canvas/gym-canvas-types.ts's DiagramData.
  diagram_data: unknown | null;
  diagram_image_url: string | null;
  game_category: string | null;
  game_dimensions: GameDimensions | null;
  tactical_questions: string[] | null;
  created_at: string;
  updated_at: string;
};

export type LessonDidactics = {
  id: string;
  lesson_id: string;
  items: DidacticItem[];
};

export type LessonBlock = {
  id: string;
  lesson_id: string;
  block_type: LessonBlockType;
  content: string;
  created_at: string;
};

export type LessonAuthor = {
  first_name: string;
  last_name: string;
};

export type LessonWithDetails = Lesson & {
  lesson_didactics: LessonDidactics | null;
  lesson_blocks: LessonBlock[];
  author: LessonAuthor | null;
};

// Groups a flat DidacticItem[] by category, in canonical L-order, for the
// detail page and PDF export.
export function groupDidacticItemsByCategory(
  items: DidacticItem[],
): Record<DidacticCategory, DidacticItem[]> {
  const grouped: Record<DidacticCategory, DidacticItem[]> = {
    loopt_het: [],
    lukt_het: [],
    leeft_het: [],
  };
  for (const item of items) {
    grouped[item.category].push(item);
  }
  return grouped;
}
