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

/**
 * Full lesvoorbereiding form: validated identically on the client
 * (react-hook-form + zodResolver) and on the server (createLesson action).
 */
export const createLessonInputSchema = z.object({
  // Tab 1 — Context & Thema
  title: requiredText("Titel is verplicht."),
  lessonDate: requiredText("Datum is verplicht."),
  learningLine: requiredText("Leerlijn is verplicht."),
  // Zelfde 1-6 doelgroepcodes als activiteiten (types/activity.ts) — nodig
  // zodat de samengevoegde bibliotheekpagina (/zoeken) hierop kan filteren
  // over beide brontypes heen.
  doelgroep: z.array(z.number().int()),
  // Bewuste, expliciete keuze i.p.v. impliciet gedrag: bepaalt of createLesson
  // (actions/lesson.ts) deze activiteit door de AI-kwaliteitscheck/
  // duplicaatdetectie stuurt en — bij goedkeuring — publiek + meetellend voor
  // de maandelijkse bijdrage maakt, of 'm direct alleen-voor-mezelf opslaat
  // (geen check, niet publiek, telt niet mee). Los van `status`: die volgt
  // hieruit, niet andersom. Default true (zie createLessonDefaultValues) —
  // opt-out i.p.v. opt-in, want het freemium-model leunt op bijdragen; de
  // toggle zelf maakt het wel altijd een bewuste, zichtbare keuze.
  isPublic: z.boolean(),
  movementProblem: requiredText("Bewegingsprobleem is verplicht."),
  // Niet .min(1): een bewegingsthema bestaat alleen als vaste select
  // wanneer BEWEGINGSTHEMAS een lijst heeft voor de gekozen leerlijn (zie
  // lib/constants/learningLines.ts) — anders blijft dit veld leeg en valt
  // toActivitiesRow() terug op de leerlijn zelf.
  movementTheme: z.string().trim(),

  // Tab 2 — Organisatie & Materialen
  baseMaterials: textList,
  ruleMaterials: textList,
  minParticipants: optionalCount,
  participantsBench: optionalCount,
  rules: textList,

  // Tab 3 — Didactische analyse (de 3 L'en, Walinga & Koekoek 2021)
  goals: requiredText("Doelen zijn verplicht."),
  // Kolom bestond al (learning_outcomes, zie het Lesson-type hieronder) maar
  // had nog geen create/edit-UI — die komt er nu bij (zie lesson-form.tsx).
  learningOutcomes: textList,
  didacticItems: z.array(didacticItemSchema),

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

// ----------------------------------------------------------------------------
// Verplichte velden — UI-metadata (label + tabsectie) voor exact dezelfde 10
// velden als de requiredText()-aanroepen hierboven. Eén bron voor de live
// "nog niet ingevuld"-indicatie, de voortgangsbalk én de foutmelding bij een
// mislukte "Activiteit opslaan"-poging (zie lesson-form.tsx en
// activity-wizard-page.tsx) — zodat die drie elkaar nooit kunnen
// tegenspreken. `section: null` betekent: staat altijd zichtbaar boven de
// Tabs (Basisgegevens-kaart), geen tab-wissel nodig om ernaartoe te
// scrollen. movementTheme/doelgroep/materiaal/leeruitkomsten/regels/leerhulp
// zijn bewust optioneel/aanvullend, net als in het zod-schema hierboven.
// `as const satisfies` i.p.v. een brede `{ field: keyof CreateLessonFormInput; ... }[]`-
// annotatie: dat laatste zou elk `field` verbreden tot ALLE sleutels van
// CreateLessonFormInput, waardoor bijv. `(typeof REQUIRED_LESSON_FIELDS)[number]["field"]`
// elders (activity-wizard-page.tsx, lesson-form.tsx) niet meer de exacte 10
// literals zou zijn maar elke veldnaam — `satisfies` valideert nog steeds dat
// elk `field` een echte sleutel is, zonder die verbreding.
export const REQUIRED_LESSON_FIELDS = [
  { field: "title", label: "Titel", section: null },
  { field: "learningLine", label: "Leerlijn", section: null },
  { field: "lessonDate", label: "Datum", section: null },
  { field: "goals", label: "Doel", section: "lesinhoud" },
  { field: "movementProblem", label: "Beginsituatie", section: "lesinhoud" },
  { field: "deelnemersRegels", label: "Deelnemers & Regels", section: "lesinhoud" },
  { field: "plaatjePraatje", label: "Plaatje & Praatje", section: "lesinhoud" },
  { field: "aandachtspunten", label: "Aandachtspunten", section: "lesinhoud" },
  { field: "arrangement", label: "Veldafmetingen & opstelling", section: "materiaal" },
] as const satisfies readonly {
  field: keyof CreateLessonFormInput;
  label: string;
  section: "lesinhoud" | "materiaal" | null;
}[];

export const createLessonDefaultValues: CreateLessonFormInput = {
  title: "",
  lessonDate: "",
  learningLine: "",
  doelgroep: [],
  isPublic: true,
  movementProblem: "",
  movementTheme: "",
  baseMaterials: [],
  ruleMaterials: [],
  minParticipants: undefined,
  participantsBench: undefined,
  rules: [],
  goals: "",
  learningOutcomes: [],
  didacticItems: [],
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
  // Deprecated: vervangen door de doelgroep-chips (types/activity.ts's
  // DOELGROEP_LABELS) — niet meer ingevuld of getoond, kolom blijft bestaan
  // zodat bestaande activiteiten hun oude vrije-tekst-klasnaam behouden.
  group_name: string | null;
  movement_problem: string | null;
  movement_theme: string | null;
  learning_line: string | null;
  doelgroep: number[] | null;
  goals: string | null;
  learning_outcomes: string[] | null;
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
  // Legacy "Game-Based Pedagogy"-velden (spelcategorie/speldimensies) —
  // niet meer geschreven of getoond sinds de vervanging door de
  // Basisdocument-gebaseerde bewegingsthema/leerlijn-koppeling (zie
  // lib/constants/learningLines.ts), maar read-only bewaard voor bestaande
  // activiteiten die deze data nog hebben.
  game_category: string | null;
  game_dimensions: { space: string; equipment: string; people: string; rules: string } | null;
  tactical_questions: string[] | null;
  // Bepaalt of deze les meetelt voor de maandelijkse bijdrage-eis (zie
  // supabase/migrations/lesson_contribution_tracking.sql): alleen publieke,
  // zelf samengestelde (niet-AI) lessen tellen mee. `public_since` is het
  // moment waarop de les voor het laatst openbaar is gezet — bepaalt in
  // welke kalendermaand de bijdrage meetelt.
  is_ai_generated: boolean;
  public_since: string | null;
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
