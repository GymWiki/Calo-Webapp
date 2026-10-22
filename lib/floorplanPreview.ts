/** Pad-fragment van de publieke bucket met thumbnails van 3D-plattegronden. */
export const FLOORPLAN_PREVIEW_MARKER = "/floorplan-previews/";

/** Is dit de automatisch gegenereerde thumbnail van een 3D-plattegrond (en dus geen eigen afbeelding)? */
export function isFloorplanPreviewUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes(FLOORPLAN_PREVIEW_MARKER));
}
