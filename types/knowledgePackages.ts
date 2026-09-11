import { z } from "zod";

// Mirrors ALLOWED_KNOWLEDGE_MIME_TYPES/KNOWLEDGE_MAX_FILE_SIZE_BYTES
// (types/knowledge.ts) — same underlying extractDocumentText() support.
export const ALLOWED_PACKAGE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const PACKAGE_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const PACKAGE_PROCESSING_STATUSES = [
  "pending",
  "processing",
  "processed",
  "failed",
] as const;
export type PackageProcessingStatus = (typeof PACKAGE_PROCESSING_STATUSES)[number];

export type KnowledgePackage = {
  id: string;
  name: string;
  description: string | null;
  source_attribution: string | null;
  is_active: boolean;
  default_enabled: boolean;
  created_at: string;
};

export type KnowledgePackageWithPreference = KnowledgePackage & {
  enabled: boolean;
};

export type KnowledgePackageDocument = {
  id: string;
  package_id: string;
  title: string;
  original_file_url: string;
  file_type: string;
  processing_status: PackageProcessingStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgePackageWithDocuments = KnowledgePackage & {
  documents: KnowledgePackageDocument[];
};

export const createPackageInputSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht."),
  description: z.string().trim().optional(),
  sourceAttribution: z.string().trim().optional(),
});
export type CreatePackageInput = z.infer<typeof createPackageInputSchema>;

export const uploadPackageDocumentMetaSchema = z.object({
  packageId: z.string().uuid("Kies een geldig pakket."),
  title: z.string().trim().min(1, "Titel is verplicht."),
});
export type UploadPackageDocumentMeta = z.infer<typeof uploadPackageDocumentMetaSchema>;
