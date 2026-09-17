import { z } from "zod";

import { didacticCategorySchema, didacticItemSchema, type DidacticItem } from "@/types/lesson";

// ----------------------------------------------------------------------------
// AI Lescoach — POST /api/ai/analyze-lesson
//
// Herontworpen van "genereer een heel oordeel (score + samenvatting +
// verbeterpunten)" over de activiteit naar "kritisch meekijken en per sectie
// concrete, direct toepasbare suggesties geven op wat er al staat" — de
// gebruiker bouwt de activiteit zelf op en raadpleegt de Lescoach op elk
// moment voor gerichte aanvullingen, niet voor een nieuwe activiteit.
// ----------------------------------------------------------------------------

// Elke "content"-sectie die de AI Lescoach kan analyseren en waarop een
// suggestie kan slaan — komt 1-op-1 overeen met de secties op de activiteit-
// detailpagina/editor (components/activity-wizard-page.tsx, zie de
// `field-*`-id's daar) zodat een suggestie exact bij het juiste veld getoond
// en toegepast kan worden. Leerhulp (de 3 L'en) loopt bewust via een apart
// kanaal (didacticSuggestionSchema hieronder) — dat is geen los tekstveld
// maar een lijst gestructureerde items per categorie.
export const LESCOACH_SECTIONS = [
  "goals",
  "movementProblem",
  "learningOutcomes",
  "deelnemersRegels",
  "plaatjePraatje",
  "aandachtspunten",
  "rules",
  "arrangement",
  "baseMaterials",
  "ruleMaterials",
] as const;
export type LescoachSection = (typeof LESCOACH_SECTIONS)[number];
const lescoachSectionSchema = z.enum(LESCOACH_SECTIONS);

// Lijst-secties: "Toepassen" VOEGT het voorstel TOE als nieuw item. Alle
// overige (tekst-)secties: "Toepassen" VERVANGT de huidige tekst door het
// voorstel — beide gedragen zich dus voorspelbaar zonder dat de AI zelf een
// diff/patch-formaat hoeft te produceren.
export const LESCOACH_LIST_SECTIONS: readonly LescoachSection[] = [
  "learningOutcomes",
  "rules",
  "baseMaterials",
  "ruleMaterials",
];

// Deliberately loose/partial: dit wordt aangeroepen vanuit de lesbouwer
// mid-concept, dus niet elk veld is al ingevuld. Ontbrekende velden
// betekenen NIET per se "leeg" — bij een vervolg-aanroep (isFollowUp) is een
// ontbrekend veld "ongewijzigd sinds de vorige analyse", zie hieronder.
export const analyzeLessonInputSchema = z.object({
  title: z.string().trim().optional(),
  learningLine: z.string().trim().optional(),
  movementProblem: z.string().trim().optional(),
  movementTheme: z.string().trim().optional(),
  doelgroep: z.array(z.number().int()).optional(),
  goals: z.string().trim().optional(),
  learningOutcomes: z.array(z.string()).optional(),
  deelnemersRegels: z.string().trim().optional(),
  plaatjePraatje: z.string().trim().optional(),
  aandachtspunten: z.string().trim().optional(),
  rules: z.array(z.string()).optional(),
  arrangement: z.string().trim().optional(),
  baseMaterials: z.array(z.string()).optional(),
  ruleMaterials: z.array(z.string()).optional(),
  minParticipants: z.coerce.number().int().positive().optional(),
  participantsBench: z.coerce.number().int().min(0).optional(),
  didacticItems: z.array(didacticItemSchema).optional(),
  // Alleen gezet wanneer dit een al bestaande (opgeslagen) activiteit is —
  // gebruikt om de gebruikte Kennisbank-fragmenten te loggen
  // (activity_knowledge_usage, context='lescoach'). De route verifieert
  // server-side dat de aanroeper ook daadwerkelijk de auteur is voordat er
  // iets gelogd wordt — zie app/api/ai/analyze-lesson/route.ts.
  // Géén .uuid(): activiteiten.id is text, en oudere bibliotheek-activiteiten
  // hebben een numeriek id (bijv. "1003"), geen UUID.
  activityId: z.string().trim().min(1).optional(),
  // Kostenbeheersing (AI Lescoach wordt vermoedelijk vaker aangeroepen dan de
  // eenmalige generator): bij een HERHAALDE aanroep op dezelfde activiteit
  // stuurt de client alleen de secties die daadwerkelijk gewijzigd zijn sinds
  // de vorige aanroep (de overige velden hierboven blijven dan gewoon weg —
  // niet leeg meesturen) + deze compacte samenvatting van eerder gegeven
  // suggestietypes, zodat de AI niet zomaar exact dezelfde suggestie herhaalt
  // én de inputgrootte bij herhaald gebruik laag blijft.
  isFollowUp: z.boolean().optional(),
  previousSuggestionTypes: z
    .array(z.object({ section: lescoachSectionSchema, type: z.string() }))
    .optional(),
});
export type AnalyzeLessonInput = z.infer<typeof analyzeLessonInputSchema>;

