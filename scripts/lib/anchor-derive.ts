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
const CONE = /^(pion_|pionnen|dopje_|dopjes_kleurenset|hoekvlag)|kegel/i;
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
 * Hoogste punt van de paal waar nog een touw aan kan: onder een breder deel dat boven op de paal zit (korf, bord), met 7 cm ruimte.
 * Zo komt een touw aan de paal uit en niet door de korf of het bord.
 */
function attachCeiling(pole: Pole, parts: GlbPart[]): { y: number; by: string | null } {
  const lower = pole.bottom + (pole.top - pole.bottom) * 0.5;
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

function poleAnchors(poles: Pole[], parts: GlbPart[], notes: string[]): AnchorDef[] {
  const sorted = [...poles].sort((a, b) => a.cx - b.cx || a.cz - b.cz);
  return sorted.map((pole, index) => {
    const { y, by } = attachCeiling(pole, parts);
    if (by) notes.push(`paal ${index + 1}: aanhechting onder "${by}" (${y.toFixed(2)} m)`);
    // Hangend (reikt niet tot de vloer): een ophangpunt van een ring, touw of net; geen paal waar je langs omhoog schuift.
    const hanging = pole.bottom > 0.3;
    const prefix = hanging ? "ophang" : "paal";
    const id = sorted.length === 1 ? `${prefix}_top` : `${prefix}_${index + 1}`;
    const side = sorted.length === 2 ? (index === 0 ? " links" : " rechts") : sorted.length > 2 ? ` ${index + 1}` : "";
    return {
      id,
      label: hanging ? `Ophangpunt${side} (bovenin)` : `Paal${side}${by ? " (onder de korf/bord)" : " (bovenin)"}`,
      pos: R([pole.cx, y, pole.cz]),
      types: ["touw", "lint", "net", "haak"],
      default: true,
      ...(hanging ? {} : { adjustable: { min: r3(Math.min(Math.max(0.1, pole.bottom + 0.1), y)), max: y } }),
      source: "afgeleid",
    } satisfies AnchorDef;
  });
}

// --- kegel / pion ----------------------------------------------------------------------------------------------------

function coneAnchors(parts: GlbPart[]): AnchorDef[] {
  const solid = parts.filter((p) => p.max[1] - p.min[1] > 0.005);
  const groups = groupByAxis(solid, 0.04).sort((a, b) => centerXZ(a[0])[0] - centerXZ(b[0])[0]).slice(0, 8);
  return groups.map((group, index) => {
    const top = Math.max(...group.map((p) => p.max[1]));
    const topPart = group.reduce((a, b) => (b.max[1] > a.max[1] ? b : a));
    const [cx, cz] = centerXZ(topPart);
    const id = groups.length === 1 ? "top" : `top_${index + 1}`;
    return { id, label: groups.length === 1 ? "Top" : `Top ${index + 1}`, pos: R([cx, top, cz]), types: ["touw", "lint", "haak"], default: index === 0, source: "afgeleid" } satisfies AnchorDef;
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

export function topAnchors(parts: GlbPart[]): AnchorDef[] {
  const box = all(parts);
  const top = box.max[1];
  const band = Math.max(0.03, (box.max[1] - box.min[1]) * 0.01);
  const points: Vec3[] = [];
  for (const p of parts) for (let i = 0; i < p.positions.length; i += 3) if (p.positions[i + 1] >= top - band) points.push([p.positions[i], p.positions[i + 1], p.positions[i + 2]]);
  // Clusters op 15 cm in het XZ-vlak.
  const clusters: Vec3[][] = [];
  for (const pt of points) {
    const c = clusters.find((cl) => cl.some((q) => Math.hypot(q[0] - pt[0], q[2] - pt[2]) <= 0.15));
    if (c) c.push(pt);
    else clusters.push([pt]);
  }
  const ranked = clusters
    .map((cl) => {
      const mean: Vec3 = [cl.reduce((s, q) => s + q[0], 0) / cl.length, Math.max(...cl.map((q) => q[1])), cl.reduce((s, q) => s + q[2], 0) / cl.length];
      return { mean, size: cl.length, pts: cl };
    })
    .sort((a, b) => b.size - a.size)
    .slice(0, 4)
    .sort((a, b) => a.mean[0] - b.mean[0]);
  return ranked.map((c, index) => {
    // Zit het midden van het cluster naast de geometrie (bijv. in het gat van een ring)? Pak dan het dichtstbijzijnde vertex.
    const onGeometry = nearestVertexIn(c.pts, c.mean);
    return {
      id: ranked.length === 1 ? "top" : `top_${index + 1}`,
      label: ranked.length === 1 ? "Bovenkant (midden)" : `Bovenpunt ${index + 1}`,
      pos: R([c.mean[0], onGeometry[1], c.mean[2]]),
      types: ["touw", "lint", "net", "haak"],
      default: index === 0,
      source: "fallback",
    } satisfies AnchorDef;
  });
}

function nearestVertexIn(points: Vec3[], target: Vec3): Vec3 {
  return points.reduce((best, q) => (Math.hypot(q[0] - target[0], q[2] - target[2]) < Math.hypot(best[0] - target[0], best[2] - target[2]) ? q : best), points[0]);
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
    const poles = findPoles(parts);
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

/** Afstand van een punt tot een driehoek (Ericson, Real-Time Collision Detection). */
export function pointTriangleDistance(p: Vec3, a: Vec3, b: Vec3, c: Vec3): number {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return Math.hypot(...ap);
  const bp = sub(p, b);
  const d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return Math.hypot(...bp);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return Math.hypot(ap[0] - ab[0] * v, ap[1] - ab[1] * v, ap[2] - ab[2] * v);
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return Math.hypot(...cp);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return Math.hypot(ap[0] - ac[0] * w, ap[1] - ac[1] * w, ap[2] - ac[2] * w);
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const bc = sub(c, b);
    return Math.hypot(bp[0] - bc[0] * w, bp[1] - bc[1] * w, bp[2] - bc[2] * w);
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  return Math.hypot(ap[0] - ab[0] * v - ac[0] * w, ap[1] - ab[1] * v - ac[1] * w, ap[2] - ab[2] * v - ac[2] * w);
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
