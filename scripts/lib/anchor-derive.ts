// Leidt bevestigingspunten (anchors) af uit de ECHTE zichtbare geometrie van een GLB, en meet ze na. Puur (geen bestanden, geen netwerk):
// gebruikt door scripts/audit-anchors.ts en getest in scripts/lib/anchor-derive.test.ts.
//
// Volgorde: 1) `anchor_<type>_<naam>`-nodes in het GLB, 2) herkende vormen (net, paal, kegel), 3) noodoplossing: het hoogste punt in het
// midden van de zichtbare geometrie (NIET de rand of hoek van de bounding box). Elke anchor ligt altijd op of in de echte geometrie.

import { parseAnchorNodeName, type AnchorDef } from "@/components/canvas-3d/anchors";
import type { GlbGeometry, GlbPart, Vec3 } from "./glb-geometry.ts";

export type AnchorClass = "glb" | "net" | "paal" | "kegel" | "bovenpunt";
export type DerivedProfile = { cls: AnchorClass; anchors: AnchorDef[]; notes: string[] };

const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const R = (p: Vec3): Vec3 => [r3(p[0]), r3(p[1]), r3(p[2])];

/** Handhelds en losse spullen: hier hoort geen touw aan. */
const HANDHELD = /(racket|stick|knuppel|honkbal(knuppel)?|bat\b|paddle|crosse|batje|fluit|bal$|ballen|shuttle|puck)/i;
const CONE = /^(pion_|pionnen|dopje_|dopjes_kleurenset)|kegel/i;
const NET = /^(volleybal|badminton)net_/i;

const all = (parts: GlbPart[]) => ({
  min: [0, 1, 2].map((i) => Math.min(...parts.map((p) => p.min[i]))) as Vec3,
  max: [0, 1, 2].map((i) => Math.max(...parts.map((p) => p.max[i]))) as Vec3,
});

const centerXZ = (p: GlbPart): [number, number] => [(p.min[0] + p.max[0]) / 2, (p.min[2] + p.max[2]) / 2];
const sizeXZ = (p: GlbPart): number => Math.max(p.max[0] - p.min[0], p.max[2] - p.min[2]);

function groupByAxis(parts: GlbPart[], tolerance: number): GlbPart[][] {
  const groups: GlbPart[][] = [];
  for (const part of parts) {
    const [cx, cz] = centerXZ(part);
    const group = groups.find((g) => {
      const [gx, gz] = centerXZ(g[0]);
      return Math.hypot(gx - cx, gz - cz) <= tolerance;
    });
    if (group) group.push(part);
    else groups.push([part]);
  }
  return groups;
}

