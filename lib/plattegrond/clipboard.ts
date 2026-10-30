// Kopiëren, knippen, plakken en dupliceren van plattegrond-objecten (items, leerlingen met pose/kleur, afgezette velden).
// Pure functies zonder React/three, zodat ze getest kunnen worden; de editor (Floorplan3dEditor.tsx) bewaart het klembord intern
// en schrijft het óók als JSON in het systeemklembord, zodat plakken tussen browsertabs en plattegronden werkt.
//
// Formaat: { "format": "gymwiki-clipboard", "version": 1, "items": [...], "coneFields": [...] } — dezelfde item-/veldvormen als in
// de plattegrond zelf (types/floorplan3d.ts). Bij plakken wordt alles gevalideerd; vreemde data wordt geweigerd.

import { z } from "zod";
import { fieldBounds } from "@/components/canvas-3d/cone-field";
import { itemPolygons, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { coneFieldSchema, floorplan3dItemSchema, ropeSchema, type ConeField, type Floorplan3dItem, type Floorplan3dRoom, type Rope } from "@/types/floorplan3d";

export const CLIPBOARD_FORMAT = "gymwiki-clipboard";
export const CLIPBOARD_VERSION = 1;
export const MAX_CLIPBOARD_ITEMS = 500;
/** Standaardverschuiving van een kopie ten opzichte van het origineel (m); elke volgende plak schuift er nog eens zoveel op. */
export const PASTE_OFFSET_M = 0.5;

const clipboardSchema = z.object({
  format: z.literal(CLIPBOARD_FORMAT),
  version: z.literal(CLIPBOARD_VERSION),
  items: z.array(floorplan3dItemSchema).max(MAX_CLIPBOARD_ITEMS),
  coneFields: z.array(coneFieldSchema).max(MAX_CLIPBOARD_ITEMS),
  /** Touwen waarvan beide items meegekopieerd zijn; ontbreekt in oudere klembordinhoud. */
  ropes: z.array(ropeSchema).max(MAX_CLIPBOARD_ITEMS).default([]),
});
export type ClipboardPayload = z.infer<typeof clipboardSchema>;

export type Bounds2D = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Vec2 = { x: number; z: number };

/** Diepe kopie van de geselecteerde objecten (alle eigenschappen blijven behouden, ook ids — die vervangt `pasteClipboard`). */
export function buildClipboard(items: readonly Floorplan3dItem[], coneFields: readonly ConeField[], ropes: readonly Rope[] = []): ClipboardPayload {
  const ids = new Set(items.map((item) => item.id));
  return {
    format: CLIPBOARD_FORMAT,
    version: CLIPBOARD_VERSION,
    items: items.map((item) => ({ ...item })),
    coneFields: coneFields.map((field) => ({ ...field })),
    // Een touw gaat alleen mee als allebei zijn items meegaan.
    ropes: ropes.filter((rope) => ids.has(rope.a.item) && ids.has(rope.b.item)).map((rope) => ({ ...rope, a: { ...rope.a }, b: { ...rope.b } })),
  };
}

export function clipboardCount(payload: ClipboardPayload): number {
  return payload.items.length + payload.coneFields.length;
}

export function serializeClipboard(payload: ClipboardPayload): string {
  return JSON.stringify(payload);
}

export type ParsedClipboard = { ok: true; payload: ClipboardPayload } | { ok: false; error: string };

/** Valideert tekst uit het systeemklembord. Geen JSON of een ander formaat → nette foutmelding (Nederlands). */
export function parseClipboard(text: string): ParsedClipboard {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Het klembord bevat geen GymWiki-objecten." };
  }
  if (!raw || typeof raw !== "object" || (raw as { format?: unknown }).format !== CLIPBOARD_FORMAT) {
    return { ok: false, error: "Het klembord bevat geen GymWiki-objecten." };
  }
  const parsed = clipboardSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Deze GymWiki-objecten zijn onleesbaar of komen uit een andere versie." };
  if (clipboardCount(parsed.data) === 0) return { ok: false, error: "Er staat niets in het klembord." };
  return { ok: true, payload: parsed.data };
}

function unite(a: Bounds2D | null, b: Bounds2D): Bounds2D {
  return a
    ? { minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ) }
    : b;
}

/** Omhullende (XZ) van de voetafdrukken van alle objecten in het klembord, of null als het leeg is. */
export function clipboardBounds(items: readonly Floorplan3dItem[], coneFields: readonly ConeField[], lookup: DimsLookup): Bounds2D | null {
  let result: Bounds2D | null = null;
  for (const item of items) {
    const points = itemPolygons(item, lookup).flat();
    if (points.length === 0) continue;
    result = unite(result, {
      minX: Math.min(...points.map((p) => p.x)),
      maxX: Math.max(...points.map((p) => p.x)),
      minZ: Math.min(...points.map((p) => p.z)),
      maxZ: Math.max(...points.map((p) => p.z)),
    });
  }
  for (const field of coneFields) result = unite(result, fieldBounds(field));
  return result;
}

