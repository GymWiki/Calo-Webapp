import type { MetadataRoute } from "next";

import { getAllPublicActivities, getGroepSlug, getLeerlijnSlug } from "@/lib/services/publicActivities";

// Dynamisch: alle indexeerbare activiteiten + categoriepagina's, plus de
// handvol statische publieke routes die al bestonden. Alleen routes die
// zonder ingelogde sessie bereikbaar zijn (zie proxy.ts's
// PROTECTED_PREFIXES) horen hierin — al het overige redirect anonieme
// bezoekers/crawlers naar /login, wat search engines als een slechte/
// onbetrouwbare pagina kunnen zien als het toch in de sitemap staat.
//
// getAllPublicActivities() leest public.activiteiten_publiek (zie
// supabase/migrations/activiteiten_public_seo.sql) — DIE view is de
// indexeerbaarheidsregel (STAP 5), dus elke rij die hier binnenkomt is per
// definitie een geldige, indexeerbare URL. lastModified komt uit
// public_since (wanneer de activiteit voor het laatst publiek is gezet) met
// created_at als fallback voor het zeldzame geval dat public_since ontbreekt.
const BASE_URL = "https://www.gymwiki.nl";
const MIN_COMBO_ACTIVITIES = 5;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const activities = await getAllPublicActivities();

  const activityUrls: MetadataRoute.Sitemap = activities.map((activity) => ({
    url: `${BASE_URL}/activiteiten/${activity.slug}`,
    lastModified: new Date(activity.public_since ?? activity.created_at),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Leerlijnen: laatst-gewijzigd = de meest recente activiteit binnen die
  // leerlijn, zodat een nieuwe/gewijzigde activiteit ook de categoriepagina
  // als "gewijzigd" markeert.
  const leerlijnLastModified = new Map<string, Date>();
  const leerlijnLabelBySlug = new Map<string, string>();
  for (const activity of activities) {
    if (!activity.leerlijn) continue;
    const slug = getLeerlijnSlug(activity.leerlijn);
    leerlijnLabelBySlug.set(slug, activity.leerlijn);
    const modified = new Date(activity.public_since ?? activity.created_at);
    const current = leerlijnLastModified.get(slug);
    if (!current || modified > current) leerlijnLastModified.set(slug, modified);
  }
  const leerlijnUrls: MetadataRoute.Sitemap = [...leerlijnLastModified.entries()].map(
    ([slug, lastModified]) => ({
      url: `${BASE_URL}/leerlijn/${slug}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    }),
  );

  // Groepen: vaste 6 codes, alleen opgenomen als er daadwerkelijk publieke
  // activiteiten voor zijn.
  const groepLastModified = new Map<number, Date>();
  for (const activity of activities) {
    const modified = new Date(activity.public_since ?? activity.created_at);
    for (const code of activity.doelgroep ?? []) {
      const current = groepLastModified.get(code);
      if (!current || modified > current) groepLastModified.set(code, modified);
    }
  }
  const groepUrls: MetadataRoute.Sitemap = [];
  for (const [code, lastModified] of groepLastModified.entries()) {
    const slug = getGroepSlug(code);
    if (slug) {
      groepUrls.push({ url: `${BASE_URL}/groep/${slug}`, lastModified, changeFrequency: "weekly", priority: 0.6 });
    }
  }

  // Combinatiepagina's (/leerlijn/[leerlijn]/[groep]) — zelfde
  // MIN_COMBO_ACTIVITIES-drempel als app/leerlijn/[leerlijn]/[groep]/
  // page.tsx zelf afdwingt; een URL die hier staat maar onder de drempel
  // zakt zou anders naar een 404 wijzen.
  const comboCounts = new Map<string, { count: number; lastModified: Date }>();
  for (const activity of activities) {
    if (!activity.leerlijn) continue;
    const leerlijnSlug = getLeerlijnSlug(activity.leerlijn);
    const modified = new Date(activity.public_since ?? activity.created_at);
    for (const code of activity.doelgroep ?? []) {
      const groepSlug = getGroepSlug(code);
      if (!groepSlug) continue;
      const key = `${leerlijnSlug}/${groepSlug}`;
      const existing = comboCounts.get(key);
      if (existing) {
        existing.count += 1;
        if (modified > existing.lastModified) existing.lastModified = modified;
      } else {
        comboCounts.set(key, { count: 1, lastModified: modified });
      }
    }
  }
  const comboUrls: MetadataRoute.Sitemap = [...comboCounts.entries()]
    .filter(([, { count }]) => count >= MIN_COMBO_ACTIVITIES)
    .map(([key, { lastModified }]) => ({
      url: `${BASE_URL}/leerlijn/${key}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/activiteiten`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/over-gymwiki`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...leerlijnUrls,
    ...groepUrls,
    ...comboUrls,
    ...activityUrls,
  ];
}
