import { z } from "zod";

import { didacticCategorySchema, didacticItemSchema } from "@/types/lesson";

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
