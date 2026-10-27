// De ENIGE plek met de weergaveregel voor het plattegrond-beeld van een activiteit:
//
//   1. Heeft de activiteit een geldige 3D-plattegrond met inhoud, dan wint die altijd: alleen de 3D-viewer, de afbeelding
//      wordt nergens getoond (detail, kaarten, OG, PDF).
//   2. Anders, als er een afbeelding is: die, zoals voorheen.
//   3. Anders niets (de aanroeper toont "Plattegrond maken" voor wie mag bewerken).
//
// De afbeelding zelf blijft ongemoeid in database en storage; hij wordt alleen niet meer getoond zodra er een 3D-plattegrond is.
// Ongeldige of lege 3D-data valt terug op de afbeelding (met een console.warn).

import { floorplan3dDataSchema, type Floorplan3dData } from "@/types/floorplan3d";

/** Een 3D-plattegrond zoals de services hem aanleveren; `data` mag nog ongeparsed (unknown) zijn. */
export type FloorplanInput = {
  id: string;
  naam: string;
  ownerId: string;
  data: unknown;
  /** Publieke URL van de thumbnail van deze plattegrond. */
  previewUrl: string;
};

export type ParsedFloorplan = Omit<FloorplanInput, "data"> & { data: Floorplan3dData };

export type ActivityVisual =
  | { type: "3d"; plattegrond: ParsedFloorplan }
  | { type: "image"; url: string }
  | { type: "none" };

export type ActivityImageFields = {
  afbeelding?: string | null;
  diagram_image_url?: string | null;
};

const clean = (url: string | null | undefined) => (typeof url === "string" && url.trim() !== "" ? url : null);

/** De losse afbeelding van een activiteit: `afbeelding` (storage-URL) vóór `diagram_image_url` (legacy: export van de verwijderde 2D-editor). */
export function getActivityImageUrl(activity: ActivityImageFields): string | null {
  return clean(activity.afbeelding) ?? clean(activity.diagram_image_url);
}

/** Heeft een geparste plattegrond iets om te tonen (items of afgezette velden)? */
export function floorplanHasContent(data: Pick<Floorplan3dData, "items" | "coneFields">): boolean {
  return data.items.length > 0 || data.coneFields.length > 0;
}

/** Parse + validatie; `null` bij ongeldige JSON. */
export function parseFloorplan(floorplan: FloorplanInput): ParsedFloorplan | null {
  const parsed = floorplan3dDataSchema.safeParse(floorplan.data);
  return parsed.success ? { ...floorplan, data: parsed.data } : null;
}

export function getActivityVisual(
  activity: ActivityImageFields,
  floorplan?: FloorplanInput | null,
  warn: (message: string) => void = (message) => console.warn(message),
): ActivityVisual {
  if (floorplan) {
    const parsed = parseFloorplan(floorplan);
    if (!parsed) {
      warn(`3D-plattegrond ${floorplan.id}: ongeldige data, terugval op de afbeelding.`);
    } else if (!floorplanHasContent(parsed.data)) {
      warn(`3D-plattegrond ${floorplan.id}: leeg, terugval op de afbeelding.`);
    } else {
      return { type: "3d", plattegrond: parsed };
    }
  }
  const url = getActivityImageUrl(activity);
  return url ? { type: "image", url } : { type: "none" };
}

/**
 * Voor lijsten (kaarten, OG, PDF): is er een geldige 3D-plattegrond, dan is de 3D-thumbnail het beeld en wordt de afbeelding
 * alleen IN HET GEHEUGEN op de thumbnail gezet (de database blijft ongewijzigd). Zo hoeven de kaartcomponenten, de
 * PDF-export en de metadata de regel niet zelf te kennen: ze lezen `afbeelding ?? diagram_image_url` zoals altijd.
 */
export function withFloorplanThumbnail<T extends ActivityImageFields>(activity: T, thumbnailUrl: string | null | undefined): T {
  if (!thumbnailUrl) return activity;
  return { ...activity, afbeelding: thumbnailUrl, diagram_image_url: null };
}
