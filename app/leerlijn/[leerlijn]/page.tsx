import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { PublicActivityCard } from "@/components/public/PublicActivityCard";
import { getCategoryIntro } from "@/lib/services/categoryIntro";
import {
  getAllPublicActivities,
  getLeerlijnSlug,
  getPublicActivitiesByLeerlijn,
} from "@/lib/services/publicActivities";

// Categoriepagina voor brede zoektermen ("[leerlijn] bewegingsonderwijs",
// "activiteiten [leerlijn]") — zelfde publieke, niet-ingelogde opzet als
// /activiteiten/[slug].
export const revalidate = 3600;
export const dynamicParams = true;

const BASE_URL = "https://www.gymwiki.nl";

export async function generateStaticParams() {
  const activities = await getAllPublicActivities();
  const slugs = new Set(
    activities.filter((a) => a.leerlijn).map((a) => getLeerlijnSlug(a.leerlijn!)),
  );
  return [...slugs].map((leerlijn) => ({ leerlijn }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leerlijn: string }>;
}): Promise<Metadata> {
  const { leerlijn: leerlijnSlug } = await params;
  const activities = await getPublicActivitiesByLeerlijn(leerlijnSlug);

  if (activities.length === 0) {
    return { title: "Leerlijn niet gevonden | GymWiki", robots: { index: false, follow: false } };
  }

  const label = activities[0].leerlijn!;
  const title = `${label} — activiteiten bewegingsonderwijs | GymWiki`;
  const description = `${activities.length} activiteiten voor de leerlijn ${label}: lesideeën bewegingsonderwijs gedeeld en gecontroleerd door vakleerkrachten LO.`;
  const canonical = `${BASE_URL}/leerlijn/${leerlijnSlug}`;

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
    name: `Activiteiten voor de leerlijn ${label}`,
    itemListElement: activities.map((activity, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: activity.titel,
      url: `${BASE_URL}/activiteiten/${activity.slug}`,
    })),
  };
}

export default async function LeerlijnPage({
  params,
}: {
  params: Promise<{ leerlijn: string }>;
}) {
  const { leerlijn: leerlijnSlug } = await params;
  const activities = await getPublicActivitiesByLeerlijn(leerlijnSlug);

  if (activities.length === 0) {
    notFound();
  }

  const label = activities[0].leerlijn!;
  const intro = await getCategoryIntro("leerlijn", leerlijnSlug);
  const canonical = `${BASE_URL}/leerlijn/${leerlijnSlug}`;
  const jsonLd = buildItemListJsonLd(label, canonical, activities);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Activiteiten", href: "/activiteiten" }, { label }]}
      />

      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{label}</h1>
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
