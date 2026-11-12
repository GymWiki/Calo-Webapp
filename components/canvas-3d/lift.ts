// Tillen: de HOOGTE van een object veranderen met de rechtermuisknop (of de Tillen-knop op een telefoon). Pure logica (geen React/three), zodat de
// editor, de tests en de preview dezelfde berekening gebruiken (geen verspringing bij loslaten).
//
// Hoogte = `lift_m` van het item: de hoogte (m) van het laagste punt boven de vloer ("Vrij in hoogte"). Geen `lift_m` = het item rust op de
// vloer of zijn ondergrond. Zie recomputeStackedYs in floorplan3d-geometry.ts.

/** Een muisbeweging omhoog van `dyPx` pixels (positief = omhoog) in wereldhoogte (m), bij een perspectiefcamera. */
export function screenDeltaToWorldHeight(options: {
  dyPx: number;
  viewportHeightPx: number;
  fovDeg: number;
  /** Afstand van de camera tot het object (m). */
  distance: number;
  /** Hoek van de kijkrichting met het horizontale vlak (radialen, 0 = horizontaal, π/2 = loodrecht omlaag). */
  pitchRad: number;
}): number {
  const { dyPx, viewportHeightPx, fovDeg, distance, pitchRad } = options;
  if (viewportHeightPx <= 0 || distance <= 0) return 0;
  const worldPerPx = (2 * distance * Math.tan((fovDeg * Math.PI) / 360)) / viewportHeightPx;
  // Een verticale verplaatsing h verschuift het beeld met h·cos(pitch); loodrecht van boven zie je haast geen hoogte, dus begrens de deler.
  const projection = Math.max(0.2, Math.cos(Math.abs(pitchRad)));
  return (dyPx * worldPerPx) / projection;
}

/** Gangbare hoogtes waar tillen licht aan vastklikt: badmintonnet (paal 1,55 m), volleybalnet dames en heren. */
export const STANDARD_LIFT_HEIGHTS_M: readonly number[] = [1.55, 2.24, 2.43];

/** Afstand (m) waarbinnen een snappunt het object aantrekt. */
export const LIFT_SNAP_RADIUS_M = 0.05;

export type LiftSnapPoint = { height: number; label: string };

/** Alle snappunten voor één tilbeweging: de ondergrond (of vloer), de standaardhoogtes en extra punten (bijv. handhoogtes van leerlingen). */
export function liftSnapPoints(options: { restHeight: number; extra?: LiftSnapPoint[] }): LiftSnapPoint[] {
  return [
    { height: options.restHeight, label: options.restHeight <= 0.005 ? "vloer" : "ondergrond" },
    ...STANDARD_LIFT_HEIGHTS_M.map((height) => ({ height, label: "nethoogte" })),
    ...(options.extra ?? []),
  ];
}

const round = (value: number, step: number) => Math.round(value / step) * step;
const cleanup = (value: number) => Math.round(value * 1000) / 1000 + 0;

export type LiftResult = { height: number; snappedTo: string | null };

/**
 * De nieuwe hoogte tijdens het tillen. `free` (Shift): vrij en op de millimeter, zonder snappen. Anders: rasterstap (`gridStepM`) en een lichte
 * magnetische aantrekking naar de snappunten. Altijd tussen `min` (vloer of ondergrond) en `max` (zaalhoogte min objecthoogte).
 */
export function liftHeight(options: {
  startHeight: number;
  deltaM: number;
  min: number;
  max: number;
  gridStepM: number;
  snapPoints: LiftSnapPoint[];
  free: boolean;
}): LiftResult {
  const { startHeight, deltaM, min, max, gridStepM, snapPoints, free } = options;
  const clamp = (value: number) => Math.min(Math.max(max, min), Math.max(min, value));
  const raw = startHeight + deltaM;
  if (free) return { height: cleanup(clamp(raw)), snappedTo: null };
  let best: LiftSnapPoint | null = null;
  for (const point of snapPoints) {
    if (point.height < min - 1e-6 || point.height > max + 1e-6) continue;
    if (Math.abs(point.height - raw) <= LIFT_SNAP_RADIUS_M && (!best || Math.abs(point.height - raw) < Math.abs(best.height - raw))) best = point;
  }
  if (best) return { height: cleanup(best.height), snappedTo: best.label };
  return { height: cleanup(clamp(round(raw, gridStepM))), snappedTo: null };
}

/** Maximale hoogte van het laagste punt: de zaalhoogte min de hoogte van het object (nooit negatief, en niet boven het schema-maximum van 10 m). */
export function maxLiftHeight(roomHeightM: number, objectHeightM: number): number {
  return Math.max(0, Math.min(10, roomHeightM - objectHeightM));
}

/** Hoogte in het Nederlands, bijv. "1,35 m". */
export function formatHeight(meters: number): string {
  return `${meters.toFixed(2).replace(".", ",")} m`;
}