function snapTo(value: number, grid: number): number {
  return grid > 0 ? Math.round(value / grid) * grid : value;
}

export type PasteOptions = {
  room: Pick<Floorplan3dRoom, "width_m" | "length_m">;
  lookup: DimsLookup;
  /** Raster (m) waarop de verschuiving snapt; 0 = uit. */
  grid?: number;
  /** Muispositie (zaalcoördinaten) boven het canvas: het midden van de groep komt daar. Zonder: verschuiven met `pasteIndex`. */
  target?: Vec2 | null;
  /** 1 bij de eerste plak, 2 bij de tweede, … — elke plak schuift verder op (alleen zonder `target`). */
  pasteIndex?: number;
  /** Eigen verschuiving (bijv. 0,5 m voor "Dupliceren"); gaat boven `target`/`pasteIndex`. */
  offset?: Vec2;
  createId: () => string;
};

export type PasteResult = { items: Floorplan3dItem[]; coneFields: ConeField[]; ropes: Rope[]; delta: Vec2; clamped: boolean };

/**
 * Nieuwe kopieën van het klembord: unieke ids, alle overige eigenschappen (rotatie over alle assen, hoogte, kleur, pose, grootte,
 * vergrendeld) behouden, onderlinge afstanden gelijk, gesnapt aan het raster en binnen de zaal. De hoogtes (`y`, stapelen) worden
 * door de aanroeper herberekend (recomputeStackedYs).
 */
export function pasteClipboard(payload: ClipboardPayload, options: PasteOptions): PasteResult {
  const { room, lookup, grid = 0, target = null, pasteIndex = 1, offset, createId } = options;
  const bounds = clipboardBounds(payload.items, payload.coneFields, lookup);

  let delta: Vec2;
  if (offset) delta = offset;
  else if (target && bounds) delta = { x: target.x - (bounds.minX + bounds.maxX) / 2, z: target.z - (bounds.minZ + bounds.maxZ) / 2 };
  else delta = { x: PASTE_OFFSET_M * Math.max(1, pasteIndex), z: PASTE_OFFSET_M * Math.max(1, pasteIndex) };
  delta = { x: snapTo(delta.x, grid), z: snapTo(delta.z, grid) };

  // De hele groep binnen de zaal houden (als hij past): schuiven, nooit de onderlinge afstanden wijzigen.
  let clamped = false;
  if (bounds) {
    const halfX = room.width_m / 2;
    const halfZ = room.length_m / 2;
    const shifted = { minX: bounds.minX + delta.x, maxX: bounds.maxX + delta.x, minZ: bounds.minZ + delta.z, maxZ: bounds.maxZ + delta.z };
    const fitsX = shifted.maxX - shifted.minX <= room.width_m;
    const fitsZ = shifted.maxZ - shifted.minZ <= room.length_m;
    let dx = delta.x;
    let dz = delta.z;
    if (fitsX) {
      if (shifted.minX < -halfX) dx += -halfX - shifted.minX;
      else if (shifted.maxX > halfX) dx -= shifted.maxX - halfX;
    }
    if (fitsZ) {
      if (shifted.minZ < -halfZ) dz += -halfZ - shifted.minZ;
      else if (shifted.maxZ > halfZ) dz -= shifted.maxZ - halfZ;
    }
    if (dx !== delta.x || dz !== delta.z) clamped = true;
    delta = { x: dx, z: dz };
  }

  const newIds = new Map(payload.items.map((item) => [item.id, createId()]));
  // Touwen volgen hun items: de kopie van een touw hangt aan de kopieën van de items (niet aan de originelen).
  const ropes: Rope[] = [];
  for (const rope of payload.ropes) {
    const a = newIds.get(rope.a.item);
    const b = newIds.get(rope.b.item);
    if (a && b) ropes.push({ id: createId(), a: { ...rope.a, item: a }, b: { ...rope.b, item: b } });
  }

  return {
    items: payload.items.map((item) => ({ ...item, id: newIds.get(item.id) as string, x: item.x + delta.x, z: item.z + delta.z })),
    coneFields: payload.coneFields.map((field) => ({ ...field, id: createId(), x: field.x + delta.x, z: field.z + delta.z })),
    ropes,
    delta,
    clamped,
  };
}

/** Toast-tekst: "3 objecten gekopieerd", "Leerling gekopieerd"… (`werkwoord` = "gekopieerd" | "geknipt" | "geplakt"). */
export function clipboardMessage(count: number, verb: "gekopieerd" | "geknipt" | "geplakt"): string {
  return count === 1 ? `1 object ${verb}` : `${count} objecten ${verb}`;
}

