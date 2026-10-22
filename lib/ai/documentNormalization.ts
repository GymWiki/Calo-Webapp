import { OfficeParser } from "officeparser";
import type { OfficeMimeType, SupportedFileType } from "officeparser";

// Herbouw van "Activiteit uit document": geen externe conversiedienst
// (CloudConvert/Gotenberg zijn bewust afgewezen — nieuwe betaalde/zelf-
// gehoste afhankelijkheid, past niet bij dit project se serverless/geen-
// nieuwe-infra-discipline, zie het ffmpeg/pdf.worker.mjs-voorgeschiedenis-
// commentaar elders in lib/ai/). In plaats daarvan twee onafhankelijke paden:
//
// 1. PDF/foto's gaan ONGEWIJZIGD (geen eigen tekst-/rasterextractie) als
//    bestand/afbeelding naar OpenAI's Responses API (`input_file`/
//    `input_image`, zie activityImportExtraction.ts) — een GPT-4o-klasse
//    model leest zelf tekst ÉN pagina-lay-out (tabellen, kolommen,
//    plattegronden) uit een PDF, en scant een foto van een papieren
//    lesbrief net zo goed via zijn eigen vision-vermogen. Geen eigen
//    PDF-rasterizer nodig (en dus niet het bekende pdf.worker.mjs-
//    file-tracer-risico van pdfjs-dist-achtige packages, zie
//    lib/ai/documentText.ts's commentaar over diezelfde valkuil).
// 2. docx/pptx/odt gaan via `officeparser` (al een dependency — momenteel
//    alleen voor pptx/pdf gebruikt in lib/ai/documentText.ts) se
//    `.to("md")`-generator: behoudt tabellen/koppen/lijst-/dia-structuur als
//    markdown, een veel sterker structuursignaal voor het model dan platte
//    tekst. `extractAttachments: true` haalt ingesloten afbeeldingen
//    (plattegronden, foto's) los uit het document, base64-gecodeerd, zonder
//    dat daar een aparte zip-parser (jszip e.d.) voor nodig is.
//
// Bewust een LOS bestand van lib/ai/documentText.ts — dat blijft ongewijzigd
// (mammoth voor docx) voor Kennisbank/Standaardbibliotheek, om die paden niet
// mee te laten veranderen door deze herbouw.
export const SUPPORTED_IMPORT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
] as const;

export const IMPORT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const OFFICEPARSER_FILE_TYPES: Record<string, SupportedFileType> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
};

// Raster-afbeeldingsformaten die direct als <img>/canvas-achtergrond te tonen
// zijn. Vector/metabestandformaten (svg/emf/wmf) bewust overgeslagen: svg
// alleen renderbaar via `dangerouslyAllowSVG` (CLAUDE.md's bestaande
// XSS-afweging om dat NIET te doen), emf/wmf zijn sowieso niet
// browser-renderbaar.
const DISPLAYABLE_ATTACHMENT_MIME_TYPES: ReadonlySet<OfficeMimeType> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/bmp",
]);

export type NormalizedImportInput =
  | { kind: "file"; mimeType: "application/pdf"; base64: string; filename: string }
  | { kind: "image"; mimeType: "image/jpeg" | "image/png"; base64: string }
  | { kind: "text"; text: string };

export type ExtractedAttachment = { mimeType: string; base64: string };

export class ImportNormalizationError extends Error {}

/**
 * Zet een geüpload document/foto om naar de vorm die
 * `extractActivityFromDocument` naar OpenAI stuurt, plus de ingesloten
 * afbeeldingen (indien aanwezig) als losse bijlagen. Gooit
 * `ImportNormalizationError` met een gebruikersvriendelijke Nederlandse
 * melding bij een onleesbaar/corrupt bestand — de aanroeper hoeft dan alleen
 * de job te laten falen, niet zelf te interpreteren wat er mis ging.
 */
export async function normalizeForImport(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<{ input: NormalizedImportInput; attachments: ExtractedAttachment[] }> {
  if (mimeType === "application/pdf") {
    return { input: { kind: "file", mimeType, base64: buffer.toString("base64"), filename }, attachments: [] };
  }

  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return { input: { kind: "image", mimeType, base64: buffer.toString("base64") }, attachments: [] };
  }

  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    // Al platte/markdown-tekst — geen structuur te winnen door dit alsnog
    // door officeparser te halen.
    return { input: { kind: "text", text: buffer.toString("utf-8") }, attachments: [] };
  }

  const fileType = OFFICEPARSER_FILE_TYPES[mimeType];
  if (!fileType) {
    throw new ImportNormalizationError(`Bestandstype "${mimeType}" wordt niet ondersteund.`);
  }

  try {
    const ast = await OfficeParser.parseOffice(buffer, { fileType, extractAttachments: true });
    const { value: markdown } = await ast.to("md");
    const attachments: ExtractedAttachment[] = ast.attachments
      .filter((attachment) => DISPLAYABLE_ATTACHMENT_MIME_TYPES.has(attachment.mimeType))
      .map((attachment) => ({ mimeType: attachment.mimeType, base64: attachment.data }));
    return { input: { kind: "text", text: markdown }, attachments };
  } catch (cause) {
    console.error(`normalizeForImport: parsen van "${filename}" (${mimeType}) mislukt:`, cause);
    throw new ImportNormalizationError(
      "Kon dit bestand niet lezen. Probeer een ander bestand of vul de activiteit handmatig in.",
    );
  }
}
