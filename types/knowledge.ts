import { z } from "zod";

export const KNOWLEDGE_CATEGORIES = [
  "basisdocument",
  "game_based_pedagogy",
  "3L_model",
  "beoordeling",
  "overig",
] as const;

export const knowledgeCategorySchema = z.enum(KNOWLEDGE_CATEGORIES);
export type KnowledgeCategory = z.infer<typeof knowledgeCategorySchema>;

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  basisdocument: "Basisdocument Bewegingsonderwijs",
  game_based_pedagogy: "Game-Based Pedagogy",
  "3L_model": "3L-model (Walinga & Koekoek)",
  beoordeling: "Beoordeling",
  overig: "Overig",
};

export const createKnowledgeDocumentInputSchema = z.object({
  title: z.string().trim().min(1, "Titel is verplicht."),
  author: z.string().trim().optional(),
  category: knowledgeCategorySchema,
  content: z
    .string()
    .trim()
    .min(50, "Voeg minimaal 50 tekens tekst toe zodat er iets te chunken valt."),
});

export type CreateKnowledgeDocumentInput = z.infer<
  typeof createKnowledgeDocumentInputSchema
>;

export type KnowledgeDocument = {
  id: string;
  title: string;
  author: string | null;
  category: KnowledgeCategory;
  uploaded_by: string | null;
  created_at: string;
};

export type KnowledgeDocumentWithChunkCount = KnowledgeDocument & {
  chunk_count: number;
};

export type KnowledgeChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  created_at: string;
};

export type KnowledgeMatch = {
  id: string;
  document_id: string;
  document_title: string;
  content: string;
  similarity: number;
};

export const testLescoachQueryInputSchema = z.object({
  query: z.string().trim().min(3, "Stel een vraag van minimaal 3 tekens."),
});

export type TestLescoachQueryInput = z.infer<typeof testLescoachQueryInputSchema>;
