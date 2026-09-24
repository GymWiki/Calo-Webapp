import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { PublicActivityCard } from "@/components/public/PublicActivityCard";
import { getCategoryIntro } from "@/lib/services/categoryIntro";
import { getGroepCodeFromSlug, getPublicActivitiesByGroep } from "@/lib/services/publicActivities";
import { DOELGROEP_LABELS } from "@/types/activity";

// Categoriepagina voor brede zoektermen ("activiteiten groep 5-6",
// "gymles onderbouw") — zelfde publieke, niet-ingelogde opzet als
// /leerlijn/[leerlijn]. Geen generateStaticParams nodig: er zijn maar 6
// vaste doelgroep-codes (DOELGROEP_SLUGS), dynamicParams rendert ze
// gewoon on-demand bij het eerste bezoek en ISR houdt ze daarna vers.
export const revalidate = 3600;
export const dynamicParams = true;

const BASE_URL = "https://www.gymwiki.nl";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groep: string }>;
}): Promise<Metadata> {
  const { groep: groepSlug } = await params;
  const code = getGroepCodeFromSlug(groepSlug);
  if (code === null) {
    return { title: "Groep niet gevonden | GymWiki", robots: { index: false, follow: false } };
  }

  const activities = await getPublicActivitiesByGroep(code);
  if (activities.length === 0) {
    return { title: "Groep niet gevonden | GymWiki", robots: { index: false, follow: false } };
  }

  const label = DOELGROEP_LABELS[code];
  const title = `Activiteiten voor ${label} — bewegingsonderwijs | GymWiki`;
  const description = `${activities.length} activiteiten geschikt voor ${label}: lesideeën bewegingsonderwijs gedeeld en gecontroleerd door vakleerkrachten LO.`;
  const canonical = `${BASE_URL}/groep/${groepSlug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical, siteName: "GymWiki", locale: "nl_NL" },
  };
}

function buildItemListJsonLd(
  label: string,
  canonical: string,
  activities: { titel: string; slug: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${canonical}#itemlist`,
    name: `Activiteiten voor ${label}`,
    itemListElement: activities.map((activity, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: activity.titel,
      url: `${BASE_URL}/activiteiten/${activity.slug}`,
    })),
  };
}

export default async function GroepPage({ params }: { params: Promise<{ groep: string }> }) {
  const { groep: groepSlug } = await params;
  const code = getGroepCodeFromSlug(groepSlug);
  if (code === null) {
    notFound();
  }

  const activities = await getPublicActivitiesByGroep(code);
  if (activities.length === 0) {
    notFound();
  }

  const label = DOELGROEP_LABELS[code];
  const intro = await getCategoryIntro("groep", groepSlug);
  const canonical = `${BASE_URL}/groep/${groepSlug}`;
  const jsonLd = buildItemListJsonLd(label, canonical, activities);

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
          { label },
        ]}
      />

      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Activiteiten voor {label}</h1>
        {intro && (
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{intro}</p>
        )}
        <p className="text-sm text-muted-foreground">{activities.length} activiteiten</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activities.map((activity) => (
          <PublicActivityCard key={activity.id} activity={activity} />
        ))}
      </div>
    </main>
  );
}