/** Het dichtstbijzijnde vertex van `parts` bij `target` (zodat een punt altijd echt op de geometrie ligt). */
export function nearestVertex(parts: GlbPart[], target: Vec3): Vec3 {
  let best: Vec3 = target;
  let bestD = Infinity;
  for (const part of parts) {
    const p = part.positions;
    for (let i = 0; i < p.length; i += 3) {
      const d = (p[i] - target[0]) ** 2 + (p[i + 1] - target[1]) ** 2 + (p[i + 2] - target[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = [p[i], p[i + 1], p[i + 2]];
      }
    }
  }
  return best;
}

/** Het dichtstbijzijnde punt op de echte geometrie (zodat een punt nooit naast het model ligt). */
export function snapToParts(p: Vec3, parts: GlbPart[]): Vec3 {
  let best: Vec3 = p;
  let bestD = Infinity;
  for (const part of parts) {
    const v = part.positions;
    const t = part.triangles;
    for (let i = 0; i < t.length; i += 3) {
      const a: Vec3 = [v[t[i] * 3], v[t[i] * 3 + 1], v[t[i] * 3 + 2]];
      const b: Vec3 = [v[t[i + 1] * 3], v[t[i + 1] * 3 + 1], v[t[i + 1] * 3 + 2]];
      const c: Vec3 = [v[t[i + 2] * 3], v[t[i + 2] * 3 + 1], v[t[i + 2] * 3 + 2]];
      const q = closestPointOnTriangle(p, a, b, c);
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  return best;
}

// --- paal ------------------------------------------------------------------------------------------------------------

type Pole = { top: number; bottom: number; cx: number; cz: number; parts: GlbPart[] };

function findPoles(parts: GlbPart[]): Pole[] {
  const slender = parts.filter((p) => {
    const h = p.max[1] - p.min[1];
    const w = sizeXZ(p);
    return h >= 0.15 && w <= 0.15 && h >= 3 * w;
  });
  return groupByAxis(slender, 0.04)
    .map((group) => {
      const top = Math.max(...group.map((p) => p.max[1]));
      const bottom = Math.min(...group.map((p) => p.min[1]));
      const topPart = group.reduce((a, b) => (b.max[1] > a.max[1] ? b : a));
      const [cx, cz] = centerXZ(topPart);
      return { top, bottom, cx, cz, parts: group };
    })
    .filter((pole) => pole.top - pole.bottom >= 0.4);
}

/**
 * Alleen de echte palen: hoog genoeg (minstens 0,7 m of 80% van het asset), de hoogste van het asset, en hangende delen alleen als ze
 * bovenaan hangen. Heel veel slanke delen is een rek of frame, geen losse palen.
 */
function mainPoles(poles: Pole[], parts: GlbPart[]): Pole[] {
  if (poles.length === 0) return [];
  const globalTop = Math.max(...parts.map((p) => p.max[1]));
  const tallest = Math.max(...poles.map((p) => p.top));
  const kept = poles.filter((p) => {
    const length = p.top - p.bottom;
    const hanging = p.bottom > 0.3;
    if (hanging && p.top < globalTop - 0.15) return false;
    return p.top >= tallest - 0.1 && p.top >= globalTop * 0.75 && (length >= 0.7 || length >= globalTop * 0.8);
  });
  return kept.length > 6 ? [] : kept;
}

/**
 * Hoogste punt van de paal waar nog een touw aan kan: onder een breder deel dat boven op de paal zit (korf, bord), met 7 cm ruimte.
 * Zo komt een touw aan de paal uit en niet door de korf of het bord.
 */
function attachCeiling(pole: Pole, parts: GlbPart[]): { y: number; by: string | null } {
  // Alleen een breder deel dat BOVEN OP de paal zit (onderkant in het bovenste kwart van de paal) telt, geen net of band die er langs loopt.
  const lower = pole.top - (pole.top - pole.bottom) * 0.25;
  let y = pole.top;
  let by: string | null = null;
  for (const part of parts) {
    if (pole.parts.includes(part) || part.min[1] < lower) continue;
    const covers = pole.cx >= part.min[0] - 0.01 && pole.cx <= part.max[0] + 0.01 && pole.cz >= part.min[2] - 0.01 && pole.cz <= part.max[2] + 0.01;
    const wider = sizeXZ(part) >= 2 * Math.max(...pole.parts.map(sizeXZ));
    if (covers && wider && part.min[1] - 0.07 < y) {
      y = part.min[1] - 0.07;
      by = part.name;
    }
  }
  return { y: r3(y), by };
}

function snapIfOff(p: Vec3, parts: GlbPart[]): Vec3 {
  return distanceToGeometry(p, parts) > 0.015 ? snapToParts(p, parts) : p;
}

function poleAnchors(poles: Pole[], parts: GlbPart[], notes: string[]): AnchorDef[] {
  const sorted = [...poles].sort((a, b) => a.cx - b.cx || a.cz - b.cz);
  return sorted.map((pole, index) => {
    // Hangende delen (touwen, ringen) hangen aan hun top; daar komt geen plafond onder een breder deel.
    const hangs = pole.bottom > 0.3;
    const { y, by } = hangs ? { y: r3(pole.top), by: null } : attachCeiling(pole, parts);
    if (by) notes.push(`paal ${index + 1}: aanhechting onder "${by}" (${y.toFixed(2)} m)`);
    // Hangend (reikt niet tot de vloer): een ophangpunt van een ring, touw of net; geen paal waar je langs omhoog schuift.
    const hanging = pole.bottom > 0.3;
    const prefix = hanging ? "ophang" : "paal";
    const id = sorted.length === 1 ? `${prefix}_top` : `${prefix}_${index + 1}`;
    const side = sorted.length === 2 ? (index === 0 ? " links" : " rechts") : sorted.length > 2 ? ` ${index + 1}` : "";
    return {
      id,
      label: hanging ? `Ophangpunt${side} (bovenin)` : `Paal${side}${by ? " (onder de korf/bord)" : " (bovenin)"}`,
      pos: R(snapIfOff([pole.cx, y, pole.cz], pole.parts)),
      types: ["touw", "lint", "net", "haak"],
      default: true,
      ...(hanging ? {} : { adjustable: { min: r3(Math.min(Math.max(0.1, pole.bottom + 0.1), y)), max: y } }),
      source: "afgeleid",
    } satisfies AnchorDef;
  });
}

// --- kegel / pion ----------------------------------------------------------------------------------------------------

function coneAnchors(parts: GlbPart[]): AnchorDef[] {
  // Lange horizontale delen (een hordestok tussen twee pionnen) zijn geen pion.
  const solid = parts.filter((p) => p.max[1] - p.min[1] > 0.005 && sizeXZ(p) <= 0.6);
  const groups = groupByAxis(solid, 0.04).sort((a, b) => centerXZ(a[0])[0] - centerXZ(b[0])[0]).slice(0, 8);
  return groups.map((group, index) => {
    const [top] = topAnchors(group);
    const id = groups.length === 1 ? "top" : `top_${index + 1}`;
    return { id, label: groups.length === 1 ? "Top" : `Top ${index + 1}`, pos: top.pos, types: ["touw", "lint", "haak"], default: index === 0, source: "afgeleid" } satisfies AnchorDef;
  });
}

// --- net -------------------------------------------------------------------------------------------------------------

function netAnchors(parts: GlbPart[]): AnchorDef[] {
  const box = all(parts);
  const zMid = (box.min[2] + box.max[2]) / 2;
  const end = (side: "min" | "max") => {
    const x = side === "min" ? box.min[0] : box.max[0];
    const candidates = parts.flatMap((p) => {
      const pts: Vec3[] = [];
      for (let i = 0; i < p.positions.length; i += 3) if (Math.abs(p.positions[i] - x) <= 0.03) pts.push([p.positions[i], p.positions[i + 1], p.positions[i + 2]]);
      return pts;
    });
    const top = Math.max(...candidates.map((c) => c[1]));
    const onTop = candidates.filter((c) => c[1] >= top - 0.01);
    const z = onTop.reduce((s, c) => s + c[2], 0) / onTop.length;
    return nearestVertex(parts, [x, top, Number.isFinite(z) ? z : zMid]);
  };
  const left = end("min");
  const right = end("max");
  return [
    { id: "net_links", label: "Net: linker bovenhoek", pos: R(left), types: ["net", "lint", "touw"], default: true, source: "afgeleid" },
    { id: "net_rechts", label: "Net: rechter bovenhoek", pos: R(right), types: ["net", "lint", "touw"], source: "afgeleid" },
  ];
}

// --- noodoplossing: hoogste punt, midden van de echte geometrie -------------------------------------------------------

type Tri = { a: Vec3; b: Vec3; c: Vec3; area: number; centroid: Vec3 };

function trianglesOf(parts: GlbPart[]): Tri[] {
  const out: Tri[] = [];
  for (const part of parts) {
    const v = part.positions;
    const t = part.triangles;
    for (let i = 0; i < t.length; i += 3) {
      const a: Vec3 = [v[t[i] * 3], v[t[i] * 3 + 1], v[t[i] * 3 + 2]];
      const b: Vec3 = [v[t[i + 1] * 3], v[t[i + 1] * 3 + 1], v[t[i + 1] * 3 + 2]];
      const c: Vec3 = [v[t[i + 2] * 3], v[t[i + 2] * 3 + 1], v[t[i + 2] * 3 + 2]];
      const ab = sub(b, a), ac = sub(c, a);
      const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      out.push({ a, b, c, area: Math.hypot(n[0], n[1], n[2]) / 2, centroid: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] });
    }
  }
  return out;
}

const key = (p: Vec3) => `${Math.round(p[0] * 500)},${Math.round(p[1] * 500)},${Math.round(p[2] * 500)}`;

/**
 * Het hoogste punt in het MIDDEN van de echte geometrie: de bovenste vlakken (driehoeken waarvan alle hoekpunten bij het hoogste punt liggen),
 * per aaneengesloten vlak het zwaartepunt, vastgezet op het dichtstbijzijnde punt van dat vlak. Dus nooit een hoek of rand van de bounding box,
 * en bij een ring (gat in het midden) een punt op de ring zelf.
 */
export function topAnchors(parts: GlbPart[]): AnchorDef[] {
  const box = all(parts);
  const height = box.max[1] - box.min[1];
  const band = Math.min(0.03, Math.max(0.003, height * 0.05));
  const top = box.max[1];
  const tris = trianglesOf(parts).filter((t) => t.area > 1e-8 && t.a[1] >= top - band && t.b[1] >= top - band && t.c[1] >= top - band);

  // Aaneengesloten vlakken (gedeelde hoekpunten) met union-find.
  const parent = tris.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map<string, number>();
  tris.forEach((t, i) => {
    for (const p of [t.a, t.b, t.c]) {
      const k = key(p);
      const other = owner.get(k);
      if (other === undefined) owner.set(k, i);
      else parent[find(i)] = find(other);
    }
  });
  const groups = new Map<number, Tri[]>();
  tris.forEach((t, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), t]));

  type Face = { centroid: Vec3; area: number; tris: Tri[] };
  const faces: Face[] = [...groups.values()].map((g) => {
    const area = g.reduce((s, t) => s + t.area, 0);
    const centroid: Vec3 = [g.reduce((s, t) => s + t.centroid[0] * t.area, 0) / area, g.reduce((s, t) => s + t.centroid[1] * t.area, 0) / area, g.reduce((s, t) => s + t.centroid[2] * t.area, 0) / area];
    return { centroid, area, tris: g };
  });

  let points: { pos: Vec3 }[];
  if (faces.length > 0) {
    points = faces
      .sort((a, b) => b.area - a.area)
      .slice(0, 4)
      .sort((a, b) => a.centroid[0] - b.centroid[0])
      .map((f) => {
        // Zit het zwaartepunt op/in de vlakken zelf? Anders (ring) het dichtstbijzijnde punt op het vlak.
        let best: Vec3 = f.centroid;
        let bestD = Infinity;
        for (const t of f.tris) {
          const q = closestPointOnTriangle(f.centroid, t.a, t.b, t.c);
          const d = Math.hypot(q[0] - f.centroid[0], q[1] - f.centroid[1], q[2] - f.centroid[2]);
          if (d < bestD) {
            bestD = d;
            best = q;
          }
        }
        return { pos: best };
      });
  } else {
    // Geen plat bovenvlak (bijv. een punt of een bol): het hoogste vertex.
    let hi: Vec3 = [0, -Infinity, 0];
    for (const p of parts) for (let i = 0; i < p.positions.length; i += 3) if (p.positions[i + 1] > hi[1]) hi = [p.positions[i], p.positions[i + 1], p.positions[i + 2]];
    points = [{ pos: hi }];
  }
  return points.map((c, index) => ({
    id: points.length === 1 ? "top" : `top_${index + 1}`,
    label: points.length === 1 ? "Bovenkant (midden)" : `Bovenpunt ${index + 1}`,
    pos: R(c.pos),
    types: ["touw", "lint", "net", "haak"],
    default: index === 0,
    source: "fallback",
  } satisfies AnchorDef));
}

