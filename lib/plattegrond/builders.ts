// Pure bouwstenen die hoog-niveau instructies ("zet 6 kegels in een rij")
// omzetten naar Floorplan3dItem[] — zodat een AI geen ruwe coördinaten
// hoeft uit te rekenen. Alles in meters, oorsprong = midden van de zaal,
// x = breedte (room.width_m), z = lengte (room.length_m), item.x/z = midden
// van de voetafdruk, y altijd 0 (niet stapelen). Rotaties worden op de
// editor-stap van 15° afgerond.

import {
  footprintAabb,
  normalizeRotationDeg,
  ROTATION_STEP_SMALL_DEG,
  type DimsLookup,
} from "@/components/canvas-3d/floorplan3d-geometry";
import type { Floorplan3dData, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";

export type Punt = { x: number; z: number };
export type Richting = "+x" | "-x" | "+z" | "-z";
export type Wand = "minX" | "maxX" | "minZ" | "maxZ";

const round3 = (value: number) => Math.round(value * 1000) / 1000 + 0; // + 0: -0 wordt 0

function snapRot(deg: number): number {
  const stepped = Math.round(deg / ROTATION_STEP_SMALL_DEG) * ROTATION_STEP_SMALL_DEG;
  return normalizeRotationDeg(stepped);
}

function dimsOrThrow(slug: string, lookup: DimsLookup) {
  const dims = lookup(slug);
  if (!dims) throw new Error(`Onbekend item-id "${slug}" (niet in de catalogus).`);
  return dims;
}

function makeItem(slug: string, x: number, z: number, rot: number, id: string): Floorplan3dItem {
  return { id, slug, x: round3(x), y: 0, z: round3(z), rot_y_deg: snapRot(rot) };
}

/** Totale uitgestrektheid (AABB) van een item langs x en z bij een rotatie. */
function extent(slug: string, rot: number, lookup: DimsLookup) {
  const dims = dimsOrThrow(slug, lookup);
  const box = footprintAabb(0, 0, dims.length_m, dims.width_m, rot);
  return { ex: box.maxX - box.minX, ez: box.maxZ - box.minZ };
}

const DIR: Record<Richting, Punt> = {
  "+x": { x: 1, z: 0 },
  "-x": { x: -1, z: 0 },
  "+z": { x: 0, z: 1 },
  "-z": { x: 0, z: -1 },
};

/** `aantal` items op een lijn; `van` = midden van het eerste item; `tussenruimte` = vrije ruimte tussen de randen. */
export function rij(
  p: { slug: string; aantal: number; van: Punt; richting: Richting; tussenruimte?: number; rot_y_deg?: number; idPrefix?: string },
  lookup: DimsLookup,
): Floorplan3dItem[] {
  const rot = snapRot(p.rot_y_deg ?? 0);
  const { ex, ez } = extent(p.slug, rot, lookup);
  const dir = DIR[p.richting];
  const step = (dir.x !== 0 ? ex : ez) + (p.tussenruimte ?? 0);
  return Array.from({ length: p.aantal }, (_, k) =>
    makeItem(p.slug, p.van.x + dir.x * step * k, p.van.z + dir.z * step * k, rot, `${p.idPrefix ?? p.slug}-${k + 1}`),
  );
}

/**
 * Items op een cirkel. Hoek 0° = +x, hoeken lopen van +x naar +z.
 * `oriëntatie`: "tangent" = lengteas (lokale X) langs de cirkel, "radiaal" = lengteas naar het midden, of een getal (graden).
 */
export function cirkel(
  p: { slug: string; aantal: number; midden: Punt; straal: number; beginhoek_deg?: number; oriëntatie?: "tangent" | "radiaal" | number; idPrefix?: string },
  lookup: DimsLookup,
): Floorplan3dItem[] {
  dimsOrThrow(p.slug, lookup);
  const mode = p.oriëntatie ?? "tangent";
  return Array.from({ length: p.aantal }, (_, k) => {
    const hoek = (p.beginhoek_deg ?? 0) + (360 * k) / p.aantal;
    const rad = (hoek * Math.PI) / 180;
    // three.js: lokale +X wijst na rotatie θ naar (cosθ, -sinθ) in (x,z).
    const rot = typeof mode === "number" ? mode : mode === "tangent" ? -(hoek + 90) : -(hoek + 180);
    return makeItem(p.slug, p.midden.x + p.straal * Math.cos(rad), p.midden.z + p.straal * Math.sin(rad), rot, `${p.idPrefix ?? p.slug}-${k + 1}`);
  });
}

/** Rooster van rijen×kolommen; `van` = midden linksboven (kleinste x, kleinste z); stap = afstand tussen middelpunten. */
export function raster(
  p: { slug: string; rijen: number; kolommen: number; van: Punt; stapX?: number; stapZ?: number; rot_y_deg?: number; idPrefix?: string },
  lookup: DimsLookup,
): Floorplan3dItem[] {
  const rot = snapRot(p.rot_y_deg ?? 0);
  const { ex, ez } = extent(p.slug, rot, lookup);
  const stapX = p.stapX ?? ex;
  const stapZ = p.stapZ ?? ez;
  const out: Floorplan3dItem[] = [];
  for (let r = 0; r < p.rijen; r++) {
    for (let c = 0; c < p.kolommen; c++) {
      out.push(makeItem(p.slug, p.van.x + stapX * c, p.van.z + stapZ * r, rot, `${p.idPrefix ?? p.slug}-${r * p.kolommen + c + 1}`));
    }
  }
  return out;
}

/**
 * Items vlak tegen een wand, naast elkaar langs die wand en gecentreerd rond `langs`
 * (x-coördinaat bij minZ/maxZ, z-coördinaat bij minX/maxX). Standaardrotatie: lengteas langs de wand.
 */
export function tegenWand(
  p: { slug: string; room: Floorplan3dRoom; wand: Wand; aantal?: number; langs?: number; tussenruimte?: number; afstandTotWand?: number; rot_y_deg?: number; idPrefix?: string },
  lookup: DimsLookup,
): Floorplan3dItem[] {
  const aantal = p.aantal ?? 1;
  const langsX = p.wand === "minZ" || p.wand === "maxZ";
  const rot = snapRot(p.rot_y_deg ?? (langsX ? 0 : 90));
  const { ex, ez } = extent(p.slug, rot, lookup);
  const along = langsX ? ex : ez;
  const across = langsX ? ez : ex;
  const gap = p.tussenruimte ?? 0;
  const total = aantal * along + (aantal - 1) * gap;
  const start = (p.langs ?? 0) - total / 2 + along / 2;
  const halfX = p.room.width_m / 2;
  const halfZ = p.room.length_m / 2;
  const off = p.afstandTotWand ?? 0;
  const fixed =
    p.wand === "minZ" ? -halfZ + across / 2 + off
    : p.wand === "maxZ" ? halfZ - across / 2 - off
    : p.wand === "minX" ? -halfX + across / 2 + off
    : halfX - across / 2 - off;
  return Array.from({ length: aantal }, (_, k) => {
    const pos = start + k * (along + gap);
    return makeItem(p.slug, langsX ? pos : fixed, langsX ? fixed : pos, rot, `${p.idPrefix ?? p.slug}-${k + 1}`);
  });
}

/** Eén item direct naast een bestaand item (randen tegen elkaar + `tussenruimte`), midden-uitgelijnd. */
export function naastElkaar(
  p: { basis: Floorplan3dItem; slug: string; kant: Richting; tussenruimte?: number; rot_y_deg?: number; id: string },
  lookup: DimsLookup,
): Floorplan3dItem {
  const baseDims = dimsOrThrow(p.basis.slug, lookup);
  const base = footprintAabb(p.basis.x, p.basis.z, baseDims.length_m, baseDims.width_m, p.basis.rot_y_deg);
  const rot = snapRot(p.rot_y_deg ?? p.basis.rot_y_deg);
  const { ex, ez } = extent(p.slug, rot, lookup);
  const gap = p.tussenruimte ?? 0;
  const baseHalfX = (base.maxX - base.minX) / 2;
  const baseHalfZ = (base.maxZ - base.minZ) / 2;
  const dir = DIR[p.kant];
  const x = p.basis.x + dir.x * (baseHalfX + gap + ex / 2);
  const z = p.basis.z + dir.z * (baseHalfZ + gap + ez / 2);
  return makeItem(p.slug, x, z, rot, p.id);
}

/**
 * Veld afzetten met markeringen (bijv. pionnen): de app heeft hier geen eigen
 * object voor — dit zijn gewone losse items. Het veld is een rechthoek met
 * `midden`, `breedte` (langs x) en `lengte` (langs z); markeringen komen met hun
 * middelpunt OP de rand/hoek. Modi: "hoeken" (4), "omtrek" (langs de rand, max
 * `maxAfstand` tussen markeringen), "raster" (`rijen`×`kolommen` gelijkmatig
 * over het hele veld, rand inclusief).
 */
export function veldAfzetten(
  p: { slug: string; midden: Punt; breedte: number; lengte: number; modus: "hoeken" | "omtrek" | "raster"; maxAfstand?: number; rijen?: number; kolommen?: number; idPrefix?: string },
  lookup: DimsLookup,
): Floorplan3dItem[] {
  dimsOrThrow(p.slug, lookup);
  const x0 = p.midden.x - p.breedte / 2;
  const x1 = p.midden.x + p.breedte / 2;
  const z0 = p.midden.z - p.lengte / 2;
  const z1 = p.midden.z + p.lengte / 2;
  const lin = (a: number, b: number, n: number) => (n <= 1 ? [a] : Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1)));
  let points: Punt[];

  if (p.modus === "hoeken") {
    points = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  } else if (p.modus === "omtrek") {
    if (!p.maxAfstand || p.maxAfstand <= 0) throw new Error('veldAfzetten modus "omtrek" vereist maxAfstand > 0.');
    const nx = Math.ceil(p.breedte / p.maxAfstand);
    const nz = Math.ceil(p.lengte / p.maxAfstand);
    const xs = lin(x0, x1, nx + 1);
    const zs = lin(z0, z1, nz + 1);
    points = [
      ...xs.map((x) => ({ x, z: z0 })),
      ...zs.slice(1).map((z) => ({ x: x1, z })),
      ...xs.slice(0, -1).reverse().map((x) => ({ x, z: z1 })),
      ...zs.slice(1, -1).reverse().map((z) => ({ x: x0, z })),
    ];
  } else {
    if (!p.rijen || !p.kolommen) throw new Error('veldAfzetten modus "raster" vereist rijen en kolommen.');
    points = lin(z0, z1, p.rijen).flatMap((z) => lin(x0, x1, p.kolommen!).map((x) => ({ x, z })));
  }
  return points.map((pt, k) => makeItem(p.slug, pt.x, pt.z, 0, `${p.idPrefix ?? p.slug}-${k + 1}`));
}

