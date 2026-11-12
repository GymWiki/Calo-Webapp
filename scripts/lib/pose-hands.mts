// Handpunten van een leerlingpose afleiden uit de zichtbare geometrie (de modellen zijn statische meshes zonder skelet): de huidkleurige
// delen van de mesh vormen losse stukken (hoofd, onderarmen met handen, benen); de twee onderarmen zijn de armen, en het handpunt is het
// uiterste punt van zo'n arm, gemeten vanaf de schouder. Resultaat in de ruimte van het verwerkte GLB (pivot onderkant-midden, 1,8 m).
// Bron van waarheid blijft een `anchor_hand_links` / `anchor_hand_rechts` node in het GLB (zie docs/grip-audit.md); dit is de terugval.

import { NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";

export type Vec3 = [number, number, number];
export type HandPoints = { links: Vec3 | null; rechts: Vec3 | null; confidence: "hoog" | "laag" | "geen"; notes: string[] };

type Mesh = { pos: Float32Array; uv: Float32Array; index: Uint32Array };

async function readMesh(path: string): Promise<{ mesh: Mesh; texture: { data: Buffer; width: number; height: number } | null }> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const document: Document = await io.read(path);
  const root = document.getRoot();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let texture = null as { data: Buffer; width: number; height: number } | null;
  for (const node of root.getDefaultScene()!.listChildren()) {
    const m = node.getMesh();
    if (!m) continue;
    const matrix = node.getWorldMatrix();
    for (const prim of m.listPrimitives()) {
      const base = positions.length / 3;
      const posAccessor = prim.getAttribute("POSITION")!;
      const uvAccessor = prim.getAttribute("TEXCOORD_0");
      const out = [0, 0, 0];
      for (let i = 0; i < posAccessor.getCount(); i++) {
        posAccessor.getElement(i, out);
        positions.push(
          matrix[0] * out[0] + matrix[4] * out[1] + matrix[8] * out[2] + matrix[12],
          matrix[1] * out[0] + matrix[5] * out[1] + matrix[9] * out[2] + matrix[13],
          matrix[2] * out[0] + matrix[6] * out[1] + matrix[10] * out[2] + matrix[14],
        );
        if (uvAccessor) {
          const uv = [0, 0];
          uvAccessor.getElement(i, uv);
          uvs.push(uv[0], uv[1]);
        } else uvs.push(0, 0);
      }
      const idx = prim.getIndices()?.getArray();
      if (idx) for (const value of idx) indices.push(base + value);
      const tex = prim.getMaterial()?.getBaseColorTexture();
      if (tex && !texture) {
        const image = tex.getImage();
        if (image) {
          const { data, info } = await sharp(Buffer.from(image)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          texture = { data, width: info.width, height: info.height };
        }
      }
    }
  }
  return { mesh: { pos: new Float32Array(positions), uv: new Float32Array(uvs), index: new Uint32Array(indices) }, texture };
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, max === 0 ? 0 : d / max, max / 255];
}

/** Huid: warme tint (oranje-bruin), middelmatige verzadiging en helderheid; shirt (marineblauw), broek (zwart) en haar (donkerbruin) vallen af. */
function isSkin(r: number, g: number, b: number): boolean {
  const [h, s, v] = rgbToHsv(r, g, b);
  return h >= 8 && h <= 38 && s >= 0.28 && s <= 0.8 && v >= 0.45;
}

