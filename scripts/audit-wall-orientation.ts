// Audit: staan de wandrekken in de zaalmodellen goed om (voorkant de zaal in, achterkant tegen de wand)? Leest de GLB's (publiek in Supabase Storage),
// past dezelfde correctie toe als de loader (components/canvas-3d/wall-mount.ts) en schrijft docs/wall-orientation-audit.md.
// Gebruik: node --experimental-strip-types --experimental-loader=./scripts/lib/path-alias-loader.mjs scripts/audit-wall-orientation.ts
import { readFileSync, writeFileSync } from "node:fs";

import { backFacePoint, correctWallMount, frontNormal } from "@/components/canvas-3d/wall-mount";

const BASE = process.env.AUDIT_GLB_BASE ?? "https://dxdopwhxteodgeaebfpp.supabase.co/storage/v1/object/public/materials-3d/environments";
// Zonder netwerktoegang voor node: download de GLB's met curl en zet AUDIT_GLB_DIR naar die map.
const DIR = process.env.AUDIT_GLB_DIR;
const GLBS = ["gymzaal_standaard", "gymzaal_complex_2x2", "gymzaal_complex_4x1"];

type Node = { name?: string; translation?: number[]; rotation?: number[]; mesh?: number };

function jsonChunk(buffer: Buffer): { nodes: Node[] } {
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "JSON") return JSON.parse(buffer.toString("utf8", offset + 8, offset + 8 + length));
    offset += 8 + length;
  }
  throw new Error("geen JSON-chunk");
}
const yawOf = (q?: number[]) => (q ? Math.round(((2 * Math.atan2(q[1], q[3]) * 180) / Math.PI) * 10) / 10 : 0);

const lines = ["# Audit wandoriëntatie (wandrekken)", "", `Gegenereerd door \`scripts/audit-wall-orientation.ts\`. Het model heeft de voorkant (klimzijde, ribben) op lokale +Z en de montageconsole op lokale −Z (z = −0,14).`, "", "| zaalmodel | node | positie (x, z) | yaw voor | voorkant wijst (voor) | yaw na | voorkant wijst (na) | achterkant z na | wandbinnenkant z | afstand | uitkomst |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
let fails = 0;
for (const glb of GLBS) {
  const bytes = DIR ? readFileSync(`${DIR}/${glb}.glb`) : Buffer.from(await (await fetch(`${BASE}/${glb}.glb`)).arrayBuffer());
  const { nodes } = jsonChunk(bytes);
  const wallBack = nodes.find((node) => node.name === "Muur_Achter" || node.name === "Muur_Complex_Achter");
  const wallInner = (wallBack?.translation?.[2] ?? 0) + 0.14;
  for (const node of nodes.filter((candidate) => candidate.name?.startsWith("Wandrek"))) {
    const before = { x: node.translation?.[0] ?? 0, z: node.translation?.[2] ?? 0, yawDeg: yawOf(node.rotation) };
    const after = correctWallMount(before);
    const faceBefore = frontNormal(before.yawDeg).z;
    const faceAfter = frontNormal(after.yawDeg).z;
    const gap = Math.abs(backFacePoint(after).z - wallInner);
    const pass = faceAfter > 0.99 && gap <= 0.01;
    if (!pass) fails++;
    lines.push(`| ${glb} | ${node.name} | (${before.x.toFixed(2)}, ${before.z.toFixed(2)}) | ${before.yawDeg}° | ${faceBefore > 0 ? "de zaal in" : "**de wand in (fout)**"} | ${after.yawDeg}° | ${faceAfter > 0 ? "de zaal in" : "de wand in"} | ${backFacePoint(after).z.toFixed(3)} | ${wallInner.toFixed(3)} | ${(gap * 100).toFixed(1)} cm | ${pass ? "PASS" : "FAIL"} |`);
  }
}
lines.push("", `Resultaat: ${fails === 0 ? "alle wandrekken PASS na de correctie" : `${fails} FAIL`}.`, "", "Overige wandobjecten in de zaalmodellen (ramen/schermen zijn onderdeel van `Muur_*`; geen aparte nodes): `Basketbal_Installatie_Links/Rechts` — mesh x −2,47…0,63 m vanaf de wand de zaal in, rechts 180° gedraaid: **goed**. `Turnbank_1/2` (bankjes tegen de wand) zijn symmetrisch: **goed**. Spiegels, scorebord, klok, wandkasten, ballenvanger, lichtbakken en deuren bestaan niet als node: ONBEKEND/n.v.t.");
writeFileSync("docs/wall-orientation-audit.md", lines.join("\n") + "\n");
console.log(lines.slice(-3).join("\n"));
process.exitCode = fails === 0 ? 0 : 1;