export const lescoachSuggestionSchema = z.object({
  section: lescoachSectionSchema,
  // Vrije, AI-gekozen categorie-label (bijv. "Groepsgrootte",
  // "Veiligheid", "Concreetheid", "Aansluiting doel-leeruitkomst") — bewust
  // geen vaste enum: de AI bepaalt flexibel wat de activiteit daadwerkelijk
  // nodig heeft, geen vaste checklist met altijd hetzelfde aantal/soort
  // suggesties.
  type: z.string().trim().min(1),
  // Voor tekstsecties: de volledige voorgestelde vervangende tekst (geen
  // diff). Voor lijstsecties (LESCOACH_LIST_SECTIONS): één nieuw toe te
  // voegen item.
  suggestion: z.string().trim().min(1),
  reasoning: z.string().trim().min(1),
  sourceLabel: z.string().trim().optional(),
});
export type LescoachSuggestion = z.infer<typeof lescoachSuggestionSchema> & {
  /** Client-side toegekend (niet door de AI) — voor Toepassen/Negeren. */
  id: string;
};

// Leerhulp krijgt 2-3 ALTERNATIEVE varianten per categorie i.p.v. één vaste
// invulling (zie de brief) — een los kanaal, want dit zijn geen tekst-
// suggesties voor een bestaand veld maar kandidaat-items voor een lijst die
// per categorie al meerdere bestaande items kan bevatten.
export const didacticSuggestionSchema = z.object({
  category: didacticCategorySchema,
  observation: z.string().trim().min(1),
  action: z.string().trim().min(1),
  reasoning: z.string().trim().min(1),
});
export type DidacticSuggestion = z.infer<typeof didacticSuggestionSchema> & { id: string };

export const lescoachAnalysisSchema = z.object({
  suggestions: z.array(lescoachSuggestionSchema).optional().default([]),
  didacticSuggestions: z.array(didacticSuggestionSchema).optional().default([]),
});
export type LescoachAnalysis = z.infer<typeof lescoachAnalysisSchema>;

// ----------------------------------------------------------------------------
// AI Activiteiten Generator — POST /api/ai/generate-activity
// ----------------------------------------------------------------------------

