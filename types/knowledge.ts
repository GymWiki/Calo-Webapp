import { z } from "zod";

export const KNOWLEDGE_STATUSES = ["pending", "processed", "failed"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

// Wat de app zelf uploadt naar Supabase Storage — een bewust smalle lijst
// (PDF/Word/tekst) die matcht met wat lib/ai/knowledgeProcessor.ts kan
// extraheren. Nieuwe bestandstypes vereisen dus zowel hier als daar een
// toevoeging.
export const ALLOWED_KNOWLEDGE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const KNOWLEDGE_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export type KnowledgeBaseDocument = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  file_url: string;
  file_type: string;
  uploaded_by: string;
  status: KnowledgeStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeBaseDocumentWithUploader = KnowledgeBaseDocument & {
  uploader_name: string;
};

// Metadata gevalideerd server-side; het bestand zelf komt via FormData en
// wordt apart gecontroleerd (type/grootte) in actions/knowledge.ts.
export const uploadKnowledgeDocumentMetaSchema = z.object({
  title: z.string().trim().min(1, "Titel is verplicht."),
  description: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type UploadKnowledgeDocumentMeta = z.infer<
  typeof uploadKnowledgeDocumentMetaSchema
>;

export type KnowledgeMatch = {
  id: string;
  document_id: string;
  document_title: string;
  content: string;
  similarity: number;
};
