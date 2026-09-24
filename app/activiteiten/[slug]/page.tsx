import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { PublicActivityCard } from "@/components/public/PublicActivityCard";
import {
  MONTHLY_CONTRIBUTION_REQUIRED_COUNT,
  SUBSCRIPTION_PLANS,
} from "@/lib/constants/subscriptionPlans";
import {
  getAllPublicActivities,
  getLeerlijnSlug,
  getPublicActivityBySlug,
  getPublicMaterials,
  getRelatedPublicActivities,
  type PublicActivity,
} from "@/lib/services/publicActivities";
import { DOELGROEP_LABELS } from "@/types/activity";

// Publieke, niet-ingelogde pagina — leest geen cookies-afhankelijke
// gebruikersstate (de Supabase-client hieronder gebruikt alleen de
// `anon`-rol, zie lib/services/publicActivities.ts), dus statisch
// genereerbaar + periodiek verversen. Nieuwe/gewijzigde activiteiten
// worden bovendien direct on-demand ververst bij goedkeuring (zie
// revalidatePath in actions/lesson.ts en actions/activity-submission.ts) —
// dit is puur de veilige achtervang-termijn daartussenin.
export const revalidate = 3600;
export const dynamicParams = true;

const BASE_URL = "https://www.gymwiki.nl";
const META_TITLE_MAX = 60;

export async function generateStaticParams() {
  const activities = await getAllPublicActivities();
  return activities.map((activity) => ({ slug: activity.slug }));
}

function buildMetaTitle(activity: PublicActivity): string {
  const leerlijn = activity.leerlijn || activity.categorie || "";
  const groepLabel = (activity.doelgroep ?? [])
    .map((code) => DOELGROEP_LABELS[code])
    .filter(Boolean)[0];

  const withGroep = groepLabel
    ? `${activity.titel} – ${leerlijn} voor ${groepLabel} | GymWiki`
    : leerlijn
      ? `${activity.titel} – ${leerlijn} | GymWiki`
      : `${activity.titel} | GymWiki`;
  if (withGroep.length <= META_TITLE_MAX) return withGroep;

  const withoutGroep = leerlijn ? `${activity.titel} – ${leerlijn} | GymWiki` : `${activity.titel} | GymWiki`;
  if (withoutGroep.length <= META_TITLE_MAX) return withoutGroep;

  const titleOnly = `${activity.titel} | GymWiki`;
  if (titleOnly.length <= META_TITLE_MAX) return titleOnly;

  const suffix = " | GymWiki";
  const maxTitleLen = META_TITLE_MAX - suffix.length - 1;
  return `${activity.titel.slice(0, maxTitleLen)}…${suffix}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const activity = await getPublicActivityBySlug(slug);

  if (!activity) {
    // Geen aparte noindex-metadata nodig — notFound() (zie het
    // pagina-component hieronder) geeft al een echte 404, en de view
    // (activiteiten_publiek) toont sowieso nooit een niet-indexeerbare rij.
    return { title: "Activiteit niet gevonden | GymWiki" };
  }

  const canonical = `${BASE_URL}/activiteiten/${activity.slug}`;

  return {
    title: buildMetaTitle(activity),
    description: activity.seo_summary,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: buildMetaTitle(activity),
      description: activity.seo_summary,
      url: canonical,
      siteName: "GymWiki",
      locale: "nl_NL",
      images: activity.afbeelding ? [{ url: activity.afbeelding }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: buildMetaTitle(activity),
      description: activity.seo_summary,
      images: activity.afbeelding ? [activity.afbeelding] : undefined,
    },
  };
}

export default async function PublicActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const activity = await getPublicActivityBySlug(slug);

  // Dekt tegelijk "bestaat niet", "nog niet goedgekeurd", "concept/privé",
  // "AI-gegenereerd" en "seo_summary ontbreekt nog" — de view zelf is de
  // indexeerbaarheidsregel (zie supabase/migrations/activiteiten_public_
  // seo.sql), dus elke niet-eligible activiteit geeft hier gewoon een
  // eerlijke 404, ongeacht de reden. Nooit een gedeeltelijke/afgeschermde
  // weergave — alleen "bestaat" of "bestaat niet" voor een anonieme bezoeker.
  if (!activity) {
    notFound();
  }

  const materialen = getPublicMaterials(activity);
  const doelgroepLabels = (activity.doelgroep ?? [])
    .map((code) => DOELGROEP_LABELS[code])
    .filter((label): label is string => Boolean(label));
  const leerlijnLabel = activity.leerlijn || activity.categorie;
  const related = await getRelatedPublicActivities(activity);

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Activiteiten", href: "/activiteiten" },
    ...(leerlijnLabel
      ? [{ label: leerlijnLabel, href: `/leerlijn/${getLeerlijnSlug(leerlijnLabel)}` }]
      : []),
    { label: activity.titel },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="space-y-3">
        {leerlijnLabel && (
          <p className="font-mono text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {leerlijnLabel}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{activity.titel}</h1>
        <p className="text-base leading-relaxed text-foreground/80 sm:text-lg">{activity.seo_summary}</p>
        {doelgroepLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {doelgroepLabels.map((label) => (
              <Badge key={label} variant="secondary">
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {activity.afbeelding && (
        <div className="relative h-56 w-full overflow-hidden rounded-2xl border bg-muted sm:h-72">
          <Image
            src={activity.afbeelding}
            alt={activity.titel}
            fill
            sizes="(min-width: 768px) 700px, 100vw"
            className="object-cover"
          />
        </div>
      )}

      {activity.doel && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Lesdoel
            </h2>
            <p className="text-sm leading-relaxed text-foreground">{activity.doel}</p>
          </CardContent>
        </Card>
      )}

      {materialen.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Materiaal
            </h2>
            <ul className="space-y-1.5">
              {materialen.map((item, index) => (
                <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Paywall-aankondiging — de #volledige-uitwerking-id is het
          cssSelector-doel voor de LearningResource-JSON-LD's hasPart
          (isAccessibleForFree: false). Alles wat hierbinnen staat is puur
          de aankondiging zelf; de afgeschermde velden (opbouw, regels,
          varianten, leerhulp, zaaltekening) worden NERGENS in deze
          server-HTML meegestuurd. */}
      <Card id="volledige-uitwerking" className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-start gap-3 py-8 text-center sm:items-center">
          <p className="text-lg font-semibold text-foreground">
            Bekijk de volledige uitwerking
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Inclusief opbouw, speelregels, varianten/differentiatie, leerhulp en zaaltekening —
            gratis door {MONTHLY_CONTRIBUTION_REQUIRED_COUNT} activiteiten per maand te delen, of
            vanaf {SUBSCRIPTION_PLANS.monthly.priceLabel}/maand.
          </p>
          <Button asChild size="lg">
            <Link href="/register">
              Gratis aan de slag
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {related.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Gerelateerde activiteiten</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <PublicActivityCard key={item.id} activity={item} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
