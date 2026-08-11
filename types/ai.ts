import { z } from "zod";

import {
  didacticItemSchema,
  gameDimensionsSchema,
  type DidacticItem,
} from "@/types/lesson";

// ----------------------------------------------------------------------------
// AI Lescoach — POST /api/ai/analyze-lesson
// ----------------------------------------------------------------------------

// Deliberately loose/partial: this is called from the lesbouwer mid-draft,
// before every field is necessarily filled in yet.
export const analyzeLessonInputSchema = z.object({
  title: z.string().trim().optional(),
  learningLine: z.string().trim().optional(),
  movementProblem: z.string().trim().optional(),
  movementTheme: z.string().trim().optional(),
  goals: z.string().trim().optional(),
  didacticItems: z.array(didacticItemSchema).optional(),
  gameCategory: z.string().trim().optional(),
  gameDimensions: gameDimensionsSchema.partial().optional(),
  tacticalQuestions: z.array(z.string()).optional(),
});
export type AnalyzeLessonInput = z.infer<typeof analyzeLessonInputSchema>;

export const lescoachImprovementSchema = z.object({
  category: z.string(),
  suggestion: z.string(),
});
export type LescoachImprovement = z.infer<typeof lescoachImprovementSchema>;

export const lescoachFeedbackSchema = z.object({
  score: z.number().min(0).max(10),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(lescoachImprovementSchema),
});
export type LescoachFeedback = z.infer<typeof lescoachFeedbackSchema>;

// Maps a Dutch improvement category label (as the AI writes it, e.g. "Lukt
// 't") onto the app's canonical didactic category key — best-effort, used
// by "Pas automatisch toe" to file a suggestion under the right L.
export function matchDidacticCategory(
  category: string,
): "loopt_het" | "lukt_het" | "leeft_het" | null {
  const normalized = category.toLowerCase();
  if (normalized.includes("loopt")) return "loopt_het";
  if (normalized.includes("lukt")) return "lukt_het";
  if (normalized.includes("leeft")) return "leeft_het";
  return null;
}

// ----------------------------------------------------------------------------
// AI Activiteiten Generator — POST /api/ai/generate-activity
// ----------------------------------------------------------------------------

// No user-facing spelcategorie field — the server derives whether
// Game-Based Pedagogy applies from `learningLine` via isGameDomain().
export const generateActivityInputSchema = z.object({
  learningLine: z.string().trim().min(1, "Kies een leerlijn."),
  targetGroup: z.string().trim().min(1, "Vul een doelgroep in."),
});
export type GenerateActivityInput = z.infer<typeof generateActivityInputSchema>;

// What the AI itself must produce — `id` is assigned server-side after
// validation so the response can be used as real DidacticItem[] directly.
export const generatedLessonSchema = z.object({
  title: z.string(),
  learningLine: z.string(),
  movementProblem: z.string(),
  movementTheme: z.string(),
  groupName: z.string().optional().default(""),
  goals: z.string(),
  gameCategory: z.string().optional().default(""),
  gameDimensions: gameDimensionsSchema.partial().optional(),
  tacticalQuestions: z.array(z.string()).optional().default([]),
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
// with real ids on each didactic item.
export type GeneratedLessonWithIds = Omit<GeneratedLesson, "didacticItems"> & {
  didacticItems: DidacticItem[];
};

// sessionStorage key AiGeneratorDialog writes to and the les-maken form
// reads from, to hand off an AI-generated lesson across a client-side
// navigation without a huge query string.
export const AI_GENERATED_LESSON_STORAGE_KEY = "gymbase-ai-generated-lesson";