// ---------------------------------------------------------------------------
// Spec -> plattegrond (gebruikt door scripts/build-plattegrond.mts)
// ---------------------------------------------------------------------------

export type Onderdeel =
  | ({ type: "rij" } & Parameters<typeof rij>[0])
  | ({ type: "cirkel" } & Parameters<typeof cirkel>[0])
  | ({ type: "raster" } & Parameters<typeof raster>[0])
  | ({ type: "tegenWand" } & Omit<Parameters<typeof tegenWand>[0], "room">)
  | ({ type: "veldAfzetten" } & Parameters<typeof veldAfzetten>[0])
  | { type: "item"; slug: string; x: number; z: number; rot_y_deg?: number; id: string }
  | { type: "naastElkaar"; basisId: string; slug: string; kant: Richting; tussenruimte?: number; rot_y_deg?: number; id: string };

export type PlattegrondSpec = { room: Floorplan3dRoom; onderdelen: Onderdeel[] };

export function bouwPlattegrond(spec: PlattegrondSpec, lookup: DimsLookup): Floorplan3dData {
  const items: Floorplan3dItem[] = [];
  for (const o of spec.onderdelen) {
    switch (o.type) {
      case "rij": items.push(...rij(o, lookup)); break;
      case "cirkel": items.push(...cirkel(o, lookup)); break;
      case "raster": items.push(...raster(o, lookup)); break;
      case "tegenWand": items.push(...tegenWand({ ...o, room: spec.room }, lookup)); break;
      case "veldAfzetten": items.push(...veldAfzetten(o, lookup)); break;
      case "item": items.push(makeItem(o.slug, o.x, o.z, o.rot_y_deg ?? 0, o.id)); break;
      case "naastElkaar": {
        const basis = items.find((item) => item.id === o.basisId);
        if (!basis) throw new Error(`naastElkaar: basisId "${o.basisId}" is nog niet geplaatst (volgorde van onderdelen telt).`);
        items.push(naastElkaar({ ...o, basis }, lookup));
        break;
      }
      default:
        throw new Error(`Onbekend onderdeel-type: ${(o as { type: string }).type}`);
    }
  }
  return { version: 1, room: spec.room, items };
}
