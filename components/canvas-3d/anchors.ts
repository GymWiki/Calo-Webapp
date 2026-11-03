// Bevestigingspunten ("anchors") van objecten: waar een touw, lint of net écht aan vast zit (de top van een paal, een haak, het oog van een ring)
// in plaats van waar de muis het model raakte. Pure logica (geen React/three), zodat editor, viewer, tests en scripts hetzelfde rekenen.
//
// Coördinaten: meters in de ITEM-ruimte = de ruimte van het GLB (oorsprong = pivot, Y omhoog). Een anchor draait, kantelt en
// verplaatst dus mee met het item via `localToWorld` (components/canvas-3d/orientation.ts), net als elk ander punt van het model.
//
// Bronnen, in volgorde van voorkeur (zie docs/blender-naming.md):
//   1. lege nodes in het GLB met de naam `anchor_<type>_<naam>` (automatisch uitgelezen door scripts/audit-anchors.ts),
//   2. de overrides in anchor-overrides.ts (met reden),
//   3. punten afgeleid uit de ECHTE zichtbare geometrie (anchors.generated.ts),
//   4. een noodoplossing uit de collision-vorm: het midden van de bovenkant (nooit een rand of hoek), met waarschuwing.

import { shapeOfDims, dimsOf, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { ANCHOR_OVERRIDES } from "@/components/canvas-3d/anchor-overrides";
import { ANCHOR_PROFILES } from "@/components/canvas-3d/anchors.generated";
import type { Vec3 } from "@/components/canvas-3d/orientation";
import type { Floorplan3dItem } from "@/types/floorplan3d";

export type AnchorType = "touw" | "lint" | "net" | "haak";
/** Soort verbinding. Een lint is een strak gespannen touw; een net heeft twee uiteinden aan een rij anchors van het type "net". */
export type RopeKind = "touw" | "lint" | "net";
export type AnchorSource = "glb" | "config" | "afgeleid" | "fallback";

export type AnchorDef = {
  /** Stabiele id binnen het asset (wordt in plattegronden opgeslagen): verander die niet. */
  id: string;
  label: string;
  /** Positie in de item-ruimte (m). Bij `adjustable` is dit de standaardhoogte op de verticale lijn door het punt. */
  pos: Vec3;
  /** Richting waarin het touw het object verlaat (optioneel, genormaliseerd). */
  dir?: Vec3;
  types: AnchorType[];
  /** Standaard anchor van het asset: wint bij een gelijke afstand. */
  default?: boolean;
  /** Hoogteverstelbaar langs een verticale lijn (bijv. een net aan een paal): toegestane Y in de item-ruimte. */
  adjustable?: { min: number; max: number };
  source: AnchorSource;
};

export type AnchorProfile = { anchors: AnchorDef[] };

/** Stapgrootte (m) van de gekozen hoogte op een verstelbare anchor. */
export const ANCHOR_HEIGHT_STEP_M = 0.05;
/** Binnen deze afstand (m) wint de standaard anchor van een iets dichterbij gelegen andere. */
const DEFAULT_PREFERENCE_M = 0.01;

const ALL_TYPES: AnchorType[] = ["touw", "lint", "net", "haak"];

const round3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Past een anchor bij deze soort verbinding? Een touw- of haak-anchor is ook voor een lint bruikbaar; een net heeft eigen "net"-anchors nodig. */
export function isCompatible(types: readonly AnchorType[], kind: RopeKind): boolean {
  if (kind === "net") return types.includes("net");
  if (kind === "lint") return types.includes("lint") || types.includes("touw") || types.includes("haak");
  return types.includes("touw") || types.includes("haak") || types.includes("lint");
}

/** De hoogte (Y, item-ruimte) die bij een verstelbare anchor hoort: gekozen hoogte geklemd tussen min en max. */
export function clampAnchorHeight(def: AnchorDef, height: number | undefined): number {
  if (!def.adjustable) return def.pos[1];
  return round3(clamp(height ?? def.pos[1], def.adjustable.min, def.adjustable.max));
}

/** Het punt van een anchor in de item-ruimte, met de gekozen hoogte als de anchor verstelbaar is. */
export function anchorPosition(def: AnchorDef, height?: number): Vec3 {
  return [def.pos[0], clampAnchorHeight(def, height), def.pos[2]];
}

export type NearestAnchor = { def: AnchorDef; /** Alleen bij een verstelbare anchor: de gekozen (gestapte, geklemde) hoogte. */ height?: number; point: Vec3; distance: number };

/**
 * De anchor die het dichtst bij `local` (item-ruimte) ligt en past bij `kind`. Bij een verstelbare anchor wordt de hoogte van `local`
 * gebruikt (op stapjes van 5 cm, geklemd), zodat je een net/lint op de gewenste hoogte langs de paal kiest.
 */
export function nearestAnchor(defs: readonly AnchorDef[], local: Vec3, kind: RopeKind | "any" = "touw"): NearestAnchor | null {
  let best: NearestAnchor | null = null;
  for (const def of defs) {
    if (kind !== "any" && !isCompatible(def.types, kind)) continue;
    let height: number | undefined;
    if (def.adjustable) {
      const stepped = Math.round(local[1] / ANCHOR_HEIGHT_STEP_M) * ANCHOR_HEIGHT_STEP_M;
      height = clampAnchorHeight(def, stepped);
    }
    const point = anchorPosition(def, height);
    const distance = Math.hypot(point[0] - local[0], point[1] - local[1], point[2] - local[2]);
    const better = !best || distance < best.distance - (def.default ? DEFAULT_PREFERENCE_M : 0) || (best.def.default && !def.default ? distance < best.distance - DEFAULT_PREFERENCE_M : false);
    if (better) best = { def, height, point, distance };
  }
  return best;
}

/** Noodoplossing als er geen anchors bekend zijn: het midden van de BOVENKANT van de collision-vorm (nooit een rand of hoek). */
export function fallbackAnchors(shape: { offset_x: number; offset_z: number; base_m: number; height_m: number }): AnchorDef[] {
  return [
    {
      id: "fallback_top",
      label: "Bovenkant (midden)",
      pos: [round3(shape.offset_x), round3(shape.base_m + shape.height_m), round3(shape.offset_z)],
      types: [...ALL_TYPES],
      default: true,
      source: "fallback",
    },
  ];
}

const warned = new Set<string>();
/** Eén duidelijke waarschuwing per asset zonder bekende anchors (niet bij elke render). */
function warnOnce(slug: string) {
  if (warned.has(slug)) return;
  warned.add(slug);
  if (typeof console !== "undefined" && process.env.NODE_ENV !== "test") {
    console.warn(`[anchors] "${slug}" heeft geen bevestigingspunten; terugval op het midden van de bovenkant. Voeg een anchor toe (docs/blender-naming.md).`);
  }
}

/** De bevestigingspunten van een geplaatst item: override → GLB/afgeleid → noodoplossing uit de collision-vorm. */
export function anchorsForSlug(slug: string, shape: Parameters<typeof fallbackAnchors>[0]): AnchorDef[] {
  const known = ANCHOR_OVERRIDES[slug]?.anchors ?? ANCHOR_PROFILES[slug]?.anchors;
  if (known && known.length > 0) return known;
  warnOnce(slug);
  return fallbackAnchors(shape);
}

export function anchorsFor(item: Pick<Floorplan3dItem, "slug"> & Partial<Floorplan3dItem>, lookup: DimsLookup): AnchorDef[] {
  return anchorsForSlug(item.slug, shapeOfDims(dimsOf(item as Floorplan3dItem, lookup)));
}

/** `anchor_<type>_<naam>` (Blender-lege node) → types en id. `null` als de naam niet aan de conventie voldoet. */
export function parseAnchorNodeName(name: string): { types: AnchorType[]; id: string; label: string } | null {
  const match = /^anchor_(touw|lint|net|haak)_([a-z0-9_]+?)(?:_\d{1,3})?$/i.exec(name.trim());
  if (!match) return null;
  const type = match[1].toLowerCase() as AnchorType;
  const part = match[2].toLowerCase();
  const suffix = /_(\d{1,3})$/.exec(name.trim())?.[1];
  const id = `${type}_${part}${suffix ? `_${suffix}` : ""}`;
  const label = `${type[0].toUpperCase()}${type.slice(1)}: ${part.replace(/_/g, " ")}${suffix ? ` ${Number(suffix)}` : ""}`;
  // Een "touw"-anchor is ook voor lint bruikbaar; een "lint"-anchor ook voor touw (zie isCompatible), dus het type blijft zoals benoemd.
  return { types: [type], id, label };
}
