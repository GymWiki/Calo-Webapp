import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { PublicActivityCard } from "@/components/public/PublicActivityCard";
import {
  getGroepCodeFromSlug,
  getPublicActivitiesByLeerlijnAndGroep,
} from "@/lib/services/publicActivities";
import { DOELGROEP_LABELS } from "@/types/activity";

// Combinatiepagina (leerlijn x groep) — zie STAP 6: alleen de moeite waard
// (en dus alleen bereikbaar) wanneer er minstens MIN_COMBO_ACTIVITIES
// resultaten zijn; anders leidt de gecombineerde zoekterm domweg naar de
// bredere /leerlijn/[leerlijn]-pagina, die dezelfde inhoud dan al dekt.
// Geen eigen AI-gegenereerde introtekst (zie categorie_intro.sql) — deze
// pagina's zijn talrijker en minder verkeer-kritisch dan de leerlijn-/
// groep-hoofdpagina's, dus een korte, deterministisch samengestelde
// introzin volstaat.
export const revalidate = 3600;
export const dynamicParams = true;

const BASE_URL = "https://www.gymwiki.nl";
const MIN_COMBO_ACTIVITIES = 5;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leerlijn: string; groep: string }>;
}): Promise<Metadata> {
  const { leerlijn: leerlijnSlug, groep: groepSlug } = await params;
  const code = getGroepCodeFromSlug(groepSlug);
  const activities =
    code === null ? [] : await getPublicActivitiesByLeerlijnAndGroep(leerlijnSlug, code);

  if (code === null || activities.length < MIN_COMBO_ACTIVITIES) {
    return { title: "Categorie niet gevonden | GymWiki", robots: { index: false, follow: false } };
  }

  const leerlijnLabel = activities[0].leerlijn!;
  const groepLabel = DOELGROEP_LABELS[code];
  const title = `${leerlijnLabel} voor ${groepLabel} — GymWiki`;
  const description = `${activities.length} activiteiten voor de leerlijn ${leerlijnLabel}, geschikt voor ${groepLabel}.`;
  const canonical = `${BASE_URL}/leerlijn/${leerlijnSlug}/${groepSlug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical, siteName: "GymWiki", locale: "nl_NL" },
  };
}

function buildItemListJsonLd(
  name: string,
  canonical: string,
  activities: { titel: string; slug: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${canonical}#itemlist`,
    name,
    itemListElement: activities.map((activity, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: activity.titel,
      url: `${BASE_URL}/activiteiten/${activity.slug}`,
    })),
  };
}

export default async function LeerlijnGroepPage({
  params,
}: {
  params: Promise<{ leerlijn: string; groep: string }>;
}) {
  const { leerlijn: leerlijnSlug, groep: groepSlug } = await params;
  const code = getGroepCodeFromSlug(groepSlug);

  if (code === null) {
    notFound();
  }

  const activities = await getPublicActivitiesByLeerlijnAndGroep(leerlijnSlug, code);

  // Onder de drempel: geen zelfstandige pagina — /leerlijn/[leerlijn] dekt
  // deze zoekterm dan al voldoende (zie het commentaar bovenaan).
  if (activities.length < MIN_COMBO_ACTIVITIES) {
    notFound();
  }

  const leerlijnLabel = activities[0].leerlijn!;
  const groepLabel = DOELGROEP_LABELS[code];
  const canonical = `${BASE_URL}/leerlijn/${leerlijnSlug}/${groepSlug}`;
  const jsonLd = buildItemListJsonLd(`${leerlijnLabel} voor ${groepLabel}`, canonical, activities);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Activiteiten", href: "/activiteiten" },
          { label: leerlijnLabel, href: `/leerlijn/${leerlijnSlug}` },
          { label: groepLabel },
        ]}
      />

      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {leerlijnLabel} voor {groepLabel}
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {activities.length} activiteiten binnen de leerlijn {leerlijnLabel}, specifiek geschikt
          voor {groepLabel} — gedeeld en gecontroleerd door vakleerkrachten lichamelijke opvoeding
          en CALO-studenten.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activities.map((activity) => (
          <PublicActivityCard key={activity.id} activity={activity} />
        ))}
      </div>
    </main>
  );
}
