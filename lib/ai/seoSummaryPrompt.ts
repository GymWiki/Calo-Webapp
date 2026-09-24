import { z } from "zod";

// Bewust een eigen, kleine invoervorm i.p.v. ActivityQualityCheckInput uit
// activityQualityCheck.ts hergebruiken: dat bestand heeft @/-aliased
// imports (knowledgeRetrieval, knowledgeUsageLogging, usageTracking) die
// niet oplossen onder de kale node-executie van
// scripts/backfill-activity-seo.mts (--experimental-strip-types kent geen
// tsconfig-paden) — zelfde reden als lib/ai/languageCheckPrompt.ts.
// activityQualityCheck.ts importeert vanuit DIT bestand (niet andersom),
// zodat de live check en het backfill-script exact dezelfde instructie/
// schema delen i.p.v. te kunnen uiteenlopen.
export type SeoSummaryInput = {
  titel: string;
  leerlijn: string;
  doel: string;
  beschrijving: string;
  categorie?: string;
  beginsituatie?: string;
  veld?: string;
  materiaal?: string[];
  regels?: string[];
};

export function buildSeoSummaryUserMessage(input: SeoSummaryInput): string {
  return [
    `Titel: ${input.titel}`,
    input.categorie ? `Categorie: ${input.categorie}` : null,
    `Leerlijn: ${input.leerlijn}`,
    `Doel: ${input.doel}`,
    input.beginsituatie ? `Beginsituatie: ${input.beginsituatie}` : null,
    `Beschrijving: ${input.beschrijving}`,
    input.veld ? `Veld: ${input.veld}` : null,
    input.materiaal?.length ? `Materiaal: ${input.materiaal.join(", ")}` : null,
    input.regels?.length ? `Regels: ${input.regels.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// Gedeelde kern-instructie voor wat een goede seo_summary is — gebruikt
// zowel binnen de gecombineerde live-check (activityQualityCheck.ts, één
// AI-call voor goed-/afkeuren + summary bij nieuwe inzendingen) als door
// het losse eenmalige backfill-script (waar de activiteit al goedgekeurd
// is, dus alleen de summary nog ontbreekt). Voedt de publieke
// /activiteiten/[slug]-pagina (zie
// supabase/migrations/activiteiten_public_seo.sql) als meta-description
// én als zichtbare tekst voor niet-ingelogde bezoekers/zoekmachines, dus
// mag NOOIT de volledige opbouw/speelregels/leerhulp verklappen — dat
// blijft achter de betaalmuur.
export const SEO_SUMMARY_CORE_INSTRUCTION =
  "Schrijf een seo_summary: 2-3 zinnen, 250-400 tekens, Nederlands. Beschrijft wat de leerlingen " +
  "doen, voor welke groep/doelgroep en met welk materiaal (of juist zonder materiaal) — gebruik " +
  "natuurlijke zoektermen die een leerkracht zelf zou typen (bijv. concrete spelnaam/-type, " +
  "groepsaanduiding als 'groep 5-6', 'zonder materiaal'), geen keyword stuffing (geen kunstmatige " +
  "opsomming van zoekwoorden). Verklap NOOIT de volledige opbouw/organisatie, speelregels, " +
  "varianten of leerhulp — dat is precies wat er achter de betaalmuur blijft; een lezer moet " +
  "nieuwsgierig blijven naar de uitwerking, niet 'm al kennen.";

export const SEO_SUMMARY_ONLY_SYSTEM_PROMPT =
  "Je schrijft korte, publieke samenvattingen voor GymWiki, een gedeelde activiteitenbibliotheek " +
  "voor bewegingsonderwijs. De activiteit hieronder is al goedgekeurd en staat (of komt) publiek in " +
  `de bibliotheek. ${SEO_SUMMARY_CORE_INSTRUCTION} ` +
  'Antwoord uitsluitend met geldige JSON: {"seo_summary": string}.';

export const seoSummaryOnlyResultSchema = z.object({ seo_summary: z.string() });
