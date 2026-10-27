import Link from "next/link";
import { cookies } from "next/headers";
import { Box, Pencil } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { PlattegrondLegend } from "@/components/plattegrond/PlattegrondLegend";
import { PlattegrondViewer } from "@/components/plattegrond/PlattegrondViewer";
import { summarizeFloorplan } from "@/components/canvas-3d/floorplan-summary";
import { Button } from "@/components/ui/button";
import type { ActivityFloorplan } from "@/lib/services/floorplans3d";
import { getMaterialModelsBySlugs } from "@/lib/services/materialModels";
import { createClient } from "@/utils/supabase/server";

/**
 * "Plattegrond (3D)" bij de activiteitbeschrijving — async server component
 * (haalt alleen nog de gebruikte materiaalmodellen op) zodat de pagina
 * zelf niet hoeft te wachten: de aanroeper wrapt hem in <Suspense> met
 * PlattegrondSectionSkeleton. De plattegrond zelf is al opgehaald (zie
 * getFloorplanForActivity); alleen tonen als hij inhoud heeft.
 */
export async function PlattegrondSection({
  activityId,
  plan,
  canEdit,
}: {
  activityId: string;
  plan: ActivityFloorplan;
  /** Alleen de auteur kan de plattegrond bewerken (RLS: floorplans_3d is van de eigenaar). */
  canEdit: boolean;
}) {
  const supabase = createClient(await cookies());
  let models: Awaited<ReturnType<typeof getMaterialModelsBySlugs>> = [];
  try {
    models = await getMaterialModelsBySlugs(
      supabase,
      plan.data.items.map((item) => item.slug),
    );
  } catch {
    // Zonder modellen toont de viewer grijze "onbekend"-vakjes; de pagina blijft werken.
  }

  const nameBySlug = new Map(models.map((model) => [model.slug, model.naam]));
  const categoryBySlug = new Map(models.map((model) => [model.slug, model.categorie]));
  const summary = summarizeFloorplan(
    plan.data.items,
    plan.data.coneFields,
    (slug) => nameBySlug.get(slug),
    (slug) => categoryBySlug.get(slug),
  );

  return (
    <section aria-labelledby={`plattegrond-3d-${plan.id}`} className="animate-fade-up space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`plattegrond-3d-${plan.id}`} className="flex items-center gap-2 text-base font-semibold">
          <Box className="size-4 text-primary" aria-hidden="true" />
          Plattegrond
        </h2>
        {canEdit && (
          <Button asChild variant="outline" size="sm" className="print:hidden">
            <Link href={`/plattegrond-3d?open=${plan.id}&activiteit=${encodeURIComponent(activityId)}`}>
              <Pencil className="size-4" aria-hidden="true" />
              Bewerken in editor
            </Link>
          </Button>
        )}
      </div>
      <div className="print:hidden">
        <PlattegrondViewer data={plan.data} models={models} previewUrl={plan.previewUrl} title={plan.naam} />
      </div>
      {/* Print: de interactieve viewer past niet op papier — de 3D-thumbnail is dan het beeld (nooit de losse afbeelding). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plan.previewUrl} alt={`3D-plattegrond: ${plan.naam}`} className="hidden w-full max-w-xl rounded-lg border print:block" />
      <div className="print:hidden">
        <PlattegrondLegend summary={summary} />
      </div>
    </section>
  );
}

export function PlattegrondSectionSkeleton() {
  return (
    <div className="space-y-3 print:hidden" role="status" aria-label="Plattegrond laden">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-[280px] w-full rounded-xl md:h-[400px]" />
    </div>
  );
}
