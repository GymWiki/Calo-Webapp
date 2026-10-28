// Validatie van 3D-plattegrond-JSON met dezelfde bouwstenen als de app:
// het zod-schema (types/floorplan3d.ts) en de voetafdruk/SAT-geometrie
// (components/canvas-3d/floorplan3d-geometry.ts). Regels die de app zelf NIET
// afdwingt (maar die voor gegenereerde plattegronden wel nodig zijn) staan
// in docs/ai-plattegrond-briefing.md onder "Strengere regels dan de app".

import { floorplan3dDataSchema } from "@/types/floorplan3d";
import {
  footprintAabb,
  footprintCorners,
  footprintsOverlap,
  ROTATION_STEP_SMALL_DEG,
  type DimsLookup,
} from "@/components/canvas-3d/floorplan3d-geometry";

export type Issue = { severity: "error" | "warning"; path: string; message: string };

const EPS = 0.002; // 2 mm: tolerantie voor afrondingen en "precies tegen elkaar".
const ROOT_KEYS = ["version", "room", "items"];
const ROOM_KEYS = ["width_m", "length_m"];
const ITEM_KEYS = ["id", "slug", "x", "y", "z", "rot_y_deg"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownKeys(value: unknown, allowed: string[], path: string, issues: Issue[]) {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push({
        severity: "error",
        path: path ? `${path}.${key}` : key,
        message: `Onbekend veld "${key}": het formaat kent alleen ${allowed.join(", ")}; de app negeert/verwijdert dit veld.`,
      });
    }
  }
}

/** Accepteert de kale data of de generatie-envelop { aannames, plattegrond }. */
export function unwrapEnvelope(input: unknown): unknown {
  if (isRecord(input) && "plattegrond" in input) return input.plattegrond;
  return input;
}

