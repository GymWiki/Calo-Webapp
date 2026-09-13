// Pure tekstontleding voor de activiteit-detailpagina's nieuwe
// informatiehiërarchie ("scannen → begrijpen → uitvoeren"). Geen AI, geen
// nieuwe content — alleen structuur herkennen die al in de bestaande
// `beschrijving`/`deelnemers_regels`-tekst zit.
//
// Gebaseerd op een steekproef van alle 203 bibliotheek-activiteiten: 201
// van de 203 `beschrijving`-velden beginnen met een "Deelnemers:"-regel
// gevolgd door één of meer detailregels en een lege regel, en ALLE 203
// hebben verder minstens één alinea-scheiding (dubbele newline). Activiteiten
// die dit patroon niet volgen (bijv. "Sprinten - Achterhalen dominante
// been") vallen gewoon terug op de volledige tekst — nooit een crash, nooit
// verzonnen content.

export type ParsedActivityDescription = {
  /** Korte deelnemers-samenvatting voor de compacte info-strip — alleen
   *  gezet wanneer het "Deelnemers"-blok tot één korte regel herleidt. */
  participantsSummary: string | null;
  /** De losse detailregels van een "Deelnemers"-blok dat NIET kort genoeg
   *  was voor `participantsSummary` (bijv. een team-indeling) — als losse
   *  lijst tonen i.p.v. verstopt te laten in de doorlopende tekst. Mutueel
   *  exclusief met `participantsSummary`. */
  participantsDetail: string[] | null;
  /** De rest van de tekst, met het "Deelnemers:"-blok eruit geknipt zodra
   *  dat blok is herkend (ongeacht of het als chip of als lijst wordt
   *  getoond) — nooit dubbel getoond, nooit verloren. */
  bodyText: string;
};

const PARTICIPANTS_CHIP_MAX_LENGTH = 60;

export function parseActivityDescription(
  description: string | null | undefined,
): ParsedActivityDescription {
  const text = (description ?? "").trim();
  if (!text) {
    return { participantsSummary: null, participantsDetail: null, bodyText: "" };
  }

  if (!/^deelnemers\s*:?/i.test(text)) {
    return { participantsSummary: null, participantsDetail: null, bodyText: text };
  }

  const blankLineIndex = text.search(/\n[ \t]*\n/);
  const block = blankLineIndex === -1 ? text : text.slice(0, blankLineIndex);
  const rest = blankLineIndex === -1 ? "" : text.slice(blankLineIndex).trim();

  const detailLines = block
    .split("\n")
    .slice(1)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);

  // Geen bruikbare detailregels, of niets over na het knippen — dan is het
  // "Deelnemers"-blok niet betrouwbaar te scheiden van de rest; val terug
  // op de volledige, ongewijzigde tekst zodat er niets verdwijnt.
  if (detailLines.length === 0 || !rest) {
    return { participantsSummary: null, participantsDetail: null, bodyText: text };
  }

  const isShortSingleLine =
    detailLines.length === 1 && detailLines[0].length <= PARTICIPANTS_CHIP_MAX_LENGTH;

  if (isShortSingleLine) {
    return { participantsSummary: detailLines[0], participantsDetail: null, bodyText: rest };
  }

  return { participantsSummary: null, participantsDetail: detailLines, bodyText: rest };
}

/**
 * Splitst tekst op lege regels (alinea's) om als genummerde stappen te
 * tonen. Geeft null terug wanneer er niet genoeg natuurlijke structuur is —
 * de brief is expliciet: nooit een stappenindeling forceren op tekst die
 * daar niet voor gemaakt is. "Genoeg structuur" = minstens 2 alinea's die
 * elk op zichzelf een zin zijn (geen enkel fragment van een paar tekens).
 */
export function splitIntoSteps(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const paragraphs = trimmed
    .split(/\n[ \t]*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length < 2 || paragraphs.some((paragraph) => paragraph.length < 8)) {
    return null;
  }

  return paragraphs;
}

/**
 * Compacte "In het kort"-samenvatting: de eerste alinea van bestaande
 * tekst, afgekapt op een zin- of woordgrens. Genereert nooit nieuwe content
 * — bij lege input komt er null terug zodat de aanroeper de sectie
 * overslaat i.p.v. een lege kop te tonen.
 */
export function summarizeFirstParagraph(
  text: string | null | undefined,
  maxLength = 180,
): string | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;

  const firstParagraph = trimmed.split(/\n[ \t]*\n+/)[0]?.trim() ?? trimmed;
  if (firstParagraph.length <= maxLength) return firstParagraph;

  const truncated = firstParagraph.slice(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf("? "),
  );
  if (lastSentenceEnd > maxLength * 0.4) {
    return truncated.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}…`;
}