// --- hoofdfunctie ----------------------------------------------------------------------------------------------------

export function deriveAnchors(slug: string, geo: GlbGeometry): DerivedProfile {
  const notes: string[] = [];

  const named: AnchorDef[] = geo.anchorNodes
    .map((node): AnchorDef | null => {
      const parsed = parseAnchorNodeName(node.name);
      return parsed ? { id: parsed.id, label: parsed.label, pos: R(node.position), dir: R(node.direction), types: parsed.types, source: "glb" } : null;
    })
    .filter((a): a is AnchorDef => a !== null);
  if (named.length > 0) {
    named[0].default = true;
    return { cls: "glb", anchors: named, notes: [`${named.length} anchor-node(s) uit het GLB`] };
  }
  for (const node of geo.anchorNodes) notes.push(`node "${node.name}" volgt de naamconventie niet (anchor_<touw|lint|net|haak>_<naam>)`);

  const parts = geo.parts;
  if (NET.test(slug)) return { cls: "net", anchors: netAnchors(parts), notes };
  if (CONE.test(slug)) return { cls: "kegel", anchors: coneAnchors(parts), notes };
  if (!HANDHELD.test(slug)) {
    const poles = mainPoles(findPoles(parts), parts);
    if (poles.length > 0) return { cls: "paal", anchors: poleAnchors(poles, parts, notes), notes };
  }
  return { cls: "bovenpunt", anchors: topAnchors(parts), notes };
}

