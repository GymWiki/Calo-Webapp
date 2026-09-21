import type { MetadataRoute } from "next";

// Disallow-lijst spiegelt proxy.ts's PROTECTED_PREFIXES (+ /beheer, altijd
// admin-only, en /api): die pagina's redirecten anonieme bezoekers/crawlers
// toch naar /login, dus laten crawlen heeft geen nut en kan zoekmachines
// verwarren over wat de "echte" inhoud van de site is. /les/share is bewust
// wél toegestaan — dat is proxy.ts's eigen publieke uitzondering (gedeelde
// lesplannen zonder inlog bekijkbaar) — Google's robots.txt-parser kiest de
// specifiekste (langste) matchende regel, dus deze Allow wint van de
// bredere "/les" Disallow hierboven.
const BASE_URL = "https://www.gymwiki.nl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/les/share"],
      disallow: [
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
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