function decimals(value: number): number {
  const text = String(value);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function validatePlattegrond(input: unknown, lookup: DimsLookup): Issue[] {
  const data = unwrapEnvelope(input);
  const issues: Issue[] = [];

  if (isRecord(data)) {
    unknownKeys(data, ROOT_KEYS, "", issues);
    unknownKeys(data.room, ROOM_KEYS, "room", issues);
    if (Array.isArray(data.items)) {
      data.items.forEach((item, i) => unknownKeys(item, ITEM_KEYS, `items[${i}]`, issues));
    }
  }

  const parsed = floorplan3dDataSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({ severity: "error", path: issue.path.join(".") || "(root)", message: issue.message });
    }
    return issues;
  }

  const { room, items } = parsed.data;

  const finite = (value: number, path: string) => {
    if (!Number.isFinite(value)) {
      issues.push({ severity: "error", path, message: "Waarde moet een eindig getal zijn." });
      return false;
    }
    return true;
  };
  finite(room.width_m, "room.width_m");
  finite(room.length_m, "room.length_m");
  if (room.width_m < 1 || room.length_m < 1) {
    issues.push({ severity: "warning", path: "room", message: "Zaal kleiner dan 1 m (de editor-invoer staat min=1)." });
  }
  if (issues.some((issue) => issue.severity === "error" && issue.path.startsWith("room"))) return issues;

  const halfX = room.width_m / 2;
  const halfZ = room.length_m / 2;
  const seen = new Map<string, number>();
  const known: number[] = [];

  items.forEach((item, i) => {
    const p = `items[${i}]`;
    const ok = [finite(item.x, `${p}.x`), finite(item.y, `${p}.y`), finite(item.z, `${p}.z`), finite(item.rot_y_deg, `${p}.rot_y_deg`)];
    if (!ok.every(Boolean)) return;

    if (seen.has(item.id)) {
      issues.push({ severity: "error", path: `${p}.id`, message: `Dubbel item-id "${item.id}" (ook items[${seen.get(item.id)}]).` });
    }
    seen.set(item.id, i);

    const dims = lookup(item.slug);
    if (!dims) {
      issues.push({ severity: "error", path: `${p}.slug`, message: `Onbekend item-id "${item.slug}": staat niet in de catalogus (de app toont dit als grijs 0,5 m-blokje).` });
      return;
    }
    known.push(i);

    if (item.rot_y_deg < 0 || item.rot_y_deg >= 360) {
      issues.push({ severity: "warning", path: `${p}.rot_y_deg`, message: "Buiten 0 ≤ rot < 360; de editor normaliseert naar dat bereik." });
    }
    const steps = item.rot_y_deg / ROTATION_STEP_SMALL_DEG;
    if (Math.abs(steps - Math.round(steps)) > 1e-9) {
      issues.push({ severity: "error", path: `${p}.rot_y_deg`, message: `Rotatie ${item.rot_y_deg}° is geen veelvoud van ${ROTATION_STEP_SMALL_DEG}° (de rotatiestap van de editor).` });
    }
    if (item.y < -EPS) {
      issues.push({ severity: "error", path: `${p}.y`, message: "y is negatief (item onder de vloer)." });
    }
    for (const key of ["x", "y", "z"] as const) {
      if (decimals(item[key]) > 3) {
        issues.push({ severity: "warning", path: `${p}.${key}`, message: "Meer dan 3 decimalen (mm-precisie is genoeg)." });
      }
    }

    const box = footprintAabb(item.x, item.z, dims.length_m, dims.width_m, item.rot_y_deg);
    const outside: string[] = [];
    if (box.minX < -halfX - EPS) outside.push(`${(-halfX - box.minX).toFixed(3)} m voorbij x=${-halfX}`);
    if (box.maxX > halfX + EPS) outside.push(`${(box.maxX - halfX).toFixed(3)} m voorbij x=${halfX}`);
    if (box.minZ < -halfZ - EPS) outside.push(`${(-halfZ - box.minZ).toFixed(3)} m voorbij z=${-halfZ}`);
    if (box.maxZ > halfZ + EPS) outside.push(`${(box.maxZ - halfZ).toFixed(3)} m voorbij z=${halfZ}`);
    if (outside.length > 0) {
      issues.push({ severity: "error", path: p, message: `Item "${item.slug}" valt buiten de zaal (${room.width_m}×${room.length_m} m): ${outside.join(", ")}.` });
    }
  });

  const feet = new Map<number, ReturnType<typeof footprintCorners>>();
  for (const i of known) {
    const item = items[i];
    const dims = lookup(item.slug)!;
    // 2 mm kleiner, zodat items die precies tegen elkaar staan niet als overlap tellen.
    feet.set(i, footprintCorners(item.x, item.z, dims.length_m - EPS, dims.width_m - EPS, item.rot_y_deg));
  }

  for (let a = 0; a < known.length; a++) {
    for (let b = a + 1; b < known.length; b++) {
      const ia = known[a];
      const ib = known[b];
      if (!footprintsOverlap(feet.get(ia)!, feet.get(ib)!)) continue;
      const da = lookup(items[ia].slug)!;
      const db = lookup(items[ib].slug)!;
      const verticalOverlap =
        items[ia].y < items[ib].y + db.height_m - EPS && items[ib].y < items[ia].y + da.height_m - EPS;
      if (verticalOverlap) {
        issues.push({
          severity: "error",
          path: `items[${ia}]`,
          message: `Overlapt met items[${ib}] ("${items[ia].slug}" en "${items[ib].slug}" delen vloeroppervlak op dezelfde hoogte).`,
        });
      }
    }
  }

  for (const i of known) {
    const item = items[i];
    if (item.y <= EPS) continue;
    const supporters = known.filter((j) => {
      if (j === i || !feet.has(j) || !footprintsOverlap(feet.get(i)!, feet.get(j)!)) return false;
      const d = lookup(items[j].slug)!;
      return Math.abs(items[j].y + d.height_m - item.y) <= EPS;
    });
    if (supporters.length === 0) {
      issues.push({ severity: "error", path: `items[${i}].y`, message: `Item zweeft op y=${item.y}: geen item eronder met bovenkant op die hoogte.` });
    } else if (!supporters.some((j) => lookup(items[j].slug)!.stackable)) {
      issues.push({ severity: "error", path: `items[${i}].y`, message: "Rust op een niet-stapelbaar item." });
    }
    issues.push({
      severity: "warning",
      path: `items[${i}].y`,
      message: "Gestapeld item: de app herberekent y bij het laden (recomputeStackedYs) en dat geeft nu verkeerde hoogtes voor stapels. Vermijd stapelen in gegenereerde plattegronden.",
    });
  }

  return issues;
}
