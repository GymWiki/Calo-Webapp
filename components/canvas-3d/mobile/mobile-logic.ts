// Pure logica voor de mobiele 3D-editor (geen React/three): rotatie-snap,
// bottom-sheet-standen, kwaliteitsinstellingen, dubbeltik en lokale kladversie.
// Getest in mobile-logic.test.ts.

/** Breakpoints: telefoon < 640, tablet 640–1023, desktop ≥ 1024 (Tailwind sm/lg). */
export const BREAKPOINT_TABLET_PX = 640;
export const BREAKPOINT_DESKTOP_PX = 1024;
export type EditorLayout = "phone" | "tablet" | "desktop";

export function layoutForWidth(widthPx: number): EditorLayout {
  if (widthPx >= BREAKPOINT_DESKTOP_PX) return "desktop";
  if (widthPx >= BREAKPOINT_TABLET_PX) return "tablet";
  return "phone";
}

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Rondt een hoek af op `step` graden (standaard 15), in [0, 360). */
export function snapRotationDeg(deg: number, step = 15): number {
  return normalizeDeg(Math.round(deg / step) * step);
}

/**
 * Hoek (graden, three.js-conventie rotation.y = +graden) waarbij de lokale +x-as van
 * een item van het middelpunt (cx, cz) naar het punt (px, pz) wijst. Lokale +x → wereld
 * (cos θ, −sin θ), dus θ = atan2(−dz, dx).
 */
export function angleFromCenterDeg(cx: number, cz: number, px: number, pz: number): number {
  return normalizeDeg((Math.atan2(-(pz - cz), px - cx) * 180) / Math.PI);
}

export type SheetSnap = "half" | "full";
export const SHEET_DRAG_THRESHOLD_PX = 80;
export const SHEET_TAP_PX = 6;

/**
 * Wat gebeurt er als de handle van de drawer wordt losgelaten? `dy` is de verticale
 * verplaatsing (positief = omlaag). Een tik (bijna geen beweging) wisselt half/vol.
 */
export function decideSheetSnap(snap: SheetSnap, dy: number): SheetSnap | "close" {
  if (Math.abs(dy) < SHEET_TAP_PX) return snap === "half" ? "full" : "half";
  if (dy > SHEET_DRAG_THRESHOLD_PX) return snap === "full" ? "half" : "close";
  if (dy < -SHEET_DRAG_THRESHOLD_PX) return "full";
  return snap;
}

export type QualitySetting = "auto" | "hoog" | "laag";
export const QUALITY_SETTINGS: readonly QualitySetting[] = ["auto", "hoog", "laag"];

export type RenderQuality = { dpr: number; antialias: boolean };

/**
 * Pixel ratio en antialiasing per kwaliteitsinstelling.
 * - hoog: min(devicePixelRatio, 2), antialias aan.
 * - laag: 1, antialias uit.
 * - auto: als hoog, maar op zwakke toestellen (weinig cores/geheugen) of nadat de
 *   prestatiemonitor te lage fps zag, stapsgewijs lager (`autoFactor` 0..1, 1 = hoog).
 */
export function resolveQuality(input: {
  setting: QualitySetting;
  devicePixelRatio: number;
  lowEndDevice: boolean;
  autoFactor: number;
}): RenderQuality {
  const max = Math.max(1, Math.min(2, input.devicePixelRatio));
  if (input.setting === "hoog") return { dpr: max, antialias: true };
  if (input.setting === "laag") return { dpr: 1, antialias: false };
  const cap = input.lowEndDevice ? Math.min(max, 1.5) : max;
  const factor = Math.max(0, Math.min(1, input.autoFactor));
  const dpr = Math.round((1 + (cap - 1) * factor) * 20) / 20;
  return { dpr, antialias: !input.lowEndDevice && factor > 0.5 };
}

export type TapRecord = { time: number; x: number; y: number };
export const DOUBLE_TAP_MS = 350;
export const DOUBLE_TAP_PX = 30;

export function isDoubleTap(previous: TapRecord | null, next: TapRecord): boolean {
  if (!previous) return false;
  return next.time - previous.time <= DOUBLE_TAP_MS && Math.hypot(next.x - previous.x, next.y - previous.y) <= DOUBLE_TAP_PX;
}

/** Een tik (geen sleepbeweging) volgens R3F's `delta` (pixels tussen down en up). */
export function isTapDelta(delta: number): boolean {
  return delta < 6;
}

export type DraftPlan = { savedAt: number; naam: string; room: unknown; items: unknown[]; coneFields: unknown[] };

export function draftStorageKey(floorplanId: string | null): string {
  return `gymwiki.floorplan3d.draft.${floorplanId ?? "nieuw"}`;
}

/** Biedt het herstel van een lokale kladversie aan als die afwijkt van wat er geladen is. */
export function shouldOfferDraft(draft: DraftPlan | null, loaded: { naam: string; room: unknown; items: unknown[]; coneFields: unknown[] }): boolean {
  if (!draft) return false;
  const same =
    draft.naam === loaded.naam &&
    JSON.stringify(draft.room) === JSON.stringify(loaded.room) &&
    JSON.stringify(draft.items) === JSON.stringify(loaded.items) &&
    JSON.stringify(draft.coneFields) === JSON.stringify(loaded.coneFields);
  if (same) return false;
  // Een lege nieuwe plattegrond is geen herstel waard.
  return draft.items.length > 0 || draft.coneFields.length > 0;
}

/** Welk paneel is open op telefoon/tablet (één tegelijk). */
export type MobilePanel = "materiaal" | "item" | "rotatie" | "kamer" | "lijst" | null;
