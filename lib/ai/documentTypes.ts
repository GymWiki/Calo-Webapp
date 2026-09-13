// Losgetrokken uit lib/ai/documentText.ts: puur constanten, geen enkele
// zware afhankelijkheid (unpdf/mammoth/officeparser). Zo kan code die alleen
// deze validatie-waarden nodig heeft — met name "use server"-bestanden —
// ze importeren zonder de tekstextractie-implementatie mee te bundelen. Zie
// lib/ai/activityImportProcessor.ts voor waarom dat ertoe deed.
export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
] as const;

export const DOCUMENT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
