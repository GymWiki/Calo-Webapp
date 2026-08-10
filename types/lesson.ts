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
const freeText = z.string().trim();
const textList = z.array(z.string().trim().min(1));
const optionalCount = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  z.coerce.number().int().min(0).optional(),
);

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

  // Tab 3 — Didactische analyse (de 4 L'en)
  goals: requiredText("Doelen zijn verplicht."),
  luktHetZwakSee: freeText,
  luktHetZwakDo: freeText,
  looptHetSee: freeText,
  looptHetDo: freeText,
  leeftHetSee: freeText,
  leeftHetDo: freeText,
  luktHetGoedSee: freeText,
  luktHetGoedDo: freeText,

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
  luktHetZwakSee: "",
  luktHetZwakDo: "",
  looptHetSee: "",
  looptHetDo: "",
  leeftHetSee: "",
  leeftHetDo: "",
  luktHetGoedSee: "",
  luktHetGoedDo: "",
  arrangement: "",
  deelnemersRegels: "",
  plaatjePraatje: "",
  aandachtspunten: "",
};

// ----------------------------------------------------------------------------
// Database row shapes
// ----------------------------------------------------------------------------

export type Lesson = {
  id: number;
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
  created_at: string;
};

export type LessonDidactics = {
  id: number;
  lesson_id: number;
  instructions_text: string | null;
  lukt_het_zwak_see: string | null;
  lukt_het_zwak_do: string | null;
  loopt_het_see: string | null;
  loopt_het_do: string | null;
  leeft_het_see: string | null;
  leeft_het_do: string | null;
  lukt_het_goed_see: string | null;
  lukt_het_goed_do: string | null;
};

export type LessonBlock = {
  id: number;
  lesson_id: number;
  block_type: LessonBlockType;
  content: string;
  created_at: string;
};