export async function deriveHandPoints(path: string): Promise<HandPoints> {
  const { mesh, texture } = await readMesh(path);
  const notes: string[] = [];
  if (!texture) return { links: null, rechts: null, confidence: "geen", notes: ["geen kleurtexture"] };
  const vertexCount = mesh.pos.length / 3;
  const skin = new Uint8Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    const u = Math.min(texture.width - 1, Math.max(0, Math.floor((mesh.uv[i * 2] % 1 + 1) % 1 * texture.width)));
    const v = Math.min(texture.height - 1, Math.max(0, Math.floor((mesh.uv[i * 2 + 1] % 1 + 1) % 1 * texture.height)));
    const o = (v * texture.width + u) * 3;
    skin[i] = isSkin(texture.data[o], texture.data[o + 1], texture.data[o + 2]) ? 1 : 0;
  }
  // Samenhangende stukken van huid-driehoeken (union-find over de hoekpunten). Hoekpunten op dezelfde plek (UV-naden) tellen als één punt.
  const parent = Array.from({ length: vertexCount }, (_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const atPosition = new Map<string, number>();
  for (let i = 0; i < vertexCount; i++) {
    const key = `${Math.round(mesh.pos[i * 3] * 2000)}_${Math.round(mesh.pos[i * 3 + 1] * 2000)}_${Math.round(mesh.pos[i * 3 + 2] * 2000)}`;
    const other = atPosition.get(key);
    if (other === undefined) atPosition.set(key, i);
    else parent[find(i)] = find(other);
  }
  for (let t = 0; t < mesh.index.length; t += 3) {
    const [a, b, c] = [mesh.index[t], mesh.index[t + 1], mesh.index[t + 2]];
    if (skin[a] && skin[b] && skin[c]) {
      parent[find(a)] = find(b);
      parent[find(b)] = find(c);
    }
  }
  if (process.env.HAND_DEBUG) {
    const bins = new Map<string, number>();
    for (let i = 0; i < vertexCount; i += 7) {
      const u = Math.min(texture.width - 1, Math.max(0, Math.floor((((mesh.uv[i * 2] % 1) + 1) % 1) * texture.width)));
      const v = Math.min(texture.height - 1, Math.max(0, Math.floor((((mesh.uv[i * 2 + 1] % 1) + 1) % 1) * texture.height)));
      const o = (v * texture.width + u) * 3;
      const key = [texture.data[o], texture.data[o + 1], texture.data[o + 2]].map((c) => Math.round(c / 40) * 40).join(",");
      bins.set(key, (bins.get(key) ?? 0) + 1);
    }
    console.error("kleuren", [...bins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), texture.width, texture.height);
  }
  if (process.env.HAND_DEBUG) console.error("huidpunten", skin.reduce((a, b) => a + b, 0), "van", vertexCount);
  const comps = new Map<number, number[]>();
  for (let t = 0; t < mesh.index.length; t++) {
    const v = mesh.index[t];
    if (!skin[v]) continue;
    const root = find(v);
    const list = comps.get(root) ?? [];
    list.push(v);
    comps.set(root, list);
  }
  type Comp = { verts: number[]; min: Vec3; max: Vec3; center: Vec3 };
  const parts: Comp[] = [];
  for (const verts of comps.values()) {
    const unique = Array.from(new Set(verts));
    if (unique.length < 30) continue;
    const min: Vec3 = [1e9, 1e9, 1e9];
    const max: Vec3 = [-1e9, -1e9, -1e9];
    const sum: Vec3 = [0, 0, 0];
    for (const v of unique) for (let k = 0; k < 3; k++) {
      const value = mesh.pos[v * 3 + k];
      min[k] = Math.min(min[k], value);
      max[k] = Math.max(max[k], value);
      sum[k] += value;
    }
    parts.push({ verts: unique, min, max, center: [sum[0] / unique.length, sum[1] / unique.length, sum[2] / unique.length] });
  }
  let top = -1e9;
  let bottom = 1e9;
  for (let i = 0; i < vertexCount; i++) {
    top = Math.max(top, mesh.pos[i * 3 + 1]);
    bottom = Math.min(bottom, mesh.pos[i * 3 + 1]);
  }
  const height = top - bottom;
  // Hoofd = het stuk met het hoogste punt. Benen = stukken die tot bij de voeten reiken. De rest zijn armen/handen.
  const head = parts.reduce((best, part) => (part.max[1] > best.max[1] ? part : best), parts[0]);
  const rest = parts.filter((part) => part !== head);
  const legs = rest.filter((part) => part.min[1] < bottom + 0.12 * height && part.max[1] < bottom + 0.6 * height);
  const arms = rest.filter((part) => !legs.includes(part) && part.verts.length >= 60);
  if (arms.length === 0) return { links: null, rechts: null, confidence: "geen", notes: [`geen armstuk gevonden (${parts.length} huidstukken)`] };

  // Schouderpunt: het punt van het armstuk dat het dichtst bij het midden van het lichaam (as door het hoofd) en boven de heup ligt; hand = verste punt.
  const axis: Vec3 = [head.center[0], 0, head.center[2]];
  const handOf = (part: Comp): Vec3 => {
    let shoulder = part.verts[0];
    let best = 1e9;
    for (const v of part.verts) {
      const d = Math.hypot(mesh.pos[v * 3] - axis[0], mesh.pos[v * 3 + 2] - axis[2]) + 0.5 * Math.abs(mesh.pos[v * 3 + 1] - (bottom + 0.78 * height));
      if (d < best) {
        best = d;
        shoulder = v;
      }
    }
    const s: Vec3 = [mesh.pos[shoulder * 3], mesh.pos[shoulder * 3 + 1], mesh.pos[shoulder * 3 + 2]];
    const far = part.verts
      .map((v) => ({ v, d: Math.hypot(mesh.pos[v * 3] - s[0], mesh.pos[v * 3 + 1] - s[1], mesh.pos[v * 3 + 2] - s[2]) }))
      .sort((a, b) => b.d - a.d)
      .slice(0, Math.max(8, Math.round(part.verts.length * 0.12)));
    const sum: Vec3 = [0, 0, 0];
    for (const { v } of far) for (let k = 0; k < 3; k++) sum[k] += mesh.pos[v * 3 + k];
    return [sum[0] / far.length, sum[1] / far.length, sum[2] / far.length];
  };
  const sortedArms = arms.sort((a, b) => b.verts.length - a.verts.length).slice(0, 2).map((part) => ({ part, hand: handOf(part) }));
  // Links/rechts uit het leerlingperspectief: voorkant +Z, dus de linkerhand van de leerling ligt aan +X.
  const byX = [...sortedArms].sort((a, b) => b.hand[0] - a.hand[0]);
  const round = (v: Vec3): Vec3 => [Math.round(v[0] * 1000) / 1000, Math.round(v[1] * 1000) / 1000, Math.round(v[2] * 1000) / 1000];
  let links: Vec3 | null = byX[0] ? round(byX[0].hand) : null;
  let rechts: Vec3 | null = byX[1] ? round(byX[1].hand) : null;
  let confidence: HandPoints["confidence"] = sortedArms.length === 2 ? "hoog" : "laag";
  if (sortedArms.length < 2) {
    notes.push("maar één armstuk gevonden: de andere hand ligt waarschijnlijk achter het lichaam of tegen het lichaam aan");
    rechts = null;
    links = links;
  } else if (Math.abs(byX[0].hand[0] - byX[1].hand[0]) < 0.12) {
    // De handen liggen op dezelfde X: links/rechts is dan een gok (bijv. een pose in profiel).
    confidence = "laag";
    notes.push("handen liggen op dezelfde zijwaartse positie: links/rechts is een gok");
  }
  if (arms.length > 2) notes.push(`${arms.length} armachtige huidstukken; de 2 grootste gebruikt`);
  return { links, rechts, confidence, notes };
}
