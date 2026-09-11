// Moet vóór de "pdf-parse"-import staan — zie domMatrixPolyfill.ts.
import "@/lib/ai/domMatrixPolyfill";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { OfficeParser } from "officeparser";

// Gedeelde tekstextractie voor elke plek waar een gebruiker een document
// uploadt dat als platte tekst verder verwerkt moet worden — nu de
// Kennisbank (lib/ai/knowledgeProcessor.ts) en de "Activiteit toevoegen"-
// bestandsimport (lib/ai/activityImportExtraction.ts). Eén plek zodat een
// nieuw ondersteund bestandstype niet op twee plekken los bijgehouden hoeft
// te worden.
export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
] as const;

export const DOCUMENT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Extraheert platte tekst uit een geüpload bestand. Geen OCR: een gescand
 * document (afbeelding zonder tekstlaag) levert lege/vrijwel lege tekst op
 * — de aanroeper moet dat zelf detecteren en de gebruiker doorverwijzen
 * naar handmatig invullen.
 */
export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    const ast = await OfficeParser.parseOffice(buffer, { fileType: "pptx" });
    return ast.toText();
  }

  throw new Error(`Bestandstype "${mimeType}" wordt niet ondersteund.`);
}
