import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { OfficeParser } from "officeparser";

// Gedeelde tekstextractie voor elke plek waar een gebruiker een document
// uploadt dat als platte tekst verder verwerkt moet worden — nu de
// Kennisbank (lib/ai/knowledgeProcessor.ts), de Standaardbibliotheek
// (lib/ai/knowledgePackageProcessor.ts) en de "Activiteit toevoegen"-
// bestandsimport (lib/ai/activityImportExtraction.ts). Eén plek zodat een
// nieuw ondersteund bestandstype niet op meerdere plekken los bijgehouden
// hoeft te worden.
export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
] as const;

export const DOCUMENT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const PDF_EXTRACTION_ERROR =
  "Kon geen tekst uit dit PDF-bestand halen. Probeer een ander bestand of neem contact op.";

/**
 * Extraheert platte tekst uit een geüpload bestand. Geen OCR: een gescand
 * document (afbeelding zonder tekstlaag) levert lege/vrijwel lege tekst op
 * — de aanroeper moet dat zelf detecteren en de gebruiker doorverwijzen
 * naar handmatig invullen.
 *
 * PDF gaat via `unpdf` (i.p.v. het eerder gebruikte pdf-parse/pdfjs-dist
 * rechtstreeks) — die package bundelt een specifiek voor serverless/edge-
 * omgevingen gecompileerde PDF.js-build, zonder los worker-bestand. De
 * gewone pdfjs-dist Node-build probeert bij het parsen altijd een
 * `pdf.worker.mjs` te laden; Vercel's file-tracer neemt dat bestand niet
 * betrouwbaar mee in de serverless function, wat gaf: "Setting up fake
 * worker failed: Cannot find module '.../pdf.worker.mjs'". unpdf's
 * serverless-build heeft dat probleem niet (en heeft, voor pure
 * tekstextractie, ook geen DOMMatrix-polyfill nodig — zie de eerdere,
 * inmiddels overbodig geworden lib/ai/domMatrixPolyfill.ts-geschiedenis).
 */
export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    } catch (cause) {
      console.error("extractDocumentText: PDF-extractie mislukt:", cause);
      throw new Error(PDF_EXTRACTION_ERROR);
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