// --- meten -----------------------------------------------------------------------------------------------------------

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const RAY: Vec3 = [0.9997, 0.0173, 0.0171];

/** Het dichtstbijzijnde punt op een driehoek (Ericson, Real-Time Collision Detection). */
export function closestPointOnTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b);
  const d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v];
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w];
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const bc = sub(c, b);
    return [b[0] + bc[0] * w, b[1] + bc[1] * w, b[2] + bc[2] * w];
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}

/** Afstand van een punt tot een driehoek. */
export function pointTriangleDistance(p: Vec3, a: Vec3, b: Vec3, c: Vec3): number {
  const q = closestPointOnTriangle(p, a, b, c);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** Ligt het punt binnen een gesloten mesh? (even/oneven-test met een straal langs +X.) */
function insidePart(p: Vec3, part: GlbPart): boolean {
  if (p[0] < part.min[0] - 1e-6 || p[0] > part.max[0] + 1e-6 || p[1] < part.min[1] - 1e-6 || p[1] > part.max[1] + 1e-6 || p[2] < part.min[2] - 1e-6 || p[2] > part.max[2] + 1e-6) return false;
  const v = part.positions;
  const t = part.triangles;
  let hits = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a: Vec3 = [v[t[i] * 3], v[t[i] * 3 + 1], v[t[i] * 3 + 2]];
    const b: Vec3 = [v[t[i + 1] * 3], v[t[i + 1] * 3 + 1], v[t[i + 1] * 3 + 2]];
    const c: Vec3 = [v[t[i + 2] * 3], v[t[i + 2] * 3 + 1], v[t[i + 2] * 3 + 2]];
    // Möller–Trumbore met een licht scheve richting: een straal precies langs een gedeelde driehoekrand zou anders dubbel tellen.
    const e1 = sub(b, a), e2 = sub(c, a);
    const h = cross(RAY, e2);
    const det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det;
    const s = sub(p, a);
    const u = f * dot(s, h);
    if (u < 0 || u > 1) continue;
    const q = cross(s, e1);
    const w = f * dot(RAY, q);
    if (w < 0 || u + w > 1) continue;
    const tt = f * dot(e2, q);
    if (tt > 1e-9) hits++;
  }
  return hits % 2 === 1;
}

