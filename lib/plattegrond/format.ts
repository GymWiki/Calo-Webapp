// Exportformaat van een 3D-plattegrond (JSON-bestand). De `scene` is dezelfde JSON als de kolom `public.floorplans_3d.data`
// (types/floorplan3d.ts), alleen afgerond en met een vaste sleutelvolgorde. Eén implementatie voor het downloaden, de deellink
// (lib/guest/share-codec.ts) en het CLI-script (scripts/import-plattegrond.mts).

import type { Floorplan3dData } from "@/types/floorplan3d";

export const FORMAT_NAME = "gymwiki-plattegrond";
/** Huidige formaatversie; gelijk aan `scene.version` (floorplan3dDataSchema). Verhoog bij een niet-compatibele wijziging en voeg een migratie toe. */
export const FORMAT_VERSION = 1;
/** Decimalen voor meters en graden: genoeg voor cm-precisie, zonder 0.30000000000000004. */
export const DECIMALS = 3;

export type PlattegrondEnvelope = {
  format: typeof FORMAT_NAME;
  version: number;
  exportedAt: string;
  title: string;
  scene: Floorplan3dData;
};

const factor = 10 ** DECIMALS;
export const roundNumber = (value: number): number => Math.round(value * factor) / factor;

/** Vaste volgorde van sleutels (de rest alfabetisch erachter): leesbaar en een stabiele diff tussen exports. */
const KEY_ORDER = [
  "format", "version", "exportedAt", "title", "scene", "room", "items", "coneFields",
  "id", "slug", "type", "x", "y", "z", "rot_y_deg", "rot_x_deg", "rot_z_deg", "lift_m", "locked", "size",
  "width_m", "length_m", "interval_m", "distribution", "marker", "color", "corner_color",
  "environment", "layout", "hidden", "view",
];
const rank = new Map(KEY_ORDER.map((key, index) => [key, index]));

function canonical(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? roundNumber(value) : value;
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (rank.get(a) ?? 1000) - (rank.get(b) ?? 1000) || a.localeCompare(b));
    return Object.fromEntries(entries.map(([key, v]) => [key, canonical(v)]));
  }
  return value;
}

/** Afgeronde kopie met vaste sleutelvolgorde; inhoudelijk gelijk aan de opgeslagen `data`. */
export function roundScene(scene: Floorplan3dData): Floorplan3dData {
  return canonical(scene) as Floorplan3dData;
}

export function buildEnvelope(scene: Floorplan3dData, title: string, now: Date = new Date()): PlattegrondEnvelope {
  return canonical({
    format: FORMAT_NAME,
    version: FORMAT_VERSION,
    exportedAt: now.toISOString(),
    title: title.trim() || "Plattegrond",
    scene,
  }) as PlattegrondEnvelope;
}

/** Leesbare JSON (2 spaties) met afsluitende regel. */
export function stringifyEnvelope(envelope: PlattegrondEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function slugifyTitle(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "plattegrond"
  );
}

/** plattegrond-<slug-van-titel>-<datum>.json */
export function exportFileName(title: string, now: Date = new Date()): string {
  return `plattegrond-${slugifyTitle(title)}-${now.toISOString().slice(0, 10)}.json`;
}
