import type { MetadataRoute } from "next";

// Disallow-lijst spiegelt proxy.ts's PROTECTED_PREFIXES (+ /beheer, altijd
// admin-only, en /api): die pagina's redirecten anonieme bezoekers/crawlers
// toch naar /login, dus laten crawlen heeft geen nut en kan zoekmachines
// verwarren over wat de "echte" inhoud van de site is. /les/share is bewust
// wél toegestaan — dat is proxy.ts's eigen publieke uitzondering (gedeelde
// lesplannen zonder inlog bekijkbaar).
//
// /activiteiten (meervoud, de nieuwe publieke SEO-oppervlakte uit deze
// brief) moet EXPLICIET in de allow-lijst staan, ondanks dat "/activiteit"
// (enkelvoud, de bestaande ingelogde detailpagina) hieronder disallowed is:
// robots.txt-matching is een letterlijke PREFIX-match, dus zonder deze
// regel zou "/activiteit" ook "/activiteiten/tikspel" blokkeren. Google's
// parser kiest bij een conflict de LANGSTE (specifiekste) matchende regel —
// "/activiteiten" (13 tekens) wint dus van "/activiteit" (11 tekens).
// Zelfde reden voor /leerlijn en /groep: die staan niet in de
// disallow-lijst, maar worden hier toch expliciet toegestaan voor de
// leesbaarheid/intentie.
const BASE_URL = "https://www.gymwiki.nl";

const PUBLIC_ALLOW = [
  "/",
  "/les/share",
  "/activiteiten",
  "/leerlijn",
  "/groep",
  "/over-gymwiki",
];

const PROTECTED_DISALLOW = [
  "/dashboard",
  "/les-maken",
  "/les",
  "/activiteit",
  "/zoeken",
  "/kennisbank",
  "/profiel",
  "/toernooi",
  "/pro",
  "/beheer",
  "/api",
];

// Naast de generieke "*"-regel ook expliciet genoemd, zoals gevraagd —
// functioneel identiek aan de "*"-regel (zelfde allow/disallow), maar
// maakt de toestemming voor deze specifieke crawlers auditeerbaar i.p.v.
// impliciet via de catch-all.
const NAMED_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: PUBLIC_ALLOW,
        disallow: PROTECTED_DISALLOW,
      },
      {
        userAgent: NAMED_CRAWLERS,
        allow: PUBLIC_ALLOW,
        disallow: PROTECTED_DISALLOW,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