/** Afstand (m) van een punt tot de echte zichtbare geometrie; 0 als het punt in een gesloten deel ligt. */
export function distanceToGeometry(p: Vec3, parts: GlbPart[]): number {
  let best = Infinity;
  for (const part of parts) {
    // Snelle afkap: ruim buiten de box van dit deel kan niet beter zijn.
    const dx = Math.max(part.min[0] - p[0], 0, p[0] - part.max[0]);
    const dy = Math.max(part.min[1] - p[1], 0, p[1] - part.max[1]);
    const dz = Math.max(part.min[2] - p[2], 0, p[2] - part.max[2]);
    if (Math.hypot(dx, dy, dz) >= best) continue;
    if (insidePart(p, part)) return 0;
    const v = part.positions;
    const t = part.triangles;
    for (let i = 0; i < t.length; i += 3) {
      const a: Vec3 = [v[t[i] * 3], v[t[i] * 3 + 1], v[t[i] * 3 + 2]];
      const b: Vec3 = [v[t[i + 1] * 3], v[t[i + 1] * 3 + 1], v[t[i + 1] * 3 + 2]];
      const c: Vec3 = [v[t[i + 2] * 3], v[t[i + 2] * 3 + 1], v[t[i + 2] * 3 + 2]];
      const d = pointTriangleDistance(p, a, b, c);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Zit het punt (binnen 1 cm) tegen twee of meer vlakken van de bounding box van het geheel — zonder dat daar echt geometrie ligt? */
export function onBoundingBoxEdge(p: Vec3, parts: GlbPart[], distanceToGeom: number): boolean {
  const box = all(parts);
  let faces = 0;
  for (let i = 0; i < 3; i++) if (Math.abs(p[i] - box.min[i]) <= 0.01 || Math.abs(p[i] - box.max[i]) <= 0.01) faces++;
  return faces >= 2 && distanceToGeom > 0.005;
}
