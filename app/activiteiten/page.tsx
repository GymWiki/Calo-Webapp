import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { PublicActivityCard } from "@/components/public/PublicActivityCard";
import { getAllPublicActivities } from "@/lib/services/publicActivities";

// Publieke, niet-ingelogde index — breadcrumb-doel voor
// /activiteiten/[slug] (zie die pagina) én het startpunt van de interne
// linkgraaf naar elke afzonderlijke publieke activiteit voor crawlers.
export const revalidate = 3600;

const BASE_URL = "https://www.gymwiki.nl";
const TITLE = "Activiteitenbibliotheek — bewegingsonderwijs | GymWiki";
const DESCRIPTION =
  "Blader door de GymWiki-activiteitenbibliotheek: lesideeën voor bewegingsonderwijs per leerlijn en groep, gedeeld en gecontroleerd door vakleerkrachten LO.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/activiteiten` },
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE_URL}/activiteiten`,
    siteName: "GymWiki",
    locale: "nl_NL",
  },
};

export default async function ActivitiesIndexPage() {
  const activities = await getAllPublicActivities();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Activiteiten" }]} />

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Activiteitenbibliotheek</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {activities.length} activiteiten voor bewegingsonderwijs, gedeeld en gecontroleerd door
          vakleerkrachten lichamelijke opvoeding en CALO-studenten.
        </p>
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen publieke activiteiten beschikbaar.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity) => (
            <PublicActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </main>
  );
}