export const generateActivityInputSchema = z.object({
  learningLine: z.string().trim().min(1, "Kies een leerlijn."),
  targetGroup: z.string().trim().min(1, "Vul een doelgroep in."),
  // Het concrete "decor" (sport/onderwerp) waarbinnen de leerlijn wordt
  // beoefend — zie lib/constants/sportTopics.ts. Zonder dit bleef de AI
  // gokken tussen willekeurige sporten binnen dezelfde leerlijn, wat tot
  // een vage, generieke opzet leidde i.p.v. één scherp afgebakende
  // activiteit.
  topic: z.string().trim().min(1, "Kies een onderwerp/sport."),
  // De gekozen leeruitkomst(en) — minstens 1 vereist, uit de leerlijn-
  // specifieke catalogus (leerlijn_leeruitkomsten) en/of het vrije "Anders,
  // namelijk"-veld. Deze sturen de hele generatie EN worden na generatie
  // deterministisch (niet AI-geraden) in de output overgenomen — zie
  // generate-activity/route.ts.
  learningOutcomes: z
    .array(z.string().trim().min(1))
    .min(1, "Kies minstens één leeruitkomst, of vul 'Anders, namelijk' in."),
  // Optionele aanvullende context — puur om de generatie realistischer te
  // maken (groepsgrootte, omgeving, beschikbaar materiaal); wordt niet 1-op-1
  // teruggegeven als apart outputveld.
  minParticipants: z.coerce.number().int().positive().optional(),
  participantsBench: z.coerce.number().int().min(0).optional(),
  location: z.enum(["binnen", "buiten"]).optional(),
  availableMaterials: z.array(z.string().trim().min(1)).optional().default([]),
});
export type GenerateActivityInput = z.infer<typeof generateActivityInputSchema>;

// What the AI itself must produce — `id` is assigned server-side after
// validation so the response can be used as real DidacticItem[] directly.
export const generatedLessonSchema = z.object({
  title: z.string(),
  learningLine: z.string(),
  movementProblem: z.string(),
  movementTheme: z.string(),
  doelgroep: z.array(z.number().int()).optional().default([]),
  goals: z.string(),
  didacticItems: z.array(didacticItemSchema.omit({ id: true })).optional().default([]),
  baseMaterials: z.array(z.string()).optional().default([]),
  ruleMaterials: z.array(z.string()).optional().default([]),
  rules: z.array(z.string()).optional().default([]),
  arrangement: z.string().optional().default(""),
  deelnemersRegels: z.string().optional().default(""),
  plaatjePraatje: z.string().optional().default(""),
  aandachtspunten: z.string().optional().default(""),
});
export type GeneratedLesson = z.infer<typeof generatedLessonSchema>;

// The shape actually returned to the client: same as GeneratedLesson but
// with real ids on each didactic item, plus `learningOutcomes` — NOT part of
// generatedLessonSchema (the AI never produces this itself, see
// generate-activity/route.ts): deterministically copied server-side from the
// user's own leeruitkomst-selectie (generateActivityInputSchema), so this
// section is guaranteed non-empty and matches exactly what was chosen.
export type GeneratedLessonWithIds = Omit<GeneratedLesson, "didacticItems"> & {
  didacticItems: DidacticItem[];
  learningOutcomes: string[];
};

// sessionStorage key the /les-maken AI wizard (AiLessonWizard) writes to
// and LessonForm reads from, to hand off an AI-generated lesson to the
// form when LesMakenFlow switches views, without threading it through props.
export const AI_GENERATED_LESSON_STORAGE_KEY = "gymbase-ai-generated-lesson";

// Losse key naast AI_GENERATED_LESSON_STORAGE_KEY: de bron-attributie
// ("Gebaseerd op: eigen kennisbank (3), Athletic Skills Model (2)") bij een
// AI-generatie — apart gehouden i.p.v. in de les zelf, zodat
// LessonForm's bestaande GeneratedLessonWithIds-vorm ongemoeid blijft.
export const AI_GENERATED_LESSON_SOURCES_STORAGE_KEY = "gymbase-ai-generated-lesson-sources";

// Volledige (niet-samengevatte) gebruikte fragmenten bij dezelfde generatie
// — apart van AI_GENERATED_LESSON_SOURCES_STORAGE_KEY (dat alleen de
// samengevatte "N bronnen"-telling bevat) zodat LessonForm de complete
// UsedKnowledgeChunk[]-vorm kan doorgeven aan createLesson/saveLessonDraft
// voor brontracking (activity_knowledge_usage, context='generate') zodra de
// activiteit daadwerkelijk wordt opgeslagen.
export const AI_GENERATED_LESSON_CHUNKS_STORAGE_KEY = "gymbase-ai-generated-lesson-chunks";
