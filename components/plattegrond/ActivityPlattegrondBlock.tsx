import { Suspense } from "react";

import { PlattegrondCard } from "@/components/plattegrond/PlattegrondCard";
import { PlattegrondSection, PlattegrondSectionSkeleton } from "@/components/plattegrond/PlattegrondSection";
import type { ActivityVisual } from "@/lib/activities/visual";
import type { MaterialModel } from "@/types/materialModel";

/**
 * Het plattegrond-deel van de detailpagina van een eenvoudige activiteit, volledig bepaald door `getActivityVisual`
 * (lib/activities/visual.ts): bij 3D alleen de viewer (de afbeelding komt nergens voor), bij een afbeelding de afbeelding met
 * "Vervang door 3D-plattegrond", zonder beeld "Plattegrond maken" (alleen met bewerkrecht), anders niets.
 */
export function ActivityPlattegrondBlock({
  activityId,
  visual,
  canEdit,
  dotClassName,
  models,
}: {
  activityId: string;
  visual: ActivityVisual;
  canEdit: boolean;
  dotClassName?: string;
  models?: MaterialModel[];
}) {
  if (visual.type === "3d") {
    return (
      <Suspense fallback={<PlattegrondSectionSkeleton />}>
        <PlattegrondSection activityId={activityId} plan={visual.plattegrond} canEdit={canEdit} models={models} />
      </Suspense>
    );
  }
  return (
    <PlattegrondCard
      imageUrl={visual.type === "image" ? visual.url : null}
      activityId={activityId}
      canEdit={canEdit}
      dotClassName={dotClassName}
      animationDelay="40ms"
    />
  );
}
