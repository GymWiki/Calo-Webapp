import { z } from "zod";

import { CHECK_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { CATEGORIE_WAARDEN, DOELGROEP_LABELS, DOELGROEP_WAARDEN } from "@/types/activity";

const rawExtractionSchema = z.object({
  isMovementActivity: z.boolean(),
  titel: z.string().trim().nullable(),
  categorie: z.string().trim().nullable(),
  leerlijn: z.string().trim().nullable(),
  doelgroep: z.array(z.number()).nullable(),
  beschrijving: z.string().trim().nullable(),
  beginsituatie: z.string().trim().nullable(),
  doel: z.string().trim().nullable(),
  veld: z.string().trim().nullable(),
  materiaal: z.array(z.string().trim()).nullable(),
  regels: z.array(z.string().trim()).nullable(),
});

export type ExtractedActivity = {
  isMovementActivity: boolean;
  titel: string | null;
  categorie: (typeof CATEGORIE_WAARDEN)[number] | null;
  leerlijn: string | null;
  doelgroep: number[] | null;
  beschrijving: string | null;
  beginsituatie: string | null;
  doel: string | null;
  veld: string | null;
  materiaal: string[] | null;
  regels: string[] | null;
};

const MAX_SOURCE_CHARS = 12000;

const SYSTEM_PROMPT =
  "Je zet een geüploade lesvoorbereiding (bewegingsonderwijs) om naar het GymWiki-activiteiten" +
  "formaat. Haal ALLEEN informatie op die daadwerkelijk in de tekst staat — verzin nooit een " +
  "titel, categorie, doelgroep of ander veld die je niet kunt onderbouwen uit de tekst. Laat een " +
  "veld op null staan als het niet met voldoende zekerheid is af te leiden; de gebruiker vult dat " +
  "daarna zelf aan vóór het indienen. " +
  `Kies voor "categorie" uitsluitend uit: ${CATEGORIE_WAARDEN.join(", ")} — of null als geen van ` +
  "deze duidelijk past. " +
  `Kies voor "doelgroep" uitsluitend codes uit deze lijst (mag meerdere): ${DOELGROEP_WAARDEN.map(
    (code) => `${code}=${DOELGROEP_LABELS[code]}`,
  ).join(", ")}. ` +
  'Zet "isMovementActivity" op false wanneer het document duidelijk geen bewegingsactiviteit of ' +
  "lesvoorbereiding bewegingsonderwijs bevat (bijv. een factuur, een heel ander vak, willekeurige " +
  "tekst) — vul in dat geval de overige velden met null. " +
  "Antwoord uitsluitend met geldige JSON in dit exacte formaat, zonder extra tekst of markdown-" +
  'opmaak: {"isMovementActivity": boolean, "titel": string|null, "categorie": string|null, ' +
  '"leerlijn": string|null, "doelgroep": number[]|null, "beschrijving": string|null, ' +
  '"beginsituatie": string|null, "doel": string|null, "veld": string|null, ' +
  '"materiaal": string[]|null, "regels": string[]|null}';

export type ExtractActivityResult = {
  activity: ExtractedActivity;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Losstaande AI-extractie/mapping-service: zet ruwe documenttekst (uit
 * lib/ai/documentText.ts) om naar de GymWiki-activiteitenstructuur. Bewust
 * hier geïsoleerd van app/api/ai/extract-activity/route.ts zodat dezelfde
 * mapping later voor andere import-functionaliteit hergebruikt kan worden.
 * Geeft ook de token-usage terug zodat de aanroepende route dit als echte
 * AI-kosten kan loggen (zie lib/ai/usageTracking.ts).
 */
export async function extractActivityFromText(
  sourceText: string,
): Promise<ExtractActivityResult> {
  const client = getOpenAIClient();
  const truncated =
    sourceText.length > MAX_SOURCE_CHARS ? sourceText.slice(0, MAX_SOURCE_CHARS) : sourceText;

  const completion = await client.chat.completions.create({
    model: CHECK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: truncated },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Geen antwoord van de AI-extractie ontvangen.");
  }

  const parsed = rawExtractionSchema.parse(JSON.parse(raw));

  // De AI-output valideren tegen de echte, vaste waardelijsten — een
  // gehallucineerde categorie/doelgroepcode wordt stilzwijgend null i.p.v.
  // een ongeldige waarde het formulier in te laten stromen.
  const categorie =
    parsed.categorie && (CATEGORIE_WAARDEN as readonly string[]).includes(parsed.categorie)
      ? (parsed.categorie as (typeof CATEGORIE_WAARDEN)[number])
      : null;

  const geldigeDoelgroep = (parsed.doelgroep ?? []).filter((code) =>
    (DOELGROEP_WAARDEN as readonly number[]).includes(code),
  );

  return {
    activity: {
      isMovementActivity: parsed.isMovementActivity,
      titel: parsed.titel || null,
      categorie,
      leerlijn: parsed.leerlijn || null,
      doelgroep: geldigeDoelgroep.length > 0 ? geldigeDoelgroep : null,
      beschrijving: parsed.beschrijving || null,
      beginsituatie: parsed.beginsituatie || null,
      doel: parsed.doel || null,
      veld: parsed.veld || null,
      materiaal: parsed.materiaal && parsed.materiaal.length > 0 ? parsed.materiaal : null,
      regels: parsed.regels && parsed.regels.length > 0 ? parsed.regels : null,
    },
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}
