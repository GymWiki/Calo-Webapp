import { z } from "zod";

// Bewust een op zichzelf staande module ZONDER verdere relatieve imports
// (alleen het "zod"-npm-package) — dit is het enige stuk van de taalcheck
// dat scripts/taalcheck-batch.mts rechtstreeks importeert via
// `node --experimental-strip-types` (dat geen tsconfig-paden/aliassen kent
// en dus alleen een importketen zonder extensieloze relatieve imports kan
// volgen). lib/ai/languageCheck.ts (de Next.js-app-kant, met de eigenlijke
// OpenAI-aanroep + ai_usage-logging) importeert dezelfde constanten
// vandaan, zodat de prompt/velden-lijst maar op één plek gedefinieerd
// staan.

// Alle tekstvelden op `activiteiten` die de taalcheck aanpakt. `isArray`
// bepaalt of de waarde als text[] (loopt/lukt/leeft/regels/materiaal) of
// als plat tekstveld wordt behandeld; overige velden (titel, veld,
// arrangement, ...) blijven bewust buiten scope — die stonden niet in de
// opgegeven veldenlijst.
export const LANGUAGE_CHECK_FIELDS = [
  { field: "doel", isArray: false },
  { field: "beginsituatie", isArray: false },
  { field: "beschrijving", isArray: false },
  { field: "aandachtspunten", isArray: false },
  { field: "deelnemers_regels", isArray: false },
  { field: "plaatje_praatje", isArray: false },
  { field: "loopt", isArray: true },
  { field: "lukt", isArray: true },
  { field: "leeft", isArray: true },
  { field: "regels", isArray: true },
  { field: "materiaal", isArray: true },
] as const;

export type LanguageCheckField = (typeof LANGUAGE_CHECK_FIELDS)[number]["field"];

export const languageCheckResultSchema = z.object({
  changed: z.boolean(),
  correctedText: z.string(),
  reason: z.string(),
});

export type LanguageCheckResponse = z.infer<typeof languageCheckResultSchema>;

// Array-velden worden vóór verzending naar één platte tekst omgezet (één
// item per regel) zodat er maar één prompt/schema nodig is voor zowel
// tekst- als lijstvelden — bij het toepassen van een voorstel wordt een
// array-veld weer teruggesplitst op regels.
export function arrayFieldToText(items: string[]): string {
  return items.join("\n");
}

export function textToArrayField(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export const LANGUAGE_CHECK_SYSTEM_PROMPT = `Je bent een Nederlandstalige eindredacteur voor GymWiki, een gedeelde \
activiteitenbibliotheek voor docenten bewegingsonderwijs (ALO/CALO). Je krijgt telkens ÉÉN \
tekstveld uit één activiteit.

Taak:
- Corrigeer spelling- en grammaticafouten.
- Herschrijf onduidelijke, houterige of onlogische formuleringen naar heldere, natuurlijke \
Nederlandse tekst — gericht op docenten bewegingsonderwijs, in dezelfde beknopte, praktische \
toon als de rest van de bibliotheek (korte, directe zinnen, geen overbodige opsmuk).
- Verander NOOIT de inhoudelijke betekenis, sportregels of feitelijke inhoud — alleen taal/\
verwoording. Voeg geen nieuwe informatie toe en laat geen bestaande informatie weg.
- Bij een tekst met meerdere regels (één item per regel): geef exact evenveel regels terug, \
in dezelfde volgorde, één gecorrigeerd item per regel. Voeg geen regels toe of weg, en voeg \
nooit meerdere items samen tot één regel.
- Bij twijfel of de tekst al correct/duidelijk genoeg is: laat 'm ongewijzigd (zet changed op \
false en correctedText gelijk aan de oorspronkelijke tekst). Geen onnodige herschrijvingen die \
geen taalprobleem oplossen — kleine stijlvoorkeuren zijn geen reden om te wijzigen.
- Een leeg of zeer kort veld (bijv. één woord) hoeft niet per se aangepast te worden.

Antwoord uitsluitend met geldige JSON: {"changed": boolean, "correctedText": string, "reason": \
string} — reason is een korte Nederlandse toelichting (1 zin) van wat er gewijzigd is (of, bij \
changed=false, dat de tekst al in orde was).`;
