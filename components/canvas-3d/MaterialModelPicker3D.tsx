"use client";

import { ModelLibrary } from "@/components/library/ModelLibrary";
import type { MaterialModel } from "@/types/materialModel";

/**
 * Materiaalmenu van de 3D-editor. De eigenlijke bibliotheek (zoeken, sportfilter,
 * accordeons per categorie, favorieten, recent, personen) staat in
 * components/library/ModelLibrary.tsx; dit bestand houdt de bestaande import in
 * de editor (sidebar + mobiele drawer) stabiel.
 */
export function MaterialModelPicker3D({
  models,
  onSelect,
  surfaceClassName,
  syncFavorites,
}: {
  models: MaterialModel[];
  onSelect: (model: MaterialModel) => void;
  surfaceClassName?: string;
  syncFavorites?: boolean;
}) {
  return <ModelLibrary models={models} onSelect={onSelect} surfaceClassName={surfaceClassName} syncFavorites={syncFavorites} />;
}
