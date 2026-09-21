import type { MetadataRoute } from "next";

// Alleen routes die zonder ingelogde sessie bereikbaar zijn (zie proxy.ts's
// PROTECTED_PREFIXES) horen hierin: al het overige (dashboard, bibliotheek,
// activiteiten, kennisbank, profiel, ...) redirect anonieme bezoekers en
// crawlers naar /login, wat search engines als een slechte/onbetrouwbare
// pagina kunnen zien als het toch in de sitemap staat.
const BASE_URL = "https://www.gymwiki.nl";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
